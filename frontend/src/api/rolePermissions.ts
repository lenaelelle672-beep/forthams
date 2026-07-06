import { api } from '../app/utils/api';

export interface RolePermissionCatalogPermission {
  permissionId: number;
  permissionName: string;
  permissionCode: string;
  description?: string | null;
  status?: number | null;
}

export interface RolePermissionCatalogRole {
  roleId: number;
  roleName: string;
  roleCode: string;
  description?: string | null;
  status?: number | null;
  permissionCount: number;
  permissions: RolePermissionCatalogPermission[];
}

export interface RolePermissionCatalogSummary {
  roleCount: number;
  permissionInventoryCount: number;
  rolePermissionBindingCount: number;
  boundPermissionCount: number;
  unboundPermissionCount: number;
  rolesWithoutPermissionsCount: number;
}

export interface RolePermissionCatalog {
  roles: RolePermissionCatalogRole[];
  permissions: RolePermissionCatalogPermission[];
  summary: RolePermissionCatalogSummary;
  riskTips: string[];
  readonlyNotice: string;
}

const ROLE_PERMISSION_CATALOG = '/system/role-permissions/catalog';

export function getRolePermissionCatalog() {
  return api.get<RolePermissionCatalog>(ROLE_PERMISSION_CATALOG);
}
