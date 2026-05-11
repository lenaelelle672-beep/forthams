/**
 * Depreciation Service — Real API integration layer.
 *
 * Provides typed API methods for:
 * - Fetching paginated depreciation schedules per asset
 * - Updating the depreciation method for an asset
 * - Triggering a depreciation calculation run
 *
 * All methods surface structured errors with HTTP status codes.
 *
 * @module services/depreciationService
 * @since SWARM-042
 */

import { api } from '../utils/api';

// ---------------------------------------------------------------------------
// TypeScript Interfaces
// ---------------------------------------------------------------------------

/**
 * Depreciation method identifiers accepted by the backend.
 */
export type DepreciationMethodKey =
  | 'straight_line'
  | 'double_declining'
  | 'double_declining_balance'
  | string;

/**
 * Single period depreciation detail row.
 */
export interface DepreciationScheduleDetail {
  /** Unique row id */
  id: string | number;
  /** Period label, e.g. "2025-01" */
  period: string;
  /** Depreciation amount for this period */
  depreciationAmount: number;
  /** Accumulated depreciation up to this period */
  accumulatedDepreciation: number;
  /** Net book value at end of this period */
  netValue: number;
  /** Depreciation rate (used by double-declining method) */
  depreciationRate?: number;
}

/**
 * Full depreciation schedule DTO returned by the backend for a single asset.
 */
export interface DepreciationSchedule {
  /** Asset ID */
  assetId: string | number;
  /** Asset code / number */
  assetNo?: string;
  /** Asset display name */
  assetName?: string;
  /** Method label in Chinese */
  methodName: string;
  /** Method key */
  method: DepreciationMethodKey;
  /** Original value */
  originalValue: number;
  /** Salvage value */
  salvageValue: number;
  /** Salvage rate */
  salvageRate?: number;
  /** Useful life in years */
  usefulLifeYears: number;
  /** Start date string */
  startDate?: string;
  /** Period detail rows */
  details: DepreciationScheduleDetail[];
}

/**
 * Paginated schedule response from the backend.
 */
export interface DepreciationScheduleResponse {
  /** Period detail rows for the current page */
  records: DepreciationScheduleDetail[];
  /** Total number of period rows across all pages */
  total: number;
}

/**
 * Payload for changing the depreciation method.
 */
export interface UpdateMethodPayload {
  /** New method key */
  method: DepreciationMethodKey;
}

/**
 * Payload for triggering a depreciation calculation run.
 */
export interface DepreciationRunPayload {
  /** Asset IDs to include in the run */
  assetIds?: string[];
  /** Target period, e.g. "2025-06" */
  targetPeriod?: string;
}

/**
 * Response body for a successful run trigger.
 */
export interface DepreciationRunResponse {
  /** Server-assigned run ID */
  runId?: string;
  /** Human-readable status */
  status?: string;
}

/**
 * Custom structured error thrown by all service methods.
 */
export class DepreciationApiError extends Error {
  /** HTTP status code */
  public readonly status: number;
  /** Short error code from backend (if any) */
  public readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'DepreciationApiError';
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

/**
 * Fetch the depreciation schedule for a specific asset.
 *
 * Supports server-side pagination via `page` / `pageSize`.
 *
 * @param assetId  - The asset ID
 * @param page     - 1-based page number
 * @param pageSize - Number of rows per page
 * @returns Paginated schedule response
 * @throws {DepreciationApiError} on non-2xx responses
 */
export async function getSchedule(
  assetId: string,
  page: number = 1,
  pageSize: number = 10,
): Promise<DepreciationScheduleResponse> {
  try {
    return await api.get<DepreciationScheduleResponse>(
      `/assets/${assetId}/depreciation-schedule`,
      {
        params: { page, pageSize },
      },
    );
  } catch (err) {
    if (err instanceof DepreciationApiError) throw err;
    const message = err instanceof Error ? err.message : '获取折旧明细失败';
    throw new DepreciationApiError(500, message);
  }
}

/**
 * Update (switch) the depreciation method for a specific asset.
 *
 * @param assetId - The asset ID
 * @param payload - Object containing the new method key
 * @returns The updated method key on success
 * @throws {DepreciationApiError} on non-2xx responses
 */
export async function updateMethod(
  assetId: string,
  payload: UpdateMethodPayload,
): Promise<{ method: DepreciationMethodKey }> {
  try {
    return await api.put<{ method: DepreciationMethodKey }>(
      `/assets/${assetId}/depreciation-method`,
      payload,
    );
  } catch (err) {
    if (err instanceof DepreciationApiError) throw err;
    const message = err instanceof Error ? err.message : '更新折旧方法失败';
    throw new DepreciationApiError(500, message);
  }
}

/**
 * Trigger a depreciation calculation run.
 *
 * @param payload - Contains asset IDs and/or target period
 * @returns Run response with run ID and status
 * @throws {DepreciationApiError} on non-2xx responses
 */
export async function triggerRun(
  payload: DepreciationRunPayload,
): Promise<DepreciationRunResponse> {
  try {
    return await api.post<DepreciationRunResponse>(
      '/depreciation/runs',
      payload,
    );
  } catch (err) {
    if (err instanceof DepreciationApiError) throw err;
    const message = err instanceof Error ? err.message : '触发折旧计算失败';
    throw new DepreciationApiError(500, message);
  }
}
