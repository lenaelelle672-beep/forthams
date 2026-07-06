import http from '@/utils/http';

export interface RoleItem {
  id: number;
  roleName: string;
  roleCode: string;
  description?: string | null;
  createTime?: string;
  dataScope?: number;
  status?: number;
  sortOrder?: number;
}

export interface RoleCreatePayload {
  roleName: string;
  roleCode: string;
  description?: string;
  sortOrder?: number;
  dataScope?: number;
}

export interface RoleUpdatePayload {
  roleName?: string;
  roleCode?: string;
  description?: string;
  sortOrder?: number;
  dataScope?: number;
}

export function getRoleList(page = 1, pageSize = 20) {
  return http.get<{ records: RoleItem[]; total: number }>('/roles/list', { params: { page, pageSize } });
}
export function getAllRoles() {
  return http.get<RoleItem[]>('/roles/all');
}
export function getRoleById(id: number) {
  return http.get<RoleItem>(`/roles/${id}`);
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

/** 分配角色菜单权限 */
export function assignRoleMenus(roleId: number, menuIds: number[]) {
  return http.put<void>(`/roles/${roleId}/menus`, { menuIds });
}

/** 分配角色部门数据权限 */
export function assignRoleDepts(roleId: number, deptIds: number[]) {
  return http.put<void>(`/roles/${roleId}/depts`, { deptIds });
}
