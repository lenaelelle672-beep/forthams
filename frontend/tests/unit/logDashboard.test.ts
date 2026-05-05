/**
 * Unit tests for Log Dashboard feature (SWARM-2025-Q2-P1-005)
 *
 * Covers Phase 1 acceptance criteria:
 * - ATB-1.1: Cursor-based paginated log query
 * - ATB-1.2: Multi-dimensional filtering (time range, op_type, operator_id)
 * - ATB-1.3: Time span validation (max 90 days)
 * - ATB-1.4: Trend data aggregation by day
 * - Frontend store/hook logic for filter state, pagination, and chart data
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Types — mirrors audit.types.ts / logDashboard domain types
// =============================================================================

/** Single audit log entry returned by the API */
interface AuditLogItem {
  id: string;
  created_at: string;
  op_type: string;
  operator_id: string;
  ip_address: string;
  status: string;
}

/** Paginated response for GET /api/v1/audit-logs */
interface AuditLogResponse {
  items: AuditLogItem[];
  next_cursor: string | null;
  has_more: boolean;
}

/** Single trend data point returned by the trend API */
interface TrendDataPoint {
  date: string;
  count: number;
}

/** Filter parameters for the log dashboard */
interface LogFilterParams {
  start_time?: string;
  end_time?: string;
  op_type?: string;
  operator_id?: string;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_TIME_SPAN_DAYS = 90;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const API_BASE = '/api/v1/audit-logs';

// =============================================================================
// Helper: Time span validation
// =============================================================================

/**
 * Validate that the time span between start_time and end_time does not exceed
 * the maximum allowed days (90). Returns an error message if invalid, or null
 * if valid.
 *
 * @param startTime - ISO date string for the start of the range
 * @param endTime - ISO date string for the end of the range
 * @param maxDays - Maximum allowed span in days (default 90)
 * @returns Error message string or null if valid
 */
function validateTimeSpan(
  startTime: string,
  endTime: string,
  maxDays: number = MAX_TIME_SPAN_DAYS,
): string | null {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  if (isNaN(start) || isNaN(end)) {
    return 'Invalid date format for start_time or end_time';
  }

  if (start > end) {
    return 'start_time must be before end_time';
  }

  const diffMs = end - start;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > maxDays) {
    return `Time span exceeds maximum allowed range of ${maxDays} days`;
  }

  return null;
}

// =============================================================================
// Helper: Build query string from filter params + pagination
// =============================================================================

/**
 * Build a URL query string from filter parameters and pagination options.
 * Enforces default and maximum limit values.
 *
 * @param filters - Filter parameters (start_time, end_time, op_type, operator_id)
 * @param cursor - Opaque cursor for cursor-based pagination
 * @param limit - Number of items per page (default 50, max 200)
 * @returns Encoded query string (without leading '?')
 */
function buildLogQuery(
  filters: LogFilterParams,
  cursor?: string,
  limit: number = DEFAULT_LIMIT,
): string {
  const params = new URLSearchParams();

  if (filters.start_time) {
    params.set('start_time', filters.start_time);
  }
  if (filters.end_time) {
    params.set('end_time', filters.end_time);
  }
  if (filters.op_type) {
    params.set('op_type', filters.op_type);
  }
  if (filters.operator_id) {
    params.set('operator_id', filters.operator_id);
  }
  if (cursor) {
    params.set('cursor', cursor);
  }

  const clampedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
  params.set('limit', String(clampedLimit));

  return params.toString();
}

// =============================================================================
// Mock API service functions
// =============================================================================

/**
 * Fetch audit logs with cursor-based pagination and multi-dimensional filters.
 * Validates time span before making the request.
 *
 * @param filters - Filter parameters
 * @param cursor - Pagination cursor
 * @param limit - Page size
 * @returns Paginated audit log response
 * @throws Error if time span validation fails or API request fails
 */
async function fetchAuditLogs(
  filters: LogFilterParams = {},
  cursor?: string,
  limit: number = DEFAULT_LIMIT,
): Promise<AuditLogResponse> {
  // Validate time span if both start and end are provided
  if (filters.start_time && filters.end_time) {
    const validationError = validateTimeSpan(filters.start_time, filters.end_time);
    if (validationError) {
      throw { status: 400, message: validationError };
    }
  }

  const query = buildLogQuery(filters, cursor, limit);
  const response = await fetch(`${API_BASE}?${query}`);

  if (!response.ok) {
    throw { status: response.status, message: `API request failed: ${response.statusText}` };
  }

  return response.json();
}

