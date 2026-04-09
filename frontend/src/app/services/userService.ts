import { api } from "../utils/api";

export interface UserRecord {
  id: number;
  [key: string]: unknown;
}

export const userService = {
  list(params?: Record<string, unknown>) {
    return api.get<UserRecord[]>("/users/list", { params });
  },

  getById(id: number | string) {
    return api.get<UserRecord>(`/users/${id}`);
  },

  create(data: Record<string, unknown>) {
    return api.post<UserRecord>("/users", data);
  },

  update(id: number | string, data: Record<string, unknown>) {
    return api.put<UserRecord>(`/users/${id}`, data);
  },

  resetPassword(id: number | string) {
    return api.put<UserRecord>(`/users/${id}/reset-password`);
  },

  updateStatus(id: number | string, status: string) {
    return api.put<UserRecord>(`/users/${id}/status`, { status });
  },

  delete(id: number | string) {
    return api.delete<string>(`/users/${id}`);
  },
};
