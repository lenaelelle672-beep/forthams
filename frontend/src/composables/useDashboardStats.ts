/**
 * Dashboard Statistics Composable
 * @description 提供仪表板数据看板的统计状态管理，支持自动刷新和数据格式化
 * @module useDashboardStats
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { message } from 'antd';

// ============================================================
// Type Definitions / 类型定义
// ============================================================

/**
 * 资产总览统计数据
 */
export interface AssetOverviewDTO {
  /** 资产总数 */
  total: number;
  /** 在线资产数 */
  online: number;
  /** 离线资产数 */
  offline: number;
  /** 告警资产数 */
  warning: number;
  /** 统计趋势数据 */
  trend?: {
    total?: number;
    online?: number;
    offline?: number;
    warning?: number;
  };
}

/**
 * 资产分类分布项
 */
export interface CategoryItemDTO {
  /** 分类名称 */
  name: string;
  /** 资产数量 */
  value: number;
  /** 占比百分比 */
  percentage?: number;
}

/**
 * 资产分类分布数据
 */
export interface CategoryDistributionDTO {
  /** 分类列表（最多12项，超出合并为"其他"） */
  categories: CategoryItemDTO[];
  /** 数据更新时间 */
  updatedAt?: string;
}

/**
 * 维保到期预警项
 */
export interface MaintenanceWarningDTO {
  /** 资产ID */
  id: string;
  /** 资产名称 */
  name: string;
  /** 资产编码 */
  code: string;
  /** 剩余天数 */
  expireDays: number;
  /** 维保到期日期 */
  expireDate: string;
  /** 紧急程度：urgent/warning/normal */
  severity: 'urgent' | 'warning' | 'normal';
}

/**
 * 维保预警汇总数据
 */
export interface MaintenanceWarningSummaryDTO {
  /** 预警列表（最多5条） */
  warnings: MaintenanceWarningDTO[];
  /** 紧急数量（≤7天） */
  urgentCount: number;
  /** 预警数量（8-30天） */
  warningCount: number;
  /** 正常数量（>30天） */
  normalCount: number;
  /** 总数 */
  total: number;
}

/**
 * 仪表板完整统计数据
 */
export interface DashboardStatsDTO {
  /** 资产总览 */
  overview: AssetOverviewDTO;
  /** 分类分布 */
  distribution: CategoryDistributionDTO;
  /** 维保预警 */
  maintenanceWarnings: MaintenanceWarningSummaryDTO;
  /** 数据时间戳 */
  timestamp: string;
}

/**
 * Composable 配置选项
 */
export interface UseDashboardStatsOptions {
  /** 自动刷新间隔（毫秒），默认 60000ms（60s），最小 30000ms，最大 300000ms */
  refreshInterval?: number;
  /** 是否启用自动刷新，默认 true */
  autoRefresh?: boolean;
  /** 是否显示加载状态，默认 true */
  showLoading?: boolean;
  /** 刷新失败时的重试次数，默认 3 */
  retryCount?: number;
  /** 数据格式化选项 */
  formatOptions?: {
    /** 是否截断大数字，默认 true */
    truncateLargeNumbers?: boolean;
    /** 最大显示数字 */
    maxDisplayNumber?: number;
  };
}

// ============================================================
// Constants / 常量
// ============================================================

const DEFAULT_REFRESH_INTERVAL = 60000;
const MIN_REFRESH_INTERVAL = 30000;
const MAX_REFRESH_INTERVAL = 300000;
const MAX_CATEGORY_COUNT = 12;
const MAX_WARNING_DISPLAY = 5;
const MAX_DISPLAY_NUMBER = 999999;

/**
 * 维保预警时间分级阈值
 */
const MAINTENANCE_THRESHOLDS = {
  URGENT: 7,    // ≤7天 红色
  WARNING: 30,  // 8-30天 橙色
  // >30天 灰色（正常）
} as const;

// ============================================================
// Utility Functions / 工具函数
// ============================================================

/**
 * 格式化数字显示
 * @description 超过最大显示数字时截断显示 "999K+"
 * @param value - 原始数值
 * @param maxNumber - 最大显示数字，默认 999999
 * @param truncate - 是否截断，默认 true
 */
export const formatNumber = (
  value: number | null | undefined,
  maxNumber: number = MAX_DISPLAY_NUMBER,
  truncate: boolean = true
): string => {
  if (value === null || value === undefined) {
    return '--';
  }

  if (value === 0) {
    return '0';
  }

  if (truncate && value >= maxNumber) {
    return '999K+';
  }

  return value.toLocaleString('zh-CN');
};

/**
 * 计算维保紧急程度
 * @param expireDays - 剩余天数
 */
export const calculateSeverity = (expireDays: number): 'urgent' | 'warning' | 'normal' => {
  if (expireDays <= MAINTENANCE_THRESHOLDS.URGENT) {
    return 'urgent';
  }
  if (expireDays <= MAINTENANCE_THRESHOLDS.WARNING) {
    return 'warning';
  }
  return 'normal';
};

/**
 * 合并超限分类为"其他"
 * @param categories - 原始分类列表
 * @param maxCount - 最大显示数量，默认 12
 */
