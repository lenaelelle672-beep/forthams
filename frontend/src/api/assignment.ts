/**
 * @file api/assignment.ts
 * @description 领用归还 API 模块
 */

import http from '@/utils/http';
import type { PaginatedResponse } from '@/types/common';
import type { AssetAssignment, CreateAssignmentRequest, UpdateAssignmentRequest, AssignmentListQuery } from '@/types/assignment';

export const getAssignments = (params?: AssignmentListQuery) =>
  http.get<PaginatedResponse<AssetAssignment>>('/assignments', { params });

export const getAssignment = (id: number) =>
  http.get<AssetAssignment>(`/assignments/${id}`);

export const createAssignment = (data: CreateAssignmentRequest) =>
  http.post<AssetAssignment>('/assignments', data);

export const updateAssignment = (id: number, data: UpdateAssignmentRequest) =>
  http.put<AssetAssignment>(`/assignments/${id}`, data);

export const deleteAssignment = (id: number) =>
  http.delete<void>(`/assignments/${id}`);

export const submitAssignment = (id: number) =>
  http.post<AssetAssignment>(`/assignments/${id}/submit`);

export const approveAssignment = (id: number) =>
  http.post<AssetAssignment>(`/assignments/${id}/approve`);

export const rejectAssignment = (id: number, reason?: string) =>
  http.post<AssetAssignment>(`/assignments/${id}/reject`, null, { params: { reason } });

export const checkoutAssignment = (id: number) =>
  http.post<AssetAssignment>(`/assignments/${id}/checkout`);

export const returnRequestAssignment = (id: number) =>
  http.post<AssetAssignment>(`/assignments/${id}/return-request`);

export const approveReturnAssignment = (id: number, returnCondition?: string) =>
  http.post<AssetAssignment>(`/assignments/${id}/approve-return`, null, { params: { returnCondition } });

export const cancelAssignment = (id: number) =>
  http.post<AssetAssignment>(`/assignments/${id}/cancel`);
