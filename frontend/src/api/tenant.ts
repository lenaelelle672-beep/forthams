/**
 * @file api/tenant.ts
 * @description 租户管理 API
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
  [key: string]: unknown;
}

export interface TenantPayload {
  id: string;
  name: string;
  plan: string;
  maxUsers: number;
  maxAssets: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

export interface TenantList {
  records: TenantRecord[];
  total: number;
}

export const listTenants = (params?: { page?: number; pageSize?: number; keyword?: string }) =>
  http.get<TenantList>('/tenants', { params });

export const getCurrentTenant = () =>
  http.get<TenantRecord>('/tenants/current');

export const createTenant = (data: TenantPayload) =>
  http.post<TenantRecord>('/tenants', data);

export const updateTenant = (id: string, data: TenantPayload) =>
  http.put<TenantRecord>(`/tenants/${id}`, data);

export const suspendTenant = (id: string) =>
  http.put<void>(`/tenants/${id}/suspend`);

export const activateTenant = (id: string) =>
  http.put<void>(`/tenants/${id}/activate`);
