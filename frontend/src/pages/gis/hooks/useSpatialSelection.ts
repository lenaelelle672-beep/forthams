/**
 * @file pages/gis/hooks/useSpatialSelection
 * @description GIS 地图 marker 选中态 hook
 *
 * - selectedAssetId 写入 URL ?selectedAssetId=
 * - 其他页（/energy、/floorplans）可读取 useSpatialTime().query.selectedAssetId 跨页联动
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export function useSpatialSelection() {
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedAssetId = useMemo(() => {
    const raw = searchParams.get('selectedAssetId');
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isNaN(n) ? undefined : n;
  }, [searchParams]);

  const setSelectedAssetId = useCallback(
    (id: number | undefined) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id == null) {
        next.delete('selectedAssetId');
      } else {
        next.set('selectedAssetId', String(id));
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return { selectedAssetId, setSelectedAssetId };
}
