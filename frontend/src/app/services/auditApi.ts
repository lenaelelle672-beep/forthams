/**
 * @module auditApi
 * @description Audit Log API Service for the operation log dashboard.
 * Provides API methods for querying audit logs, trend aggregation,
 * and metadata retrieval with proper time zone handling and constraint validation.
 *
 * Key constraints enforced:
 * - Time range: max 90 days per query (ATB-02)
 * - Pagination: max 100 items per page (default 50), offset max 10000
 * - Time format: all API interactions use UTC ISO 8601 (boundary constraint #4)
 * - Permission: requires admin or auditor role (enforced server-side, boundary constraint #3)
 * - Operation types: dynamically loaded from backend, never hardcoded (boundary constraint #6)
 * - Trend granularity: auto-determined by time range (boundary constraint #5)
 */

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

/**
 * Represents a single audit log record returned by the list API.
 */
export interface AuditLogItem {
  /** Unique identifier of the audit log entry */
  id: string;
  /** ID of the user who performed the operation */
  operator_id: string;
  /** Display name of the operator */
  operator_name: string;
  /** Type of action performed (e.g. LOGIN, CREATE, UPDATE, DELETE) */
  action_type: string;
  /** Type of resource affected */
  resource_type: string;
  /** ID of the affected resource */
  resource_id: string;
  /** Human-readable description of the operation */
  detail: string;
  /** IP address from which the operation originated */
  ip_address: string;
  /** Timestamp of the operation in UTC ISO 8601 format */
  created_at: string;
}

/**
 * Request parameters for the audit log list query.
 * Supports multi-dimensional dynamic filtering with pagination.
 */
export interface AuditLogListRequest {
  /** Start of the time range (local Date or ISO string). Required. */
  start_time: Date | string;
  /** End of the time range (local Date or ISO string). Required. */
  end_time: Date | string;
  /** Filter by operator user ID. Optional. */
  operator_id?: string;
  /** Filter by action type. Optional. Must be one of the values from /audit-log/meta. */
  action_type?: string;
  /** Page number (1-based). Defaults to 1. */
  page?: number;
  /** Page size. Defaults to 50, max 100. */
  size?: number;
}

/**
 * Paginated response for the audit log list query.
 */
export interface AuditLogListResponse {
  /** Total number of matching records */
  total: number;
  /** Array of audit log items for the current page */
  items: AuditLogItem[];
  /** Current page number */
  page: number;
  /** Current page size */
  size: number;
}

/**
 * A single data point in the trend aggregation response.
 */
export interface TrendDataPoint {
  /** Timestamp of the aggregation bucket in UTC ISO 8601 format */
  timestamp: string;
  /** Count of operations in this time bucket */
  count: number;
}

/**
 * Supported trend aggregation granularities.
 * Auto-determined based on query time range per boundary constraint #5:
 * - ≤7 days → 'hour'
 * - 8–30 days → 'day'
 * - >30 days → 'week'
 */
export type TrendGranularity = 'hour' | 'day' | 'week';

/**
 * Request parameters for the audit log trend aggregation query.
 */
export interface AuditLogTrendRequest {
  /** Start of the time range (local Date or ISO string). Required. */
  start_time: Date | string;
  /** End of the time range (local Date or ISO string). Required. */
  end_time: Date | string;
  /** Filter by operator user ID. Optional. */
  operator_id?: string;
  /** Filter by action type. Optional. */
  action_type?: string;
  /** Aggregation granularity. If omitted, auto-determined from time range. */
  granularity?: TrendGranularity;
}

/**
 * Response for the audit log trend aggregation query.
 */
export interface AuditLogTrendResponse {
  /** The granularity used for aggregation */
  granularity: TrendGranularity;
  /** Array of time-bucketed data points (continuous, no gaps) */
  data_points: TrendDataPoint[];
}

/**
 * Response for the audit log metadata endpoint.
 * Provides dynamic enumerations for filter dropdowns.
 * Frontend must NOT hardcode operation types (boundary constraint #6).
 */