export const mergeExcessCategories = (
  categories: CategoryItemDTO[],
  maxCount: number = MAX_CATEGORY_COUNT
): CategoryItemDTO[] => {
  if (categories.length <= maxCount) {
    return categories;
  }

  const visibleCategories = categories.slice(0, maxCount - 1);
  const mergedCategories = categories.slice(maxCount - 1);

  const mergedValue = mergedCategories.reduce((sum, item) => sum + item.value, 0);
  const mergedPercentage = mergedCategories.reduce((sum, item) => sum + (item.percentage || 0), 0);

  return [
    ...visibleCategories,
    {
      name: '其他',
      value: mergedValue,
      percentage: mergedPercentage,
    },
  ];
};

/**
 * 验证刷新间隔
 * @param interval - 刷新间隔（毫秒）
 */
export const validateRefreshInterval = (interval: number): number => {
  if (interval < MIN_REFRESH_INTERVAL) {
    return MIN_REFRESH_INTERVAL;
  }
  if (interval > MAX_REFRESH_INTERVAL) {
    return MAX_REFRESH_INTERVAL;
  }
  return interval;
};

// ============================================================
// Mock Data / 模拟数据
// ============================================================

/**
 * 生成 Mock 资产总览数据
 */
const generateMockOverview = (): AssetOverviewDTO => ({
  total: 1234,
  online: 1100,
  offline: 50,
  warning: 84,
  trend: {
    total: 5.2,
    online: 3.1,
    offline: -2.0,
    warning: 12.5,
  },
});

/**
 * 生成 Mock 分类分布数据
 */
const generateMockDistribution = (): CategoryDistributionDTO => ({
  categories: [
    { name: '设备A', value: 350, percentage: 28.4 },
    { name: '设备B', value: 280, percentage: 22.7 },
    { name: '设备C', value: 200, percentage: 16.2 },
    { name: '设备D', value: 150, percentage: 12.2 },
    { name: '设备E', value: 100, percentage: 8.1 },
    { name: '设备F', value: 80, percentage: 6.5 },
    { name: '设备G', value: 50, percentage: 4.1 },
    { name: '设备H', value: 24, percentage: 1.9 },
  ],
  updatedAt: new Date().toISOString(),
});

/**
 * 生成 Mock 维保预警数据
 */
const generateMockWarnings = (): MaintenanceWarningSummaryDTO => {
  const warnings: MaintenanceWarningDTO[] = [
    { id: '1', name: '服务器A', code: 'SRV-001', expireDays: 3, expireDate: '2024-02-15', severity: 'urgent' },
    { id: '2', name: '交换机B', code: 'SW-002', expireDays: 5, expireDate: '2024-02-17', severity: 'urgent' },
    { id: '3', name: '路由器C', code: 'RT-003', expireDays: 15, expireDate: '2024-02-27', severity: 'warning' },
    { id: '4', name: '存储设备D', code: 'ST-004', expireDays: 22, expireDate: '2024-03-06', severity: 'warning' },
    { id: '5', name: '防火墙E', code: 'FW-005', expireDays: 60, expireDate: '2024-04-14', severity: 'normal' },
    { id: '6', name: '负载均衡F', code: 'LB-006', expireDays: 120, expireDate: '2024-05-14', severity: 'normal' },
  ];

  return {
    warnings: warnings.slice(0, MAX_WARNING_DISPLAY),
    urgentCount: warnings.filter(w => w.severity === 'urgent').length,
    warningCount: warnings.filter(w => w.severity === 'warning').length,
    normalCount: warnings.filter(w => w.severity === 'normal').length,
    total: warnings.length,
  };
};

/**
 * 获取完整的 Mock 数据
 */
export const getMockDashboardStats = async (): Promise<DashboardStatsDTO> => {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 300));

  return {
    overview: generateMockOverview(),
    distribution: generateMockDistribution(),
    maintenanceWarnings: generateMockWarnings(),
    timestamp: new Date().toISOString(),
  };
};

// ============================================================
// Main Composable / 主 Hook
// ============================================================

/**
 * 仪表板统计数据 Composable
 * @description 管理仪表板数据的获取、缓存、自动刷新和格式化
 * @param options - 配置选项
 */
