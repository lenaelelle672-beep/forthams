import { api } from "../utils/api";

export interface CompensationRecord {
  id: number;
  [key: string]: unknown;
}

export const compensationService = {
  list(params?: Record<string, unknown>) {
    return api.get<CompensationRecord[]>("/compensations/list", { params });
  },

  getById(id: number | string) {
    return api.get<CompensationRecord>(`/compensations/${id}`);
  },

  create(data: Record<string, unknown>) {
    return api.post<CompensationRecord>("/compensations", data);
  },

  estimate(data: Record<string, unknown>) {
    return api.post<Record<string, unknown>>("/compensations/valuation", data);
  },

  update(id: number | string, data: Record<string, unknown>) {
    return api.put<CompensationRecord>(`/compensations/${id}`, data);
  },

  updateStatus(id: number | string, status: string) {
    return api.put<CompensationRecord>(`/compensations/${id}/status`, {
      status,
    });
  },

  delete(id: number | string) {
    return api.delete<string>(`/compensations/${id}`);
  },
};
