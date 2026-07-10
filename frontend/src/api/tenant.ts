/**
 * @file api/tenant.ts
 * @description 租户管理 API（V3 只读 catalog）
 *
 * 后端 SysTenantController 提供只读端点：list / current / detail / meta。
 * 新建、编辑、停用、启用等写操作不在 V3 只读边界内，已移除。
 */

import http from '@/utils/http';

export interface TenantRecord {
  id: string;
  name: string;
  plan: string;
  maxUsers: number;
  maxAssets: number;
  status: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface TenantList {
  records: TenantRecord[];
  total: number;
}

export interface TenantMeta {
  plans: string[];
  statuses: string[];
  readOnlyNotice: string;
}

export interface TenantQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
}

export const listTenants = (params?: TenantQuery) =>
  http.get<TenantList>('/tenants', { params });

export const getCurrentTenant = () =>
  http.get<TenantRecord>('/tenants/current');

export const getTenantDetail = (id: string) =>
  http.get<TenantRecord>(`/tenants/${id}`);

export const getTenantMeta = () =>
  http.get<TenantMeta>('/tenants/meta');