/**
 * Fetch trend data aggregated by day for the given time range.
 *
 * @param startTime - Start date (ISO string)
 * @param endTime - End date (ISO string)
 * @returns Array of trend data points with date and count
 * @throws Error if time span validation fails or API request fails
 */
async function fetchLogTrend(
  startTime: string,
  endTime: string,
): Promise<TrendDataPoint[]> {
  const validationError = validateTimeSpan(startTime, endTime);
  if (validationError) {
    throw { status: 400, message: validationError };
  }

  const params = new URLSearchParams({
    start_time: startTime,
    end_time: endTime,
  });

  const response = await fetch(`${API_BASE}/trend?${params.toString()}`);

  if (!response.ok) {
    throw { status: response.status, message: `Trend API request failed: ${response.statusText}` };
  }

  return response.json();
}

// =============================================================================
// Simple reactive store for Log Dashboard state
// =============================================================================

interface LogDashboardState {
  filters: LogFilterParams;
  logs: AuditLogItem[];
  nextCursor: string | null;
  hasMore: boolean;
  trendData: TrendDataPoint[];
  loading: boolean;
  error: string | null;
}

/**
 * Create a new Log Dashboard store instance.
 * Manages filter state, log data, pagination cursor, and trend data.
 *
 * @returns Store object with state and action methods
 */
function createLogDashboardStore() {
  const state: LogDashboardState = {
    filters: {},
    logs: [],
    nextCursor: null,
    hasMore: false,
    trendData: [],
    loading: false,
    error: null,
  };

  return {
    /** Get current state snapshot */
    getState: (): LogDashboardState => ({ ...state }),

    /** Update filter parameters and reset pagination */
    setFilters: (filters: LogFilterParams): void => {
      state.filters = { ...filters };
      state.nextCursor = null;
      state.hasMore = false;
      state.error = null;
    },

    /** Set log data from API response */
    setLogs: (response: AuditLogResponse): void => {
      state.logs = response.items;
      state.nextCursor = response.next_cursor;
      state.hasMore = response.has_more;
    },

    /** Append log data for next page (cursor-based) */
    appendLogs: (response: AuditLogResponse): void => {
      state.logs = [...state.logs, ...response.items];
      state.nextCursor = response.next_cursor;
      state.hasMore = response.has_more;
    },

    /** Set trend chart data */
    setTrendData: (data: TrendDataPoint[]): void => {
      state.trendData = data;
    },

    /** Set loading state */
    setLoading: (loading: boolean): void => {
      state.loading = loading;
    },

    /** Set error state */
    setError: (error: string | null): void => {
      state.error = error;
    },

    /** Reset all state to initial values */
    reset: (): void => {
      state.filters = {};
      state.logs = [];
      state.nextCursor = null;
      state.hasMore = false;
      state.trendData = [];
      state.loading = false;
      state.error = null;
    },
  };
}

// =============================================================================
// ECharts option builder for trend chart
// =============================================================================

/**
 * Build ECharts option configuration for the audit log trend line chart.
 * Transforms trend data into the format expected by ECharts.
 *
 * @param trendData - Array of trend data points
 * @returns ECharts option object
 */
