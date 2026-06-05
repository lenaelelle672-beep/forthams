/**
 * @file api/vendor.ts
 * @description 供应商管理 API
 * 对应后端：VendorController (/vendors)
 */

import http from '@/utils/http';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type { Vendor } from '@/types/common';

export interface VendorListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: number;
}

export interface CreateVendorRequest {
  name: string;
  vendorCode?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
}

/** 供应商列表 */
export const getVendorList = (params?: VendorListQuery) =>
  http.get<PaginatedResponse<Vendor>>('/vendors', { params });

/** 供应商详情 */
export const getVendorDetail = (id: number) =>
  http.get<ApiResponse<Vendor>>(`/vendors/${id}`);

/** 新建供应商 */
export const createVendor = (data: CreateVendorRequest) =>
  http.post<ApiResponse<Vendor>>('/vendors', data);

/** 更新供应商 */
export const updateVendor = (id: number, data: Partial<CreateVendorRequest>) =>
  http.put<ApiResponse<Vendor>>(`/vendors/${id}`, data);

/** 删除供应商 */
export const deleteVendor = (id: number) =>
  http.delete<ApiResponse<void>>(`/vendors/${id}`);
