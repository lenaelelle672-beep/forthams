/**
 * 盘点管理 API Client 模块
 *
 * 封装所有资产盘点相关的后端 API 调用，对应后端路由组 /api/v1/inventory/*。
 * 所有函数签名与 SPEC SWARM-P3-010-FE 中定义的 API 契约一一对应。
 *
 * @module api/inventory
 */

import http from '@/utils/http';
import type { AxiosResponse } from 'axios';

// ============================================================
// 类型定义
// ============================================================

/** 盘点范围类型：按位置、按分类或全部资产 */
export type ScopeType = 'location' | 'category' | 'all';

/** 盘点任务状态枚举 */
export type TaskStatus = 'draft' | 'in_progress' | 'completed' | 'submitted';

/** 实盘状态枚举 */
export type ActualStatus = 'normal' | 'surplus' | 'deficit' | 'damaged' | 'other';

/**
 * 通用分页响应结构
 *
 * @template T - 列表项类型
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
}

/**
 * 盘点任务对象
 *
 * 对应 SPEC 数据约束中 taskId, taskName, scopeType, scopeIds,
 * status, progress, totalAssets, countedAssets, surplusAssets, deficitAssets 等字段。
 */
export interface InventoryTask {
  /** 盘点任务唯一标识 (UUID) */
  taskId: string;
  /** 任务名称，1-50 字符，必填 */
  taskName: string;
  /** 盘点范围类型 */
  scopeType: ScopeType;
  /** 位置/分类 ID 列表，scopeType 非 all 时必填且 ≥1 */
  scopeIds: string[];
  /** 任务状态 */
  status: TaskStatus;
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

/** 盘点任务列表查询参数 */
export interface TaskListQuery {
  /** 当前页码，默认 1 */
  page?: number;
  /** 每页条数，默认 20 */
  pageSize?: number;
  /** 按状态筛选：草稿/进行中/已完成/已提交 */
  status?: TaskStatus;
}

/** 创建盘点任务请求载荷 */
export interface CreateTaskPayload {
  /** 任务名称，1-50 字符，必填 */
  taskName: string;
  /** 盘点范围类型 */
  scopeType: ScopeType;
  /** 位置/分类 ID 列表，scopeType 非 all 时必填且 ≥1 */
  scopeIds: string[];
}

/** 更新任务状态请求载荷 */
export interface UpdateTaskStatusPayload {
  /** 目标任务状态 */
  status: TaskStatus;
}

/**
 * 盘点资产对象
 *
 * 表示盘点任务下的一条资产记录，对应资产清单表格的行数据。
 * 表头列：资产编号、资产名称、账面状态、实盘状态、备注、操作。
 */
export interface InventoryAsset {
  /** 资产唯一标识 */
  assetId: string;
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 账面状态 */
  bookStatus: string;
  /** 实盘状态，未确认时为 null */
  actualStatus: ActualStatus | null;
  /** 备注，0-200 字符 */
  remark: string;
  /** 是否已确认 */
  confirmed: boolean;
}

/** 资产清单查询参数 */
export interface AssetListQuery {
  /** 当前页码 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
}

/** 逐条确认资产请求载荷 */
export interface ConfirmPayload {
  /** 实盘状态 */
  actualStatus: ActualStatus;
  /** 备注，0-200 字符 */
  remark?: string;
}

/** 批量确认资产请求载荷 */
export interface BatchConfirmPayload {
  /** 待确认的资产 ID 列表，单次上限 100 条 */
  assetIds: string[];
  /** 统一实盘状态 */
  actualStatus: ActualStatus;
  /** 统一备注，0-200 字符 */
  remark?: string;
}

/**
 * 盘盈盘亏汇总统计
 *
 * 包含汇总数据（总资产、已盘、未盘、盘盈、盘亏）及差异明细列表，
 * 用于 DifferenceSummaryPanel 组件的两个 Tab 展示。
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
  surplusDetails: SurplusDeficitDetail[];
  /** 盘亏明细列表 */
  deficitDetails: SurplusDeficitDetail[];
}

/**
 * 盘盈/盘亏明细项
 *
 * 用于汇总面板中按 Tab 展示的差异明细，
 * 每项包含资产编号、资产名称及盘盈/盘亏原因。
 */
export interface SurplusDeficitDetail {
  /** 资产 ID */
  assetId: string;
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 盘盈/盘亏原因 */
  reason: string;
}

// ============================================================
// API 路由常量
// ============================================================

/** 盘点任务 API 基础路径 */
const INVENTORY_TASKS_BASE = '/api/v1/inventory/tasks';

// ============================================================
// API 调用函数 — 盘点任务 (CRUD + 状态流转)
// ============================================================

/**
 * 获取盘点任务分页列表
 *
 * 对应接口：GET /api/v1/inventory/tasks
 * 默认按创建时间倒序排列，支持按状态筛选（草稿/进行中/已完成/已提交），
 * 每页默认 20 条。
 *
 * @param query - 分页与筛选参数
 * @returns 分页的盘点任务列表
 */
export async function getInventoryTasks(
  query: TaskListQuery = {},
): Promise<PaginatedResponse<InventoryTask>> {
  const response: AxiosResponse<PaginatedResponse<InventoryTask>> =
    await http.get(INVENTORY_TASKS_BASE, { params: query });
  return response.data;
}

/**
 * 创建新的盘点任务
 *
 * 对应接口：POST /api/v1/inventory/tasks
 * 请求体包含 { taskName, scopeType, scopeIds }。
 * taskName 必填（1-50 字符），scopeType 非 all 时 scopeIds 必填且 ≥1。
 *
 * @param payload - 创建任务的请求载荷
 * @returns 新创建的盘点任务对象（状态为 draft）
 */
export async function createInventoryTask(
  payload: CreateTaskPayload,
): Promise<InventoryTask> {
  const response: AxiosResponse<InventoryTask> =
    await http.post(INVENTORY_TASKS_BASE, payload);
  return response.data;
}

/**
 * 获取单个盘点任务详情
 *
 * 对应接口：GET /api/v1/inventory/tasks/:taskId
 * 返回含统计数据（totalAssets, countedAssets, surplusAssets, deficitAssets 等），
 * 用于 ProgressSummary 组件的进度条与统计卡片渲染。
 *
 * @param taskId - 盘点任务唯一标识 (UUID)
 * @returns 盘点任务详情
 */
export async function getInventoryTaskDetail(
  taskId: string,
): Promise<InventoryTask> {
  const response: AxiosResponse<InventoryTask> =
    await http.get(`${INVENTORY_TASKS_BASE}/${taskId}`);
  return response.data;
}

/**
 * 更新盘点任务状态
 *
 * 对应接口：PATCH /api/v1/inventory/tasks/:taskId/status
 * 用于将任务从「草稿」变更为「进行中」等状态流转。
 *
 * @param taskId - 盘点任务唯一标识
 * @param payload - 包含目标状态的对象
 * @returns 更新后的盘点任务对象
 */
export async function updateTaskStatus(
  taskId: string,
  payload: UpdateTaskStatusPayload,
): Promise<InventoryTask> {
  const response: AxiosResponse<InventoryTask> =
    await http.patch(`${INVENTORY_TASKS_BASE}/${taskId}/status`, payload);
  return response.data;
}

// ============================================================
// API 调用函数 — 盘点执行 (资产确认)
// ============================================================

/**
 * 获取任务下的资产清单（分页）
 *
 * 对应接口：GET /api/v1/inventory/tasks/:taskId/assets
 * 返回该盘点任务范围内所有资产的盘点状态列表，
 * 用于 AssetTable 组件渲染。资产数 > 200 时前端需启用虚拟滚动。
 *
 * @param taskId - 盘点任务唯一标识
 * @param query - 分页参数
 * @returns 分页的资产清单
 */
export async function getTaskAssets(
  taskId: string,
  query: AssetListQuery = {},
): Promise<PaginatedResponse<InventoryAsset>> {
  const response: AxiosResponse<PaginatedResponse<InventoryAsset>> =
    await http.get(`${INVENTORY_TASKS_BASE}/${taskId}/assets`, { params: query });
  return response.data;
}

/**
 * 逐条确认资产盘点结果
 *
 * 对应接口：PATCH /api/v1/inventory/tasks/:taskId/assets/:assetId/confirm
 * 请求体包含 { actualStatus, remark }。
 * 仅当任务状态为「进行中」时可调用；
 * 确认后该资产实盘状态变为只读，顶部统计摘要实时刷新（已盘+1、未盘-1）。
 *
 * @param taskId - 盘点任务唯一标识
 * @param assetId - 资产唯一标识
 * @param payload - 确认载荷（实盘状态 + 可选备注）
 * @returns 确认后的资产对象
 */
export async function confirmAsset(
  taskId: string,
  assetId: string,
  payload: ConfirmPayload,
): Promise<InventoryAsset> {
  const response: AxiosResponse<InventoryAsset> =
    await http.patch(
      `${INVENTORY_TASKS_BASE}/${taskId}/assets/${assetId}/confirm`,
      payload,
    );
  return response.data;
}

/**
 * 批量确认资产盘点结果
 *
 * 对应接口：POST /api/v1/inventory/tasks/:taskId/assets/batch-confirm
 * 请求体包含 { assetIds, actualStatus, remark }。
 * 单次批量确认上限 100 条，超出需前端截断并提示用户。
 * 需先勾选表格行，未勾选时批量按钮置灰不可点击。
 *
 * @param taskId - 盘点任务唯一标识
 * @param payload - 批量确认载荷（资产 ID 列表 + 统一实盘状态 + 可选备注）
 */
export async function batchConfirmAssets(
  taskId: string,
  payload: BatchConfirmPayload,
): Promise<void> {
  await http.post(
    `${INVENTORY_TASKS_BASE}/${taskId}/assets/batch-confirm`,
    payload,
  );
}

// ============================================================
// API 调用函数 — 盘点汇总 (盘盈盘亏 + 提交核准)
// ============================================================

/**
 * 获取盘盈盘亏汇总数据
 *
 * 对应接口：GET /api/v1/inventory/tasks/:taskId/summary
 * 返回汇总统计（总资产、已盘、未盘、盘盈、盘亏）及差异明细列表，
 * 用于 DifferenceSummaryPanel 组件的两个 Tab（盘盈明细/盘亏明细）展示。
 *
 * @param taskId - 盘点任务唯一标识
 * @returns 盘盈盘亏汇总统计
 */
export async function getTaskSummary(
  taskId: string,
): Promise<InventorySummary> {
  const response: AxiosResponse<InventorySummary> =
    await http.get(`${INVENTORY_TASKS_BASE}/${taskId}/summary`);
  return response.data;
}

/**
 * 提交盘点结果进行核准
 *
 * 对应接口：POST /api/v1/inventory/tasks/:taskId/submit
 * 此操作不可逆，提交后任务状态变更为「已提交」，页面进入只读模式。
 * 前端应在调用前弹出二次确认弹窗："确认提交核准？提交后不可修改。"
 * 调用此函数的按钮需防重复提交（loading + debounce）。
 *
 * @param taskId - 盘点任务唯一标识
 * @returns 提交后的任务对象（状态为 submitted）
 */
export async function submitTask(
  taskId: string,
): Promise<InventoryTask> {
  const response: AxiosResponse<InventoryTask> =
    await http.post(`${INVENTORY_TASKS_BASE}/${taskId}/submit`);
  return response.data;
}