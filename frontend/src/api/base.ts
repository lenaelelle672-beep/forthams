/**
 * @file api/base.ts
 * @description 基础数据 API（部门、位置、用户、角色）
 * 对应后端：DeptController、LocationController、UserManagementController、RoleController
 */

import http from '@/utils/http';
import type { PageData } from '@/types/common';
import type { Department, Location } from '@/types/common';

// ── 部门 ──────────────────────────────────────────────────────────────────────

/** 获取部门树 */
export const getDeptTree = () =>
  http.get<Department[]>('/depts/tree');

/** 获取所有部门（平铺） */
export const getDeptList = () =>
  http.get<Department[]>('/depts');

/** 获取部门详情 */
export const getDeptDetail = (id: number) =>
  http.get<Department>(`/depts/${id}`);

/** 创建部门 */
export const createDept = (data: { name?: string; deptCode?: string; parentId?: number; sortOrder?: number; leader?: string; phone?: string; status?: string }) =>
  http.post<Department>('/depts', data);

/** 更新部门 */
export const updateDept = (id: number, data: { name?: string; deptCode?: string; parentId?: number; sortOrder?: number; leader?: string; phone?: string; status?: string }) =>
  http.put<Department>(`/depts/${id}`, data);

/** 删除部门 */
export const deleteDept = (id: number) =>
  http.delete<void>(`/depts/${id}`);

// ── 位置 ──────────────────────────────────────────────────────────────────────

/** 获取位置树 */
export const getLocationTree = () =>
  http.get<Location[]>('/locations/tree');

/** 获取位置联级数据 */
export const getLocationCascade = () =>
  http.get<Location[]>('/locations/cascade');

/** 创建位置 */
export const createLocation = (data: { locationName: string; locationCode?: string; parentId?: number | null }) =>
  http.post<Location>('/locations', data);

/** 更新位置 */
export const updateLocation = (id: number, data: { locationName: string; locationCode?: string; parentId?: number | null }) =>
  http.put<Location>(`/locations/${id}`, data);

/** 删除位置 */
export const deleteLocation = (id: number) =>
  http.delete<void>(`/locations/${id}`);

// ── 用户管理 ──────────────────────────────────────────────────────────────────

export interface UserItem {
  id: number;
  username: string;
  realName?: string;
  phone?: string;
  email?: string;
  deptId?: number;
  deptName?: string;
  status: number;
  roles?: string[];
  createTime?: string;
}

export interface UserListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  deptId?: number;
  status?: number;
}

/** 用户列表 */
export const getUserList = (params?: UserListQuery) =>
  http.get<PageData<UserItem>>('/user-management/list', { params });

/** 用户详情 */
export const getUserDetail = (id: number) =>
  http.get<UserItem>(`/user-management/${id}`);

/** 创建用户 */
export const createUser = (data: Partial<UserItem> & { password?: string }) =>
  http.post<UserItem>('/user-management', data);

/** 更新用户 */
export const updateUser = (id: number, data: Partial<UserItem>) =>
  http.put<UserItem>(`/user-management/${id}`, data);

/** 删除用户 */
export const deleteUser = (id: number) =>
  http.delete<void>(`/user-management/${id}`);

/** 重置密码（默认 123456） */
export const resetPassword = (id: number) =>
  http.put<void>(`/user-management/${id}/reset-password`);
