/**
 * @file api/borrow.ts
 * @description 借用管理 API 模块
 */

import http from '@/utils/http';
import type { PaginatedResponse } from '@/types/common';
import type { AssetBorrow, CreateBorrowRequest, UpdateBorrowRequest, BorrowListQuery } from '@/types/borrow';

export const getBorrows = (params?: BorrowListQuery) =>
  http.get<PaginatedResponse<AssetBorrow>>('/borrows', { params });

export const getBorrow = (id: number) =>
  http.get<AssetBorrow>(`/borrows/${id}`);

export const createBorrow = (data: CreateBorrowRequest) =>
  http.post<AssetBorrow>('/borrows', data);

export const updateBorrow = (id: number, data: UpdateBorrowRequest) =>
  http.put<AssetBorrow>(`/borrows/${id}`, data);

export const deleteBorrow = (id: number) =>
  http.delete<void>(`/borrows/${id}`);

export const submitBorrow = (id: number) =>
  http.post<AssetBorrow>(`/borrows/${id}/submit`);

export const approveBorrow = (id: number) =>
  http.post<AssetBorrow>(`/borrows/${id}/approve`);

export const rejectBorrow = (id: number, reason?: string) =>
  http.post<AssetBorrow>(`/borrows/${id}/reject`, null, { params: { reason } });

export const borrowAsset = (id: number) =>
  http.post<AssetBorrow>(`/borrows/${id}/borrow`);

export const returnBorrow = (id: number, remark?: string) =>
  http.post<AssetBorrow>(`/borrows/${id}/return`, null, { params: { remark } });

export const cancelBorrow = (id: number) =>
  http.post<AssetBorrow>(`/borrows/${id}/cancel`);
