/**
 * @file frontend/src/types/inventory.types.ts
 * @description 资产盘点管理模块 — TypeScript 类型定义 (SWARM-P3-010-FE)
 *
 * 涵盖盘点任务、资产清单、盘盈盘亏汇总、请求/响应载荷等全部数据契约。
 * 所有字段命名与后端 API 契约及 SPEC 数据约束表严格对齐。
 */

// ============================================================================
// 枚举 / 联合类型
// ============================================================================

/** 盘点范围类型 — 控制新建任务时按位置、按分类还是全部资产 */
export type ScopeType = 'location' | 'category' | 'all';

/**
 * 盘点任务状态
 * - draft      草稿：已创建但尚未开始
 * - in_progress 进行中：正在执行实地盘点
 * - completed  已完成：盘点结束，可查看差异
 * - submitted  已提交：已提交核准，不可逆
 */
export type InventoryTaskStatus =
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'submitted';

/**
 * 实盘状态 — 逐条/批量确认时使用
 * - normal   正常（账实相符）
 * - surplus  盘盈
 * - deficit  盘亏
 * - damaged  损坏
 * - other    其他
 */
export type ActualStatus = 'normal' | 'surplus' | 'deficit' | 'damaged' | 'other';

// ============================================================================
// 核心实体
// ============================================================================

/**
 * 盘点任务 — 对应 GET /api/v1/inventory/tasks 返回的单条记录
 */
export interface InventoryTask {
  /** 盘点任务唯一标识 (UUID) */
  taskId: string;
  /** 任务名称，1-50 字符，必填 */
  taskName: string;
  /** 盘点范围类型 */
  scopeType: ScopeType;
  /** 位置/分类 ID 列表；scopeType 非 'all' 时必填且长度 ≥ 1 */
  scopeIds: string[];
  /** 任务状态 */
  status: InventoryTaskStatus;
  /** 进度百分比 0-100，保留 1 位小数 */
  progress: number;
  /** 总资产数 */
  totalAssets: number;
  /** 已盘数 */
  countedAssets: number;
  /** 未盘数 */
  uncountedAssets: number;
  /** 盘盈数 */
  surplusAssets: number;
  /** 盘亏数 */
  deficitAssets: number;
  /** 创建时间 (ISO 8601) */
  createdAt: string;
  /** 更新时间 (ISO 8601) */
  updatedAt: string;
}

/**
 * 盘点资产 — 对应 GET /api/v1/inventory/tasks/:taskId/assets 返回的单条记录
 */
export interface InventoryAsset {
  /** 资产唯一标识 */
  assetId: string;
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 分类名称（冗余展示） */
  categoryName?: string;
  /** 位置路径展示（如：总部/研发中心/3F） */
  locationPath?: string;
  /** 账面状态（冗余展示） */
  bookStatus?: string;
  /** 实盘状态；未确认时为 undefined */
  actualStatus?: ActualStatus;
  /** 备注，0-200 字符 */
  remark: string;
  /** 是否已确认 */
  confirmed: boolean;
  /** 确认人 */
  confirmedBy?: string;
  /** 确认时间 (ISO 8601) */
  confirmedAt?: string;
}

// ============================================================================
// 盘盈盘亏汇总
// ============================================================================

/**
 * 盘盈盘亏汇总 — 对应 GET /api/v1/inventory/tasks/:taskId/summary
 */
export interface InventorySummary {
  /** 盘盈明细列表 */
  surplusItems: InventoryDifferenceItem[];
  /** 盘亏明细列表 */
  deficitItems: InventoryDifferenceItem[];
  /** 盘盈总数 */
  surplusCount: number;
  /** 盘亏总数 */
  deficitCount: number;
}

/**
 * 盘盈/盘亏明细条目
 */
export interface InventoryDifferenceItem {
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 盘盈/盘亏原因 */
  reason?: string;
}

// ============================================================================
// 请求载荷 (Request Payloads)
// ============================================================================

/**
 * 创建盘点任务请求 — POST /api/v1/inventory/tasks
 */
export interface CreateTaskPayload {
  /** 任务名称，1-50 字符 */
  taskName: string;
  /** 盘点范围类型 */
  scopeType: ScopeType;
  /** 位置/分类 ID 列表；scopeType 为 'all' 时可为空 */
  scopeIds: string[];
}

/**
 * 更新任务状态请求 — PATCH /api/v1/inventory/tasks/:taskId/status
 */
export interface UpdateTaskStatusPayload {
  /** 目标状态 */
  status: InventoryTaskStatus;
}

/**
 * 逐条确认资产请求 — PATCH /api/v1/inventory/tasks/:taskId/assets/:assetId/confirm
 */
export interface ConfirmPayload {
  /** 实盘状态 */
  actualStatus: ActualStatus;
  /** 备注，0-200 字符 */
  remark?: string;
}

/**
 * 批量确认资产请求 — POST /api/v1/inventory/tasks/:taskId/assets/batch-confirm
 * 单次上限 100 条
 */
export interface BatchConfirmPayload {
  /** 待确认资产 ID 列表，上限 100 条 */
  assetIds: string[];
  /** 统一实盘状态 */
  actualStatus: ActualStatus;
  /** 统一备注，0-200 字符 */
  remark?: string;
}

/**
 * 提交核准请求 — POST /api/v1/inventory/tasks/:taskId/submit
 * 无额外请求体参数，taskId 在 URL 路径中
 */
export type SubmitPayload = Record<string, never>;

// ============================================================================
// 查询参数
// ============================================================================

/**
 * 盘点任务列表查询参数 — GET /api/v1/inventory/tasks
 */
export interface TaskListQuery {
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条数（默认 20） */
  pageSize: number;
  /** 按状态筛选 */
  status?: InventoryTaskStatus;
  /** 任务名称模糊搜索 */
  taskName?: string;
}

/**
 * 盘点资产清单查询参数 — GET /api/v1/inventory/tasks/:taskId/assets
 */
export interface AssetListQuery {
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 按实盘状态筛选 */
  actualStatus?: ActualStatus;
}

// ============================================================================
// 通用响应包装
// ============================================================================

/**
 * 通用分页响应 — 列表接口统一返回结构
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  items: T[];
  /** 总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
}

// ============================================================================
// 组件 Props 辅助类型
// ============================================================================

/**
 * 盘点范围选择器值 — ScopeSelector 组件受控值
 */
export interface ScopeSelectorValue {
  /** 范围类型 */
  scopeType: ScopeType;
  /** 范围 ID 列表 */
  scopeIds: string[];
}

/**
 * 进度摘要 Props 数据 — ProgressSummary 组件所需统计快照
 */
export interface ProgressSummaryData {
  /** 进度百分比 0-100，保留 1 位小数 */
  progress: number;
  /** 总资产数 */
  total: number;
  /** 已盘数 */
  counted: number;
  /** 未盘数 */
  uncounted: number;
  /** 盘盈数 */
  surplus: number;
  /** 盘亏数 */
  deficit: number;
}