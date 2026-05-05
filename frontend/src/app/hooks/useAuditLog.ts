/**
 * useAuditLog — 审计日志仪表板前端数据接入层 Hook
 *
 * 封装审计日志查询 API 请求，处理时间格式化（Local → UTC 转换），
 * 管理筛选器状态（时间范围、操作类型、操作人）、分页状态及趋势数据。
 *
 * 边界约束：
 * - 单次查询时间跨度不得超过 90 天
 * - 分页默认 50 条，单页上限 100 条
 * - 操作类型枚举由后端 `/api/v1/audit-log/meta` 动态下发，前端禁止硬编码
 * - 前端统一转换为用户本地时区展示，API 交互强制使用 UTC（ISO 8601）
 * - 趋势图表粒度根据查询范围自适应：≤7天按小时，8-30天按天，>30天按周
 *
 * @module useAuditLog
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 审计日志单条记录 */
export interface AuditLogItem {
  /** 记录唯一标识 */
  id: string;
  /** 操作类型枚举值（如 LOGIN、DELETE 等） */
  action_type: string;
  /** 操作人 ID */
  operator_id: string;
  /** 操作人姓名 */
  operator_name: string;
  /** 操作目标类型 */
  target_type: string;
  /** 操作目标 ID */
  target_id: string;
  /** 操作详情描述 */
  detail: string;
  /** 操作来源 IP */
  ip_address: string;
  /** 操作时间（ISO 8601 UTC） */
  created_at: string;
}

/** 审计日志列表查询响应 */
export interface AuditLogListResponse {
  /** 符合条件的总记录数 */
  total: number;
  /** 当前页记录列表 */
  items: AuditLogItem[];
}

/** 趋势数据单点 */
export interface TrendDataPoint {
  /** 时间戳（ISO 8601 UTC） */
  timestamp: string;
  /** 该时间段内的操作计数 */
  count: number;
}

/** 趋势查询响应 */
export interface AuditLogTrendResponse {
  /** 趋势数据点列表 */
  data: TrendDataPoint[];
  /** 当前查询使用的聚合粒度 */
  granularity: 'hour' | 'day' | 'week';
}

/** 审计日志元数据响应（操作类型枚举等） */
export interface AuditLogMetaResponse {
  /** 后端统一下发的操作类型枚举列表 */
  action_types: string[];
}

/** 筛选器状态 */
export interface AuditLogFilter {
  /** 查询起始时间（本地时区 Date 对象） */
  startTime: Date | null;
  /** 查询结束时间（本地时区 Date 对象） */
  endTime: Date | null;
  /** 操作类型筛选（对应后端枚举值） */
  actionType: string | null;
  /** 操作人 ID 筛选 */
  operatorId: string | null;
}

/** 分页状态 */
export interface AuditLogPagination {
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条数 */
  size: number;
}

/** Hook 错误类型 */
export interface AuditLogError {
  /** 错误类型标识 */
  code: 'TIME_RANGE_EXCEEDED' | 'PAGE_SIZE_EXCEEDED' | 'PERMISSION_DENIED' | 'NETWORK_ERROR' | 'SERVER_ERROR' | 'UNKNOWN';
  /** 人类可读的错误消息 */
  message: string;
}

/** Hook 完整返回值 */
export interface UseAuditLogReturn {
  // ---- 数据 ----
  /** 审计日志列表数据 */
  listData: AuditLogListResponse | null;
  /** 趋势数据 */
  trendData: AuditLogTrendResponse | null;
  /** 元数据（操作类型枚举） */
  meta: AuditLogMetaResponse | null;

  // ---- 状态 ----
  /** 当前筛选器 */
  filter: AuditLogFilter;
  /** 当前分页 */
  pagination: AuditLogPagination;
  /** 列表加载中 */
  listLoading: boolean;
  /** 趋势加载中 */
  trendLoading: boolean;
  /** 元数据加载中 */
  metaLoading: boolean;
  /** 错误信息 */
  error: AuditLogError | null;

