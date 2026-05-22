import http from '@/utils/http';

export interface InventoryTaskRecord {
  id: number;
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

interface PageResponse<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

const BASE = '/inventory/tasks';

export function getInventoryTasks(params?: InventoryTaskListParams) {
  return http.get(BASE, { params });
}

export function createInventoryTask(data: InventoryTaskCreatePayload) {
  return http.post(BASE, data);
}

export function getInventoryTaskDetail(id: number | string) {
  return http.get(`${BASE}/${id}`);
}

export function updateTaskStatus(id: number | string, payload: { status: string }) {
  return (http as { patch: (url: string, data?: unknown) => Promise<unknown> }).patch(`${BASE}/${id}/status`, payload);
}

export function getTaskAssets(taskId: number | string, params?: Record<string, unknown>) {
  return http.get(`${BASE}/${taskId}/assets`, { params });
}

export function confirmAsset(taskId: number | string, assetId: number | string, payload?: Record<string, unknown>) {
  return (http as { patch: (url: string, data?: unknown) => Promise<unknown> }).patch(`${BASE}/${taskId}/assets/${assetId}/confirm`, payload);
}

export function batchConfirmAssets(taskId: number | string, payload: { assetIds: (string | number)[]; actualStatus?: string; remark?: string }) {
  return http.post(`${BASE}/${taskId}/assets/batch-confirm`, payload);
}

export function submitTask(taskId: number | string) {
  return http.post(`${BASE}/${taskId}/submit`);
}

export function getTaskSummary(taskId: number | string) {
  return http.get(`${BASE}/${taskId}/summary`);
}

export const inventoryService = {
  listTasks: getInventoryTasks,
  getTask: getInventoryTaskDetail,
  createTask: createInventoryTask,
  updateTaskStatus,
  addScanResult(taskId: number | string, data: Record<string, unknown>) {
    return http.post(`${BASE}/${taskId}/scan`, data);
  },
  getTaskDetails(taskId: number | string) {
    return http.get(`${BASE}/${taskId}/details`);
  },
};
