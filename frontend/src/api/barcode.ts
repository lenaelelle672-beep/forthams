/**
 * @file api/barcode.ts
 * @description 条码/QR 码管理 API
 * 对应后端：BarcodeController (/api/barcodes)
 */

import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';

/** 标签数据（QR码 base64 + 资产信息） */
export interface AssetLabel {
  qrBase64: string;
  assetInfo: {
    id: number;
    assetNo: string;
    assetName: string;
    model: string;
    brand: string;
    status: string;
  };
}

/** 获取资产 QR 码 PNG（返回 blob） */
export const getAssetQrCode = (assetId: number) =>
  http.get<Blob>(`/api/barcodes/asset/${assetId}`, { responseType: 'blob' });

/** 获取资产标签数据（JSON: qrBase64 + assetInfo） */
export const getAssetLabel = (assetId: number) =>
  http.get<ApiResponse<AssetLabel>>(`/api/barcodes/asset/${assetId}/label`);

/** 获取资产标签图片 PNG（返回 blob） */
export const getAssetLabelImage = (assetId: number) =>
  http.get<Blob>(`/api/barcodes/asset/${assetId}/label-image`, { responseType: 'blob' });

/** 批量生成资产标签 */
export const batchGenerateLabels = (assetIds: number[]) =>
  http.post<ApiResponse<AssetLabel[]>>('/api/barcodes/batch', { assetIds });
