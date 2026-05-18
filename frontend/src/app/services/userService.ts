import { api } from "../utils/api";

export interface UserRecord {
  id: number;
  username?: string;
  realName?: string;
  email?: string;
  phone?: string;
  deptId?: number;
  status?: number;
  roleIds?: number[];
  roles?: Array<{ id: number; roleCode: string; roleName: string }>;
  roleCodes?: string[];
  [key: string]: unknown;
}

export const userService = {
  list(params?: Record<string, unknown>) {
    return api.get<UserRecord[]>("/users/list", { params });
  },

  /** 关键词搜索用户（流程设计器审批人选择器使用） */
  search(keyword?: string) {
    return api.get<UserRecord[]>("/users/search", { params: keyword ? { keyword } : {} });
  },

  getById(id: number | string) {
    return api.get<UserRecord>(`/users/${id}`);
  },

  /** 获取用户详情（含角色信息） */
  getDetail(id: number | string) {
    return api.get<Record<string, unknown>>(`/users/${id}/detail`);
  },

  /** 获取用户角色ID列表 */
  getUserRoles(id: number | string) {
    return api.get<number[]>(`/users/${id}/roles`);
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

  updateStatus(id: number | string, status: number | string) {
    return api.put<UserRecord>(`/users/${id}/status`, { status });
  },

  delete(id: number | string) {
    return api.delete<string>(`/users/${id}`);
  },
};