export const useDashboardStats = (options: UseDashboardStatsOptions = {}) => {
  // 解析配置并设置默认值
  const {
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    autoRefresh = true,
    showLoading = true,
    retryCount = 3,
    formatOptions = {},
  } = options;

  const {
    truncateLargeNumbers = true,
    maxDisplayNumber = MAX_DISPLAY_NUMBER,
  } = formatOptions;

  // 验证并规范化刷新间隔
  const validatedInterval = useMemo(
    () => validateRefreshInterval(refreshInterval),
    [refreshInterval]
  );

  // State 状态
  const [stats, setStats] = useState<DashboardStatsDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(showLoading);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  /**
   * 获取仪表板统计数据
   * @description 从 API 或 Mock 获取数据
   */
  const fetchStats = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }

      // TODO: 替换为真实 API 调用
      // const response = await fetch('/api/dashboard/stats');
      // const data = await response.json();
      const data = await getMockDashboardStats();

      if (isMountedRef.current) {
        setStats(data);
        setLastUpdated(new Date());
        setError(null);
        retryCountRef.current = 0;
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorObj = err instanceof Error ? err : new Error('获取数据失败');
        setError(errorObj);

        // 重试逻辑
        if (retryCountRef.current < retryCount) {
          retryCountRef.current += 1;
          message.warning(`数据加载失败，${retryCount - retryCountRef.current + 1}秒后重试...`);
          setTimeout(() => fetchStats(isManualRefresh), 1000);
        } else {
          message.error('数据加载失败，请稍后重试');
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [retryCount]);

  /**
   * 手动刷新数据
   */
  const refresh = useCallback(() => {
    fetchStats(true);
  }, [fetchStats]);

  /**
   * 清除错误状态
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 设置自动刷新定时器
  useEffect(() => {
    if (autoRefresh && validatedInterval) {
      intervalRef.current = setInterval(() => {
        fetchStats(false);
      }, validatedInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefresh, validatedInterval, fetchStats]);

  // 初始加载
  useEffect(() => {
    isMountedRef.current = true;
    fetchStats(false);

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchStats]);

  // ============================================================
  // Computed Values / 计算值
  // ============================================================

  /**
   * 格式化的资产总览数据
   */
  const formattedOverview = useMemo(() => {
    if (!stats?.overview) {
      return null;
    }

    return {
      ...stats.overview,
      total: formatNumber(stats.overview.total, maxDisplayNumber, truncateLargeNumbers),
      online: formatNumber(stats.overview.online, maxDisplayNumber, truncateLargeNumbers),
      offline: formatNumber(stats.overview.offline, maxDisplayNumber, truncateLargeNumbers),
      warning: formatNumber(stats.overview.warning, maxDisplayNumber, truncateLargeNumbers),
    };
  }, [stats?.overview, maxDisplayNumber, truncateLargeNumbers]);

  /**
   * 格式化的分类分布数据（已合并超限分类）
   */
  const formattedDistribution = useMemo(() => {
    if (!stats?.distribution) {
      return null;
    }

    return {
      ...stats.distribution,
      categories: mergeExcessCategories(
        stats.distribution.categories,
        MAX_CATEGORY_COUNT
      ),
    };
  }, [stats?.distribution]);

  /**
   * 按紧急程度分组的预警列表
   */
  const groupedWarnings = useMemo(() => {
    if (!stats?.maintenanceWarnings?.warnings) {
      return { urgent: [], warning: [], normal: [] };
    }

    const warnings = stats.maintenanceWarnings.warnings;
    return {
      urgent: warnings.filter(w => w.severity === 'urgent'),
      warning: warnings.filter(w => w.severity === 'warning'),
      normal: warnings.filter(w => w.severity === 'normal'),
    };
  }, [stats?.maintenanceWarnings?.warnings]);

  /**
   * 预警摘要数据
   */
  const warningSummary = useMemo(() => {
    if (!stats?.maintenanceWarnings) {
      return null;
    }

    return {
      total: stats.maintenanceWarnings.total,
      urgentCount: stats.maintenanceWarnings.urgentCount,
      warningCount: stats.maintenanceWarnings.warningCount,
      normalCount: stats.maintenanceWarnings.normalCount,
    };
  }, [stats?.maintenanceWarnings]);

  // ============================================================
  // Return / 返回值
  // ============================================================

  return {
    // 原始数据
    stats,
    loading,
    error,
    lastUpdated,
    isRefreshing,

    // 格式化数据
    formattedOverview,
    formattedDistribution,
    groupedWarnings,
    warningSummary,

    // 操作方法
    refresh,
    clearError,

    // 配置信息
    refreshInterval: validatedInterval,
    autoRefresh,

    // 工具方法（导出供组件使用）
    formatNumber: (value: number | null | undefined) =>
      formatNumber(value, maxDisplayNumber, truncateLargeNumbers),
    calculateSeverity,
    mergeExcessCategories: (categories: CategoryItemDTO[]) =>
      mergeExcessCategories(categories, MAX_CATEGORY_COUNT),
  };
};

// ============================================================
// Export Named Exports / 命名导出
// ============================================================

export type {
  AssetOverviewDTO,
  CategoryItemDTO,
  CategoryDistributionDTO,
  MaintenanceWarningDTO,
  MaintenanceWarningSummaryDTO,
  DashboardStatsDTO,
  UseDashboardStatsOptions,
};

export {
  // 常量导出
  DEFAULT_REFRESH_INTERVAL,
  MIN_REFRESH_INTERVAL,
  MAX_REFRESH_INTERVAL,
  MAX_CATEGORY_COUNT,
  MAX_WARNING_DISPLAY,
  MAX_DISPLAY_NUMBER,
  MAINTENANCE_THRESHOLDS,
};

export {
  // 函数导出
  formatNumber,
  calculateSeverity,
  mergeExcessCategories,
  validateRefreshInterval,
  getMockDashboardStats,
};