import http from '@/utils/http';
import type { PageData } from '@/types/common';
import type { InventoryAsset, InventorySummary, InventoryTask as InventoryTaskView } from '@/types/inventory';

export interface InventoryTaskRecord {
  id: number;
  taskId?: string;
  taskNo: string;
  taskName: string;
  inventoryType: string | null;
  tenantId?: string;
  status: string;
  deptIds: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  scope: string | null;
  totalCount: number | null;
  matchedCount: number | null;
  lossCount: number | null;
  executorId: number | null;
  createBy: number | null;
  createTime: string | null;
  updateTime: string | null;
}

export interface InventoryDetailRecord {
  id: number;
  taskId: number;
  tenantId?: string;
  assetId: number;
  rfidTag: string | null;
  status: string | null;
  expectedLocation: string | null;
  actualLocation: string | null;
  scanTime: string | null;
  remark: string | null;
  createTime: string | null;
}

export interface InventoryTaskDetail {
  task: InventoryTaskRecord;
  details: InventoryDetailRecord[];
}

export interface InventoryTaskListParams {
  page?: number;
  pageSize?: number;
  status?: string;
}

export interface InventoryTaskCreatePayload {
  taskName: string;
  scopeType?: string;
  scopeIds?: string[];
  inventoryType?: string;
  deptIds?: string;
  location?: string;
  executorId?: number;
  scope?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  totalCount?: number;
}

const BASE = '/inventory/tasks';

export function getInventoryTasks(params?: InventoryTaskListParams): Promise<PageData<InventoryTaskView>> {
  return http.get<PageData<InventoryTaskView>>(BASE, { params });
}

export function createInventoryTask(data: InventoryTaskCreatePayload): Promise<InventoryTaskRecord & { taskId?: string }> {
  return http.post<InventoryTaskRecord & { taskId?: string }>(BASE, data);
}

export const createTask = createInventoryTask;

export function getInventoryTaskDetail(id: number | string): Promise<InventoryTaskDetail> {
  return http.get<InventoryTaskDetail>(`${BASE}/${id}`);
}

export function updateTaskStatus(id: number | string, payload: { status: string }): Promise<InventoryTaskRecord> {
  return http.patch<InventoryTaskRecord>(`${BASE}/${id}/status`, payload);
}

export function getTaskAssets(taskId: number | string, params?: Record<string, unknown>): Promise<PageData<InventoryAsset>> {
  return http.get<PageData<InventoryAsset>>(`${BASE}/${taskId}/assets`, { params });
}

export function confirmAsset(taskId: number | string, assetId: number | string, payload?: Record<string, unknown>): Promise<void> {
  return http.patch<void>(`${BASE}/${taskId}/assets/${assetId}/confirm`, payload);
}

export function batchConfirmAssets(taskId: number | string, payload: { assetIds: (string | number)[]; actualStatus?: string; remark?: string }): Promise<void> {
  return http.post<void>(`${BASE}/${taskId}/assets/batch-confirm`, payload);
}

export function submitTask(taskId: number | string): Promise<void> {
  return http.post<void>(`${BASE}/${taskId}/submit`);
}

export function getTaskSummary(taskId: number | string): Promise<InventorySummary> {
  return http.get<InventorySummary>(`${BASE}/${taskId}/summary`);
}

export function approveTask(taskId: number | string): Promise<{ surplusCreated: number; deficitMarked: number; damagedMarked: number; errors: string[] }> {
  return http.post<{ surplusCreated: number; deficitMarked: number; damagedMarked: number; errors: string[] }>(`${BASE}/${taskId}/approve`);
}

export const inventoryService = {
  listTasks: getInventoryTasks,
  getTask: getInventoryTaskDetail,
  createTask: createInventoryTask,
  updateTaskStatus,
  addScanResult(taskId: number | string, data: Record<string, unknown>) {
    return http.post(`${BASE}/${taskId}/scan`, data);
  },
  getTaskDetails(taskId: number | string): Promise<InventoryDetailRecord[]> {
    return http.get<InventoryDetailRecord[]>(`${BASE}/${taskId}/details`);
  },
};
