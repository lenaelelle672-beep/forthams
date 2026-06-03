/**
 * @file pages/gis/hooks/useGisAssets
 * @description GIS 资产数据拉取 hook（react-query 包装）
 *
 * - 30s staleTime，避免频繁重拉
 * - 参数变化时自动重拉
 * - 错误抛出，调用方在 Page 组件处理 ErrorState
 */
import { useQuery } from '@tanstack/react-query';
import gisService, { type GisAsset } from '@/services/gisService';

interface UseGisAssetsParams {
  status?: string;
  categoryId?: number;
  deptId?: number;
  locationId?: number;
}

export function useGisAssets(params: UseGisAssetsParams = {}) {
  return useQuery<GisAsset[], Error>({
    queryKey: ['gis', 'assets', params],
    queryFn: () => gisService.getAssets(params),
    staleTime: 30_000,
  });
}
