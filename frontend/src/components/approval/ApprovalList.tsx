/**
 * ApprovalList — 审批工作台列表组件
 *
 * 根据当前登录用户角色展示待审批工单列表，实现角色级数据隔离：
 *   - 部门主管（approvalLevel === 1）：仅可见 APPROVING_LEVEL_1 状态工单
 *   - 资产管理员（approvalLevel === 2）：仅可见 APPROVING_LEVEL_2 状态工单
 *
 * 功能特性：
 *   - 角色感知的列表过滤（后端接口已做数据隔离，前端仅展示）
 *   - 点击行导航至审批详情页 /approvals/:orderId
 *   - 加载中 / 错误 / 空数据 三态展示
 *   - 可配置的定时轮询刷新（默认 30 s）
 *   - 手动刷新按钮
 *
 * @see ATB-4 前端待审批列表渲染测试
 * @see ATB-5 前端审批详情与操作测试
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import type { WorkOrder } from '../../types/workorder.types';
import { OrderStatus } from '../../types/workorder.types';
import { useApprovalStore } from '../../stores/approvalStore';
import { useApprovalPermission } from '../../composables/useApprovalPermission';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 轮询刷新间隔（毫秒），可通过 props 覆盖 */
const DEFAULT_POLL_INTERVAL_MS = 30_000;

/** 工单状态中文映射 */
const STATUS_LABEL_MAP: Record<string, string> = {
  [OrderStatus.PENDING]: '待提交',
  [OrderStatus.APPROVING_LEVEL_1]: '部门主管审批中',
  [OrderStatus.APPROVING_LEVEL_2]: '资产管理员审批中',
  [OrderStatus.APPROVED]: '已通过',
  [OrderStatus.REJECTED]: '已驳回',
  [OrderStatus.CANCELLED]: '已取消',
};

/** 工单状态对应样式（Tailwind badge 色系） */
const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  [OrderStatus.PENDING]: 'bg-gray-100 text-gray-700',
  [OrderStatus.APPROVING_LEVEL_1]: 'bg-blue-100 text-blue-700',
  [OrderStatus.APPROVING_LEVEL_2]: 'bg-indigo-100 text-indigo-700',
  [OrderStatus.APPROVED]: 'bg-green-100 text-green-700',
  [OrderStatus.REJECTED]: 'bg-red-100 text-red-700',
  [OrderStatus.CANCELLED]: 'bg-gray-100 text-gray-500 line-through',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ApprovalListProps {
  /** 自定义轮询间隔（毫秒），设为 0 或负数可禁用轮询 */
  pollInterval?: number;
  /** 自定义 CSS class */
  className?: string;
  /** 点击行时的自定义导航回调；若不传则默认使用 react-router 导航 */
  onRowClick?: (orderId: string) => void;
}

// ---------------------------------------------------------------------------
// Helper: 日期格式化
// ---------------------------------------------------------------------------

/**
 * 将 ISO 8601 日期字符串格式化为本地可读形式。
 * @param isoString - ISO 8601 格式日期
 * @returns 格式化后的日期字符串，如 "2025-01-15 14:30"
 */
