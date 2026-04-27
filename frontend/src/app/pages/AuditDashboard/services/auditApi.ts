/**
 * auditApi.ts — 审计日志仪表板 API 数据接入层
 *
 * 封装审计日志查询、趋势聚合及元数据获取的 API 请求函数，
 * 处理时间格式化（Local → UTC 转换），管理筛选器参数约束。
 *
 * 边界约束：
 * - 单次查询时间跨度不得超过 90 天，超出范围请求将被拒绝
 * - 列表查询强制分页，单页上限 100 条（默认 50 条）
 * - 深度分页限制偏移量不超过 10000
 * - 后端交互强制使用 UTC 时间（ISO 8601 格式）
 * - 操作类型枚举由后端统一下发（/api/v1/audit-log/meta），前端禁止硬编码
 */

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 操作类型枚举项 */
export interface ActionTypeOption {
  /** 操作类型编码，如 LOGIN、DELETE、EXPORT 等 */
  value: string;
  /** 操作类型显示名称 */
  label: string;
}

/** 审计元数据响应 */
export interface AuditMetaResponse {
  /** 后端统一下发的操作类型枚举列表 */
  actionTypes: ActionTypeOption[];
}

/** 审计日志列表查询参数 */
export interface AuditLogListParams {
  /** 开始时间（本地时间 Date 对象，发送前将转换为 UTC） */
  startTime: Date;
  /** 结束时间（本地时间 Date 对象，发送前将转换为 UTC） */
  endTime: Date;
  /** 操作人 ID（可选） */
  operatorId?: string;
  /** 操作类型编码（可选，值来源于 /api/v1/audit-log/meta 下发） */
  actionType?: string;
  /** 页码，从 1 开始（默认 1） */
  page?: number;
  /** 每页条数（默认 50，上限 100） */
  size?: number;
  /** 排序字段（可选，如 created_at、operator_id） */
  sortBy?: string;
  /** 排序方向（可选，asc / desc） */
  sortOrder?: 'asc' | 'desc';
}

/** 单条审计日志记录 */
export interface AuditLogItem {
  /** 日志唯一标识 */
  id: string;
  /** 操作人 ID */
  operatorId: string;
  /** 操作人姓名 */
  operatorName: string;
  /** 操作类型编码 */
  actionType: string;
  /** 操作描述 */
  actionDetail: string;
  /** 操作目标资源类型 */
  resourceType: string;
  /** 操作目标资源 ID */
  resourceId: string;
  /** 操作时间（UTC ISO 8601） */
  timestamp: string;
  /** 客户端 IP */
  ip: string;
  /** 附加元数据 */
  metadata?: Record<string, unknown>;
}

/** 审计日志列表响应 */
export interface AuditLogListResponse {
  /** 符合条件的总记录数 */
  total: number;
  /** 当前页数据列表 */
  items: AuditLogItem[];
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  size: number;
}

/** 审计趋势查询参数 */
export interface AuditTrendParams {
  /** 开始时间（本地时间 Date 对象） */
  startTime: Date;
  /** 结束时间（本地时间 Date 对象） */
  endTime: Date;
  /** 操作类型编码（可选，用于按类型筛选趋势） */
  actionType?: string;
  /** 操作人 ID（可选，用于按操作人筛选趋势） */
  operatorId?: string;
}

/** 趋势数据点 */
export interface AuditTrendDataPoint {
  /** 时间戳（UTC ISO 8601） */
  timestamp: string;
  /** 该时间段内的操作计数 */
  count: number;
}

/** 审计趋势响应 */
export interface AuditTrendResponse {
  /** 时间粒度标识 */
  granularity: 'hour' | 'day' | 'week';
  /** 趋势数据点数组 */
  dataPoints: AuditTrendDataPoint[];
}

/** 分页参数规范化结果 */
export interface NormalizedPagination {
  /** 规范化后的页码（≥1） */
  page: number;
  /** 规范化后的每页条数（1–100） */
  size: number;
  /** 计算得到的偏移量 */
  offset: number;
}

