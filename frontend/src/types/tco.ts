/**
 * @file types/tco.ts
 * @description TCO 全生命周期成本类型定义
 */
export interface TcoResult {
  assetId: number;
  assetNo: string;
  assetName: string;
  purchaseCost: number;
  maintenanceCost: number;
  workOrderCost: number;
  energyCost: number;
  insuranceCost: number;
  currentValue: number;
  totalCost: number;
  calculationDate: string;
}

export interface TcoTrend {
  period: string;
  totalCost: number;
  purchaseCost: number;
  maintenanceCost: number;
  workOrderCost: number;
  energyCost: number;
  insuranceCost: number;
}

export interface TcoCompare {
  assetId: number;
  assetNo: string;
  assetName: string;
  totalCost: number;
  avgCost: number;
}