function formatISODate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}`;
  } catch {
    return isoString;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** 状态徽章 */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const label = STATUS_LABEL_MAP[status] ?? status;
  const badgeClass = STATUS_BADGE_CLASS_MAP[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
      data-testid="status-badge"
    >
      {label}
    </span>
  );
};

/** 加载骨架屏 */
const LoadingSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-4" data-testid="loading-skeleton">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center space-x-4 rounded-lg border border-gray-200 p-4">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-4 w-40 rounded bg-gray-200" />
        <div className="ml-auto h-4 w-20 rounded bg-gray-200" />
      </div>
    ))}
  </div>
);

/** 空数据提示 */
const EmptyState: React.FC<{ approvalLevel: number | null }> = ({ approvalLevel }) => {
  const levelLabel = approvalLevel === 1 ? '部门主管' : approvalLevel === 2 ? '资产管理员' : '';
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400" data-testid="empty-state">
      <svg
        className="mb-4 h-16 w-16"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="text-lg font-medium">暂无待审批工单</p>
      {levelLabel && (
        <p className="mt-1 text-sm">
          当前角色：<span className="font-medium text-gray-600">{levelLabel}</span>
        </p>
      )}
    </div>
  );
};

/** 错误提示 */
const ErrorState: React.FC<{
  message: string;
  onRetry: () => void;
}> = ({ message, onRetry }) => (
  <div
    className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 py-12 text-red-600"
    data-testid="error-state"
  >
    <svg
      className="mb-3 h-12 w-12"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    </svg>
    <p className="mb-4 text-sm font-medium">加载失败：{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      data-testid="retry-button"
    >
      重试
    </button>
  </div>
);

/** 权限不足提示 */
const PermissionDeniedState: React.FC = () => (
  <div
    className="flex flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50 py-12 text-amber-700"
    data-testid="permission-denied-state"
  >
    <svg
      className="mb-3 h-12 w-12"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
      />
    </svg>
    <p className="text-sm font-medium">当前角色无审批权限</p>
    <p className="mt-1 text-xs text-amber-500">请联系管理员分配审批角色</p>
  </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * ApprovalList — 审批工作台列表
 *
 * 根据当前用户角色自动过滤并展示待审批工单。
 * 列表列包含：工单号、申请人、提交时间、状态。
 * 点击行可跳转至审批详情页。
 */
const ApprovalList: React.FC<ApprovalListProps> = ({
  pollInterval = DEFAULT_POLL_INTERVAL_MS,
  className = '',
  onRowClick,
}) => {
  const navigate = useNavigate();

  // ---- Store & Permission hooks ----
  const {
    approvalLevel,
    isLoading: permissionLoading,
    hasPermission,
  } = useApprovalPermission();

  const {
    pendingApprovals,
    isLoading: storeLoading,
    error: storeError,
    fetchPendingApprovals,
  } = useApprovalStore();

  // ---- Local state ----
  const [localError, setLocalError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Derived state ----
  const isLoading = permissionLoading || storeLoading;
  const displayError = localError ?? storeError ?? null;

  /**
   * 加载待审批列表数据。
   * 根据当前用户审批级别调用对应接口。
   */
  const loadData = useCallback(async () => {
    if (!approvalLevel) return;
    setLocalError(null);
    try {
      await fetchPendingApprovals({ level: approvalLevel });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '未知错误，请稍后重试';
      setLocalError(message);
    }
  }, [approvalLevel, fetchPendingApprovals]);

  // ---- Effects ----

  // 初始化加载 & 审批级别变更时重新加载
  useEffect(() => {
    if (approvalLevel) {
      void loadData();
    }
  }, [approvalLevel, loadData]);

  // 轮询刷新
  useEffect(() => {
    if (!approvalLevel || pollInterval <= 0) return;

    pollTimerRef.current = setInterval(() => {
      void loadData();
    }, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [approvalLevel, pollInterval, loadData]);

  // ---- Handlers ----

  /** 手动刷新 */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData]);

  /** 重试（错误恢复） */
  const handleRetry = useCallback(() => {
    void loadData();
  }, [loadData]);

  /** 行点击导航 */
  const handleRowClick = useCallback(
    (orderId: string) => {
      if (onRowClick) {
        onRowClick(orderId);
      } else {
        navigate(`/approvals/${orderId}`);
      }
    },
    [navigate, onRowClick],
  );

  // ---- Memoized list ----
  const approvalItems: WorkOrder[] = useMemo(
    () => (Array.isArray(pendingApprovals) ? pendingApprovals : []),
    [pendingApprovals],
  );

  // ---- Render ----

  // 权限不足
  if (!permissionLoading && !hasPermission) {
    return (
      <div className={`approval-list ${className}`}>
        <PermissionDeniedState />
      </div>
    );
  }

  // 加载中
  if (isLoading && approvalItems.length === 0) {
    return (
      <div className={`approval-list ${className}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">待审批工单</h2>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  // 错误状态
  if (displayError && approvalItems.length === 0) {
    return (
      <div className={`approval-list ${className}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">待审批工单</h2>
        </div>
        <ErrorState message={displayError} onRetry={handleRetry} />
      </div>
    );
  }

  // 空数据
  if (approvalItems.length === 0) {
    return (
      <div className={`approval-list ${className}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">待审批工单</h2>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            data-testid="refresh-button"
            aria-label="刷新列表"
          >
            <svg
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            刷新
          </button>
        </div>
        <EmptyState approvalLevel={approvalLevel} />
      </div>
    );
  }

  // 正常列表
  return (
    <div className={`approval-list ${className}`} data-testid="approval-list">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">待审批工单</h2>
          <span
            className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
            data-testid="pending-count"
          >
            {approvalItems.length} 条待处理
          </span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          data-testid="refresh-button"
          aria-label="刷新列表"
        >
          <svg
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          刷新
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200" data-testid="approval-table">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                工单号
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                申请人
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                提交时间
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                状态
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {approvalItems.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer transition-colors hover:bg-blue-50/50"
                onClick={() => handleRowClick(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick(item.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`查看工单 ${item.orderNo} 详情`}
                data-testid={`approval-row-${item.id}`}
              >
                {/* 工单号 */}
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="text-sm font-medium text-blue-600">
                    {item.orderNo}
                  </span>
                </td>

                {/* 申请人 */}
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                      {(item.applicantName ?? item.applicant ?? '—').charAt(0)}
                    </div>
                    <span className="text-sm text-gray-700">
                      {item.applicantName ?? item.applicant ?? '—'}
                    </span>
                  </div>
                </td>

                {/* 提交时间 */}
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {item.createdAt ? formatISODate(item.createdAt) : '—'}
                </td>

                {/* 状态 */}
                <td className="whitespace-nowrap px-6 py-4">
                  <StatusBadge status={item.status} />
                </td>

                {/* 操作 */}
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <span className="inline-flex items-center text-sm font-medium text-blue-600 transition hover:text-blue-800">
                    查看详情
                    <svg
                      className="ml-1 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 底部信息 */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>
          共 {approvalItems.length} 条记录
        </span>
        {pollInterval > 0 && (
          <span>
            自动刷新间隔：{pollInterval / 1000}s
          </span>
        )}
      </div>
    </div>
  );
};

export default ApprovalList;