/**
 * @module workorder.types
 * @description 工单审批流程核心类型定义。
 *
 * 涵盖工单状态机（DRAFT → PENDING → APPROVED → EXECUTING → COMPLETED），
 * 审批记录留痕、审批请求/响应体，以及业务错误码。
 *
 * 字段名已与后端 Entity/DTO 对齐（reporterId/deptId/workOrderNo/createTime/updateTime 等）。
 * 状态流转由后端 State Machine 严格校验，前端类型需与后端保持一致。
 * 日期字段遵循 ISO 8601 格式。
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * 工单状态枚举 — 与后端 WorkOrder.status 一一对应。
 *
 * 正向流转: DRAFT → PENDING → APPROVED → EXECUTING → COMPLETED
 * 逆向流转: PENDING → REJECTED
 * 终止流转: 任意非终态 → CANCELLED
 *
 * Phase3 新增: ON_HOLD, PENDING_ACCEPTANCE, ACCEPTANCE_REJECTED
 */
export const WorkOrderStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  EXECUTING: 'EXECUTING',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
  ACCEPTANCE_REJECTED: 'ACCEPTANCE_REJECTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type WorkOrderStatus = (typeof WorkOrderStatus)[keyof typeof WorkOrderStatus];

/**
 * 审批动作枚举。
 */
export const ApprovalAction = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  CANCEL: 'CANCEL',
} as const;
export type ApprovalAction = (typeof ApprovalAction)[keyof typeof ApprovalAction];

/**
 * 审批级别枚举 — 对应两级审批节点。
 */
export const ApprovalLevel = {
  LEVEL_1: 'LEVEL_1',
  LEVEL_2: 'LEVEL_2',
} as const;
export type ApprovalLevel = (typeof ApprovalLevel)[keyof typeof ApprovalLevel];

/**
 * 工单优先级。
 */
export const WorkOrderPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type WorkOrderPriority = (typeof WorkOrderPriority)[keyof typeof WorkOrderPriority];

/**
 * 工单类型。
 */
export const WorkOrderType = {
  PURCHASE: 'PURCHASE',
  REPAIR: 'REPAIR',
  TRANSFER: 'TRANSFER',
  DISPOSAL: 'DISPOSAL',
  OTHER: 'OTHER',
  IT_SUPPORT: 'IT_SUPPORT',
  PERMISSION: 'PERMISSION',
} as const;
export type WorkOrderType = (typeof WorkOrderType)[keyof typeof WorkOrderType];

// ---------------------------------------------------------------------------
// 审批状态机 — 合法流转映射（前端校验参考，最终以后端为准）
// ---------------------------------------------------------------------------

/**
 * 合法状态流转映射表。
 * Key: 当前状态, Value: 允许流转到的目标状态集合。
 * 前端可据此做初步校验，但最终以服务端 State Machine 为准。
 */
