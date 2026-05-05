/**
 * @module dashboardApi
 * @description Dashboard API service layer for the Asset Panorama Operation Dashboard.
 * Provides typed request methods for summary statistics, category distribution,
 * depreciation trend, and expiring asset warnings.
 *
 * @see frontend/src/pages/DashboardPage/types/dashboard.types.ts — Shared type definitions
 */
import type {
  IAssetStat,
  ICategoryPieData,
  IDepreciationTrendPoint,
  IExpiringAsset,
} from '../types/dashboard.types';

import http from '@/utils/http';

// ---------------------------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------------------------

const ENDPOINTS = {
  /** Summary statistics (total / active / idle / retired) */
  STATS: '/dashboard/stats',
  /** Asset category distribution for pie chart */
  CATEGORY_DISTRIBUTION: '/dashboard/category-distribution',
  /** Monthly depreciation trend for line chart */
  DEPRECIATION_TREND: '/dashboard/depreciation-trend',
  /** Assets nearing their expiry / warranty end date */
  EXPIRING_ASSETS: '/dashboard/expiring-assets',
} as const;

// ---------------------------------------------------------------------------
// Individual fetchers
// ---------------------------------------------------------------------------

/**
 * Fetches aggregated asset statistics for the four top-level stat cards.
 *
 * Returns counts for: total assets, in-use (active), idle, and retired assets.
 * The React Query consumer should map these directly onto `<StatCard />` values.
 *
 * @returns {Promise<IAssetStat>} Aggregated asset counts.
 */
export const fetchDashboardStats = async (): Promise<IAssetStat> => {
  const response = await http.get<IAssetStat>(ENDPOINTS.STATS);
  return response.data;
};

/**
 * Fetches asset category distribution data for the pie chart.
 *
 * Each entry contains a `name` (category label) and `value` (asset count).
 * The frontend is responsible for computing the percentage share from the
 * raw values so that the total always sums to 100 %.
 *
 * @returns {Promise<ICategoryPieData[]>} Category name-value pairs.
 */
export const fetchCategoryDistribution = async (): Promise<ICategoryPieData[]> => {
  const response = await http.get<ICategoryPieData[]>(ENDPOINTS.CATEGORY_DISTRIBUTION);
  return response.data;
};

/**
 * Fetches monthly depreciation trend data for the line chart.
 *
 * Each data-point contains a `month` string (YYYY-MM) and the corresponding
 * depreciation `amount` in the system's base currency unit.
 *
 * @returns {Promise<IDepreciationTrendPoint[]>} Time-series depreciation amounts.
 */
export const fetchDepreciationTrend = async (): Promise<IDepreciationTrendPoint[]> => {
  const response = await http.get<IDepreciationTrendPoint[]>(ENDPOINTS.DEPRECIATION_TREND);
  return response.data;
};

/**
 * Fetches a list of assets that are approaching their expiry / warranty end date.
 *
 * The backend returns the `expiryDate` in ISO-8601 format. The **frontend** is
 * solely responsible for computing `remainingDays` by comparing `expiryDate`
 * with the current date — this avoids stale server-side values due to clock
 * drift or timezone differences.
 *
 * The list is pre-sorted by remaining days ascending (most urgent first).
 *
 * @param {object} [params] Optional query parameters.
 * @param {number} [params.limit=10]  Maximum number of records to return (capped at 100).
 * @param {number} [params.daysThreshold=30]  Only include assets expiring within this many days.
 * @returns {Promise<IExpiringAsset[]>} Sorted list of expiring assets.
 */
export const fetchExpiringAssets = async (params?: {
  limit?: number;
  daysThreshold?: number;
}): Promise<IExpiringAsset[]> => {
  const response = await http.get<IExpiringAsset[]>(ENDPOINTS.EXPIRING_ASSETS, {
    params: {
      limit: params?.limit ?? 10,
      daysThreshold: params?.daysThreshold ?? 30,
    },
  });
  return response.data;
};

// ---------------------------------------------------------------------------
// Aggregated (full-dashboard) fetcher — convenience for initial page load
// ---------------------------------------------------------------------------

/** Shape returned by the aggregated full-dashboard fetch. */
export interface IDashboardFullData {
  stats: IAssetStat;
  categoryDistribution: ICategoryPieData[];
  depreciationTrend: IDepreciationTrendPoint[];
  expiringAssets: IExpiringAsset[];
}

/**
 * Fetches all dashboard data in parallel for the initial page load.
 *
 * Internally issues four concurrent HTTP requests via `Promise.all` so the
 * total latency equals the slowest individual endpoint rather than the sum.
 *
 * @returns {Promise<IDashboardFullData>} Complete dashboard payload.
 */
export const fetchDashboardFullData = async (): Promise<IDashboardFullData> => {
  const [stats, categoryDistribution, depreciationTrend, expiringAssets] =
    await Promise.all([
      fetchDashboardStats(),
      fetchCategoryDistribution(),
      fetchDepreciationTrend(),
      fetchExpiringAssets(),
    ]);

  return {
    stats,
    categoryDistribution,
    depreciationTrend,
    expiringAssets,
  };
};

// ---------------------------------------------------------------------------
// Default export — named handle for tree-shakeable consumer imports
// ---------------------------------------------------------------------------

const dashboardApi = {
  getStats: fetchDashboardStats,
  getCategoryDistribution: fetchCategoryDistribution,
  getDepreciationTrend: fetchDepreciationTrend,
  getExpiringAssets: fetchExpiringAssets,
  getFullData: fetchDashboardFullData,
} as const;

export default dashboardApi;