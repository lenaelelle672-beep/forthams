/**
 * HistoryList.tsx
 *
 * 审批历史记录列表组件，用于展示工单的完整审批操作轨迹。
 * 每条记录显示操作时间、操作类型、操作人和审批意见。
 *
 * @module WorkOrder/components/HistoryList
 */

import React from "react";

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 单条审批历史记录的数据结构，与后端 ApprovalRecord 模型对应 */
export interface ApprovalHistoryRecord {
  /** 记录唯一标识 */
  id: number;
  /** 所属工单 ID */
  workOrderId: number;
  /** 操作类型：通过 / 驳回 / 分配 */
  action: "approve" | "reject" | "assign";
  /** 操作人姓名（展示用） */
  operatorName: string;
  /** 操作人 ID */
  operatorId: number;
  /** 审批意见（可选） */
  comment?: string;
  /** 操作时间戳（ISO 8601） */
  createdAt: string;
}

/** HistoryList 组件 Props */
export interface HistoryListProps {
  /** 历史记录数组，应按时间正序排列 */
  records: ApprovalHistoryRecord[];
  /** 数据加载中标志 */
  loading?: boolean;
  /** 加载错误信息 */
  error?: string | null;
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 将操作类型（action）映射为可读的中文标签和对应的样式色调。
 *
 * @param action - 审批动作标识符
 * @returns 包含 label（文字）与 colorClass（Tailwind 色彩类）的对象
 */
function resolveActionMeta(action: ApprovalHistoryRecord["action"]): {
  label: string;
  colorClass: string;
} {
  switch (action) {
    case "approve":
      return { label: "审批通过", colorClass: "text-green-600 bg-green-50" };
    case "reject":
      return { label: "审批驳回", colorClass: "text-red-600 bg-red-50" };
    case "assign":
      return { label: "转派审批", colorClass: "text-blue-600 bg-blue-50" };
    default:
      return { label: "未知操作", colorClass: "text-gray-500 bg-gray-50" };
  }
}

/**
 * 将 ISO 8601 时间字符串格式化为本地可读格式。
 *
 * @param isoString - ISO 8601 格式的时间字符串
 * @returns 格式化后的本地时间字符串，解析失败时返回原始值
 */
function formatDateTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return isoString;
  }
}

// ---------------------------------------------------------------------------
// 子组件
// ---------------------------------------------------------------------------

/**
 * 单条历史记录条目组件。
 *
 * @param props.record - 审批历史记录数据
 */
function HistoryItem({ record }: { record: ApprovalHistoryRecord }) {
  const { label, colorClass } = resolveActionMeta(record.action);

  return (
    <li
      className="relative flex gap-x-4 py-4"
      data-testid="history-item"
      data-record-id={record.id}
      data-action={record.action}
    >
      {/* 时间轴竖线装饰 */}
      <div className="absolute left-0 top-0 flex w-6 justify-center h-full">
        <div className="w-px bg-gray-200" />
      </div>

      {/* 时间轴圆点 */}
      <div className="relative flex h-6 w-6 flex-none items-center justify-center bg-white">
        <div
          className={`h-2 w-2 rounded-full ring-1 ring-offset-1 ${
            record.action === "approve"
              ? "bg-green-500 ring-green-500"
              : record.action === "reject"
              ? "bg-red-500 ring-red-500"
              : "bg-blue-400 ring-blue-400"
          }`}
        />
      </div>

      {/* 内容区域 */}
      <div className="flex-auto rounded-lg bg-white p-3 ring-1 ring-inset ring-gray-200 shadow-sm">
        {/* 顶部行：操作标签 + 时间 */}
        <div className="flex items-center justify-between gap-x-2">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colorClass}`}
          >
            {label}
          </span>
          <time
            dateTime={record.createdAt}
            className="flex-none text-xs text-gray-400"
          >
            {formatDateTime(record.createdAt)}
          </time>
        </div>

        {/* 操作人 */}
        <p className="mt-1 text-sm text-gray-700">
          <span className="font-medium text-gray-900">
            {record.operatorName}
          </span>
          <span className="ml-1 text-gray-500">（ID: {record.operatorId}）</span>
        </p>

        {/* 审批意见（可选） */}
        {record.comment && (
          <p className="mt-1.5 text-sm text-gray-600 italic border-l-2 border-gray-200 pl-2">
            "{record.comment}"
          </p>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// 加载骨架屏
// ---------------------------------------------------------------------------

/**
 * 历史记录加载状态的骨架屏占位组件。
 */
function HistoryListSkeleton() {
  return (
    <ul className="space-y-2" aria-busy="true" aria-label="正在加载审批历史">
      {Array.from({ length: 3 }).map((_, idx) => (
        <li key={idx} className="flex gap-x-4 py-4 animate-pulse">
          <div className="h-6 w-6 rounded-full bg-gray-200 flex-none" />
          <div className="flex-auto rounded-lg bg-gray-100 p-3 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

/**
 * HistoryList — 工单审批历史记录列表
 *
 * 展示工单从创建到当前状态的完整审批操作轨迹，支持加载态、空态和错误态。
 *
 * @param props.records - 历史记录数组（应由调用方保证按时间正序排列）
 * @param props.loading  - 是否处于数据加载中状态
 * @param props.error    - 若存在加载错误，传入错误描述文字
 *
 * @example
 * ```tsx
 * <HistoryList
 *   records={approvalHistory}
 *   loading={isLoading}
 *   error={fetchError}
 * />
 * ```
 */
const HistoryList: React.FC<HistoryListProps> = ({
  records,
  loading = false,
  error = null,
}) => {
  // ── 加载态 ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section
        className="mt-4"
        aria-label="审批历史"
        data-testid="history-list"
      >
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          审批历史
        </h3>
        <HistoryListSkeleton />
      </section>
    );
  }

  // ── 错误态 ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <section
        className="mt-4"
        aria-label="审批历史"
        data-testid="history-list"
      >
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          审批历史
        </h3>
        <div
          className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
          role="alert"
          data-testid="history-error"
        >
          <p className="font-medium">加载审批历史失败</p>
          <p className="mt-1 text-red-600">{error}</p>
        </div>
      </section>
    );
  }

  // ── 空态 ────────────────────────────────────────────────────────────────
  if (records.length === 0) {
    return (
      <section
        className="mt-4"
        aria-label="审批历史"
        data-testid="history-list"
      >
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          审批历史
        </h3>
        <div
          className="rounded-md border border-dashed border-gray-300 p-6 text-center"
          data-testid="history-empty"
        >
          <p className="text-sm text-gray-400">暂无审批记录</p>
        </div>
      </section>
    );
  }

  // ── 正常展示 ─────────────────────────────────────────────────────────────
  return (
    <section
      className="mt-4"
      aria-label="审批历史"
      data-testid="history-list"
    >
      <h3 className="text-base font-semibold text-gray-900 mb-3">
        审批历史
        <span className="ml-2 text-xs font-normal text-gray-400">
          共 {records.length} 条记录
        </span>
      </h3>

      <ul
        className="relative ml-3 space-y-0"
        aria-label="审批操作时间线"
      >
        {records.map((record) => (
          <HistoryItem key={record.id} record={record} />
        ))}
      </ul>
    </section>
  );
};

export default HistoryList;