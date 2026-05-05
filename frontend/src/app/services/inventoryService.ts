import { api } from "../utils/api";

export interface InventoryTaskRecord {
  id: number;
  [key: string]: unknown;
}

export interface InventoryTaskDetail {
  id: number;
  [key: string]: unknown;
}

export const inventoryService = {
  listTasks(params?: Record<string, unknown>) {
    return api.get<InventoryTaskRecord[]>("/inventory/tasks", { params });
  },

  getTask(id: number | string) {
    return api.get<InventoryTaskRecord>(`/inventory/tasks/${id}`);
  },

  createTask(data: Record<string, unknown>) {
    return api.post<InventoryTaskRecord>("/inventory/tasks", data);
  },

  updateTaskStatus(id: number | string, status: string) {
    return api.put<InventoryTaskRecord>(`/inventory/tasks/${id}/status`, {
      status,
    });
  },

  addScanResult(taskId: number | string, data: Record<string, unknown>) {
    return api.post<InventoryTaskRecord>(`/inventory/tasks/${taskId}/scan`, data);
  },

  getTaskDetails(taskId: number | string) {
    return api.get<InventoryTaskDetail>(`/inventory/tasks/${taskId}/details`);
  },
};
