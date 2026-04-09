import { api } from "../utils/api";

export interface RoleRecord {
  id: number;
  [key: string]: unknown;
}

export const roleService = {
  list(params?: Record<string, unknown>) {
    return api.get<RoleRecord[]>("/roles/list", { params });
  },

  getAll() {
    return api.get<RoleRecord[]>("/roles/all");
  },

  getById(id: number | string) {
    return api.get<RoleRecord>(`/roles/${id}`);
  },

  create(data: Record<string, unknown>) {
    return api.post<RoleRecord>("/roles", data);
  },

  update(id: number | string, data: Record<string, unknown>) {
    return api.put<RoleRecord>(`/roles/${id}`, data);
  },

  delete(id: number | string) {
    return api.delete<string>(`/roles/${id}`);
  },
};
