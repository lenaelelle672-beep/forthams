/**
 * @file api/approval.ts
 * @description 审批流程 API
 * 对应后端：ApprovalController (/approvals)
 */

import http from '@/utils/http';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export interface ApprovalItem {
  id: number;
  businessId: number;
  businessType: string;
  applicantId: number;
  applicantName: string;
  deptName?: string;
  title: string;
  status: string;
  currentLevel?: number;
  version: number;
  createdAt: string;
  submittedAt?: string;
}

export interface ApprovalListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

export interface ApprovalActionRequest {
  version: number;
  comment?: string;
  rejectionReason?: string;
}

/** 获取审批列表 */
export const getApprovalList = (params?: ApprovalListQuery) =>
  http.get<PaginatedResponse<ApprovalItem>>('/approvals', { params });

/** 获取待审批列表 */
export const getPendingApprovals = (params?: Pick<ApprovalListQuery, 'page' | 'pageSize'>) =>
  http.get<PaginatedResponse<ApprovalItem>>('/approvals/pending', { params });

/** 获取审批详情 */
export const getApprovalDetail = (id: number) =>
  http.get<ApiResponse<ApprovalItem>>(`/approvals/${id}`);

/** 审批通过 */
export const approveItem = (id: number, data: ApprovalActionRequest) =>
  http.post<ApiResponse<void>>(`/approvals/${id}/approve`, data);

/** 审批驳回 */
export const rejectItem = (id: number, data: Required<Pick<ApprovalActionRequest, 'version' | 'rejectionReason'>> & { comment?: string }) =>
  http.post<ApiResponse<void>>(`/approvals/${id}/reject`, data);

/** 取消审批 */
export const cancelApproval = (id: number) =>
  http.post<ApiResponse<void>>(`/approvals/${id}/cancel`);

/** 获取待审批数量 */
export const getPendingCount = () =>
  http.get<ApiResponse<number>>('/approvals/pending/count');
