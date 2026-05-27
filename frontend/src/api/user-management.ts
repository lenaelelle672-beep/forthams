import http from '@/utils/http';

export interface UserItem {
  id: number;
  username: string;
  realName: string;
  email?: string;
  phone?: string;
  deptId?: number;
  deptName?: string;
  remark?: string;
  loginIp?: string;
  loginDate?: string;
  status: number;
  createTime?: string;
  updateTime?: string;
}

export interface UserDetail extends UserItem {
  roleIds?: number[];
  roles?: { id: number; roleCode: string; roleName: string }[];
  roleCodes?: string[];
  postIds?: number[];
}

/** 分页查询用户列表 */
export function getUserList(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  deptId?: number;
  status?: number;
}) {
  return http.get<{ records: UserItem[]; total: number }>('/user-management/list', { params });
}

/** 获取用户详情（含角色信息） */
export function getUserDetail(id: number) {
  return http.get<UserDetail>(`/user-management/${id}/detail`);
}

/** 获取用户的角色ID列表 */
export function getUserRoleIds(id: number) {
  return http.get<number[]>(`/user-management/${id}/roles`);
}

/** 为用户分配角色 */
export function assignUserRoles(userId: number, roleIds: number[]) {
  return http.put<void>(`/user-management/${userId}/roles`, { roleIds });
}

/** 创建用户 */
export function createUser(data: {
  username: string;
  password?: string;
  realName: string;
  email?: string;
  phone?: string;
  deptId?: number;
  status?: number;
  remark?: string;
  roleIds?: number[];
}) {
  return http.post<UserItem>('/user-management', data);
}

/** 更新用户 */
export function updateUser(id: number, data: {
  realName?: string;
  email?: string;
  phone?: string;
  deptId?: number;
  status?: number;
  remark?: string;
  roleIds?: number[];
}) {
  return http.put<UserItem>(`/user-management/${id}`, data);
}

/** 删除用户 */
export function deleteUser(id: number) {
  return http.delete<void>(`/user-management/${id}`);
}

/** 重置密码（默认 123456） */
export function resetPassword(id: number) {
  return http.put<void>(`/user-management/${id}/reset-password`);
}

/** 修改用户状态 */
export function updateUserStatus(id: number, status: number) {
  return http.put<void>(`/user-management/${id}/status`, { status });
}