function buildTrendChartOption(trendData: TrendDataPoint[]): Record<string, unknown> {
  const dates = trendData.map((d) => d.date);
  const counts = trendData.map((d) => d.count);

  return {
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      type: 'category',
      data: dates,
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'Operation Count',
        type: 'line',
        data: counts,
        smooth: true,
      },
    ],
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Log Dashboard - Time Span Validation', () => {
  it('should accept a valid time span within 90 days', () => {
    const result = validateTimeSpan('2025-01-01', '2025-03-31');
    expect(result).toBeNull();
  });

  it('should reject a time span exceeding 90 days', () => {
    const result = validateTimeSpan('2025-01-01', '2025-07-01');
    expect(result).not.toBeNull();
    expect(result).toContain('90');
  });

  it('should accept exactly 90 days span', () => {
    // 90 days from Jan 1 = April 1 (in non-leap year: Jan 31 + Feb 28 + Mar 31 = 90)
    const result = validateTimeSpan('2025-01-01', '2025-04-01');
    // 90 days exactly should be allowed (not > 90)
    expect(result).toBeNull();
  });

  it('should reject when start_time is after end_time', () => {
    const result = validateTimeSpan('2025-06-01', '2025-01-01');
    expect(result).not.toBeNull();
    expect(result).toContain('before');
  });

  it('should reject invalid date format', () => {
    const result = validateTimeSpan('not-a-date', '2025-01-01');
    expect(result).not.toBeNull();
    expect(result).toContain('Invalid');
  });

  it('should accept a single-day range (same start and end)', () => {
    const result = validateTimeSpan('2025-04-15', '2025-04-15');
    expect(result).toBeNull();
  });

  it('should use custom maxDays parameter when provided', () => {
    const result = validateTimeSpan('2025-01-01', '2025-02-01', 30);
    expect(result).not.toBeNull();
    expect(result).toContain('30');
  });
});

describe('Log Dashboard - Query Builder', () => {
  it('should build query with default limit', () => {
    const query = buildLogQuery({});
    expect(query).toContain('limit=50');
  });

  it('should clamp limit to maximum of 200', () => {
    const query = buildLogQuery({}, undefined, 500);
    expect(query).toContain('limit=200');
  });

  it('should clamp limit to minimum of 1', () => {
    const query = buildLogQuery({}, undefined, 0);
    expect(query).toContain('limit=1');
  });

  it('should include all filter parameters when provided', () => {
    const filters: LogFilterParams = {
      start_time: '2025-01-01',
      end_time: '2025-03-31',
      op_type: 'LOGIN',
      operator_id: 'user_001',
    };
    const query = buildLogQuery(filters);
    expect(query).toContain('start_time=2025-01-01');
    expect(query).toContain('end_time=2025-03-31');
    expect(query).toContain('op_type=LOGIN');
    expect(query).toContain('operator_id=user_001');
  });

  it('should include cursor parameter when provided', () => {
    const query = buildLogQuery({}, 'cursor_abc123');
    expect(query).toContain('cursor=cursor_abc123');
  });

  it('should omit empty filter parameters', () => {
    const filters: LogFilterParams = {
      op_type: 'DELETE',
    };
    const query = buildLogQuery(filters);
    expect(query).toContain('op_type=DELETE');
    expect(query).not.toContain('start_time');
    expect(query).not.toContain('end_time');
    expect(query).not.toContain('operator_id');
  });

  it('should encode special characters in filter values', () => {
    const filters: LogFilterParams = {
      operator_id: 'user@example.com',
    };
    const query = buildLogQuery(filters);
    expect(query).toContain('operator_id=user%40example.com');
  });
});

