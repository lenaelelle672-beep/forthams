/**
 * @file api/disposal.ts
 * @description 资产处置 API（报废/转移/清退/赔偿）
 * 对应后端：DisposalController (/disposals)、CompensationController (/compensation)
 *
 * 注意：转移/清退/报废 create 端点被后端封门，必须通过审批流提交。
 */

import http from '@/utils/http';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export type DisposalType = 'TRANSFER' | 'CLEARANCE' | 'SCRAP';
export type DisposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface Disposal {
  id: number;
  assetId: number;
  assetNo?: string;
  assetName?: string;
  type: DisposalType;
  status: DisposalStatus;
  reason?: string;
  applicantName?: string;
  createdAt: string;
}

export interface DisposalListQuery {
  page?: number;
  pageSize?: number;
  type?: DisposalType;
  status?: DisposalStatus;
  keyword?: string;
}

/** 处置列表 */
export const getDisposalList = (params?: DisposalListQuery) =>
  http.get<PaginatedResponse<Disposal>>('/disposals', { params });

/** 处置详情 */
export const getDisposalDetail = (id: number) =>
  http.get<ApiResponse<Disposal>>(`/disposals/${id}`);

// ── 赔偿管理 ──────────────────────────────────────────────────────────────────

export interface Compensation {
  id: number;
  assetId: number;
  assetName?: string;
  assetNo?: string;
  reason: string;
  amount: number;
  responsibleUserId?: number;
  responsibleUserName?: string;
  status: string;
  createdAt: string;
}

export interface CompensationListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
}

/** 赔偿列表 */
export const getCompensationList = (params?: CompensationListQuery) =>
  http.get<PaginatedResponse<Compensation>>('/compensation', { params });

/** 赔偿详情 */
export const getCompensationDetail = (id: number) =>
  http.get<ApiResponse<Compensation>>(`/compensation/${id}`);

// ── 报废申请 ────────────────────────────────────────────────────────────────

export interface ScrapApplicationPayload {
  assetIds: string[];
  scrapDate: string;
  scrapReason: string;
  disposalMethod: string;
  estimatedResidualValue?: string;
  approvalFlow: string;
  remark?: string;
}

/** 提交报废申请（通过审批流程 POST /approvals） */
export const submitScrapApplication = (data: ScrapApplicationPayload) =>
  http.post<ApiResponse<unknown>>('/approvals', {
    processType: 'ASSET_SCRAP',
    businessType: 'ASSET_SCRAP',
    businessId: Number(data.assetIds[0]) || 0,
    title: `资产报废申请 - ${data.scrapDate}`,
    description: [
      `报废原因：${data.scrapReason}`,
      `处置方式：${data.disposalMethod}`,
      data.estimatedResidualValue ? `预估残值：¥${data.estimatedResidualValue}` : null,
      data.remark ? `备注：${data.remark}` : null,
    ].filter(Boolean).join('；'),
    businessData: JSON.stringify(data),
  });

export interface ScrapDraftData {
  scrapDate: string;
  scrapReason: string;
  disposalMethod: string;
  estimatedResidualValue?: string;
  approvalFlow: string;
  remark?: string;
  assetIds: string[];
}

/** 保存报废申请草稿到 localStorage */
export const saveScrapDraft = (data: ScrapDraftData): boolean => {
  try {
    const timestamp = Date.now();
    const dataKey = `ams_draft_scrap_${timestamp}`;
    const indexKey = 'ams_draft_latest_scrap';
    localStorage.setItem(dataKey, JSON.stringify(data));
    localStorage.setItem(indexKey, dataKey);
    return true;
  } catch {
    return false;
  }
};