/** 时间范围校验结果 */
export interface TimeRangeValidationResult {
  /** 是否通过校验 */
  valid: boolean;
  /** 校验失败时的错误信息 */
  error?: string;
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 单次查询最大时间跨度（天） */
const MAX_TIME_SPAN_DAYS = 90;

/** 默认每页条数 */
const DEFAULT_PAGE_SIZE = 50;

/** 每页最大条数 */
const MAX_PAGE_SIZE = 100;

/** 最大偏移量（深度分页限制） */
const MAX_OFFSET = 10000;

/** API 基础路径 */
const API_BASE = '/api/v1/audit-log';

// ---------------------------------------------------------------------------
// HTTP 客户端适配
// ---------------------------------------------------------------------------

/**
 * 获取 HTTP 请求客户端实例
 * 优先使用 app/utils/api 中的 apiClient，若不可用则回退至 fetch
 * @returns 带有 get 方法的 HTTP 客户端对象
 */
function getHttpClient(): { get<T>(url: string, config?: { params?: Record<string, string> }): Promise<{ data: T }> } {
  // 尝试引入项目统一的 apiClient
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const apiModule = require('../../utils/api');
    if (apiModule && apiModule.apiClient) {
      return apiModule.apiClient;
    }
  } catch {
    // 回退至基于 fetch 的简易实现
  }

  return {
    async get<T>(url: string, config?: { params?: Record<string, string> }): Promise<{ data: T }> {
      const queryString = config?.params
        ? '?' + new URLSearchParams(config.params).toString()
        : '';
      const response = await fetch(`${url}${queryString}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} — ${errorBody}`
        );
      }

      const data: T = await response.json();
      return { data };
    },
  };
}

/** 惰性初始化的 HTTP 客户端单例 */
let _httpClient: ReturnType<typeof getHttpClient> | null = null;

/**
 * 获取 HTTP 客户端单例
 * @returns HTTP 客户端实例
 */
function httpClient(): ReturnType<typeof getHttpClient> {
  if (!_httpClient) {
    _httpClient = getHttpClient();
  }
  return _httpClient;
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 将本地 Date 对象转换为 UTC ISO 8601 字符串
 * 后端存储与 API 交互强制使用 UTC 时间
 * @param date 本地时间 Date 对象
 * @returns UTC ISO 8601 格式字符串（如 "2025-01-15T08:00:00.000Z"）
 */
export function toUTCISOString(date: Date): string {
  return date.toISOString();
}

/**
 * 校验时间范围是否超过 90 天限制
 * 单次查询时间跨度不得超过 90 天，超出范围请求将被 API 拒绝
 * @param startTime 开始时间
 * @param endTime 结束时间
 * @returns 校验结果对象，valid 为 true 表示通过，否则包含错误信息
 */
export function validateTimeRange(
  startTime: Date,
  endTime: Date
): TimeRangeValidationResult {
  const diffMs = endTime.getTime() - startTime.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    return {
      valid: false,
      error: '开始时间不能晚于结束时间',
    };
  }

  if (diffDays > MAX_TIME_SPAN_DAYS) {
    return {
      valid: false,
      error: `查询时间跨度不得超过 ${MAX_TIME_SPAN_DAYS} 天，当前跨度为 ${Math.ceil(diffDays)} 天`,
    };
  }

  return { valid: true };
}

/**
 * 校验并规范化分页参数
 * 列表查询强制分页，单页上限 100 条（默认 50 条），
 * 深度分页限制偏移量不超过 10000
 * @param page 页码（从 1 开始），未提供时默认为 1
 * @param size 每页条数，未提供时默认为 50
 * @returns 规范化后的分页参数，或包含 error 字段的错误对象
 */
export function normalizePagination(
  page?: number,
  size?: number
): NormalizedPagination | { error: string } {
  const normalizedPage = Math.max(1, Math.floor(page ?? 1));
  const normalizedSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(size ?? DEFAULT_PAGE_SIZE))
  );
  const offset = (normalizedPage - 1) * normalizedSize;

  if (offset > MAX_OFFSET) {
    return {
      error: `分页偏移量不得超过 ${MAX_OFFSET}，请缩小查询范围或使用更精确的筛选条件`,
    };
  }

  return { page: normalizedPage, size: normalizedSize, offset };
}

/**
 * 根据查询时间范围自动推断趋势图表的时间粒度
 * 图表粒度约束：≤7天按小时，8-30天按天，>30天按周聚合
 * @param startTime 开始时间
 * @param endTime 结束时间
 * @returns 时间粒度标识：hour | day | week
 */
export function inferTrendGranularity(
  startTime: Date,
  endTime: Date
): 'hour' | 'day' | 'week' {
  const diffDays =
    (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays <= 7) {
    return 'hour';
  } else if (diffDays <= 30) {
    return 'day';
  } else {
    return 'week';
  }
}

