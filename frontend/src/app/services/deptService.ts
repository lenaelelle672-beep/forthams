import { api } from "../utils/api";

export interface DeptRecord {
  id: number;
  [key: string]: unknown;
}

export const deptService = {
  getTree(keyword?: string) {
    return api.get<DeptRecord[]>("/depts/tree", {
      params: keyword ? { keyword } : undefined,
    });
  },

  getAll() {
    return api.get<DeptRecord[]>("/depts/list");
  },

  getById(id: number | string) {
    return api.get<DeptRecord>(`/depts/${id}`);
  },

  create(data: Record<string, unknown>) {
    return api.post<DeptRecord>("/depts", data);
  },

  update(id: number | string, data: Record<string, unknown>) {
    return api.put<DeptRecord>(`/depts/${id}`, data);
  },

  delete(id: number | string) {
    return api.delete<string>(`/depts/${id}`);
  },
};
