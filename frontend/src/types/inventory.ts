/**
 * SWARM-P3-010 资产盘点管理 — TypeScript 类型定义
 *
 * 本文件定义资产盘点管理模块所有相关类型，覆盖：
 * - 盘点任务（InventoryTask）
 * - 盘点执行 / 资产明细（InventoryAsset）
 * - 盘点汇总（InventorySummary）
 * - API 请求载荷（CreateTaskPayload / ConfirmPayload / BatchConfirmPayload / SubmitPayload）
 * - 分页通用结构（PaginationParams / PaginatedResponse / TaskListQuery）
 *
 * @module types/inventory
 */

// ---------------------------------------------------------------------------
// 字面量联合类型（对应 SPEC 数据约束）
// ---------------------------------------------------------------------------

/**
 * 盘点范围类型
 * - location: 按位置树多选
 * - category: 按分类多选
 * - all: 全部资产
 */
export type ScopeType = 'location' | 'category' | 'all';

/**
 * 盘点任务状态
 * - draft:      草稿
 * - in_progress: 进行中
 * - completed:  已完成
 * - submitted:  已提交（不可逆）
 */
export type TaskStatus = 'draft' | 'in_progress' | 'completed' | 'submitted';

/**
 * 实盘状态
 * - normal:  正常（账实相符）
 * - surplus: 盘盈（账面无，实际有）
 * - deficit: 盘亏（账面有，实际无）
 * - damaged: 损坏 / 状态异常
 * - other:   其他
 */
export type ActualStatus = 'normal' | 'surplus' | 'deficit' | 'damaged' | 'other';

// ---------------------------------------------------------------------------
// 盘点任务
// ---------------------------------------------------------------------------

/**
 * 盘点任务实体 — 列表页与详情页共用
 *
 * 字段与 SPEC 数据约束一一对应。
 */
export interface InventoryTask {
  /** 盘点任务唯一标识 (UUID) */
  taskId: string;
  /** 任务名称（1–50 字符，必填） */
  taskName: string;
  /** 盘点范围类型 */
  scopeType: ScopeType;
  /** 位置 / 分类 ID 列表；scopeType 非 all 时必填且 ≥1 */
  scopeIds: string[];
  /** 任务状态 */
  status: TaskStatus;
  /** 完成进度 0–100，保留 1 位小数（已盘数 / 总资产数 × 100%） */
  progress: number;
  /** 应盘资产总数 */
  totalAssets: number;
  /** 已盘数 */
  countedAssets: number;
  /** 未盘数 */
  uncountedAssets: number;
  /** 盘盈数 */
  surplusAssets: number;
  /** 盘亏数 */
  deficitAssets: number;
  /** 创建时间（ISO 8601 字符串） */
  createdAt: string;
  /** 更新时间（ISO 8601 字符串） */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 盘点执行 — 资产明细
// ---------------------------------------------------------------------------

/**
 * 盘点执行中的单条资产记录
 *
 * 用于资产清单表格（逐条 / 批量确认）。
 */
export interface InventoryAsset {
  /** 资产 ID */
  assetId: string;
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 账面状态 */
  bookStatus: string;
  /** 实盘状态；未盘时为 null */
  actualStatus: ActualStatus | null;
  /** 备注（0–200 字符） */
  remark: string;
  /** 是否已确认 */
  confirmed: boolean;
}

// ---------------------------------------------------------------------------
// 盘点汇总
// ---------------------------------------------------------------------------

/**
 * 盘盈盘亏汇总 — 由 GET /tasks/:taskId/summary 返回
 */
export interface InventorySummary {
  /** 应盘总数 */
  totalAssets: number;
  /** 已盘数 */
  countedAssets: number;
  /** 未盘数 */
  uncountedAssets: number;
  /** 盘盈数 */
  surplusAssets: number;
  /** 盘亏数 */
  deficitAssets: number;
  /** 盘盈明细列表 */
  surplusDetails: SurplusDeficitItem[];
  /** 盘亏明细列表 */
  deficitDetails: SurplusDeficitItem[];
}

/**
 * 盘盈 / 盘亏明细条目
 */
export interface SurplusDeficitItem {
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 原因 */
  reason: string;
}

// ---------------------------------------------------------------------------
// API 请求载荷（Payloads）
// ---------------------------------------------------------------------------

/**
 * 创建盘点任务请求载荷
 *
 * POST /api/v1/inventory/tasks
 */
export interface CreateTaskPayload {
  /** 任务名称（1–50 字符，必填） */
  taskName: string;
  /** 盘点范围类型 */
  scopeType: ScopeType;
  /** 位置 / 分类 ID 列表；scopeType 为 all 时可为空数组 */
  scopeIds: string[];
}

/**
 * 更新任务状态请求载荷
 *
 * PATCH /api/v1/inventory/tasks/:taskId/status
 */
export interface UpdateTaskStatusPayload {
  /** 目标状态 */
  status: TaskStatus;
}

/**
 * 逐条确认资产请求载荷
 *
 * PATCH /api/v1/inventory/tasks/:taskId/assets/:assetId/confirm
 */
export interface ConfirmPayload {
  /** 实盘状态 */
  actualStatus: ActualStatus;
  /** 备注（0–200 字符） */
  remark: string;
}

/**
 * 批量确认资产请求载荷
 *
 * POST /api/v1/inventory/tasks/:taskId/assets/batch-confirm
 * 单次上限 100 条，超出前端提示并截断。
 */
export interface BatchConfirmPayload {
  /** 待确认的资产 ID 列表（上限 100） */
  assetIds: string[];
  /** 统一实盘状态 */
  actualStatus: ActualStatus;
  /** 统一备注 */
  remark: string;
}

/**
 * 提交核准请求载荷
 *
 * POST /api/v1/inventory/tasks/:taskId/submit
 * 提交核准为不可逆操作，需二次确认弹窗。
 */
export interface SubmitPayload {
  /** 提交备注（可选） */
  comment?: string;
}

// ---------------------------------------------------------------------------
// 分页 & 通用响应
// ---------------------------------------------------------------------------

/**
 * 分页查询参数
 */
export interface PaginationParams {
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条数（默认 20） */
  pageSize: number;
}

/**
 * 盘点任务列表查询参数
 *
 * GET /api/v1/inventory/tasks
 */
export interface TaskListQuery extends PaginationParams {
  /** 按状态筛选 */
  status?: TaskStatus;
}

/**
 * 通用分页响应结构
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  data: T[];
  /** 总条数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
}

// ---------------------------------------------------------------------------
// 组件 Props 辅助类型
// ---------------------------------------------------------------------------

/**
 * ScopeSelector 受控值类型
 *
 * 用于 CreateTaskModal 中范围选择器的 value / onChange。
 */
export interface ScopeSelectorValue {
  /** 当前选中的范围类型 */
  scopeType: ScopeType;
  /** 当前选中的位置 / 分类 ID 列表 */
  scopeIds: string[];
}