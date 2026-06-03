/**
 * @file api/revaluation.ts
 * @description 资产减值/重估 API 封装
 */
import http from '@/utils/http';
import type { AssetRevaluation, RevaluationCreateRequest, RevaluationApproveRequest, RevaluationUpdateRequest } from '@/types/revaluation';

export const getRevaluations = (params?: any) =>
  http.get<any>('/revaluations', { params });

export const getRevaluationDetail = (id: number) =>
  http.get<AssetRevaluation>('/revaluations/' + id);

export const createRevaluation = (data: RevaluationCreateRequest) =>
  http.post<AssetRevaluation>('/revaluations', data);

export const updateRevaluation = (id: number, data: RevaluationUpdateRequest) =>
  http.put<AssetRevaluation>('/revaluations/' + id, data);

export const deleteRevaluation = (id: number) =>
  http.delete('/revaluations/' + id);

export const approveRevaluation = (id: number, data: RevaluationApproveRequest) =>
  http.post<AssetRevaluation>('/revaluations/' + id + '/approve', data);
