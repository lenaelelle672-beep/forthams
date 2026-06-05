import http from '@/utils/http';
import type {
  Insurance,
  InsuranceClaim,
  InsuranceQueryParams
} from '@/types/insurance';
import type { PageResult } from '@/types/common';

export const insuranceApi = {
  list: (params: InsuranceQueryParams) =>
    request.get<PageResult<Insurance>>('/insurance/list', { params }),

  getById: (id: number) =>
    request.get<Insurance>(`/insurance/${id}`),

  create: (data: Insurance) =>
    request.post<Insurance>('/insurance', data),

  update: (id: number, data: Insurance) =>
    request.put<Insurance>(`/insurance/${id}`, data),

  delete: (id: number) =>
    request.delete<void>(`/insurance/${id}`),

  getUpcomingExpirations: (days: number = 30) =>
    request.get<Insurance[]>('/insurance/upcoming-expirations', {
      params: { days }
    }),

  getTotalPremiumByAssetId: (assetId: number) =>
    request.get<number>(`/insurance/assets/${assetId}/total-premium`)
};

export const claimApi = {
  list: (insuranceId?: number, status?: string, pageNum: number = 1, pageSize: number = 10) =>
    request.get<PageResult<InsuranceClaim>>(insuranceId ? `/insurance/${insuranceId}/claims` : '/insurance/claims', {
      params: { status, pageNum, pageSize }
    }),

  getById: (id: number) =>
    request.get<InsuranceClaim>(`/insurance/claims/${id}`),

  create: (data: InsuranceClaim) =>
    request.post<InsuranceClaim>('/insurance/claims', data),

  update: (id: number, data: InsuranceClaim) =>
    request.put<InsuranceClaim>(`/insurance/claims/${id}`, data),

  delete: (id: number) =>
    request.delete<void>(`/insurance/claims/${id}`)
};