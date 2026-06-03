/**
 * @file types/assetHealth.ts
 * @description 资产健康评分类型定义
 */

export interface AssetHealthVO {
  assetId: number;
  assetName: string;
  assetCode: string;
  score: number;
  scoreLevel: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  ageScore: number;
  maintenanceScore: number;
  faultRateScore: number;
  utilizationScore: number;
  depreciationScore: number;
}
