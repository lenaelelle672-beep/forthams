/**
 * @module api/workorder
 * @description 工单审批 API 模块
 *
 * 封装工单多级审批流程的前端请求层，包括：
 * - 审批通过 / 驳回操作（含乐观锁 version 字段）
 * - 待审批列表查询（角色隔离：部门主管仅见 LEVEL_1，资产管理员仅见 LEVEL_2）
 * - 审批记录留痕查询
 *
 * 后端状态机正向流转：PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 * 逆向流转：任意审批节点 → REJECTED
 * 终态：APPROVED / REJECTED / CANCELLED
 *
 * @see https://github.com/your-org/ams/blob/main/docs/workorder-approval-flow.md
 */

import http from '@/utils/http';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * 工单审批状态枚举，与后端 OrderStatus 保持一致。
 *
 * 状态机约束：
 * - 正向：PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 * - 逆向：APPROVING_LEVEL_1 | APPROVING_LEVEL_2 → REJECTED
 * - 取消：PENDING → CANCELLED
 */
export enum OrderStatus {
  /** 草稿/待提交 */
  DRAFT = 'DRAFT',
  /** 已提交，等待进入审批流 */
  PENDING = 'PENDING',
  /** 一级审批中（部门主管） */
  APPROVING_LEVEL_1 = 'APPROVING_LEVEL_1',
  /** 二级审批中（资产管理员） */
  APPROVING_LEVEL_2 = 'APPROVING_LEVEL_2',
  /** 审批通过 */
  APPROVED = 'APPROVED',
  /** 已驳回 */
  REJECTED = 'REJECTED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
}

/**
 * 审批动作类型
 */
export type ApprovalAction = 'APPROVE' | 'REJECT';

/**
 * 审批记录中的操作动作
 */
export type RecordAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CANCEL';

/**
 * 工单基础信息（列表项）
 */
export interface WorkOrderListItem {
  /** 工单 ID */
  id: string;
  /** 工单编号 */
  orderNo: string;
  /** 工单标题 */
  title: string;
  /** 当前状态 */
  status: OrderStatus;
  /** 申请人 ID */
  applicantId: string;
  /** 申请人姓名 */
  applicantName: string;
  /** 提交时间（ISO 8601） */
  submittedAt: string | null;
  /** 创建时间（ISO 8601） */
  createdAt: string;
  /** 更新时间（ISO 8601） */
  updatedAt: string;
  /** 乐观锁版本号 */
  version: number;
}

/**
 * 工单详情
 */
export interface WorkOrderDetail extends WorkOrderListItem {
  /** 工单描述 */
  description: string;
  /** 工单类型 */
  type: string;
  /** 优先级 */
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** 关联资产 ID（可选） */
  assetId: string | null;
  /** 当前审批级别（1 或 2） */
  currentApprovalLevel: number | null;
  /** 审批记录列表 */
  approvalRecords: ApprovalRecord[];
}

/**
 * 审批记录（留痕）
 */
export interface ApprovalRecord {
  /** 记录 ID */
  id: string;
  /** 关联工单 ID */
  orderId: string;
  /** 操作人 ID */
  operatorId: string;
  /** 操作人姓名 */
  operatorName: string;
  /** 操作动作 */
  action: RecordAction;
  /** 操作时间（ISO 8601） */
  operatedAt: string;
  /** 审批意见 / 备注 */
  comment: string | null;
  /** 驳回原因（仅 REJECT 时有值） */
  rejectionReason: string | null;
  /** 审批级别（1=部门主管，2=资产管理员） */
  approvalLevel: number | null;
}

// ---------------------------------------------------------------------------
// Request Types
// ---------------------------------------------------------------------------

/**
 * 审批通过请求体
 */
export interface ApproveRequest {
  /** 乐观锁版本号，防止并发审批冲突 */
  version: number;
  /** 审批意见（可选） */
  comment?: string;
}

/**
 * 审批驳回请求体
 *
 * 约束：rejectionReason 为必填非空字符串，最大 500 字符。
 * 缺失时后端返回 HTTP 400 Bad Request。
 */
export interface RejectRequest {
  /** 乐观锁版本号，防止并发审批冲突 */
  version: number;
  /** 驳回原因（必填，1-500 字符） */
  rejectionReason: string;
  /** 额外备注（可选） */
  comment?: string;
}

/**
 * 待审批列表查询参数
 *
 * 数据隔离约束：
 * - 部门主管角色仅返回 APPROVING_LEVEL_1 状态工单
 * - 资产管理员角色仅返回 APPROVING_LEVEL_2 状态工单
 */
