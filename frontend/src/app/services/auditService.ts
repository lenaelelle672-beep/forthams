/**
 * @module auditService
 * @description 审计日志数据接入层服务，封装审计日志列表查询、趋势聚合、元数据获取等 API 调用，
 * 并提供时间格式化（Local -> UTC）、筛选器参数校验、分页约束校验及图表粒度自适应等工具函数。
 *
 * 对应 SPEC Phase 1: 核心审计日志查询与可视化基座
 * - ATB-01: 多维筛选与分页
 * - ATB-02: 时间跨度越界拦截
 * - ATB-03: 趋势数据聚合
 * - ATB-05: 筛选器联动与数据刷新
 * - ATB-06: 趋势图表渲染
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * 审计日志列表查询参数
 */
export interface AuditLogListParams {
  /** 查询起始时间，ISO 8601 UTC 格式（如 2025-01-01T00:00:00Z） */
  start_time: string;
  /** 查询结束时间，ISO 8601 UTC 格式 */
  end_time: string;
  /** 操作人 ID（可选） */
  operator_id?: string;
  /** 操作类型枚举值（可选），由 /api/v1/audit-log/meta 动态下发 */
  action_type?: string;
  /** 所属模块（可选），如 ASSET / USER / APPROVAL 等 */
  module?: string;
  /** 页码，从 1 开始 */
  page: number;
  /** 每页条数，上限 100，默认 50 */
  size: number;
}

/**
 * 审计日志趋势查询参数
 */
export interface AuditLogTrendParams {
  /** 查询起始时间，ISO 8601 UTC 格式 */
  start_time: string;
  /** 查询结束时间，ISO 8601 UTC 格式 */
  end_time: string;
  /** 聚合粒度：hour / day / week，可由 determineGranularity 自动推断 */
  granularity?: 'hour' | 'day' | 'week';
  /** 操作类型（可选） */
  action_type?: string;
  /** 操作人 ID（可选） */
  operator_id?: string;
}

/**
 * 单条审计日志记录
 */
export interface AuditLogItem {
  /** 日志唯一标识 */
  id: string;
  /** 操作人 ID */
  operator_id: string;
  /** 操作人姓名 */
  operator_name: string;
  /** 操作类型（如 LOGIN、DELETE 等） */
  action_type: string;
  /** 资源类型 */
  resource_type: string;
  /** 资源 ID */
  resource_id: string;
  /** 操作详情 */
  detail: string;
  /** 操作来源 IP */
  ip_address: string;
  /** 操作时间，ISO 8601 UTC 格式 */
  created_at: string;
}

/**
 * 审计日志列表响应
 */
export interface AuditLogListResponse {
  /** 符合条件的总记录数 */
  total: number;
  /** 当前页的审计日志条目 */
  items: AuditLogItem[];
}

/**
 * 趋势数据点
 */
export interface TrendDataPoint {
  /** 时间戳，ISO 8601 UTC 格式 */
  timestamp: string;
  /** 该时间段内的操作计数 */
  count: number;
}

/**
 * 审计日志趋势响应
 */
export interface AuditLogTrendResponse {
  /** 实际使用的聚合粒度 */
  granularity: 'hour' | 'day' | 'week';
  /** 趋势数据点列表 */
  data_points: TrendDataPoint[];
}

/**
 * 审计日志元数据响应（操作类型枚举等）
 */
export interface AuditLogMetaResponse {
  /** 后端统一下发的操作类型枚举列表 */
  action_types: string[];
}

/**
 * 时间范围校验结果
 */
export interface TimeRangeValidationResult {
  /** 是否合法 */
  valid: boolean;
  /** 错误信息（合法时为 null） */
  error: string | null;
}

/**
 * 分页校验结果
 */
