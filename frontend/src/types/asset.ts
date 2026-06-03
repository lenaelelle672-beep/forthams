/**
 * @file types/asset.ts
 * @description 资产管理核心类型定义 — 权威版本
 *
 * 字段名与后端 Asset Entity + AssetController DTO 严格对齐：
 * - 状态枚举值与后端 AssetStatus 一一对应（7 个值）
 * - id 为 number（后端 Long）
 * - 字段名使用后端实际字段名（assetNo、assetName、deptId 等）
 *
 * @see backend/src/main/java/com/ams/model/Asset.java
 * @see backend/src/main/java/com/ams/dto/AssetCreateDTO.java
 */

import type { BaseEntity, BaseListQuery } from './common';

// ---------------------------------------------------------------------------
// 资产状态枚举 — 与后端 AssetStatus 严格对应
// ---------------------------------------------------------------------------

/**
 * 资产状态枚举（7 个值，与后端完全一致）。
 *
 * 后端同时接受部分别名（@JsonAlias）：
 * - ACTIVE / USING / USED / NORMAL → IN_USE
 * - SCRAP / DISPOSED → SCRAPPED
 */
export enum AssetStatus {
  /** 闲置 */
  IDLE = 'IDLE',
  /** 在用（别名：ACTIVE / NORMAL） */
  IN_USE = 'IN_USE',
  /** 维修中 */
  MAINTENANCE = 'MAINTENANCE',
  /** 待退役 */
  PENDING_RETIREMENT = 'PENDING_RETIREMENT',
  /** 已退役（终态） */
  RETIRED = 'RETIRED',
  /** 已报废（终态，别名：SCRAPPED） */
  SCRAPPED = 'SCRAPPED',
  /** 已清退（终态） */
  CLEARED = 'CLEARED',
}

/**
 * 资产状态 UI 展示配置。
 */
export const ASSET_STATUS_CONFIG: Record<
  AssetStatus,
  { label: string; color: string; bgColor: string }
> = {
  [AssetStatus.IN_USE]: {
    label: '在用',
    color: '#16a34a',
    bgColor: '#dcfce7',
  },
  [AssetStatus.IDLE]: {
    label: '闲置',
    color: '#2563eb',
    bgColor: '#dbeafe',
  },
  [AssetStatus.MAINTENANCE]: {
    label: '维修中',
    color: '#d97706',
    bgColor: '#fef3c7',
  },
  [AssetStatus.PENDING_RETIREMENT]: {
    label: '待退役',
    color: '#9333ea',
    bgColor: '#f3e8ff',
  },
  [AssetStatus.RETIRED]: {
    label: '已退役',
    color: '#6b7280',
    bgColor: '#f3f4f6',
  },
  [AssetStatus.SCRAPPED]: {
    label: '已报废',
    color: '#dc2626',
    bgColor: '#fee2e2',
  },
  [AssetStatus.CLEARED]: {
    label: '已清退',
    color: '#78716c',
    bgColor: '#f5f5f4',
  },
};

// ---------------------------------------------------------------------------
// 资产核心实体 — 对应后端 Asset Entity
// ---------------------------------------------------------------------------

/**
 * 资产实体（与后端字段名严格对齐）。
 */
