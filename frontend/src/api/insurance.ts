import http from '@/utils/http';
import type {
  Insurance,
  InsuranceClaim,
  InsuranceQueryParams
} from '@/types/insurance';
import type { PageData } from '@/types/common';

export const insuranceApi = {
  list: (params: InsuranceQueryParams) =>
    http.get<PageData<Insurance>>('/insurance/list', { params }),

  getById: (id: number) =>
    http.get<Insurance>(`/insurance/${id}`),

  create: (data: Insurance) =>
    http.post<Insurance>('/insurance', data),

  update: (id: number, data: Insurance) =>
    http.put<Insurance>(`/insurance/${id}`, data),

  delete: (id: number) =>
    http.delete<void>(`/insurance/${id}`),

  getUpcomingExpirations: (days: number = 30) =>
    http.get<Insurance[]>('/insurance/upcoming-expirations', {
      params: { days }
    }),

  getTotalPremiumByAssetId: (assetId: number) =>
    http.get<number>(`/insurance/assets/${assetId}/total-premium`)
};

export const claimApi = {
  list: (insuranceId?: number, status?: string, pageNum: number = 1, pageSize: number = 10) =>
    http.get<PageData<InsuranceClaim>>(insuranceId ? `/insurance/${insuranceId}/claims` : '/insurance/claims', {
      params: { status, pageNum, pageSize }
    }),

  getById: (id: number) =>
    http.get<InsuranceClaim>(`/insurance/claims/${id}`),

  create: (data: InsuranceClaim) =>
    http.post<InsuranceClaim>('/insurance/claims', data),

  update: (id: number, data: InsuranceClaim) =>
    http.put<InsuranceClaim>(`/insurance/claims/${id}`, data),

  delete: (id: number) =>
    http.delete<void>(`/insurance/claims/${id}`)
};