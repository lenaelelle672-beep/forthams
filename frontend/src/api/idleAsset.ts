/**
 * @file api/idleAsset.ts
 * @description 闲置资产 API — 公告发布 / 认领 / 取消
 *
 * 所有调用走 utils/http.ts 统一实例。
 */

import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';

// ── 类型 ─────────────────────────────────────────────────────────────────────

export interface IdleAssetRecord {
  id: number;
  assetId?: number | string;
  name?: string;
  assetName?: string;
  category?: string;
  originalDept?: string;
  idleDays?: number;
  value?: string | number;
  assetValue?: string | number;
  status: string;
  reason?: string;
  viewCount?: number;
  claimDept?: string;
  condition?: string;
  publishDate?: string;
  deadline?: string;
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
  reason?: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const getIdleAssetList = (params?: Record<string, unknown>) =>
  http.get<ApiResponse<IdleAssetRecord[]>>('/idle-assets/list', { params });

export const getIdleAssetById = (id: number | string) =>
  http.get<ApiResponse<IdleAssetRecord>>(`/idle-assets/${id}`);

export const publishIdleAsset = (data: PublishIdleAssetRequest) =>
  http.post<ApiResponse<IdleAssetRecord>>('/idle-assets', data);

export const claimIdleAsset = (id: number | string, claimantId: number | string) =>
  http.post<ApiResponse<IdleAssetRecord>>(`/idle-assets/${id}/claim`, { claimantId });

export const cancelIdleAssetPublish = (id: number | string) =>
  http.put<ApiResponse<IdleAssetRecord>>(`/idle-assets/${id}/cancel`);

export const deleteIdleAsset = (id: number | string) =>
  http.delete<ApiResponse<string>>(`/idle-assets/${id}`);