export interface PendingApprovalQuery {
  /** 页码（从 1 开始） */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 关键词搜索（工单号/申请人） */
  keyword?: string;
  /** 工单状态过滤（后端会根据角色强制覆盖） */
  status?: OrderStatus;
  /** 排序字段 */
  sortBy?: 'submittedAt' | 'createdAt' | 'orderNo';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Response Types
// ---------------------------------------------------------------------------

/**
 * 通用分页响应
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  items: T[];
  /** 总条数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
}

/**
 * 审批操作响应
 */
export interface ApprovalResponse {
  /** 工单 ID */
  orderId: string;
  /** 更新后的状态 */
  status: OrderStatus;
  /** 更新后的版本号 */
  version: number;
  /** 新增的审批记录 */
  approvalRecord: ApprovalRecord;
}

/**
 * 业务错误响应
 */
export interface BusinessErrorResponse {
  /** HTTP 状态码 */
  code: number;
  /** 业务错误码 */
  errorCode: string;
  /** 错误消息 */
  message: string;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 预定义的业务错误码
 */
export const ApprovalErrorCode = {
  /** 非法状态流转（HTTP 409） */
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  /** 乐观锁冲突（HTTP 409） */
  OPTIMISTIC_LOCK_CONFLICT: 'OPTIMISTIC_LOCK_CONFLICT',
  /** 驳回原因缺失（HTTP 400） */
  REJECTION_REASON_REQUIRED: 'REJECTION_REASON_REQUIRED',
  /** 驳回原因超长（HTTP 400） */
  REJECTION_REASON_TOO_LONG: 'REJECTION_REASON_TOO_LONG',
  /** 无审批权限（HTTP 403） */
  APPROVAL_PERMISSION_DENIED: 'APPROVAL_PERMISSION_DENIED',
  /** 工单不存在（HTTP 404） */
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
} as const;

export type ApprovalErrorCodeType = (typeof ApprovalErrorCode)[keyof typeof ApprovalErrorCode];

// ---------------------------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------------------------

const BASE_URL = '/api/orders';

/**
 * 获取待审批工单列表
 *
 * 根据当前登录用户角色自动过滤：
 * - 部门主管 → APPROVING_LEVEL_1
 * - 资产管理员 → APPROVING_LEVEL_2
 *
 * @param query - 查询参数
 * @returns 分页的待审批工单列表
 * @throws {BusinessErrorResponse} 当权限不足时返回 403
 */
export async function getPendingApprovals(
  query: PendingApprovalQuery = {},
): Promise<PaginatedResponse<WorkOrderListItem>> {
  const { page = 1, pageSize = 10, keyword, status, sortBy = 'submittedAt', sortOrder = 'desc' } = query;

  const params: Record<string, string | number> = {
    page,
    pageSize,
    sortBy,
    sortOrder,
  };

  if (keyword) {
    params.keyword = keyword;
  }
  if (status) {
    params.status = status;
  }

  const response = await http.get<PaginatedResponse<WorkOrderListItem>>(`${BASE_URL}/pending`, { params });
  return response.data;
}

/**
 * 获取工单详情（含审批记录）
 *
 * @param orderId - 工单 ID
 * @returns 工单详情
 * @throws {BusinessErrorResponse} 工单不存在时返回 404
 */
export async function getWorkOrderDetail(orderId: string): Promise<WorkOrderDetail> {
  const response = await http.get<WorkOrderDetail>(`${BASE_URL}/${encodeURIComponent(orderId)}`);
  return response.data;
}

/**
 * 审批通过
 *
 * 调用后端状态机执行正向流转。后端会校验当前用户角色是否匹配当前审批级别。
 *
 * 状态流转：
 * - APPROVING_LEVEL_1 → APPROVING_LEVEL_2
 * - APPROVING_LEVEL_2 → APPROVED
 *
 * @param orderId - 工单 ID
 * @param data - 审批通过请求体（含 version 乐观锁）
 * @returns 审批操作结果
 * @throws {BusinessErrorResponse} 状态流转非法时返回 409 INVALID_STATE_TRANSITION
 * @throws {BusinessErrorResponse} 乐观锁冲突时返回 409 OPTIMISTIC_LOCK_CONFLICT
 */
export async function approveWorkOrder(
  orderId: string,
  data: ApproveRequest,
): Promise<ApprovalResponse> {
  const response = await http.post<ApprovalResponse>(
    `${BASE_URL}/${encodeURIComponent(orderId)}/approve`,
    data,
  );
  return response.data;
}

/**
 * 审批驳回
 *
 * 调用后端状态机执行逆向流转至 REJECTED 状态。
 * rejectionReason 为必填字段，缺失时后端返回 HTTP 400。
 *
 * 状态流转：
 * - APPROVING_LEVEL_1 → REJECTED
 * - APPROVING_LEVEL_2 → REJECTED
 *
 * @param orderId - 工单 ID
 * @param data - 审批驳回请求体（含 version 乐观锁和 rejectionReason）
 * @returns 审批操作结果
 * @throws {BusinessErrorResponse} rejectionReason 缺失时返回 400 REJECTION_REASON_REQUIRED
 * @throws {BusinessErrorResponse} rejectionReason 超过 500 字符时返回 400 REJECTION_REASON_TOO_LONG
 * @throws {BusinessErrorResponse} 状态流转非法时返回 409 INVALID_STATE_TRANSITION
 * @throws {BusinessErrorResponse} 乐观锁冲突时返回 409 OPTIMISTIC_LOCK_CONFLICT
 */
export async function rejectWorkOrder(
  orderId: string,
  data: RejectRequest,
): Promise<ApprovalResponse> {
  const response = await http.post<ApprovalResponse>(
    `${BASE_URL}/${encodeURIComponent(orderId)}/reject`,
    data,
  );
  return response.data;
}

/**
 * 获取工单审批记录列表
 *
 * 返回指定工单的全部审批留痕记录，按操作时间倒序排列。
 *
 * @param orderId - 工单 ID
 * @returns 审批记录列表
 */
export async function getApprovalRecords(orderId: string): Promise<ApprovalRecord[]> {
  const response = await http.get<ApprovalRecord[]>(
    `${BASE_URL}/${encodeURIComponent(orderId)}/approval-records`,
  );
  return response.data;
}

/**
 * 轮询检查工单状态（用于审批工作台实时刷新）
 *
 * 本期采用接口轮询模式，暂不实现 WebSocket / SSE 推送。
 * 建议调用间隔：5-10 秒。
 *
 * @param orderId - 工单 ID
 * @returns 当前工单状态及版本号
 */
export async function pollWorkOrderStatus(
  orderId: string,
): Promise<{ id: string; status: OrderStatus; version: number }> {
  const response = await http.get<{ id: string; status: OrderStatus; version: number }>(
    `${BASE_URL}/${encodeURIComponent(orderId)}/status`,
  );
  return response.data;
}

/**
 * 批量查询工单状态（用于列表页轮询刷新）
 *
 * @param orderIds - 工单 ID 列表（最多 50 个）
 * @returns 工单 ID 到状态的映射
 */
export async function batchPollWorkOrderStatus(
  orderIds: string[],
): Promise<Map<string, { status: OrderStatus; version: number }>> {
  const response = await http.post<{ id: string; status: OrderStatus; version: number }[]>(
    `${BASE_URL}/batch-status`,
    { orderIds },
  );
  const map = new Map<string, { status: OrderStatus; version: number }>();
  for (const item of response.data) {
    map.set(item.id, { status: item.status, version: item.version });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Utility Helpers
// ---------------------------------------------------------------------------

/**
 * 判断工单是否处于可审批状态
 *
 * @param status - 工单当前状态
 * @returns 是否可审批
 */
export function isApprovableStatus(status: OrderStatus): boolean {
  return (
    status === OrderStatus.APPROVING_LEVEL_1 ||
    status === OrderStatus.APPROVING_LEVEL_2
  );
}

/**
 * 判断工单是否为终态（不可再操作）
 *
 * @param status - 工单当前状态
 * @returns 是否为终态
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return (
    status === OrderStatus.APPROVED ||
    status === OrderStatus.REJECTED ||
    status === OrderStatus.CANCELLED
  );
}

/**
 * 获取审批级别的中文标签
 *
 * @param level - 审批级别（1 或 2）
 * @returns 审批级别标签
 */
export function getApprovalLevelLabel(level: number | null): string {
  switch (level) {
    case 1:
      return '一级审批（部门主管）';
    case 2:
      return '二级审批（资产管理员）';
    default:
      return '未知';
  }
}

/**
 * 获取工单状态的中文标签
 *
 * @param status - 工单状态
 * @returns 状态标签
 */
export function getOrderStatusLabel(status: OrderStatus): string {
  const labelMap: Record<OrderStatus, string> = {
    [OrderStatus.DRAFT]: '草稿',
    [OrderStatus.PENDING]: '待提交',
    [OrderStatus.APPROVING_LEVEL_1]: '一级审批中',
    [OrderStatus.APPROVING_LEVEL_2]: '二级审批中',
    [OrderStatus.APPROVED]: '已通过',
    [OrderStatus.REJECTED]: '已驳回',
    [OrderStatus.CANCELLED]: '已取消',
  };
  return labelMap[status] ?? '未知';
}

/**
 * 校验驳回原因是否合法
 *
 * 前端预校验，减少无效请求：
 * - 非空
 * - 最大 500 字符
 *
 * @param reason - 驳回原因
 * @returns 校验结果及错误消息
 */
export function validateRejectionReason(
  reason: string,
): { valid: boolean; errorMessage?: string } {
  if (!reason || reason.trim().length === 0) {
    return { valid: false, errorMessage: '驳回原因不能为空' };
  }
  if (reason.length > 500) {
    return { valid: false, errorMessage: '驳回原因不能超过 500 个字符' };
  }
  return { valid: true };
}