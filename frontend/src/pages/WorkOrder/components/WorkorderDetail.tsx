/**
 * WorkorderDetail — 工单详情组件
 *
 * 功能范围 (SWARM-501, Phase 1):
 *   - 展示工单基本信息与当前状态
 *   - 审批人可对 PENDING_APPROVAL / APPROVING 状态的工单执行通过或驳回操作
 *   - 显示完整的审批历史记录（按时间正序排列）
 *
 * 边界约束:
 *   - 仅支持单级审批，驳回后进入 REJECTED 终态
 *   - 不处理多级审批链、委托、会签
 */

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

// ─── 类型定义 ────────────────────────────────────────────────────────────────

/** 工单生命周期状态枚举（与后端 WorkOrderStatus 对齐） */
export type WorkOrderStatus =
  | "PENDING_APPROVAL"
  | "APPROVING"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED";

/** 单条审批历史记录 */
export interface ApprovalHistoryItem {
  /** 记录唯一 ID */
  id: number;
  /** 操作类型：approve | reject | submit | assign */
  action: "approve" | "reject" | "submit" | "assign";
  /** 操作人姓名 */
  operatorName: string;
  /** 审批意见 */
  comment: string;
  /** 操作时间（ISO 8601） */
  createdAt: string;
}

/** 工单详情数据结构 */
export interface WorkOrderDetail {
  id: number;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  creatorName: string;
  currentApproverName: string | null;
  createdAt: string;
  updatedAt: string;
  approvalHistory: ApprovalHistoryItem[];
}

// ─── API 调用层 ───────────────────────────────────────────────────────────────

const BASE = "/api/v1/workorders";

/**
 * 获取工单详情（含审批历史）。
 * @param id - 工单 ID
 */
async function fetchWorkOrderDetail(id: number): Promise<WorkOrderDetail> {
  const [detailRes, historyRes] = await Promise.all([
    fetch(`${BASE}/${id}`),
    fetch(`${BASE}/${id}/history`),
  ]);

  if (!detailRes.ok) {
    throw new Error(`获取工单详情失败 (${detailRes.status})`);
  }
  if (!historyRes.ok) {
    throw new Error(`获取审批历史失败 (${historyRes.status})`);
  }

  const detail = await detailRes.json();
  const { history } = await historyRes.json();

  return { ...detail, approvalHistory: history ?? [] };
}

/**
 * 对工单执行审批通过操作。
 * @param id      - 工单 ID
 * @param comment - 审批意见（可为空）
 */
