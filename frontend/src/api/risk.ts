import http from '@/utils/http';
import type {
  RiskAssessment,
  RiskQueryParams,
  HeatmapDataPoint,
  RiskMatrix,
  RiskMatrixCalculateResult
} from '@/types/risk';

export const riskApi = {
  // 风险评估相关
  list: (params: RiskQueryParams) =>
    http.get<any>('/risk-assessments/list', { params }),

  listByMatrixCell: (probability: number, impact: number, params?: RiskQueryParams) =>
    http.get<any>('/risk-assessments/list', {
      params: { ...params, probability, impact }
    }),

  getById: (id: number) =>
    http.get<RiskAssessment>(`/risk-assessments/${id}`),

  create: (data: RiskAssessment) =>
    http.post<RiskAssessment>('/risk-assessments', data),

  update: (id: number, data: RiskAssessment) =>
    http.put<RiskAssessment>(`/risk-assessments/${id}`, data),

  delete: (id: number) =>
    http.delete<void>(`/risk-assessments/${id}`),

  getMatrix: () =>
    http.get<HeatmapDataPoint[]>('/risk-assessments/matrix'),

  getTrend: (params?: { startDate?: string; endDate?: string; period?: string }) =>
    http.get<any[]>('/risk-assessments/trend', { params }),

  // 风险矩阵配置相关
  matrixList: (params: { pageNum?: number; pageSize?: number } = {}) =>
    http.get<any>('/risk-matrix/list', { params }),

  matrixGetActive: () =>
    http.get<RiskMatrix[]>('/risk-matrix/active'),

  matrixGetById: (id: number) =>
    http.get<RiskMatrix>(`/risk-matrix/${id}`),

  matrixCreate: (data: RiskMatrix) =>
    http.post<RiskMatrix>('/risk-matrix', data),

  matrixUpdate: (id: number, data: RiskMatrix) =>
    http.put<RiskMatrix>(`/risk-matrix/${id}`, data),

  matrixDelete: (id: number) =>
    http.delete<void>(`/risk-matrix/${id}`),

  matrixSetActive: (id: number, active: number) =>
    http.put<void>(`/risk-matrix/${id}/active`, null, { params: { active } }),

  matrixCalculate: (probability: number, severity: number) =>
    http.get<RiskMatrixCalculateResult>('/risk-matrix/calculate', {
      params: { probability, severity }
    })
};
