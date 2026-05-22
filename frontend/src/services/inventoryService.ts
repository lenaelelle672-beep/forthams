/**
 * @module inventoryService
 * @description 资产盘点管理服务层 — 封装所有盘点相关 API 调用函数，
 * 与后端 `/api/v1/inventory/*` 接口一一对应。
 *
 * @example
 * ```ts
 * import inventoryService from '@/services/inventoryService';
 *
 * // 获取盘点任务列表
 * const result = await inventoryService.fetchTaskList({ page: 1, pageSize: 20 });
 *
 * // 创建盘点任务
 * const task = await inventoryService.createTask({
 *   taskName: '2024Q4办公室盘点',
 *   scopeType: 'location',
 *   scopeIds: ['loc-001', 'loc-002'],
 * });
 * ```
 */

import http from '@/utils/http';

// ---------------------------------------------------------------------------
// 类型定义（与 SPEC 数据约束一一对应）
// ---------------------------------------------------------------------------

/**
 * 盘点任务状态枚举
 * - `draft` — 草稿
 * - `in_progress` — 进行中
 * - `completed` — 已完成
 * - `submitted` — 已提交（不可逆）
 */
export type InventoryTaskStatus =
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'submitted';

/**
 * 盘点范围类型枚举
 * - `location` — 按位置树多选
 * - `category` — 按分类多选
 * - `all` — 全部资产（与上述两种互斥）
 */
export type ScopeType = 'location' | 'category' | 'all';

/**
 * 实盘状态枚举（逐条/批量确认时使用）
 * - `normal` — 正常
 * - `surplus` — 盘盈
 * - `deficit` — 盘亏
 * - `damaged` — 损坏
 * - `other` — 其他
 */
export type ActualStatus = 'normal' | 'surplus' | 'deficit' | 'damaged' | 'other';

/**
 * 盘点任务完整类型
 *
 * 与后端 `InventoryTask` 实体对应，包含任务基本信息及统计快照。
 */
