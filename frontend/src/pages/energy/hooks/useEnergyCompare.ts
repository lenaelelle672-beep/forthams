/**
 * @file pages/energy/hooks/useEnergyCompare
 * @description 同环比对比 hook（gai2 W28 — Step2 4 权威化端点之一）。
 *
 * - 调用 energyService.getCompare(currentStart, currentEnd, previousStart, previousEnd, groupBy)
 * - currentRange/previousRange 自动从 useSpatialTime 派生：本周期/对比周期
 * - 30s staleTime
 * - 错误抛出，调用方在 Page 组件处理 ErrorState
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSpatialTime } from '@/components/shared/SpatialTimeContext';
import energyService, { type EnergyCompare } from '@/services/energyService';

export interface UseEnergyCompareOptions {
  /** 显式指定 groupBy（默认 MONTH） */
  groupBy?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
}

/**
 * 计算上期（previousRange）— 基于当前 range 简单向前推 1 个 groupBy 跨度。
 * - WEEK → previousStart = currentStart - 7d
 * - MONTH → previousStart = currentStart - 1 month
 * - YEAR → previousStart = currentStart - 1 year
 */
function derivePreviousRange(
  start: string,
  end: string,
  groupBy: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR',
): { previousStart: string; previousEnd: string } {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const spanMs = endDate.getTime() - startDate.getTime();
  const previousEndDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  const previousStartDate = new Date(previousEndDate.getTime() - spanMs);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { previousStart: iso(previousStartDate), previousEnd: iso(previousEndDate) };
}

export function useEnergyCompare(options: UseEnergyCompareOptions = {}) {
  const { query } = useSpatialTime();
  const groupBy = (options.groupBy ?? 'MONTH') as 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

  // 从 useSpatialTime 派生 current range
  const { currentStart, currentEnd, previousStart, previousEnd, enabled } = useMemo(() => {
    const today = new Date();
    const defaultEnd = today.toISOString().slice(0, 10);
    let defaultStart: string;
    switch (groupBy) {
      case 'DAY':
        defaultStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        break;
      case 'WEEK':
        defaultStart = new Date(today.getTime() - 11 * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        break;
      case 'YEAR':
        defaultStart = `${today.getFullYear() - 4}-01-01`;
        break;
      case 'MONTH':
      default:
        defaultStart = new Date(today.getFullYear(), today.getMonth() - 11, 1).toISOString().slice(0, 10);
        break;
    }
    const cStart = query.startDate || defaultStart;
    const cEnd = query.endDate || defaultEnd;
    const { previousStart: pStart, previousEnd: pEnd } = derivePreviousRange(cStart, cEnd, groupBy);
    return {
      currentStart: cStart,
      currentEnd: cEnd,
      previousStart: pStart,
      previousEnd: pEnd,
      enabled: Boolean(cStart && cEnd),
    };
  }, [query.startDate, query.endDate, groupBy]);

  return useQuery<EnergyCompare, Error>({
    queryKey: ['energy', 'compare', currentStart, currentEnd, previousStart, previousEnd, groupBy],
    queryFn: () =>
      energyService.getCompare({
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
        groupBy,
      }),
    staleTime: 30_000,
    enabled,
  });
}

export default useEnergyCompare;
