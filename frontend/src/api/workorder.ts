/**
 * @file api/workorder.ts
 * @description 工单管理 API — 全项目唯一工单接口定义
 *
 * 对应后端：WorkOrderController
 * 权威 endpoint 基础路径：/workorders（后端同时兼容 /work-orders、/v1/workorders）
 */

import http from '@/utils/http';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type {
  WorkOrder,
  WorkOrderListItem,
  WorkOrderListQuery,
  CreateWorkOrderRequest,
  ApproveWorkOrderRequest,
  RejectWorkOrderRequest,
  CancelWorkOrderRequest,
  WorkOrderDetailResponse,
} from '@/types/workorder';

// ── 工单 CRUD ─────────────────────────────────────────────────────────────────

/** 获取工单列表（分页） */
export const getWorkOrderList = (params?: WorkOrderListQuery) =>
  http.get<PaginatedResponse<WorkOrderListItem>>('/workorders', { params });

/** 获取工单详情（含审批记录） */
export const getWorkOrderDetail = (id: number) =>
  http.get<ApiResponse<WorkOrderDetailResponse>>(`/workorders/${id}`);

/** 创建工单 */
export const createWorkOrder = (data: CreateWorkOrderRequest) =>
  http.post<ApiResponse<WorkOrder>>('/workorders', data);

/** 更新工单（仅 DRAFT 状态可更新） */
export const updateWorkOrder = (id: number, data: Partial<CreateWorkOrderRequest>) =>
  http.put<ApiResponse<WorkOrder>>(`/workorders/${id}`, data);

/** 删除工单（仅 DRAFT 状态可删除） */
export const deleteWorkOrder = (id: number) =>
  http.delete<ApiResponse<void>>(`/workorders/${id}`);

// ── 工单状态流转 ───────────────────────────────────────────────────────────────

/** 提交工单（DRAFT → PENDING） */
export const submitWorkOrder = (id: number) =>
  http.post<ApiResponse<WorkOrder>>(`/workorders/${id}/submit`);

/** 审批通过 */
export const approveWorkOrder = (id: number, data: ApproveWorkOrderRequest) =>
  http.post<ApiResponse<WorkOrder>>(`/workorders/${id}/approve`, data);

/** 审批驳回 */
export const rejectWorkOrder = (id: number, data: RejectWorkOrderRequest) =>
  http.post<ApiResponse<WorkOrder>>(`/workorders/${id}/reject`, data);

/** 取消工单 */
export const cancelWorkOrder = (id: number, data: CancelWorkOrderRequest) =>
  http.post<ApiResponse<WorkOrder>>(`/workorders/${id}/operate`, {
    operation: 'cancel',
    ...data,
  });

// ── 审批工作台 ────────────────────────────────────────────────────────────────

/** 获取待我审批的工单列表（后端根据当前用户角色过滤） */
export const getPendingApprovals = (params?: { page?: number; pageSize?: number; keyword?: string }) =>
  http.get<PaginatedResponse<WorkOrderListItem>>('/workorders', {
    params: {
      ...params,
      status: 'APPROVING_LEVEL_1,APPROVING_LEVEL_2',
    },
  });
