/**
 * @file api/menu.ts
 * @description 菜单管理 API — 对应后端 SysMenuController
 *
 * 管理后台接口前缀 /menus/admin（已修复路由冲突）
 * 当前用户菜单接口保持 /menus/current（返回 {menus, permissions, roles}）
 */

import http from '@/utils/http';

export interface MenuItem {
  id: number;
  menuName: string;
  parentId: number;
  sortOrder: number;
  path?: string;
  component?: string;
  routeName?: string;
  menuType: string; // M=目录 C=菜单 F=按钮
  visible: number;
  status: number;
  perms?: string;
  icon?: string;
  isFrame?: number;
  isCache?: number;
  createTime?: string;
  updateTime?: string;
  children?: MenuItem[];
}

/** 当前用户菜单响应格式（v2: 包含菜单树、权限码、角色） */
export interface CurrentMenusResponse {
  menus: MenuItem[];
  permissions: string[];
  roles: string[];
}

/** 获取菜单列表（管理后台） */
export const getMenuList = () =>
  http.get<MenuItem[]>('/menus/admin');

/** 获取菜单树（管理后台 treeselect） */
export const getMenuTree = () =>
  http.get<MenuItem[]>('/menus/admin/tree');

/** 获取当前用户菜单树、权限码和角色（前端侧边栏渲染） */
export const getCurrentMenus = () =>
  http.get<CurrentMenusResponse>('/menus/current');

/** 获取菜单详情 */
export const getMenuById = (id: number) =>
  http.get<MenuItem>(`/menus/admin/${id}`);

/** 新增菜单 */
export const createMenu = (data: Partial<MenuItem>) =>
  http.post<MenuItem>('/menus/admin', data);

/** 编辑菜单 */
export const updateMenu = (id: number, data: Partial<MenuItem>) =>
  http.put<MenuItem>(`/menus/admin/${id}`, data);

/** 删除菜单 */
export const deleteMenu = (id: number) =>
  http.delete<void>(`/menus/admin/${id}`);
