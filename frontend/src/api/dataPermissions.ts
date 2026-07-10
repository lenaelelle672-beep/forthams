import { api } from '../app/utils/api';

export interface RoleDataScope {
  roleId: number;
  roleName: string;
  roleCode: string;
  dataScope: string;
  dataScopeLabel: string;
  customScope: boolean;
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
