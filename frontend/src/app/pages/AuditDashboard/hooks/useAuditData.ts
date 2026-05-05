/**
 * @module useAuditData
 * @description 审计日志仪表板核心数据 Hook，封装筛选器状态管理、API 请求调度、
 * 时间格式转换（Local ↔ UTC）及趋势粒度自适应逻辑。
 *
 * 职责边界：
 * 1. 管理筛选器状态（时间范围、操作类型、操作人、分页）
 * 2. 封装审计日志列表查询、趋势聚合、元数据枚举三类 API 调用
 * 3. 前端侧 90 天时间跨度校验，超限直接拦截并返回友好错误
 * 4. 自动根据查询时间范围计算趋势粒度（≤7天=小时，8-30天=天，>30天=周）
 * 5. 所有时间参数在发往 API 前统一转为 UTC ISO 8601，展示时转回本地时区
 */

import { ref, reactive, computed, onMounted, watch, type Ref } from 'vue';

// ─── 类型引用 ────────────────────────────────────────────────────────────────
import type {
  AuditLogItem,
  AuditLogListResponse,
  AuditTrendDataPoint,
  AuditTrendResponse,
  AuditMetaResponse,
  AuditListParams,
  AuditTrendParams,
  TrendGranularity,
} from '../types/audit.types';

// ─── API 服务引用 ────────────────────────────────────────────────────────────
import {
  fetchAuditLogList,
  fetchAuditLogTrend,
  fetchAuditLogMeta,
} from '../services/auditApi';

// ─── 常量 ────────────────────────────────────────────────────────────────────

/** 单次查询最大时间跨度（天） */
const MAX_TIME_SPAN_DAYS = 90;

/** 默认分页大小 */
const DEFAULT_PAGE_SIZE = 50;

/** 分页大小上限 */
const MAX_PAGE_SIZE = 100;

/** 粒度阈值（天） */
const GRANULARITY_THRESHOLD_HOURLY = 7;
const GRANULARITY_THRESHOLD_DAILY = 30;

// ─── 工具函数 ────────────────────────────────────────────────────────────────

/**
 * 将本地 Date 对象转换为 UTC ISO 8601 字符串
 * @param date 本地时间 Date 对象
 * @returns UTC ISO 8601 格式字符串（如 "2025-01-15T08:00:00.000Z"），输入为 null 时返回 null
 */
export function toUTCISO(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString();
}

/**
 * 将 UTC ISO 8601 字符串转换为本地时区 Date 对象
 * @param isoString UTC ISO 8601 格式字符串
 * @returns 本地时区 Date 对象，输入为 null/空时返回 null
 */
export function fromUTCISO(isoString: string | null | undefined): Date | null {
  if (!isoString) return null;
  return new Date(isoString);
}

/**
 * 计算两个日期之间的天数差
 * @param start 开始日期
 * @param end 结束日期
 * @returns 天数差（浮点数）
 */
export function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return (end.getTime() - start.getTime()) / msPerDay;
}

/**
 * 根据查询时间范围自动计算趋势聚合粒度
 * 规则：≤7天按小时，8-30天按天，>30天按周
 * @param start 开始时间
 * @param end 结束时间
 * @returns 趋势粒度枚举值
 */
export function computeGranularity(start: Date, end: Date): TrendGranularity {
  const days = daysBetween(start, end);
  if (days <= GRANULARITY_THRESHOLD_HOURLY) {
    return 'hour';
  }
  if (days <= GRANULARITY_THRESHOLD_DAILY) {
    return 'day';
  }
  return 'week';
}

/**
 * 校验时间范围是否超过 90 天限制
 * @param start 开始时间
 * @param end 结束时间
 * @returns 校验结果：valid 为 true 表示通过，否则 message 包含错误描述
 */
export function validateTimeSpan(
  start: Date | null,
  end: Date | null
): { valid: boolean; message?: string } {
  if (!start || !end) {
    return { valid: true };
  }
  const days = daysBetween(start, end);
  if (days > MAX_TIME_SPAN_DAYS) {
    return {
      valid: false,
      message: `查询时间跨度不得超过 ${MAX_TIME_SPAN_DAYS} 天，当前跨度为 ${Math.ceil(days)} 天`,
    };
  }
  return { valid: true };
}

// ─── 筛选器状态接口 ──────────────────────────────────────────────────────────

/** 筛选器状态 */
export interface AuditFilterState {
  /** 时间范围 - 开始时间（本地时区） */
  startTime: Date | null;
  /** 时间范围 - 结束时间（本地时区） */
  endTime: Date | null;
  /** 操作类型（由 /api/v1/audit-log/meta 动态下发） */
  actionType: string | null;
  /** 操作人 ID */
  operatorId: string | null;
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条数 */
  size: number;
}

// ─── Hook 返回值接口 ─────────────────────────────────────────────────────────

/** useAuditData Hook 返回值 */
export interface UseAuditDataReturn {
  /** 筛选器状态（响应式） */
  filters: AuditFilterState;

