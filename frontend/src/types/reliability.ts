/**
 * @file types/reliability.ts
 * @description 可靠性分析类型定义
 */

/** 可靠性概览 */
export interface ReliabilitySummary {
  mtbf: number;
  mttr: number;
  availability: number;
  failureRate: number;
  totalFailures: number;
  totalRepairHours: number;
  totalOperatingHours: number;
}

/** 可靠性趋势 */
export interface ReliabilityTrend {
  period: string;
  mtbf: number;
  mttr: number;
  availability: number;
  failureRate: number;
}

/** 资产可靠性排名 */
export interface ReliabilityRanking {
  assetId: number;
  assetName: string;
  assetCode: string;
  mtbf: number;
  mttr: number;
  availability: number;
  failureCount: number;
}

/** 资产可靠性详情 */
export interface AssetReliabilityDetail extends ReliabilitySummary {
  assetId: number;
  assetName: string;
  assetCode: string;
  trends: ReliabilityTrend[];
}
