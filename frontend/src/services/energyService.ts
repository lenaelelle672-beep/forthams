/**
 * @file services/energyService.ts
 * @description 能耗 API 收敛层（gai2 W11 + W26 增量化 — Step1 4 方法 + Step2 5 方法）。
 *
 * 三页（/gis、/energy、/floorplans）通过该 service 统一访问 /energy/* 端点。
 * http 拦截器已自动解包 Result<T>，因此返回类型直接对应业务数据。
 *
 * 类型守卫 isEnergyDashboard 兜底（RR-3 中危）— 后端字段漂移时不抛异常。
 */
import http from '@/utils/http';
import type {
  EnergyDashboard,
  EnergyCompare,
  EnergyAnomalies,
  EnergyRanking,
  EnergyAnomaly,
  EnergyRankingItem,
  EnergyCompareQuery,
  EnergyRankingQuery,
  EnergyAnomaliesQuery,
} from '@/types/energy';

/** 仪表盘返回结构（与 EnergyService.getDashboardData 输出对齐 — Step1） */
export interface EnergyDashboardData {
  byType: Record<string, number | string>;
  trend: Record<string, number | string>;
  assetRanking: Array<{ assetId: number; consumption: number | string }>;
  total?: number | string;
  periodType?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
}

export interface EnergyDashboardParams {
  startDate?: string;
  endDate?: string;
  periodType?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'day' | 'week' | 'month' | 'year';
  locationId?: number;
}

/**
 * 类型守卫：判断响应是否形如 EnergyDashboard（防后端字段漂移运行时崩溃）
 */
export function isEnergyDashboard(x: unknown): x is EnergyDashboard {
  return (
    typeof x === 'object' &&
    x !== null &&
    ('byType' in x || 'trend' in x || 'assetRanking' in x || 'total' in x)
  );
}

/** 安全数字转换：BigDecimal 字符串 → number（极大值保留字符串语义） */
export function toSafeNumber(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** ── Step1 端点（W11 增量化保留 — 与后端 4 参 dashboard + /summary/by-location + /consumption/aggregate 对齐） ── */

/** 能耗仪表盘（向后兼容 4 参，旧调用方零行为变更） */
export function getDashboard(params: EnergyDashboardParams = {}): Promise<EnergyDashboardData> {
  return http.get<EnergyDashboardData>('/energy/dashboard', { params });
}

/** 按空间层级聚合能耗（返回与 dashboard 相同 shape） */
export function getSummaryByLocation(
  params: EnergyDashboardParams & { locationId: number },
): Promise<EnergyDashboardData> {
  return http.get<EnergyDashboardData>('/energy/summary/by-location', { params });
}

/** 按空间层级聚合读数（List 形式） */
export function getConsumptionAggregate(
  params: EnergyDashboardParams & { locationId: number },
): Promise<unknown[]> {
  return http.get<unknown[]>('/energy/consumption/aggregate', { params });
}

/** 空间层级下钻聚合（W5 新增 — /energy/by-space） */
export function getBySpace(params: {
  type: string;
  parentId?: number;
  periodType?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Array<Record<string, unknown>>> {
  return http.get<Array<Record<string, unknown>>>('/energy/by-space', { params });
}

export interface ConsumptionQuery {
  assetId?: number;
  meterType?: string;
  periodType?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  startDate?: string;
  endDate?: string;
}

/** 周期汇总列表 */
export function getConsumption(params: ConsumptionQuery = {}): Promise<unknown[]> {
  return http.get<unknown[]>('/energy/consumption', { params });
}

// ── Step2 端点（W26 — 4 权威化方法 + 类型守卫） ──────────────────────────────

/** 同环比对比（W24 + W25） */
export function getCompare(params: EnergyCompareQuery): Promise<EnergyCompare> {
  return http.get<EnergyCompare>('/energy/compare', { params });
}

/** 跨维度排名（W24 + W25） */
export function getRanking(params: EnergyRankingQuery): Promise<EnergyRanking> {
  return http.get<EnergyRanking>('/energy/ranking', { params });
}

/** 异常检测（W24 + W25 — 替换前端 detectAnomalies z-score） */
export function getAnomalies(params: EnergyAnomaliesQuery): Promise<EnergyAnomalies> {
  return http.get<EnergyAnomalies>('/energy/anomalies', { params });
}

/** 空间下资产 + 能耗联动（W24 + W25 — GIS 选建筑 → 该空间下资产） */
export function getLocationAssets(
  locationId: number,
  params: { withEnergy?: boolean; range?: string } = {},
): Promise<Array<Record<string, unknown>>> {
  return http.get<Array<Record<string, unknown>>>(`/energy/locations/${locationId}/assets`, { params });
}

const energyService = {
  // step1
  getDashboard,
  getSummaryByLocation,
  getConsumptionAggregate,
  getBySpace,
  getConsumption,
  // step2
  getCompare,
  getRanking,
  getAnomalies,
  getLocationAssets,
  // utils
  isEnergyDashboard,
  toSafeNumber,
};

export type { EnergyDashboard, EnergyCompare, EnergyAnomalies, EnergyRanking, EnergyAnomaly, EnergyRankingItem };
export default energyService;
