/**
 * @file api/idleAsset.ts
 * @description 闲置资产 API — 公告发布 / 认领 / 取消
 *
 * 所有调用走 utils/http.ts 统一实例。
 */

import http from '@/utils/http';
import type { PageData } from '@/types/common';

// ── 类型 ─────────────────────────────────────────────────────────────────────

export interface IdleAssetRecord {
  id: number;
  assetId?: number | string;
  title?: string;
  name?: string;
  assetName?: string;
  category?: string;
  originalDept?: string;
  idleDays?: number;
  value?: string | number;
  assetValue?: string | number;
  status: string;
  reason?: string;
  claimantId?: number | string;
  claimStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  claimApprovedBy?: number | string;
  claimApprovedTime?: string;
  approvalOpinion?: string;
  viewCount?: number;
  claimDept?: string;
  condition?: string;
  publishDate?: string;
  deadline?: string;
  claimDeadline?: string;
  content?: string;
  publisher?: string;
  announcementStatus?: string;
  assets?: number;
  type?: string;
  fromDept?: string;
  toDept?: string;
  handler?: string;
  operator?: string;
  date?: string;
  claimDate?: string;
}

export interface PublishIdleAssetRequest {
  assetId: number | string;
  idleDays?: number;
  title?: string;
  reason: string;
  claimDeadline?: string;
}

export interface IdleAssetClaimReviewRequest {
  opinion?: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const getIdleAssetList = (params?: Record<string, unknown>) =>
  http.get<PageData<IdleAssetRecord>>('/idle-assets/list', { params });

export const getIdleAssetById = (id: number | string) =>
  http.get<IdleAssetRecord>(`/idle-assets/${id}`);

export const publishIdleAsset = (data: PublishIdleAssetRequest) =>
  http.post<IdleAssetRecord>('/idle-assets', data);

export const claimIdleAsset = (id: number | string, _claimantId?: number | string) =>
  http.post<IdleAssetRecord>(`/idle-assets/${id}/claim`, {});

export const approveIdleAssetClaim = (id: number | string, data?: IdleAssetClaimReviewRequest) =>
  http.post<IdleAssetRecord>(`/idle-assets/${id}/claim/approve`, data ?? {});

export const rejectIdleAssetClaim = (id: number | string, data?: IdleAssetClaimReviewRequest) =>
  http.post<IdleAssetRecord>(`/idle-assets/${id}/claim/reject`, data ?? {});

export const cancelIdleAssetPublish = (id: number | string) =>
  http.put<IdleAssetRecord>(`/idle-assets/${id}/cancel`);

export const deleteIdleAsset = (id: number | string) =>
  http.delete<void>(`/idle-assets/${id}`);
