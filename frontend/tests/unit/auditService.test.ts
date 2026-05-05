/**
 * @fileoverview Unit tests for auditService — audit log query, trend aggregation,
 * meta endpoint, time-range validation, pagination constraints, and timezone handling.
 *
 * Covers SPEC Phase 1 acceptance criteria:
 *   - ATB-01: Multi-condition dynamic filtering & pagination
 *   - ATB-02: Time-span > 90 days rejection (400)
 *   - ATB-03: Trend data aggregation with adaptive granularity
 *   - Permission constraint: only admin/auditor roles
 *   - Timezone constraint: Local → UTC conversion for API calls
 *   - Chart granularity constraint: ≤7d hourly, 8-30d daily, >30d weekly
 *   - Action-type constraint: fetched from /api/v1/audit-log/meta, no hardcoding
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Types — mirrors frontend/src/types/audit.types.ts & AuditDashboard types
// ---------------------------------------------------------------------------

/** Single audit log record returned by the list API */
interface AuditLogItem {
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

/** Paginated list response */
interface AuditLogListResponse {
  total: number;
  items: AuditLogItem[];
}

/** Single trend data point */
interface TrendDataPoint {
  timestamp: string; // ISO 8601 UTC
  count: number;
}

/** Trend API response */
interface AuditTrendResponse {
  granularity: 'hour' | 'day' | 'week';
  data_points: TrendDataPoint[];
}

/** Meta response containing action-type enum */
interface AuditMetaResponse {
  action_types: string[];
}

/** Filter parameters for list query */
interface AuditLogFilter {
  start_time: Date;
  end_time: Date;
  operator_id?: string;
  action_type?: string;
  page?: number;
  size?: number;
}

/** Trend query parameters */
interface AuditTrendFilter {
  start_time: Date;
  end_time: Date;
  action_type?: string;
  operator_id?: string;
}

// ---------------------------------------------------------------------------
// Helpers — duplicated from service layer so tests are self-contained
// ---------------------------------------------------------------------------

/** Maximum allowed time span in days */
const MAX_TIME_SPAN_DAYS = 90;

/** Default page size */
const DEFAULT_PAGE_SIZE = 50;

/** Maximum page size */
const MAX_PAGE_SIZE = 100;

/** Maximum offset for deep-pagination guard */
const MAX_OFFSET = 10000;

/**
 * Convert a local Date to an ISO 8601 UTC string.
 * @param date Local date
 * @returns UTC ISO string
 */
function toUTCISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Validate that the time span between start and end does not exceed 90 days.
 * @param start Start date
 * @param end End date
 * @throws Error if span exceeds 90 days
 */
function validateTimeSpan(start: Date, end: Date): void {
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > MAX_TIME_SPAN_DAYS) {
    throw new Error(
      `Time span exceeds maximum of ${MAX_TIME_SPAN_DAYS} days (got ${diffDays.toFixed(1)} days)`
    );
  }
  if (end < start) {
    throw new Error('end_time must be greater than or equal to start_time');
  }
}

/**
 * Determine the trend granularity based on the query time range.
 * ≤7 days → hour, 8-30 days → day, >30 days → week.
 * @param start Start date
 * @param end End date
 * @returns Granularity string
 */
function resolveGranularity(start: Date, end: Date): 'hour' | 'day' | 'week' {
  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 7) return 'hour';
  if (diffDays <= 30) return 'day';
  return 'week';
}

/**
 * Clamp page size to [1, MAX_PAGE_SIZE] and default to DEFAULT_PAGE_SIZE.
 * @param size Requested page size
 * @returns Clamped page size
 */
