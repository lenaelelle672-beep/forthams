/**
 * DashboardWarningList — 资产预警列表组件
 *
 * 展示即将到期的维保预警和待处理的报废申请预警。
 * 调用 maintenanceService.getUpcoming() 获取即将到期的维保记录，
 * 结合 disposalService.getHistory() 获取报废相关预警。
 *
 * @module components/dashboard/DashboardWarningList
 * @see frontend/src/app/services/maintenanceService.ts — getUpcoming
 * @see frontend/src/app/services/disposalService.ts — getHistory
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Wrench } from 'lucide-react';
import { maintenanceService } from '../../services/maintenanceService';
import { disposalService } from '../../services/disposalService';

/**
 * 预警项数据结构
 */
export interface WarningItem {
  /** 唯一标识 */
  id: string | number;
  /** 预警标题 */
  title: string;
  /** 预警描述 */
  description: string;
  /** 到期日期 ISO 字符串 */
  dueDate: string;
  /** 剩余天数（负数表示已过期） */
  remainingDays: number;
  /** 预警类型 */
  type: 'maintenance' | 'disposal';
  /** 紧急程度：urgent ≤ 7 天，warning ≤ 30 天，normal > 30 天 */
  urgency: 'urgent' | 'warning' | 'normal';
}

/**
 * DashboardWarningList 组件属性
 */
export interface DashboardWarningListProps {
  /** 外部注入数据（可选，不传则组件自行拉取） */
  items?: WarningItem[];
  /** 加载状态 */
  loading?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 最大显示条数，默认 10 */
  maxItems?: number;
  /** data-testid 用于 E2E 测试 */
  dataTestId?: string;
}

/** 紧急阈值（天） */
const URGENT_THRESHOLD = 7;

/** 警告阈值（天） */
const WARNING_THRESHOLD = 30;

/**
 * 计算剩余天数
 *
 * @param dueDate - ISO 格式的到期日期字符串
 * @returns 剩余天数（负数表示已过期）
 */
function calculateRemainingDays(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 判断紧急程度
 *
 * @param remainingDays - 剩余天数
 * @returns 紧急程度标签
 */
function getUrgency(remainingDays: number): WarningItem['urgency'] {
  if (remainingDays <= URGENT_THRESHOLD) return 'urgent';
  if (remainingDays <= WARNING_THRESHOLD) return 'warning';
  return 'normal';
}

/**
 * 将维保记录转换为预警项
 *
 * @param record - 后端维保记录
 * @returns 前端预警项
 */
function maintenanceToWarning(record: Record<string, unknown>): WarningItem {
  const dueDate = String(record.nextMaintenanceDate ?? record.expireDate ?? record.plannedDate ?? '');
  const remainingDays = dueDate ? calculateRemainingDays(dueDate) : 999;
  return {
    id: record.id ?? `maintenance-${Date.now()}`,
    title: String(record.assetName ?? record.name ?? '维保到期'),
    description: String(record.maintenanceType ?? record.description ?? '维保即将到期'),
    dueDate,
    remainingDays,
    type: 'maintenance',
    urgency: getUrgency(remainingDays),
  };
}

/**
 * 将报废记录转换为预警项
 *
 * @param record - 后端报废记录
 * @returns 前端预警项
 */
function disposalToWarning(record: Record<string, unknown>): WarningItem {
  const dueDate = String(record.createTime ?? record.applyDate ?? record.createdAt ?? '');
  const remainingDays = dueDate ? calculateRemainingDays(dueDate) : 0;
  return {
    id: record.id ?? `disposal-${Date.now()}`,
    title: String(record.assetName ?? record.name ?? '报废待审批'),
    description: String(record.status ?? record.reason ?? '报废申请待处理'),
    dueDate,
    remainingDays,
    type: 'disposal',
    urgency: dueDate ? getUrgency(remainingDays) : 'warning',
  };
}

/**
 * 获取紧急程度对应的样式类
 *
 * @param urgency - 紧急程度
 * @returns Tailwind 样式类名
 */
function getUrgencyClass(urgency: WarningItem['urgency']): string {
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
 * DashboardWarningList 组件
 *
 * 整合维保到期预警和报废申请预警，按紧急程度排序展示。
 *
 * @example
 * ```tsx
 * <DashboardWarningList />
 * <DashboardWarningList items={customItems} maxItems={5} />
 * ```
 */
export const DashboardWarningList: React.FC<DashboardWarningListProps> = ({
  items: externalItems,
  loading: externalLoading,
  className = '',
  maxItems = 10,
  dataTestId,
}) => {
  const [internalItems, setInternalItems] = useState<WarningItem[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (externalItems !== undefined) return;

    let mounted = true;

    async function fetchWarnings() {
      setInternalLoading(true);
      setError(null);

      try {
        const [maintenanceRecords, disposalRecords] = await Promise.all([
          maintenanceService.getUpcoming(30).catch(() => []),
          disposalService.getHistory({ status: 'PENDING' }).catch(() => []),
        ]);

        if (!mounted) return;

        const maintenanceWarnings = (maintenanceRecords as Record<string, unknown>[]).map(
          maintenanceToWarning,
        );
        const disposalWarnings = (disposalRecords as Record<string, unknown>[]).map(
          disposalToWarning,
        );

        const allWarnings = [...maintenanceWarnings, ...disposalWarnings]
          .sort((a, b) => a.remainingDays - b.remainingDays)
          .slice(0, maxItems);

        setInternalItems(allWarnings);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : '预警数据加载失败');
      } finally {
        if (mounted) setInternalLoading(false);
      }
    }

    void fetchWarnings();

    return () => {
      mounted = false;
    };
  }, [externalItems, maxItems]);

  const items = externalItems ?? internalItems;
  const loading = externalLoading ?? internalLoading;

  /** 紧急项计数 */
  const urgentCount = items.filter((item) => item.urgency === 'urgent').length;

  /** 渲染加载态 */
  if (loading) {
    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
        data-testid={dataTestId}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">预警事项</h3>
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

  /** 渲染错误态 */
  if (error) {
    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
        data-testid={dataTestId}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">预警事项</h3>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
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
        <h3 className="text-lg font-semibold text-gray-900">预警事项</h3>
        {urgentCount > 0 ? (
          <span className="px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
            {urgentCount}项紧急
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          暂无预警事项，所有资产状态正常。
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getUrgencyClass(item.urgency)}`}>
                {item.type === 'maintenance' ? (
                  <Wrench className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.title}
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
                  {item.description}
                </p>
                <div className="flex items-center mt-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>
                    {item.dueDate
                      ? new Date(item.dueDate).toLocaleDateString('zh-CN')
                      : '--'}
                  </span>
                  <span className="mx-2">·</span>
                  <span>
                    {item.type === 'maintenance' ? '维保到期' : '报废待处理'}
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

export default DashboardWarningList;
