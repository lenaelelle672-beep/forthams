/**
 * DashboardStatCard — 资产统计卡片原子组件
 *
 * 展示单个核心指标（如：资产总数、在用数、闲置数、报废数等），
 * 支持图标、数值、辅助说明文本和自定义主题色。
 *
 * @module components/dashboard/DashboardStatCard
 * @see frontend/src/app/services/dashboardService.ts — DashboardStats 接口
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * DashboardStatCard 组件属性
 */
export interface DashboardStatCardProps {
  /** 卡片标题，如 "资产总数" */
  title: string;
  /** 主数值，支持 number 或已格式化的 string */
  value: number | string;
  /** 辅助说明文本，如 "在用资产 120" */
  detail?: string;
  /** 图标组件（来自 lucide-react） */
  icon: LucideIcon;
  /** Tailwind 背景色类，用于图标容器背景，默认 "bg-blue-50" */
  iconBgClass?: string;
  /** Tailwind 文字色类，用于图标颜色，默认 "text-blue-600" */
  iconTextClass?: string;
  /** 加载态标记 */
  loading?: boolean;
  /** data-testid 用于 E2E 测试 */
  dataTestId?: string;
}

/**
 * 格式化数值：添加千位分隔符
 *
 * @param value - 待格式化的值
 * @returns 格式化后的字符串或原始值
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
 * DashboardStatCard 组件
 *
 * @example
 * ```tsx
 * <DashboardStatCard
 *   title="资产总数"
 *   value={1280}
 *   detail="在用资产 1024"
 *   icon={Package}
 *   iconBgClass="bg-blue-50"
 *   iconTextClass="text-blue-600"
 *   dataTestId="stat-total"
 * />
 * ```
 */
export const DashboardStatCard: React.FC<DashboardStatCardProps> = ({
  title,
  value,
  detail,
  icon: Icon,
  iconBgClass = 'bg-blue-50',
  iconTextClass = 'text-blue-600',
  loading = false,
  dataTestId,
}) => {
  if (loading) {
    return (
      <div
        className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse"
        data-testid={dataTestId ? `${dataTestId}-loading` : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 bg-blue-50 rounded w-20 mb-3" />
            <div className="h-8 bg-blue-50 rounded w-16 mb-2" />
            <div className="h-3 bg-blue-50 rounded w-28" />
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-lg" />
        </div>
      </div>
    );
  }

  const isCurrency =
    typeof value === 'string' && (value.includes('¥') || value.startsWith('CNY'));

  const displayValue =
    typeof value === 'number'
      ? title.includes('净值') || title.includes('总值') || title.includes('价值')
        ? formatCurrency(value)
        : formatNumber(value)
      : String(value);

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
      data-testid={dataTestId}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-semibold text-gray-900 mt-2">{displayValue}</p>
          {detail ? <p className="mt-2 text-sm text-gray-400">{detail}</p> : null}
        </div>
        <div className={`w-12 h-12 ${iconBgClass} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${iconTextClass}`} />
        </div>
      </div>
    </div>
  );
};

export default DashboardStatCard;
