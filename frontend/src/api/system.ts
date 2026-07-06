/**
 * @file api/system.ts
 * @description 系统管理 API — 菜单、用户、角色相关接口
 *
 * 对应后端：
 *   - MenuController (/menus)
 *   - UserManagementController (/users)
 *   - RoleController (/roles)
 */

import http from '@/utils/http';
import type { MenuNode } from '@/types/common';

// ─── 菜单 ────────────────────────────────────────────────────────────────────

/** 获取当前用户菜单树和权限码 */
export const getCurrentMenus = () =>
  http.get<{ menus: MenuNode[]; permissions: string[]; roles: string[] }>('/menus/current');

/** 获取完整菜单树（管理员） */
export const getMenuTree = () =>
  http.get<MenuNode[]>('/menus/tree');

// ─── 用户管理 ────────────────────────────────────────────────────────────────

export interface UserItem {
  id: number;
  username: string;
  realName: string;
  email?: string;
  phone?: string;
  status: number;
  deptId?: number;
  createTime?: string;
}

export interface UserListResponse {
  records: UserItem[];
  total: number;
  size: number;
  current: number;
}

/** 分页查询用户列表 */
export const getUserList = (params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  deptId?: number;
  status?: number;
}) => http.get<UserListResponse>('/users/list', { params });

/** 创建用户 */
export const createUser = (data: {
  username: string;
  password: string;
  realName: string;
  email?: string;
  phone?: string;
  deptId?: number;
  roleIds?: number[];
}) => http.post<{ id: number }>('/users', data);

/** 更新用户 */
export const updateUser = (id: number, data: Record<string, unknown>) =>
  http.put<void>(`/users/${id}`, data);

/** 删除用户 */
export const deleteUser = (id: number) =>
  http.delete<void>(`/users/${id}`);

/** 重置用户密码 */
export const resetUserPassword = (id: number) =>
  http.put<void>(`/users/${id}/reset-password`);

/** 获取用户角色ID列表 */
export const getUserRoles = (userId: number) =>
  http.get<number[]>(`/users/${userId}/roles`);

/** 分配用户角色 */
export const assignUserRoles = (userId: number, roleIds: number[]) =>
  http.put<void>(`/users/${userId}/roles`, { roleIds });

/** 获取当前用户信息（含 permissions） */
export const getCurrentUserInfo = () =>
  http.get<{
    userId: number;
    username: string;
    realName: string;
    roles: string[];
    permissions: string[];
    deptId?: number;
    deptName?: string;
  }>('/users/current');
