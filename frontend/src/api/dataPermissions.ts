import { api } from '../app/utils/api';

export interface RoleDataScope {
  roleId: number;
  roleName: string;
  roleCode: string;
  dataScope: string;
  dataScopeLabel: string;
  customScope: boolean;
  customDeptIds?: number[];
  customDeptCount?: number;
  riskNote: string;
}

export interface DataPermissionCatalogSummary {
  roleCount: number;
  allScopeCount: number;
  restrictedScopeCount: number;
  customScopeCount: number;
}

export interface DataPermissionCatalog {
  roles: RoleDataScope[];
  summary: DataPermissionCatalogSummary;
  riskTips: string[];
  readOnlyNotice: string;
}

export function getDataPermissionCatalog() {
  return api.get<DataPermissionCatalog>('/system/data-permissions/catalog');
}

export function updateDataPermissionScope(roleId: number, dataScope: string) {
  return api.put<RoleDataScope>(`/system/data-permissions/roles/${roleId}/scope`, { dataScope });
}

export function updateDataPermissionDepts(roleId: number, deptIds: number[]) {
  return api.put<RoleDataScope>(`/system/data-permissions/roles/${roleId}/depts`, { deptIds });
}

export interface AssignableDept {
  id?: number;
  deptId?: number;
  deptName?: string;
  name?: string;
  children?: AssignableDept[];
}

export function listAssignableDepts() {
  return api.get<AssignableDept[]>('/depts/tree');
}