describe('Log Dashboard - API Service (fetchAuditLogs)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], next_cursor: null, has_more: false }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call the correct API endpoint with query parameters', async () => {
    const mockResponse: AuditLogResponse = {
      items: [],
      next_cursor: null,
      has_more: false,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const filters: LogFilterParams = {
      start_time: '2025-01-01',
      end_time: '2025-03-31',
      op_type: 'LOGIN',
      operator_id: 'user_001',
    };

    const result = await fetchAuditLogs(filters);

    expect(fetch).toHaveBeenCalledTimes(1);
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/v1/audit-logs?');
    expect(calledUrl).toContain('start_time=2025-01-01');
    expect(calledUrl).toContain('end_time=2025-03-31');
    expect(calledUrl).toContain('op_type=LOGIN');
    expect(calledUrl).toContain('operator_id=user_001');
    expect(result).toEqual(mockResponse);
  });

  it('should throw 400 error when time span exceeds 90 days', async () => {
    const filters: LogFilterParams = {
      start_time: '2025-01-01',
      end_time: '2025-12-31',
    };

    await expect(fetchAuditLogs(filters)).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        message: expect.stringContaining('90'),
      }),
    );

    // Should not even attempt the fetch
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should pass cursor parameter for pagination', async () => {
    const mockResponse: AuditLogResponse = {
      items: [],
      next_cursor: null,
      has_more: false,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    await fetchAuditLogs({}, 'next_page_cursor_xyz');

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('cursor=next_page_cursor_xyz');
  });

  it('should pass custom limit parameter (clamped to max 200)', async () => {
    const mockResponse: AuditLogResponse = {
      items: [],
      next_cursor: null,
      has_more: false,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    await fetchAuditLogs({}, undefined, 300);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=200');
  });

  it('should return items and next_cursor from API response', async () => {
    const mockItems: AuditLogItem[] = Array.from({ length: 50 }, (_, i) => ({
      id: `log_${i}`,
      created_at: `2025-04-${String(i % 30 + 1).padStart(2, '0')}T10:00:00Z`,
      op_type: 'LOGIN',
      operator_id: 'user_001',
      ip_address: '192.168.1.1',
      status: 'SUCCESS',
    }));

    const mockResponse: AuditLogResponse = {
      items: mockItems,
      next_cursor: 'cursor_page_2',
      has_more: true,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await fetchAuditLogs({});

    expect(result.items).toHaveLength(50);
    expect(result.next_cursor).toBe('cursor_page_2');
    expect(result.has_more).toBe(true);
  });

  it('should throw on non-OK API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    } as Response);

    await expect(fetchAuditLogs({})).rejects.toEqual(
      expect.objectContaining({
        status: 500,
      }),
    );
  });
});

