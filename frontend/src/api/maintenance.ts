import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';

export type MaintenanceType = 'preventive' | 'corrective' | 'emergency' | 'routine';

export interface MaintenanceRecord {
  id: number;
  tenantId?: string;
  assetId: number;
  workOrderId?: number | null;
  maintenanceType: string;
  maintenanceDate: string;
  nextMaintenanceDate: string | null;
  cost: number | null;
  executor: string | null;
  content: string;
  result: string | null;
  remark: string | null;
  createBy?: number | null;
  createTime?: string;
  updateTime?: string;
  sourceType?: string;
  equipmentName?: string;
  assetName?: string;
}

export interface CreateMaintenancePayload {
  assetId?: number;
  workOrderId?: number;
  maintenanceType?: string;
  maintenanceDate?: string;
  nextMaintenanceDate?: string;
  executor?: string;
  content?: string;
  cost?: number;
  result?: string;
  remark?: string;
}

export interface MaintenanceListParams {
  page?: number;
  pageSize?: number;
  assetId?: number;
  maintenanceType?: string;
}

interface PageResponse<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export const maintenanceService = {
  list(params?: MaintenanceListParams) {
    return http.get<PageResponse<MaintenanceRecord>>('/maintenance/list', { params });
  },

  getById(id: number | string) {
    return http.get<MaintenanceRecord>(`/maintenance/${id}`);
  },

  create(data: CreateMaintenancePayload) {
    return http.post<MaintenanceRecord>('/maintenance', data);
  },

  update(id: number | string, data: Partial<CreateMaintenancePayload>) {
    return http.put<MaintenanceRecord>(`/maintenance/${id}`, data);
  },

  delete(id: number | string) {
    return http.delete<void>(`/maintenance/${id}`);
  },

  getUpcoming(days = 30) {
    return http.get<MaintenanceRecord[]>('/maintenance/upcoming', { params: { days } });
  },
};