async function approveWorkOrder(
  id: number,
  comment: string
): Promise<WorkOrderDetail> {
  const res = await fetch(`${BASE}/${id}/approve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `审批通过失败 (${res.status})`);
  }
  return res.json();
}

/**
 * 对工单执行审批驳回操作。
 * @param id      - 工单 ID
 * @param comment - 驳回原因（可为空）
 */
async function rejectWorkOrder(
  id: number,
  comment: string
): Promise<WorkOrderDetail> {
  const res = await fetch(`${BASE}/${id}/reject`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `审批驳回失败 (${res.status})`);
  }
  return res.json();
}

// ─── 子组件：状态徽章 ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<WorkOrderStatus, string> = {
  PENDING_APPROVAL: "待审批",
  APPROVING: "审批中",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  ARCHIVED: "已归档",
};

const STATUS_COLOR: Record<WorkOrderStatus, string> = {
  PENDING_APPROVAL: "#d97706", // amber-600
  APPROVING: "#2563eb",        // blue-600
  APPROVED: "#16a34a",         // green-600
  REJECTED: "#dc2626",         // red-600
  ARCHIVED: "#6b7280",         // gray-500
};

/**
 * StatusBadge — 工单状态徽章。
 */
const StatusBadge: React.FC<{ status: WorkOrderStatus }> = ({ status }) => (
  <span
    data-testid="status-badge"
    style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      color: "#fff",
      backgroundColor: STATUS_COLOR[status] ?? "#6b7280",
    }}
  >
    {STATUS_LABEL[status] ?? status}
  </span>
);

// ─── 子组件：审批操作区 ───────────────────────────────────────────────────────

interface ApprovalActionsProps {
  /** 是否正在提交审批请求 */
  loading: boolean;
  /** 点击"审批通过"回调 */
  onApprove: (comment: string) => void;
  /** 点击"审批驳回"回调 */
  onReject: (comment: string) => void;
}

/**
 * ApprovalActions — 审批操作按钮区（仅在可审批状态下渲染）。
 */
const ApprovalActions: React.FC<ApprovalActionsProps> = ({
  loading,
  onApprove,
  onReject,
}) => {
  const [comment, setComment] = useState("");

  return (
    <section
      data-testid="approval-actions"
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
        marginTop: 16,
        background: "#f9fafb",
      }}
    >
      <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600 }}>
        审批操作
      </h3>

      <div style={{ marginBottom: 12 }}>
        <label
          htmlFor="comment-input"
          style={{ display: "block", fontSize: 13, marginBottom: 4, color: "#374151" }}
        >
          审批意见
        </label>
        <textarea
          id="comment-input"
          data-testid="comment-input"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="请输入审批意见（选填）"
          disabled={loading}
          style={{
            width: "100%",
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontSize: 14,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          data-testid="approve-btn"
          disabled={loading}
          onClick={() => onApprove(comment)}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 6,
            border: "none",
            background: loading ? "#86efac" : "#16a34a",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "处理中…" : "✓ 审批通过"}
        </button>

        <button
          data-testid="reject-btn"
          disabled={loading}
          onClick={() => onReject(comment)}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 6,
            border: "none",
            background: loading ? "#fca5a5" : "#dc2626",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "处理中…" : "✗ 驳回"}
        </button>
      </div>
    </section>
  );
};

// ─── 子组件：审批历史列表 ─────────────────────────────────────────────────────

const ACTION_LABEL: Record<ApprovalHistoryItem["action"], string> = {
  submit: "提交审批",
  assign: "分配审批人",
  approve: "审批通过",
  reject: "审批驳回",
};

const ACTION_COLOR: Record<ApprovalHistoryItem["action"], string> = {
  submit: "#2563eb",
  assign: "#7c3aed",
  approve: "#16a34a",
  reject: "#dc2626",
};

/**
 * 格式化 ISO 时间字符串为本地可读格式。
 * @param iso - ISO 8601 时间字符串
 */
function formatDatetime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface HistoryListProps {
  items: ApprovalHistoryItem[];
}

/**
 * HistoryList — 审批历史记录列表（按时间正序排列）。
 */
const HistoryList: React.FC<HistoryListProps> = ({ items }) => {
  if (items.length === 0) {
    return (
      <p
        data-testid="history-empty"
        style={{ color: "#9ca3af", fontSize: 13, margin: "8px 0" }}
      >
        暂无审批记录
      </p>
    );
  }

  const sorted = [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <ul
      data-testid="history-list"
      style={{ listStyle: "none", margin: 0, padding: 0 }}
    >
      {sorted.map((item) => (
        <li
          key={item.id}
          data-testid="history-item"
          style={{
            display: "flex",
            gap: 12,
            padding: "10px 0",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          {/* 时间线圆点 */}
          <div
            style={{
              flexShrink: 0,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: ACTION_COLOR[item.action] ?? "#6b7280",
              marginTop: 4,
            }}
          />

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: ACTION_COLOR[item.action] ?? "#374151",
                }}
              >
                {ACTION_LABEL[item.action] ?? item.action}
              </span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {item.operatorName}
              </span>
              <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>
                {formatDatetime(item.createdAt)}
              </span>
            </div>

            {item.comment && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "#4b5563",
                  background: "#f9fafb",
                  borderRadius: 4,
                  padding: "4px 8px",
                }}
              >
                {item.comment}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

// ─── 主组件 ───────────────────────────────────────────────────────────────────

/** 允许执行审批操作的状态集合 */
const APPROVABLE_STATUSES: Set<WorkOrderStatus> = new Set([
  "PENDING_APPROVAL",
  "APPROVING",
]);

/**
 * WorkorderDetail — 工单详情页主组件。
 *
 * 路由参数：`:id` 为工单 ID（数字字符串）。
 *
 * 渲染逻辑：
 *   1. 加载时展示 Loading 状态
 *   2. 加载失败展示错误信息与重试按钮
 *   3. 成功后展示工单信息、审批操作区（状态允许时）、审批历史
 *   4. 审批成功/驳回后刷新工单数据，展示成功 Toast
 */
const WorkorderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const workorderId = Number(id);

  const [detail, setDetail] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  /** 展示 Toast 并在 3 秒后自动消失 */
  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  /** 加载工单详情 */
  const loadDetail = useCallback(async () => {
    if (!workorderId || isNaN(workorderId)) {
      setError("无效的工单 ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkOrderDetail(workorderId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载工单详情失败");
    } finally {
      setLoading(false);
    }
  }, [workorderId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  /** 处理审批通过 */
  const handleApprove = useCallback(
    async (comment: string) => {
      if (!detail) return;
      setActionLoading(true);
      try {
        const updated = await approveWorkOrder(detail.id, comment);
        // 合并最新历史记录
        const historyRes = await fetch(`${BASE}/${detail.id}/history`);
        const { history } = historyRes.ok ? await historyRes.json() : { history: [] };
        setDetail({ ...updated, approvalHistory: history ?? [] });
        showToast("审批成功", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "审批操作失败，请重试",
          "error"
        );
      } finally {
        setActionLoading(false);
      }
    },
    [detail, showToast]
  );

  /** 处理审批驳回 */
  const handleReject = useCallback(
    async (comment: string) => {
      if (!detail) return;
      setActionLoading(true);
      try {
        const updated = await rejectWorkOrder(detail.id, comment);
        const historyRes = await fetch(`${BASE}/${detail.id}/history`);
        const { history } = historyRes.ok ? await historyRes.json() : { history: [] };
        setDetail({ ...updated, approvalHistory: history ?? [] });
        showToast("已驳回工单", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "驳回操作失败，请重试",
          "error"
        );
      } finally {
        setActionLoading(false);
      }
    },
    [detail, showToast]
  );

  // ── 渲染：加载中 ──
  if (loading) {
    return (
      <div
        data-testid="loading-state"
        style={{ padding: 32, textAlign: "center", color: "#6b7280" }}
      >
        加载中…
      </div>
    );
  }

  // ── 渲染：加载失败 ──
  if (error || !detail) {
    return (
      <div
        data-testid="error-state"
        style={{ padding: 32, textAlign: "center", color: "#dc2626" }}
      >
        <p>{error ?? "未找到工单数据"}</p>
        <button
          data-testid="retry-btn"
          onClick={loadDetail}
          style={{
            marginTop: 12,
            padding: "6px 18px",
            borderRadius: 6,
            border: "1px solid #dc2626",
            background: "#fff",
            color: "#dc2626",
            cursor: "pointer",
          }}
        >
          重试
        </button>
      </div>
    );
  }

  const canApprove = APPROVABLE_STATUSES.has(detail.status);

  // ── 渲染：主体 ──
  return (
    <div
      data-testid="workorder-detail"
      style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}
    >
      {/* Toast 通知 */}
      {toast && (
        <div
          data-testid={toast.type === "success" ? "success-toast" : "error-toast"}
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            padding: "10px 20px",
            borderRadius: 8,
            background: toast.type === "success" ? "#16a34a" : "#dc2626",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* ── 工单基本信息 ── */}
      <section
        data-testid="workorder-info"
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 20,
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <h2
            data-testid="workorder-title"
            style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}
          >
            {detail.title}
          </h2>
          <StatusBadge status={detail.status} />
        </div>

        {detail.description && (
          <p
            data-testid="workorder-description"
            style={{
              margin: "0 0 12px",
              fontSize: 14,
              color: "#4b5563",
              lineHeight: 1.6,
            }}
          >
            {detail.description}
          </p>
        )}

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px 12px",
            margin: 0,
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          <div>
            <dt style={{ display: "inline", fontWeight: 600 }}>工单 ID：</dt>
            <dd style={{ display: "inline", margin: 0 }}>#{detail.id}</dd>
          </div>
          <div>
            <dt style={{ display: "inline", fontWeight: 600 }}>创建人：</dt>
            <dd data-testid="creator-name" style={{ display: "inline", margin: 0 }}>
              {detail.creatorName}
            </dd>
          </div>
          <div>
            <dt style={{ display: "inline", fontWeight: 600 }}>创建时间：</dt>
            <dd style={{ display: "inline", margin: 0 }}>
              {formatDatetime(detail.createdAt)}
            </dd>
          </div>
          {detail.currentApproverName && (
            <div>
              <dt style={{ display: "inline", fontWeight: 600 }}>当前审批人：</dt>
              <dd
                data-testid="current-approver"
                style={{ display: "inline", margin: 0 }}
              >
                {detail.currentApproverName}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* ── 审批操作区（仅在可审批状态下展示） ── */}
      {canApprove && (
        <ApprovalActions
          loading={actionLoading}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* ── 审批历史记录 ── */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 20,
          marginTop: 16,
          background: "#fff",
        }}
      >
        <h3
          style={{
            margin: "0 0 12px",
            fontSize: 15,
            fontWeight: 600,
            color: "#111827",
          }}
        >
          审批历史
          {detail.approvalHistory.length > 0 && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 12,
                fontWeight: 400,
                color: "#6b7280",
              }}
            >
              ({detail.approvalHistory.length} 条记录)
            </span>
          )}
        </h3>

        <HistoryList items={detail.approvalHistory} />
      </section>
    </div>
  );
};

export default WorkorderDetail;