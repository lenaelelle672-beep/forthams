import { api } from "../utils/api";

export interface AssetRecord {
  id: number;
  [key: string]: unknown;
}

export interface PagedResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export const assetService = {
  list(params?: Record<string, unknown>) {
    return api.get<PagedResult<AssetRecord>>("/assets/list", { params });
  },

  getById(id: number | string) {
    return api.get<AssetRecord>(`/assets/${id}`);
  },

  create(payload: Record<string, unknown>) {
    return api.post<AssetRecord>("/assets", payload);
  },

  update(id: number | string, payload: Record<string, unknown>) {
    return api.put<AssetRecord>(`/assets/${id}`, payload);
  },

  delete(id: number | string) {
    return api.delete<string>(`/assets/${id}`);
  },
};
