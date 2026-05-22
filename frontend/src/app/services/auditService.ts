import { api } from '../utils/api';

export interface AuditLogListParams {
  start_time: string;
  end_time: string;
  operator_id?: string;
  action_type?: string;
  module?: string;
  page: number;
  size: number;
}

export interface AuditLogTrendParams {
  start_time: string | Date;
  end_time: string | Date;
  operator_id?: string;
  action_type?: string;
  module?: string;
}

export interface AuditLogItem {
  id: string;
  operator_id: string;
  operator_name: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  detail: string;
  ip_address: string;
  created_at: string;
}

export interface AuditLogListResponse {
  total: number;
  items: AuditLogItem[];
}

export interface TrendDataPoint {
  timestamp: string;
  count: number;
}

export interface AuditLogTrendResponse {
  granularity: 'hour' | 'day' | 'week';
  data_points: TrendDataPoint[];
}

export interface AuditLogMetaResponse {
  action_types: string[];
}

export interface AuditLogDetail {
  id: string;
  operator_id: string;
  operator_name: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  detail: string;
  ip_address: string;
  created_at: string;
  request_payload?: string;
  response_payload?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogDetailResponse {
  success: boolean;
  data: AuditLogDetail;
}

const MAX_TIME_RANGE_DAYS = 90;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 10000;
const API_BASE = '/audit-logs';

export { MAX_TIME_RANGE_DAYS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_OFFSET };

export function toUTCISOString(date: Date): string {
  return date.toISOString();
}

export function fromUTCToLocal(utcString: string): Date {
  return new Date(utcString);
}

export function formatUTCToLocalDisplay(
  utcString: string,
  locale: string = 'zh-CN',
  options?: Intl.DateTimeFormatOptions
): string {
  const date = fromUTCToLocal(utcString);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options,
  };
  return date.toLocaleString(locale, defaultOptions);
}

export function getDaysAgoUTC(daysAgo: number = 7): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 0, 0, 0, 0);
  return toUTCISOString(start);
}

export function getTodayEndUTC(): string {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return toUTCISOString(end);
}

export interface TimeRangeValidationResult {
  valid: boolean;
  error: string | null;
}

export function validateTimeRange(startTime: string, endTime: string): TimeRangeValidationResult {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: '无效的时间格式，请使用 ISO 8601 格式' };
  }

  if (start >= end) {
    return { valid: false, error: '起始时间必须早于结束时间' };
  }

  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays > MAX_TIME_RANGE_DAYS) {
    return {
      valid: false,
      error: `查询时间跨度不得超过 ${MAX_TIME_RANGE_DAYS} 天，当前跨度为 ${Math.ceil(diffDays)} 天`,
    };
  }

  return { valid: true, error: null };
}

export interface PaginationValidationResult {
  valid: boolean;
  page: number;
  size: number;
  error: string | null;
}

export function validatePagination(page: number, size: number): PaginationValidationResult {
  let correctedPage = page;
  let correctedSize = size;
  let error: string | null = null;

  if (!Number.isInteger(page) || page < 1) {
    correctedPage = 1;
    error = '页码必须为大于 0 的整数，已修正为 1';
  }

  if (!Number.isInteger(size) || size < 1) {
    correctedSize = DEFAULT_PAGE_SIZE;
    error = error ?? `每页条数必须为正整数，已修正为 ${DEFAULT_PAGE_SIZE}`;
  } else if (size > MAX_PAGE_SIZE) {
    correctedSize = MAX_PAGE_SIZE;
    error = error ?? `每页条数上限为 ${MAX_PAGE_SIZE}，已自动修正`;
  }

  const offset = (correctedPage - 1) * correctedSize;
  if (offset > MAX_OFFSET) {
    correctedPage = Math.floor(MAX_OFFSET / correctedSize) + 1;
    error = `分页偏移量不得超过 ${MAX_OFFSET}，已修正页码为 ${correctedPage}`;
  }

  return { valid: error === null, page: correctedPage, size: correctedSize, error };
}