  // ---- 操作 ----
  /** 更新筛选器（部分更新） */
  updateFilter: (partial: Partial<AuditLogFilter>) => void;
  /** 重置筛选器为默认值 */
  resetFilter: () => void;
  /** 设置分页 */
  setPagination: (pagination: Partial<AuditLogPagination>) => void;
  /** 执行列表查询 */
  fetchList: () => Promise<void>;
  /** 执行趋势查询 */
  fetchTrend: () => Promise<void>;
  /** 获取元数据（操作类型枚举） */
  fetchMeta: () => Promise<void>;
  /** 一键查询（同时刷新列表与趋势） */
  fetchAll: () => Promise<void>;
  /** 清除错误 */
  clearError: () => void;

  // ---- 工具 ----
  /** 根据查询时间范围计算趋势聚合粒度 */
  computeGranularity: (start: Date, end: Date) => 'hour' | 'day' | 'week';
  /** 将本地 Date 转为 UTC ISO 8601 字符串 */
  toUTCString: (date: Date) => string;
  /** 将 UTC ISO 8601 字符串转为本地 Date */
  fromUTCString: (iso: string) => Date;
  /** 校验时间范围是否超过 90 天 */
  validateTimeRange: (start: Date, end: Date) => boolean;
}

// ---------------------------------------------------------------------------
// 常量
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
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 将本地 Date 对象转换为 UTC ISO 8601 字符串
 *
 * 遵循时区约束：前端统一转换为用户本地时区展示，
 * 后端存储与 API 交互强制使用 UTC 时间（ISO 8601 格式）。
 *
 * @param date - 本地时区的 Date 对象
 * @returns UTC ISO 8601 格式字符串（如 "2025-01-15T08:00:00.000Z"）
 */
export function toUTCString(date: Date): string {
  return date.toISOString();
}

/**
 * 将 UTC ISO 8601 字符串转换为本地时区 Date 对象
 *
 * 用于将后端返回的 UTC 时间转为前端本地展示。
 *
 * @param iso - UTC ISO 8601 格式字符串
 * @returns 本地时区的 Date 对象
 */
export function fromUTCString(iso: string): Date {
  return new Date(iso);
}

/**
 * 校验时间范围是否在允许的 90 天跨度内
 *
 * 遵循边界约束：单次查询时间跨度不得超过 90 天，
 * 超出范围请求将被 API 拒绝并返回 400 Bad Request。
 *
 * @param start - 起始时间
 * @param end - 结束时间
 * @returns true 表示范围合法，false 表示超过 90 天
 */
export function validateTimeRange(start: Date, end: Date): boolean {
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= MAX_TIME_RANGE_DAYS;
}

/**
 * 根据查询时间范围自适应计算趋势聚合粒度
 *
 * 遵循图表粒度约束：
 * - ≤7天按小时聚合
 * - 8-30天按天聚合
 * - >30天按周聚合
 *
 * @param start - 起始时间
 * @param end - 结束时间
 * @returns 聚合粒度枚举值
 */
export function computeGranularity(start: Date, end: Date): 'hour' | 'day' | 'week' {
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 7) {
    return 'hour';
  } else if (diffDays <= 30) {
    return 'day';
  } else {
    return 'week';
  }
}

/**
 * 构建带查询参数的 URL
 *
 * @param basePath - API 基础路径
 * @param params - 查询参数键值对（值为 null/undefined 的参数将被忽略）
 * @returns 完整 URL 字符串
 */
