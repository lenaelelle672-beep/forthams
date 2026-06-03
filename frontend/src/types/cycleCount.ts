export enum AssetClassificationEnum {
  A = 'A',
  B = 'B',
  C = 'C'
}

export enum CycleFrequencyEnum {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY'
}

export interface CycleCountRule {
  id?: number;
  classification: AssetClassificationEnum;
  frequency: CycleFrequencyEnum;
  categoryIds?: string;
  minValue?: number;
  maxValue?: number;
  tenantId?: string;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
}

/**
 * 批量操作结果
 */
export interface BatchResult {
  total: number;
  success: number;
  failure: number;
  message?: string;
}

/**
 * 分类统计数据
 */
export interface ClassificationStatistics {
  A_count: number;
  B_count: number;
  C_count: number;
  CATEGORY_count: number;
  total_value?: number;
  A_total_value?: number;
  B_total_value?: number;
  C_total_value?: number;
  CATEGORY_total_value?: number;
}

/**
 * 分类统计数据
 */
export interface ClassificationStatistics {
  A_count: number;
  B_count: number;
  C_count: number;
  CATEGORY_count: number;
  A_total_value: number;
  B_total_value: number;
  C_total_value: number;
  CATEGORY_total_value: number;
}

/**
 * 批量操作结果
 */
export interface BatchResult {
  total: number;
  success: number;
  failure: number;
  message?: string;
}