  /** 审计日志列表数据 */
  auditLogs: Ref<AuditLogItem[]>;

  /** 列表总记录数 */
  total: Ref<number>;

  /** 趋势数据点 */
  trendData: Ref<AuditTrendDataPoint[]>;

  /** 趋势当前粒度 */
  trendGranularity: Ref<TrendGranularity>;

  /** 操作类型枚举选项（动态从 meta 接口获取） */
  actionTypeOptions: Ref<string[]>;

  /** 列表加载态 */
  listLoading: Ref<boolean>;

  /** 趋势加载态 */
  trendLoading: Ref<boolean>;

  /** 元数据加载态 */
  metaLoading: Ref<boolean>;

  /** 错误信息 */
  error: Ref<string | null>;

  /** 触发列表查询（先校验时间跨度） */
  fetchList: () => Promise<void>;

  /** 触发趋势查询（先校验时间跨度） */
  fetchTrend: () => Promise<void>;

  /** 同时刷新列表与趋势 */
  refreshAll: () => Promise<void>;

  /** 更新筛选器字段 */
  updateFilter: <K extends keyof AuditFilterState>(
    key: K,
    value: AuditFilterState[K]
  ) => void;

  /** 批量更新筛选器 */
  updateFilters: (partial: Partial<AuditFilterState>) => void;

  /** 重置筛选器为默认值 */
  resetFilters: () => void;

  /** 翻页 */
  goToPage: (page: number) => void;

  /** 修改每页条数 */
  changePageSize: (size: number) => void;
}

// ─── 默认筛选器 ──────────────────────────────────────────────────────────────

/**
 * 创建默认筛选器状态
 * @returns 默认筛选器：最近 7 天、无操作类型/操作人筛选、第 1 页、每页 50 条
 */
export function createDefaultFilters(): AuditFilterState {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    startTime: sevenDaysAgo,
    endTime: now,
    actionType: null,
    operatorId: null,
    page: 1,
    size: DEFAULT_PAGE_SIZE,
  };
}

// ─── 主 Hook ─────────────────────────────────────────────────────────────────

/**
 * useAuditData - 审计日志仪表板核心数据 Hook
 *
 * 封装筛选器状态、API 请求调度、时间转换与粒度自适应逻辑。
 * 组件挂载时自动拉取元数据（操作类型枚举），不自动拉取列表/趋势，
 * 由用户点击"查询"按钮或组件显式调用 fetchList/fetchTrend 触发。
 *
 * @returns UseAuditDataReturn 完整的响应式状态与操作方法
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const {
 *   filters, auditLogs, trendData, trendGranularity,
 *   actionTypeOptions, listLoading, trendLoading, error,
 *   fetchList, fetchTrend, refreshAll,
 *   updateFilter, resetFilters, goToPage, changePageSize,
 * } = useAuditData();
 *
 * onMounted(() => refreshAll());
 * </script>
 * ```
 */
