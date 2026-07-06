/**
 * AssetOverviewCard — 资产概览统计卡片组件
 *
 * 展示仪表板四大核心指标：资产总数、待审批流程、闲置资产、资产净值。
 * 每张卡片包含图标、主数值和辅助说明文本，支持加载态和自定义主题色。
 *
 * @module components/dashboard/AssetOverviewCard
 * @see frontend/src/app/hooks/useDashboardData.ts — DashboardStats
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * AssetOverviewCard 组件属性
 */
export interface AssetOverviewCardProps {
  /** 卡片标题，如 "资产总数" */
  title: string;
  /** 主数值，支持 number 或已格式化的 string */
  value: number | string;
  /** 辅助说明文本 */
  detail?: string;
  /** 图标组件（来自 lucide-react） */
  icon: LucideIcon;
  /** Tailwind 背景色类，用于图标容器背景 */
  iconBgClass?: string;
  /** Tailwind 文字色类，用于图标颜色 */
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
 * @returns 格式化后的字符串或占位符
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
 * AssetOverviewCard 组件
 *
 * @example
 * ```tsx
 * <AssetOverviewCard
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
export const AssetOverviewCard: React.FC<AssetOverviewCardProps> = ({
  title,
  value,
  detail,
  icon: Icon,
  iconBgClass = 'bg-blue-50',
  iconTextClass = 'text-blue-600',
  loading = false,
  dataTestId,
}) => {
  /** 渲染加载态骨架 */
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

  /** 判断是否为货币类数值 */
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

export default AssetOverviewCard;
