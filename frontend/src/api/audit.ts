/**
 * @file api/audit.ts
 * @description Workbench V3 审计日志只读 API wrapper。
 */

import http from '@/utils/http';
import type { PageData } from '@/types/common';

export interface AuditLog {
  id: number;
  traceId?: string;
  operationType: string;
  operatorId?: number;
  operatorName: string;
  resourceType?: string;
  resourceId?: string;
  description?: string;
  httpMethod?: string;
  requestUri?: string;
  ipAddress?: string;
  userAgent?: string;
  beforeRecordSummary?: string;
  afterRecordSummary?: string;
  rawPayloadSummary?: string;
  errorSummary?: string;
  status?: string;
  createdAt: string;
  tenantScoped?: boolean;
  masked?: boolean;
  readonlyBoundary?: string;
}

export interface AuditListQuery {
  page?: number;
  pageSize?: number;
  size?: number;
  operationType?: string;
  actionType?: string;
  operatorId?: number;
  operatorName?: string;
  startTime?: string;
  endTime?: string;
  resourceType?: string;
  resourceId?: string;
  keyword?: string;
  search?: string;
  granularity?: 'daily' | 'hourly';
  limit?: number;
}

export interface AuditTrendPoint {
  date: string;
  count: number;
}

export interface AuditTrendResponse {
  granularity: 'daily' | 'hourly' | string;
  startTime?: string;
  endTime?: string;
  data: AuditTrendPoint[];
  tenantScoped?: boolean;
  readonlyBoundary?: string;
}

export interface AuditDistributionItem {
  actionType: string;
  count: number;
  percentage: number;
}

export interface AuditDistributionResponse {
  totalOperations: number;
  distribution: AuditDistributionItem[];
  tenantScoped?: boolean;
  readonlyBoundary?: string;
}

export interface AuditOperatorRankingItem {
  rank: number;
  operatorId?: string;
  operatorName: string;
  count: number;
}

export interface AuditMetaResponse {
  operationTypes: string[];
  resourceTypes: string[];
  operators: string[];
  tenantScoped: boolean;
  masked: boolean;
  readonlyBoundary: string;
  nonGoals?: string[];
}

export interface AuditStats {
  trendData: AuditTrendPoint[];
  typeDistribution: AuditDistributionItem[];
  topOperators: AuditOperatorRankingItem[];
  totalCount: number;
  meta?: Partial<AuditMetaResponse>;
  tenantScoped?: boolean;
  masked?: boolean;
  readonlyBoundary?: string;
}

function normalizeParams(params?: AuditListQuery) {
  const page = params?.page && params.page > 0 ? params.page : 1;
  const size = params?.pageSize ?? params?.size ?? 20;
  return {
    ...params,
    page,
    size,
    pageSize: undefined,
  };
}

function normalizeAuditLog(raw: any): AuditLog {
  const operationType = raw?.operationType ?? raw?.businessType ?? raw?.action ?? 'UNKNOWN';
  const description = raw?.description ?? raw?.detail ?? raw?.action ?? raw?.resourceType;
  const createdAt = raw?.createdAt ?? raw?.createTime ?? raw?.timestamp ?? '';
  return {
    id: raw?.id,
    traceId: raw?.traceId,
    operationType,
    operatorId: raw?.operatorId,
    operatorName: raw?.operatorName ?? '未知用户',
    resourceType: raw?.resourceType ?? raw?.module,
    resourceId: raw?.resourceId,
    description,
    httpMethod: raw?.httpMethod ?? raw?.method,
    requestUri: raw?.requestUri,
    ipAddress: raw?.ipAddress ?? raw?.operatorIp,
    userAgent: raw?.userAgent,
    beforeRecordSummary: raw?.beforeRecordSummary ?? raw?.beforeRecordMasked,
    afterRecordSummary: raw?.afterRecordSummary ?? raw?.afterRecordMasked,
    rawPayloadSummary: raw?.rawPayloadSummary ?? raw?.redactedRaw,
    errorSummary: raw?.errorSummary,
    status: raw?.status,
    createdAt,
    tenantScoped: raw?.tenantScoped,
    masked: raw?.masked ?? true,
    readonlyBoundary: raw?.readonlyBoundary,
  };
}

/** 审计日志列表：GET /audit-logs */
export const getAuditLogs = async (params?: AuditListQuery) => {
  const res = await http.get<PageData<any>>('/audit-logs', {
    params: normalizeParams(params),
  });
  return {
    ...res,
    records: (res.records ?? []).map(normalizeAuditLog),
  } as PageData<AuditLog>;
};

/** 审计日志详情：GET /audit-logs/{id} */
export const getAuditLogDetail = async (id: number) => {
  const res = await http.get<any>(`/audit-logs/${id}`);
  return normalizeAuditLog(res);
};

/** 审计仪表板统计：GET /audit-logs/stats */
export const getAuditStats = (params?: Pick<AuditListQuery, 'startTime' | 'endTime' | 'operationType' | 'granularity'>) =>
  http.get<AuditStats>('/audit-logs/stats', { params });

/** 审计趋势：GET /audit-logs/trends */
export const getAuditTrends = (params?: Pick<AuditListQuery, 'startTime' | 'endTime' | 'operationType' | 'granularity'>) =>
  http.get<AuditTrendResponse>('/audit-logs/trends', { params });

/** 操作类型分布：GET /audit-logs/action-type-distribution */
export const getAuditActionTypeDistribution = (params?: Pick<AuditListQuery, 'startTime' | 'endTime'>) =>
  http.get<AuditDistributionResponse>('/audit-logs/action-type-distribution', { params });

/** 操作人排行：GET /audit-logs/operator-ranking */
export const getAuditOperatorRanking = (params?: Pick<AuditListQuery, 'startTime' | 'endTime' | 'limit'>) =>
  http.get<AuditOperatorRankingItem[]>('/audit-logs/operator-ranking', { params });

/** 审计日志筛选元数据：GET /audit-logs/meta */
export const getAuditMeta = () => http.get<AuditMetaResponse>('/audit-logs/meta');

/** 获取资产的审计日志，只复用只读列表端点 */
export const getAssetAuditLogs = (
  assetId: number,
  params?: Pick<AuditListQuery, 'page' | 'pageSize' | 'operationType' | 'startTime' | 'endTime'>,
) =>
  getAuditLogs({
    ...params,
    resourceType: 'ASSET',
    resourceId: String(assetId),
  });
