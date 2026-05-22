/**
 * 资产类型定义
 * @file asset.types.ts
 * @description 定义资产相关的类型系统，包括资产信息、审批状态、资产分类等
 * @module types/asset
 */

/**
 * 资产基础状态枚举
 * @enum {string}
 */
export enum AssetStatus {
  /** 正常 */
  NORMAL = 'NORMAL',
  /** 维修中 */
  MAINTENANCE = 'MAINTENANCE',
  /** 闲置 */
  IDLE = 'IDLE',
  /** 报废中 */
  RETIREMENT_PENDING = 'RETIREMENT_PENDING',
  /** 已报废 */
  RETIRED = 'RETIRED',
  /** 转让中 */
  TRANSFER_PENDING = 'TRANSFER_PENDING',
}

/**
 * 资产使用状态枚举
 * @enum {string}
 */
export enum AssetUsageStatus {
  /** 使用中 */
  IN_USE = 'IN_USE',
  /** 闲置可用 */
  IDLE_AVAILABLE = 'IDLE_AVAILABLE',
  /** 闲置待报废 */
  IDLE_PENDING_DISPOSAL = 'IDLE_PENDING_DISPOSAL',
  /** 已借出 */
  BORROWED = 'BORROWED',
  /** 维修中 */
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
}

/**
 * 资产分类节点
 * @interface AssetCategoryNode
 */
export interface AssetCategoryNode {
  /** 分类 ID */
  id: string;
  /** 分类名称 */
  name: string;
  /** 父分类 ID */
  parentId: string | null;
  /** 子分类列表 */
  children?: AssetCategoryNode[];
  /** 分类编码 */
  code?: string;
  /** 层级深度 */
  level?: number;
}

/**
 * 资产基础信息
 * @interface AssetBase
 */
