/**
 * @file pages/energy/hooks/useEnergyDashboard
 * @description 能耗仪表盘数据拉取 hook（R4 新增）
 *
 * - 30s staleTime
 * - 参数变化自动重拉
 * - 错误抛出，由 Page 组件处理 ErrorState
 */
import { useQuery } from '@tanstack/react-query';
import energyService, { type EnergyDashboardData, type EnergyDashboardParams } from '@/services/energyService';

export function useEnergyDashboard(params: EnergyDashboardParams = {}) {
  return useQuery<EnergyDashboardData, Error>({
    queryKey: ['energy', 'dashboard', params],
    queryFn: () => energyService.getDashboard(params),
    staleTime: 30_000,
  });
}