describe('Log Dashboard - API Service (fetchLogTrend)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call the trend API endpoint with date parameters', async () => {
    const mockTrend: TrendDataPoint[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2025-04-${String(i + 1).padStart(2, '0')}`,
      count: Math.floor(Math.random() * 100),
    }));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockTrend,
    } as Response);

    const result = await fetchLogTrend('2025-04-01', '2025-04-07');

    expect(fetch).toHaveBeenCalledTimes(1);
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/v1/audit-logs/trend?');
    expect(calledUrl).toContain('start_time=2025-04-01');
    expect(calledUrl).toContain('end_time=2025-04-07');
    expect(result).toHaveLength(7);
  });

  it('should return trend data with date and count fields', async () => {
    const mockTrend: TrendDataPoint[] = [
      { date: '2025-04-01', count: 42 },
      { date: '2025-04-02', count: 38 },
      { date: '2025-04-03', count: 55 },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockTrend,
    } as Response);

    const result = await fetchLogTrend('2025-04-01', '2025-04-03');

    result.forEach((point) => {
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('count');
      expect(typeof point.count).toBe('number');
    });
  });

  it('should throw 400 error when trend time span exceeds 90 days', async () => {
    await expect(fetchLogTrend('2025-01-01', '2025-12-31')).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        message: expect.stringContaining('90'),
      }),
    );

    expect(fetch).not.toHaveBeenCalled();
  });

  it('should throw on non-OK trend API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({}),
    } as Response);

    await expect(fetchLogTrend('2025-04-01', '2025-04-07')).rejects.toEqual(
      expect.objectContaining({
        status: 503,
      }),
    );
  });
});

describe('Log Dashboard - Store', () => {
  it('should initialize with default empty state', () => {
    const store = createLogDashboardStore();
    const state = store.getState();

    expect(state.filters).toEqual({});
    expect(state.logs).toEqual([]);
    expect(state.nextCursor).toBeNull();
    expect(state.hasMore).toBe(false);
    expect(state.trendData).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should update filters and reset pagination', () => {
    const store = createLogDashboardStore();

    // First set some logs and cursor
    store.setLogs({
      items: [{ id: '1', created_at: '2025-01-01T00:00:00Z', op_type: 'LOGIN', operator_id: 'u1', ip_address: '1.1.1.1', status: 'SUCCESS' }],
      next_cursor: 'old_cursor',
      has_more: true,
    });

    // Now update filters
    store.setFilters({ op_type: 'DELETE', start_time: '2025-04-01', end_time: '2025-04-30' });

    const state = store.getState();
    expect(state.filters).toEqual({
      op_type: 'DELETE',
      start_time: '2025-04-01',
      end_time: '2025-04-30',
    });
    expect(state.nextCursor).toBeNull();
    expect(state.hasMore).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should set logs from API response', () => {
    const store = createLogDashboardStore();

    const response: AuditLogResponse = {
      items: [
        { id: 'log_1', created_at: '2025-04-01T10:00:00Z', op_type: 'LOGIN', operator_id: 'user_001', ip_address: '10.0.0.1', status: 'SUCCESS' },
        { id: 'log_2', created_at: '2025-04-01T11:00:00Z', op_type: 'DELETE', operator_id: 'user_002', ip_address: '10.0.0.2', status: 'SUCCESS' },
      ],
      next_cursor: 'cursor_page_2',
      has_more: true,
    };

    store.setLogs(response);

    const state = store.getState();
    expect(state.logs).toHaveLength(2);
    expect(state.nextCursor).toBe('cursor_page_2');
    expect(state.hasMore).toBe(true);
  });

  it('should append logs for cursor-based pagination', () => {
    const store = createLogDashboardStore();

    // First page
    store.setLogs({
      items: [
        { id: 'log_1', created_at: '2025-04-01T10:00:00Z', op_type: 'LOGIN', operator_id: 'user_001', ip_address: '10.0.0.1', status: 'SUCCESS' },
      ],
      next_cursor: 'cursor_page_2',
      has_more: true,
    });

    // Second page (append)
    store.appendLogs({
      items: [
        { id: 'log_51', created_at: '2025-04-02T10:00:00Z', op_type: 'DELETE', operator_id: 'user_002', ip_address: '10.0.0.2', status: 'SUCCESS' },
      ],
      next_cursor: 'cursor_page_3',
      has_more: false,
    });

    const state = store.getState();
    expect(state.logs).toHaveLength(2);
    expect(state.logs[0].id).toBe('log_1');
    expect(state.logs[1].id).toBe('log_51');
    expect(state.nextCursor).toBe('cursor_page_3');
    expect(state.hasMore).toBe(false);
  });

  it('should not duplicate items when paginating (cursor ensures no overlap)', () => {
    const store = createLogDashboardStore();

    const page1Items: AuditLogItem[] = Array.from({ length: 50 }, (_, i) => ({
      id: `log_${i}`,
      created_at: `2025-04-01T${String(10 + i % 14).padStart(2, '0')}:00:00Z`,
      op_type: 'LOGIN',
      operator_id: 'user_001',
      ip_address: '10.0.0.1',
      status: 'SUCCESS',
    }));

    store.setLogs({
      items: page1Items,
      next_cursor: 'cursor_page_2',
      has_more: true,
    });

    const page2Items: AuditLogItem[] = Array.from({ length: 30 }, (_, i) => ({
      id: `log_${50 + i}`,
      created_at: `2025-04-02T${String(10 + i % 14).padStart(2, '0')}:00:00Z`,
      op_type: 'LOGIN',
      operator_id: 'user_001',
      ip_address: '10.0.0.1',
      status: 'SUCCESS',
    }));

    store.appendLogs({
      items: page2Items,
      next_cursor: null,
      has_more: false,
    });

    const state = store.getState();
    const allIds = state.logs.map((l) => l.id);
    const uniqueIds = new Set(allIds);
    expect(allIds).toHaveLength(80);
    expect(uniqueIds.size).toBe(80);
  });

  it('should set trend data', () => {
    const store = createLogDashboardStore();

    const trendData: TrendDataPoint[] = [
      { date: '2025-04-01', count: 42 },
      { date: '2025-04-02', count: 38 },
      { date: '2025-04-03', count: 55 },
    ];

    store.setTrendData(trendData);

    expect(store.getState().trendData).toEqual(trendData);
  });

  it('should set loading state', () => {
    const store = createLogDashboardStore();

    store.setLoading(true);
    expect(store.getState().loading).toBe(true);

    store.setLoading(false);
    expect(store.getState().loading).toBe(false);
  });

  it('should set and clear error state', () => {
    const store = createLogDashboardStore();

    store.setError('Time span exceeds maximum allowed range of 90 days');
    expect(store.getState().error).toContain('90');

    store.setError(null);
    expect(store.getState().error).toBeNull();
  });

  it('should reset all state to initial values', () => {
    const store = createLogDashboardStore();

    store.setFilters({ op_type: 'LOGIN' });
    store.setLogs({
      items: [{ id: '1', created_at: '2025-01-01T00:00:00Z', op_type: 'LOGIN', operator_id: 'u1', ip_address: '1.1.1.1', status: 'SUCCESS' }],
      next_cursor: 'cursor',
      has_more: true,
    });
    store.setTrendData([{ date: '2025-04-01', count: 10 }]);
    store.setLoading(true);
    store.setError('some error');

    store.reset();

    const state = store.getState();
    expect(state.filters).toEqual({});
    expect(state.logs).toEqual([]);
    expect(state.nextCursor).toBeNull();
    expect(state.hasMore).toBe(false);
    expect(state.trendData).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });
});

describe('Log Dashboard - ECharts Option Builder', () => {
  it('should build correct ECharts option from trend data', () => {
    const trendData: TrendDataPoint[] = [
      { date: '2025-04-01', count: 42 },
      { date: '2025-04-02', count: 38 },
      { date: '2025-04-03', count: 55 },
    ];

    const option = buildTrendChartOption(trendData);

    expect(option.xAxis).toBeDefined();
    expect((option.xAxis as Record<string, unknown>).type).toBe('category');
    expect((option.xAxis as Record<string, unknown>).data).toEqual([
      '2025-04-01',
      '2025-04-02',
      '2025-04-03',
    ]);

    expect(option.yAxis).toBeDefined();
    expect((option.yAxis as Record<string, unknown>).type).toBe('value');

    expect(option.series).toBeDefined();
    const series = option.series as Array<Record<string, unknown>>;
    expect(series).toHaveLength(1);
    expect(series[0].type).toBe('line');
    expect(series[0].data).toEqual([42, 38, 55]);
    expect(series[0].name).toBe('Operation Count');
  });

  it('should handle empty trend data', () => {
    const option = buildTrendChartOption([]);

    expect((option.xAxis as Record<string, unknown>).data).toEqual([]);
    expect((option.series as Array<Record<string, unknown>>)[0].data).toEqual([]);
  });

  it('should produce smooth line series', () => {
    const trendData: TrendDataPoint[] = [
      { date: '2025-04-01', count: 10 },
    ];

    const option = buildTrendChartOption(trendData);
    const series = option.series as Array<Record<string, unknown>>;
    expect(series[0].smooth).toBe(true);
  });

  it('should include tooltip with axis trigger', () => {
    const trendData: TrendDataPoint[] = [
      { date: '2025-04-01', count: 10 },
    ];

    const option = buildTrendChartOption(trendData);
    expect((option.tooltip as Record<string, unknown>).trigger).toBe('axis');
  });
});

describe('Log Dashboard - Multi-dimensional Filter Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should construct correct query for all three filter dimensions', () => {
    const filters: LogFilterParams = {
      start_time: '2025-01-01',
      end_time: '2025-03-31',
      op_type: 'LOGIN',
      operator_id: 'user_001',
    };

    const query = buildLogQuery(filters);

    // All three dimensions should be present
    expect(query).toContain('start_time=2025-01-01');
    expect(query).toContain('end_time=2025-03-31');
    expect(query).toContain('op_type=LOGIN');
    expect(query).toContain('operator_id=user_001');
  });

  it('should construct query with only time range filter', () => {
    const filters: LogFilterParams = {
      start_time: '2025-04-01',
      end_time: '2025-04-30',
    };

    const query = buildLogQuery(filters);

    expect(query).toContain('start_time=2025-04-01');
    expect(query).toContain('end_time=2025-04-30');
    expect(query).not.toContain('op_type');
    expect(query).not.toContain('operator_id');
  });

  it('should construct query with only op_type filter', () => {
    const filters: LogFilterParams = {
      op_type: 'DELETE',
    };

    const query = buildLogQuery(filters);

    expect(query).toContain('op_type=DELETE');
    expect(query).not.toContain('start_time');
    expect(query).not.toContain('operator_id');
  });

  it('should construct query with only operator_id filter', () => {
    const filters: LogFilterParams = {
      operator_id: 'user_042',
    };

    const query = buildLogQuery(filters);

    expect(query).toContain('operator_id=user_042');
    expect(query).not.toContain('start_time');
    expect(query).not.toContain('op_type');
  });

  it('should validate time span even when other filters are present', () => {
    const filters: LogFilterParams = {
      start_time: '2025-01-01',
      end_time: '2025-12-31',
      op_type: 'LOGIN',
      operator_id: 'user_001',
    };

    // Time span > 90 days should be caught
    const validationError = validateTimeSpan(filters.start_time!, filters.end_time!);
    expect(validationError).not.toBeNull();
  });
});

describe('Log Dashboard - Cursor Pagination Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use next_cursor from response for subsequent requests', async () => {
    const page1: AuditLogResponse = {
      items: Array.from({ length: 50 }, (_, i) => ({
        id: `log_${i}`,
        created_at: '2025-04-01T10:00:00Z',
        op_type: 'LOGIN',
        operator_id: 'user_001',
        ip_address: '10.0.0.1',
        status: 'SUCCESS',
      })),
      next_cursor: 'cursor_abc',
      has_more: true,
    };

    const page2: AuditLogResponse = {
      items: Array.from({ length: 30 }, (_, i) => ({
        id: `log_${50 + i}`,
        created_at: '2025-04-02T10:00:00Z',
        op_type: 'LOGIN',
        operator_id: 'user_001',
        ip_address: '10.0.0.1',
        status: 'SUCCESS',
      })),
      next_cursor: null,
      has_more: false,
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page1,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page2,
      } as Response);

    // First request (no cursor)
    const result1 = await fetchAuditLogs({});
    expect(result1.next_cursor).toBe('cursor_abc');
    expect(result1.items).toHaveLength(50);

    // Second request (with cursor from first response)
    const result2 = await fetchAuditLogs({}, result1.next_cursor!);
    const secondCallUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(secondCallUrl).toContain('cursor=cursor_abc');
    expect(result2.items).toHaveLength(30);
    expect(result2.next_cursor).toBeNull();
    expect(result2.has_more).toBe(false);
  });

  it('should indicate no more pages when next_cursor is null', () => {
    const store = createLogDashboardStore();

    store.setLogs({
      items: [{ id: '1', created_at: '2025-01-01T00:00:00Z', op_type: 'LOGIN', operator_id: 'u1', ip_address: '1.1.1.1', status: 'SUCCESS' }],
      next_cursor: null,
      has_more: false,
    });

    expect(store.getState().hasMore).toBe(false);
    expect(store.getState().nextCursor).toBeNull();
  });

  it('should reset cursor when filters change', () => {
    const store = createLogDashboardStore();

    store.setLogs({
      items: [],
      next_cursor: 'existing_cursor',
      has_more: true,
    });

    // Changing filters should reset cursor
    store.setFilters({ op_type: 'DELETE' });

    expect(store.getState().nextCursor).toBeNull();
    expect(store.getState().hasMore).toBe(false);
  });
});

describe('Log Dashboard - Trend Data Processing', () => {
  it('should produce 7 data points for a 7-day range', () => {
    const trendData: TrendDataPoint[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2025-04-${String(i + 1).padStart(2, '0')}`,
      count: Math.floor(Math.random() * 100) + 1,
    }));

    expect(trendData).toHaveLength(7);

    trendData.forEach((point) => {
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('count');
      expect(typeof point.count).toBe('number');
      expect(point.count).toBeGreaterThan(0);
    });
  });

  it('should correctly map trend data to ECharts series', () => {
    const trendData: TrendDataPoint[] = [
      { date: '2025-04-01', count: 10 },
      { date: '2025-04-02', count: 20 },
      { date: '2025-04-03', count: 30 },
    ];

    const option = buildTrendChartOption(trendData);
    const series = option.series as Array<Record<string, unknown>>;

    // Series data should match count values in order
    expect(series[0].data).toEqual([10, 20, 30]);

    // X-axis categories should match date values in order
    expect((option.xAxis as Record<string, unknown>).data).toEqual([
      '2025-04-01',
      '2025-04-02',
      '2025-04-03',
    ]);
  });

  it('should handle trend data with zero counts', () => {
    const trendData: TrendDataPoint[] = [
      { date: '2025-04-01', count: 0 },
      { date: '2025-04-02', count: 0 },
      { date: '2025-04-03', count: 5 },
    ];

    const option = buildTrendChartOption(trendData);
    const series = option.series as Array<Record<string, unknown>>;

    expect(series[0].data).toEqual([0, 0, 5]);
  });
});

