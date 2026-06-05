/**
 * @file pages/energy/hooks/useEnergyAnomaliesAuthority
 * @description 能耗异常检测 hook — 后端权威版（gai2 W29 — Step2 4 权威化端点之一）。
 *
 * - 调用 energyService.getAnomalies(startDate, endDate, periodType, method, threshold)
 * - 30s staleTime
 * - 错误抛出，调用方在 Page 组件处理 ErrorState
 *
 * 注：与 useEnergyAnomalies（前端 z-score 兜底）并存，权威版优先 — EnergyDashboardPage 接入本 hook 替换客户端算法。
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSpatialTime } from '@/components/shared/SpatialTimeContext';
import energyService, { type EnergyAnomalies } from '@/services/energyService';

export interface UseEnergyAnomaliesAuthorityOptions {
  /** 阈值（标准差倍数），默认 1.5 */
  threshold?: number;
  /** 方法：zscore | stddev，默认 zscore */
  method?: 'zscore' | 'stddev';
  /** 周期粒度，默认 MONTH */
  periodType?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
}

export function useEnergyAnomaliesAuthority(options: UseEnergyAnomaliesAuthorityOptions = {}) {
  const { query } = useSpatialTime();
  const { threshold = 1.5, method = 'zscore', periodType = 'MONTH' } = options;

  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    const defaultEnd = today.toISOString().slice(0, 10);
    const defaultStart = new Date(today.getFullYear(), today.getMonth() - 11, 1).toISOString().slice(0, 10);
    return {
      startDate: query.startDate || defaultStart,
      endDate: query.endDate || defaultEnd,
    };
  }, [query.startDate, query.endDate]);

  return useQuery<EnergyAnomalies, Error>({
    queryKey: ['energy', 'anomalies-authority', startDate, endDate, periodType, method, threshold],
    queryFn: () =>
      energyService.getAnomalies({
        startDate,
        endDate,
        periodType,
        method,
        threshold,
      }),
    staleTime: 30_000,
  });
}

export default useEnergyAnomaliesAuthority;
