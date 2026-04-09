import { api } from "../utils/api";

export interface MaintenanceRecord {
  id: number;
  [key: string]: unknown;
}

export const maintenanceService = {
  list(params?: Record<string, unknown>) {
    return api.get<MaintenanceRecord[]>("/maintenance/list", { params });
  },

  getById(id: number | string) {
    return api.get<MaintenanceRecord>(`/maintenance/${id}`);
  },

  create(data: Record<string, unknown>) {
    return api.post<MaintenanceRecord>("/maintenance", data);
  },

  update(id: number | string, data: Record<string, unknown>) {
    return api.put<MaintenanceRecord>(`/maintenance/${id}`, data);
  },

  delete(id: number | string) {
    return api.delete<string>(`/maintenance/${id}`);
  },

  getUpcoming(days = 30) {
    return api.get<MaintenanceRecord[]>("/maintenance/upcoming", {
      params: { days },
    });
  },
};