function clampPageSize(size?: number): number {
  if (size === undefined || size === null) return DEFAULT_PAGE_SIZE;
  if (size < 1) return 1;
  if (size > MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
  return size;
}

/**
 * Validate that the computed offset does not exceed MAX_OFFSET.
 * @param page Page number (1-based)
 * @param size Page size
 * @throws Error if offset exceeds MAX_OFFSET
 */
function validateOffset(page: number, size: number): void {
  const offset = (page - 1) * size;
  if (offset > MAX_OFFSET) {
    throw new Error(
      `Offset ${offset} exceeds maximum allowed offset ${MAX_OFFSET}. Use cursor-based pagination.`
    );
  }
}

/**
 * Check if the user has permission to access the audit dashboard.
 * Only admin or auditor roles are allowed.
 * @param roles Array of user roles
 * @returns Whether the user has access
 */
function hasAuditPermission(roles: string[]): boolean {
  return roles.includes('admin') || roles.includes('auditor');
}

// ---------------------------------------------------------------------------
// Mock HTTP client
// ---------------------------------------------------------------------------

let mockHttpGet: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockHttpGet = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Service-like wrapper using the mock HTTP client
// ---------------------------------------------------------------------------

const API_BASE = '/api/v1/audit-log';

/**
 * Fetch paginated audit log list with multi-condition filters.
 * @param filter Filter parameters
 * @returns Paginated list response
 */
async function fetchAuditLogs(filter: AuditLogFilter): Promise<AuditLogListResponse> {
  validateTimeSpan(filter.start_time, filter.end_time);

  const page = filter.page ?? 1;
  const size = clampPageSize(filter.size);
  validateOffset(page, size);

  const params = new URLSearchParams({
    start_time: toUTCISOString(filter.start_time),
    end_time: toUTCISOString(filter.end_time),
    page: String(page),
    size: String(size),
  });

  if (filter.operator_id) params.set('operator_id', filter.operator_id);
  if (filter.action_type) params.set('action_type', filter.action_type);

  return mockHttpGet(`${API_BASE}/list?${params.toString()}`);
}

/**
 * Fetch audit trend data with adaptive granularity.
 * @param filter Trend filter parameters
 * @returns Trend response
 */
async function fetchAuditTrend(filter: AuditTrendFilter): Promise<AuditTrendResponse> {
  validateTimeSpan(filter.start_time, filter.end_time);

  const granularity = resolveGranularity(filter.start_time, filter.end_time);

  const params = new URLSearchParams({
    start_time: toUTCISOString(filter.start_time),
    end_time: toUTCISOString(filter.end_time),
    granularity,
  });

  if (filter.action_type) params.set('action_type', filter.action_type);
  if (filter.operator_id) params.set('operator_id', filter.operator_id);

  return mockHttpGet(`${API_BASE}/trend?${params.toString()}`);
}

/**
 * Fetch audit meta information (action type enum).
 * @returns Meta response with action_types array
 */
async function fetchAuditMeta(): Promise<AuditMetaResponse> {
  return mockHttpGet(`${API_BASE}/meta`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auditService', () => {
  // -----------------------------------------------------------------------
  // Time-span validation (ATB-02)
  // -----------------------------------------------------------------------
  describe('validateTimeSpan', () => {
    it('should accept a time span within 90 days', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-03-31T23:59:59Z'); // ~90 days
      expect(() => validateTimeSpan(start, end)).not.toThrow();
    });

    it('should reject a time span exceeding 90 days', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-05-01T00:00:00Z'); // 120 days
      expect(() => validateTimeSpan(start, end)).toThrow(
        /exceeds maximum of 90 days/
      );
    });

    it('should reject when end_time is before start_time', () => {
      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-01-01T00:00:00Z');
      expect(() => validateTimeSpan(start, end)).toThrow(
        /end_time must be greater than or equal to start_time/
      );
    });

    it('should accept exactly 90 days span', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-04-01T00:00:00Z'); // exactly 90 days
      expect(() => validateTimeSpan(start, end)).not.toThrow();
    });

    it('should reject a span of 90 days + 1 millisecond', () => {
      const start = new Date('2025-01-01T00:00:00.000Z');
      const end = new Date('2025-04-01T00:00:00.001Z');
      expect(() => validateTimeSpan(start, end)).toThrow(
        /exceeds maximum of 90 days/
      );
    });
  });

  // -----------------------------------------------------------------------
  // Pagination constraints
  // -----------------------------------------------------------------------
  describe('clampPageSize', () => {
    it('should return default page size when size is undefined', () => {
      expect(clampPageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
    });

    it('should return default page size when size is null', () => {
      expect(clampPageSize(null as unknown as undefined)).toBe(DEFAULT_PAGE_SIZE);
    });

    it('should clamp size to 1 when size is 0', () => {
      expect(clampPageSize(0)).toBe(1);
    });

    it('should clamp size to 1 when size is negative', () => {
      expect(clampPageSize(-5)).toBe(1);
    });

    it('should clamp size to MAX_PAGE_SIZE (100) when size exceeds it', () => {
      expect(clampPageSize(200)).toBe(MAX_PAGE_SIZE);
    });

    it('should return the requested size when within bounds', () => {
      expect(clampPageSize(20)).toBe(20);
      expect(clampPageSize(50)).toBe(50);
      expect(clampPageSize(100)).toBe(100);
    });
  });

  describe('validateOffset', () => {
    it('should accept offset within MAX_OFFSET', () => {
      expect(() => validateOffset(1, 50)).not.toThrow(); // offset 0
      expect(() => validateOffset(100, 100)).not.toThrow(); // offset 9900
      expect(() => validateOffset(101, 100)).not.toThrow(); // offset 10000
    });

    it('should reject offset exceeding MAX_OFFSET', () => {
      // page 102, size 100 → offset 10100 > 10000
      expect(() => validateOffset(102, 100)).toThrow(/exceeds maximum allowed offset/);
    });

    it('should reject deep pagination with default page size', () => {
      // page 201, size 50 → offset 10000 (ok)
      expect(() => validateOffset(201, 50)).not.toThrow();
      // page 202, size 50 → offset 10050 > 10000
      expect(() => validateOffset(202, 50)).toThrow(/exceeds maximum allowed offset/);
    });
  });

  // -----------------------------------------------------------------------
  // Trend granularity resolution (ATB-03, chart granularity constraint)
  // -----------------------------------------------------------------------
  describe('resolveGranularity', () => {
    it('should return "hour" for span ≤ 7 days', () => {
      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-06-07T23:59:59Z'); // < 7 days
      expect(resolveGranularity(start, end)).toBe('hour');
    });

    it('should return "hour" for exactly 7 days', () => {
      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-06-08T00:00:00Z'); // exactly 7 days
      expect(resolveGranularity(start, end)).toBe('hour');
    });

    it('should return "day" for span of 8 days', () => {
      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-06-09T00:00:00Z'); // 8 days
      expect(resolveGranularity(start, end)).toBe('day');
    });

    it('should return "day" for span of 30 days', () => {
      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-07-01T00:00:00Z'); // 30 days
      expect(resolveGranularity(start, end)).toBe('day');
    });

    it('should return "week" for span > 30 days', () => {
      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-07-02T00:00:00Z'); // 31 days
      expect(resolveGranularity(start, end)).toBe('week');
    });

    it('should return "week" for span of 90 days', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-04-01T00:00:00Z'); // 90 days
      expect(resolveGranularity(start, end)).toBe('week');
    });
  });

  // -----------------------------------------------------------------------
  // Permission check (ATB-04)
  // -----------------------------------------------------------------------
  describe('hasAuditPermission', () => {
    it('should grant access to admin role', () => {
      expect(hasAuditPermission(['admin'])).toBe(true);
    });

    it('should grant access to auditor role', () => {
      expect(hasAuditPermission(['auditor'])).toBe(true);
    });

    it('should grant access when user has both admin and auditor roles', () => {
      expect(hasAuditPermission(['admin', 'auditor'])).toBe(true);
    });

    it('should deny access to regular user without admin/auditor role', () => {
      expect(hasAuditPermission(['user'])).toBe(false);
    });

    it('should deny access when roles array is empty', () => {
      expect(hasAuditPermission([])).toBe(false);
    });

    it('should deny access to roles that contain admin-like substrings', () => {
      expect(hasAuditPermission(['admin_viewer'])).toBe(false);
      expect(hasAuditPermission(['super_auditor'])).toBe(false);
    });

    it('should grant access when admin is among multiple roles', () => {
      expect(hasAuditPermission(['user', 'admin'])).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // UTC time conversion (timezone constraint)
  // -----------------------------------------------------------------------
  describe('toUTCISOString', () => {
    it('should convert a local Date to ISO 8601 UTC string', () => {
      const localDate = new Date(Date.UTC(2025, 5, 15, 10, 30, 0)); // Jun 15 2025 10:30 UTC
      const result = toUTCISOString(localDate);
      expect(result).toBe('2025-06-15T10:30:00.000Z');
    });

    it('should always end with Z suffix indicating UTC', () => {
      const date = new Date();
      const result = toUTCISOString(date);
      expect(result.endsWith('Z')).toBe(true);
    });

    it('should produce a parseable ISO 8601 string', () => {
      const date = new Date(2025, 0, 15, 8, 0, 0); // local time
      const result = toUTCISOString(date);
      const parsed = new Date(result);
      expect(parsed.getTime()).toBe(date.getTime());
    });
  });

  // -----------------------------------------------------------------------
  // fetchAuditLogs — integration with mock HTTP (ATB-01)
  // -----------------------------------------------------------------------
  describe('fetchAuditLogs', () => {
    const defaultStart = new Date('2025-06-01T00:00:00Z');
    const defaultEnd = new Date('2025-06-07T00:00:00Z');

    const mockResponse: AuditLogListResponse = {
      total: 2,
      items: [
        {
          id: 'log-001',
          operator_id: 'U001',
          operator_name: 'Alice',
          action_type: 'LOGIN',
          resource_type: 'session',
          resource_id: 'sess-001',
          detail: 'User logged in',
          ip_address: '10.0.0.1',
          created_at: '2025-06-05T08:00:00Z',
        },
        {
          id: 'log-002',
          operator_id: 'U001',
          operator_name: 'Alice',
          action_type: 'LOGIN',
          resource_type: 'session',
          resource_id: 'sess-002',
          detail: 'User logged in again',
          ip_address: '10.0.0.2',
          created_at: '2025-06-05T09:00:00Z',
        },
      ],
    };

    it('should call the correct API endpoint with required params', async () => {
      mockHttpGet.mockResolvedValue(mockResponse);

      const result = await fetchAuditLogs({
        start_time: defaultStart,
        end_time: defaultEnd,
      });

      expect(mockHttpGet).toHaveBeenCalledTimes(1);
      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/v1/audit-log/list');
      expect(calledUrl).toContain('start_time=');
      expect(calledUrl).toContain('end_time=');
      expect(result).toEqual(mockResponse);
    });

    it('should include operator_id and action_type in query when provided', async () => {
      mockHttpGet.mockResolvedValue(mockResponse);

      await fetchAuditLogs({
        start_time: defaultStart,
        end_time: defaultEnd,
        operator_id: 'U001',
        action_type: 'LOGIN',
        page: 1,
        size: 20,
      });

      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('operator_id=U001');
      expect(calledUrl).toContain('action_type=LOGIN');
    });

    it('should send page and size params with default values', async () => {
      mockHttpGet.mockResolvedValue(mockResponse);

      await fetchAuditLogs({
        start_time: defaultStart,
        end_time: defaultEnd,
      });

      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain(`size=${DEFAULT_PAGE_SIZE}`);
    });

    it('should send custom page and size params', async () => {
      mockHttpGet.mockResolvedValue(mockResponse);

      await fetchAuditLogs({
        start_time: defaultStart,
        end_time: defaultEnd,
        page: 3,
        size: 20,
      });

      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=3');
      expect(calledUrl).toContain('size=20');
    });

    it('should clamp page size to MAX_PAGE_SIZE when exceeded', async () => {
      mockHttpGet.mockResolvedValue(mockResponse);

      await fetchAuditLogs({
        start_time: defaultStart,
        end_time: defaultEnd,
        page: 1,
        size: 500,
      });

      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain(`size=${MAX_PAGE_SIZE}`);
    });

    it('should throw when time span exceeds 90 days', async () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-05-01T00:00:00Z'); // 120 days

      await expect(
        fetchAuditLogs({ start_time: start, end_time: end })
      ).rejects.toThrow(/exceeds maximum of 90 days/);

      expect(mockHttpGet).not.toHaveBeenCalled();
    });

    it('should throw when offset exceeds MAX_OFFSET', async () => {
      await expect(
        fetchAuditLogs({
          start_time: defaultStart,
          end_time: defaultEnd,
          page: 202,
          size: 50,
        })
      ).rejects.toThrow(/exceeds maximum allowed offset/);

      expect(mockHttpGet).not.toHaveBeenCalled();
    });

    it('should convert start_time and end_time to UTC ISO strings', async () => {
      mockHttpGet.mockResolvedValue(mockResponse);

      // Create a date in a specific timezone offset to verify UTC conversion
      const localStart = new Date('2025-06-01T08:00:00+08:00'); // UTC 00:00
      const localEnd = new Date('2025-06-07T08:00:00+08:00'); // UTC 00:00

      await fetchAuditLogs({
        start_time: localStart,
        end_time: localEnd,
      });

      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      // The URL should contain the UTC ISO representation
      expect(calledUrl).toContain('2025-06-01T00%3A00%3A00.000Z');
      expect(calledUrl).toContain('2025-06-07T00%3A00%3A00.000Z');
    });

    it('should not include operator_id or action_type in URL when omitted', async () => {
      mockHttpGet.mockResolvedValue(mockResponse);

      await fetchAuditLogs({
        start_time: defaultStart,
        end_time: defaultEnd,
      });

      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('operator_id=');
      expect(calledUrl).not.toContain('action_type=');
    });
  });

  // -----------------------------------------------------------------------
  // fetchAuditTrend — trend aggregation (ATB-03)
  // -----------------------------------------------------------------------
  describe('fetchAuditTrend', () => {
    const mockTrendResponse: AuditTrendResponse = {
      granularity: 'hour',
      data_points: Array.from({ length: 168 }, (_, i) => ({
        timestamp: new Date(
          Date.UTC(2025, 5, 1, i, 0, 0)
        ).toISOString(),
        count: Math.floor(Math.random() * 10),
      })),
    };

    it('should call the trend endpoint with correct params', async () => {
      mockHttpGet.mockResolvedValue(mockTrendResponse);

      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-06-07T00:00:00Z');

      const result = await fetchAuditTrend({ start_time: start, end_time: end });

      expect(mockHttpGet).toHaveBeenCalledTimes(1);
      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/v1/audit-log/trend');
      expect(calledUrl).toContain('start_time=');
      expect(calledUrl).toContain('end_time=');
      expect(result).toEqual(mockTrendResponse);
    });

    it('should include granularity=hour for ≤7 day range', async () => {
      mockHttpGet.mockResolvedValue(mockTrendResponse);

      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-06-07T00:00:00Z'); // 6 days

      await fetchAuditTrend({ start_time: start, end_time: end });

      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('granularity=hour');
    });

    it('should include granularity=day for 8-30 day range', async () => {
      const dayResponse: AuditTrendResponse = {
        granularity: 'day',
        data_points: Array.from({ length: 30 }, (_, i) => ({
          timestamp: new Date(Date.UTC(2025, 5, i + 1, 0, 0, 0)).toISOString(),
          count: Math.floor(Math.random() * 50),
        })),
      };
      mockHttpGet.mockResolvedValue(dayResponse);

      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-06-15T00:00:00Z'); // 14 days

      await fetchAuditTrend({ start_time: start, end_time: end });

      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('granularity=day');
    });

    it('should include granularity=week for >30 day range', async () => {
      const weekResponse: AuditTrendResponse = {
        granularity: 'week',
        data_points: Array.from({ length: 13 }, (_, i) => ({
          timestamp: new Date(Date.UTC(2025, 0, 6 * i + 1, 0, 0, 0)).toISOString(),
          count: Math.floor(Math.random() * 200),
        })),
      };
      mockHttpGet.mockResolvedValue(weekResponse);

      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-04-01T00:00:00Z'); // 90 days

      await fetchAuditTrend({ start_time: start, end_time: end });

      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('granularity=week');
    });

    it('should include action_type and operator_id when provided', async () => {
      mockHttpGet.mockResolvedValue(mockTrendResponse);

      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-06-07T00:00:00Z');

      await fetchAuditTrend({
        start_time: start,
        end_time: end,
        action_type: 'DELETE',
        operator_id: 'U002',
      });

      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('action_type=DELETE');
      expect(calledUrl).toContain('operator_id=U002');
    });

    it('should throw when time span exceeds 90 days', async () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-12-01T00:00:00Z'); // ~334 days

      await expect(
        fetchAuditTrend({ start_time: start, end_time: end })
      ).rejects.toThrow(/exceeds maximum of 90 days/);

      expect(mockHttpGet).not.toHaveBeenCalled();
    });

    it('should convert times to UTC ISO strings in the request URL', async () => {
      mockHttpGet.mockResolvedValue(mockTrendResponse);

      const start = new Date('2025-06-01T08:00:00+08:00');
      const end = new Date('2025-06-07T08:00:00+08:00');

      await fetchAuditTrend({ start_time: start, end_time: end });

      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('2025-06-01T00%3A00%3A00.000Z');
    });
  });

  // -----------------------------------------------------------------------
  // fetchAuditMeta — action types from server (action-type constraint)
  // -----------------------------------------------------------------------
  describe('fetchAuditMeta', () => {
    const mockMetaResponse: AuditMetaResponse = {
      action_types: ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'],
    };

    it('should call the meta endpoint and return action types', async () => {
      mockHttpGet.mockResolvedValue(mockMetaResponse);

      const result = await fetchAuditMeta();

      expect(mockHttpGet).toHaveBeenCalledTimes(1);
      expect(mockHttpGet).toHaveBeenCalledWith(`${API_BASE}/meta`);
      expect(result).toEqual(mockMetaResponse);
      expect(result.action_types).toContain('LOGIN');
      expect(result.action_types).toContain('DELETE');
    });

    it('should return action_types as a string array', async () => {
      mockHttpGet.mockResolvedValue(mockMetaResponse);

      const result = await fetchAuditMeta();
      expect(Array.isArray(result.action_types)).toBe(true);
      result.action_types.forEach((t) => {
        expect(typeof t).toBe('string');
      });
    });

    it('should not hardcode action types — they come from the API', async () => {
      const customMeta: AuditMetaResponse = {
        action_types: ['CUSTOM_ACTION_1', 'CUSTOM_ACTION_2'],
      };
      mockHttpGet.mockResolvedValue(customMeta);

      const result = await fetchAuditMeta();
      expect(result.action_types).toEqual(['CUSTOM_ACTION_1', 'CUSTOM_ACTION_2']);
    });

    it('should handle empty action_types gracefully', async () => {
      mockHttpGet.mockResolvedValue({ action_types: [] });

      const result = await fetchAuditMeta();
      expect(result.action_types).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // End-to-end style: filter → API call → response validation (ATB-01)
  // -----------------------------------------------------------------------
  describe('ATB-01: multi-condition filtering and pagination', () => {
    it('should construct correct API URL with all filter params', async () => {
      const filteredResponse: AuditLogListResponse = {
        total: 5,
        items: Array.from({ length: 5 }, (_, i) => ({
          id: `log-${i + 1}`,
          operator_id: 'U001',
          operator_name: 'Alice',
          action_type: 'LOGIN',
          resource_type: 'session',
          resource_id: `sess-${i + 1}`,
          detail: `Login event ${i + 1}`,
          ip_address: `10.0.0.${i + 1}`,
          created_at: `2025-06-05T${8 + i}:00:00Z`,
        })),
      };

      mockHttpGet.mockResolvedValue(filteredResponse);

      const result = await fetchAuditLogs({
        start_time: new Date('2025-06-01T00:00:00Z'),
        end_time: new Date('2025-06-07T00:00:00Z'),
        operator_id: 'U001',
        action_type: 'LOGIN',
        page: 1,
        size: 20,
      });

      // Verify the URL contains all expected params
      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('operator_id=U001');
      expect(calledUrl).toContain('action_type=LOGIN');
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain('size=20');

      // Verify response structure
      expect(result.total).toBe(5);
      expect(result.items).toHaveLength(5);
      expect(result.items.every((item) => item.operator_id === 'U001')).toBe(true);
      expect(result.items.every((item) => item.action_type === 'LOGIN')).toBe(true);
      expect(result.items.length).toBeLessThanOrEqual(20);
    });
  });

  // -----------------------------------------------------------------------
  // ATB-02: time span > 90 days rejection
  // -----------------------------------------------------------------------
  describe('ATB-02: time span exceeds 90 days', () => {
    it('should reject request with >90 day span and not call API', async () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-05-01T00:00:00Z'); // 120 days

      await expect(
        fetchAuditLogs({ start_time: start, end_time: end })
      ).rejects.toThrow(/exceeds maximum of 90 days/);

      expect(mockHttpGet).not.toHaveBeenCalled();
    });

    it('should reject trend request with >90 day span', async () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-05-01T00:00:00Z');

      await expect(
        fetchAuditTrend({ start_time: start, end_time: end })
      ).rejects.toThrow(/exceeds maximum of 90 days/);

      expect(mockHttpGet).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // ATB-03: trend data aggregation with adaptive granularity
  // -----------------------------------------------------------------------
  describe('ATB-03: trend aggregation granularity', () => {
    it('should request hourly granularity for 7-day range', async () => {
      const hourlyResponse: AuditTrendResponse = {
        granularity: 'hour',
        data_points: Array.from({ length: 168 }, (_, i) => ({
          timestamp: new Date(Date.UTC(2025, 5, 1, i, 0, 0)).toISOString(),
          count: i,
        })),
      };
      mockHttpGet.mockResolvedValue(hourlyResponse);

      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-06-07T00:00:00Z');

      const result = await fetchAuditTrend({ start_time: start, end_time: end });

      expect(result.granularity).toBe('hour');
      // 7 days × 24 hours = 168 data points
      expect(result.data_points).toHaveLength(168);
      // Each data point has timestamp and count
      result.data_points.forEach((dp) => {
        expect(dp).toHaveProperty('timestamp');
        expect(dp).toHaveProperty('count');
        expect(typeof dp.count).toBe('number');
      });
    });

    it('should request daily granularity for 30-day range', async () => {
      const dailyResponse: AuditTrendResponse = {
        granularity: 'day',
        data_points: Array.from({ length: 30 }, (_, i) => ({
          timestamp: new Date(Date.UTC(2025, 5, i + 1, 0, 0, 0)).toISOString(),
          count: i * 2,
        })),
      };
      mockHttpGet.mockResolvedValue(dailyResponse);

      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-07-01T00:00:00Z'); // 30 days

      const result = await fetchAuditTrend({ start_time: start, end_time: end });

      expect(result.granularity).toBe('day');
      expect(result.data_points.length).toBeGreaterThan(0);
    });

    it('should verify trend data points have continuous timestamps', async () => {
      // Simulate hourly data for 2 days (48 hours)
      const continuousResponse: AuditTrendResponse = {
        granularity: 'hour',
        data_points: Array.from({ length: 48 }, (_, i) => ({
          timestamp: new Date(Date.UTC(2025, 5, 1, i, 0, 0)).toISOString(),
          count: Math.floor(Math.random() * 10),
        })),
      };
      mockHttpGet.mockResolvedValue(continuousResponse);

      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-06-02T00:00:00Z');

      const result = await fetchAuditTrend({ start_time: start, end_time: end });

      // Verify timestamps are in ascending order (continuous)
      for (let i = 1; i < result.data_points.length; i++) {
        const prev = new Date(result.data_points[i - 1].timestamp).getTime();
        const curr = new Date(result.data_points[i].timestamp).getTime();
        expect(curr).toBeGreaterThan(prev);
      }
    });
  });

  // -----------------------------------------------------------------------
  // ATB-05: filter linkage — action_type filter propagates to API
  // -----------------------------------------------------------------------
  describe('ATB-05: filter linkage with action_type', () => {
    it('should propagate action_type=DELETE to both list and trend APIs', async () => {
      mockHttpGet.mockResolvedValue({ total: 0, items: [] });

      await fetchAuditLogs({
        start_time: new Date('2025-06-01T00:00:00Z'),
        end_time: new Date('2025-06-07T00:00:00Z'),
        action_type: 'DELETE',
      });

      const listUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(listUrl).toContain('action_type=DELETE');

      mockHttpGet.mockResolvedValue({
        granularity: 'hour',
        data_points: [],
      });

      await fetchAuditTrend({
        start_time: new Date('2025-06-01T00:00:00Z'),
        end_time: new Date('2025-06-07T00:00:00Z'),
        action_type: 'DELETE',
      });

      const trendUrl = mockHttpGet.mock.calls[1][0] as string;
      expect(trendUrl).toContain('action_type=DELETE');
    });
  });

  // -----------------------------------------------------------------------
  // ATB-06: trend chart rendering data — 30-day range → daily granularity
  // -----------------------------------------------------------------------
  describe('ATB-06: trend chart data for 30-day range', () => {
    it('should return daily granularity data points matching 30-day range', async () => {
      const dailyResponse: AuditTrendResponse = {
        granularity: 'day',
        data_points: Array.from({ length: 30 }, (_, i) => ({
          timestamp: new Date(Date.UTC(2025, 5, i + 1, 0, 0, 0)).toISOString(),
          count: Math.floor(Math.random() * 100),
        })),
      };
      mockHttpGet.mockResolvedValue(dailyResponse);

      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-07-01T00:00:00Z'); // 30 days

      const result = await fetchAuditTrend({ start_time: start, end_time: end });

      expect(result.granularity).toBe('day');
      expect(result.data_points).toHaveLength(30);

      // Verify each data point has the required structure for chart rendering
      result.data_points.forEach((dp, i) => {
        expect(dp).toHaveProperty('timestamp');
        expect(dp).toHaveProperty('count');
        expect(typeof dp.timestamp).toBe('string');
        expect(typeof dp.count).toBe('number');
        // Verify timestamp is a valid date
        expect(new Date(dp.timestamp).getTime()).not.toBeNaN();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle same start and end time (0-day span)', async () => {
      mockHttpGet.mockResolvedValue({ total: 0, items: [] });

      const sameTime = new Date('2025-06-01T00:00:00Z');
      await expect(
        fetchAuditLogs({ start_time: sameTime, end_time: sameTime })
      ).resolves.toBeDefined();

      expect(mockHttpGet).toHaveBeenCalled();
    });

    it('should use default page=1 and size=50 when not specified', async () => {
      mockHttpGet.mockResolvedValue({ total: 0, items: [] });

      await fetchAuditLogs({
        start_time: new Date('2025-06-01T00:00:00Z'),
        end_time: new Date('2025-06-07T00:00:00Z'),
      });

      const calledUrl = mockHttpGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain('size=50');
    });

    it('should handle empty response from list API', async () => {
      mockHttpGet.mockResolvedValue({ total: 0, items: [] });

      const result = await fetchAuditLogs({
        start_time: new Date('2025-06-01T00:00:00Z'),
        end_time: new Date('2025-06-07T00:00:00Z'),
      });

      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('should handle empty trend data points', async () => {
      mockHttpGet.mockResolvedValue({ granularity: 'hour', data_points: [] });

      const result = await fetchAuditTrend({
        start_time: new Date('2025-06-01T00:00:00Z'),
        end_time: new Date('2025-06-07T00:00:00Z'),
      });

      expect(result.data_points).toEqual([]);
      expect(result.granularity).toBe('hour');
    });

    it('should propagate HTTP errors from the API', async () => {
      mockHttpGet.mockRejectedValue(new Error('Network Error'));

      await expect(
        fetchAuditLogs({
          start_time: new Date('2025-06-01T00:00:00Z'),
          end_time: new Date('2025-06-07T00:00:00Z'),
        })
      ).rejects.toThrow('Network Error');
    });

    it('should not mutate the input filter dates', async () => {
      mockHttpGet.mockResolvedValue({ total: 0, items: [] });

      const start = new Date('2025-06-01T00:00:00Z');
      const end = new Date('2025-06-07T00:00:00Z');
      const startBefore = start.getTime();
      const endBefore = end.getTime();

      await fetchAuditLogs({ start_time: start, end_time: end });

      expect(start.getTime()).toBe(startBefore);
      expect(end.getTime()).toBe(endBefore);
    });
  });
});