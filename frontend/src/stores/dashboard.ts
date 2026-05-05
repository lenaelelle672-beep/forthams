/**
 * Dashboard Store - 仪表盘状态管理
 * 
 * 提供仪表盘数据的 Zustand 状态管理，支持：
 * - 资产统计数据状态持久化
 * - 退役流程相关统计
 * - 审批链统计数据
 * - 历史记录查询状态
 * 
 * @package @swarm-002/retirement-flow
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 资产状态枚举 - 对应 SWARM-002 状态机定义
export enum AssetStatus {
  ACTIVE = 'ACTIVE',
  PENDING_RETIREMENT = 'PENDING_RETIREMENT',
  UNDER_APPROVAL = 'UNDER_APPROVAL',
  RETIRED = 'RETIRED',
  DISPOSED = 'DISPOSED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

// 仪表盘统计数据类型
export interface DashboardStats {
  totalAssets: number;
  activeAssets: number;
  pendingRetirement: number;
  underApproval: number;
  retiredAssets: number;
  disposedAssets: number;
  // 退役相关统计
  retirementApplications: number;
  pendingApprovals: number;
  completedRetirements: number;
  // 审批链统计
  awaitingFirstApproval: number;
  awaitingSecondApproval: number;
  awaitingThirdApproval: number;
  awaitingFinalApproval: number;
  // 时间戳
  lastUpdated: string | null;
}

// 资产状态分布数据
export interface AssetStatusDistribution {
  status: AssetStatus;
  count: number;
  percentage: number;
}

// 退役申请统计
export interface RetirementStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  rejected: number;
  withdrawn: number;
}

// 审批超时预警
export interface ApprovalTimeoutWarning {
  applicationId: string;
  assetId: string;
  assetName: string;
  approvalLevel: number;
  elapsedHours: number;
  threshold: number;
  approverName: string;
}

// 仪表盘筛选条件
export interface DashboardFilters {
  dateRange: {
    start: string;
    end: string;
  } | null;
  assetType: string | null;
  department: string | null;
  status: AssetStatus | null;
}

// 仪表盘状态接口
interface DashboardState {
  // 统计数据
  stats: DashboardStats;
  statusDistribution: AssetStatusDistribution[];
  retirementStats: RetirementStats;
  
  // 超时预警列表
  approvalWarnings: ApprovalTimeoutWarning[];
  
  // 筛选条件
  filters: DashboardFilters;
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
  
  // 操作方法
  setStats: (stats: Partial<DashboardStats>) => void;
  setStatusDistribution: (distribution: AssetStatusDistribution[]) => void;
  setRetirementStats: (stats: RetirementStats) => void;
  setApprovalWarnings: (warnings: ApprovalTimeoutWarning[]) => void;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  clearFilters: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// 初始状态
const initialStats: DashboardStats = {
  totalAssets: 0,
  activeAssets: 0,
  pendingRetirement: 0,
  underApproval: 0,
  retiredAssets: 0,
  disposedAssets: 0,
  retirementApplications: 0,
  pendingApprovals: 0,
  completedRetirements: 0,
  awaitingFirstApproval: 0,
  awaitingSecondApproval: 0,
  awaitingThirdApproval: 0,
  awaitingFinalApproval: 0,
  lastUpdated: null,
};

const initialRetirementStats: RetirementStats = {
  total: 0,
  pending: 0,
  inProgress: 0,
  completed: 0,
  rejected: 0,
  withdrawn: 0,
};

const initialFilters: DashboardFilters = {
  dateRange: null,
  assetType: null,
  department: null,
  status: null,
};

/**
 * 创建仪表盘状态存储
 * 
 * 使用 Zustand 进行状态管理，支持 localStorage 持久化
 * 包含退役流程相关的状态管理和超时预警功能
 */
