/**
 * 资产报废退役流程类型定义
 * @module retirement.types
 * @description 定义资产报废退役流程中的数据结构、状态枚举和API接口类型
 */

/**
 * 退役申请状态枚举
 */
export enum RetirementStatus {
  /** 草稿状态 - 申请已创建但未提交 */
  DRAFT = 'draft',
  /** 待审批 - 申请已提交，等待审批 */
  PENDING = 'pending',
  /** 审批中 - 正在审批流程中 */
  IN_APPROVAL = 'in_approval',
  /** 已批准 - 审批通过，等待执行 */
  APPROVED = 'approved',
  /** 已拒绝 - 审批未通过 */
  REJECTED = 'rejected',
  /** 执行中 - 正在执行退役操作 */
  EXECUTING = 'executing',
  /** 已完成 - 退役流程已完成 */
  COMPLETED = 'completed',
  /** 已取消 - 申请被撤销 */
  CANCELLED = 'cancelled'
}

/**
 * 资产状态枚举（与退役相关的状态）
 */
export enum AssetRetirementState {
  /** 正常状态 */
  ACTIVE = 'active',
  /** 闲置状态 */
  IDLE = 'idle',
  /** 退役中 */
  RETIRING = 'retiring',
  /** 已退役 */
  RETIRED = 'retired',
  /** 已报废 */
  SCRAPPED = 'scrapped'
}

/**
 * 审批动作枚举
 */
export enum ApprovalAction {
  /** 批准 */
  APPROVE = 'approve',
  /** 拒绝 */
  REJECT = 'reject',
  /** 退回 */
  RETURN = 'return',
  /** 转交 */
  DELEGATE = 'delegate',
  /** 评论 */
  COMMENT = 'comment'
}

/**
 * 审批节点类型
 */
export enum ApprovalNodeType {
  /** 发起人自审批 */
  INITIATOR = 'initiator',
  /** 部门经理审批 */
  DEPARTMENT_MANAGER = 'department_manager',
  /** 资产管理员审批 */
  ASSET_ADMIN = 'asset_admin',
  /** 财务审批 */
  FINANCE = 'finance',
  /** 最终审批 */
  FINAL = 'final'
}

/**
 * 审批节点状态
 */
export enum ApprovalNodeStatus {
  /** 待处理 */
  PENDING = 'pending',
  /** 已通过 */
  APPROVED = 'approved',
  /** 已拒绝 */
  REJECTED = 'rejected',
  /** 已跳过 */
  SKIPPED = 'skipped',
  /** 已超时 */
  TIMEOUT = 'timeout'
}

/**
 * 附件类型
 */
export enum AttachmentType {
  /** 图片 */
  IMAGE = 'image',
  /** 文档 */
  DOCUMENT = 'document',
  /** 视频 */
  VIDEO = 'video',
  /** 其他 */
  OTHER = 'other'
}

/**
 * 退役原因类型
 */
export enum RetirementReasonType {
  /** 正常报废 */
  NORMAL_SCRAP = 'normal_scrap',
  /** 损坏报废 */
  DAMAGE_SCRAP = 'damage_scrap',
  /** 过期报废 */
  EXPIRED_SCRAP = 'expired_scrap',
  /** 捐赠 */
  DONATION = 'donation',
  /** 转让 */
  TRANSFER = 'transfer',
  /** 其他 */
  OTHER = 'other'
}

/**
 * 附件信息
 */
export interface Attachment {
  /** 附件ID */
  id: string;
  /** 文件名 */
  filename: string;
  /** 文件大小（字节） */
  size: number;
  /** MIME类型 */
  mimeType: string;
  /** 附件类型 */
  type: AttachmentType;
  /** 上传时间 */
  uploadedAt: string;
  /** 上传人ID */
  uploadedBy: string;
  /** 文件URL */
  url: string;
  /** 缩略图URL（可选） */
  thumbnailUrl?: string;
}

/**
 * 审批人信息
 */
export interface ApproverInfo {
  /** 审批人ID */
  userId: string;
  /** 审批人姓名 */
  username: string;
  /** 审批人部门 */
  department: string;
  /** 审批人角色 */
  role: string;
  /** 审批人邮箱 */
  email?: string;
  /** 审批人头像URL */
  avatarUrl?: string;
}

/**
 * 审批节点
 */
