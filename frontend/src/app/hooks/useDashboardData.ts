/**
 * useDashboardData — 仪表板数据获取 Hook
 *
 * 封装仪表板核心 API 调用逻辑，提供统一的加载状态与错误处理。
 * 基于 dashboardService 获取统计数据、分类分布和趋势数据。
 *
 * @module hooks/useDashboardData
 * @see frontend/src/app/services/dashboardService.ts — DashboardStats
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dashboardService,
  type DashboardStats,
} from '../services/dashboardService';

/**
 * 分类分布数据项
 */
export interface CategoryItem {
  /** 分类名称 */
  name: string;
  /** 资产数量 */
  value: number;
}

/**
 * 合同到期预警项
 */
export interface ExpirationAlert {
  /** 唯一标识 */
  id: string;
  /** 资产名称 */
  assetName: string;
  /** 合同/维保到期日期 ISO 字符串 */
  expirationDate: string;
  /** 剩余天数（负数表示已过期） */
  remainingDays: number;
  /** 紧急程度 */
  urgency: 'urgent' | 'warning' | 'normal';
  /** 预警类型 */
  type: 'contract' | 'maintenance';
}

/**
 * Hook 返回值类型
 */
export interface UseDashboardDataReturn {
  /** 仪表板统计数据 */
  stats: DashboardStats | null;
  /** 分类分布数据 */
  categoryData: CategoryItem[];
  /** 到期预警列表 */
  expirationAlerts: ExpirationAlert[];
  /** 全局加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 手动刷新数据 */
  refresh: () => void;
}

/**
 * 将后端 categoryDistribution Record 转换为图表所需的数组格式
 *
 * @param distribution - 后端返回的分类-数量映射
 * @returns 图表可消费的数据数组
 */
function toCategoryItems(
  distribution: Record<string, number> | undefined,
): CategoryItem[] {
  if (!distribution || typeof distribution !== 'object') return [];
  return Object.entries(distribution)
    .filter(([, value]) => typeof value === 'number')
    .map(([name, value]) => ({ name, value }));
}

/**
 * 计算距离到期日期的剩余天数
 *
 * @param dateStr - ISO 格式的到期日期
 * @returns 剩余天数（负数表示已过期）
 */
function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 判断紧急程度
 *
 * @param remainingDays - 剩余天数
 * @returns 紧急程度标签
 */
function getUrgency(remainingDays: number): ExpirationAlert['urgency'] {
  if (remainingDays <= 7) return 'urgent';
  if (remainingDays <= 30) return 'warning';
  return 'normal';
}

/**
 * useDashboardData Hook
 *
 * 在组件挂载时自动加载仪表板数据，并提供手动刷新能力。
 * 使用 mounted 标志防止组件卸载后的状态更新。
 *
 * @example
 * ```tsx
 * const { stats, categoryData, expirationAlerts, loading, error, refresh } = useDashboardData();
 * ```
 */
export function useDashboardData(): UseDashboardDataReturn {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryItem[]>([]);
  const [expirationAlerts, setExpirationAlerts] = useState<ExpirationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  /**
   * 加载仪表板所有数据
   */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const statsResponse = await dashboardService.getStats();

      if (!mountedRef.current) return;

      setStats(statsResponse);
      setCategoryData(toCategoryItems(statsResponse.categoryDistribution));

      // 从统计数据中提取到期预警信息
      const alerts: ExpirationAlert[] = [];

      // 基于闲置资产和报废资产生成示例预警
      // 实际项目中应调用专门的到期预警 API
      if (statsResponse.maintenanceAssets > 0) {
        alerts.push({
          id: 'maintenance-overdue',
          assetName: '维保到期资产',
          expirationDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          remainingDays: 7,
          urgency: 'urgent',
          type: 'maintenance',
        });
      }

      if (statsResponse.scrapAssets > 0) {
        alerts.push({
          id: 'scrap-pending',
          assetName: '报废待处理资产',
          expirationDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
          remainingDays: 15,
          urgency: 'warning',
          type: 'contract',
        });
      }

      // 按紧急程度排序：urgent > warning > normal
      alerts.sort((a, b) => a.remainingDays - b.remainingDays);
      setExpirationAlerts(alerts);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : '仪表板数据加载失败');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  /** 初始加载 */
  useEffect(() => {
    mountedRef.current = true;
    void loadAll();

    return () => {
      mountedRef.current = false;
    };
  }, [loadAll]);

  /** 手动刷新 */
  const refresh = useCallback(() => {
    void loadAll();
  }, [loadAll]);

  return {
    stats,
    categoryData,
    expirationAlerts,
    loading,
    error,
    refresh,
  };
}

export default useDashboardData;
