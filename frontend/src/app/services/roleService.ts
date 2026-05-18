import { api } from "../utils/api";

export interface RoleRecord {
  id: number;
  roleCode?: string;
  roleName?: string;
  description?: string;
  status?: number;
  [key: string]: unknown;
}

export const roleService = {
  /** 分页查询角色列表 */
  list(params?: Record<string, unknown>) {
    return api.get<RoleRecord[]>("/roles/list", { params });
  },

  /** 获取所有启用角色（流程设计器审批人选择器使用） */
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
