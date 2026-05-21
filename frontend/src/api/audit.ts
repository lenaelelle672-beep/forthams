/**
 * @file api/audit.ts
 * @description 审计日志 API
 * 对应后端：AuditDashboardController (/audit-logs, /v1/audit)
 */

import http from '@/utils/http';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export interface AuditLog {
  id: number;
  operationType: string;
  operatorId?: number;
  operatorName: string;
  resourceType?: string;
  resourceId?: string;
  description?: string;
  ipAddress?: string;
  changes?: AuditFieldChange[];
  createdAt: string;
}

export interface AuditFieldChange {
  field: string;
  fieldLabel?: string;
  oldValue?: string;
  newValue?: string;
}

export interface AuditListQuery {
  page?: number;
  pageSize?: number;
  operationType?: string;
  operatorId?: number;
  startTime?: string;
  endTime?: string;
  resourceType?: string;
  resourceId?: string;
}

export interface AuditTrendPoint {
  date: string;
  count: number;
  operationType?: string;
}

export interface AuditStats {
  trendData: AuditTrendPoint[];
  typeDistribution: Record<string, number>;
  topOperators: Array<{ operatorName: string; count: number }>;
  totalCount: number;
}

/** 审计日志列表 */
export const getAuditLogs = (params?: AuditListQuery) =>
  http.get<PaginatedResponse<AuditLog>>('/audit-logs', { params });

/** 审计日志详情 */
export const getAuditLogDetail = (id: number) =>
  http.get<ApiResponse<AuditLog>>(`/audit-logs/${id}`);

/** 审计仪表板统计（趋势+分布） */
export const getAuditStats = (params?: Pick<AuditListQuery, 'startTime' | 'endTime' | 'operationType'>) =>
  http.get<ApiResponse<AuditStats>>('/v1/audit/stats', { params });

/** 获取资产的审计日志 */
export const getAssetAuditLogs = (assetId: number, params?: Pick<AuditListQuery, 'page' | 'pageSize'>) =>
  http.get<PaginatedResponse<AuditLog>>(`/audit-logs`, {
    params: { ...params, resourceType: 'ASSET', resourceId: String(assetId) },
  });
