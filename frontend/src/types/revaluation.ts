/**
 * @file types/revaluation.ts
 * @description 资产减值/重估类型定义
 */
export interface AssetRevaluation {
  id?: number;
  assetId: number;
  assetName?: string;
  assetNo?: string;
  revaluationType: 'IMPAIRMENT' | 'REVALUATION';
  previousValue: number;
  newValue: number;
  reason?: string;
  evidence?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: number;
  approvedAt?: string;
  createTime?: string;
}

export interface RevaluationCreateRequest {
  assetId: number;
  revaluationType: 'IMPAIRMENT' | 'REVALUATION';
  newValue: number;
  reason?: string;
  evidence?: string;
}

export interface RevaluationApproveRequest {
  status: 'APPROVED' | 'REJECTED';
  approvedBy: number;
}

export interface RevaluationQuery {
  status?: string;
  assetId?: number;
  page?: number;
  pageSize?: number;
}
