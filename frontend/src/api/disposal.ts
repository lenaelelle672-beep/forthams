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

/** 赔偿创建 DTO（对应后端 CompensationCreateDTO） */
export interface CompensationCreatePayload {
  assetId?: number;
  compensationType?: string;
  compensationAmount?: number;
  description?: string;
  incidentDate?: string;
  responsibleUserId?: number;
  responsibleDeptId?: number;
}

/** 赔偿更新 DTO（对应后端 CompensationUpdateDTO） */
export interface CompensationUpdatePayload extends CompensationCreatePayload {}

/**
 * 提交赔偿申请（通过审批流程 POST /approvals）。
 * 后端 POST /compensation 被封门，必须走审批流。
 */
export const createCompensation = (data: CompensationCreatePayload) =>
  http.post<ApiResponse<unknown>>('/approvals', {
    processType: 'ASSET_COMPENSATION',
    businessType: 'ASSET_COMPENSATION',
    businessId: data.assetId ?? 0,
    title: `资产赔偿申请 - ${data.incidentDate ?? new Date().toISOString().split('T')[0]}`,
    description: [
      data.description ? `赔偿原因：${data.description}` : null,
      data.compensationType ? `赔偿方式：${data.compensationType}` : null,
      data.compensationAmount ? `赔偿金额：¥${data.compensationAmount}` : null,
    ].filter(Boolean).join('；'),
    businessData: JSON.stringify(data),
  });

/** 更新赔偿记录（PUT /compensation/{id}） */
export const updateCompensation = (id: number, data: CompensationUpdatePayload) =>
  http.put<ApiResponse<Compensation>>(`/compensation/${id}`, data);

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

// ── 清退申请 ────────────────────────────────────────────────────────────────

export interface ClearanceApplicationPayload {
  assetIds: string[];
  clearanceReason: string;
  disposalMethod: string;
  estimatedResidualValue?: number;
  approvalFlow: string;
  urgency: string;
  remark?: string;
  applicationDate: string;
}

/** 提交清退申请（通过审批流程 POST /approvals） */
export const submitClearanceApplication = (data: ClearanceApplicationPayload) =>
  http.post<ApiResponse<unknown>>('/approvals', {
    processType: 'ASSET_CLEARANCE',
    businessType: 'ASSET_CLEARANCE',
    businessId: Number(data.assetIds[0]) || 0,
    title: `资产清退申请 - ${data.applicationDate}`,
    description: [
      `清退原因：${data.clearanceReason}`,
      `处置方式：${data.disposalMethod}`,
      data.estimatedResidualValue ? `预估残值：¥${data.estimatedResidualValue}` : null,
      `紧急程度：${data.urgency}`,
      data.remark ? `备注：${data.remark}` : null,
    ].filter(Boolean).join('；'),
    businessData: JSON.stringify(data),
  });

export interface ClearanceDraftData {
  clearanceReason: string;
  disposalMethod: string;
  estimatedResidualValue?: number;
  approvalFlow: string;
  urgency: string;
  remark?: string;
  applicationDate: string;
  assetIds: string[];
}

/** 保存清退申请草稿到 localStorage */
export const saveClearanceDraft = (data: ClearanceDraftData): boolean => {
  try {
    const timestamp = Date.now();
    const dataKey = `ams_draft_clearance_${timestamp}`;
    const indexKey = 'ams_draft_latest_clearance';
    localStorage.setItem(dataKey, JSON.stringify(data));
    localStorage.setItem(indexKey, dataKey);
    return true;
  } catch {
    return false;
  }
};

// ── 调拨申请 ────────────────────────────────────────────────────────────────

export interface TransferApplicationPayload {
  assetIds: string[];
  transferType: string;
  fromDept: string;
  toDept: string;
  fromLocation?: string;
  toLocation?: string;
  workflow: string;
  priority: string;
  notes?: string;
}

/** 提交调拨申请（通过审批流程 POST /approvals） */
export const submitTransferApplication = (data: TransferApplicationPayload) =>
  http.post<ApiResponse<unknown>>('/approvals', {
    processType: 'ASSET_TRANSFER',
    businessType: 'ASSET_TRANSFER',
    businessId: Number(data.assetIds[0]) || 0,
    title: `资产调拨申请 - ${data.fromDept} → ${data.toDept}`,
    description: [
      `调拨类型：${data.transferType}`,
      `调出部门：${data.fromDept}`,
      `调入部门：${data.toDept}`,
      data.fromLocation ? `调出位置：${data.fromLocation}` : null,
      data.toLocation ? `调入位置：${data.toLocation}` : null,
      `审批流程：${data.workflow}`,
      `紧急程度：${data.priority}`,
      data.notes ? `备注：${data.notes}` : null,
    ].filter(Boolean).join('；'),
    businessData: JSON.stringify(data),
  });
