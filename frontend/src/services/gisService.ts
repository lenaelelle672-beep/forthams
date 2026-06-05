/**
 * @file services/gisService.ts
 * @description GIS 资产地图 API 收敛层
 */
import http from '@/utils/http';

export interface GisAsset {
  id: number;
  assetNo: string;
  assetName: string;
  status: string;
  locationLat: number;
  locationLng: number;
  categoryId?: number;
  deptId?: number;
  locationId?: number;
  location?: string;
  tenantId?: string;
}

export interface GisStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface GetAssetsParams {
  categoryId?: number;
  deptId?: number;
  status?: string;
  locationId?: number;
}

/** 拉取带坐标的资产列表（支持空间过滤） */
export function getAssets(params: GetAssetsParams = {}): Promise<GisAsset[]> {
  return http.get<GisAsset[]>('/gis/assets', { params });
}

/** 资产分布统计（按状态/分类分组） */
export function getStats(): Promise<GisStats> {
  return http.get<GisStats>('/gis/stats');
}

/** 更新资产坐标 */
export function updateAssetLocation(id: number, lat: number, lng: number): Promise<void> {
  return http.put<void>(`/gis/assets/${id}/location`, { lat, lng });
}

/** 空间下资产 + 能耗联动（W24 + W32 — GIS 选建筑 → 该空间下资产高亮） */
export function getLocationAssets(
  locationId: number,
  params: { withEnergy?: boolean; range?: string } = {},
): Promise<Array<Record<string, unknown>>> {
  return http.get<Array<Record<string, unknown>>>(`/energy/locations/${locationId}/assets`, { params });
}

/** 跨维度排名（GIS TOP 资产高亮 — W32） */
export function getRanking(params: {
  scope: 'asset' | 'building' | 'floor' | 'area';
  range?: string;
  meterType?: string;
  limit?: number;
}): Promise<Array<Record<string, unknown>>> {
  return http.get<Array<Record<string, unknown>>>('/energy/ranking', { params });
}

const gisService = {
  getAssets,
  getStats,
  updateAssetLocation,
  getLocationAssets,
  getRanking,
};

export default gisService;