export interface Asset extends BaseEntity {
  /** 资产编号（业务唯一标识，如 AST-2024-001） */
  assetNo: string;
  /** 旧组件使用的资产编号别名 */
  assetCode?: string;
  /** 旧组件使用的资产名称别名 */
  name?: string;
  /** 资产名称 */
  assetName: string;
  /** 分类 ID */
  categoryId: number;
  /** 分类名称（冗余展示） */
  categoryName?: string;
  /** ABC 分类: A-高价值, B-中价值, C-低价值, CATEGORY-分类规则 */
  abcClassification?: 'A' | 'B' | 'C' | 'CATEGORY' | null;
  /** 品牌/厂商 */
  brand?: string;
  /** 规格型号 */
  model?: string;
  /** 供应商 */
  supplier?: string;
  /** 序列号 */
  serialNo?: string;
  /** 原值（购置金额） */
  originalValue?: number;
  /** 当前净值 */
  currentValue?: number;
  /** 购置日期（ISO 8601 日期） */
  purchaseDate?: string;
  /** 保修期（月） */
  warrantyPeriod?: number;
  /** 折旧率 */
  depreciationRate?: number;
  /** 采购成本 */
  purchaseCost?: number;
  /** 折旧方法 */
  depreciationMethod?: string;
  /** 总预期工作量（UOP） */
  totalExpectedUnits?: number;
  /** 实际已工作量（UOP） */
  actualUnits?: number;
  /** 资产状态 */
  status: AssetStatus;
  /** 使用部门 ID */
  deptId?: number;
  /** 使用部门名称（冗余展示） */
  deptName?: string;
  /** 挂账人 ID */
  userId?: number;
  /** 挂账人姓名（冗余展示） */
  userName?: string;
  /** 存放地点 */
  location?: string;
  /** 存放地点展示名称 */
  locationName?: string;
  /** 采购价格 */
  purchasePrice?: number;
  /** 购置日期 */
  // purchaseDate removed - duplicate, see line 121
  /** 使用年限 */
  usefulLifeYears?: number;
  /** 残值 */
  salvageValue?: number;
  /** RFID 标签 */
  rfidTag?: string;
  /** 是否重要设备（0=否，1=是） */
  isImportant?: number;
  /** 描述 */
  description?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 资产列表项（精简版，用于列表展示）。
 */
export type AssetListItem = Pick<
  Asset,
  | 'id'
  | 'assetNo'
  | 'assetName'
  | 'categoryId'
  | 'categoryName'
  | 'brand'
  | 'model'
  | 'status'
  | 'deptId'
  | 'deptName'
  | 'userName'
  | 'location'
  | 'originalValue'
  | 'currentValue'
  | 'purchaseDate'
  | 'isImportant'
  | 'rfidTag'
  | 'createTime'
  | 'updateTime'
>;

// ---------------------------------------------------------------------------
// 资产分类
// ---------------------------------------------------------------------------

export interface AssetCategory {
  id: number;
  categoryName: string;
  categoryCode?: string;
  parentId?: number | null;
  children?: AssetCategory[];
  level?: number;
  sort?: number;
}

// ---------------------------------------------------------------------------
// 请求 DTO — 对应后端 AssetCreateDTO / AssetUpdateDTO
// ---------------------------------------------------------------------------

/**
 * 创建资产请求（字段与后端 AssetCreateDTO 对齐，支持 @JsonAlias）。
 */
export interface CreateAssetRequest {
  assetNo?: string;
  assetName: string;
  categoryId: number;
  brand?: string;
  model?: string;
  supplier?: string;
  serialNo?: string;
  originalValue?: number;
  currentValue?: number;
  purchaseDate?: string;
  warrantyPeriod?: number;
  depreciationRate?: number;
  status?: AssetStatus;
  deptId?: number;
  userId?: number;
  location?: string;
  rfidTag?: string;
  isImportant?: number;
  description?: string;
  remark?: string;
}

/**
 * 更新资产请求（id 必填，其余字段可选）。
 */
export interface UpdateAssetRequest extends Partial<CreateAssetRequest> {
  id: number;
}

// ---------------------------------------------------------------------------
// 查询参数 — 对应后端 AssetQueryDTO
// ---------------------------------------------------------------------------

export interface AssetListQuery extends BaseListQuery {
  /** 资产编号（精确/模糊） */
  assetNo?: string;
  /** 资产名称（模糊） */
  assetName?: string;
  /** 分类 ID */
  categoryId?: number;
  /** 资产状态（支持逗号分隔多值，如 "IDLE,IN_USE"） */
  status?: string;
  /** 部门 ID */
  deptId?: number;
  /** 是否重要设备 */
  isImportant?: number;
  /** 页码（兼容后端 page 字段） */
  page?: number;
  /** 每页条数（兼容后端 pageSize 字段） */
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// 折旧相关（资产详情页用）
// ---------------------------------------------------------------------------

export interface DepreciationScheduleItem {
  period: number;
  periodDate: string;
  beginValue: number;
  depreciation: number;
  accumulatedDepreciation: number;
  endValue: number;
}

// ---------------------------------------------------------------------------
// 仪表板统计 — 对应 DashboardStatsDTO
// ---------------------------------------------------------------------------

export interface DashboardStats {
  /** 总资产数 */
  totalAssets: number;
  /** 在用资产数 */
  inUseAssets: number;
  /** 闲置资产数 */
  idleAssets: number;
  /** 维修中资产数 */
  maintenanceAssets: number;
  /** 报废资产数 */
  scrapAssets: number;
  /** 资产总价值 */
  totalValue: number;
  /** 资产净值 */
  netValue: number;
  /** 按分类统计（分类名 → 数量） */
  categoryDistribution: Record<string, number>;
  /** 待审批数量 */
  pendingApprovals: number;
}

export interface AssetValueTrend {
  date: string;
  totalValue: number;
  netValue: number;
}

export interface DeptAssetDistribution {
  deptId: number;
  deptName: string;
  assetCount: number;
}


export type AssetDetail = Asset;
export type AssetQuery = BaseListQuery & { keyword?: string; status?: string; categoryId?: string | number };
export interface AssetListResponse { items: Asset[]; total: number; page?: number; pageSize?: number; records?: Asset[]; }

// ---------------------------------------------------------------------------
// 附件 — 对应后端 SysAttachment (businessType='ASSET')
// ---------------------------------------------------------------------------

/**
 * 资产附件（对应后端 SysAttachment 实体）。
 */
export interface AssetAttachment {
  id: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  uploadBy: number;
  createTime: string;
}

// ---------------------------------------------------------------------------
// 资产父子关系 — 对应后端 AssetParentChild
// ---------------------------------------------------------------------------

/**
 * 资产关系类型枚举（与后端 AssetRelationType 对应）。
 */
export enum AssetRelationType {
  /** 备件 */
  SPARE_PART = 'SPARE_PART',
  /** 配件/附件 */
  ACCESSORY = 'ACCESSORY',
  /** 升级件 */
  UPGRADE = 'UPGRADE',
  /** 附属物 */
  ATTACHMENT = 'ATTACHMENT',
  /** 其他 */
  OTHER = 'OTHER',
}

/**
 * 关系类型的中文标签配置。
 */
export const ASSET_RELATION_TYPE_LABELS: Record<AssetRelationType, string> = {
  [AssetRelationType.SPARE_PART]: '备件',
  [AssetRelationType.ACCESSORY]: '配件/附件',
  [AssetRelationType.UPGRADE]: '升级件',
  [AssetRelationType.ATTACHMENT]: '附属物',
  [AssetRelationType.OTHER]: '其他',
};

/**
 * 资产父子关系实体（对应后端 AssetParentChild）。
 */
export interface AssetParentChild {
  id: number;
  parentAssetId: number;
  childAssetId: number;
  relationType: AssetRelationType;
  quantity: number;
  remark?: string;
  createTime: string;
}

/**
 * 添加父子关系请求。
 */
export interface AddRelationRequest {
  parentAssetId: number;
  childAssetId: number;
  relationType: AssetRelationType;
  quantity?: number;
  remark?: string;
}

/**
 * 父子关系 VO（含资产名称等补充信息）。
 */
export interface RelationVO {
  relationId: number;
  parentAssetId: number;
  childAssetId: number;
  relationType: AssetRelationType;
  quantity: number;
  remark?: string;
  createTime?: string;
  childAssetName?: string;
  childAssetNo?: string;
  parentAssetName?: string;
  parentAssetNo?: string;
  children?: RelationVO[];
}

/**
 * 父子关系树节点。
 */
export interface RelationTreeNode {
  relationId: number;
  childAssetId: number;
  childAssetName?: string;
  childAssetNo?: string;
  relationType: AssetRelationType;
  quantity: number;
  remark?: string;
  children?: RelationTreeNode[];
}
