/**
 * @module workorder.types
 * @description 工单审批流程核心类型定义。
 *
 * 涵盖工单状态机（PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED），
 * 审批记录留痕、审批请求/响应体，以及业务错误码。
 *
 * 状态流转由后端 State Machine 严格校验，前端类型需与后端保持一致。
 * 日期字段遵循 ISO 8601 格式。
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * 工单状态枚举 — 与后端 OrderStatus / WorkOrderState 一一对应。
 *
 * 正向流转: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 * 逆向流转: APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → REJECTED
 * 终止流转: 任意非终态 → CANCELLED
 */
export enum WorkOrderStatus {
  /** 待提交（草稿） */
  DRAFT = 'DRAFT',
  /** 已提交，等待进入审批流程 */
  PENDING = 'PENDING',
  /** 一级审批中（部门主管） */
  APPROVING_LEVEL_1 = 'APPROVING_LEVEL_1',
  /** 二级审批中（资产管理员） */
  APPROVING_LEVEL_2 = 'APPROVING_LEVEL_2',
  /** 审批通过 */
  APPROVED = 'APPROVED',
  /** 审批驳回 */
  REJECTED = 'REJECTED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
}

/**
 * 审批动作枚举。
 */
export enum ApprovalAction {
  /** 审批通过 */
  APPROVE = 'APPROVE',
  /** 审批驳回 */
  REJECT = 'REJECT',
}

/**
 * 审批级别枚举 — 对应两级审批节点。
 */
export enum ApprovalLevel {
  /** 一级审批（部门主管） */
  LEVEL_1 = 'LEVEL_1',
  /** 二级审批（资产管理员） */
  LEVEL_2 = 'LEVEL_2',
}

/**
 * 工单优先级。
 */
export enum WorkOrderPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * 工单类型。
 */
export enum WorkOrderType {
  PURCHASE = 'PURCHASE',
  REPAIR = 'REPAIR',
  TRANSFER = 'TRANSFER',
  DISPOSAL = 'DISPOSAL',
  OTHER = 'OTHER',
}

// ---------------------------------------------------------------------------
// 审批状态机 — 合法流转映射（前端校验参考，最终以后端为准）
// ---------------------------------------------------------------------------

/**
 * 合法状态流转映射表。
 * Key: 当前状态, Value: 允许流转到的目标状态集合。
 * 前端可据此做初步校验，但最终以服务端 State Machine 为准。
 */
export const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  [WorkOrderStatus.DRAFT]: [WorkOrderStatus.PENDING],
  [WorkOrderStatus.PENDING]: [WorkOrderStatus.APPROVING_LEVEL_1, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.APPROVING_LEVEL_1]: [WorkOrderStatus.APPROVING_LEVEL_2, WorkOrderStatus.REJECTED, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.APPROVING_LEVEL_2]: [WorkOrderStatus.APPROVED, WorkOrderStatus.REJECTED, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.APPROVED]: [],
  [WorkOrderStatus.REJECTED]: [],
  [WorkOrderStatus.CANCELLED]: [],
};

/**
 * 判断从 from 状态流转到 to 状态是否合法（前端预校验）。
 * @param from - 当前状态
 * @param to - 目标状态
 * @returns 是否为合法流转
 */
export function isValidTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// 核心实体接口
// ---------------------------------------------------------------------------

/**
 * 工单实体 — 对应后端 work_order 表。
 */
export interface WorkOrder {
  /** 工单 ID */
  id: number;
  /** 工单编号（业务唯一标识） */
  orderNo: string;
  /** 工单标题 */
  title: string;
  /** 工单描述 */
  description: string;
  /** 工单类型 */
  type: WorkOrderType;
  /** 优先级 */
  priority: WorkOrderPriority;
  /** 当前状态 */
  status: WorkOrderStatus;
  /** 乐观锁版本号（并发控制） */
  version: number;
  /** 申请人 ID */
  applicantId: number;
  /** 申请人姓名 */
  applicantName: string;
  /** 申请人部门 ID */
  departmentId: number;
  /** 申请人部门名称 */
  departmentName: string;
  /** 当前审批级别（仅审批中状态有值） */
  currentApprovalLevel: ApprovalLevel | null;
  /** 驳回原因（仅 REJECTED 状态有值） */
  rejectionReason: string | null;
  /** 关联资产 ID 列表 */
  assetIds: number[];
  /** 附件 URL 列表 */
  attachments: string[];
  /** 创建时间 (ISO 8601) */
  createdAt: string;
  /** 更新时间 (ISO 8601) */
  updatedAt: string;
  /** 提交时间 (ISO 8601) */
  submittedAt: string | null;
  /** 审批完成时间 (ISO 8601) */
  completedAt: string | null;
}