export interface AssetBase {
  /** 资产 ID */
  id: string;
  /** 资产名称 */
  name: string;
  /** 资产编码 */
  assetCode: string;
  /** 资产分类 ID */
  categoryId: string;
  /** 资产分类名称 */
  categoryName?: string;
  /** 资产状态 */
  status: AssetStatus;
  /** 使用状态 */
  usageStatus: AssetUsageStatus;
  /** 购置日期 */
  purchaseDate: string;
  /** 购置金额 */
  purchaseAmount: number;
  /** 使用部门 ID */
  departmentId: string;
  /** 使用部门名称 */
  departmentName?: string;
  /** 使用人 ID */
  userId: string | null;
  /** 使用人名称 */
  userName?: string;
  /** 存放地点 */
  location: string;
  /** 品牌/厂商 */
  brand?: string;
  /** 规格型号 */
  model?: string;
  /** 序列号 */
  serialNumber?: string;
  /** 备注 */
  remark?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 资产详细信息（包含扩展属性）
 * @interface AssetDetail
 * @extends AssetBase
 */
export interface AssetDetail extends AssetBase {
  /** 扩展属性映射 */
  metadata?: Record<string, AssetMetadataValue>;
  /** 审批信息 */
  approvalInfo?: AssetApprovalInfo;
  /** 历史记录 */
  history?: AssetHistoryEntry[];
}

/**
 * 资产扩展属性值
 * @type {string | number | boolean | string[]}
 */
export type AssetMetadataValue = string | number | boolean | string[];

/**
 * 资产审批信息
 * @interface AssetApprovalInfo
 */
export interface AssetApprovalInfo {
  /** 当前审批状态 */
  approvalStatus: ApprovalStatus;
  /** 当前审批环节 */
  currentStep: number;
  /** 审批环节总数 */
  totalSteps: number;
  /** 审批人 ID */
  approverId: string;
  /** 审批人名称 */
  approverName: string;
  /** 审批截止时间 */
  deadline?: string;
  /** 审批意见 */
  comment?: string;
}

/**
 * 审批状态枚举
 * @enum {string}
 */
export enum ApprovalStatus {
  /** 待提交 */
  DRAFT = 'DRAFT',
  /** 审批中 */
  PENDING = 'PENDING',
  /** 审批通过 */
  APPROVED = 'APPROVED',
  /** 审批拒绝 */
  REJECTED = 'REJECTED',
  /** 已撤回 */
  WITHDRAWN = 'WITHDRAWN',
  /** 已过期 */
  EXPIRED = 'EXPIRED',
}

/**
 * 资产历史记录条目
 * @interface AssetHistoryEntry
 */
export interface AssetHistoryEntry {
  /** 历史记录 ID */
  id: string;
  /** 资产 ID */
  assetId: string;
  /** 操作类型 */
  action: AssetHistoryAction;
  /** 操作描述 */
  description: string;
  /** 操作人 ID */
  operatorId: string;
  /** 操作人名称 */
  operatorName: string;
  /** 操作时间 */
  operatedAt: string;
  /** 变更详情 */
  changes?: AssetFieldChange[];
}

/**
 * 资产历史操作类型
 * @enum {string}
 */
export enum AssetHistoryAction {
  /** 创建 */
  CREATED = 'CREATED',
  /** 更新 */
  UPDATED = 'UPDATED',
  /** 报废申请 */
  RETIREMENT_REQUESTED = 'RETIREMENT_REQUESTED',
  /** 报废审批通过 */
  RETIREMENT_APPROVED = 'RETIREMENT_APPROVED',
  /** 报废审批拒绝 */
  RETIREMENT_REJECTED = 'RETIREMENT_REJECTED',
  /** 转让申请 */
  TRANSFER_REQUESTED = 'TRANSFER_REQUESTED',
  /** 转让审批通过 */
  TRANSFER_APPROVED = 'TRANSFER_APPROVED',
  /** 转让审批拒绝 */
  TRANSFER_REJECTED = 'TRANSFER_REJECTED',
  /** 维修申请 */
  MAINTENANCE_REQUESTED = 'MAINTENANCE_REQUESTED',
  /** 维修完成 */
  MAINTENANCE_COMPLETED = 'MAINTENANCE_COMPLETED',
}

/**
 * 资产字段变更记录
 * @interface AssetFieldChange
 */
export interface AssetFieldChange {
  /** 字段名称 */
  field: string;
  /** 字段显示名称 */
  fieldLabel: string;
  /** 变更前值 */
  oldValue: string;
  /** 变更后值 */
  newValue: string;
}

/**
 * 资产查询参数
 * @interface AssetQueryParams
 */
export interface AssetQueryParams {
  /** 关键词搜索 */
  keyword?: string;
  /** 资产状态 */
  status?: AssetStatus | AssetStatus[];
  /** 使用状态 */
  usageStatus?: AssetUsageStatus | AssetUsageStatus[];
  /** 分类 ID */
  categoryId?: string;
  /** 部门 ID */
  departmentId?: string;
  /** 购置日期开始 */
  purchaseDateStart?: string;
  /** 购置日期结束 */
  purchaseDateEnd?: string;
  /** 金额范围最小值 */
  amountMin?: number;
  /** 金额范围最大值 */
  amountMax?: number;
  /** 页码 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 排序字段 */
  sortField?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 分页响应 — 保留 items[] 字段以兼容本模块代码。
 * 其他模块请使用 types/common.ts 中的 PaginatedResponse<T>（使用 records[]）。
 * @interface PaginatedResponse
 * @template T
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  items: T[];
  /** 总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
}

/**
 * 资产创建请求
 * @interface AssetCreateRequest
 */
export interface AssetCreateRequest {
  /** 资产名称 */
  name: string;
  /** 资产分类 ID */
  categoryId: string;
  /** 购置日期 */
  purchaseDate: string;
  /** 购置金额 */
  purchaseAmount: number;
  /** 使用部门 ID */
  departmentId: string;
  /** 使用人 ID */
  userId?: string;
  /** 存放地点 */
  location: string;
  /** 品牌/厂商 */
  brand?: string;
  /** 规格型号 */
  model?: string;
  /** 序列号 */
  serialNumber?: string;
  /** 备注 */
  remark?: string;
  /** 扩展属性 */
  metadata?: Record<string, AssetMetadataValue>;
}

/**
 * 资产更新请求
 * @interface AssetUpdateRequest
 * @extends Partial<AssetCreateRequest>
 */
export interface AssetUpdateRequest extends Partial<AssetCreateRequest> {
  /** 资产 ID */
  id: string;
}

/**
 * 资产统计信息
 * @interface AssetStatistics
 */
export interface AssetStatistics {
  /** 总资产数 */
  totalCount: number;
  /** 总资产金额 */
  totalAmount: number;
  /** 正常资产数 */
  normalCount: number;
  /** 维修中资产数 */
  maintenanceCount: number;
  /** 闲置资产数 */
  idleCount: number;
  /** 报废中资产数 */
  retirementPendingCount: number;
  /** 已报废资产数 */
  retiredCount: number;
}