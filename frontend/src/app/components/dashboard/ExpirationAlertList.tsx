/**
 * ExpirationAlertList — 合同到期预警列表组件
 *
 * 展示即将到期的合同和维保预警，按紧急程度排序。
 * 支持外部注入数据或内部自行获取。
 *
 * @module components/dashboard/ExpirationAlertList
 * @see frontend/src/app/hooks/useDashboardData.ts — ExpirationAlert
 */

import React from 'react';
import { AlertTriangle, Clock, FileWarning } from 'lucide-react';
import type { ExpirationAlert } from '../../hooks/useDashboardData';

/**
 * ExpirationAlertList 组件属性
 */
export interface ExpirationAlertListProps {
  /** 外部注入数据 */
  items?: ExpirationAlert[];
  /** 加载状态 */
  loading?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 最大显示条数，默认 10 */
  maxItems?: number;
  /** data-testid 用于 E2E 测试 */
  dataTestId?: string;
}

/**
 * 获取紧急程度对应的样式类
 *
 * @param urgency - 紧急程度
 * @returns Tailwind 样式类名
 */
function getUrgencyClass(urgency: ExpirationAlert['urgency']): string {
  switch (urgency) {
    case 'urgent':
      return 'text-red-600 bg-red-50';
    case 'warning':
      return 'text-amber-600 bg-amber-50';
    case 'normal':
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * 获取剩余天数的显示文本
 *
 * @param remainingDays - 剩余天数
 * @returns 用户友好的文本描述
 */
function getRemainingDaysText(remainingDays: number): string {
  if (remainingDays < 0) return `已过期 ${Math.abs(remainingDays)} 天`;
  if (remainingDays === 0) return '今天到期';
  return `剩余 ${remainingDays} 天`;
}

/**
 * ExpirationAlertList 组件
 *
 * 展示合同到期和维保到期预警列表，按紧急程度排序。
 *
 * @example
 * ```tsx
 * <ExpirationAlertList items={alerts} />
 * <ExpirationAlertList loading={true} />
 * ```
 */
export const ExpirationAlertList: React.FC<ExpirationAlertListProps> = ({
  items = [],
  loading = false,
  className = '',
  maxItems = 10,
  dataTestId,
}) => {
  /** 紧急项计数 */
  const urgentCount = items.filter((item) => item.urgency === 'urgent').length;

  /** 按剩余天数截取展示数量 */
  const displayItems = items.slice(0, maxItems);

  /** 渲染加载态 */
  if (loading) {
    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
        data-testid={dataTestId}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">到期预警</h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse p-4 bg-gray-50 rounded-lg">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /** 渲染主内容 */
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
      data-testid={dataTestId}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">到期预警</h3>
        {urgentCount > 0 ? (
          <span className="px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
            {urgentCount}项紧急
          </span>
        ) : null}
      </div>

      {displayItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          暂无到期预警，所有合同和维保状态正常。
        </div>
      ) : (
        <div className="space-y-3">
          {displayItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getUrgencyClass(item.urgency)}`}>
                {item.type === 'maintenance' ? (
                  <FileWarning className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.assetName}
                  </p>
                  <span
                    className={`flex-shrink-0 ml-2 text-xs font-medium px-2 py-0.5 rounded ${
                      item.urgency === 'urgent'
                        ? 'bg-red-100 text-red-700'
                        : item.urgency === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {getRemainingDaysText(item.remainingDays)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1 truncate">
                  {item.type === 'contract' ? '合同到期' : '维保到期'}
                </p>
                <div className="flex items-center mt-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>
                    {item.expirationDate
                      ? new Date(item.expirationDate).toLocaleDateString('zh-CN')
                      : '--'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpirationAlertList;
