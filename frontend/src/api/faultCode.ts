/**
 * @file api/faultCode.ts
 * @description 故障代码 API
 */

import http from '@/utils/http';
import type { ApiResponse } from '@/types/common';
import type { FaultCode, CreateFaultCodeRequest, UpdateFaultCodeRequest } from '@/types/faultCode';

/** 获取故障代码树 */
export const getFaultCodeTree = () =>
  http.get<ApiResponse<FaultCode[]>>('/fault-codes/tree');

/** 获取指定层级的故障代码 */
export const getFaultCodeByLevel = (level: number) =>
  http.get<ApiResponse<FaultCode[]>>(`/fault-codes/level/${level}`);

/** 获取子节点 */
export const getFaultCodeChildren = (id: number) =>
  http.get<ApiResponse<FaultCode[]>>(`/fault-codes/${id}/children`);

/** 获取故障代码详情 */
export const getFaultCodeDetail = (id: number) =>
  http.get<ApiResponse<FaultCode>>(`/fault-codes/${id}`);

/** 创建故障代码 */
export const createFaultCode = (data: CreateFaultCodeRequest) =>
  http.post<ApiResponse<FaultCode>>('/fault-codes', data);

/** 更新故障代码 */
export const updateFaultCode = (id: number, data: UpdateFaultCodeRequest) =>
  http.put<ApiResponse<FaultCode>>(`/fault-codes/${id}`, data);

/** 删除故障代码 */
export const deleteFaultCode = (id: number) =>
  http.delete<ApiResponse<void>>(`/fault-codes/${id}`);