function buildUrl(basePath: string, params: Record<string, string | number | null | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

// ---------------------------------------------------------------------------
// 默认值
// ---------------------------------------------------------------------------

/** 筛选器默认值 */
const DEFAULT_FILTER: AuditLogFilter = {
  startTime: null,
  endTime: null,
  actionType: null,
  operatorId: null,
};

/** 分页默认值 */
const DEFAULT_PAGINATION: AuditLogPagination = {
  page: 1,
  size: DEFAULT_PAGE_SIZE,
};

// ---------------------------------------------------------------------------
// HTTP 请求辅助
// ---------------------------------------------------------------------------

/**
 * 发起 GET 请求并解析 JSON 响应
 *
 * 封装通用错误处理逻辑，包括权限拦截（403）、
 * 参数越界（400）及网络异常等场景。
 *
 * @param url - 请求 URL
 * @returns 解析后的 JSON 响应体
 * @throws AuditLogError 当请求失败时抛出结构化错误
 */
async function requestGet<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (response.ok) {
      return await response.json() as T;
    }

    if (response.status === 400) {
      const body = await response.json().catch(() => ({}));
      throw {
        code: 'TIME_RANGE_EXCEEDED' as const,
        message: body?.detail || body?.message || '请求参数错误，可能时间跨度超过90天限制',
      } satisfies AuditLogError;
    }

    if (response.status === 403) {
      throw {
        code: 'PERMISSION_DENIED' as const,
        message: '无权限访问审计日志，仅 admin 或 auditor 角色可访问',
      } satisfies AuditLogError;
    }

    if (response.status >= 500) {
      throw {
        code: 'SERVER_ERROR' as const,
        message: `服务器错误 (${response.status})`,
      } satisfies AuditLogError;
    }

    throw {
      code: 'UNKNOWN' as const,
      message: `请求失败 (${response.status})`,
    } satisfies AuditLogError;
  } catch (err) {
    // 如果已经是 AuditLogError 则直接抛出
    if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
      throw err;
    }
    // 网络异常
    throw {
      code: 'NETWORK_ERROR' as const,
      message: err instanceof Error ? err.message : '网络请求失败',
    } satisfies AuditLogError;
  }
}

// ---------------------------------------------------------------------------
// 主 Hook
// ---------------------------------------------------------------------------

/**
 * useAuditLog — 审计日志仪表板核心数据 Hook
 *
 * 提供审计日志列表查询、趋势聚合查询、元数据获取等能力，
 * 内置筛选器状态管理、分页控制、时间格式转换及边界校验。
 *
 * 使用示例：
 * ```tsx
 * const {
 *   listData, trendData, meta,
 *   filter, pagination,
 *   listLoading, trendLoading,
 *   updateFilter, setPagination,
 *   fetchAll, fetchList, fetchTrend, fetchMeta,
 *   error, clearError,
 * } = useAuditLog();
 * ```
 *
 * @returns 审计日志数据接入层完整接口
 */
