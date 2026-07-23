import { type ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * 权限校验 Hook
 * 用于在组件内判断当前用户是否拥有特定操作权限。
 *
 * 对应 SPEC B-5 · 安全与合规约束：
 *   - 页面路由守卫：仅拥有 `asset:import` 或 `asset:export` 权限的角色可访问对应 Tab
 *   - ATB-08：仅导出权限用户只能看到导出 Tab；无任何权限用户看到 403 提示
 */
export const usePermission = () => {
  const { user, loading } = useAuth();

  /** 获取用户拥有的所有权限标识符列表 */
  const permissions: string[] = user?.permissions ?? [];

  /**
   * 检查是否拥有指定的任一权限（OR 语义）。
   * @param requiredPermissions - 需要的权限标识数组，任意一个匹配即通过
   * @returns 当 auth 尚在加载中时返回 false
   */
  const hasPermission = (requiredPermissions: string[]): boolean => {
    if (loading) return false;
    return requiredPermissions.some((p) => permissions.includes(p));
  };

  /**
   * 检查是否拥有全部指定的权限（AND 语义）。
   * @param requiredPermissions - 需要的权限标识数组，必须全部匹配
   * @returns 当 auth 尚在加载中时返回 false
   */
  const hasAllPermissions = (requiredPermissions: string[]): boolean => {
    if (loading) return false;
    return requiredPermissions.every((p) => permissions.includes(p));
  };

  /**
   * 检查是否拥有特定权限前缀（支持通配符，如 `'asset:*'`）。
   * @param prefix - 权限前缀字符串，可含 `*` 通配符
   */
  const hasPermissionPrefix = (prefix: string): boolean => {
    if (loading) return false;
    const basePrefix = prefix.replace('*', '');
    return permissions.some((p) => p === prefix || p.startsWith(basePrefix));
  };

  // ─── 资产导入导出专用 ───────────────────────────────────────

  /**
   * 判断当前用户是否可访问资产导入导出页面（任一权限即可）。
   * 对应 SPEC B-5：拥有 `asset:import` 或 `asset:export` 之一即可进入页面。
   */
  const canAccessAssetImportExport = (): boolean => {
    return hasPermission(['asset:import', 'asset:export']);
  };

  /**
   * 判断当前用户是否可看到「批量导入」Tab。
   * 需要 `asset:import` 权限。
   */
  const canSeeImportTab = (): boolean => {
    return hasPermission(['asset:import']);
  };

  /**
   * 判断当前用户是否可看到「批量导出」Tab。
   * 需要 `asset:export` 权限。
   */
  const canSeeExportTab = (): boolean => {
    return hasPermission(['asset:export']);
  };

  /**
   * 针对具体操作的细粒度权限校验。
   * @param action - 操作类型：import / export / delete / edit
   */
  const canPerformAction = (action: 'import' | 'export' | 'delete' | 'edit'): boolean => {
    if (loading) return false;
    switch (action) {
      case 'import':
        return permissions.includes('asset:import');
      case 'export':
        return permissions.includes('asset:export');
      case 'delete':
        return permissions.includes('asset:delete');
      case 'edit':
        return permissions.includes('asset:edit') || permissions.includes('asset:admin');
      default:
        return false;
    }
  };

  /**
   * 检查是否具有资产管理模块的完整权限（含导入导出）。
   */
  const isAssetManager = (): boolean => {
    return hasAllPermissions(['asset:read', 'asset:import', 'asset:export']);
  };

  return {
    loading,
    permissions,
    hasPermission,
    hasAllPermissions,
    hasPermissionPrefix,
    canAccessAssetImportExport,
    canSeeImportTab,
    canSeeExportTab,
    canPerformAction,
    isAssetManager,
  };
};

/**
 * 权限保护容器组件。
 * 用于包裹需要权限控制的页面或子组件，无权限时渲染 fallback。
 *
 * @param requiredPermissions - 需要的权限标识数组
 * @param children - 有权限时渲染的内容
 * @param fallback - 无权限时渲染的替代内容，默认为 null
 * @param requireAll - 是否要求全部权限（AND 语义），默认 false（OR 语义）
 */
export const PermissionGuard = ({
  requiredPermissions,
  children,
  fallback = null,
  requireAll = false,
}: {
  requiredPermissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
  requireAll?: boolean;
}): ReactNode => {
  const { hasPermission, hasAllPermissions, loading } = usePermission();

  if (loading) return null;

  const authorized = requireAll
    ? hasAllPermissions(requiredPermissions)
    : hasPermission(requiredPermissions);

  return authorized ? <>{children}</> : fallback;
};

/**
 * 路由守卫 Hook。
 * 返回当前路由是否被授权的状态对象，供页面组件进行重定向或 403 渲染。
 *
 * 与其返回一个闭包函数（存在陈旧捕获问题），不如直接返回判定结果，
 * 由调用方在合适的时机读取。
 *
 * @param requiredPermissions - 需要的权限标识数组
 * @param requireAll - 是否要求全部权限（AND 语义），默认 false
 * @returns `{ isAuthorized, loading }` — isAuthorized 为 true 表示允许访问
 */
export const useRouteGuard = (
  requiredPermissions: string[],
  requireAll = false,
): { isAuthorized: boolean; loading: boolean } => {
  const { hasPermission, hasAllPermissions, loading } = usePermission();

  const isAuthorized = requireAll
    ? hasAllPermissions(requiredPermissions)
    : hasPermission(requiredPermissions);

  return { isAuthorized, loading };
};

/**
 * 资产导入导出页面专属路由守卫 Hook。
 * 封装了 SPEC B-5 的权限判断：用户需至少拥有 `asset:import` 或 `asset:export` 之一。
 * 返回 `isForbidden = true` 时页面应渲染 403 提示或重定向。
 */
export const useAssetImportExportGuard = (): {
  isForbidden: boolean;
  loading: boolean;
  canImport: boolean;
  canExport: boolean;
} => {
  const { loading, canSeeImportTab, canSeeExportTab, canAccessAssetImportExport } = usePermission();

  return {
    isForbidden: !loading && !canAccessAssetImportExport(),
    loading,
    canImport: canSeeImportTab(),
    canExport: canSeeExportTab(),
  };
};