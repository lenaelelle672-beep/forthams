/**
 * @file types/energy.ts
 * @description 能耗领域类型（S0.5e R1 类型收紧 / S2 强类型）
 *
 * 字段类型与后端 EnergyService.getDashboardData 返回值严格对齐：
 * - byType / trend / total / consumption / cost 全部为 string
 *   （后端 BigDecimal 通过 JacksonConfig 全局序列化为 String，保留全部精度）
 * - 前端展示前用 types/guards.ts 中 toSafeNumber / formatBigNumber 转换
 *
 * 缺失字段一律 optional（?：），避免 TS strict 模式阻断构建（B4 共识）。
 * 与 audit R1 / R10 mitigation 对齐。
 *
 * @see backend/src/main/java/com/ams/service/EnergyService.java
 * @see backend/src/main/java/com/ams/config/JacksonConfig.java
 */

// ---------------------------------------------------------------------------
// 基础类型
// ---------------------------------------------------------------------------

/** 仪表类型枚举（与后端 EnergyMeter.meterType 严格一致） */
export type MeterType = 'ELECTRICITY' | 'WATER' | 'GAS' | 'STEAM' | 'HEAT';

/** 周期粒度枚举（与后端 EnergyConsumption.periodType 严格一致） */
export type PeriodType = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

/** 时间范围预设（前端 URL 友好小写 + 5 枚举） */
export type TimeRangePreset = 'day' | 'week' | 'month' | 'year' | 'custom';

/** 时间范围对象 */
export interface TimeRange {
  preset: TimeRangePreset;
  start?: string; // YYYY-MM-DD
  end?: string;
}

// ---------------------------------------------------------------------------
// 仪表盘数据
// ---------------------------------------------------------------------------

export interface EnergyAssetRanking {
  assetId: number;
  consumption: string;
}

export interface EnergyDashboard {
  periodType?: PeriodType | string;
  /** 按类型分类（用电/用水/用气），键为 meterType，值为 string 形式的 BigDecimal */
  byType?: Record<string, string>;
  /** 趋势：YYYY-MM / YYYY-MM-DD / YYYY 等桶 key，值为 string */
  trend?: Record<string, string>;
  /** TOP 10 资产排名 */
  assetRanking?: EnergyAssetRanking[];
  /** 总能耗（byType 求和，string 形式） */
  total?: string;
}

// ---------------------------------------------------------------------------
// 对比（同环比）
// ---------------------------------------------------------------------------

export interface EnergyCompare {
  currentTotal?: string;
  previousTotal?: string;
  /** 较上期变化百分比（%），后端 string 形式（如 "12.34"） */
  changeRate?: string;
  /** 同比（较去年同期）变化百分比 */
  yoy?: string;
}

// ---------------------------------------------------------------------------
// 空间聚合（按 locationId 拉取时返回）
// ---------------------------------------------------------------------------

export interface EnergyByLocation extends EnergyDashboard {
  locationId?: number;
  locationName?: string;
}

// ---------------------------------------------------------------------------
// 异常检测
// ---------------------------------------------------------------------------

export interface EnergyAnomaly {
  period: string;
  value: string;
  expected?: string;
  deviation?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface EnergyAnomalies {
  method?: 'zscore' | 'stddev' | string;
  threshold?: number;
  items: EnergyAnomaly[];
}

// ---------------------------------------------------------------------------
// 排名（跨维度）
// ---------------------------------------------------------------------------

export interface EnergyRankingItem {
  assetId?: number;
  locationId?: number;
  consumption: string;
  rank?: number;
}

export interface EnergyRanking {
  scope: 'asset' | 'building' | 'floor' | 'area' | string;
  items: EnergyRankingItem[];
}

// ---------------------------------------------------------------------------
// 周期聚合读数（/energy/consumption 列表）
// ---------------------------------------------------------------------------

export interface EnergyConsumption {
  id?: number;
  assetId?: number;
  meterType?: MeterType | string;
  periodType?: PeriodType | string;
  periodStart?: string;
  periodEnd?: string;
  consumption?: string;
  unit?: string;
  cost?: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// 仪表读数（/energy/meters）
// ---------------------------------------------------------------------------

export interface EnergyMeter {
  id?: number;
  assetId: number;
  meterType: MeterType | string;
  readingValue: string;
  unit?: string;
  readingDate: string;
  reader?: string;
  remark?: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// 查询参数
// ---------------------------------------------------------------------------

export interface EnergyDashboardQuery {
  startDate?: string;
  endDate?: string;
  periodType?: PeriodType | string;
  locationId?: number;
}

export interface EnergyConsumptionQuery {
  assetId?: number;
  meterType?: MeterType | string;
  periodType?: PeriodType | string;
  startDate?: string;
  endDate?: string;
}

export interface EnergyByLocationQuery extends EnergyDashboardQuery {
  locationId: number;
}

// ---------------------------------------------------------------------------
// Step2 端点查询参数（W26 + W27 — 同环比/排名/异常 权威化端点）
// ---------------------------------------------------------------------------

/** /energy/compare 参数 */
export interface EnergyCompareQuery {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
  groupBy?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | string;
}

/** /energy/ranking 参数 */
export interface EnergyRankingQuery {
  scope: 'asset' | 'building' | 'floor' | 'area' | string;
  range?: 'MONTH' | 'YEAR' | string;
  meterType?: 'ELECTRICITY' | 'WATER' | 'GAS' | string;
  limit?: number;
}

/** /energy/anomalies 参数 */
export interface EnergyAnomaliesQuery {
  startDate?: string;
  endDate?: string;
  periodType?: 'MONTH' | 'WEEK' | 'DAY' | 'YEAR' | string;
  method?: 'zscore' | 'stddev' | string;
  threshold?: number;
}

/** /energy/locations/{id}/assets 参数 */
export interface EnergyLocationAssetsQuery {
  withEnergy?: boolean;
  range?: 'MONTH' | 'YEAR' | string;
}

/** /energy/by-space 参数 */
export interface EnergyBySpaceQuery {
  type: 'PROVINCE' | 'CITY' | 'DISTRICT' | 'BUILDING' | 'FLOOR' | 'ROOM' | string;
  parentId?: number;
  periodType?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | string;
  startDate?: string;
  endDate?: string;
}
