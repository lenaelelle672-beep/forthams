/**
 * 资产详情页审计日志 API 服务
 * @description 对接后端审计日志接口，提供审计日志查询功能
 * @module auditApi
 */

import http from '@/utils/http';
import type { AuditLog } from '../types/audit.types';

/** 审计日志查询参数 */
export interface AuditLogQueryParams {
  assetId: string;
  startTime?: string;
  endTime?: string;
  operationType?: string;
  page?: number;
  pageSize?: number;
}

/** 审计日志列表响应 */
export interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 获取资产审计日志列表
 * @param params - 查询参数
 * @returns 审计日志分页列表
 */
export async function getAssetAuditLogs(params: AuditLogQueryParams): Promise<AuditLogListResponse> {
  const { assetId, ...rest } = params;
  const response = await http.get<AuditLogListResponse>(`/audit/asset/${assetId}`, {
    params: rest,
  });
  return response.data;
}

/**
 * 获取审计日志趋势统计
 * @param params - 统计参数
 * @returns 趋势数据
 */
export async function getAuditTrend(params: {
  startDate: string;
  endDate: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
}): Promise<{
  timestamps: string[];
  series: Array<{ name: string; data: number[] }>;
}> {
  const response = await http.get('/audit/stats/trend', { params });
  return response.data;
}

/**
 * 获取审计日志概览统计
 * @returns 汇总指标
 */
export async function getAuditSummary(): Promise<{
  totalCount: number;
  todayCount: number;
  anomalyRatio: number;
}> {
  const response = await http.get('/audit/stats/summary');
  return response.data;
}