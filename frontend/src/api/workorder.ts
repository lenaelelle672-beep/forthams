/**
 * @file api/workorder.ts
 * @description 工单管理 API — 全项目唯一工单接口定义
 *
 * 对应后端：WorkOrderController
 * 权威 endpoint 基础路径：/workorders（后端同时兼容 /work-orders、/v1/workorders）
 */

import http from '@/utils/http';
import type { PaginatedResponse } from '@/types/common';
import type {
  WorkOrder,
  WorkOrderListItem,
  WorkOrderListQuery,
  CreateWorkOrderRequest,
  ApproveWorkOrderRequest,
  RejectWorkOrderRequest,
  CancelWorkOrderRequest,
} from '@/types/workorder';

export interface WorkOrderHoldRecord {
  id?: number;
  workOrderId?: number;
  reason?: string;
  holdStartTime?: string;
  holdEndTime?: string;
  resumeTime?: string;
  resumeNote?: string;
  status?: string;
}

// ── 工单 CRUD ─────────────────────────────────────────────────────────────────

export const getWorkOrderList = (params?: WorkOrderListQuery) =>
  http.get<PaginatedResponse<WorkOrderListItem>>('/workorders', { params });

export const getWorkOrderDetail = (id: number) =>
  http.get<WorkOrder>(`/workorders/${id}`);

export const createWorkOrder = (data: CreateWorkOrderRequest) =>
  http.post<WorkOrder>('/workorders', data);

export const updateWorkOrder = (id: number, data: Partial<CreateWorkOrderRequest>) =>
  http.put<WorkOrder>(`/workorders/${id}`, data);

export const deleteWorkOrder = (id: number) =>
  http.delete<void>(`/workorders/${id}`);

// ── 工单状态流转 ───────────────────────────────────────────────────────────────

export const submitWorkOrder = (id: number) =>
  http.post<WorkOrder>(`/workorders/${id}/submit`);

export const approveWorkOrder = (id: number, data: ApproveWorkOrderRequest) =>
  http.post<WorkOrder>(`/workorders/${id}/approve`, data);

export const rejectWorkOrder = (id: number, data: RejectWorkOrderRequest) =>
  http.post<WorkOrder>(`/workorders/${id}/reject`, data);

export const cancelWorkOrder = (id: number, data: CancelWorkOrderRequest) =>
  http.post<WorkOrder>(`/workorders/${id}/operate`, {
    operation: 'cancel',
    ...data,
  });

// ── Phase 3: 挂起/恢复 ───────────────────────────────────────────────────────

export const holdWorkOrder = (id: number, data: { reason: string; holdEndTime?: string }) =>
  http.post<WorkOrderHoldRecord>(`/workorders/${id}/hold`, data);

export const resumeWorkOrder = (id: number, data: { note?: string }) =>
  http.post<WorkOrderHoldRecord>(`/workorders/${id}/resume`, data);

// ── Phase 3: 验收 ───────────────────────────────────────────────────────────

export const submitForAcceptance = (id: number, data?: { comment?: string }) =>
  http.post<WorkOrder>(`/workorders/${id}/submit-acceptance`, data ?? {});

export const acceptWorkOrder = (id: number, data?: { comment?: string }) =>
  http.post<WorkOrder>(`/workorders/${id}/accept`, data ?? {});

export const rejectAcceptance = (id: number, data?: { comment?: string }) =>
  http.post<WorkOrder>(`/workorders/${id}/reject-acceptance`, data ?? {});

// ── 审批工作台 ────────────────────────────────────────────────────────────────

export const getPendingApprovals = (params?: { page?: number; pageSize?: number; keyword?: string }) =>
  http.get<PaginatedResponse<WorkOrderListItem>>('/workorders', {
    params: {
      ...params,
      status: 'PENDING',
    },
  });
