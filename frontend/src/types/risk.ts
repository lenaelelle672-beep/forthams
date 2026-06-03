export enum RiskLevelEnum {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum RiskStatusEnum {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED'
}

export interface RiskAssessment {
  id?: number;
  assetId: number;
  probability: number;
  impact: number;
  riskLevel?: RiskLevelEnum;
  mitigationMeasures?: string;
  reviewDate?: string;
  assessorId?: number;
  status?: RiskStatusEnum;
  tenantId?: string;
  createBy?: number;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
}

export interface RiskQueryParams {
  keyword?: string;
  riskLevel?: RiskLevelEnum;
  assetId?: number;
  pageNum?: number;
  pageSize?: number;
}

export interface HeatmapDataPoint {
  probability: number;
  impact: number;
  riskLevel: string;
  cnt: number;
}

// 矩阵配置相关类型
export interface MatrixDimensionItem {
  value: number;
  label: string;
}

export interface MatrixLevelMapping {
  minScore: number;
  level: string;
}

export interface RiskMatrix {
  id?: number;
  matrixName: string;
  probabilityDimension: MatrixDimensionItem[];
  severityDimension: MatrixDimensionItem[];
  levelMapping: MatrixLevelMapping[];
  isActive?: number;
  tenantId?: string;
  createBy?: number;
  createTime?: string;
  updateTime?: string;
  deleted?: number;
}

export interface RiskMatrixCalculateResult {
  probability: number;
  severity: number;
  score: number;
  riskLevel: string;
}
