/**
 * Asset Retirement Types
 * 资产报废退役流程类型定义
 * 
 * @description
 * 定义资产报废退役流程中的核心类型，包括：
 * - 退役申请状态
 * - 审批流程状态
 * - 历史记录结构
 * - API 请求/响应类型
 * 
 * @module retirement.types
 * @version SWARM-002 Iteration 8
 */

import type { Asset } from '@/app/types/asset.types';
import type { ApprovalRecord, ApprovalStatus } from '@/app/types/approval';

// ============================================================
// 状态枚举
// ============================================================

/**
 * 资产退役状态枚举
 * 
 * @description
 * 定义资产从在用到报废的完整生命周期状态
 */
export enum RetirementStatus {
  /** 草稿状态 - 申请尚未提交 */
  DRAFT = 'DRAFT',
  /** 待审批 - 申请已提交，等待审批 */
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  /** 审批中 - 审批流程正在进行 */
  APPROVAL_IN_PROGRESS = 'APPROVAL_IN_PROGRESS',
  /** 已批准 - 退役申请获批 */
  APPROVED = 'APPROVED',
  /** 已拒绝 - 退役申请被拒绝 */
  REJECTED = 'REJECTED',
  /** 已取消 - 申请人主动取消申请 */
  CANCELLED = 'CANCELLED',
  /** 执行中 - 退役流程正在执行 */
  IN_PROGRESS = 'IN_PROGRESS',
  /** 已完成 - 资产已完成退役 */
  COMPLETED = 'COMPLETED',
  /** 已归档 - 退役记录已归档 */
  ARCHIVED = 'ARCHIVED'
}

/**
 * 退役原因类型枚举
 */
export enum RetirementReason {
  /** 超过使用年限 */
  OVER_USAGE_LIFE = 'OVER_USAGE_LIFE',
  /** 损坏无法修复 */
  DAMAGE_UNREPAIRABLE = 'DAMAGE_UNREPAIRABLE',
  /** 技术更新换代 */
  TECHNICAL_OBSOLESCENCE = 'TECHNICAL_OBSOLESCENCE',
  /** 资产闲置 */
  IDLE_ASSET = 'IDLE_ASSET',
  /** 业务变更 */
  BUSINESS_CHANGE = 'BUSINESS_CHANGE',
  /** 其他原因 */
  OTHER = 'OTHER'
}

/**
 * 资产处置方式枚举
 */
export enum DisposalMethod {
  /** 报废处理 */
  SCRAP = 'SCRAP',
  /** 转让 */
  TRANSFER = 'TRANSFER',
  /** 捐赠 */
  DONATION = 'DONATION',
  /** 回收 */
  RECYCLING = 'RECYCLING',
  /** 销毁 */
  DESTROY = 'DESTROY'
}

// ============================================================
// 基础类型定义
// ============================================================

/**
 * 资产状态变更记录
 */
export interface AssetStatusChange {
  /** 资产ID */
  assetId: string;
  /** 原状态 */
  previousStatus: string;
  /** 新状态 */
  newStatus: string;
  /** 变更原因 */
  reason: string;
  /** 变更时间 */
  changedAt: Date;
  /** 变更人ID */
  changedBy: string;
  /** 变更人姓名 */
  changedByName?: string;
}

/**
 * 审批节点信息
 */
export interface ApprovalNode {
  /** 节点ID */
  nodeId: string;
  /** 节点名称 */
  nodeName: string;
  /** 审批人ID */
  approverId: string;
  /** 审批人姓名 */
  approverName: string;
  /** 节点顺序 */
  order: number;
  /** 是否必须审批 */
  required: boolean;
  /** 审批意见 */
  comment?: string;
  /** 审批时间 */
  approvedAt?: Date;
  /** 审批状态 */
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
}

/**
 * 退役历史记录
 */
export interface RetirementHistory {
  /** 记录ID */
  id: string;
  /** 退役申请ID */
  retirementId: string;
  /** 操作类型 */
  action: RetirementAction;
  /** 操作人ID */
  operatorId: string;
  /** 操作人姓名 */
  operatorName: string;
  /** 操作时间 */
  operatedAt: Date;
  /** 操作描述 */
  description: string;
  /** 操作前状态 */
  previousStatus?: RetirementStatus;
  /** 操作后状态 */
  newStatus?: RetirementStatus;
  /** 附加数据（JSON格式） */
  metadata?: Record<string, unknown>;
}

/**
 * 退役操作类型枚举
 */
