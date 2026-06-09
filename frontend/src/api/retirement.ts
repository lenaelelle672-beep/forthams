/**
 * @file api/retirement.ts
 * @description 资产退役 API
 * 对应后端：RetirementController (/retirement)
 */

import http from '@/utils/http';
import type { PaginatedResponse } from '@/types/common';

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
  estimatedResidualValue?: number;
  deptId?: number;
  deptName?: string;
  remark?: string;
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
  notes?: string;
  attachments?: string[];
}

export interface RetirementListQuery {
  page?: number;
  pageSize?: number;
  status?: RetirementStatus;
  keyword?: string;
  deptId?: number;
}

/** 提交退役申请 */
export const createRetirement = (data: CreateRetirementRequest) =>
  http.post<RetirementApplication>('/retirement/apply', {
    assetId: data.assetId,
    reason: data.reason,
    estimatedResidualValue: data.residualValue,
    remark: data.notes,
    attachments: data.attachments?.join(','),
  });

/** 获取退役申请列表 */
export const getRetirementList = (params?: RetirementListQuery) =>
  http.get<PaginatedResponse<RetirementApplication>>('/retirement/list', { params });

/** 获取退役申请详情 */
export const getRetirementDetail = (id: number) =>
  http.get<RetirementApplication>(`/retirement/${id}`);

/** 获取资产退役历史 */
export const getAssetRetirementHistory = (assetId: number) =>
  http.get<RetirementApplication[]>(`/retirement/asset/${assetId}`);

/** 撤回退役申请 */
export const withdrawRetirement = (id: number) =>
  http.post<RetirementApplication>(`/retirement/${id}/cancel`);

/** 审批通过退役申请 */
export const approveRetirement = (id: number) =>
  http.post<RetirementApplication>(`/retirement/${id}/approve`);

/** 驳回退役申请 */
export const rejectRetirement = (id: number, reason: string) =>
  http.post<RetirementApplication>(`/retirement/${id}/reject`, { reason });