export interface ApprovalNode {
  /** 节点ID */
  id: string;
  /** 节点类型 */
  type: ApprovalNodeType;
  /** 审批人信息 */
  approver: ApproverInfo;
  /** 节点状态 */
  status: ApprovalNodeStatus;
  /** 审批时间 */
  actionTime?: string;
  /** 审批意见 */
  comment?: string;
  /** 顺序 */
  order: number;
}

/**
 * 审批链
 */
export interface ApprovalChain {
  /** 审批链ID */
  id: string;
  /** 关联的退役申请ID */
  retirementId: string;
  /** 审批节点列表 */
  nodes: ApprovalNode[];
  /** 当前节点索引 */
  currentNodeIndex: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 退役历史记录
 */
export interface RetirementHistory {
  /** 历史记录ID */
  id: string;
  /** 退役申请ID */
  retirementId: string;
  /** 操作类型 */
  action: string;
  /** 操作前状态 */
  fromStatus: RetirementStatus;
  /** 操作后状态 */
  toStatus: RetirementStatus;
  /** 操作人ID */
  operatorId: string;
  /** 操作人姓名 */
  operatorName: string;
  /** 操作时间 */
  operatedAt: string;
  /** 操作备注 */
  remark?: string;
  /** 关联的审批记录ID */
  approvalRecordId?: string;
}

/**
 * 资产残值评估
 */
export interface ResidualValueAssessment {
  /** 资产ID */
  assetId: string;
  /** 资产名称 */
  assetName: string;
  /** 原始价值 */
  originalValue: number;
  /** 累计折旧 */
  accumulatedDepreciation: number;
  /** 账面价值 */
  netBookValue: number;
  /** 评估残值 */
  estimatedResidualValue: number;
  /** 评估方式 */
  assessmentMethod: string;
  /** 评估人 */
  assessor: string;
  /** 评估时间 */
  assessedAt: string;
}

/**
 * 退役处置信息
 */
export interface DisposalInfo {
  /** 处置方式 */
  disposalMethod: 'scrapping' | 'donation' | 'transfer' | 'sale' | 'recycling';
  /** 处置价格（如果有） */
  disposalValue?: number;
  /** 处置时间 */
  disposalDate?: string;
  /** 处置机构 */
  disposalOrganization?: string;
  /** 处置证明 */
  disposalProof?: string;
}

/**
 * 退役申请请求体
 */
export interface RetirementApplicationRequest {
  /** 资产ID */
  assetId: string;
  /** 退役原因类型 */
  reasonType: RetirementReasonType;
  /** 退役原因描述 */
  reason: string;
  /** 预期退役日期 */
  expectedRetirementDate: string;
  /** 残值评估 */
  residualValueAssessment?: ResidualValueAssessment;
  /** 附件列表 */
  attachments?: Attachment[];
  /** 备注 */
  remark?: string;
}

/**
 * 退役申请响应体
 */
export interface RetirementApplicationResponse {
  /** 申请ID */
  id: string;
  /** 资产ID */
  assetId: string;
  /** 资产名称 */
  assetName: string;
  /** 资产编号 */
  assetCode: string;
  /** 申请状态 */
  status: RetirementStatus;
  /** 退役原因类型 */
  reasonType: RetirementReasonType;
  /** 退役原因描述 */
  reason: string;
  /** 预期退役日期 */
  expectedRetirementDate: string;
  /** 实际退役日期 */
  actualRetirementDate?: string;
  /** 残值评估 */
  residualValueAssessment?: ResidualValueAssessment;
  /** 审批链 */
  approvalChain?: ApprovalChain;
  /** 附件列表 */
  attachments?: Attachment[];
  /** 历史记录 */
  history?: RetirementHistory[];
  /** 处置信息 */
  disposalInfo?: DisposalInfo;
  /** 申请人ID */
  applicantId: string;
  /** 申请人姓名 */
  applicantName: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 审批操作请求体
 */
export interface ApprovalActionRequest {
  /** 退役申请ID */
  retirementId: string;
  /** 审批动作 */
  action: ApprovalAction;
  /** 审批意见 */
  comment?: string;
  /** 转交给谁（仅在转交时使用） */
  delegateTo?: string;
  /** 附件（可选） */
  attachments?: Attachment[];
}

/**
 * 审批操作响应体
 */
export interface ApprovalActionResponse {
  /** 是否成功 */
  success: boolean;
  /** 消息 */
  message: string;
  /** 更新后的申请状态 */
  newStatus?: RetirementStatus;
  /** 审批链信息 */
  approvalChain?: ApprovalChain;
  /** 操作时间 */
  actionTime: string;
}

/**
 * 退役申请列表查询参数
 */
export interface RetirementListQueryParams {
  /** 状态筛选 */
  status?: RetirementStatus | RetirementStatus[];
  /** 资产ID */
  assetId?: string;
  /** 申请人ID */
  applicantId?: string;
  /** 开始日期 */
  startDate?: string;
  /** 结束日期 */
  endDate?: string;
  /** 关键词搜索 */
  keyword?: string;
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
 * 退役申请列表响应体
 */
export interface RetirementListResponse {
  /** 总数 */
  total: number;
  /** 当前页数据 */
  items: RetirementApplicationResponse[];
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
}

/**
 * 退役申请统计
 */
export interface RetirementStatistics {
  /** 待审批数量 */
  pendingCount: number;
  /** 审批中数量 */
  inApprovalCount: number;
  /** 已批准数量 */
  approvedCount: number;
  /** 已拒绝数量 */
  rejectedCount: number;
  /** 已完成数量 */
  completedCount: number;
  /** 本月退役资产数量 */
  monthlyRetiredCount: number;
  /** 本月退役资产价值 */
  monthlyRetiredValue: number;
}

/**
 * 批量退役请求
 */
export interface BatchRetirementRequest {
  /** 资产ID列表 */
  assetIds: string[];
  /** 退役原因类型 */
  reasonType: RetirementReasonType;
  /** 退役原因描述 */
  reason: string;
  /** 预期退役日期 */
  expectedRetirementDate: string;
  /** 备注 */
  remark?: string;
}

/**
 * 批量退役响应
 */
export interface BatchRetirementResponse {
  /** 成功数量 */
  successCount: number;
  /** 失败数量 */
  failedCount: number;
  /** 失败的资产ID及原因 */
  failures: Array<{
    assetId: string;
    reason: string;
  }>;
  /** 成功创建的申请列表 */
  applications: RetirementApplicationResponse[];
}

/**
 * 退役流程状态转换记录
 */
export interface RetirementStateTransition {
  /** 转换ID */
  id: string;
  /** 申请ID */
  retirementId: string;
  /** 源状态 */
  fromState: RetirementStatus;
  /** 目标状态 */
  toState: RetirementStatus;
  /** 触发者 */
  triggeredBy: string;
  /** 触发时间 */
  triggeredAt: string;
  /** 转换原因 */
  reason?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 退役申请详情
 */
export interface RetirementDetail extends RetirementApplicationResponse {
  /** 资产信息 */
  assetInfo?: {
    id: string;
    name: string;
    code: string;
    category: string;
    purchaseDate: string;
    originalValue: number;
    currentValue: number;
    location: string;
    custodian: string;
  };
  /** 折旧信息 */
  depreciationInfo?: {
    method: string;
    totalDepreciation: number;
    monthlyDepreciation: number;
    netBookValue: number;
  };
  /** 相关工单 */
  relatedWorkOrders?: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
}

/**
 * 导出退役记录参数
 */
export interface ExportRetirementParams {
  /** 开始日期 */
  startDate: string;
  /** 结束日期 */
  endDate: string;
  /** 状态筛选 */
  status?: RetirementStatus[];
  /** 导出格式 */
  format: 'excel' | 'csv' | 'pdf';
  /** 包含字段 */
  fields?: string[];
}

/**
 * 退休申请表单数据
 */
export interface RetirementFormData {
  /** 资产ID */
  assetId: string;
  /** 退役原因类型 */
  reasonType: RetirementReasonType;
  /** 退役原因描述 */
  reason: string;
  /** 预期退役日期 */
  expectedRetirementDate: string;
  /** 附件 */
  attachments: File[];
  /** 备注 */
  remark?: string;
  /** 残值评估信息 */
  residualValue?: number;
  /** 评估方式 */
  assessmentMethod?: string;
}

/**
 * 状态变更通知
 */
export interface RetirementStatusNotification {
  /** 通知ID */
  id: string;
  /** 退役申请ID */
  retirementId: string;
  /** 通知类型 */
  type: 'status_change' | 'approval_required' | 'approval_result' | 'comment_added';
  /** 标题 */
  title: string;
  /** 内容 */
  content: string;
  /** 关联用户 */
  relatedUsers: string[];
  /** 创建时间 */
  createdAt: string;
  /** 是否已读 */
  isRead: boolean;
}