export function determineGranularity(
  startTime: string,
  endTime: string
): 'hour' | 'day' | 'week' {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays <= 7) {
    return 'hour';
  } else if (diffDays <= 30) {
    return 'day';
  } else {
    return 'week';
  }
}

interface BackendPageResponse {
  records: AuditLogItem[];
  total: number;
  current: number;
  size: number;
}

export async function fetchAuditLogList(
  params: Omit<AuditLogListParams, 'start_time' | 'end_time'> & {
    start_time: string | Date;
    end_time: string | Date;
  }
): Promise<AuditLogListResponse> {
  const startTimeStr = typeof params.start_time === 'string'
    ? params.start_time
    : toUTCISOString(params.start_time);
  const endTimeStr = typeof params.end_time === 'string'
    ? params.end_time
    : toUTCISOString(params.end_time);

  const timeValidation = validateTimeRange(startTimeStr, endTimeStr);
  if (!timeValidation.valid) {
    const error = new Error(timeValidation.error!) as Error & { status: number };
    error.status = 400;
    throw error;
  }

  const paginationValidation = validatePagination(params.page, params.size);
  const { page, size } = paginationValidation;

  const queryParams = new URLSearchParams();
  queryParams.set('start_time', startTimeStr);
  queryParams.set('end_time', endTimeStr);
  queryParams.set('page', String(page - 1));
  queryParams.set('size', String(size));

  if (params.operator_id) queryParams.set('operator_id', params.operator_id);
  if (params.action_type) queryParams.set('operation_type', params.action_type);
  if (params.module) queryParams.set('module', params.module);

  const backendPage = await api.get<BackendPageResponse>(
    `${API_BASE}/list?${queryParams.toString()}`
  );

  return {
    total: backendPage.total,
    items: (backendPage.records ?? []).map((r: Record<string, unknown>) => ({
      id: String((r as Record<string, unknown>).id ?? ''),
      operator_id: String((r as Record<string, unknown>).operatorId ?? ''),
      operator_name: String((r as Record<string, unknown>).operatorName ?? ''),
      action_type: String((r as Record<string, unknown>).operationType ?? ''),
      resource_type: String((r as Record<string, unknown>).resourceType ?? ''),
      resource_id: String((r as Record<string, unknown>).resourceId ?? ''),
      detail: String((r as Record<string, unknown>).action ?? ''),
      ip_address: String((r as Record<string, unknown>).ipAddress ?? ''),
      created_at: (r as Record<string, unknown>).timestamp ? new Date((r as Record<string, unknown>).timestamp as string).toISOString() : '',
    })),
  };
}

interface BackendTrendResponse {
  granularity: string;
  startDate: string;
  endDate: string;
  data: Array<{ date: string; count: number }>;
}

export async function fetchAuditLogTrend(
  params: AuditLogTrendParams
): Promise<AuditLogTrendResponse> {
  const startTimeStr = typeof params.start_time === 'string'
    ? params.start_time
    : toUTCISOString(params.start_time);
  const endTimeStr = typeof params.end_time === 'string'
    ? params.end_time
    : toUTCISOString(params.end_time);

  const startLocal = new Date(startTimeStr).toISOString().split('T')[0];
  const endLocal = new Date(endTimeStr).toISOString().split('T')[0];

  const granularity = determineGranularity(startTimeStr, endTimeStr);
  const backendGranularity = granularity === 'hour' ? 'hourly' : granularity === 'week' ? 'weekly' : 'daily';

  const queryParams = new URLSearchParams();
  queryParams.set('startDate', startLocal);
  queryParams.set('endDate', endLocal);
  queryParams.set('start_time', startTimeStr);
  queryParams.set('end_time', endTimeStr);
  queryParams.set('granularity', backendGranularity);
  if (params.operator_id) queryParams.set('operator_id', params.operator_id);
  if (params.action_type) queryParams.set('operation_type', params.action_type);
  if (params.module) queryParams.set('module', params.module);

  const backendTrend = await api.get<BackendTrendResponse>(
    `${API_BASE}/trend?${queryParams.toString()}`
  );

  return {
    granularity: granularity,
    data_points: (backendTrend.data ?? []).map((p) => ({
      timestamp: p.date,
      count: p.count,
    })),
  };
}

