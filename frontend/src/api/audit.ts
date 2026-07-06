/**
 * @file api/audit.ts
 * @description 审计日志 API
 * 对应后端：AuditDashboardController (/audit-logs, /v1/audit)
 */

import http from '@/utils/http';
import type { PageData } from '@/types/common';

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
  httpMethod?: string;
  userAgent?: string;
  tenantId?: string;
  raw?: Record<string, unknown>;
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

function normalizeAuditLog(raw: any): AuditLog {
  const operationType = raw?.operationType ?? raw?.businessType ?? raw?.action ?? 'UNKNOWN';
  const description = raw?.description ?? raw?.detail ?? raw?.action ?? raw?.resourceType;
  const createdAt = raw?.createdAt ?? raw?.createTime ?? raw?.timestamp ?? '';
  return {
    id: raw?.id,
    operationType,
    operatorId: raw?.operatorId,
    operatorName: raw?.operatorName ?? '未知用户',
    resourceType: raw?.resourceType ?? raw?.module,
    resourceId: raw?.resourceId ?? raw?.requestUri,
    description,
    ipAddress: raw?.ipAddress ?? raw?.operatorIp,
    changes: raw?.changes ?? [],
    createdAt,
    httpMethod: raw?.httpMethod ?? raw?.method,
    userAgent: raw?.userAgent,
    tenantId: raw?.tenantId,
    raw,
  };
}

/** 审计日志列表 */
export const getAuditLogs = async (params?: AuditListQuery & { keyword?: string; search?: string }) => {
  const page = params?.page && params.page > 0 ? params.page - 1 : 0;
  const size = params?.pageSize ?? 10;
  const res = await http.get<PageData<any>>('/audit-logs', {
    params: { ...params, page, size, pageSize: undefined },
  });
  return {
    ...res,
    records: (res.records ?? []).map(normalizeAuditLog),
  } as PageData<AuditLog>;
};

/** 审计日志详情 */
export const getAuditLogDetail = async (id: number) => {
  const res = await http.get<any>(`/audit-logs/${id}`);
  return normalizeAuditLog(res);
};

/** 审计仪表板统计（趋势+分布） */
export const getAuditStats = (params?: Pick<AuditListQuery, 'startTime' | 'endTime' | 'operationType'>) =>
  http.get<AuditStats>('/audit-logs/stats', { params });

/** 获取资产的审计日志 */
export const getAssetAuditLogs = (
  assetId: number,
  params?: Pick<AuditListQuery, 'page' | 'pageSize' | 'operationType' | 'startTime' | 'endTime'>,
) =>
  getAuditLogs({
    ...params,
    resourceType: 'ASSET',
    resourceId: String(assetId),
  });