// ---------------------------------------------------------------------------
// 查询参数构建
// ---------------------------------------------------------------------------

/**
 * 构建审计日志列表查询参数
 * 将本地时间转换为 UTC ISO 8601，并校验时间跨度与分页约束
 * @param params 筛选参数对象
 * @returns 规范化后的 URL 查询参数字典，或包含 error 字段的校验错误对象
 */
export function buildListQueryParams(
  params: AuditLogListParams
): Record<string, string> | { error: string } {
  // 校验时间范围
  const timeValidation = validateTimeRange(params.startTime, params.endTime);
  if (!timeValidation.valid) {
    return { error: timeValidation.error! };
  }

  // 校验分页
  const pagination = normalizePagination(params.page, params.size);
  if ('error' in pagination) {
    return { error: pagination.error };
  }

  const queryParams: Record<string, string> = {
    start_time: toUTCISOString(params.startTime),
    end_time: toUTCISOString(params.endTime),
    page: String(pagination.page),
    size: String(pagination.size),
  };

  // 可选筛选条件：仅在有值时附加
  if (params.operatorId) {
    queryParams.operator_id = params.operatorId;
  }

  if (params.actionType) {
    queryParams.action_type = params.actionType;
  }

  if (params.sortBy) {
    queryParams.sort_by = params.sortBy;
  }

  if (params.sortOrder) {
    queryParams.sort_order = params.sortOrder;
  }

  return queryParams;
}

/**
 * 构建审计日志趋势查询参数
 * 将本地时间转换为 UTC ISO 8601，并校验时间跨度约束
 * @param params 趋势查询参数对象
 * @returns 规范化后的 URL 查询参数字典，或包含 error 字段的校验错误对象
 */
export function buildTrendQueryParams(
  params: AuditTrendParams
): Record<string, string> | { error: string } {
  // 校验时间范围
  const timeValidation = validateTimeRange(params.startTime, params.endTime);
  if (!timeValidation.valid) {
    return { error: timeValidation.error! };
  }

  const queryParams: Record<string, string> = {
    start_time: toUTCISOString(params.startTime),
    end_time: toUTCISOString(params.endTime),
  };

  // 可选筛选条件
  if (params.actionType) {
    queryParams.action_type = params.actionType;
  }

  if (params.operatorId) {
    queryParams.operator_id = params.operatorId;
  }

  return queryParams;
}

// ---------------------------------------------------------------------------
// API 请求函数
// ---------------------------------------------------------------------------

/**
 * 获取审计日志元数据（操作类型枚举等）
 * 操作类型枚举由后端统一下发，前端禁止硬编码，需动态渲染筛选项
 * @returns Promise 包含操作类型枚举列表的元数据响应
 */
export async function fetchAuditMeta(): Promise<AuditMetaResponse> {
  const client = httpClient();
  const response = await client.get<AuditMetaResponse>(`${API_BASE}/meta`);
  return response.data;
}

/**
 * 查询审计日志列表
 * 支持多条件动态组合筛选（时间范围、操作类型、操作人）与分页
 * @param params 筛选参数（含时间范围、操作类型、操作人、分页等）
 * @returns Promise 包含分页审计日志列表的响应
 * @throws 当时间跨度超过 90 天或分页偏移越界时抛出 Error
 */
export async function fetchAuditLogList(
  params: AuditLogListParams
): Promise<AuditLogListResponse> {
  const queryParams = buildListQueryParams(params);

  if ('error' in queryParams) {
    throw new Error(queryParams.error);
  }

  const client = httpClient();
  const response = await client.get<AuditLogListResponse>(`${API_BASE}/list`, {
    params: queryParams,
  });
  return response.data;
}

/**
 * 查询审计日志趋势聚合数据
 * 支持按时间粒度统计操作频次，粒度根据查询范围自适应：
 * ≤7天按小时，8-30天按天，>30天按周聚合
 * @param params 趋势查询参数（含时间范围及可选筛选条件）
 * @returns Promise 包含趋势数据点数组及粒度标识的响应
 * @throws 当时间跨度超过 90 天时抛出 Error
 */
export async function fetchAuditTrend(
  params: AuditTrendParams
): Promise<AuditTrendResponse> {
  const queryParams = buildTrendQueryParams(params);

  if ('error' in queryParams) {
    throw new Error(queryParams.error);
  }

  const client = httpClient();
  const response = await client.get<AuditTrendResponse>(
    `${API_BASE}/trend`,
    { params: queryParams }
  );
  return response.data;
}