export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      // 初始状态
      stats: initialStats,
      statusDistribution: [],
      retirementStats: initialRetirementStats,
      approvalWarnings: [],
      filters: initialFilters,
      isLoading: false,
      error: null,

      // 设置统计数据
      setStats: (newStats) =>
        set((state) => ({
          stats: {
            ...state.stats,
            ...newStats,
            lastUpdated: new Date().toISOString(),
          },
        })),

      // 设置状态分布
      setStatusDistribution: (distribution) =>
        set({ statusDistribution: distribution }),

      // 设置退役统计
      setRetirementStats: (stats) =>
        set({ retirementStats: stats }),

      // 设置审批超时预警
      setApprovalWarnings: (warnings) =>
        set({ approvalWarnings: warnings }),

      // 设置筛选条件
      setFilters: (filters) =>
        set((state) => ({
          filters: {
            ...state.filters,
            ...filters,
          },
        })),

      // 清除筛选条件
      clearFilters: () =>
        set({ filters: initialFilters }),

      // 设置加载状态
      setLoading: (isLoading) =>
        set({ isLoading }),

      // 设置错误信息
      setError: (error) =>
        set({ error }),

      // 重置状态
      reset: () =>
        set({
          stats: initialStats,
          statusDistribution: [],
          retirementStats: initialRetirementStats,
          approvalWarnings: [],
          filters: initialFilters,
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: 'dashboard-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        stats: state.stats,
        statusDistribution: state.statusDistribution,
        retirementStats: state.retirementStats,
        filters: state.filters,
      }),
    }
  )
);

/**
 * 辅助函数：计算审批超时预警
 * 
 * @param applications - 退役申请列表
 * @param thresholdHours - 超时阈值（默认72小时）
 * @returns 超时预警列表
 */
export function calculateApprovalTimeouts(
  applications: Array<{
    id: string;
    assetId: string;
    assetName: string;
    approvalLevel: number;
    submittedAt: string;
    approverName: string;
  }>,
  thresholdHours: number = 72
): ApprovalTimeoutWarning[] {
  const now = new Date();
  
  return applications
    .map((app) => {
      const submittedAt = new Date(app.submittedAt);
      const elapsedHours = (now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60);
      
      return {
        applicationId: app.id,
        assetId: app.assetId,
        assetName: app.assetName,
        approvalLevel: app.approvalLevel,
        elapsedHours,
        threshold: thresholdHours,
        approverName: app.approverName,
      };
    })
    .filter((warning) => warning.elapsedHours >= warning.threshold);
}

/**
 * 辅助函数：计算状态分布百分比
 * 
 * @param stats - 仪表盘统计数据
 * @returns 状态分布数组
 */
export function calculateStatusDistribution(stats: DashboardStats): AssetStatusDistribution[] {
  const total =
    stats.activeAssets +
    stats.pendingRetirement +
    stats.underApproval +
    stats.retiredAssets +
    stats.disposedAssets;

  if (total === 0) return [];

  return [
    {
      status: AssetStatus.ACTIVE,
      count: stats.activeAssets,
      percentage: (stats.activeAssets / total) * 100,
    },
    {
      status: AssetStatus.PENDING_RETIREMENT,
      count: stats.pendingRetirement,
      percentage: (stats.pendingRetirement / total) * 100,
    },
    {
      status: AssetStatus.UNDER_APPROVAL,
      count: stats.underApproval,
      percentage: (stats.underApproval / total) * 100,
    },
    {
      status: AssetStatus.RETIRED,
      count: stats.retiredAssets,
      percentage: (stats.retiredAssets / total) * 100,
    },
    {
      status: AssetStatus.DISPOSED,
      count: stats.disposedAssets,
      percentage: (stats.disposedAssets / total) * 100,
    },
  ];
}

/**
 * 辅助函数：验证状态转换是否有效
 * 
 * @param currentStatus - 当前状态
 * @param targetStatus - 目标状态
 * @returns 是否允许转换
 */
export function canTransition(
  currentStatus: AssetStatus,
  targetStatus: AssetStatus
): boolean {
  const validTransitions: Record<AssetStatus, AssetStatus[]> = {
    [AssetStatus.ACTIVE]: [AssetStatus.PENDING_RETIREMENT],
    [AssetStatus.PENDING_RETIREMENT]: [AssetStatus.UNDER_APPROVAL, AssetStatus.WITHDRAWN],
    [AssetStatus.UNDER_APPROVAL]: [AssetStatus.RETIRED, AssetStatus.REJECTED],
    [AssetStatus.RETIRED]: [AssetStatus.DISPOSED],
    [AssetStatus.DISPOSED]: [],
    [AssetStatus.REJECTED]: [AssetStatus.PENDING_RETIREMENT],
    [AssetStatus.WITHDRAWN]: [AssetStatus.PENDING_RETIREMENT],
  };

  return validTransitions[currentStatus]?.includes(targetStatus) ?? false;
}

export default useDashboardStore;