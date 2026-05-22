/**
 * @file api/retirement.ts
 * @description 资产退役 API
 * 对应后端：RetirementController (/retirement, /v1/retirement)
 */

import http from '@/utils/http';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export interface RetirementApplication {
  id: number;
  assetId: number;
  assetNo?: string;
  assetName?: string;
  applicantId: number;
  applicantName?: string;
  reason: string;
  status: RetirementStatus;
  residualValue?: number;
  approvalRecords?: RetirementApprovalRecord[];
  createdAt: string;
  updatedAt: string;
}

export type RetirementStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVING'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'COMPLETED';

export interface RetirementApprovalRecord {
  id: number;
  action: 'APPROVE' | 'REJECT';
  operatorName: string;
  comment?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface CreateRetirementRequest {
  assetId: number;
  reason: string;
  residualValue?: number;
  attachments?: string[];
}

export interface RetirementListQuery {
  page?: number;
  pageSize?: number;
  status?: RetirementStatus;
  keyword?: string;
}

/** 提交退役申请 */
export const createRetirement = (data: CreateRetirementRequest) =>
  http.post<ApiResponse<RetirementApplication>>('/retirement', data);

/** 获取退役申请列表 */
export const getRetirementList = (params?: RetirementListQuery) =>
  http.get<PaginatedResponse<RetirementApplication>>('/retirement', { params });

/** 获取退役申请详情 */
export const getRetirementDetail = (id: number) =>
  http.get<ApiResponse<RetirementApplication>>(`/retirement/${id}`);

/** 获取资产退役历史 */
export const getAssetRetirementHistory = (assetId: number) =>
  http.get<ApiResponse<RetirementApplication[]>>(`/retirement/asset/${assetId}`);

/** 撤回退役申请 */
export const withdrawRetirement = (id: number) =>
  http.post<ApiResponse<void>>(`/retirement/${id}/withdraw`);

/** 审批通过退役申请 */
export const approveRetirement = (id: number) =>
  http.post<ApiResponse<void>>(`/retirement/${id}/approve`);

/** 驳回退役申请 */
export const rejectRetirement = (id: number, reason: string) =>
  http.post<ApiResponse<void>>(`/retirement/${id}/reject`, { reason });
