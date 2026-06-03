/**
 * @file components/shared/SpatialTimeContext.tsx
 * @description 空间×时间筛选 Context — URL Query 真源的 React 镜像
 *
 * 决策（R6 改进）：
 * - 挂在 AppLayout 内部入口，避免 /bigscreen 等无关页误订阅
 * - URL Query 为真源，Context 只是订阅 + setSearchParams 的便捷封装
 * - 零新增依赖（不引入 zustand）
 */
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  parseSpatialTime,
  mergeSearch,
  type SpatialTimeQuery,
} from '@/utils/spatialQuery';

interface SpatialTimeContextValue {
  /** 当前 URL 中的空间/时间联合状态（解析后强类型对象） */
  query: SpatialTimeQuery;
  /** 增量更新 URL Query，partial 字段为 null/undefined/空字符串 时删除对应 key */
  setSpatialTime: (patch: Partial<SpatialTimeQuery>) => void;
  /** 重置为初始状态（清空所有 spatial×time 参数） */
  resetSpatialTime: () => void;
}

const SpatialTimeContext = createContext<SpatialTimeContextValue | null>(null);

interface SpatialTimeProviderProps {
  children: React.ReactNode;
}

/**
 * 把 useSearchParams 的搜索参数暴露为强类型对象 + 写回工具
 * 内部不维护 state，纯 URL 派生，避免 useEffect 死循环
 */
export const SpatialTimeProvider: React.FC<SpatialTimeProviderProps> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useMemo(() => parseSpatialTime(searchParams), [searchParams]);

  const setSpatialTime = useCallback(
    (patch: Partial<SpatialTimeQuery>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const k of Object.keys(patch)) {
        const v = (patch as any)[k];
        if (v === null || v === undefined || v === '') {
          next.delete(k);
        } else {
          next.set(k, String(v));
        }
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const resetSpatialTime = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    for (const k of [
      'locationId',
      'buildingId',
      'floorId',
      'areaId',
      'selectedAssetId',
      'periodType',
      'startDate',
      'endDate',
      'dimension',
      'floorPlanId',
    ]) {
      next.delete(k);
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const value = useMemo<SpatialTimeContextValue>(
    () => ({ query, setSpatialTime, resetSpatialTime }),
    [query, setSpatialTime, resetSpatialTime],
  );

  return <SpatialTimeContext.Provider value={value}>{children}</SpatialTimeContext.Provider>;
};

/**
 * 在三页（/gis、/energy、/floorplans）使用的便捷 hook
 * 必须在 SpatialTimeProvider 内部调用
 */
export function useSpatialTime(): SpatialTimeContextValue {
  const ctx = useContext(SpatialTimeContext);
  if (!ctx) {
    throw new Error('useSpatialTime must be used within <SpatialTimeProvider>');
  }
  return ctx;
}

export { SpatialTimeContext };
export type { SpatialTimeContextValue };
