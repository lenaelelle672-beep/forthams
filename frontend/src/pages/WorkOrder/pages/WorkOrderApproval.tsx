/**
 * WorkOrderApproval.tsx
 *
 * 工单审批页面组件 —— SWARM-001 实施目标 Phase 3.2
 *
 * 职责：
 *  - 展示待审批工单的详细信息及审批历史链
 *  - 提供审批意见输入框和通过 / 拒绝操作入口
 *  - 调用后端审批 API，并将状态机流转结果同步至本地 Store
 *  - 状态变更后通过通知机制告知相关人员（由后端 NotificationService 驱动）
 *
 * @module WorkOrderApproval
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

/**
 * 工单审批状态枚举，与后端 WorkOrderState 保持一致。
 */
export type WorkOrderStatus =
  | 'PENDING'
  | 'APPROVING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

/**
 * 单条审批历史记录。
 */
export interface ApprovalRecord {
  /** 记录唯一标识 */
  id: string;
  /** 审批人 ID */
  approverId: string;
  /** 审批人显示名称 */
  approverName: string;
  /** 审批动作：通过 / 拒绝 / 退回 */
  action: 'APPROVED' | 'REJECTED' | 'RETURNED';
  /** 审批意见（可选） */
  comment?: string;
  /** 审批时间 ISO 8601 */
  timestamp: string;
}

/**
 * 工单详情数据结构。
 */
export interface WorkOrderDetail {
  /** 工单唯一标识 */
  id: string;
  /** 工单标题（最大 200 字符） */
  title: string;
  /** 工单描述（最大 5000 字符） */
  description: string;
  /** 当前状态 */
  status: WorkOrderStatus;
  /** 申请人 ID */
  creatorId: string;
  /** 申请人显示名称 */
  creatorName: string;
  /** 创建时间 ISO 8601 */
  createdAt: string;
  /** 最后更新时间 ISO 8601 */
  updatedAt: string;
  /** 审批历史记录列表 */
  approvalHistory: ApprovalRecord[];
}

/**
 * 审批操作请求体。
 */
export interface ApprovalActionPayload {
  /** 审批意见（最大 1000 字符） */
  comment?: string;
}

// ─── 工具函数 ───────────────────────────────────────────────────────────────

/**
 * 将后端状态码映射为中文标签。
 *
 * @param status - 工单状态
 * @returns 对应的中文展示文本
 */
function getStatusLabel(status: WorkOrderStatus): string {
  const labelMap: Record<WorkOrderStatus, string> = {
    PENDING: '待提交',
    APPROVING: '审批中',
    APPROVED: '已通过',
    REJECTED: '已拒绝',
    CANCELLED: '已取消',
  };
  return labelMap[status] ?? status;
}

/**
 * 根据工单状态返回对应的 Tailwind CSS 色彩类。
 *
 * @param status - 工单状态
 * @returns Tailwind CSS 类名字符串
 */
function getStatusColorClass(status: WorkOrderStatus): string {
  const colorMap: Record<WorkOrderStatus, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVING: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-500',
  };
  return colorMap[status] ?? 'bg-gray-100 text-gray-600';
}

// ─── API 调用层（轻量封装，供本页使用） ─────────────────────────────────────

const API_BASE = '/api/work-orders';

/**
 * 获取单条工单详情（含审批历史）。
 *
 * @param id - 工单 ID
 * @returns WorkOrderDetail 数据
 * @throws Error 当请求失败时抛出包含 HTTP 状态码的错误
 */
async function fetchWorkOrderDetail(id: string): Promise<WorkOrderDetail> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`获取工单详情失败：HTTP ${res.status}`);
  }
  return res.json() as Promise<WorkOrderDetail>;
}

/**
 * 对指定工单执行审批通过操作。
 *
 * @param id      - 工单 ID
 * @param payload - 审批意见
 * @returns 更新后的工单状态
 * @throws Error 当状态已流转（409）或权限不足（403）时抛出
 */
