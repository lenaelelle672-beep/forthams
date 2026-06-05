/**
 * @file api/intake.ts
 * @description 入库验收 API 模块
 */

import http from '@/utils/http';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type { IntakeOrder, CreateIntakeOrderRequest, UpdateIntakeOrderRequest, IntakeOrderListQuery, IntakeCheckItem } from '@/types/intake';

/** 获取入库验收单列表（分页） */
export const getIntakeOrders = (params?: IntakeOrderListQuery) =>
  http.get<PaginatedResponse<IntakeOrder>>('/intake-orders', { params });

/** 获取验收单详情 */
export const getIntakeOrder = (id: number) =>
  http.get<ApiResponse<IntakeOrder>>(`/intake-orders/${id}`);

/** 创建验收单 */
export const createIntakeOrder = (data: CreateIntakeOrderRequest) =>
  http.post<ApiResponse<IntakeOrder>>('/intake-orders', data);

/** 更新验收单 */
export const updateIntakeOrder = (id: number, data: UpdateIntakeOrderRequest) =>
  http.put<ApiResponse<IntakeOrder>>(`/intake-orders/${id}`, data);

/** 删除验收单 */
export const deleteIntakeOrder = (id: number) =>
  http.delete<ApiResponse<void>>(`/intake-orders/${id}`);

/** 提交验收单（草稿→待质检） */
export const submitIntakeOrder = (id: number) =>
  http.post<ApiResponse<IntakeOrder>>(`/intake-orders/${id}/submit`);

/** 填写检查结果 */
export const inspectIntakeOrder = (id: number, checkItems: IntakeCheckItem[]) =>
  http.post<ApiResponse<IntakeOrder>>(`/intake-orders/${id}/inspect`, checkItems);

/** 验收通过 */
export const acceptIntakeOrder = (id: number) =>
  http.post<ApiResponse<IntakeOrder>>(`/intake-orders/${id}/accept`);

/** 驳回 */
export const rejectIntakeOrder = (id: number, reason?: string) =>
  http.post<ApiResponse<IntakeOrder>>(`/intake-orders/${id}/reject`, null, { params: { reason } });

/** 取消验收单 */
export const cancelIntakeOrder = (id: number) =>
  http.post<ApiResponse<IntakeOrder>>(`/intake-orders/${id}/cancel`);