export interface AuditLogMetaResponse {
  /** Available action type values for the filter dropdown */
  action_types: string[];
}

/**
 * Structured error thrown by audit API methods.
 */
export class AuditApiError extends Error {
  /** HTTP status code from the response */
  public readonly status: number;
  /** Machine-readable error code from the response body */
  public readonly code: string;

  /**
   * Construct an AuditApiError.
   * @param message - Human-readable error description
   * @param status - HTTP status code
   * @param code - Machine-readable error code
   */
  constructor(message: string, status: number, code: string = 'UNKNOWN') {
    super(message);
    this.name = 'AuditApiError';
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed time span in days for a single query (boundary constraint #1) */
const MAX_TIME_SPAN_DAYS = 90;

/** Default page size for list queries */
const DEFAULT_PAGE_SIZE = 50;

/** Maximum page size for list queries (boundary constraint #2) */
const MAX_PAGE_SIZE = 100;

/** Maximum pagination offset to prevent deep pagination (boundary constraint #2) */
const MAX_OFFSET = 10000;

/** Base URL for audit log API endpoints */
const API_BASE = '/audit-logs';

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Convert a local Date or date string to a UTC ISO 8601 string.
 * Ensures all API interactions use UTC format per boundary constraint #4.
 *
 * @param date - A Date object or ISO date string in local/UTC format
 * @returns ISO 8601 UTC string (e.g. "2025-01-15T08:30:00.000Z")
 */
export function toUTCISOString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    throw new AuditApiError(
      'Invalid date: unable to convert to UTC ISO string',
      400,
      'INVALID_DATE'
    );
  }
  return d.toISOString();
}

/**
 * Validate that the time range does not exceed the maximum allowed span.
 * Enforces the 90-day limit per boundary constraint #1 and ATB-02.
 *
 * @param startTime - Start of the time range
 * @param endTime - End of the time range
 * @throws {AuditApiError} If the time span exceeds 90 days or start > end
 */
export function validateTimeSpan(startTime: Date | string, endTime: Date | string): void {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AuditApiError(
      'Invalid date: start_time or end_time is not a valid date',
      400,
      'INVALID_DATE'
    );
  }

  if (start > end) {
    throw new AuditApiError(
      'Invalid time range: start_time must be before end_time',
      400,
      'INVALID_TIME_RANGE'
    );
  }

  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > MAX_TIME_SPAN_DAYS) {
    throw new AuditApiError(
      `Time span exceeds maximum of ${MAX_TIME_SPAN_DAYS} days. Requested span: ${Math.ceil(diffDays)} days.`,
      400,
      'TIME_SPAN_EXCEEDED'
    );
  }
}

/**
 * Determine the appropriate trend granularity based on the query time range.
 * Implements the adaptive granularity logic per boundary constraint #5:
 * - ≤7 days → hourly aggregation
 * - 8–30 days → daily aggregation
 * - >30 days → weekly aggregation
 *
 * @param startTime - Start of the time range
 * @param endTime - End of the time range
 * @returns The appropriate TrendGranularity for the given range
 */
export function determineTrendGranularity(
  startTime: Date | string,
  endTime: Date | string
): TrendGranularity {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;

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
 * Validate and normalize pagination parameters.
 * Enforces page size limits and deep-pagination offset constraint
 * per boundary constraint #2.
 *
 * @param page - Requested page number (1-based). Defaults to 1.
 * @param size - Requested page size. Defaults to 50, max 100.
 * @returns Normalized pagination parameters
 * @throws {AuditApiError} If the computed offset exceeds 10000
 */
export function validatePagination(
  page?: number,
  size?: number
): { page: number; size: number } {
  const normalizedPage = Math.max(1, Math.floor(page ?? 1));
  const normalizedSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(size ?? DEFAULT_PAGE_SIZE))
  );

  const offset = (normalizedPage - 1) * normalizedSize;
  if (offset > MAX_OFFSET) {
    throw new AuditApiError(
      `Pagination offset ${offset} exceeds maximum allowed value of ${MAX_OFFSET}. ` +
        'Please use cursor-based pagination or narrow your filters for deep queries.',
      400,
      'OFFSET_EXCEEDED'
    );
  }

  return { page: normalizedPage, size: normalizedSize };
}