export const VALID_TRANSITIONS: Partial<Record<WorkOrderStatus, WorkOrderStatus[]>> = {
  [WorkOrderStatus.DRAFT]: [WorkOrderStatus.PENDING],
  [WorkOrderStatus.PENDING]: [WorkOrderStatus.APPROVED, WorkOrderStatus.REJECTED, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.APPROVED]: [WorkOrderStatus.EXECUTING],
  [WorkOrderStatus.EXECUTING]: [WorkOrderStatus.COMPLETED, WorkOrderStatus.ON_HOLD],
  [WorkOrderStatus.ON_HOLD]: [WorkOrderStatus.EXECUTING],
  [WorkOrderStatus.COMPLETED]: [WorkOrderStatus.PENDING_ACCEPTANCE],
  [WorkOrderStatus.PENDING_ACCEPTANCE]: [WorkOrderStatus.COMPLETED, WorkOrderStatus.ACCEPTANCE_REJECTED],
  [WorkOrderStatus.ACCEPTANCE_REJECTED]: [WorkOrderStatus.EXECUTING],
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
 * 字段名与后端 Entity/DTO 完全对齐。
 */
export interface WorkOrder {
  /** 兼容测试与 mock 的扩展字段 */
  [key: string]: unknown;
  /** 工单 ID */
  id: number | string;
  /** 工单编号（业务唯一标识） */
  workOrderNo?: string;
  /** 工单标题 */
  title: string;
  /** 工单描述 */
  description?: string;
  /** 工单类型 */
  type?: WorkOrderType;
  /** 优先级 */
  priority?: WorkOrderPriority;
  /** 当前状态 */
  status: WorkOrderStatus;
  /** 乐观锁版本号（并发控制） */
  version?: number;
  /** 租户 ID */
  tenantId?: string;
  /** 申请人 ID */
  reporterId?: number;
  /** 申请人姓名 */
  reporterName?: string;
  /** 部门 ID */
  deptId?: number;
  /** 部门名称 */
  deptName?: string;
  /** 办理人 ID */
  assigneeId?: number;
  /** 办理人姓名 */
  assigneeName?: string;
  /** 当前审批级别（仅审批中状态有值） */
  currentApprovalLevel?: ApprovalLevel | null;
  /** 驳回原因（仅 REJECTED 状态有值） */
  rejectionReason?: string | null;
  /** 关联资产 ID */
  assetId?: number;
  /** 关联资产名称 */
  assetName?: string;
  /** 关联资产编码 */
  assetCode?: string;
  /** 故障代码 ID */
  faultCodeId?: number;
  /** 计划开始时间 (ISO 8601) */
  plannedStartDate?: string;
  /** 计划结束时间 (ISO 8601) */
  plannedEndDate?: string;
  /** 实际开始时间 (ISO 8601) */
  actualStartDate?: string;
  /** 实际结束时间 (ISO 8601) */
  actualEndDate?: string;
  /** 预估成本 */
  estimatedCost?: number;
  /** 实际成本 */
  actualCost?: number;
  /** 完成备注 */
  completionNote?: string;
  /** 协办人列表 */
  collaborators?: string[];
  /** 附件 URL 列表 */
  attachments?: string[];
  /** 创建时间 (ISO 8601) */
  createTime?: string;
  /** 更新时间 (ISO 8601) */
  updateTime?: string;
  /** 提交时间 (ISO 8601) */
  submittedAt?: string | null;
  /** 审批完成时间 (ISO 8601) */
  completedAt?: string | null;
  /** SLA 截止时间 (ISO 8601) */
  slaDeadline?: string;
  /** SLA 状态: NORMAL-正常, WARNING-即将超期, BREACHED-已超期 */
  slaStatus?: 'NORMAL' | 'WARNING' | 'BREACHED';
}

/**
 * 审批记录 — 对应后端 approval_records 表。
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
  rejectionReason?: string | null;
  /** 操作时间 (ISO 8601) */
  operatedAt: string;
}

// ---------------------------------------------------------------------------
// 请求类型 (Request DTOs)
// ---------------------------------------------------------------------------

export interface CreateWorkOrderRequest {
  title: string;
  description?: string;
  type?: WorkOrderType;
  priority?: WorkOrderPriority;
  assetId?: number;
  faultCodeId?: number;
  attachments?: string[];
}

export interface SubmitWorkOrderRequest {
  id: number;
  version?: number;
}

export interface ApproveWorkOrderRequest {
  comment?: string;
  version?: number;
}

export interface RejectWorkOrderRequest {
  rejectionReason: string;
  version?: number;
}

export interface CancelWorkOrderRequest {
  reason?: string;
  version?: number;
}

export type WorkOrderQuery = WorkOrderListQuery;

export interface WorkOrderListQuery {
  page?: number;
  pageSize?: number;
  status?: WorkOrderStatus | WorkOrderStatus[] | string;
  type?: WorkOrderType;
  priority?: WorkOrderPriority;
  reporterId?: number;
  deptId?: number;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createTime' | 'updateTime' | 'submittedAt';
  sortOrder?: 'asc' | 'desc';
  slaStatus?: string;
}

