/**
 * @file pages/gis/hooks/useMapFilters
 * @description GIS 地图筛选状态 hook — 双向同步 URL searchParams
 *
 * - status 字段写入 ?status=
 * - categoryId / deptId 同理（保留扩展位）
 * - 与 useSpatialTime 协作，locationId 走 SpatialTimeContext
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export interface MapFilters {
  status?: string;
  categoryId?: number;
  deptId?: number;
}

export function useMapFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<MapFilters>(() => {
    const status = searchParams.get('status') || undefined;
    const categoryIdRaw = searchParams.get('categoryId');
    const deptIdRaw = searchParams.get('deptId');
    return {
      status,
      categoryId: categoryIdRaw ? Number(categoryIdRaw) : undefined,
      deptId: deptIdRaw ? Number(deptIdRaw) : undefined,
    };
  }, [searchParams]);

  const setStatus = useCallback(
    (status: string | undefined) => {
      const next = new URLSearchParams(searchParams.toString());
      if (status) {
        next.set('status', status);
      } else {
        next.delete('status');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return {
    filters,
    setStatus,
  };
}
