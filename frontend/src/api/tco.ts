/**
 * @file api/tco.ts
 * @description TCO 全生命周期成本 API 封装
 */
import http from '@/utils/http';
import type { TcoResult, TcoTrend, TcoCompare } from '@/types/tco';

export const getAssetTco = (assetId: number) =>
  http.get<TcoResult>('/tco/asset/' + assetId);

export const getDepartmentTco = (deptId: number) =>
  http.get<TcoResult[]>('/tco/department/' + deptId);

export const getCategoryTco = (categoryId: number) =>
  http.get<TcoResult[]>('/tco/category/' + categoryId);

export const getTcoTrend = (assetId: number, months?: number) =>
  http.get<TcoTrend[]>('/tco/trend', { params: { assetId, months } });

export const getTcoCompare = (categoryId: number) =>
  http.get<TcoCompare[]>('/tco/compare/' + categoryId);

export const getTcoHistory = (assetId: number, params?: any) =>
  http.get<any>('/tco/history/' + assetId, { params });
