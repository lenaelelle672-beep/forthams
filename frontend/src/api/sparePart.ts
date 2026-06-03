/**
 * @file api/sparePart.ts
 * @description 备品备件 API
 */

import http from '@/utils/http';
import type { ApiResponse, PageData } from '@/types/common';
import type { SparePart, SparePartUsage, CreateSparePartRequest, UpdateSparePartRequest, ConsumePartRequest, PurchaseSuggestion } from '@/types/sparePart';

/** 获取备件列表 */
export const getSparePartList = (params?: { page?: number; pageSize?: number; keyword?: string }) =>
  http.get<ApiResponse<PageData<SparePart>>>('/spare-parts', { params });

/** 获取备件详情 */
export const getSparePartDetail = (id: number) =>
  http.get<ApiResponse<SparePart>>(`/spare-parts/${id}`);

/** 创建备件 */
export const createSparePart = (data: CreateSparePartRequest) =>
  http.post<ApiResponse<SparePart>>('/spare-parts', data);

/** 更新备件 */
export const updateSparePart = (id: number, data: UpdateSparePartRequest) =>
  http.put<ApiResponse<SparePart>>(`/spare-parts/${id}`, data);

/** 删除备件 */
export const deleteSparePart = (id: number) =>
  http.delete<ApiResponse<void>>(`/spare-parts/${id}`);

/** 领用备件 */
export const consumePart = (data: ConsumePartRequest) =>
  http.post<ApiResponse<SparePartUsage>>('/spare-part-usages', data);

/** 按工单查询领用记录 */
export const getUsageByWorkOrder = (workOrderId: number) =>
  http.get<ApiResponse<SparePartUsage[]>>(`/spare-parts/by-work-order/${workOrderId}`);

/** 按备件查询领用记录 */
export const getUsageBySparePart = (sparePartId: number) =>
  http.get<ApiResponse<SparePartUsage[]>>(`/spare-parts/${sparePartId}/usages`);

/** 获取安全库存告警 */
export const getLowStockAlerts = () =>
  http.get<ApiResponse<SparePart[]>>('/spare-parts/low-stock');

/** 获取采购建议 */
export const getPurchaseSuggestions = () =>
  http.get<ApiResponse<PurchaseSuggestion[]>>('/spare-parts/purchase-suggestions');
