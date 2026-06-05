/**
 * @file pages/energy/hooks/useEnergyRanking
 * @description 跨维度排名 hook（gai2 W30 — Step2 4 权威化端点之一）。
 *
 * - 调用 energyService.getRanking(scope, range, meterType, limit)
 * - scope: asset | building | floor | area（默认 asset）
 * - 30s staleTime
 * - 错误抛出，调用方在 Page 组件处理 ErrorState
 */
import { useQuery } from '@tanstack/react-query';
import energyService, { type EnergyRanking } from '@/services/energyService';

export interface UseEnergyRankingOptions {
  scope?: 'asset' | 'building' | 'floor' | 'area';
  range?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  meterType?: 'ELECTRICITY' | 'WATER' | 'GAS';
  limit?: number;
}

export function useEnergyRanking(options: UseEnergyRankingOptions = {}) {
  const { scope = 'asset', range = 'MONTH', meterType, limit = 10 } = options;
  return useQuery<EnergyRanking, Error>({
    queryKey: ['energy', 'ranking', scope, range, meterType, limit],
    queryFn: () => {
      // EnergyRanking 接口需要 { scope, items } 形态；后端 /energy/ranking 返回 Array<Map>
      // 这里做一次轻量归一化：取数组第一项 + 剩余 items 平铺
      return energyService.getRanking({ scope, range, meterType, limit }).then((raw) => {
        const arr = Array.isArray(raw) ? (raw as unknown as Array<Record<string, unknown>>) : [];
        const items = arr.map((r, i) => ({
          assetId: typeof r.assetId === 'number' ? (r.assetId as number) : undefined,
          locationId: typeof r.locationId === 'number' ? (r.locationId as number) : undefined,
          consumption: r.consumption != null ? String(r.consumption) : '0',
          rank: i + 1,
        }));
        return { scope, items } as EnergyRanking;
      });
    },
    staleTime: 30_000,
  });
}

export default useEnergyRanking;
