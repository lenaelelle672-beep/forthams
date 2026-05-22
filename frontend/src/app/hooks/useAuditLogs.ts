/**
 * useAuditLogs — 审计日志查询与可视化数据接入 Hook
 *
 * 封装审计日志列表分页查询、趋势聚合查询及元数据获取，
 * 处理本地时区 → UTC 时间格式化，管理筛选器状态，
 * 并强制执行 90 天时间跨度约束与分页边界限制。
 *
 * @module frontend/src/app/hooks/useAuditLogs
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { api } from '../utils/api';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 审计日志单条记录 */
export interface AuditLogItem {
  id: string;
  action_type: string;
  operator_id: string;
  operator_name: string;
  /** 资源类型（与后端 API 字段对齐） */
  resource_type: string;
  /** 资源 ID（与后端 API 字段对齐） */
  resource_id: string;
  detail: string;
  ip_address: string;
  created_at: string; // ISO 8601 UTC
}

/** 分页列表响应 */
export interface AuditLogListResponse {
  total: number;
  items: AuditLogItem[];
  page: number;
  size: number;
}

/** 趋势数据点 */
export interface TrendDataPoint {
  timestamp: string; // ISO 8601 UTC
  count: number;
}

/** 趋势聚合响应 */
export interface AuditLogTrendResponse {
  granularity: 'hour' | 'day' | 'week';
  data_points: TrendDataPoint[];
}

/** 操作类型元数据项 */
export interface ActionTypeOption {
  value: string;
  label: string;
}

/** 元数据响应 */
export interface AuditLogMetaResponse {
  action_types: ActionTypeOption[];
}

/** 筛选器参数 */
export interface AuditLogFilters {
  start_time: Date | null;
  end_time: Date | null;
  action_type: string;
  operator_id: string;
  module: string;
}

/** 分页参数 */
export interface PaginationParams {
  page: number;
  size: number;
}

