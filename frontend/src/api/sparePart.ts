/**
 * @file api/sparePart.ts
 * @description 备品备件 API
 */

import http from '@/utils/http';
import type { PageData } from '@/types/common';
import type { SparePart, SparePartUsage, CreateSparePartRequest, UpdateSparePartRequest, ConsumePartRequest, PurchaseSuggestion } from '@/types/sparePart';

/** 获取备件列表 */
export const getSparePartList = (params?: { page?: number; pageSize?: number; keyword?: string }) =>
  http.get<PageData<SparePart>>('/spare-parts', { params });

/** 获取备件详情 */
export const getSparePartDetail = (id: number) =>
  http.get<SparePart>(`/spare-parts/${id}`);

/** 创建备件 */
export const createSparePart = (data: CreateSparePartRequest) =>
  http.post<SparePart>('/spare-parts', data);

/** 更新备件 */
export const updateSparePart = (id: number, data: UpdateSparePartRequest) =>
  http.put<SparePart>(`/spare-parts/${id}`, data);

/** 删除备件 */
export const deleteSparePart = (id: number) =>
  http.delete<void>(`/spare-parts/${id}`);

/** 领用备件 */
export const consumePart = (data: ConsumePartRequest) =>
  http.post<SparePartUsage>('/spare-part-usages', data);

/** 按工单查询领用记录 */
export const getUsageByWorkOrder = (workOrderId: number) =>
  http.get<SparePartUsage[]>(`/spare-parts/by-work-order/${workOrderId}`);

/** 按备件查询领用记录 */
export const getUsageBySparePart = (sparePartId: number) =>
  http.get<SparePartUsage[]>(`/spare-parts/${sparePartId}/usages`);

/** 获取安全库存告警 */
export const getLowStockAlerts = () =>
  http.get<SparePart[]>('/spare-parts/low-stock');

/** 获取采购建议 */
export const getPurchaseSuggestions = () =>
  http.get<PurchaseSuggestion[]>('/spare-parts/purchase-suggestions');
