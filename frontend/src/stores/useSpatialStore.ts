/**
 * @file stores/useSpatialStore.ts
 * @description 空间×时间 Store（gai2 W15 — SpatialTimeContext 的 selector facade）。
 *
 * <p>决策（adjudication AR-4）：</p>
 * <ul>
 *   <li>URL Query 仍为真源（由 SpatialTimeContext 维护）</li>
 *   <li>useSpatialStore 提供 selector 风格的 facade；useSpatialStoreActions 提供 setter-only 便利
 *       消费方可在 useSpatialTime / useSpatialStore / useSpatialStoreActions 间二选一</li>
 *   <li>状态变化通过 SpatialTimeContext 的 URL Query 自动同步到所有订阅者</li>
 *   <li>不引入 zustand/redux，依赖 useContext + try/catch fallback</li>
 * </ul>
 *
 * <p>使用示例：</p>
 * <pre>
 *   // selector-style（兼容 useInventoryStore 模式）
 *   const locationId = useSpatialStore((s) => s.locationId);
 *   const setLocationId = useSpatialStore((s) => s.setLocationId);
 *
 *   // setter-only facade（与 TimeRangeSelector 协同）
 *   const { setTimeRange, reset } = useSpatialStoreActions();
 *
 *   // 或直接使用 useSpatialTime
 *   const { query, setSpatialTime } = useSpatialTime();
 * </pre>
 */
import {
  useSpatialTime,
  type SpatialTimeContextValue,
} from '@/components/shared/SpatialTimeContext';
import type { SpatialTimeQuery } from '@/utils/spatialQuery';

type PeriodType = SpatialTimeQuery['periodType'];
type Dimension = SpatialTimeQuery['dimension'];

export interface SpatialStoreState {
  // ── 读取（URL 真源，订阅 SpatialTimeContext） ─────────────────────
  locationId: number | null;
  buildingId: number | null;
  floorId: number | null;
  areaId: number | null;
  selectedAssetId: number | null;
  periodType: PeriodType | null;
  startDate: string | null;
  endDate: string | null;
  dimension: Dimension | null;
  floorPlanId: number | null;

  // ── 写回（调用 SpatialTimeContext.setSpatialTime，触发 URL 更新） ──
  setLocationId: (id: number | null) => void;
  setBuildingId: (id: number | null) => void;
  setFloorId: (id: number | null) => void;
  setAreaId: (id: number | null) => void;
  setSelectedAssetId: (id: number | null) => void;
  setPeriodType: (p: PeriodType | null) => void;
  setStartDate: (d: string | null) => void;
  setEndDate: (d: string | null) => void;
  setDimension: (d: Dimension | null) => void;
  setFloorPlanId: (id: number | null) => void;
  /** 便捷：一次性设置 period + startDate + endDate */
  setTimeRange: (p: PeriodType | null, startDate: string | null, endDate: string | null) => void;
  reset: () => void;
}

const NOOP = (): void => {
  // 空操作 fallback — 当 Context 不可用时使用
};

const FALLBACK_STATE: SpatialStoreState = {
  locationId: null,
  buildingId: null,
  floorId: null,
  areaId: null,
  selectedAssetId: null,
  periodType: null,
  startDate: null,
  endDate: null,
  dimension: null,
  floorPlanId: null,
  setLocationId: NOOP,
  setBuildingId: NOOP,
  setFloorId: NOOP,
  setAreaId: NOOP,
  setSelectedAssetId: NOOP,
  setPeriodType: NOOP,
  setStartDate: NOOP,
  setEndDate: NOOP,
  setDimension: NOOP,
  setFloorPlanId: NOOP,
  setTimeRange: NOOP,
  reset: NOOP,
};

/**
 * 尝试获取 SpatialTimeContext 上下文；不在 Provider 内时返回 null。
 * 用 try/catch 避免 useSpatialTime 的 throw 崩溃非业务页（如大屏）。
 */