export function useAuditLog(): UseAuditLogReturn {
  // ---- 状态 ----
  const [filter, setFilter] = useState<AuditLogFilter>({ ...DEFAULT_FILTER });
  const [pagination, setPaginationState] = useState<AuditLogPagination>({ ...DEFAULT_PAGINATION });
  const [listData, setListData] = useState<AuditLogListResponse | null>(null);
  const [trendData, setTrendData] = useState<AuditLogTrendResponse | null>(null);
  const [meta, setMeta] = useState<AuditLogMetaResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [error, setError] = useState<AuditLogError | null>(null);

  // 用于取消过时请求的引用
  const fetchListAbortRef = useRef<AbortController | null>(null);
  const fetchTrendAbortRef = useRef<AbortController | null>(null);

  // ---- 筛选器操作 ----

  /**
   * 更新筛选器（部分更新，合并到当前状态）
   *
   * 当筛选器变更时，自动将分页重置为第一页，
   * 避免筛选后仍停留在已不存在的深页码。
   *
   * @param partial - 需要更新的筛选器字段
   */
  const updateFilter = useCallback((partial: Partial<AuditLogFilter>) => {
    setFilter((prev) => ({ ...prev, ...partial }));
    // 筛选器变更时重置分页到第一页
    setPaginationState((prev) => ({ ...prev, page: 1 }));
  }, []);

  /**
   * 重置筛选器为默认值
   *
   * 同时将分页重置为第一页。
   */
  const resetFilter = useCallback(() => {
    setFilter({ ...DEFAULT_FILTER });
    setPaginationState({ ...DEFAULT_PAGINATION });
  }, []);

  // ---- 分页操作 ----

  /**
   * 设置分页参数（部分更新）
   *
   * 强制约束每页条数不超过 MAX_PAGE_SIZE (100)，
   * 并校验偏移量不超过 MAX_OFFSET (10000)。
   *
   * @param partial - 需要更新的分页字段
   */
  const setPagination = useCallback((partial: Partial<AuditLogPagination>) => {
    setPaginationState((prev) => {
      const next = { ...prev, ...partial };
      // 强制约束每页条数上限
      if (next.size > MAX_PAGE_SIZE) {
        next.size = MAX_PAGE_SIZE;
      }
      // 强制约束偏移量不超过 MAX_OFFSET
      const offset = (next.page - 1) * next.size;
      if (offset > MAX_OFFSET) {
        // 回退到最大允许页码
        next.page = Math.floor(MAX_OFFSET / next.size) + 1;
      }
      return next;
    });
  }, []);

  // ---- 清除错误 ----

  /**
   * 清除当前错误状态
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ---- 数据获取 ----

  /**
   * 获取审计日志元数据（操作类型枚举）
   *
   * 遵循操作类型约束：操作类型枚举由后端统一下发
   * （`/api/v1/audit-log/meta`），前端禁止硬编码，需动态渲染筛选项。
   */
  const fetchMeta = useCallback(async () => {
    setMetaLoading(true);
    setError(null);
    try {
      const url = `${API_BASE}/meta`;
      const data = await requestGet<AuditLogMetaResponse>(url);
      setMeta(data);
    } catch (err) {
      const auditError = err as AuditLogError;
      setError(auditError);
    } finally {
      setMetaLoading(false);
    }
  }, []);

  /**
   * 执行审计日志列表查询
   *
   * 将本地时区的筛选时间转换为 UTC ISO 8601 格式后发起请求，
   * 支持多维筛选（时间范围、操作类型、操作人）与分页。
   *
   * 遵循边界约束：
   * - 时间跨度超过 90 天时在前端拦截并设置错误
   * - 分页参数强制约束（size ≤ 100, offset ≤ 10000）
   *
   * 触发 ATB-01 / ATB-02 对应的前端请求逻辑。
   */
  const fetchList = useCallback(async () => {
    // 前端时间范围校验
    if (filter.startTime && filter.endTime) {
      if (!validateTimeRange(filter.startTime, filter.endTime)) {
        setError({
          code: 'TIME_RANGE_EXCEEDED',
          message: `查询时间跨度不能超过 ${MAX_TIME_RANGE_DAYS} 天`,
        });
        return;
      }
    }

    // 分页参数校验
    if (pagination.size > MAX_PAGE_SIZE) {
      setError({
        code: 'PAGE_SIZE_EXCEEDED',
        message: `每页条数不能超过 ${MAX_PAGE_SIZE}`,
      });
      return;
    }

    // 取消前一次未完成的请求
    if (fetchListAbortRef.current) {
      fetchListAbortRef.current.abort();
    }

    setListLoading(true);
    setError(null);

    try {
      const params: Record<string, string | number | null> = {
        page: pagination.page,
        size: pagination.size,
      };

      // 时间参数：本地 → UTC ISO 8601
      if (filter.startTime) {
        params.start_time = toUTCString(filter.startTime);
      }
      if (filter.endTime) {
        params.end_time = toUTCString(filter.endTime);
      }

      // 操作类型与操作人筛选
      if (filter.actionType) {
        params.action_type = filter.actionType;
      }
      if (filter.operatorId) {
        params.operator_id = filter.operatorId;
      }

      const url = buildUrl(`${API_BASE}/list`, params);
      const data = await requestGet<AuditLogListResponse>(url);
      setListData(data);
    } catch (err) {
      const auditError = err as AuditLogError;
      setError(auditError);
    } finally {
      setListLoading(false);
    }
  }, [filter, pagination]);

  /**
   * 执行审计日志趋势聚合查询
   *
   * 根据筛选器的时间范围自适应计算聚合粒度：
   * - ≤7天按小时聚合
   * - 8-30天按天聚合
   * - >30天按周聚合
   *
   * 遵循时区约束：时间参数以 UTC ISO 8601 格式传递给后端。
   *
   * 触发 ATB-03 / ATB-06 对应的前端请求逻辑。
   */
  const fetchTrend = useCallback(async () => {
    // 趋势查询需要时间范围
    if (!filter.startTime || !filter.endTime) {
      return;
    }

    // 前端时间范围校验
    if (!validateTimeRange(filter.startTime, filter.endTime)) {
      setError({
        code: 'TIME_RANGE_EXCEEDED',
        message: `查询时间跨度不能超过 ${MAX_TIME_RANGE_DAYS} 天`,
      });
      return;
    }

    // 取消前一次未完成的请求
    if (fetchTrendAbortRef.current) {
      fetchTrendAbortRef.current.abort();
    }

    setTrendLoading(true);
    setError(null);

    try {
      const granularity = computeGranularity(filter.startTime, filter.endTime);

      const params: Record<string, string | number | null> = {
        start_time: toUTCString(filter.startTime),
        end_time: toUTCString(filter.endTime),
        granularity,
      };

      if (filter.actionType) {
        params.action_type = filter.actionType;
      }
      if (filter.operatorId) {
        params.operator_id = filter.operatorId;
      }

      const url = buildUrl(`${API_BASE}/trend`, params);
      const data = await requestGet<AuditLogTrendResponse>(url);
      setTrendData(data);
    } catch (err) {
      const auditError = err as AuditLogError;
      setError(auditError);
    } finally {
      setTrendLoading(false);
    }
  }, [filter]);

  /**
   * 一键查询：同时刷新列表与趋势数据
   *
   * 触发 ATB-05 对应的筛选器联动与数据刷新逻辑。
   */
  const fetchAll = useCallback(async () => {
    await Promise.allSettled([fetchList(), fetchTrend()]);
  }, [fetchList, fetchTrend]);

  // ---- 初始化：加载元数据 ----

  /**
   * 组件挂载时自动获取元数据（操作类型枚举），
   * 以便筛选器下拉框动态渲染。
   */
  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  // ---- 清理副作用 ----

  /**
   * 组件卸载时取消未完成的请求
   */
  useEffect(() => {
    return () => {
      if (fetchListAbortRef.current) {
        fetchListAbortRef.current.abort();
      }
      if (fetchTrendAbortRef.current) {
        fetchTrendAbortRef.current.abort();
      }
    };
  }, []);

  // ---- 计算属性 ----

  /**
   * 当前筛选器对应的趋势聚合粒度（仅当时间范围有效时计算）
   */
  const currentGranularity = useMemo(() => {
    if (filter.startTime && filter.endTime) {
      return computeGranularity(filter.startTime, filter.endTime);
    }
    return null;
  }, [filter.startTime, filter.endTime]);

  // 避免未使用变量的 lint 警告，同时保留供外部使用
  void currentGranularity;

  // ---- 返回值 ----

  return {
    // 数据
    listData,
    trendData,
    meta,

    // 状态
    filter,
    pagination,
    listLoading,
    trendLoading,
    metaLoading,
    error,

    // 操作
    updateFilter,
    resetFilter,
    setPagination,
    fetchList,
    fetchTrend,
    fetchMeta,
    fetchAll,
    clearError,

    // 工具
    computeGranularity,
    toUTCString,
    fromUTCString,
    validateTimeRange,
  };
}

export default useAuditLog;