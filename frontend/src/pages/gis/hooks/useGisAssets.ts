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

function getHttpStatus(error: unknown) {
  const maybeError = error as { status?: number; response?: { status?: number } };
  return maybeError.status ?? maybeError.response?.status;
}

export function useGisAssets(params: UseGisAssetsParams = {}) {
  return useQuery<GisAsset[], Error>({
    queryKey: ['gis', 'assets', params],
    queryFn: async () => {
      try {
        return await gisService.getAssets(params);
      } catch (error) {
        const status = getHttpStatus(error);
        if (status === 403 || status === 404) {
          console.warn('[GIS] 资产定位接口不可用或权限不足，展示空地图数据');
          return [];
        }
        throw error;
      }
    },
    staleTime: 30_000,
  });
}