/**
 * 审批记录 — 对应后端 approval_records 表。
 * 每次审批操作（通过/驳回）生成一条记录，用于留痕。
 */
export interface ApprovalRecord {
  /** 审批记录 ID */
  id: number;
  /** 关联工单 ID */
  orderId: number;
  /** 操作人 ID */
  operatorId: number;
  /** 操作人姓名 */
  operatorName: string;
  /** 操作人角色 */
  operatorRole: string;
  /** 审批动作 */
  action: ApprovalAction;
  /** 审批级别 */
  approvalLevel: ApprovalLevel;
  /** 审批意见/备注 */
  comment: string | null;
  /** 驳回原因（action 为 REJECT 时必填） */
  rejectionReason: string | null;
  /** 操作时间 (ISO 8601) */
  operatedAt: string;
}

// ---------------------------------------------------------------------------
// 请求类型 (Request DTOs)
// ---------------------------------------------------------------------------

/**
 * 创建工单请求体。
 */
export interface CreateWorkOrderRequest {
  /** 工单标题 */
  title: string;
  /** 工单描述 */
  description: string;
  /** 工单类型 */
  type: WorkOrderType;
  /** 优先级 */
  priority: WorkOrderPriority;
  /** 关联资产 ID 列表 */
  assetIds?: number[];
  /** 附件 URL 列表 */
  attachments?: string[];
}

/**
 * 提交工单请求体（DRAFT → PENDING）。
 */
export interface SubmitWorkOrderRequest {
  /** 工单 ID */
  id: number;
  /** 乐观锁版本号 */
  version: number;
}

/**
 * 审批通过请求体。
 * POST /api/orders/{id}/approve
 */
export interface ApproveWorkOrderRequest {
  /** 审批意见/备注（可选） */
  comment?: string;
  /** 乐观锁版本号 */
  version: number;
}

/**
 * 审批驳回请求体。
 * POST /api/orders/{id}/reject
 *
 * @constraint rejectionReason 为必填非空字符串，最大 500 字符。
 *           缺失时后端返回 HTTP 400 Bad Request。
 */
export interface RejectWorkOrderRequest {
  /** 驳回原因（必填，最大 500 字符） */
  rejectionReason: string;
  /** 乐观锁版本号 */
  version: number;
}

/**
 * 取消工单请求体。
 */
export interface CancelWorkOrderRequest {
  /** 取消原因 */
  reason?: string;
  /** 乐观锁版本号 */
  version: number;
}

/**
 * 工单列表查询参数。
 */
