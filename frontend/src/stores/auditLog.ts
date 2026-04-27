/**
 * @module stores/auditLog
 * @description Pinia store for the Audit Log Dashboard.
 * Manages filter state, pagination, audit log list data, trend data,
 * and action type metadata. Enforces business constraints including
 * the 90-day time range limit and pagination boundaries.
 *
 * Key responsibilities:
 * - Multi-condition dynamic filtering (time range, action type, operator)
 * - Paginated list queries with offset/size controls
 * - Trend aggregation with auto-adaptive time granularity
 * - Local → UTC time conversion for API interaction
 * - Dynamic action type enum fetched from backend meta endpoint
 */

import { defineStore } from 'pinia';
import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { http } from '@/utils/http';

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/** Granularity for trend aggregation, determined by query time range */
export type TrendGranularity = 'hour' | 'day' | 'week';

/** A single audit log record returned from the API */
export interface AuditLogItem {
  id: string;
  operator_id: string;
  operator_name: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  detail: string;
  ip_address: string;
  created_at: string; // ISO 8601 UTC
}

/** Paginated list response from `/api/v1/audit-log/list` */
export interface AuditLogListResponse {
  total: number;
  items: AuditLogItem[];
}

/** A single trend data point from `/api/v1/audit-log/trend` */
export interface TrendDataPoint {
  timestamp: string; // ISO 8601 UTC
  count: number;
}

/** Trend API response */
export interface AuditLogTrendResponse {
  granularity: TrendGranularity;
  data_points: TrendDataPoint[];
}

/** Metadata response from `/api/v1/audit-log/meta` */
export interface AuditLogMetaResponse {
  action_types: string[];
}

/** Filter state for audit log queries */
export interface AuditLogFilter {
  startTime: string | null; // Local ISO string
  endTime: string | null;   // Local ISO string
  actionType: string | null;
  operatorId: string | null;
}