async function approveWorkOrder(
  id: string,
  payload: ApprovalActionPayload,
): Promise<WorkOrderDetail> {
  const res = await fetch(`${API_BASE}/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (res.status === 409) {
    throw new Error('工单状态已变更，请刷新后重试');
  }
  if (res.status === 403) {
    throw new Error('无权执行此审批操作');
  }
  if (!res.ok) {
    throw new Error(`审批通过操作失败：HTTP ${res.status}`);
  }
  return res.json() as Promise<WorkOrderDetail>;
}

/**
 * 对指定工单执行审批拒绝操作。
 *
 * @param id      - 工单 ID
 * @param payload - 审批意见（拒绝时建议必填）
 * @returns 更新后的工单状态
 * @throws Error 当状态已流转（409）或权限不足（403）时抛出
 */
async function rejectWorkOrder(
  id: string,
  payload: ApprovalActionPayload,
): Promise<WorkOrderDetail> {
  const res = await fetch(`${API_BASE}/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (res.status === 409) {
    throw new Error('工单状态已变更，请刷新后重试');
  }
  if (res.status === 403) {
    throw new Error('无权执行此审批操作');
  }
  if (!res.ok) {
    throw new Error(`审批拒绝操作失败：HTTP ${res.status}`);
  }
  return res.json() as Promise<WorkOrderDetail>;
}

// ─── 子组件 ─────────────────────────────────────────────────────────────────

/**
 * StatusBadge —— 工单状态徽章组件。
 *
 * @param props.status - 工单当前状态
 */
const StatusBadge: React.FC<{ status: WorkOrderStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full px-3 py-0.5 text-sm font-medium ${getStatusColorClass(status)}`}
    data-testid="work-order-status-badge"
  >
    {getStatusLabel(status)}
  </span>
);

/**
 * WorkOrderInfoCard —— 工单基础信息卡片。
 *
 * @param props.detail - 工单详情数据
 */
const WorkOrderInfoCard: React.FC<{ detail: WorkOrderDetail }> = ({
  detail,
}) => (
  <div
    className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    data-testid="work-order-info-card"
  >
    <div className="mb-4 flex items-start justify-between">
      <h2 className="text-xl font-semibold text-gray-900">{detail.title}</h2>
      <StatusBadge status={detail.status} />
    </div>

    <p className="mb-4 whitespace-pre-wrap text-sm text-gray-700">
      {detail.description}
    </p>

    <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
      <div>
        <dt className="font-medium text-gray-500">申请人</dt>
        <dd className="mt-0.5 text-gray-800">{detail.creatorName}</dd>
      </div>
      <div>
        <dt className="font-medium text-gray-500">工单编号</dt>
        <dd className="mt-0.5 font-mono text-gray-800">{detail.id}</dd>
      </div>
      <div>
        <dt className="font-medium text-gray-500">提交时间</dt>
        <dd className="mt-0.5 text-gray-800">
          {new Date(detail.createdAt).toLocaleString('zh-CN')}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-gray-500">最后更新</dt>
        <dd className="mt-0.5 text-gray-800">
          {new Date(detail.updatedAt).toLocaleString('zh-CN')}
        </dd>
      </div>
    </dl>
  </div>
);

/**
 * ApprovalHistoryTimeline —— 审批历史时间轴组件。
 *
 * @param props.records - 审批历史记录列表
 */
const ApprovalHistoryTimeline: React.FC<{ records: ApprovalRecord[] }> = ({
  records,
}) => {
  if (records.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400" data-testid="approval-history-empty">
        暂无审批记录
      </p>
    );
  }

  return (
    <ol className="relative border-l border-gray-200" data-testid="approval-history-timeline">
      {records.map((record) => (
        <li key={record.id} className="mb-6 ml-4">
          <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-blue-500" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">
              {record.approverName}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                record.action === 'APPROVED'
                  ? 'bg-green-100 text-green-700'
                  : record.action === 'REJECTED'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {record.action === 'APPROVED'
                ? '通过'
                : record.action === 'REJECTED'
                  ? '拒绝'
                  : '退回'}
            </span>
            <time className="ml-auto text-xs text-gray-400">
              {new Date(record.timestamp).toLocaleString('zh-CN')}
            </time>
          </div>
          {record.comment && (
            <p className="mt-1 text-sm text-gray-600">{record.comment}</p>
          )}
        </li>
      ))}
    </ol>
  );
};

/**
 * ApprovalActionPanel —— 审批操作面板。
 *
 * 仅在工单状态为 APPROVING 时渲染操作按钮。
 *
 * @param props.workOrderId  - 当前工单 ID
 * @param props.onApproved   - 审批通过后回调
 * @param props.onRejected   - 审批拒绝后回调
 */
const ApprovalActionPanel: React.FC<{
  workOrderId: string;
  onApproved: (updated: WorkOrderDetail) => void;
  onRejected: (updated: WorkOrderDetail) => void;
}> = ({ workOrderId, onApproved, onRejected }) => {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 处理审批通过点击事件。
   * 发起 POST /api/work-orders/{id}/approve 请求，并在成功后回调父组件。
   */
  const handleApprove = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await approveWorkOrder(workOrderId, { comment });
      onApproved(updated);
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '审批通过失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [workOrderId, comment, onApproved]);

  /**
   * 处理审批拒绝点击事件。
   * 发起 POST /api/work-orders/{id}/reject 请求，并在成功后回调父组件。
   */
  const handleReject = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await rejectWorkOrder(workOrderId, { comment });
      onRejected(updated);
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '审批拒绝失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [workOrderId, comment, onRejected]);

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      data-testid="approval-action-panel"
    >
      <h3 className="mb-4 text-base font-semibold text-gray-900">审批操作</h3>

      {/* 审批意见输入 */}
      <div className="mb-4">
        <label
          htmlFor="approval-comment"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          审批意见
          <span className="ml-1 text-xs text-gray-400">（最多 1000 字符，可选）</span>
        </label>
        <textarea
          id="approval-comment"
          data-testid="approval-comment-input"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={4}
          maxLength={1000}
          placeholder="请输入审批意见..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={submitting}
        />
        <p className="mt-1 text-right text-xs text-gray-400">
          {comment.length} / 1000
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
          data-testid="approval-error-message"
        >
          {error}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          type="button"
          data-testid="btn-approve"
          disabled={submitting}
          onClick={handleApprove}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? '处理中…' : '✓ 审批通过'}
        </button>
        <button
          type="button"
          data-testid="btn-reject"
          disabled={submitting}
          onClick={handleReject}
          className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? '处理中…' : '✗ 审批拒绝'}
        </button>
      </div>
    </div>
  );
};

/**
 * ApprovalResultBanner —— 审批结果横幅。
 *
 * 当工单已终态（APPROVED / REJECTED）时展示结果告知条。
 *
 * @param props.status - 终态工单状态
 */
const ApprovalResultBanner: React.FC<{ status: WorkOrderStatus }> = ({
  status,
}) => {
  if (status !== 'APPROVED' && status !== 'REJECTED') return null;

  const isApproved = status === 'APPROVED';
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${
        isApproved
          ? 'bg-green-50 text-green-800'
          : 'bg-red-50 text-red-800'
      }`}
      role="status"
      data-testid="approval-result-banner"
    >
      <span className="text-lg">{isApproved ? '✅' : '❌'}</span>
      <span>
        {isApproved
          ? '该工单已审批通过，流程已完成。'
          : '该工单已被拒绝，流程已终止。'}
      </span>
    </div>
  );
};

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