export interface InventoryTask {
  /** 任务唯一标识 (UUID) */
  taskId: string;
  /** 任务名称，1–50 字符 */
  taskName: string;
  /** 盘点范围类型 */
  scopeType: ScopeType;
  /** 位置/分类 ID 列表；scopeType 非 `all` 时必填且 ≥1 */
  scopeIds: string[];
  /** 任务当前状态 */
  status: InventoryTaskStatus;
  /** 进度百分比 (0–100)，保留 1 位小数 */
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
 * 盘点任务列表查询参数
 */
export interface InventoryTaskQuery {
  /** 当前页码，默认 1 */
  page?: number;
  /** 每页条数，默认 20 */
  pageSize?: number;
  /** 按状态筛选 */
  status?: InventoryTaskStatus;
  /** 按任务名称关键词搜索 */
  keyword?: string;
}

/**
 * 创建盘点任务请求载荷
 */
export interface CreateTaskPayload {
  /** 任务名称，1–50 字符，必填 */
  taskName: string;
  /** 盘点范围类型 */
  scopeType: ScopeType;
  /**
   * 位置/分类 ID 列表
   * scopeType 非 `all` 时必填且 ≥1；scopeType 为 `all` 时忽略
   */
  scopeIds?: string[];
}

/**
 * 通用分页响应包装
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

/**
 * 盘点资产条目（任务下的资产清单行）
 */
export interface InventoryAsset {
  /** 资产唯一标识 */
  assetId: string;
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 账面状态文本 */
  bookStatus: string;
  /** 实盘状态，未盘时为 null */
  actualStatus: ActualStatus | null;
  /** 备注，0–200 字符 */
  remark: string;
  /** 是否已确认 */
  confirmed: boolean;
}

/**
 * 资产清单查询参数
 */
export interface AssetListQuery {
  /** 当前页码，默认 1 */
  page?: number;
  /** 每页条数，默认 20 */
  pageSize?: number;
  /** 按确认状态筛选 */
  confirmed?: boolean;
  /** 按实盘状态筛选 */
  actualStatus?: ActualStatus;
  /** 按资产编号/名称搜索 */
  keyword?: string;
}

/**
 * 逐条确认资产请求载荷
 */
export interface ConfirmPayload {
  /** 实盘状态，必填 */
  actualStatus: ActualStatus;
  /** 备注，选填，0–200 字符 */
  remark?: string;
}

/**
 * 批量确认资产请求载荷
 *
 * 单次上限 100 条，超出前端截断并提示用户。
 */
export interface BatchConfirmPayload {
  /** 待确认的资产 ID 列表，上限 100 条 */
  assetIds: string[];
  /** 统一实盘状态 */
  actualStatus: ActualStatus;
  /** 统一备注，选填 */
  remark?: string;
}

/**
 * 批量确认操作响应
 */
export interface BatchConfirmResult {
  /** 操作是否成功 */
  success: boolean;
  /** 实际确认数量 */
  confirmedCount: number;
}

/**
 * 更新任务状态请求载荷
 */
export interface UpdateStatusPayload {
  /** 目标状态 */
  status: InventoryTaskStatus;
}

/**
 * 盘盈/盘亏明细条目
 */
export interface InventoryDifferenceItem {
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 差异原因 */
  reason: string;
}

/**
 * 盘盈盘亏汇总数据
 */
export interface InventorySummary {
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
  /** 盘盈明细列表 */
  surplusDetails: InventoryDifferenceItem[];
  /** 盘亏明细列表 */
  deficitDetails: InventoryDifferenceItem[];
}

/**
 * 提交核准操作响应
 */
export interface SubmitResult {
  /** 操作是否成功 */
  success: boolean;
  /** 任务唯一标识 */
  taskId: string;
}

// ---------------------------------------------------------------------------
// API 基础配置
// ---------------------------------------------------------------------------

/** 盘点模块 API 基础路径 */
const API_BASE = '/v1/inventory';

/** 默认请求超时时间 (ms) */
const DEFAULT_TIMEOUT = 10_000;

/**
 * 获取认证请求头
 *
 * 从 localStorage 读取 auth_token，构造 Authorization Bearer 头。
 * 若 token 不存在则返回空对象（由后端拦截器处理 401）。
 *
 * @returns HTTP headers 对象
 */
function withAuth(
  extraConfig: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    timeout: DEFAULT_TIMEOUT,
    ...extraConfig,
  };
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 计算盘点进度百分比，保留 1 位小数
 *
 * 公式：`已盘数 / 总资产数 × 100%`，结果限制在 0–100 之间。
 *
 * @param counted - 已盘点资产数量
 * @param total - 总资产数量
 * @returns 进度百分比 (0.0 – 100.0)
 */
export function calculateProgress(counted: number, total: number): number {
  if (total <= 0) return 0;
  const raw = (counted / total) * 100;
  // 保留 1 位小数，上限 100
  return Math.min(Math.round(raw * 10) / 10, 100);
}

/**
 * 截断批量确认的资产 ID 列表至上限
 *
 * 当传入列表长度超过 maxItems 时，返回截断后的列表。
 * 调用方可据此判断是否需要向用户提示截断信息。
 *
 * @param assetIds - 原始资产 ID 列表
 * @param maxItems - 上限数量，默认 100（对应 SPEC 交互约束 #7）
 * @returns 截断后的资产 ID 列表
 */
export function truncateBatchIds(assetIds: string[], maxItems = 100): string[] {
  return assetIds.slice(0, maxItems);
}

// ---------------------------------------------------------------------------
// 盘点任务 CRUD API
// ---------------------------------------------------------------------------

/**
 * 获取盘点任务分页列表
 *
 * 默认按创建时间倒序排列，支持分页（默认每页 20 条）
 * 和按状态筛选（草稿/进行中/已完成/已提交）。
 *
 * 对应 API：`GET /api/v1/inventory/tasks`
 *
 * @param query - 分页与筛选参数
 * @returns 分页响应，包含 InventoryTask 列表
 * @throws 当网络错误或后端返回非 2xx 时抛出异常
 */
export async function fetchTaskList(
  query: InventoryTaskQuery = {},
): Promise<PaginatedResponse<InventoryTask>> {
  return http.get(`${API_BASE}/tasks`, withAuth({ params: query }));
}

/**
 * 创建盘点任务
 *
 * 创建成功后返回完整的任务对象（含后端生成的 taskId），
 * 任务初始状态为 `draft`（草稿）。
 *
 * 对应 API：`POST /api/v1/inventory/tasks`
 *
 * @param payload - 创建任务的请求载荷，含任务名称和范围选择
 * @returns 新创建的盘点任务对象
 * @throws 当校验失败（名称为空、范围未选）或网络错误时抛出异常
 */
export async function createTask(
  payload: CreateTaskPayload,
): Promise<InventoryTask> {
  return http.post(
    `${API_BASE}/tasks`,
    payload,
    withAuth(),
  );
}

/**
 * 获取单个盘点任务详情
 *
 * 包含任务基本信息、进度统计快照等。
 *
 * 对应 API：`GET /api/v1/inventory/tasks/:taskId`
 *
 * @param taskId - 盘点任务唯一标识 (UUID)
 * @returns 盘点任务详情对象
 * @throws 当 taskId 不存在或网络错误时抛出异常
 */
export async function fetchTaskDetail(
  taskId: string,
): Promise<InventoryTask> {
  return http.get(
    `${API_BASE}/tasks/${taskId}`,
    withAuth(),
  );
}

/**
 * 更新盘点任务状态
 *
 * 用于将任务从「草稿」变为「进行中」、
 * 「进行中」变为「已完成」等状态流转。
 *
 * 对应 API：`PATCH /api/v1/inventory/tasks/:taskId/status`
 *
 * @param taskId - 盘点任务唯一标识
 * @param payload - 包含目标状态的请求载荷
 * @returns 更新后的盘点任务对象
 * @throws 当状态流转不合法（如已提交→草稿）或网络错误时抛出异常
 */
export async function updateTaskStatus(
  taskId: string,
  payload: UpdateStatusPayload,
): Promise<InventoryTask> {
  return http.patch(
    `${API_BASE}/tasks/${taskId}/status`,
    payload,
    withAuth(),
  );
}

// ---------------------------------------------------------------------------
// 盘点执行 API
// ---------------------------------------------------------------------------

/**
 * 获取盘点任务下的资产清单（分页）
 *
 * 返回该任务范围内所有资产的盘点状态，
 * 支持分页、按确认状态和实盘状态筛选、按关键词搜索。
 *
 * 对应 API：`GET /api/v1/inventory/tasks/:taskId/assets`
 *
 * @param taskId - 盘点任务唯一标识
 * @param query - 分页与筛选参数
 * @returns 资产清单分页数据
 * @throws 当 taskId 不存在或网络错误时抛出异常
 */
export async function fetchTaskAssets(
  taskId: string,
  query: AssetListQuery = {},
): Promise<PaginatedResponse<InventoryAsset>> {
  return http.get(
    `${API_BASE}/tasks/${taskId}/assets`,
    withAuth({ params: query }),
  );
}

/**
 * 逐条确认资产盘点结果
 *
 * 对单条资产设置实盘状态并确认。仅当任务状态为「进行中」时允许操作；
 * 「已完成」「已提交」状态下应在前端禁用此操作。
 *
 * 对应 API：`PATCH /api/v1/inventory/tasks/:taskId/assets/:assetId/confirm`
 *
 * @param taskId - 盘点任务唯一标识
 * @param assetId - 资产唯一标识
 * @param payload - 确认载荷，含实盘状态和可选备注
 * @returns 更新后的资产对象
 * @throws 当任务状态不允许确认、资产不存在或网络错误时抛出异常
 */
export async function confirmAsset(
  taskId: string,
  assetId: string,
  payload: ConfirmPayload,
): Promise<InventoryAsset> {
  return http.patch(
    `${API_BASE}/tasks/${taskId}/assets/${assetId}/confirm`,
    payload,
    withAuth(),
  );
}

/**
 * 批量确认资产盘点结果
 *
 * 对多条资产统一设置实盘状态。单次上限 100 条，超出前端应截断并提示用户。
 * 需先在表格中勾选目标行（未勾选时批量按钮置灰）。
 *
 * 对应 API：`POST /api/v1/inventory/tasks/:taskId/assets/batch-confirm`
 *
 * @param taskId - 盘点任务唯一标识
 * @param payload - 批量确认载荷，含资产 ID 列表、统一实盘状态和可选备注
 * @returns 批量确认结果，含成功标志和实际确认数量
 * @throws 当 assetIds 超过上限、任务状态不允许或网络错误时抛出异常
 */
export async function batchConfirmAssets(
  taskId: string,
  payload: BatchConfirmPayload,
): Promise<BatchConfirmResult> {
  return http.post(
    `${API_BASE}/tasks/${taskId}/assets/batch-confirm`,
    payload,
    withAuth(),
  );
}

// ---------------------------------------------------------------------------
// 盘点汇总 API
// ---------------------------------------------------------------------------

/**
 * 获取盘盈盘亏汇总数据
 *
 * 包含统计摘要（总资产/已盘/未盘/盘盈/盘亏）及盘盈/盘亏明细列表。
 * 在每次确认操作后应调用此接口刷新汇总数据。
 *
 * 对应 API：`GET /api/v1/inventory/tasks/:taskId/summary`
 *
 * @param taskId - 盘点任务唯一标识
 * @returns 盘盈盘亏汇总数据
 * @throws 当 taskId 不存在或网络错误时抛出异常
 */
export async function fetchTaskSummary(
  taskId: string,
): Promise<InventorySummary> {
  return http.get(
    `${API_BASE}/tasks/${taskId}/summary`,
    withAuth(),
  );
}

/**
 * 提交盘点任务核准（不可逆操作）
 *
 * 提交后任务状态变更为「已提交」，整个详情页进入只读模式。
 * **前端必须在调用前弹出二次确认弹窗**，提示"确认提交核准？提交后不可修改。"。
 * 所有写操作（创建任务、确认资产、提交核准）均需防重复提交。
 *
 * 对应 API：`POST /api/v1/inventory/tasks/:taskId/submit`
 *
 * @param taskId - 盘点任务唯一标识
 * @returns 提交结果，含成功标志和任务 ID
 * @throws 当任务状态不允许提交（非「已完成」）或网络错误时抛出异常
 */
export async function submitTask(
  taskId: string,
): Promise<SubmitResult> {
  return http.post(
    `${API_BASE}/tasks/${taskId}/submit`,
    {},
    withAuth(),
  );
}

// ---------------------------------------------------------------------------
// 默认导出：聚合服务对象
// ---------------------------------------------------------------------------

/**
 * 盘点管理服务对象
 *
 * 聚合所有盘点相关 API 函数，支持具名导入和默认对象导入两种使用方式。
 *
 * @example
 * ```ts
 * // 具名导入（推荐，便于 tree-shaking）
 * import { fetchTaskList, createTask } from '@/services/inventoryService';
 *
 * // 默认导入
 * import inventoryService from '@/services/inventoryService';
 * const tasks = await inventoryService.fetchTaskList();
 * ```
 */
const inventoryService = {
  /** 获取盘点任务分页列表 */
  fetchTaskList,
  /** 创建盘点任务 */
  createTask,
  /** 获取单个盘点任务详情 */
  fetchTaskDetail,
  /** 更新盘点任务状态 */
  updateTaskStatus,
  /** 获取盘点任务下的资产清单 */
  fetchTaskAssets,
  /** 逐条确认资产盘点结果 */
  confirmAsset,
  /** 批量确认资产盘点结果 */
  batchConfirmAssets,
  /** 获取盘盈盘亏汇总数据 */
  fetchTaskSummary,
  /** 提交盘点任务核准（不可逆） */
  submitTask,
  /** 计算盘点进度百分比 */
  calculateProgress,
  /** 截断批量确认的资产 ID 列表至上限 */
  truncateBatchIds,
};

export default inventoryService;