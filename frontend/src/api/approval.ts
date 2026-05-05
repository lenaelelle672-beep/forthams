/**
 * approval.ts — 工单审批 API 模块
 *
 * 封装多级审批流的前端请求层，包括：
 * - 审批通过 / 驳回操作
 * - 待审批列表查询（按角色隔离）
 * - 审批记录留痕查询
 *
 * 对应后端端点：
 *   POST   /api/orders/{id}/approve
 *   POST   /api/orders/{id}/reject
 *   GET    /api/orders/pending
 *   GET    /api/orders/{id}/approval-records
 *   GET    /api/orders/{id}
 *
 * @module api/approval
 */

import http from '@/utils/http';
import type {
  ApprovalRecord,
  ApprovalRejectRequest,
  ApprovalListParams,
  ApprovalListResponse,
  WorkOrderDetail,
  OrderStatus,
} from '@/types/approval';

// ---------------------------------------------------------------------------
// Types (local request / response shapes)
// ---------------------------------------------------------------------------

/** 审批通过请求体 */
export interface ApproveRequest {
  /** 乐观锁版本号，防止并发审批冲突 */
  version: number;
}

/** 审批驳回请求体 */
export interface RejectRequest {
  /** 驳回原因，必填，最大 500 字符 */
  rejectionReason: string;
  /** 乐观锁版本号，防止并发审批冲突 */
  version: number;
}

/** 审批记录响应 */
export interface ApprovalRecordResponse {
  id: number;
  orderId: number;
  operatorId: number;
  operatorName: string;
  /** APPROVE | REJECT */
  action: 'APPROVE' | 'REJECT';
  /** 驳回原因（仅 REJECT 时有值） */
  rejectionReason: string | null;
  createdAt: string; // ISO 8601
}

/** 待审批列表查询参数 */
export interface PendingApprovalListParams {
  /** 当前页码，从 1 开始 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 工单号模糊搜索 */
  orderNo?: string;
  /** 申请人姓名模糊搜索 */
  applicantName?: string;
}

/** 分页元数据 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** 待审批工单列表项 */
export interface PendingApprovalItem {
  id: number;
  orderNo: string;
  /** 申请人姓名 */
  applicantName: string;
  /** 提交时间 ISO 8601 */
  submittedAt: string;
  /** 当前审批级别 */
  status: OrderStatus;
  /** 乐观锁版本号 */
  version: number;
  /** 工单摘要 */
  summary: string;
}

/** 待审批列表响应 */
export interface PendingApprovalListResponse {
  content: PendingApprovalItem[];
  pagination: PaginationMeta;
}

/** 工单详情响应 */
export interface WorkOrderDetailResponse {
  id: number;
  orderNo: string;
  applicantId: number;
  applicantName: string;
  status: OrderStatus;
  version: number;
  summary: string;
  description: string;
  submittedAt: string;
  updatedAt: string;
  /** 审批记录列表 */
  approvalRecords: ApprovalRecordResponse[];
}

/** 通用 API 错误响应 */
export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API Error Codes
// ---------------------------------------------------------------------------

/** 后端返回的业务错误码常量 */
export const ApprovalErrorCode = {
  /** 非法状态流转 */
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  /** 乐观锁冲突 */
  OPTIMISTIC_LOCK_CONFLICT: 'OPTIMISTIC_LOCK_CONFLICT',
  /** 驳回原因缺失 */
  REJECTION_REASON_REQUIRED: 'REJECTION_REASON_REQUIRED',
  /** 权限不足 */
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  /** 工单不存在 */
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
} as const;

export type ApprovalErrorCodeType =
  (typeof ApprovalErrorCode)[keyof typeof ApprovalErrorCode];

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * 审批通过
 *
 * 将工单推进到下一个审批级别。
 * - APPROVING_LEVEL_1 → APPROVING_LEVEL_2
 * - APPROVING_LEVEL_2 → APPROVED
 *
 * @param orderId - 工单 ID
 * @param params  - 包含乐观锁 version
 * @returns 更新后的工单详情
 * @throws 409 Conflict — 非法状态流转或乐观锁冲突
 */
export async function approveOrder(
  orderId: number,
  params: ApproveRequest,
): Promise<WorkOrderDetailResponse> {
  const { data } = await http.post<WorkOrderDetailResponse>(
    `/api/orders/${orderId}/approve`,
    params,
  );
  return data;
}

/**
 * 审批驳回
 *
 * 将工单状态变更为 REJECTED，必须提供驳回原因。
 *
 * @param orderId - 工单 ID
 * @param params  - 包含 rejectionReason（必填，≤500字符）和乐观锁 version
 * @returns 更新后的工单详情
 * @throws 400 Bad Request — 缺失 rejectionReason
 * @throws 409 Conflict — 乐观锁冲突
 */
export async function rejectOrder(
  orderId: number,
  params: RejectRequest,
): Promise<WorkOrderDetailResponse> {
  const { data } = await http.post<WorkOrderDetailResponse>(
    `/api/orders/${orderId}/reject`,
    params,
  );
  return data;
}

/**
 * 获取待审批工单列表
 *
 * 后端根据当前用户角色自动过滤：
 * - 部门主管 → 仅返回 APPROVING_LEVEL_1 工单
 * - 资产管理员 → 仅返回 APPROVING_LEVEL_2 工单
 *
 * @param params - 分页与搜索参数
 * @returns 分页的待审批工单列表
 */
export async function getPendingApprovals(
  params?: PendingApprovalListParams,
): Promise<PendingApprovalListResponse> {
  const { data } = await http.get<PendingApprovalListResponse>(
    '/api/orders/pending',
    { params },
  );
  return data;
}

/**
 * 获取工单审批记录
 *
 * 返回指定工单的全部审批操作留痕，包括操作人、动作、时间及驳回原因。
 *
 * @param orderId - 工单 ID
 * @returns 审批记录列表
 */
export async function getApprovalRecords(
  orderId: number,
): Promise<ApprovalRecordResponse[]> {
  const { data } = await http.get<ApprovalRecordResponse[]>(
    `/api/orders/${orderId}/approval-records`,
  );
  return data;
}

/**
 * 获取工单详情
 *
 * 返回工单完整信息，包含当前状态、乐观锁版本号及审批记录。
 *
 * @param orderId - 工单 ID
 * @returns 工单详情
 */
export async function getWorkOrderDetail(
  orderId: number,
): Promise<WorkOrderDetailResponse> {
  const { data } = await http.get<WorkOrderDetailResponse>(
    `/api/orders/${orderId}`,
  );
  return data;
}

// ---------------------------------------------------------------------------
// Re-exports for backward compatibility
// ---------------------------------------------------------------------------

export type {
  ApprovalRecord,
  ApprovalRejectRequest,
  ApprovalListParams,
  ApprovalListResponse,
  WorkOrderDetail,
  OrderStatus,
};