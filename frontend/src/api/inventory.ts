/**
 * @file api/inventory.ts
 * @description 资产盘点 API — 权威版本
 *
 * 对应后端：InventoryController (/inventory, /v1/inventory)
 * 权威 endpoint 基础路径：/inventory/tasks（带 v1 前缀后端兼容）
 */

import http from '@/utils/http';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type {
  InventoryTask,
  InventoryAsset,
  InventorySummary,
  CreateTaskPayload,
  UpdateTaskStatusPayload,
  ConfirmPayload,
  BatchConfirmPayload,
  TaskListQuery,
  AssetListQuery as InventoryAssetListQuery,
} from '@/types/inventory';

const BASE = '/inventory/tasks';

/** 获取盘点任务列表 */
export const getInventoryTasks = (params?: TaskListQuery) =>
  http.get<PaginatedResponse<InventoryTask>>(BASE, { params });

/** 创建盘点任务 */
export const createInventoryTask = (data: CreateTaskPayload) =>
  http.post<ApiResponse<InventoryTask>>(BASE, data);

/** 获取盘点任务详情 */
export const getInventoryTaskDetail = (taskId: string) =>
  http.get<ApiResponse<InventoryTask>>(`${BASE}/${taskId}`);

/** 更新任务状态（开始/完成/提交） */
export const updateTaskStatus = (taskId: string, data: UpdateTaskStatusPayload) =>
  http.patch<ApiResponse<InventoryTask>>(`${BASE}/${taskId}/status`, data);

/** 获取任务下的资产清单 */
export const getTaskAssets = (taskId: string, params?: InventoryAssetListQuery) =>
  http.get<PaginatedResponse<InventoryAsset>>(`${BASE}/${taskId}/assets`, { params });

/** 单条确认资产 */
export const confirmAsset = (taskId: string, assetId: string, data: ConfirmPayload) =>
  http.patch<ApiResponse<InventoryAsset>>(
    `${BASE}/${taskId}/assets/${assetId}/confirm`,
    data,
  );

/** 批量确认资产（上限 100 条） */
export const batchConfirmAssets = (taskId: string, data: BatchConfirmPayload) =>
  http.post<ApiResponse<{ confirmedCount: number }>>(
    `${BASE}/${taskId}/assets/batch-confirm`,
    data,
  );

/** 获取盘盈盘亏汇总 */
export const getTaskSummary = (taskId: string) =>
  http.get<ApiResponse<InventorySummary>>(`${BASE}/${taskId}/summary`);

/** 提交盘点任务核准 */
export const submitTask = (taskId: string) =>
  http.post<ApiResponse<InventoryTask>>(`${BASE}/${taskId}/submit`);