/**
 * WorkOrderApproval —— 工单审批页面。
 *
 * 路由参数：`:id` — 工单 ID
 *
 * 渲染内容：
 *  1. 工单基础信息卡片
 *  2. 若工单处于 APPROVING 状态，显示审批操作面板
 *  3. 若工单已终态，显示结果横幅
 *  4. 审批历史时间轴
 *
 * 数据流：
 *  - Mount 时调用 GET /api/work-orders/{id} 获取详情
 *  - 审批操作后更新本地 state，无需整页刷新
 *
 * @returns JSX.Element
 */
const WorkOrderApproval: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * 加载工单详情，在组件挂载及 ID 变更时触发。
   */
  useEffect(() => {
    if (!id) {
      setFetchError('工单 ID 不存在，请返回列表重新选择。');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadDetail = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await fetchWorkOrderDetail(id);
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) {
          setFetchError(
            err instanceof Error ? err.message : '加载工单详情失败，请稍后重试',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /**
   * 审批通过成功回调 —— 更新本地工单状态并展示成功提示。
   *
   * @param updated - 后端返回的最新工单数据
   */
  const handleApproved = useCallback((updated: WorkOrderDetail) => {
    setDetail(updated);
    setSuccessMessage('审批通过成功！相关人员已收到通知。');
    setTimeout(() => setSuccessMessage(null), 4000);
  }, []);

  /**
   * 审批拒绝成功回调 —— 更新本地工单状态并展示提示。
   *
   * @param updated - 后端返回的最新工单数据
   */
  const handleRejected = useCallback((updated: WorkOrderDetail) => {
    setDetail(updated);
    setSuccessMessage('审批拒绝操作已完成，申请人已收到通知。');
    setTimeout(() => setSuccessMessage(null), 4000);
  }, []);

  // ── 加载态 ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex min-h-[400px] items-center justify-center"
        data-testid="work-order-approval-loading"
      >
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-sm">加载工单详情中…</span>
        </div>
      </div>
    );
  }

  // ── 加载错误态 ────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div
        className="mx-auto max-w-lg p-8 text-center"
        data-testid="work-order-approval-error"
      >
        <p className="mb-4 text-sm text-red-600">{fetchError}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          返回上一页
        </button>
      </div>
    );
  }

  // ── 数据为空态（防御性渲染） ──────────────────────────────────────────────
  if (!detail) return null;

  // ── 正常渲染态 ────────────────────────────────────────────────────────────
  return (
    <div
      className="mx-auto max-w-3xl px-4 py-8"
      data-testid="work-order-approval-page"
    >
      {/* 页头 */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          aria-label="返回"
          onClick={() => navigate(-1)}
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-900">工单审批</h1>
      </div>

      {/* 成功提示 Toast */}
      {successMessage && (
        <div
          className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800"
          role="status"
          data-testid="approval-success-toast"
        >
          <span>✅</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* 终态结果横幅 */}
      {(detail.status === 'APPROVED' || detail.status === 'REJECTED') && (
        <div className="mb-4">
          <ApprovalResultBanner status={detail.status} />
        </div>
      )}

      <div className="grid gap-6">
        {/* 工单基础信息 */}
        <WorkOrderInfoCard detail={detail} />

        {/* 审批操作面板：仅 APPROVING 状态可见 */}
        {detail.status === 'APPROVING' && (
          <ApprovalActionPanel
            workOrderId={detail.id}
            onApproved={handleApproved}
            onRejected={handleRejected}
          />
        )}

        {/* 审批历史时间轴 */}
        <section
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          aria-label="审批历史"
          data-testid="approval-history-section"
        >
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            审批历史
          </h3>
          <ApprovalHistoryTimeline records={detail.approvalHistory} />
        </section>
      </div>
    </div>
  );
};

export default WorkOrderApproval;