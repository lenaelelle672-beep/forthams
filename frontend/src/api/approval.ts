/**
 * @file api/approval.ts
 * @description 审批流程 API
 * 对应后端：ApprovalController (/approvals)
 *
 * 字段说明（与 ApprovalProcess 实体对齐）：
 *   id, processNo, processType, businessId, businessData,
 *   tenantId, status, currentStep, applicantId, applyTime,
 *   createTime, updateTime
 *
 * 后端无 title / version / applicantName / deptName 字段，
 * 前端显示时用 processType 替代 businessType，用 processNo 替代编号。
 */

import http from '@/utils/http';
import type { PageData } from '@/types/common';

export interface ApprovalItem {
  id: number;
  processNo?: string;
  processType?: string;
  /** 兼容旧字段：部分地方用 businessType */
  businessType?: string;
  businessId?: number;
  businessData?: string;
  applicantId?: number;
  /** 后端不返回此字段，前端显示时 fallback 到 applicantId */
  applicantName?: string;
  deptName?: string;
  /** 后端不返回 title，前端用 processType 或 processNo 代替 */
  title?: string;
  status: string;
  currentStep?: number;
  /** 后端不返回 version */
  version?: number;
  applyTime?: string;
  createTime?: string;
  createdAt?: string;
  submittedAt?: string;
}

export interface ApprovalListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  processType?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  /** true = 只查当前登录用户发起的 */
  mine?: boolean;
}

export interface ApprovalActionRequest {
  version?: number;
  comment?: string;
  rejectionReason?: string;
}

/** 获取审批列表 */
export const getApprovalList = (params?: ApprovalListQuery) =>
  http.get<PageData<ApprovalItem>>('/approvals', { params });

/** 获取待审批列表 */
export const getPendingApprovals = (params?: Pick<ApprovalListQuery, 'page' | 'pageSize'>) =>
  http.get<PageData<ApprovalItem>>('/approvals/pending', { params });

/** 获取审批详情 */
export const getApprovalDetail = (id: number) =>
  http.get<unknown>(`/approvals/${id}`);

/** 审批通过 */
export const approveItem = (id: number, data: ApprovalActionRequest) =>
  http.post<ApprovalItem>(`/approvals/${id}/approve`, { result: 'APPROVED', opinion: data.comment ?? '' });

/** 审批驳回 */
export const rejectItem = (id: number, data: ApprovalActionRequest) =>
  http.post<ApprovalItem>(`/approvals/${id}/reject`, {
    rejectionReason: data.rejectionReason ?? data.comment ?? '',
  });

/** 取消审批 */
export const cancelApproval = (id: number) =>
  http.post<ApprovalItem>(`/approvals/${id}/cancel`);

/** 获取待审批数量 */
export const getPendingCount = () =>
  http.get<number>('/approvals/pending/count');

/** 流程类型统计 */
export interface ProcessTypeStat {
  processType: string;
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  cancelled: number;
}

export const getProcessStats = () =>
  http.get<ProcessTypeStat[]>('/approvals/stats');

export interface SubmitApprovalPayload {
  businessType: string;
  title: string;
  description?: string;
  businessData?: string;
}

/** 发起审批申请 */
export const submitApproval = (data: SubmitApprovalPayload) =>
  http.post<ApprovalItem>('/approvals', {
    processType: data.businessType,
    businessType: data.businessType,
    businessId: 0,
    title: data.title,
    description: data.description ?? '',
    businessData: data.businessData ?? '{}',
  });