/** Hook 返回值 */
export interface UseAuditLogsReturn {
  /** 筛选器状态 */
  filters: AuditLogFilters;
  /** 更新筛选器（部分合并） */
  updateFilters: (patch: Partial<AuditLogFilters>) => void;
  /** 重置筛选器为默认值 */
  resetFilters: () => void;
  /** 分页参数 */
  pagination: PaginationParams;
  /** 更新分页参数 */
  setPagination: (params: Partial<PaginationParams>) => void;
  /** 日志列表数据 */
  listData: AuditLogListResponse | null;
  /** 列表加载中 */
  listLoading: boolean;
  /** 列表请求错误 */
  listError: string | null;
  /** 趋势数据 */
  trendData: AuditLogTrendResponse | null;
  /** 趋势加载中 */
  trendLoading: boolean;
  /** 趋势请求错误 */
  trendError: string | null;
  /** 操作类型选项（动态获取，禁止硬编码） */
  actionTypeOptions: ActionTypeOption[];
  /** 元数据加载中 */
  metaLoading: boolean;
  /** 触发列表查询 */
  fetchList: () => Promise<void>;
  /** 触发趋势查询 */
  fetchTrend: () => Promise<void>;
  /** 同时触发列表 + 趋势查询 */
  fetchAll: () => Promise<void>;
  /** 当前趋势粒度（根据时间范围自适应） */
  computedGranularity: 'hour' | 'day' | 'week';
  /** 时间跨度是否超过 90 天 */
  isTimeRangeExceeded: boolean;
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 单次查询最大时间跨度（天） */
const MAX_TIME_SPAN_DAYS = 90;

/** 默认每页条数 */
const DEFAULT_PAGE_SIZE = 50;

/** 每页上限 */
const MAX_PAGE_SIZE = 100;

/** 最大偏移量（深度分页限制） */
const MAX_OFFSET = 10000;

/** API 基础路径 */
const AUDIT_API_BASE = '/audit-logs';

// ---------------------------------------------------------------------------
// 默认筛选器
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: AuditLogFilters = {
  start_time: null,
  end_time: null,
  action_type: '',
  operator_id: '',
  module: '',
};

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 将本地 Date 对象转换为 UTC ISO 8601 字符串
 *
 * @param date 本地时间 Date 对象
 * @returns UTC ISO 8601 格式字符串，输入为 null 时返回空字符串
 */
export function toUTCISOString(date: Date | null): string {
  if (!date) return '';
  return date.toISOString();
}

/**
 * 计算两个日期之间的天数差
 *
 * @param start 起始日期
 * @param end 结束日期
 * @returns 天数差（浮点数）
 */
export function diffInDays(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * 根据查询时间范围自适应计算趋势聚合粒度
 * - ≤7 天：按小时
 * - 8-30 天：按天
 * - >30 天：按周
 *
 * @param start 起始日期
 * @param end 结束日期
 * @returns 聚合粒度
 */
export function computeGranularity(
  start: Date | null,
  end: Date | null
): 'hour' | 'day' | 'week' {
  if (!start || !end) return 'day';
  const days = diffInDays(start, end);
  if (days <= 7) return 'hour';
  if (days <= 30) return 'day';
  return 'week';
}

/**
 * 校验时间跨度是否超过 90 天限制
 *
 * @param start 起始日期
 * @param end 结束日期
 * @returns 是否超过限制
 */
export function isTimeRangeExceeded(
  start: Date | null,
  end: Date | null
): boolean {
  if (!start || !end) return false;
  return diffInDays(start, end) > MAX_TIME_SPAN_DAYS;
}

/**
 * 校验分页偏移量是否超过深度分页限制
 *
 * @param page 当前页码（从 1 开始）
 * @param size 每页条数
 * @returns 是否超过限制
 */
export function isOffsetExceeded(page: number, size: number): boolean {
  return (page - 1) * size >= MAX_OFFSET;
}

/**
 * 将分页参数规范化到合法范围
 *
 * @param page 页码
 * @param size 每页条数
 * @returns 规范化后的分页参数
 */
export function normalizePagination(
  page: number,
  size: number
): { page: number; size: number } {
  const safeSize = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
  const safePage = Math.max(1, page);
  // 如果偏移量超限，回退到最大允许页码
  if (isOffsetExceeded(safePage, safeSize)) {
    const maxPage = Math.floor(MAX_OFFSET / safeSize);
    return { page: maxPage, size: safeSize };
  }
  return { page: safePage, size: safeSize };
}

// ---------------------------------------------------------------------------
// API 请求封装
// ---------------------------------------------------------------------------

/**
 * 通用 GET 请求封装
 *
 * @param url 请求 URL（含查询参数）
 * @param token 可选的认证 token
 * @returns 解析后的 JSON 响应
 * @throws 当响应非 2xx 时抛出包含状态码与消息的错误
 */
async function apiGet<T>(url: string): Promise<T> {
  return api.get<T>(url);
}

interface BackendPageResponse {
  records: Record<string, unknown>[];
  total: number;
  current: number;
  size: number;
}

function mapRecordToItem(r: Record<string, unknown>): AuditLogItem {
  return {
    id: String(r.id ?? ''),
    action_type: String(r.operationType ?? ''),
    operator_id: String(r.operatorId ?? ''),
    operator_name: String(r.operatorName ?? ''),
    resource_type: String(r.resourceType ?? ''),
    resource_id: String(r.resourceId ?? ''),
    detail: String(r.action ?? ''),
    ip_address: String(r.ipAddress ?? ''),
    created_at: r.timestamp ? new Date(r.timestamp as string).toISOString() : '',
  };
}

interface BackendTrendResponse {
  granularity: string;
  startDate: string;
  endDate: string;
  data: Array<{ date: string; count: number }>;
}

function buildListUrl(
  filters: AuditLogFilters,
  pagination: PaginationParams
): string {
  const params = new URLSearchParams();

  const normalized = normalizePagination(pagination.page, pagination.size);
  params.set('page', String(normalized.page - 1));
  params.set('size', String(normalized.size));
  if (filters.start_time) {
    params.set('start_time', toUTCISOString(filters.start_time));
  }
  if (filters.end_time) {
    params.set('end_time', toUTCISOString(filters.end_time));
  }
  if (filters.action_type) {
    params.set('operation_type', filters.action_type);
  }
  if (filters.operator_id) {
    params.set('operator_id', filters.operator_id);
  }
  if (filters.module) {
    params.set('module', filters.module);
  }

  return `${AUDIT_API_BASE}/list?${params.toString()}`;
}

function buildTrendUrl(filters: AuditLogFilters): string {
  const params = new URLSearchParams();

  if (filters.start_time) {
    params.set('startDate', toUTCISOString(filters.start_time).split('T')[0]);
    params.set('start_time', toUTCISOString(filters.start_time));
  }
  if (filters.end_time) {
    params.set('endDate', toUTCISOString(filters.end_time).split('T')[0]);
    params.set('end_time', toUTCISOString(filters.end_time));
  }
  const granularity = computeGranularity(filters.start_time, filters.end_time);
  params.set('granularity', granularity === 'hour' ? 'hourly' : granularity === 'week' ? 'weekly' : 'daily');

  if (filters.action_type) {
    params.set('operation_type', filters.action_type);
  }
  if (filters.operator_id) {
    params.set('operator_id', filters.operator_id);
  }
  if (filters.module) params.set('module', filters.module);

  return `${AUDIT_API_BASE}/trends?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// 主 Hook
// ---------------------------------------------------------------------------

/**
 * useAuditLogs — 审计日志查询与可视化数据接入 Hook
 *
 * 提供筛选器状态管理、分页控制、列表查询、趋势聚合查询、
 * 元数据（操作类型枚举）动态获取等能力。自动处理本地时区到
 * UTC 的时间转换，并强制执行 90 天时间跨度与深度分页约束。
 *
 * @param authToken 可选的认证 token，用于 API 鉴权
 * @returns 审计日志查询全量状态与操作方法
 *
 * @example
 * ```tsx
 * const {
 *   filters,
 *   updateFilters,
 *   listData,
 *   listLoading,
 *   fetchAll,
 *   actionTypeOptions,
 *   computedGranularity,
 *   isTimeRangeExceeded,
 * } = useAuditLogs(token);
 *
 * // 设置筛选器并查询
 * updateFilters({ action_type: 'DELETE' });
 * await fetchAll();
 * ```
 */
export function useAuditLogs(): UseAuditLogsReturn {
  // ---- 筛选器状态 ----
  const [filters, setFilters] = useState<AuditLogFilters>({
    ...DEFAULT_FILTERS,
  });

  /** 更新筛选器（部分合并） */
  const updateFilters = useCallback((patch: Partial<AuditLogFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  /** 重置筛选器为默认值 */
  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  // ---- 分页状态 ----
  const [pagination, setPaginationState] = useState<PaginationParams>({
    page: 1,
    size: DEFAULT_PAGE_SIZE,
  });

  /** 更新分页参数（部分合并） */
  const setPagination = useCallback((params: Partial<PaginationParams>) => {
    setPaginationState((prev) => {
      const next = { ...prev, ...params };
      return normalizePagination(next.page, next.size);
    });
  }, []);

  // ---- 列表数据状态 ----
  const [listData, setListData] = useState<AuditLogListResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // ---- 趋势数据状态 ----
  const [trendData, setTrendData] = useState<AuditLogTrendResponse | null>(
    null
  );
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);

  // ---- 元数据状态 ----
  const [actionTypeOptions, setActionTypeOptions] = useState<
    ActionTypeOption[]
  >([]);
  const [metaLoading, setMetaLoading] = useState(false);

  // ---- 派生状态 ----
  const computedGranularity = useMemo(
    () => computeGranularity(filters.start_time, filters.end_time),
    [filters.start_time, filters.end_time]
  );

  const isTimeRangeExceededValue = useMemo(
    () => isTimeRangeExceeded(filters.start_time, filters.end_time),
    [filters.start_time, filters.end_time]
  );

  // ---- 防止卸载后 setState 的标记 ----
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---- 获取操作类型元数据 ----
  useEffect(() => {
    let cancelled = false;

    /** 从后端动态获取操作类型枚举，前端禁止硬编码 */
    async function loadMeta() {
      setMetaLoading(true);
      try {
        const url = `${AUDIT_API_BASE}/meta`;
        const types = await apiGet<string[]>(url);
        if (!cancelled && mountedRef.current) {
          const options = (types ?? []).map((type) => ({ value: type, label: type }));
          setActionTypeOptions(options);
        }
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          setActionTypeOptions([]);
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setMetaLoading(false);
        }
      }
    }

    loadMeta();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- 列表查询 ----
  /** 触发审计日志列表分页查询 */
  const fetchList = useCallback(async () => {
    if (isTimeRangeExceeded(filters.start_time, filters.end_time)) {
      setListError(
        `查询时间跨度不得超过 ${MAX_TIME_SPAN_DAYS} 天，请缩小时间范围`
      );
      return;
    }

    if (isOffsetExceeded(pagination.page, pagination.size)) {
      setListError(
        `分页偏移量超过 ${MAX_OFFSET} 条限制，请使用更精确的筛选条件`
      );
      return;
    }

    setListLoading(true);
    setListError(null);

    try {
      const url = buildListUrl(filters, pagination);
      const backendPage = await apiGet<BackendPageResponse>(url);
      if (mountedRef.current) {
        const items = (backendPage.records ?? []).map((r: Record<string, unknown>) => mapRecordToItem(r));
        setListData({
          total: backendPage.total,
          items,
          page: backendPage.current,
          size: backendPage.size,
        });
      }
    } catch (err) {
      if (mountedRef.current) {
        setListData(null);
        setListError(
          err instanceof Error ? err.message : '审计日志查询失败'
        );
      }
    } finally {
      if (mountedRef.current) {
        setListLoading(false);
      }
    }
  }, [filters, pagination]);

  // ---- 趋势查询 ----
  /** 触发审计日志趋势聚合查询 */
  const fetchTrend = useCallback(async () => {
    if (isTimeRangeExceeded(filters.start_time, filters.end_time)) {
      setTrendError(
        `查询时间跨度不得超过 ${MAX_TIME_SPAN_DAYS} 天，请缩小时间范围`
      );
      return;
    }

    setTrendLoading(true);
    setTrendError(null);

    try {
      const url = buildTrendUrl(filters);
      const backendTrend = await apiGet<BackendTrendResponse>(url);
      if (mountedRef.current) {
        const computed = computeGranularity(filters.start_time, filters.end_time);
        setTrendData({
          granularity: computed,
          data_points: (backendTrend.data ?? []).map((p) => ({
            timestamp: p.date,
            count: p.count,
          })),
        });
      }
    } catch (err) {
      if (mountedRef.current) {
        setTrendData(null);
        setTrendError(
          err instanceof Error ? err.message : '趋势数据查询失败'
        );
      }
    } finally {
      if (mountedRef.current) {
        setTrendLoading(false);
      }
    }
  }, [filters]);

  // ---- 同时查询列表 + 趋势 ----
  /** 同时触发列表与趋势查询 */
  const fetchAll = useCallback(async () => {
    await Promise.allSettled([fetchList(), fetchTrend()]);
  }, [fetchList, fetchTrend]);

  return {
    filters,
    updateFilters,
    resetFilters,
    pagination,
    setPagination,
    listData,
    listLoading,
    listError,
    trendData,
    trendLoading,
    trendError,
    actionTypeOptions,
    metaLoading,
    fetchList,
    fetchTrend,
    fetchAll,
    computedGranularity,
    isTimeRangeExceeded: isTimeRangeExceededValue,
  };
}

export default useAuditLogs;