/** Pagination state */
export interface PaginationState {
  page: number;
  size: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed time range span in days */
const MAX_TIME_RANGE_DAYS = 90;

/** Default page size for list queries */
const DEFAULT_PAGE_SIZE = 50;

/** Maximum page size for list queries */
const MAX_PAGE_SIZE = 100;

/** Maximum allowed offset to prevent deep pagination */
const MAX_OFFSET = 10000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a local date/time string to UTC ISO 8601 format.
 * @param localDateTime - Local date-time string (e.g. "2025-01-15T08:00:00")
 * @returns UTC ISO 8601 string, or null if input is null/empty
 */
function toUTCISOString(localDateTime: string | null): string | null {
  if (!localDateTime) return null;
  const date = new Date(localDateTime);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Calculate the number of days between two date strings.
 * @param start - Start date string
 * @param end - End date string
 * @returns Number of days between the two dates (inclusive)
 */
function daysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine the appropriate trend granularity based on the query time range.
 * - ≤ 7 days → hourly
 * - 8–30 days → daily
 * - > 30 days → weekly
 * @param start - Start date string
 * @param end - End date string
 * @returns The granularity string for the API request
 */
function resolveTrendGranularity(start: string, end: string): TrendGranularity {
  const days = daysBetween(start, end);
  if (days <= 7) return 'hour';
  if (days <= 30) return 'day';
  return 'week';
}

/**
 * Validate that the time range does not exceed the 90-day maximum.
 * @param start - Start date string
 * @param end - End date string
 * @returns An error message if the range exceeds 90 days, otherwise null
 */
function validateTimeRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const days = daysBetween(start, end);
  if (days > MAX_TIME_RANGE_DAYS) {
    return `查询时间跨度不得超过 ${MAX_TIME_RANGE_DAYS} 天，当前跨度为 ${days} 天`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Store definition
// ---------------------------------------------------------------------------

export const useAuditLogStore = defineStore('auditLog', () => {
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  /** Current filter values (local time) */
  const filter: Ref<AuditLogFilter> = ref({
    startTime: null,
    endTime: null,
    actionType: null,
    operatorId: null,
  });

  /** Pagination state */
  const pagination: Ref<PaginationState> = ref({
    page: 1,
    size: DEFAULT_PAGE_SIZE,
    total: 0,
  });

  /** Audit log list data */
  const items: Ref<AuditLogItem[]> = ref([]);

  /** Trend data points */
  const trendData: Ref<TrendDataPoint[]> = ref([]);

  /** Current trend granularity */
  const trendGranularity: Ref<TrendGranularity> = ref('day');

  /** Action type options fetched from backend meta endpoint */
  const actionTypes: Ref<string[]> = ref([]);

  /** Loading state for list queries */
  const listLoading: Ref<boolean> = ref(false);

  /** Loading state for trend queries */
  const trendLoading: Ref<boolean> = ref(false);

  /** Loading state for meta queries */
  const metaLoading: Ref<boolean> = ref(false);

  /** Error message from the last failed operation */
  const errorMessage: Ref<string | null> = ref(null);

  // -----------------------------------------------------------------------
  // Computed
  // -----------------------------------------------------------------------

  /** Total number of pages based on current pagination */
  const totalPages: ComputedRef<number> = computed(() => {
    if (pagination.value.total === 0) return 0;
    return Math.ceil(pagination.value.total / pagination.value.size);
  });

  /** Whether the current page has a next page */
  const hasNextPage: ComputedRef<boolean> = computed(() => {
    return pagination.value.page < totalPages.value;
  });

  /** Whether the current page has a previous page */
  const hasPrevPage: ComputedRef<boolean> = computed(() => {
    return pagination.value.page > 1;
  });

  /** Whether the current offset exceeds the deep pagination limit */
  const isDeepPaginationExceeded: ComputedRef<boolean> = computed(() => {
    const offset = (pagination.value.page - 1) * pagination.value.size;
    return offset > MAX_OFFSET;
  });

  /** Whether the current filter time range exceeds the 90-day limit */
  const isTimeRangeExceeded: ComputedRef<boolean> = computed(() => {
    return validateTimeRange(filter.value.startTime, filter.value.endTime) !== null;
  });

  /** Human-readable time range validation error */
  const timeRangeError: ComputedRef<string | null> = computed(() => {
    return validateTimeRange(filter.value.startTime, filter.value.endTime);
  });

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /**
   * Fetch action type enum from the backend meta endpoint.
   * The action types are dynamically loaded and must not be hardcoded.
   */
  async function fetchMeta(): Promise<void> {
    metaLoading.value = true;
    errorMessage.value = null;
    try {
      const response = await http.get<AuditLogMetaResponse>('/api/v1/audit-log/meta');
      actionTypes.value = response.data.action_types ?? [];
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取操作类型元数据失败';
      errorMessage.value = message;
      actionTypes.value = [];
    } finally {
      metaLoading.value = false;
    }
  }

  /**
   * Fetch the paginated audit log list with current filter and pagination state.
   * Converts local time to UTC before sending to the API.
   * Enforces the 90-day time range constraint and deep pagination limit.
   */
  async function fetchList(): Promise<void> {
    // Validate time range before making the request
    const rangeError = validateTimeRange(filter.value.startTime, filter.value.endTime);
    if (rangeError) {
      errorMessage.value = rangeError;
      return;
    }

    // Validate deep pagination limit
    const offset = (pagination.value.page - 1) * pagination.value.size;
    if (offset > MAX_OFFSET) {
      errorMessage.value = `分页偏移量超过上限 ${MAX_OFFSET}，请使用更精确的筛选条件缩小范围`;
      return;
    }

    listLoading.value = true;
    errorMessage.value = null;

    try {
      const params: Record<string, string | number> = {
        page: pagination.value.page,
        size: Math.min(pagination.value.size, MAX_PAGE_SIZE),
      };

      // Convert local times to UTC ISO strings for API
      const utcStart = toUTCISOString(filter.value.startTime);
      const utcEnd = toUTCISOString(filter.value.endTime);

      if (utcStart) params.start_time = utcStart;
      if (utcEnd) params.end_time = utcEnd;
      if (filter.value.actionType) params.action_type = filter.value.actionType;
      if (filter.value.operatorId) params.operator_id = filter.value.operatorId;

      const response = await http.get<AuditLogListResponse>('/api/v1/audit-log/list', { params });

      items.value = response.data.items ?? [];
      pagination.value.total = response.data.total ?? 0;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取审计日志列表失败';
      errorMessage.value = message;
      items.value = [];
      pagination.value.total = 0;
    } finally {
      listLoading.value = false;
    }
  }

  /**
   * Fetch trend data for the current filter time range.
   * Automatically determines the appropriate granularity based on the time span:
   * - ≤ 7 days → hourly
   * - 8–30 days → daily
   * - > 30 days → weekly
   * Converts local time to UTC before sending to the API.
   */
  async function fetchTrend(): Promise<void> {
    // Trend requires a valid time range
    if (!filter.value.startTime || !filter.value.endTime) {
      trendData.value = [];
      return;
    }

    // Validate time range
    const rangeError = validateTimeRange(filter.value.startTime, filter.value.endTime);
    if (rangeError) {
      errorMessage.value = rangeError;
      trendData.value = [];
      return;
    }

    trendLoading.value = true;

    try {
      const utcStart = toUTCISOString(filter.value.startTime);
      const utcEnd = toUTCISOString(filter.value.endTime);

      if (!utcStart || !utcEnd) {
        trendData.value = [];
        return;
      }

      // Determine granularity based on time range
      const granularity = resolveTrendGranularity(filter.value.startTime, filter.value.endTime);
      trendGranularity.value = granularity;

      const params: Record<string, string> = {
        start_time: utcStart,
        end_time: utcEnd,
        granularity,
      };

      if (filter.value.actionType) params.action_type = filter.value.actionType;
      if (filter.value.operatorId) params.operator_id = filter.value.operatorId;

      const response = await http.get<AuditLogTrendResponse>('/api/v1/audit-log/trend', { params });

      trendData.value = response.data.data_points ?? [];
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '获取审计日志趋势数据失败';
      errorMessage.value = message;
      trendData.value = [];
    } finally {
      trendLoading.value = false;
    }
  }

  /**
   * Execute a full query: fetch both the list and trend data concurrently.
   * This is the primary action triggered by the "查询" button on the dashboard.
   */
  async function query(): Promise<void> {
    // Reset to page 1 on new queries
    pagination.value.page = 1;
    errorMessage.value = null;

    // Validate before making any requests
    const rangeError = validateTimeRange(filter.value.startTime, filter.value.endTime);
    if (rangeError) {
      errorMessage.value = rangeError;
      return;
    }

    await Promise.all([fetchList(), fetchTrend()]);
  }

  /**
   * Navigate to a specific page and refresh the list data.
   * @param page - Target page number (1-based)
   */
  async function goToPage(page: number): Promise<void> {
    if (page < 1 || page > totalPages.value) return;

    const offset = (page - 1) * pagination.value.size;
    if (offset > MAX_OFFSET) {
      errorMessage.value = `分页偏移量超过上限 ${MAX_OFFSET}，请使用更精确的筛选条件缩小范围`;
      return;
    }

    pagination.value.page = page;
    await fetchList();
  }

  /**
   * Update the page size and reset to page 1.
   * @param size - New page size (clamped to MAX_PAGE_SIZE)
   */
  async function setPageSize(size: number): Promise<void> {
    pagination.value.size = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
    pagination.value.page = 1;
    await fetchList();
  }

  /**
   * Update filter values. Does not trigger a query automatically;
   * call `query()` explicitly to fetch data with the new filters.
   * @param newFilter - Partial filter update to merge into current state
   */
  function updateFilter(newFilter: Partial<AuditLogFilter>): void {
    if (newFilter.startTime !== undefined) filter.value.startTime = newFilter.startTime;
    if (newFilter.endTime !== undefined) filter.value.endTime = newFilter.endTime;
    if (newFilter.actionType !== undefined) filter.value.actionType = newFilter.actionType;
    if (newFilter.operatorId !== undefined) filter.value.operatorId = newFilter.operatorId;
  }

  /**
   * Reset all filter values to their defaults.
   */
  function resetFilter(): void {
    filter.value = {
      startTime: null,
      endTime: null,
      actionType: null,
      operatorId: null,
    };
  }

  /**
   * Reset the entire store state to its initial values.
   */
  function $reset(): void {
    filter.value = {
      startTime: null,
      endTime: null,
      actionType: null,
      operatorId: null,
    };
    pagination.value = {
      page: 1,
      size: DEFAULT_PAGE_SIZE,
      total: 0,
    };
    items.value = [];
    trendData.value = [];
    trendGranularity.value = 'day';
    actionTypes.value = [];
    listLoading.value = false;
    trendLoading.value = false;
    metaLoading.value = false;
    errorMessage.value = null;
  }

  return {
    // State
    filter,
    pagination,
    items,
    trendData,
    trendGranularity,
    actionTypes,
    listLoading,
    trendLoading,
    metaLoading,
    errorMessage,

    // Computed
    totalPages,
    hasNextPage,
    hasPrevPage,
    isDeepPaginationExceeded,
    isTimeRangeExceeded,
    timeRangeError,

    // Actions
    fetchMeta,
    fetchList,
    fetchTrend,
    query,
    goToPage,
    setPageSize,
    updateFilter,
    resetFilter,
    $reset,
  };
});

export default useAuditLogStore;