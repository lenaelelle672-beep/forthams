/**
 * @file pages/energy/hooks/useEnergyAnomalies
 * @description 能耗异常检测 hook（R4 新增）
 *
 * 策略：z-score 1.5σ 阈值（保留既有前端 detectAnomalies 行为）
 * - 当 |value - mean| > threshold * stddev 时判定为异常
 * - 按偏离程度降序返回 top N
 *
 * B5 后端化（/energy/anomalies）推迟到下一轮；本轮用前端 useMemo 兜底。
 */
import { useMemo } from 'react';

export interface EnergyAnomalyPoint {
  /** 时间桶 key（YYYY-MM-DD / YYYY-MM / YYYY） */
  period: string;
  /** 实际值 */
  value: number;
  /** 期望（均值） */
  expected: number;
  /** 偏差绝对值 */
  deviation: number;
  /** 偏离标准差的倍数 */
  zScore: number;
  /** 严重度（high / medium） */
  severity: 'high' | 'medium';
}

export interface UseEnergyAnomaliesOptions {
  /** 阈值（标准差倍数），默认 1.5 */
  threshold?: number;
  /** 最多返回的异常点数，默认 5 */
  limit?: number;
}

export function useEnergyAnomalies(
  trend: Record<string, number> | undefined | null,
  options: UseEnergyAnomaliesOptions = {},
): EnergyAnomalyPoint[] {
  const { threshold = 1.5, limit = 5 } = options;

  return useMemo<EnergyAnomalyPoint[]>(() => {
    if (!trend) return [];
    const entries = Object.entries(trend).map(([k, v]) => [k, Number(v)] as const);
    if (entries.length < 3) return [];

    const values = entries.map(([, v]) => v);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
    const stddev = Math.sqrt(variance);

    // 标准差为 0 表示完全平稳，无异常
    if (stddev === 0) return [];

    const anomalies: EnergyAnomalyPoint[] = entries
      .map(([period, value]) => {
        const deviation = value - mean;
        const zScore = Math.abs(deviation) / stddev;
        return { period, value, expected: mean, deviation: Math.abs(deviation), zScore, severity: 'medium' as const };
      })
      .filter((p) => p.zScore > threshold)
      .sort((a, b) => b.zScore - a.zScore)
      .slice(0, limit);

    return anomalies.map((a) => ({
      ...a,
      severity: a.zScore > threshold * 1.5 ? ('high' as const) : ('medium' as const),
    }));
  }, [trend, threshold, limit]);
}

export default useEnergyAnomalies;