// ---------------------------------------------------------------------------
// Internal HTTP Helper
// ---------------------------------------------------------------------------

/**
 * Perform an authenticated GET request to the audit log API.
 * Automatically includes credentials and Content-Type headers.
 *
 * @param path - API endpoint path relative to API_BASE
 * @param params - Query parameters to append to the URL
 * @returns Parsed JSON response
 * @throws {AuditApiError} On non-2xx responses with structured error info
 */
async function apiGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const queryString = new URLSearchParams(params).toString();
  const url = `${API_BASE}${path}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorCode = `HTTP_${response.status}`;

    try {
      const errorBody = await response.json();
      if (errorBody.message) {
        errorMessage = errorBody.message;
      }
      if (errorBody.code) {
        errorCode = errorBody.code;
      }
    } catch {
      // Response body is not JSON; use default error message
    }

    if (response.status === 400) {
      errorCode = errorCode || 'BAD_REQUEST';
    } else if (response.status === 403) {
      errorMessage =
        'Forbidden: insufficient permissions. Admin or auditor role required.';
      errorCode = 'FORBIDDEN';
    } else if (response.status === 401) {
      errorMessage = 'Unauthorized: please log in to access audit logs.';
      errorCode = 'UNAUTHORIZED';
    }

    throw new AuditApiError(errorMessage, response.status, errorCode);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API Methods
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated list of audit logs with multi-dimensional filtering.
 *
 * Supports dynamic combination of filters: time range (required),
 * operator ID, and action type. Enforces the 90-day time span limit
 * and pagination constraints on the client side before making the request.
 *
 * All timestamps are converted from local time to UTC ISO 8601 before
 * being sent to the API (boundary constraint #4).
 *
 * @param params - Query parameters including time range, filters, and pagination
 * @returns Paginated audit log list response with total count and items
 * @throws {AuditApiError} If time span exceeds 90 days, pagination offset exceeds 10000,
 *                         or the server returns an error
 *
 * @example
 * ```ts
 * const result = await fetchAuditLogList({
 *   start_time: new Date('2025-01-01'),
 *   end_time: new Date('2025-01-15'),
 *   operator_id: 'U001',
 *   action_type: 'LOGIN',
 *   page: 1,
 *   size: 20,
 * });
 * // result.total → number of matching records
 * // result.items → AuditLogItem[] (max 20 items)
 * ```
 */
export async function fetchAuditLogList(
  params: AuditLogListRequest
): Promise<AuditLogListResponse> {
  const { start_time, end_time, operator_id, action_type, page, size } = params;

  // Client-side validation: time span must not exceed 90 days
  validateTimeSpan(start_time, end_time);

  // Client-side validation: pagination constraints
  const { page: normalizedPage, size: normalizedSize } = validatePagination(
    page,
    size
  );

  // Build query parameters with UTC-converted timestamps
  const queryParams: Record<string, string> = {
    start_time: toUTCISOString(start_time),
    end_time: toUTCISOString(end_time),
    page: String(normalizedPage),
    size: String(normalizedSize),
  };

  // Append optional filters only when provided
  if (operator_id) {
    queryParams.operator_id = operator_id;
  }
  if (action_type) {
    queryParams.action_type = action_type;
  }

  return apiGet<AuditLogListResponse>('/list', queryParams);
}

/**
 * Fetch audit log trend data with adaptive time granularity.
 *
 * The aggregation granularity is automatically determined based on the
 * query time range per boundary constraint #5:
 * - ≤7 days → hourly (ATB-03)
 * - 8–30 days → daily (ATB-06)
 * - >30 days → weekly
 *
 * Callers may override the auto-determined granularity by explicitly
 * providing the `granularity` parameter.
 *
 * All timestamps are converted from local time to UTC ISO 8601 before
 * being sent to the API. The response data points contain UTC timestamps
 * that should be converted to local time for display.
 *
 * @param params - Query parameters including time range and optional filters
 * @returns Trend data response with granularity and continuous data points
 * @throws {AuditApiError} If time span exceeds 90 days or the server returns an error
 *
 * @example
 * ```ts
 * // Auto-determined granularity (7 days → hourly)
 * const trend = await fetchAuditLogTrend({
 *   start_time: new Date(Date.now() - 7 * 24 * 3600 * 1000),
 *   end_time: new Date(),
 * });
 * // trend.granularity → 'hour'
 * // trend.data_points → [{ timestamp: '...', count: 5 }, ...]
 *
 * // 30 days → daily granularity
 * const monthlyTrend = await fetchAuditLogTrend({
 *   start_time: new Date(Date.now() - 30 * 24 * 3600 * 1000),
 *   end_time: new Date(),
 *   action_type: 'DELETE',
 * });
 * // monthlyTrend.granularity → 'day'
 * ```
 */
export async function fetchAuditLogTrend(
  params: AuditLogTrendRequest
): Promise<AuditLogTrendResponse> {
  const {
    start_time,
    end_time,
    operator_id,
    action_type,
    granularity,
  } = params;

  // Client-side validation: time span must not exceed 90 days
  validateTimeSpan(start_time, end_time);

  // Determine granularity: use explicit value or auto-detect from range
  const effectiveGranularity =
    granularity ?? determineTrendGranularity(start_time, end_time);

  // Build query parameters with UTC-converted timestamps
  const queryParams: Record<string, string> = {
    start_time: toUTCISOString(start_time),
    end_time: toUTCISOString(end_time),
    granularity: effectiveGranularity,
  };

  // Append optional filters only when provided
  if (operator_id) {
    queryParams.operator_id = operator_id;
  }
  if (action_type) {
    queryParams.action_type = action_type;
  }

  return apiGet<AuditLogTrendResponse>('/trend', queryParams);
}

/**
 * Fetch audit log metadata including available action type enumerations.
 *
 * Operation types are dynamically loaded from the backend and must NOT
 * be hardcoded on the frontend (boundary constraint #6). This endpoint
 * provides the authoritative list of valid action types for rendering
 * filter dropdowns.
 *
 * @returns Metadata response containing available action types
 * @throws {AuditApiError} If the server returns an error (e.g. 403 for insufficient permissions)
 *
 * @example
 * ```ts
 * const meta = await fetchAuditLogMeta();
 * // meta.action_types → ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', ...]
 * // Use these values to dynamically populate the action type filter dropdown
 * ```
 */
export async function fetchAuditLogMeta(): Promise<AuditLogMetaResponse> {
  return apiGet<AuditLogMetaResponse>('/meta', {});
}

/**
 * Convert a UTC ISO 8601 timestamp string to a local Date object for display.
 * Use this when rendering timestamps in the UI to ensure they appear
 * in the user's local timezone per boundary constraint #4.
 *
 * @param utcTimestamp - UTC ISO 8601 timestamp string (e.g. "2025-01-15T08:30:00.000Z")
 * @returns Date object in the user's local timezone
 */
export function fromUTCToLocalDate(utcTimestamp: string): Date {
  return new Date(utcTimestamp);
}

/**
 * Format a UTC ISO 8601 timestamp string for display in the user's local timezone.
 * Provides a human-readable localized date/time string.
 *
 * @param utcTimestamp - UTC ISO 8601 timestamp string
 * @param locale - Locale string for formatting (defaults to browser locale)
 * @param options - Intl.DateTimeFormat options (defaults to a reasonable date+time format)
 * @returns Formatted local date/time string
 */
export function formatUTCTimestampToLocal(
  utcTimestamp: string,
  locale: string = navigator.language,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }
): string {
  const date = fromUTCToLocalDate(utcTimestamp);
  return new Intl.DateTimeFormat(locale, options).format(date);
}