export interface PaginationValidationResult {
  /** 是否合法 */
  valid: boolean;
  /** 修正后的 page 值 */
  page: number;
  /** 修正后的 size 值 */
  size: number;
  /** 错误信息（合法时为 null） */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 单次查询最大时间跨度（天） */
const MAX_TIME_RANGE_DAYS = 90;

/** 默认每页条数 */
const DEFAULT_PAGE_SIZE = 50;

/** 每页最大条数 */
const MAX_PAGE_SIZE = 100;

/** 最大偏移量（深度分页限制） */
const MAX_OFFSET = 10000;

/** API 基础路径 */
const API_BASE = '/api/v1/audit-log';

// ---------------------------------------------------------------------------
// Utility: Time Formatting
// ---------------------------------------------------------------------------

/**
 * 将本地 Date 对象转换为 UTC ISO 8601 字符串。
 * 后端存储与 API 交互强制使用 UTC 时间。
 *
 * @param date 本地 Date 对象
 * @returns ISO 8601 UTC 字符串，如 "2025-06-15T08:00:00.000Z"
 */
export function toUTCISOString(date: Date): string {
  return date.toISOString();
}

/**
 * 将 UTC ISO 8601 字符串转换为用户本地时区的 Date 对象，
 * 用于前端展示。
 *
 * @param utcString UTC ISO 8601 字符串
 * @returns 本地时区的 Date 对象
 */
export function fromUTCToLocal(utcString: string): Date {
  return new Date(utcString);
}

/**
 * 将 UTC ISO 8601 字符串格式化为本地时区的可读字符串。
 *
 * @param utcString UTC ISO 8601 字符串
 * @param locale 区域设置，默认 'zh-CN'
 * @param options Intl.DateTimeFormat 选项
 * @returns 本地格式化的时间字符串
 */
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

/**
 * 获取当天起始时间（本地时区 00:00:00）对应的 UTC ISO 字符串。
 * 常用于筛选器默认值。
 *
 * @param daysAgo 距今天的天数，默认 7
 * @returns UTC ISO 8601 字符串
 */
export function getDaysAgoUTC(daysAgo: number = 7): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 0, 0, 0, 0);
  return toUTCISOString(start);
}

/**
 * 获取当天结束时间（本地时区 23:59:59）对应的 UTC ISO 字符串。
 *
 * @returns UTC ISO 8601 字符串
 */
export function getTodayEndUTC(): string {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return toUTCISOString(end);
}

// ---------------------------------------------------------------------------
// Utility: Validation
// ---------------------------------------------------------------------------

/**
 * 校验时间范围是否超过 90 天限制。
 * 单次查询时间跨度不得超过 90 天，超出范围请求将被 API 拒绝。
 *
 * @param startTime 起始时间，ISO 8601 UTC 格式
 * @param endTime   结束时间，ISO 8601 UTC 格式
 * @returns 校验结果
 */
export function validateTimeRange(startTime: string, endTime: string): TimeRangeValidationResult {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: '无效的时间格式，请使用 ISO 8601 格式' };
  }

  if (start >= end) {
    return { valid: false, error: '起始时间必须早于结束时间' };
  }

  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > MAX_TIME_RANGE_DAYS) {
    return {
      valid: false,
      error: `查询时间跨度不得超过 ${MAX_TIME_RANGE_DAYS} 天，当前跨度为 ${Math.ceil(diffDays)} 天`,
    };
  }

  return { valid: true, error: null };
}

/**
 * 校验并修正分页参数。
 * - 单页上限 100 条（默认 50 条）
 * - 深度分页限制偏移量不超过 10000
 *
 * @param page 页码，从 1 开始
 * @param size 每页条数
 * @returns 校验结果及修正后的值
 */
export function validatePagination(page: number, size: number): PaginationValidationResult {
  let correctedPage = page;
  let correctedSize = size;
  let error: string | null = null;

  // 页码最小为 1
  if (!Number.isInteger(page) || page < 1) {
    correctedPage = 1;
    error = '页码必须为大于 0 的整数，已修正为 1';
  }

  // 每页条数约束
  if (!Number.isInteger(size) || size < 1) {
    correctedSize = DEFAULT_PAGE_SIZE;
    error = error ?? `每页条数必须为正整数，已修正为 ${DEFAULT_PAGE_SIZE}`;
  } else if (size > MAX_PAGE_SIZE) {
    correctedSize = MAX_PAGE_SIZE;
    error = error ?? `每页条数上限为 ${MAX_PAGE_SIZE}，已自动修正`;
  }

  // 深度分页偏移量限制
  const offset = (correctedPage - 1) * correctedSize;
  if (offset > MAX_OFFSET) {
    correctedPage = Math.floor(MAX_OFFSET / correctedSize) + 1;
    error = `分页偏移量不得超过 ${MAX_OFFSET}，已修正页码为 ${correctedPage}`;
  }

  return { valid: error === null, page: correctedPage, size: correctedSize, error };
}