export interface WorkOrderListQuery {
  /** 当前页码（从 1 开始） */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 状态筛选 */
  status?: WorkOrderStatus | WorkOrderStatus[];
  /** 工单类型筛选 */
  type?: WorkOrderType;
  /** 优先级筛选 */
  priority?: WorkOrderPriority;
  /** 申请人 ID 筛选 */
  applicantId?: number;
  /** 部门 ID 筛选 */
  departmentId?: number;
  /** 关键词搜索（工单号/标题） */
  keyword?: string;
  /** 开始时间 (ISO 8601) */
  startDate?: string;
  /** 结束时间 (ISO 8601) */
  endDate?: string;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'updatedAt' | 'submittedAt';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 审批列表查询参数。
 * 根据当前用户角色自动过滤：
 * - 部门主管: 仅可见 APPROVING_LEVEL_1 工单
 * - 资产管理员: 仅可见 APPROVING_LEVEL_2 工单
 */
export interface ApprovalListQuery {
  /** 当前页码（从 1 开始） */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 审批级别筛选（由后端根据角色校验） */
  approvalLevel?: ApprovalLevel;
  /** 关键词搜索 */
  keyword?: string;
  /** 开始时间 (ISO 8601) */
  startDate?: string;
  /** 结束时间 (ISO 8601) */
  endDate?: string;
}

// ---------------------------------------------------------------------------
// 响应类型 (Response DTOs)
// ---------------------------------------------------------------------------

/**
 * 通用分页响应包装。
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  list: T[];
  /** 总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
}

/**
 * 工单列表项 — 列表页展示的精简工单信息。
 */
export interface WorkOrderListItem {
  /** 工单 ID */
  id: number;
  /** 工单编号 */
  orderNo: string;
  /** 工单标题 */
  title: string;
  /** 工单类型 */
  type: WorkOrderType;
  /** 优先级 */
  priority: WorkOrderPriority;
  /** 当前状态 */
  status: WorkOrderStatus;
  /** 乐观锁版本号 */
  version: number;
  /** 申请人姓名 */
  applicantName: string;
  /** 申请人部门名称 */
  departmentName: string;
  /** 当前审批级别 */
  currentApprovalLevel: ApprovalLevel | null;
  /** 创建时间 (ISO 8601) */
  createdAt: string;
  /** 提交时间 (ISO 8601) */
  submittedAt: string | null;
}

/**
 * 审批列表项 — 审批工作台展示的精简信息。
 * 包含 ATB-4 要求的工单号、申请人、提交时间。
 */
export interface ApprovalListItem {
  /** 工单 ID */
  id: number;
  /** 工单编号 */
  orderNo: string;
  /** 工单标题 */
  title: string;
  /** 工单类型 */
  type: WorkOrderType;
  /** 优先级 */
  priority: WorkOrderPriority;
  /** 当前状态 */
  status: WorkOrderStatus;
  /** 乐观锁版本号 */
  version: number;
  /** 申请人 ID */
  applicantId: number;
  /** 申请人姓名 */
  applicantName: string;
  /** 申请人部门名称 */
  departmentName: string;
  /** 当前审批级别 */
  currentApprovalLevel: ApprovalLevel;
  /** 提交时间 (ISO 8601) */
  submittedAt: string;
  /** 等待审批时长（毫秒） */
  pendingDuration: number;
}

/**
 * 审批操作响应体。
 * 对应 POST /api/orders/{id}/approve 和 POST /api/orders/{id}/reject 的响应。
 */
export interface ApprovalActionResponse {
  /** 工单 ID */
  orderId: number;
  /** 操作后的工单状态 */
  newStatus: WorkOrderStatus;
  /** 乐观锁版本号（已递增） */
  version: number;
  /** 本次审批记录 */
  approvalRecord: ApprovalRecord;
}

/**
 * 工单详情响应体 — 包含工单信息及完整审批记录。
 */
export interface WorkOrderDetailResponse {
  /** 工单信息 */
  workOrder: WorkOrder;
  /** 审批记录列表（按时间倒序） */
  approvalRecords: ApprovalRecord[];
}

// ---------------------------------------------------------------------------
// 错误类型
// ---------------------------------------------------------------------------

/**
 * 业务错误码枚举。
 */
export enum WorkOrderErrorCode {
  /** 非法状态流转 */
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  /** 并发冲突（乐观锁） */
  OPTIMISTIC_LOCK_CONFLICT = 'OPTIMISTIC_LOCK_CONFLICT',
  /** 驳回原因缺失 */
  REJECTION_REASON_REQUIRED = 'REJECTION_REASON_REQUIRED',
  /** 驳回原因超长 */
  REJECTION_REASON_TOO_LONG = 'REJECTION_REASON_TOO_LONG',
  /** 工单不存在 */
  WORK_ORDER_NOT_FOUND = 'WORK_ORDER_NOT_FOUND',
  /** 无审批权限 */
  APPROVAL_PERMISSION_DENIED = 'APPROVAL_PERMISSION_DENIED',
  /** 工单已取消 */
  WORK_ORDER_ALREADY_CANCELLED = 'WORK_ORDER_ALREADY_CANCELLED',
  /** 参数校验失败 */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * 业务错误响应体。
 * 对应 HTTP 400 / 409 等错误场景。
 */
export interface WorkOrderErrorResponse {
  /** HTTP 状态码 */
  statusCode: number;
  /** 业务错误码 */
  errorCode: WorkOrderErrorCode;
  /** 错误消息 */
  message: string;
  /** 详细错误信息（调试用） */
  details?: Record<string, unknown>;
  /** 时间戳 (ISO 8601) */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// 审批工作台相关类型
// ---------------------------------------------------------------------------

/**
 * 审批工作台统计信息。
 */
export interface ApprovalDashboardStats {
  /** 待一级审批数量 */
  pendingLevel1Count: number;
  /** 待二级审批数量 */
  pendingLevel2Count: number;
  /** 今日已审批数量 */
  todayApprovedCount: number;
  /** 今日已驳回数量 */
  todayRejectedCount: number;
}

/**
 * 审批表单数据 — 用于审批详情页的通过/驳回表单。
 */
export interface ApprovalFormData {
  /** 审批动作 */
  action: ApprovalAction;
  /** 审批意见/备注 */
  comment: string;
  /** 驳回原因（action 为 REJECT 时必填） */
  rejectionReason: string;
}

/**
 * 审批表单校验结果。
 */
export interface ApprovalFormValidation {
  /** 是否校验通过 */
  isValid: boolean;
  /** 校验错误列表 */
  errors: ApprovalFormError[];
}

/**
 * 审批表单校验错误。
 */
export interface ApprovalFormError {
  /** 错误字段 */
  field: 'comment' | 'rejectionReason';
  /** 错误消息 */
  message: string;
}

// ---------------------------------------------------------------------------
// 工单状态展示辅助类型
// ---------------------------------------------------------------------------

/**
 * 工单状态展示配置 — 用于 UI 渲染（颜色、标签、图标等）。
 */
export interface WorkOrderStatusConfig {
  /** 状态枚举值 */
  status: WorkOrderStatus;
  /** 展示标签（中文） */
  label: string;
  /** 主题色（CSS 变量或颜色值） */
  color: string;
  /** 是否为终态（不可再操作） */
  isTerminal: boolean;
  /** 是否为审批中状态 */
  isApproving: boolean;
}

/**
 * 工单状态展示配置映射表。
 */
export const WORK_ORDER_STATUS_CONFIG: Record<WorkOrderStatus, WorkOrderStatusConfig> = {
  [WorkOrderStatus.DRAFT]: {
    status: WorkOrderStatus.DRAFT,
    label: '草稿',
    color: 'var(--color-gray-500)',
    isTerminal: false,
    isApproving: false,
  },
  [WorkOrderStatus.PENDING]: {
    status: WorkOrderStatus.PENDING,
    label: '待审批',
    color: 'var(--color-blue-500)',
    isTerminal: false,
    isApproving: false,
  },
  [WorkOrderStatus.APPROVING_LEVEL_1]: {
    status: WorkOrderStatus.APPROVING_LEVEL_1,
    label: '一级审批中',
    color: 'var(--color-orange-500)',
    isTerminal: false,
    isApproving: true,
  },
  [WorkOrderStatus.APPROVING_LEVEL_2]: {
    status: WorkOrderStatus.APPROVING_LEVEL_2,
    label: '二级审批中',
    color: 'var(--color-orange-500)',
    isTerminal: false,
    isApproving: true,
  },
  [WorkOrderStatus.APPROVED]: {
    status: WorkOrderStatus.APPROVED,
    label: '已通过',
    color: 'var(--color-green-500)',
    isTerminal: true,
    isApproving: false,
  },
  [WorkOrderStatus.REJECTED]: {
    status: WorkOrderStatus.REJECTED,
    label: '已驳回',
    color: 'var(--color-red-500)',
    isTerminal: true,
    isApproving: false,
  },
  [WorkOrderStatus.CANCELLED]: {
    status: WorkOrderStatus.CANCELLED,
    label: '已取消',
    color: 'var(--color-gray-400)',
    isTerminal: true,
    isApproving: false,
  },
};

/**
 * 审批级别展示配置映射表。
 */
export const APPROVAL_LEVEL_CONFIG: Record<ApprovalLevel, { label: string; role: string }> = {
  [ApprovalLevel.LEVEL_1]: {
    label: '一级审批',
    role: '部门主管',
  },
  [ApprovalLevel.LEVEL_2]: {
    label: '二级审批',
    role: '资产管理员',
  },
};