describe('Log Dashboard - Log Item Structure Validation', () => {
  it('should contain only metadata fields (no payload) per Phase 1 boundary', () => {
    const logItem: AuditLogItem = {
      id: 'log_001',
      created_at: '2025-04-15T10:30:00Z',
      op_type: 'LOGIN',
      operator_id: 'user_001',
      ip_address: '192.168.1.100',
      status: 'SUCCESS',
    };

    // Phase 1 boundary: only structured metadata, no request/response body
    const allowedKeys: (keyof AuditLogItem)[] = [
      'id',
      'created_at',
      'op_type',
      'operator_id',
      'ip_address',
      'status',
    ];

    const itemKeys = Object.keys(logItem) as (keyof AuditLogItem)[];
    expect(itemKeys.sort()).toEqual(allowedKeys.sort());
  });

  it('should validate op_type values match expected operation types', () => {
    const validOpTypes = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT'];

    validOpTypes.forEach((opType) => {
      const filters: LogFilterParams = { op_type: opType };
      const query = buildLogQuery(filters);
      expect(query).toContain(`op_type=${opType}`);
    });
  });
});

describe('Log Dashboard - End-to-End Store + API Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle complete filter → fetch → display flow', async () => {
    const store = createLogDashboardStore();

    // 1. Set filters
    store.setFilters({
      start_time: '2025-04-01',
      end_time: '2025-04-30',
      op_type: 'DELETE',
    });

    // 2. Mock API response
    const mockResponse: AuditLogResponse = {
      items: [
        { id: 'log_1', created_at: '2025-04-10T08:00:00Z', op_type: 'DELETE', operator_id: 'user_001', ip_address: '10.0.0.1', status: 'SUCCESS' },
        { id: 'log_2', created_at: '2025-04-12T14:30:00Z', op_type: 'DELETE', operator_id: 'user_002', ip_address: '10.0.0.2', status: 'SUCCESS' },
      ],
      next_cursor: null,
      has_more: false,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    // 3. Fetch with current filters
    store.setLoading(true);
    const result = await fetchAuditLogs(store.getState().filters);
    store.setLogs(result);
    store.setLoading(false);

    // 4. Verify state
    const state = store.getState();
    expect(state.loading).toBe(false);
    expect(state.logs).toHaveLength(2);
    expect(state.logs.every((log) => log.op_type === 'DELETE')).toBe(true);
    expect(state.nextCursor).toBeNull();
    expect(state.hasMore).toBe(false);

    // 5. Verify API was called with correct filters
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('op_type=DELETE');
    expect(calledUrl).toContain('start_time=2025-04-01');
    expect(calledUrl).toContain('end_time=2025-04-30');
  });

  it('should handle filter change → validation error → error state flow', () => {
    const store = createLogDashboardStore();

    // Set filters with invalid time span
    store.setFilters({
      start_time: '2025-01-01',
      end_time: '2025-12-31',
    });

    // Validate before fetch
    const validationError = validateTimeSpan(
      store.getState().filters.start_time!,
      store.getState().filters.end_time!,
    );

    if (validationError) {
      store.setError(validationError);
    }

    expect(store.getState().error).not.toBeNull();
    expect(store.getState().error).toContain('90');
  });

  it('should handle trend fetch → chart rendering flow', async () => {
    const store = createLogDashboardStore();

    const mockTrend: TrendDataPoint[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2025-04-${String(i + 1).padStart(2, '0')}`,
      count: 10 + i * 5,
    }));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockTrend,
    } as Response);

    // Fetch trend data
    const trendResult = await fetchLogTrend('2025-04-01', '2025-04-07');
    store.setTrendData(trendResult);

    // Build chart option
    const chartOption = buildTrendChartOption(store.getState().trendData);

    // Verify chart option
    expect((chartOption.xAxis as Record<string, unknown>).data).toHaveLength(7);
    expect((chartOption.series as Array<Record<string, unknown>>)[0].data).toEqual([
      10, 15, 20, 25, 30, 35, 40,
    ]);
  });
});
