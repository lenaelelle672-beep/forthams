/**
 * DashboardPage — 仪表板主页面
 *
 * 通过 useDashboardData Hook 获取真实 API 数据，
 * 整合资产概览卡片、分类分布饼图、到期预警列表三大核心模块。
 *
 * 功能：
 * - 展示资产总数、待审批流程、闲置资产、资产净值四大核心指标
 * - 展示资产分类分布饼图
 * - 展示合同到期预警和维保到期预警
 *
 * @module pages/DashboardPage
 * @see frontend/src/app/hooks/useDashboardData.ts — useDashboardData
 * @see frontend/src/app/components/dashboard/AssetOverviewCard.tsx
 * @see frontend/src/app/components/dashboard/CategoryStatsChart.tsx
 * @see frontend/src/app/components/dashboard/ExpirationAlertList.tsx
 */

import React, { useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
} from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { AssetOverviewCard } from '../components/dashboard/AssetOverviewCard';
import { CategoryStatsChart } from '../components/dashboard/CategoryStatsChart';
import { ExpirationAlertList } from '../components/dashboard/ExpirationAlertList';

/**
 * 格式化数值显示
 *
 * @param value - 待格式化的值
 * @returns 格式化后的字符串
 */
function formatNumber(value?: number | string): string {
  if (value === undefined || value === null || value === '') {
    return '--';
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return String(value);
  }
  return new Intl.NumberFormat('zh-CN').format(numericValue);
}

/**
 * 格式化货币值
 *
 * @param value - 待格式化的货币值
 * @returns 带有 ¥ 前缀的格式化字符串
 */
function formatCurrency(value?: number | string): string {
  if (value === undefined || value === null || value === '') {
    return '--';
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return String(value);
  }
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(numericValue);
}

/**
 * DashboardPage 主页面组件
 *
 * 使用 useDashboardData Hook 加载仪表板统计数据，
 * 并分发至 AssetOverviewCard、CategoryStatsChart、ExpirationAlertList 子组件渲染。
 * 包含加载态、错误态和正常态三种 UI 状态。
 *
 * @example
 * ```tsx
 * // 在路由中直接使用
 * <Route path="/" element={<DashboardPage />} />
 * ```
 */
export const DashboardPage: React.FC = () => {
  const { stats, categoryData, expirationAlerts, loading, error, refresh } = useDashboardData();

  /** 统计卡片配置 */
  const statCards = useMemo(
    () => [
      {
        name: '资产总数',
        value: stats?.totalAssets ?? '--',
        detail: `在用资产 ${formatNumber(stats?.inUseAssets)}`,
        icon: Package,
        iconBgClass: 'bg-blue-50',
        iconTextClass: 'text-blue-600',
        dataTestId: 'stat-total',
      },
      {
        name: '待审批流程',
        value: stats?.pendingApprovals ?? '--',
        detail: '待处理审批事项',
        icon: Clock,
        iconBgClass: 'bg-amber-50',
        iconTextClass: 'text-amber-600',
        dataTestId: 'stat-pending',
      },
      {
        name: '闲置资产',
        value: stats?.idleAssets ?? '--',
        detail: `报废资产 ${formatNumber(stats?.scrapAssets)}`,
        icon: AlertCircle,
        iconBgClass: 'bg-orange-50',
        iconTextClass: 'text-orange-600',
        dataTestId: 'stat-idle',
      },
      {
        name: '资产净值',
        value: stats?.netValue ?? '--',
        detail: `总值 ${formatCurrency(stats?.totalValue)}`,
        icon: CheckCircle,
        iconBgClass: 'bg-green-50',
        iconTextClass: 'text-green-600',
        dataTestId: 'stat-value',
      },
    ],
    [stats],
  );

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">仪表板</h2>
          <p className="text-gray-600 mt-1">欢迎回来，这是您的资产管理概览</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={loading}
          data-testid="dashboard-refresh"
        >
          {loading ? '加载中...' : '刷新数据'}
        </button>
      </div>

      {/* 全局错误态 */}
      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <AssetOverviewCard
            key={card.name}
            title={card.name}
            value={card.value}
            detail={card.detail}
            icon={card.icon}
            iconBgClass={card.iconBgClass}
            iconTextClass={card.iconTextClass}
            loading={loading}
            dataTestId={card.dataTestId}
          />
        ))}
      </div>

      {/* 图表和预警区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 分类分布饼图 */}
        <CategoryStatsChart data={categoryData} loading={loading} />
        {/* 到期预警列表 */}
        <ExpirationAlertList
          items={expirationAlerts}
          loading={loading}
          dataTestId="dashboard-expiration-alerts"
        />
      </div>
    </div>
  );
};

export default DashboardPage;
