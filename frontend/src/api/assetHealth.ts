/**
 * @file api/assetHealth.ts
 * @description 资产健康评分 API 封装
 */

import http from '@/utils/http';
import type { AssetHealthVO } from '@/types/assetHealth';

export function getAssetHealth(assetId: number): Promise<AssetHealthVO> {
  return http.get(`/asset-health/${assetId}`);
}

export function batchAssetHealth(assetIds: number[]): Promise<AssetHealthVO[]> {
  return http.post('/asset-health/batch', assetIds);
}

export function getUnhealthyAssets(topN = 20, minScore = 60): Promise<AssetHealthVO[]> {
  return http.get('/asset-health/unhealthy', { params: { topN, minScore } });
}
