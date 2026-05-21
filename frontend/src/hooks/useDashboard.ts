/**
 * @file hooks/useDashboard.ts
 * @description 仪表板数据 hooks（TanStack Query）
 */

import { useQuery } from '@tanstack/react-query';
import {
  getDashboardStats,
  getAssetValueTrends,
  getDeptDistribution,
  getMaintenanceStats,
  getPendingApprovalsCount,
} from '@/api/asset';

export const dashboardKeys = {
  all:         ['dashboard'] as const,
  stats:       () => [...dashboardKeys.all, 'stats']        as const,
  trends:      (days: number) => [...dashboardKeys.all, 'trends', days] as const,
  deptDist:    () => [...dashboardKeys.all, 'dept-distribution']        as const,
  maintenance: () => [...dashboardKeys.all, 'maintenance-stats']        as const,
  pending:     () => [...dashboardKeys.all, 'pending-approvals']        as const,
};

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn:  () => getDashboardStats(),
    staleTime: 1000 * 60 * 5, // 5 分钟缓存
    refetchInterval: 1000 * 60 * 5,
  });
}

export function useAssetValueTrends(days = 365) {
  return useQuery({
    queryKey: dashboardKeys.trends(days),
    queryFn:  () => getAssetValueTrends(days),
    staleTime: 1000 * 60 * 15,
  });
}

export function useDeptDistribution() {
  return useQuery({
    queryKey: dashboardKeys.deptDist(),
    queryFn:  () => getDeptDistribution(),
    staleTime: 1000 * 60 * 15,
  });
}

export function useMaintenanceStats() {
  return useQuery({
    queryKey: dashboardKeys.maintenance(),
    queryFn:  () => getMaintenanceStats(),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
}

export function usePendingApprovalsCount() {
  return useQuery({
    queryKey: dashboardKeys.pending(),
    queryFn:  () => getPendingApprovalsCount(),
    staleTime: 1000 * 30, // 30 秒（高频刷新）
    refetchInterval: 1000 * 30,
  });
}
