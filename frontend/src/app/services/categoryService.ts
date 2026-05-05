import { api } from "../utils/api";

export interface CategoryRecord {
  id: number;
  [key: string]: unknown;
}

export const categoryService = {
  list(params?: Record<string, unknown>) {
    return api.get<CategoryRecord[]>("/categories/list", { params });
  },

  getAll() {
    return api.get<CategoryRecord[]>("/categories/all");
  },

  getById(id: number | string) {
    return api.get<CategoryRecord>(`/categories/${id}`);
  },

  create(data: Record<string, unknown>) {
    return api.post<CategoryRecord>("/categories", data);
  },

  update(id: number | string, data: Record<string, unknown>) {
    return api.put<CategoryRecord>(`/categories/${id}`, data);
  },

  delete(id: number | string) {
    return api.delete<string>(`/categories/${id}`);
  },
};