export function useAuditData(): UseAuditDataReturn {
  // ── 响应式状态 ──────────────────────────────────────────────────────────

  /** 筛选器状态 */
  const filters = reactive<AuditFilterState>(createDefaultFilters());

  /** 审计日志列表 */
  const auditLogs = ref<AuditLogItem[]>([]) as Ref<AuditLogItem[]>;

  /** 列表总记录数 */
  const total = ref<number>(0);

  /** 趋势数据点 */
  const trendData = ref<AuditTrendDataPoint[]>([]) as Ref<AuditTrendDataPoint[]>;

  /** 趋势当前粒度 */
  const trendGranularity = ref<TrendGranularity>('day') as Ref<TrendGranularity>;

  /** 操作类型枚举选项 */
  const actionTypeOptions = ref<string[]>([]) as Ref<string[]>;

  /** 加载态 */
  const listLoading = ref<boolean>(false);
  const trendLoading = ref<boolean>(false);
  const metaLoading = ref<boolean>(false);

  /** 错误信息 */
  const error = ref<string | null>(null);

  // ── 内部辅助 ────────────────────────────────────────────────────────────

  /**
   * 设置错误信息并清除对应数据
   * @param msg 错误描述
   */
  function setError(msg: string): void {
    error.value = msg;
  }

  /**
   * 清除错误信息
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * 校验当前筛选器时间范围是否合法
   * @returns 校验通过返回 true，否则设置错误信息并返回 false
   */
  function validateCurrentTimeSpan(): boolean {
    const result = validateTimeSpan(filters.startTime, filters.endTime);
    if (!result.valid) {
      setError(result.message ?? '时间范围校验失败');
      return false;
    }
    return true;
  }

  /**
   * 构建列表查询参数（将本地时间转为 UTC）
   * @returns 符合 API 契约的查询参数
   */
  function buildListParams(): AuditListParams {
    return {
      start_time: toUTCISO(filters.startTime),
      end_time: toUTCISO(filters.endTime),
      action_type: filters.actionType ?? undefined,
      operator_id: filters.operatorId ?? undefined,
      page: filters.page,
      size: Math.min(filters.size, MAX_PAGE_SIZE),
    };
  }

  /**
   * 构建趋势查询参数（将本地时间转为 UTC，自动计算粒度）
   * @returns 符合 API 契约的趋势查询参数
   */
  function buildTrendParams(): AuditTrendParams {
    const granularity = filters.startTime && filters.endTime
      ? computeGranularity(filters.startTime, filters.endTime)
      : 'day';

    return {
      start_time: toUTCISO(filters.startTime),
      end_time: toUTCISO(filters.endTime),
      action_type: filters.actionType ?? undefined,
      operator_id: filters.operatorId ?? undefined,
      granularity,
    };
  }

  // ── 数据获取 ────────────────────────────────────────────────────────────

  /**
   * 拉取操作类型元数据枚举
   * 从 /api/v1/audit-log/meta 动态获取，禁止前端硬编码操作类型
   */
  async function fetchMeta(): Promise<void> {
    metaLoading.value = true;
    clearError();
    try {
      const response: AuditMetaResponse = await fetchAuditLogMeta();
      actionTypeOptions.value = response.action_types ?? [];
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '获取操作类型元数据失败';
      setError(message);
      actionTypeOptions.value = [];
    } finally {
      metaLoading.value = false;
    }
  }

  /**
   * 拉取审计日志列表
   * 前端侧先校验 90 天跨度限制，通过后发起 API 请求
   */
  async function fetchList(): Promise<void> {
    if (!validateCurrentTimeSpan()) {
      return;
    }

    listLoading.value = true;
    clearError();
    try {
      const params = buildListParams();
      const response: AuditLogListResponse = await fetchAuditLogList(params);
      auditLogs.value = response.items ?? [];
      total.value = response.total ?? 0;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '获取审计日志列表失败';
      setError(message);
      auditLogs.value = [];
      total.value = 0;
    } finally {
      listLoading.value = false;
    }
  }

  /**
   * 拉取审计日志趋势数据
   * 前端侧先校验 90 天跨度限制，通过后发起 API 请求
   * 自动根据时间范围计算粒度
   */
  async function fetchTrend(): Promise<void> {
    if (!validateCurrentTimeSpan()) {
      return;
    }

    trendLoading.value = true;
    clearError();
    try {
      const params = buildTrendParams();
      trendGranularity.value = params.granularity ?? 'day';
      const response: AuditTrendResponse = await fetchAuditLogTrend(params);
      trendData.value = response.data_points ?? [];
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '获取审计日志趋势数据失败';
      setError(message);
      trendData.value = [];
    } finally {
      trendLoading.value = false;
    }
  }

  /**
   * 同时刷新列表与趋势数据
   * 用于用户点击"查询"按钮时一次性刷新所有数据
   */
  async function refreshAll(): Promise<void> {
    await Promise.allSettled([fetchList(), fetchTrend()]);
  }

  // ── 筛选器操作 ──────────────────────────────────────────────────────────

  /**
   * 更新筛选器单个字段
   * @param key 字段名
   * @param value 字段值
   */
  function updateFilter<K extends keyof AuditFilterState>(
    key: K,
    value: AuditFilterState[K]
  ): void {
    filters[key] = value;
  }

  /**
   * 批量更新筛选器字段
   * @param partial 需要更新的字段及值
   */
  function updateFilters(partial: Partial<AuditFilterState>): void {
    Object.entries(partial).forEach(([key, value]) => {
      (filters as Record<string, unknown>)[key] = value;
    });
  }

  /**
   * 重置筛选器为默认值
   * 同时清空已加载的列表与趋势数据
   */
  function resetFilters(): void {
    const defaults = createDefaultFilters();
    Object.assign(filters, defaults);
    auditLogs.value = [];
    total.value = 0;
    trendData.value = [];
    clearError();
  }

  /**
   * 翻页操作
   * 翻页后自动重新拉取列表数据
   * @param page 目标页码（从 1 开始）
   */
  function goToPage(page: number): void {
    if (page < 1) return;
    filters.page = page;
    fetchList();
  }

  /**
   * 修改每页条数
   * 修改后重置到第 1 页并重新拉取列表数据
   * @param size 新的每页条数（上限 100）
   */
  function changePageSize(size: number): void {
    filters.size = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
    filters.page = 1;
    fetchList();
  }

  // ── 生命周期 ────────────────────────────────────────────────────────────

  /**
   * 组件挂载时自动拉取元数据（操作类型枚举）
   * 列表与趋势数据需用户主动触发查询
   */
  onMounted(() => {
    fetchMeta();
  });

  // ── 返回 ────────────────────────────────────────────────────────────────

  return {
    filters,
    auditLogs,
    total,
    trendData,
    trendGranularity,
    actionTypeOptions,
    listLoading,
    trendLoading,
    metaLoading,
    error,
    fetchList,
    fetchTrend,
    refreshAll,
    updateFilter,
    updateFilters,
    resetFilters,
    goToPage,
    changePageSize,
  };
}

export default useAuditData;