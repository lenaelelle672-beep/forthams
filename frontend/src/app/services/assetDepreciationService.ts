/**
 * Asset Depreciation Service
 *
 * Provides API methods for fetching asset depreciation schedule data,
 * including per-asset schedules and cross-asset depreciation summaries.
 *
 * @module services/assetDepreciationService
 * @since SWARM-029
 */

import { api } from '../utils/api';
import type { DepreciationScheduleDTO } from './assetApi';

// ---------------------------------------------------------------------------
// TypeScript interfaces
// ---------------------------------------------------------------------------

/**
 * Depreciation summary item returned by the list endpoint.
 *
 * @description Represents a single asset's depreciation summary used in the
 * browseable list view on the depreciation page.
 */
export interface AssetDepreciationSummary {
  /** Asset ID */
  assetId: number;
  /** Asset number / code */
  assetNo: string;
  /** Asset display name */
  assetName: string;
  /** Current asset status */
  assetStatus: string;
  /** Depreciation method label (e.g. "直线法") */
  methodName: string;
  /** Original purchase value */
  originalValue: number;
  /** Current net book value */
  currentNetValue: number;
  /** Total accumulated depreciation */
  accumulatedDepreciation: number;
  /** Monthly depreciation amount */
  monthlyDepreciation: number;
  /** Useful life in years */
  usefulLifeYears: number;
}

/**
 * Paginated response for depreciation summary list.
 */
export interface DepreciationListResponse {
  /** Summary items */
  records: AssetDepreciationSummary[];
  /** Total record count */
  total: number;
}

/**
 * Query parameters for depreciation list endpoint.
 */
export interface DepreciationListParams {
  /** Page number (1-based) */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Filter by asset name (fuzzy match) */
  assetName?: string;
  /** Filter by asset number */
  assetNo?: string;
  /** Filter by depreciation method */
  method?: string;
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

/**
 * Fetch paginated depreciation summary list for all assets.
 *
 * @param params - Query / pagination parameters
 * @returns Paginated depreciation summary response
 *
 * @example
 * ```ts
 * const { records, total } = await fetchDepreciationList({ page: 1, pageSize: 10 });
 * ```
 */
export async function fetchDepreciationList(
  params?: DepreciationListParams,
): Promise<DepreciationListResponse> {
  return api.get<DepreciationListResponse>('/assets/depreciation', {
    params: {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
      assetName: params?.assetName,
      assetNo: params?.assetNo,
      method: params?.method,
    },
  });
}

/**
 * Fetch detailed depreciation schedule for a single asset.
 *
 * Reuses the existing schedule endpoint to provide full period-by-period
 * depreciation data.
 *
 * @param assetId - The asset ID to fetch the schedule for
 * @returns Depreciation schedule DTO with period details, or null if unavailable
 *
 * @example
 * ```ts
 * const schedule = await fetchAssetDepreciationDetail('42');
 * console.log(schedule.details.length); // number of depreciation periods
 * ```
 */
export async function fetchAssetDepreciationDetail(
  assetId: string,
): Promise<DepreciationScheduleDTO | null> {
  try {
    return await api.get<DepreciationScheduleDTO>(
      `/assets/${assetId}/depreciation-schedule`,
    );
  } catch {
    // Some assets (e.g. land) may not have depreciation data
    return null;
  }
}