export interface ApprovalListQuery {
  page?: number;
  pageSize?: number;
  approvalLevel?: ApprovalLevel;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

// ---------------------------------------------------------------------------
// 响应类型 (Response DTOs)
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface WorkOrderListItem {
  id: number;
  workOrderNo: string;
  title: string;
  type?: WorkOrderType;
  priority?: WorkOrderPriority;
  status: WorkOrderStatus;
  version?: number;
  reporterName?: string;
  deptName?: string;
  currentApprovalLevel?: ApprovalLevel | null;
  createTime?: string;
  submittedAt?: string | null;
}

export interface ApprovalListItem {
  id: number;
  workOrderNo: string;
  title: string;
  type?: WorkOrderType;
  priority?: WorkOrderPriority;
  status: WorkOrderStatus;
  version?: number;
  reporterId?: number;
  reporterName?: string;
  deptName?: string;
  currentApprovalLevel: ApprovalLevel;
  submittedAt: string;
  pendingDuration: number;
}

export interface ApprovalActionResponse {
  [key: string]: unknown;
  orderId: number;
  newStatus: WorkOrderStatus;
  version?: number;
  approvalRecord: ApprovalRecord;
}

export interface WorkOrderDetailResponse {
  status?: WorkOrderStatus;
  title?: string;
  workOrderNo?: string;
  reporterName?: string;
  deptName?: string;
  priority?: WorkOrderPriority;
  createTime?: string;
  description?: string;
  version?: number;
  workOrder: WorkOrder;
  approvalRecords: ApprovalRecord[];
}

// ---------------------------------------------------------------------------
// 错误类型
// ---------------------------------------------------------------------------

export enum WorkOrderErrorCode {
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  OPTIMISTIC_LOCK_CONFLICT = 'OPTIMISTIC_LOCK_CONFLICT',
  REJECTION_REASON_REQUIRED = 'REJECTION_REASON_REQUIRED',
  REJECTION_REASON_TOO_LONG = 'REJECTION_REASON_TOO_LONG',
  WORK_ORDER_NOT_FOUND = 'WORK_ORDER_NOT_FOUND',
  APPROVAL_PERMISSION_DENIED = 'APPROVAL_PERMISSION_DENIED',
  WORK_ORDER_ALREADY_CANCELLED = 'WORK_ORDER_ALREADY_CANCELLED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export interface WorkOrderErrorResponse {
  statusCode: number;
  errorCode: WorkOrderErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// 审批工作台相关类型
// ---------------------------------------------------------------------------

export interface ApprovalDashboardStats {
  pendingLevel1Count: number;
  pendingLevel2Count: number;
  todayApprovedCount: number;
  todayRejectedCount: number;
}

export interface ApprovalFormData {
  action: ApprovalAction;
  comment: string;
  rejectionReason: string;
}

export interface ApprovalFormValidation {
  isValid: boolean;
  errors: ApprovalFormError[];
}

export interface ApprovalFormError {
  field: 'comment' | 'rejectionReason';
  message: string;
}

// ---------------------------------------------------------------------------
// 工单状态展示辅助类型
// ---------------------------------------------------------------------------

export interface WorkOrderStatusConfig {
  status: WorkOrderStatus;
  label: string;
  color: string;
  isTerminal: boolean;
  isApproving: boolean;
}

/**
 * 工单状态展示配置映射表。
 */
export const WORK_ORDER_STATUS_CONFIG: Partial<Record<WorkOrderStatus, WorkOrderStatusConfig>> = {
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
  [WorkOrderStatus.APPROVED]: {
    status: WorkOrderStatus.APPROVED,
    label: '已通过',
    color: 'var(--color-green-500)',
    isTerminal: false,
    isApproving: false,
  },
  [WorkOrderStatus.EXECUTING]: {
    status: WorkOrderStatus.EXECUTING,
    label: '执行中',
    color: 'var(--color-blue-600)',
    isTerminal: false,
    isApproving: false,
  },
  [WorkOrderStatus.ON_HOLD]: {
    status: WorkOrderStatus.ON_HOLD,
    label: '挂起中',
    color: 'var(--color-amber-500)',
    isTerminal: false,
    isApproving: false,
  },
  [WorkOrderStatus.COMPLETED]: {
    status: WorkOrderStatus.COMPLETED,
    label: '已完成',
    color: 'var(--color-green-600)',
    isTerminal: false,
    isApproving: false,
  },
  [WorkOrderStatus.PENDING_ACCEPTANCE]: {
    status: WorkOrderStatus.PENDING_ACCEPTANCE,
    label: '待验收',
    color: 'var(--color-purple-500)',
    isTerminal: false,
    isApproving: false,
  },
  [WorkOrderStatus.ACCEPTANCE_REJECTED]: {
    status: WorkOrderStatus.ACCEPTANCE_REJECTED,
    label: '验收驳回',
    color: 'var(--color-red-500)',
    isTerminal: false,
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

export type WorkOrderOperation = 'CREATE' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CANCEL' | 'EXECUTE' | 'COMPLETE' | 'HOLD' | 'RESUME' | 'SUBMIT_ACCEPTANCE' | 'ACCEPT' | 'REJECT_ACCEPTANCE' | string;