// ---------------------------------------------------------------------------
// Utility: Granularity Auto-Detection
// ---------------------------------------------------------------------------

/**
 * 根据查询时间范围自适应确定趋势图表的聚合粒度。
 * - ≤7 天：按小时聚合
 * - 8-30 天：按天聚合
 * - >30 天：按周聚合
 *
 * @param startTime 起始时间，ISO 8601 UTC 格式
 * @param endTime   结束时间，ISO 8601 UTC 格式
 * @returns 聚合粒度
 */
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

// ---------------------------------------------------------------------------
// API: HTTP Helper
// ---------------------------------------------------------------------------

/**
 * 通用 HTTP 请求封装。
 * 在生产环境中应替换为项目统一的 http 工具（如 axios 实例），
 * 此处提供独立实现以避免循环依赖。
 *
 * @param url    请求 URL
 * @param params 查询参数对象
 * @returns 解析后的 JSON 响应
 * @throws 当响应状态码非 2xx 时抛出包含状态码与错误信息的异常
 */
async function requestApi<T>(url: string, params: Record<string, string | number>): Promise<T> {
  const queryString = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const fullUrl = queryString ? `${url}?${queryString}` : url;

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMessage = `请求失败: HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.message || errorBody?.detail || errorBody?.error) {
        errorMessage = errorBody.message || errorBody.detail || errorBody.error;
      }
    } catch {
      // 响应体非 JSON，使用默认错误信息
    }

    const error = new Error(errorMessage) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API: Audit Log List
// ---------------------------------------------------------------------------

/**
 * 查询审计日志列表，支持多条件动态组合筛选与分页。
 * 对应 ATB-01: 后端 API 多维筛选与分页。
 *
 * 前置校验：
 * - 时间范围不超过 90 天（ATB-02）
 * - 分页参数合规
 *
 * @param params 查询参数
 * @returns 分页审计日志列表
 * @throws 时间范围越界或分页参数非法时抛出错误
 */
export async function fetchAuditLogList(
  params: Omit<AuditLogListParams, 'start_time' | 'end_time'> & {
    start_time: string | Date;
    end_time: string | Date;
  }
): Promise<AuditLogListResponse> {
  // 统一转换为 UTC ISO 字符串
  const startTimeStr = typeof params.start_time === 'string'
    ? params.start_time
    : toUTCISOString(params.start_time);
  const endTimeStr = typeof params.end_time === 'string'
    ? params.end_time
    : toUTCISOString(params.end_time);

  // 时间范围校验
  const timeValidation = validateTimeRange(startTimeStr, endTimeStr);
  if (!timeValidation.valid) {
    const error = new Error(timeValidation.error!) as Error & { status: number };
    error.status = 400;
    throw error;
  }

  // 分页参数校验与修正
  const paginationValidation = validatePagination(params.page, params.size);
  const { page, size } = paginationValidation;

  // 构建请求参数
  const queryParams: Record<string, string | number> = {
    start_time: startTimeStr,
    end_time: endTimeStr,
    page,
    size,
  };

  if (params.operator_id) {
    queryParams.operator_id = params.operator_id;
  }
  if (params.action_type) {
    queryParams.action_type = params.action_type;
  }
  if ((params as AuditLogListParams).module) {
    queryParams.module = (params as AuditLogListParams).module!;
  }

  return requestApi<AuditLogListResponse>(`${API_BASE}/list`, queryParams);
}

// ---------------------------------------------------------------------------
// API: Audit Log Trend
// ---------------------------------------------------------------------------

/**
 * 查询审计日志趋势聚合数据，支持按时间粒度统计操作频次。
 * 对应 ATB-03: 后端 API 趋势数据聚合。
 *
 * 若未指定 granularity，将根据时间范围自动推断：
 * - ≤7 天按小时，8-30 天按天，>30 天按周。
 *
 * @param params 趋势查询参数
 * @returns 趋势聚合数据
 * @throws 时间范围越界时抛出错误
 */
export async function fetchAuditLogTrend(
  params: Omit<AuditLogTrendParams, 'start_time' | 'end_time'> & {
    start_time: string | Date;
    end_time: string | Date;
  }
): Promise<AuditLogTrendResponse> {
  // 统一转换为 UTC ISO 字符串
  const startTimeStr = typeof params.start_time === 'string'
    ? params.start_time
    : toUTCISOString(params.start_time);
  const endTimeStr = typeof params.end_time === 'string'
    ? params.end_time
    : toUTCISOString(params.end_time);

  // 时间范围校验
  const timeValidation = validateTimeRange(startTimeStr, endTimeStr);
  if (!timeValidation.valid) {
    const error = new Error(timeValidation.error!) as Error & { status: number };
    error.status = 400;
    throw error;
  }

  // 自动推断粒度
  const granularity = params.granularity ?? determineGranularity(startTimeStr, endTimeStr);

  // 构建请求参数
  const queryParams: Record<string, string | number> = {
    start_time: startTimeStr,
    end_time: endTimeStr,
    granularity,
  };

  if (params.action_type) {
    queryParams.action_type = params.action_type;
  }
  if (params.operator_id) {
    queryParams.operator_id = params.operator_id;
  }

  return requestApi<AuditLogTrendResponse>(`${API_BASE}/trend`, queryParams);
}

// ---------------------------------------------------------------------------
// API: Audit Log Meta
// ---------------------------------------------------------------------------

/**
 * 获取审计日志元数据，包含后端统一下发的操作类型枚举。
 * 前端禁止硬编码操作类型，需通过此接口动态渲染筛选项。
 *
 * @returns 元数据响应，包含 action_types 列表
 */
export async function fetchAuditLogMeta(): Promise<AuditLogMetaResponse> {
  return requestApi<AuditLogMetaResponse>(`${API_BASE}/meta`, {});
}

// ---------------------------------------------------------------------------
// Composite: Full Dashboard Data Fetch
// ---------------------------------------------------------------------------

/**
 * 审计仪表板完整查询参数
 */
export interface AuditDashboardQueryParams {
  /** 起始时间，Date 对象或 ISO 字符串 */
  start_time: string | Date;
  /** 结束时间，Date 对象或 ISO 字符串 */
  end_time: string | Date;
  /** 操作类型（可选） */
  action_type?: string;
  /** 操作人 ID（可选） */
  operator_id?: string;
  /** 页码，默认 1 */
  page?: number;
  /** 每页条数，默认 50 */
  size?: number;
}

/**
 * 审计仪表板完整数据响应
 */
export interface AuditDashboardData {
  /** 日志列表响应 */
  list: AuditLogListResponse;
  /** 趋势数据响应 */
  trend: AuditLogTrendResponse;
}

/**
 * 一次性获取仪表板所需的列表与趋势数据。
 * 用于筛选器联动场景（ATB-05），一次触发同时刷新表格与图表。
 *
 * @param params 仪表板查询参数
 * @returns 列表与趋势的聚合数据
 * @throws 时间范围越界或分页参数非法时抛出错误
 */
export async function fetchAuditDashboardData(
  params: AuditDashboardQueryParams
): Promise<AuditDashboardData> {
  const listParams: Parameters<typeof fetchAuditLogList>[0] = {
    start_time: params.start_time,
    end_time: params.end_time,
    page: params.page ?? 1,
    size: params.size ?? DEFAULT_PAGE_SIZE,
  };

  if (params.action_type) {
    listParams.action_type = params.action_type;
  }
  if (params.operator_id) {
    listParams.operator_id = params.operator_id;
  }

  const trendParams: Parameters<typeof fetchAuditLogTrend>[0] = {
    start_time: params.start_time,
    end_time: params.end_time,
  };

  if (params.action_type) {
    trendParams.action_type = params.action_type;
  }
  if (params.operator_id) {
    trendParams.operator_id = params.operator_id;
  }

  // 并行请求列表与趋势数据
  const [list, trend] = await Promise.all([
    fetchAuditLogList(listParams),
    fetchAuditLogTrend(trendParams),
  ]);

  return { list, trend };
}

// ---------------------------------------------------------------------------
// Types: Audit Detail
// ---------------------------------------------------------------------------

/**
 * 审计日志详情记录（含 Request/Response/Metadata 展开）
 */
export interface AuditLogDetail {
  /** 日志唯一标识 */
  id: string;
  /** 操作人 ID */
  operator_id: string;
  /** 操作人姓名 */
  operator_name: string;
  /** 操作类型 */
  action_type: string;
  /** 资源类型 */
  resource_type: string;
  /** 资源 ID */
  resource_id: string;
  /** 操作详情（JSON 字符串或纯文本） */
  detail: string;
  /** 操作来源 IP */
  ip_address: string;
  /** 操作时间，ISO 8601 UTC 格式 */
  created_at: string;
  /** 请求载荷（可选，JSON 字符串） */
  request_payload?: string;
  /** 响应载荷（可选，JSON 字符串） */
  response_payload?: string;
  /** 扩展元数据（可选） */
  metadata?: Record<string, unknown>;
}

/**
 * 审计日志详情 API 响应
 */
export interface AuditLogDetailResponse {
  /** 是否成功 */
  success: boolean;
  /** 日志详情数据 */
  data: AuditLogDetail;
}

// ---------------------------------------------------------------------------
// Permission Check Helper
// ---------------------------------------------------------------------------

/** 允许访问审计仪表板的角色列表 */
const AUDIT_ALLOWED_ROLES = ['admin', 'auditor'] as const;

/**
 * 检查用户角色是否有权访问审计仪表板。
 * 仅 admin 或 auditor 角色可访问（ATB-04）。
 *
 * @param userRoles 用户角色列表
 * @returns 是否有权限
 */
export function hasAuditPermission(userRoles: string[]): boolean {
  if (!Array.isArray(userRoles) || userRoles.length === 0) {
    return false;
  }
  return userRoles.some(
    (role) => AUDIT_ALLOWED_ROLES.includes(role as typeof AUDIT_ALLOWED_ROLES[number])
  );
}

// ---------------------------------------------------------------------------
// API: Audit Log Detail
// ---------------------------------------------------------------------------

/**
 * 获取单条审计日志的详情数据，含 Request/Response/Metadata 展开。
 * 通过 GET /api/v1/audit-log/:id 获取。
 *
 * @param id 审计日志唯一标识
 * @returns 审计日志详情
 * @throws 日志不存在时返回 404
 */
export async function fetchAuditDetail(id: string): Promise<AuditLogDetail> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = new Error(
      response.status === 404
        ? '审计日志未找到'
        : `请求失败: HTTP ${response.status}`,
    ) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  const result = await response.json();
  // Support both direct object and wrapped { data: ... } response
  return result.data ?? result;
}

// ---------------------------------------------------------------------------
// Default Export: Service Object
// ---------------------------------------------------------------------------

/**
 * 审计日志服务对象，聚合所有审计相关 API 与工具函数。
 * 可在 composable / hook 中按需解构使用。
 */
const auditService = {
  // API 方法
  fetchAuditLogList,
  fetchAuditLogTrend,
  fetchAuditLogMeta,
  fetchAuditDashboardData,

  // 时间工具
  toUTCISOString,
  fromUTCToLocal,
  formatUTCToLocalDisplay,
  getDaysAgoUTC,
  getTodayEndUTC,

  // 校验工具
  validateTimeRange,
  validatePagination,

  // 粒度推断
  determineGranularity,

  // 权限检查
  hasAuditPermission,

  // 常量
  MAX_TIME_RANGE_DAYS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_OFFSET,
} as const;

export default auditService;