function tryUseContext(): SpatialTimeContextValue | null {
  try {
    return useSpatialTime();
  } catch {
    return null;
  }
}

function buildStateFromContext(ctx: SpatialTimeContextValue): SpatialStoreState {
  const q = ctx.query;
  return {
    locationId: q.locationId ?? null,
    buildingId: q.buildingId ?? null,
    floorId: q.floorId ?? null,
    areaId: q.areaId ?? null,
    selectedAssetId: q.selectedAssetId ?? null,
    periodType: q.periodType ?? null,
    startDate: q.startDate ?? null,
    endDate: q.endDate ?? null,
    dimension: q.dimension ?? null,
    floorPlanId: q.floorPlanId ?? null,
    setLocationId: (id) => ctx.setSpatialTime({ locationId: id ?? undefined }),
    setBuildingId: (id) => ctx.setSpatialTime({ buildingId: id ?? undefined }),
    setFloorId: (id) => ctx.setSpatialTime({ floorId: id ?? undefined }),
    setAreaId: (id) => ctx.setSpatialTime({ areaId: id ?? undefined }),
    setSelectedAssetId: (id) => ctx.setSpatialTime({ selectedAssetId: id ?? undefined }),
    setPeriodType: (p) => ctx.setSpatialTime({ periodType: p ?? undefined }),
    setStartDate: (d) => ctx.setSpatialTime({ startDate: d ?? undefined }),
    setEndDate: (d) => ctx.setSpatialTime({ endDate: d ?? undefined }),
    setDimension: (d) => ctx.setSpatialTime({ dimension: d ?? undefined }),
    setFloorPlanId: (id) => ctx.setSpatialTime({ floorPlanId: id ?? undefined }),
    setTimeRange: (p, startDate, endDate) =>
      ctx.setSpatialTime({
        periodType: p ?? undefined,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
      }),
    reset: () => ctx.resetSpatialTime(),
  };
}

/**
 * selector 兼容的 SpatialTime store hook。
 *
 * - 在 SpatialTimeProvider 内部：返回基于 URL 的实时状态
 * - 在 Provider 外部：返回 FALLBACK_STATE（不抛错）
 */
export function useSpatialStore<T>(selector: (state: SpatialStoreState) => T): T {
  const ctx = tryUseContext();
  const state = ctx ? buildStateFromContext(ctx) : FALLBACK_STATE;
  return selector(state);
}

/**
 * setter-only 便利 hook — 适合只需要写入的场景（如 TimeRangeSelector）
 */
export function useSpatialStoreActions(): Pick<
  SpatialStoreState,
  'setLocationId' | 'setBuildingId' | 'setFloorId' | 'setAreaId' | 'setSelectedAssetId'
  | 'setPeriodType' | 'setStartDate' | 'setEndDate' | 'setDimension' | 'setFloorPlanId'
  | 'setTimeRange' | 'reset'
> {
  return useSpatialStore((s) => ({
    setLocationId: s.setLocationId,
    setBuildingId: s.setBuildingId,
    setFloorId: s.setFloorId,
    setAreaId: s.setAreaId,
    setSelectedAssetId: s.setSelectedAssetId,
    setPeriodType: s.setPeriodType,
    setStartDate: s.setStartDate,
    setEndDate: s.setEndDate,
    setDimension: s.setDimension,
    setFloorPlanId: s.setFloorPlanId,
    setTimeRange: s.setTimeRange,
    reset: s.reset,
  }));
}

/**
 * 直接获取完整状态（非 selector 风格）。
 */
export function useFullSpatialState(): SpatialStoreState {
  return useSpatialStore((s) => s);
}

/**
 * 仅获取 SpatialTimeQuery 子集（不暴露 setter）。
 */
export function useSpatialQuery<T>(selector: (q: SpatialTimeQuery) => T, fallback: T): T {
  const ctx = tryUseContext();
  if (!ctx) return fallback;
  return selector(ctx.query);
}