export enum RetirementAction {
  /** 创建申请 */
  CREATE = 'CREATE',
  /** 提交申请 */
  SUBMIT = 'SUBMIT',
  /** 审批通过 */
  APPROVE = 'APPROVE',
  /** 审批拒绝 */
  REJECT = 'REJECT',
  /** 取消申请 */
  CANCEL = 'CANCEL',
  /** 开始执行 */
  START_EXECUTION = 'START_EXECUTION',
  /** 完成执行 */
  COMPLETE_EXECUTION = 'COMPLETE_EXECUTION',
  /** 归档 */
  ARCHIVE = 'ARCHIVE',
  /** 修改 */
  MODIFY = 'MODIFY',
  /** 撤回 */
  WITHDRAW = 'WITHDRAW'
}

// ============================================================
// 退役申请相关类型
// ============================================================

/**
 * 资产退役申请
 */
export interface RetirementApplication {
  /** 申请ID */
  id: string;
  /** 资产ID */
  assetId: string;
  /** 资产信息 */
  asset?: Asset;
  /** 申请状态 */
  status: RetirementStatus;
  /** 退役原因 */
  reason: RetirementReason;
  /** 退役原因描述 */
  reasonDescription?: string;
  /** 处置方式 */
  disposalMethod: DisposalMethod;
  /** 申请人ID */
  applicantId: string;
  /** 申请人姓名 */
  applicantName: string;
  /** 申请时间 */
  appliedAt: Date;
  /** 预计退役日期 */
  expectedRetirementDate?: Date;
  /** 实际退役日期 */
  actualRetirementDate?: Date;
  /** 预估残值 */
  estimatedResidualValue?: number;
  /** 账面净值 */
  bookValue?: number;
  /** 审批链ID */
  approvalChainId?: string;
  /** 审批节点列表 */
  approvalNodes?: ApprovalNode[];
  /** 当前审批节点 */
  currentApprovalNode?: ApprovalNode;
  /** 历史记录 */
  history?: RetirementHistory[];
  /** 备注 */
  remark?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 创建退役申请请求
 */
export interface CreateRetirementRequest {
  /** 资产ID */
  assetId: string;
  /** 退役原因 */
  reason: RetirementReason;
  /** 退役原因描述 */
  reasonDescription?: string;
  /** 处置方式 */
  disposalMethod: DisposalMethod;
  /** 预计退役日期 */
  expectedRetirementDate?: string;
  /** 预估残值 */
  estimatedResidualValue?: number;
  /** 备注 */
  remark?: string;
}

/**
 * 更新退役申请请求
 */
export interface UpdateRetirementRequest {
  /** 退役原因 */
  reason?: RetirementReason;
  /** 退役原因描述 */
  reasonDescription?: string;
  /** 处置方式 */
  disposalMethod?: DisposalMethod;
  /** 预计退役日期 */
  expectedRetirementDate?: string;
  /** 预估残值 */
  estimatedResidualValue?: number;
  /** 备注 */
  remark?: string;
}

/**
 * 提交退役申请请求
 */
export interface SubmitRetirementRequest {
  /** 申请ID */
  retirementId: string;
  /** 是否需要审批 */
  requireApproval?: boolean;
}

/**
 * 审批退役申请请求
 */
export interface ApproveRetirementRequest {
  /** 申请ID */
  retirementId: string;
  /** 审批意见 */
  comment?: string;
  /** 是否通过 */
  approved: boolean;
}

/**
 * 取消退役申请请求
 */
export interface CancelRetirementRequest {
  /** 申请ID */
  retirementId: string;
  /** 取消原因 */
  cancelReason?: string;
}

// ============================================================
// 查询与响应类型
// ============================================================

/**
 * 退役申请查询参数
 */
export interface RetirementQueryParams {
  /** 状态筛选 */
  status?: RetirementStatus | RetirementStatus[];
  /** 资产ID */
  assetId?: string;
  /** 申请人ID */
  applicantId?: string;
  /** 退役原因 */
  reason?: RetirementReason;
  /** 开始日期 */
  startDate?: string;
  /** 结束日期 */
  endDate?: string;
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 排序字段 */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 退役申请列表响应
 */
export interface RetirementListResponse {
  /** 申请列表 */
  items: RetirementApplication[];
  /** 总数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
}

/**
 * 退役申请详情响应
 */
export interface RetirementDetailResponse {
  /** 申请详情 */
  application: RetirementApplication;
  /** 审批历史 */
  approvalHistory: ApprovalRecord[];
  /** 操作历史 */
  operationHistory: RetirementHistory[];
  /** 资产变更历史 */
  assetStatusHistory: AssetStatusChange[];
}

// ============================================================
// 状态转换相关类型
// ============================================================

/**
 * 有效状态转换映射
 */
export const VALID_TRANSITIONS: Record<RetirementStatus, RetirementStatus[]> = {
  [RetirementStatus.DRAFT]: [RetirementStatus.PENDING_APPROVAL, RetirementStatus.CANCELLED],
  [RetirementStatus.PENDING_APPROVAL]: [RetirementStatus.APPROVAL_IN_PROGRESS, RetirementStatus.CANCELLED],
  [RetirementStatus.APPROVAL_IN_PROGRESS]: [RetirementStatus.APPROVED, RetirementStatus.REJECTED],
  [RetirementStatus.APPROVED]: [RetirementStatus.IN_PROGRESS, RetirementStatus.CANCELLED],
  [RetirementStatus.REJECTED]: [RetirementStatus.DRAFT, RetirementStatus.CANCELLED],
  [RetirementStatus.CANCELLED]: [],
  [RetirementStatus.IN_PROGRESS]: [RetirementStatus.COMPLETED],
  [RetirementStatus.COMPLETED]: [RetirementStatus.ARCHIVED],
  [RetirementStatus.ARCHIVED]: []
};

/**
 * 状态转换守卫检查结果
 */
export interface TransitionGuardResult {
  /** 是否允许转换 */
  allowed: boolean;
  /** 错误消息 */
  errorMessage?: string;
  /** 需要的额外条件 */
  requiredConditions?: string[];
}

/**
 * 状态转换日志
 */
export interface TransitionLog {
  /** 资产ID */
  assetId: string;
  /** 申请ID */
  retirementId?: string;
  /** 源状态 */
  fromState: RetirementStatus;
  /** 目标状态 */
  toState: RetirementStatus;
  /** 转换时间 */
  timestamp: Date;
  /** 转换原因 */
  reason: string;
  /** 触发者 */
  triggeredBy: string;
  /** 附加数据 */
  extra?: Record<string, unknown>;
}

// ============================================================
// 统计与报表类型
// ============================================================

/**
 * 退役统计汇总
 */
export interface RetirementStatistics {
  /** 待审批数量 */
  pendingApproval: number;
  /** 审批中数量 */
  inApproval: number;
  /** 已批准数量 */
  approved: number;
  /** 已拒绝数量 */
  rejected: number;
  /** 执行中数量 */
  inProgress: number;
  /** 已完成数量 */
  completed: number;
  /** 本月退役资产数量 */
  monthlyCompleted: number;
  /** 本月退役资产价值 */
  monthlyValue: number;
  /** 累计退役资产数量 */
  totalCompleted: number;
  /** 累计退役资产价值 */
  totalValue: number;
}

/**
 * 退役趋势数据点
 */
export interface RetirementTrendPoint {
  /** 日期 */
  date: string;
  /** 申请数量 */
  applicationCount: number;
  /** 完成数量 */
  completedCount: number;
  /** 拒绝数量 */
  rejectedCount: number;
}

// ============================================================
// 辅助类型
// ============================================================

/**
 * 退役申请表单数据
 */
export interface RetirementFormData {
  /** 资产ID */
  assetId: string;
  /** 退役原因 */
  reason: RetirementReason;
  /** 退役原因描述 */
  reasonDescription: string;
  /** 处置方式 */
  disposalMethod: DisposalMethod;
  /** 预计退役日期 */
  expectedRetirementDate: string;
  /** 预估残值 */
  estimatedResidualValue: number;
  /** 备注 */
  remark: string;
}

/**
 * 表单验证错误
 */
export interface ValidationError {
  /** 字段名 */
  field: string;
  /** 错误消息 */
  message: string;
}

/**
 * 批量退役操作请求
 */
export interface BatchRetirementRequest {
  /** 资产ID列表 */
  assetIds: string[];
  /** 退役原因 */
  reason: RetirementReason;
  /** 处置方式 */
  disposalMethod: DisposalMethod;
  /** 备注 */
  remark?: string;
}

/**
 * 批量退役操作结果
 */
export interface BatchRetirementResult {
  /** 成功数量 */
  successCount: number;
  /** 失败数量 */
  failedCount: number;
  /** 失败项详情 */
  failures: Array<{
    assetId: string;
    error: string;
  }>;
}

// ============================================================
// 状态机相关类型
// ============================================================

/**
 * 状态机配置
 */
export interface RetirementStateMachineConfig {
  /** 初始状态 */
  initialState: RetirementStatus;
  /** 有效状态列表 */
  validStates: RetirementStatus[];
  /** 转换规则 */
  transitions: Array<{
    from: RetirementStatus;
    to: RetirementStatus;
    action: RetirementAction;
    guard?: string;
  }>;
  /** 状态处理器 */
  handlers: Record<RetirementStatus, string>;
}

/**
 * 状态转换请求
 */
export interface StateTransitionRequest {
  /** 当前状态 */
  currentState: RetirementStatus;
  /** 目标状态 */
  targetState: RetirementStatus;
  /** 操作人ID */
  operatorId: string;
  /** 上下文数据 */
  context: Record<string, unknown>;
}

/**
 * 状态转换响应
 */
export interface StateTransitionResponse {
  /** 是否成功 */
  success: boolean;
  /** 新状态 */
  newState?: RetirementStatus;
  /** 消息 */
  message?: string;
  /** 触发的事件 */
  events?: string[];
}