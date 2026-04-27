/**
 * useApprovalData — 工单审批数据 Hook
 *
 * 职责：
 * 1. 根据当前用户角色拉取待审批工单列表（部门主管 → APPROVING_LEVEL_1，资产管理员 → APPROVING_LEVEL_2）
 * 2. 提供审批通过 / 驳回操作，驳回时强制校验 rejectionReason（非空、≤500 字符）
 * 3. 处理乐观锁冲突（HTTP 409）及非法状态流转（HTTP 409 INVALID_STATE_TRANSITION）
 * 4. 支持轮询模式刷新审批列表
 *
 * @module hooks/useApprovalData
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 工单审批状态枚举，与后端 OrderStatus 保持一致 */
export enum OrderApprovalStatus {
  PENDING = 'PENDING',
  APPROVING_LEVEL_1 = 'APPROVING_LEVEL_1',
  APPROVING_LEVEL_2 = 'APPROVING_LEVEL_2',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/** 审批动作 */
export type ApprovalAction = 'APPROVE' | 'REJECT';

/** 审批记录条目 */
export interface ApprovalRecord {
  id: number;
  orderId: number;
  operatorId: number;
  operatorName: string;
  action: ApprovalAction;
  comment: string;
  createdAt: string; // ISO 8601
}

/** 待审批工单摘要（列表项） */
export interface PendingWorkOrder {
  id: number;
  orderNo: string;
  applicantId: number;
  applicantName: string;
  submittedAt: string; // ISO 8601
  status: OrderApprovalStatus;
  title: string;
  description: string;
  version: number;
}

/** 审批操作请求体 */
export interface ApproveRequest {
  version: number;
}

export interface RejectRequest {
  version: number;
  rejectionReason: string;
}

/** API 通用响应包装 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 业务错误码 */
export const ApprovalErrorCode = {
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  OPTIMISTIC_LOCK_CONFLICT: 'OPTIMISTIC_LOCK_CONFLICT',
  REJECTION_REASON_REQUIRED: 'REJECTION_REASON_REQUIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;

export type ApprovalErrorCodeType =
  (typeof ApprovalErrorCode)[keyof typeof ApprovalErrorCode];

/** 审批操作结果 */
export interface ApprovalActionResult {
  success: boolean;
  errorCode?: ApprovalErrorCodeType;
  message: string;
}

/** 用户角色 */
export type ApprovalRole = 'DEPARTMENT_MANAGER' | 'ASSET_MANAGER';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 驳回原因最大长度，与后端约束一致 */
const MAX_REJECTION_REASON_LENGTH = 500;

/** 默认轮询间隔（毫秒） */
const DEFAULT_POLL_INTERVAL_MS = 15_000;

// ---------------------------------------------------------------------------
// API helpers (thin wrappers — 实际项目可替换为 api/approval.ts 中的实例)
// ---------------------------------------------------------------------------

/**
 * 根据角色获取对应的审批状态过滤值。
 * - 部门主管仅可见 APPROVING_LEVEL_1
 * - 资产管理员仅可见 APPROVING_LEVEL_2
 */
function getTargetStatusForRole(role: ApprovalRole): OrderApprovalStatus {
  switch (role) {
    case 'DEPARTMENT_MANAGER':
      return OrderApprovalStatus.APPROVING_LEVEL_1;
    case 'ASSET_MANAGER':
      return OrderApprovalStatus.APPROVING_LEVEL_2;
    default:
      throw new Error(`Unknown approval role: ${role}`);
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseApprovalDataOptions {
  /** 当前登录用户的审批角色 */
  role: ApprovalRole;
  /** 是否启用轮询，默认 false */
  polling?: boolean;
  /** 轮询间隔（毫秒），默认 15000 */
  pollIntervalMs?: number;
  /** 自定义 fetch 实现（便于测试注入） */
  fetchPendingList?: (
    status: OrderApprovalStatus,
  ) => Promise<ApiResponse<PendingWorkOrder[]>>;
  /** 自定义审批通过实现 */
  fetchApprove?: (
    orderId: number,
    body: ApproveRequest,
  ) => Promise<ApiResponse<unknown>>;
  /** 自定义驳回实现 */
  fetchReject?: (
    orderId: number,
    body: RejectRequest,
  ) => Promise<ApiResponse<unknown>>;
  /** 自定义审批记录查询实现 */
  fetchApprovalRecords?: (
    orderId: number,
  ) => Promise<ApiResponse<ApprovalRecord[]>>;
}

export interface UseApprovalDataReturn {
  /** 待审批工单列表 */
  pendingList: PendingWorkOrder[];
  /** 列表是否正在加载 */
  loading: boolean;
  /** 操作是否进行中（approve / reject） */
  actionLoading: boolean;
  /** 最近一次错误信息 */
  error: string | null;
  /** 审批记录（按工单 ID 缓存） */
  approvalRecordsMap: Record<number, ApprovalRecord[]>;
  /** 手动刷新列表 */
  refresh: () => Promise<void>;
  /** 审批通过 */
  approve: (orderId: number, version: number) => Promise<ApprovalActionResult>;
  /** 驳回（前端校验 rejectionReason） */
  reject: (
    orderId: number,
    version: number,
    rejectionReason: string,
  ) => Promise<ApprovalActionResult>;
  /** 校验驳回原因是否合法，返回错误提示或 null */
  validateRejectionReason: (
    reason: string,
  ) => string | null;
  /** 查询指定工单的审批记录 */
  loadApprovalRecords: (orderId: number) => Promise<ApprovalRecord[]>;
  /** 停止轮询 */
  stopPolling: () => void;
}

/**
 * 工单审批数据 Hook
 *
 * @param options - 配置项
 * @returns 审批数据与操作方法
 */
export function useApprovalData(
  options: UseApprovalDataOptions,
): UseApprovalDataReturn {
  const {
    role,
    polling = false,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    fetchPendingList,
    fetchApprove,
    fetchReject,
    fetchApprovalRecords,
  } = options;

  // ---- state ----
  const [pendingList, setPendingList] = useState<PendingWorkOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalRecordsMap, setApprovalRecordsMap] = useState<
    Record<number, ApprovalRecord[]>
  >({});

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef<boolean>(true);

  // ---- derived ----
  const targetStatus = getTargetStatusForRole(role);

  // ---- helpers ----

  /** 安全更新 state（组件卸载后不再更新） */
  const safeSetState = useCallback(
    <T>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
      if (mountedRef.current) {
        setter(value);
      }
    },
    [],
  );

  /** 从 HTTP 响应中提取业务错误码 */
  function extractErrorCode(err: unknown): ApprovalErrorCodeType | undefined {
    if (err && typeof err === 'object') {
      const anyErr = err as Record<string, unknown>;
      // 尝试从 response.data.code 提取
      const data = anyErr.response?.data as
        | Record<string, unknown>
        | undefined;
      if (data?.code && typeof data.code === 'string') {
        const code = data.code as string;
        if (
          Object.values(ApprovalErrorCode).includes(
            code as ApprovalErrorCodeType,
          )
        ) {
          return code as ApprovalErrorCodeType;
        }
      }
      // HTTP 409 可能是乐观锁冲突或非法状态流转
      if (anyErr.response?.status === 409) {
        return ApprovalErrorCode.OPTIMISTIC_LOCK_CONFLICT;
      }
      if (anyErr.response?.status === 400) {
        return ApprovalErrorCode.REJECTION_REASON_REQUIRED;
      }
      if (anyErr.response?.status === 403) {
        return ApprovalErrorCode.PERMISSION_DENIED;
      }
    }
    return undefined;
  }

  // ---- core: fetch pending list ----

  const refresh = useCallback(async () => {
    safeSetState(setLoading, true);
    safeSetState(setError, null);

    try {
      let response: ApiResponse<PendingWorkOrder[]>;

      if (fetchPendingList) {
        // 允许外部注入（测试 / mock）
        response = await fetchPendingList(targetStatus);
      } else {
        // 默认实现：调用 RESTful API
        const res = await fetch(
          `/api/orders?status=${targetStatus}`,
          {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          },
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        response = await res.json();
      }

      safeSetState(setPendingList, response.data ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '加载待审批列表失败';
      safeSetState(setError, message);
    } finally {
      safeSetState(setLoading, false);
    }
  }, [fetchPendingList, targetStatus, safeSetState]);

  // ---- core: approve ----

  const approve = useCallback(
    async (
      orderId: number,
      version: number,
    ): Promise<ApprovalActionResult> => {
      safeSetState(setActionLoading, true);
      safeSetState(setError, null);

      try {
        if (fetchApprove) {
          await fetchApprove(orderId, { version });
        } else {
          const res = await fetch(`/api/orders/${orderId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ version }),
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const errorCode = extractErrorCode({
              response: { status: res.status, data: errBody },
            });
            return {
              success: false,
              errorCode,
              message:
                (errBody as Record<string, unknown>)?.message?.toString() ??
                `审批通过失败 (HTTP ${res.status})`,
            };
          }
        }

        // 操作成功后刷新列表
        await refresh();

        return { success: true, message: '审批通过成功' };
      } catch (err: unknown) {
        const errorCode = extractErrorCode(err);
        const message =
          err instanceof Error ? err.message : '审批通过操作异常';
        safeSetState(setError, message);
        return { success: false, errorCode, message };
      } finally {
        safeSetState(setActionLoading, false);
      }
    },
    [fetchApprove, refresh, safeSetState],
  );

  // ---- core: reject ----

  const reject = useCallback(
    async (
      orderId: number,
      version: number,
      rejectionReason: string,
    ): Promise<ApprovalActionResult> => {
      safeSetState(setActionLoading, true);
      safeSetState(setError, null);

      try {
        if (fetchReject) {
          await fetchReject(orderId, { version, rejectionReason });
        } else {
          const res = await fetch(`/api/orders/${orderId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ version, rejectionReason }),
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const errorCode = extractErrorCode({
              response: { status: res.status, data: errBody },
            });
            return {
              success: false,
              errorCode,
              message:
                (errBody as Record<string, unknown>)?.message?.toString() ??
                `驳回失败 (HTTP ${res.status})`,
            };
          }
        }

        // 操作成功后刷新列表
        await refresh();

        return { success: true, message: '驳回成功' };
      } catch (err: unknown) {
        const errorCode = extractErrorCode(err);
        const message =
          err instanceof Error ? err.message : '驳回操作异常';
        safeSetState(setError, message);
        return { success: false, errorCode, message };
      } finally {
        safeSetState(setActionLoading, false);
      }
    },
    [fetchReject, refresh, safeSetState],
  );

  // ---- validation ----

  /**
   * 前端校验驳回原因。
   * @returns 错误提示字符串，null 表示校验通过
   */
  const validateRejectionReason = useCallback(
    (reason: string): string | null => {
      const trimmed = (reason ?? '').trim();
      if (trimmed.length === 0) {
        return '驳回原因不能为空';
      }
      if (trimmed.length > MAX_REJECTION_REASON_LENGTH) {
        return `驳回原因不能超过 ${MAX_REJECTION_REASON_LENGTH} 个字符（当前 ${trimmed.length} 个）`;
      }
      return null;
    },
    [],
  );

  // ---- approval records ----

  const loadApprovalRecords = useCallback(
    async (orderId: number): Promise<ApprovalRecord[]> => {
      try {
        let response: ApiResponse<ApprovalRecord[]>;

        if (fetchApprovalRecords) {
          response = await fetchApprovalRecords(orderId);
        } else {
          const res = await fetch(`/api/orders/${orderId}/approval-records`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          response = await res.json();
        }

        const records = response.data ?? [];

        safeSetState(
          setApprovalRecordsMap,
          (prev) => ({ ...prev, [orderId]: records }),
        );

        return records;
      } catch {
        return [];
      }
    },
    [fetchApprovalRecords, safeSetState],
  );

  // ---- polling ----

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // 首次加载
    refresh();

    // 轮询
    if (polling) {
      pollingTimerRef.current = setInterval(() => {
        refresh();
      }, pollIntervalMs);
    }

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, pollIntervalMs, targetStatus]);

  // ---- return ----

  return {
    pendingList,
    loading,
    actionLoading,
    error,
    approvalRecordsMap,
    refresh,
    approve,
    reject,
    validateRejectionReason,
    loadApprovalRecords,
    stopPolling,
  };
}

export default useApprovalData;