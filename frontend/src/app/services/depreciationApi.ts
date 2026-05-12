/**
 * Depreciation API — Real API integration for the depreciation module.
 *
 * Provides typed API methods for:
 * - Fetching paginated depreciation schedules with filters (assetNo, period)
 * - Triggering batch depreciation calculation for selected assets
 * - Fetching depreciation history for a specific asset
 *
 * No mock data or interceptors. All requests go to the real backend.
 *
 * @module services/depreciationApi
 * @since SWARM-055
 */

import { api } from '../utils/api';

// ---------------------------------------------------------------------------
// TypeScript Interfaces
// ---------------------------------------------------------------------------

/**
 * Single depreciation schedule row returned by the backend.
 */
export interface DepreciationScheduleItem {
  /** Unique row identifier */
  id: number;
  /** Asset ID (matches Asset.id) */
  assetId: number;
  /** Asset number (matches Asset.assetNo) */
  assetNo: string;
  /** Asset display name */
  assetName: string;
  /** Accounting period, e.g. "2025-01" */
  period: string;
  /** Depreciation amount for this period */
  depreciationAmount: number;
  /** Accumulated depreciation up to this period */
  accumulatedDepreciation: number;
  /** Net book value at end of this period */
  netValue: number;
  /** Depreciation rate (used by declining methods) */
  depreciationRate?: number;
  /**
   * Current asset lifecycle status (mirrors Asset.status from backend).
   * Used by the frontend to disable batch operations on terminal-state
   * assets (RETIRED, SCRAPPED, etc.).
   */
  assetStatus?: string;
  /**
   * Depreciation method key (e.g. "straight_line", "double_declining").
   * Used by DepreciationMethodBadge to render the method label.
   * Mirrors the method stored on the asset or schedule record.
   */
  depreciationMethod?: string;
}

/**
 * Filter parameters for depreciation schedule queries.
 */
export interface DepreciationFilter {
  /** Asset number filter — exact match on Asset.assetNo */
  assetNo?: string;
  /** Accounting period in YYYY-MM format */
  period?: string;
  /** 1-based page number */
  page?: number;
  /** Number of rows per page (sent as 'size' to backend per ATB-01) */
  pageSize?: number;
}

/**
 * Paginated response for depreciation schedules.
 */
export interface DepreciationScheduleResponse {
  /** Schedule rows for the current page */
  data: DepreciationScheduleItem[];
  /** Total number of rows across all pages */
  total: number;
  /** Current page number */
  page: number;
  /** Page size */
  pageSize: number;
}

/**
 * Request payload for batch depreciation calculation.
 */
export interface BatchCalculateRequest {
  /** Array of asset IDs to calculate depreciation for */
  assetIds: number[];
}

/**
 * Response for batch calculation result.
 */
export interface BatchCalculateResponse {
  /** Number of successfully processed assets */
  processedCount?: number;
  /** Human-readable status message */
  message?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * YYYY-MM period format regex.
 * Used for client-side validation before sending period filters to backend (ATB-03).
 */
export const PERIOD_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])$/;

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * Fetch depreciation schedules with optional filters.
 *
 * Calls GET /api/depreciation/schedules with query parameters.
 * Backend expects `page`, `size` (not `pageSize`), `assetNo`, and `period`.
 *
 * @param filters - Optional filter parameters
 * @returns Paginated depreciation schedule response
 */
export async function getDepreciationSchedules(
  filters?: DepreciationFilter,
): Promise<DepreciationScheduleResponse> {
  const params: Record<string, string | number> = {};

  if (filters?.assetNo) {
    params.assetNo = filters.assetNo;
  }
  if (filters?.period) {
    params.period = filters.period;
  }
  if (filters?.page) {
    params.page = filters.page;
  }
  if (filters?.pageSize) {
    // Backend expects 'size', not 'pageSize' (ATB-01)
    params.size = filters.pageSize;
  }

  return await api.get<DepreciationScheduleResponse>(
    '/depreciation/schedules',
    { params },
  );
}

/**
 * Trigger batch depreciation calculation for selected assets.
 *
 * Calls POST /api/depreciation/calculate with the selected asset IDs.
 * The backend will reject with 400/409 if any asset is scrapped/retired.
 *
 * @param request - Object containing the array of asset IDs
 * @returns Batch calculation response
 */
export async function batchCalculateDepreciation(
  request: BatchCalculateRequest,
): Promise<BatchCalculateResponse> {
  return await api.post<BatchCalculateResponse>(
    '/depreciation/calculate',
    request,
  );
}

/**
 * Fetch depreciation history records for a specific asset.
 *
 * Calls GET /api/assets/{assetId}/depreciation-schedule with pagination.
 * Returns the full depreciation timeline (all periods) for the given asset,
 * ordered chronologically.
 *
 * @param assetId - The asset ID to fetch history for
 * @param page - 1-based page number
 * @param pageSize - Number of rows per page
 * @returns Paginated depreciation schedule response for the asset
 */
export async function getDepreciationHistory(
  assetId: number,
  page: number = 1,
  pageSize: number = 20,
): Promise<DepreciationScheduleResponse> {
  const params: Record<string, string | number> = { page, pageSize };
  return await api.get<DepreciationScheduleResponse>(
    `/assets/${assetId}/depreciation-schedule`,
    { params },
  );
}
