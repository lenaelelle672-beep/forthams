/**
 * @module auditService
 * @description Audit dashboard API service layer.
 * Encapsulates the getAuditStats request method, handling parameter serialization
 * and response data mapping for the audit log statistics endpoint.
 */

import type { AuditFilterParams, AuditTrendData } from '../types/audit.types';
import http from '../utils/http';

/** Raw item shape returned by the backend /api/audit/logs/stats endpoint */
interface AuditStatsRawItem {
  date: string;
  count: number;
  operationType: string;
}

/** Top-level response envelope from the audit stats API */
interface AuditStatsApiResponse {
  data: AuditStatsRawItem[];
}

/**
 * Serializes audit filter parameters into a flat query-parameter object.
 * Undefined, null, or empty-string values are omitted so the resulting
 * URL stays clean and the backend is not sent redundant keys.
 *
 * @param params - The audit filter parameters from the UI layer
 * @returns A Record<string, string> suitable for passing as query params
 */
function serializeFilterParams(params: AuditFilterParams): Record<string, string> {
  const query: Record<string, string> = {};

  if (params.startTime != null && params.startTime !== '') {
    query.startTime =
      typeof params.startTime === 'string'
        ? params.startTime
        : params.startTime.toISOString();
  }

  if (params.endTime != null && params.endTime !== '') {
    query.endTime =
      typeof params.endTime === 'string'
        ? params.endTime
        : params.endTime.toISOString();
  }

  if (params.operationType != null && params.operationType !== '') {
    query.operationType = params.operationType;
  }

  if (params.operator != null && params.operator !== '') {
    query.operator = params.operator;
  }

  return query;
}

/**
 * Maps the raw API response into the application-level AuditTrendData array.
 * Gracefully handles missing or malformed data by returning an empty array,
 * ensuring the UI never crashes due to unexpected response shapes.
 *
 * @param raw - The raw response object from the API call
 * @returns A validated and normalized array of AuditTrendData items
 */
function mapResponseData(raw: AuditStatsApiResponse | AuditStatsRawItem[] | null | undefined): AuditTrendData[] {
  // Handle null / undefined
  if (raw == null) {
    return [];
  }

  // If the backend returns a bare array instead of an envelope
  if (Array.isArray(raw)) {
    return raw.map((item) => ({
      date: item.date,
      count: Number(item.count) || 0,
      operationType: item.operationType,
    }));
  }

  // Standard envelope: { data: [...] }
  if (!Array.isArray(raw.data)) {
    return [];
  }

  return raw.data.map((item) => ({
    date: item.date,
    count: Number(item.count) || 0,
    operationType: item.operationType,
  }));
}

/**
 * Fetches audit log statistics based on the provided filter parameters.
 *
 * Sends a GET request to `/api/audit/logs/stats` with the filter criteria
 * serialized as query-string parameters (`startTime`, `endTime`,
 * `operationType`, `operator`). The response is mapped to the
 * application-level `AuditTrendData[]` type before being returned.
 *
 * @param params - The audit filter parameters (time range, operation type, operator)
 * @returns A Promise resolving to an array of AuditTrendData for chart rendering
 * @throws Re-throws any network or HTTP-level error from the underlying http client
 *
 * @example
 * ```ts
 * const data = await getAuditStats({
 *   startTime: '2024-01-01T00:00:00Z',
 *   endTime: '2024-01-07T23:59:59Z',
 *   operationType: 'LOGIN',
 *   operator: 'admin',
 * });
 * ```
 */
export async function getAuditStats(params: AuditFilterParams): Promise<AuditTrendData[]> {
  const queryParams = serializeFilterParams(params);

  const response = await http.get<AuditStatsApiResponse>('/audit/logs/stats', {
    params: queryParams,
  });

  return mapResponseData(response as any);
}

/**
 * Re-export internal helpers for unit-testing purposes.
 * These are not intended for use in application code.
 */
export const __testing__ = {
  serializeFilterParams,
  mapResponseData,
};