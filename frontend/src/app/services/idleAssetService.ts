import { api } from "../utils/api";

export interface IdleAssetRecord {
  id: number;
  [key: string]: unknown;
}

export const idleAssetService = {
  list(params?: Record<string, unknown>) {
    return api.get<IdleAssetRecord[]>("/idle-assets/list", { params });
  },

  getById(id: number | string) {
    return api.get<IdleAssetRecord>(`/idle-assets/${id}`);
  },

  publish(data: Record<string, unknown>) {
    return api.post<IdleAssetRecord>("/idle-assets", data);
  },

  claim(id: number | string, claimantId: number | string) {
    return api.post<IdleAssetRecord>(`/idle-assets/${id}/claim`, { claimantId });
  },

  cancel(id: number | string) {
    return api.put<IdleAssetRecord>(`/idle-assets/${id}/cancel`);
  },

  delete(id: number | string) {
    return api.delete<string>(`/idle-assets/${id}`);
  },
};
