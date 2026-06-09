/**
 * @file api/barcode.ts
 * @description 条码/QR 码管理 API
 * 对应后端：BarcodeController (/barcodes)，由统一 HTTP baseURL 提供 /api 前缀
 */

import http from '@/utils/http';

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
  http.get<Blob>(`/barcodes/asset/${assetId}`, { responseType: 'blob' });

/** 获取资产标签数据（JSON: qrBase64 + assetInfo） */
export const getAssetLabel = (assetId: number) =>
  http.get<AssetLabel>(`/barcodes/asset/${assetId}/label`);

/** 获取资产标签图片 PNG（返回 blob） */
export const getAssetLabelImage = (assetId: number) =>
  http.get<Blob>(`/barcodes/asset/${assetId}/label-image`, { responseType: 'blob' });

/** 批量生成资产标签 */
export const batchGenerateLabels = (assetIds: number[]) =>
  http.post<AssetLabel[]>('/barcodes/batch', { assetIds });