export async function fetchAuditLogMeta(): Promise<AuditLogMetaResponse> {
  const types = await api.get<string[]>(`${API_BASE}/meta`);
  return { action_types: types ?? [] };
}

export interface AuditDashboardQueryParams {
  start_time: string | Date;
  end_time: string | Date;
  action_type?: string;
  operator_id?: string;
  module?: string;
  page?: number;
  size?: number;
}

export interface AuditDashboardData {
  list: AuditLogListResponse;
  trend: AuditLogTrendResponse;
}

export async function fetchAuditDashboardData(
  params: AuditDashboardQueryParams
): Promise<AuditDashboardData> {
  const listParams: Parameters<typeof fetchAuditLogList>[0] = {
    start_time: params.start_time,
    end_time: params.end_time,
    page: params.page ?? 1,
    size: params.size ?? DEFAULT_PAGE_SIZE,
  };

  if (params.action_type) listParams.action_type = params.action_type;
  if (params.operator_id) listParams.operator_id = params.operator_id;
  if (params.module) listParams.module = params.module;

  const trendParams: Parameters<typeof fetchAuditLogTrend>[0] = {
    start_time: params.start_time,
    end_time: params.end_time,
  };

  if (params.action_type) trendParams.action_type = params.action_type;
  if (params.operator_id) trendParams.operator_id = params.operator_id;
  if (params.module) trendParams.module = params.module;

  const [list, trend] = await Promise.all([
    fetchAuditLogList(listParams),
    fetchAuditLogTrend(trendParams),
  ]);

  return { list, trend };
}

const AUDIT_ALLOWED_ROLES = ['admin', 'auditor'] as const;

export function hasAuditPermission(userRoles: string[]): boolean {
  if (!Array.isArray(userRoles) || userRoles.length === 0) return false;
  return userRoles.some(
    (role) => AUDIT_ALLOWED_ROLES.includes(role as typeof AUDIT_ALLOWED_ROLES[number])
  );
}

export async function fetchAuditDetail(id: string): Promise<AuditLogDetail> {
  const entry = await api.get<Record<string, unknown>>(`${API_BASE}/${encodeURIComponent(id)}`);
  if (!entry) {
    const error = new Error('审计日志未找到') as Error & { status: number };
    error.status = 404;
    throw error;
  }
  return {
    id: String(entry.id ?? ''),
    operator_id: String(entry.operatorId ?? ''),
    operator_name: String(entry.operatorName ?? ''),
    action_type: String(entry.operationType ?? ''),
    resource_type: String(entry.resourceType ?? ''),
    resource_id: String(entry.resourceId ?? ''),
    detail: String(entry.action ?? ''),
    ip_address: String(entry.ipAddress ?? ''),
    created_at: entry.timestamp ? new Date(entry.timestamp as string).toISOString() : '',
    request_payload: entry.beforeRecord as string | undefined,
    response_payload: entry.afterRecord as string | undefined,
  };
}

const auditService = {
  fetchAuditLogList,
  fetchAuditLogTrend,
  fetchAuditLogMeta,
  fetchAuditDashboardData,
  fetchAuditDetail,
  toUTCISOString,
  fromUTCToLocal,
  formatUTCToLocalDisplay,
  getDaysAgoUTC,
  getTodayEndUTC,
  validateTimeRange,
  validatePagination,
  determineGranularity,
  hasAuditPermission,
  MAX_TIME_RANGE_DAYS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_OFFSET,
} as const;

export default auditService;
