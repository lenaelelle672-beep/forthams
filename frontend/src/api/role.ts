import http from '@/utils/http';

export interface RoleItem {
  id: number;
  roleName: string;
  roleCode: string;
  description?: string | null;
  createTime?: string;
}

export interface RoleCreatePayload {
  roleName: string;
  roleCode: string;
  description?: string;
}

export interface RoleUpdatePayload {
  roleName?: string;
  roleCode?: string;
  description?: string;
}

export function getRoleList(page = 1, pageSize = 20) {
  return http.get<{ records: RoleItem[]; total: number }>('/roles/list', { params: { page, pageSize } });
}
export function getAllRoles() {
  return http.get<RoleItem[]>('/roles/all');
}
export function createRole(data: RoleCreatePayload) {
  return http.post<RoleItem>('/roles', data);
}
export function updateRole(id: number, data: RoleUpdatePayload) {
  return http.put<RoleItem>(`/roles/${id}`, data);
}
export function deleteRole(id: number) {
  return http.delete<void>(`/roles/${id}`);
}
