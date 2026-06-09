/**
 * @file api/purchaseOrder.ts
 * @description 采购订单管理 API
 * 对应后端：PurchaseOrderController (/purchase-orders)
 */

import http from '@/utils/http';
import type { PaginatedResponse } from '@/types/common';

export interface PurchaseOrderItem {
  id?: number;
  orderId?: number;
  assetName: string;
  categoryId?: number;
  quantity: number;
  unitPrice: number;
  amount?: number;
  specification?: string;
  remark?: string;
  categoryName?: string;
}

export interface PurchaseOrder {
  id: number;
  orderNo: string;
  orderName: string;
  vendorId: number;
  vendorName?: string;
  totalAmount: number;
  status: string;
  orderDate?: string;
  expectedDate?: string;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrderListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  orderNo?: string;
  status?: string;
  vendorId?: number;
  startDate?: string;
  endDate?: string;
}

export interface CreatePurchaseOrderRequest {
  orderNo: string;
  orderName: string;
  vendorId: number;
  totalAmount?: number;
  orderDate?: string;
  expectedDate?: string;
  remark?: string;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderStats {
  totalOrders: number;
  pendingApproval: number;
  approved: number;
}

export interface PurchaseOrderDetail {
  order: PurchaseOrder;
  items: PurchaseOrderItem[];
}

/** 采购订单列表 */
export const getPurchaseOrderList = (params?: PurchaseOrderListQuery) =>
  http.get<PaginatedResponse<PurchaseOrder>>('/purchase-orders', { params });

/** 采购订单详情（含明细） */
export const getPurchaseOrderDetail = (id: number) =>
  http.get<PurchaseOrderDetail>(`/purchase-orders/${id}`);

/** 采购订单明细 */
export const getPurchaseOrderItems = (id: number) =>
  http.get<PurchaseOrderItem[]>(`/purchase-orders/${id}/items`);

/** 新建采购订单 */
export const createPurchaseOrder = (data: CreatePurchaseOrderRequest) =>
  http.post<PurchaseOrder>('/purchase-orders', data);

/** 更新采购订单 */
export const updatePurchaseOrder = (id: number, data: Partial<CreatePurchaseOrderRequest>) =>
  http.put<PurchaseOrder>(`/purchase-orders/${id}`, data);

/** 删除采购订单 */
export const deletePurchaseOrder = (id: number) =>
  http.delete<void>(`/purchase-orders/${id}`);

/** 提交审批 */
export const submitPurchaseOrder = (id: number) =>
  http.post<PurchaseOrder>(`/purchase-orders/${id}/submit`);

/** 审批通过 */
export const approvePurchaseOrder = (id: number) =>
  http.post<PurchaseOrder>(`/purchase-orders/${id}/approve`);

/** 收货 */
export const receivePurchaseOrder = (id: number) =>
  http.post<PurchaseOrder>(`/purchase-orders/${id}/receive`);

/** 取消 */
export const cancelPurchaseOrder = (id: number) =>
  http.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`);

/** 统计 */
export const getPurchaseOrderStats = () =>
  http.get<PurchaseOrderStats>('/purchase-orders/stats');
