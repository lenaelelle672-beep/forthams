import { useMemo } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { differenceInDays, parseISO } from 'date-fns';

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

/** Core asset metric summary displayed on the top stat cards. */
export interface IAssetStatSummary {
  /** Total number of assets across all statuses. */
  total: number;
  /** Number of assets currently in active use. */
  active: number;
  /** Number of assets sitting idle (not assigned / not in use). */
  idle: number;
  /** Number of assets that have been formally scrapped. */
  scrapped: number;
}

/** Single data point for the asset category pie chart. */
export interface ICategoryPieData {
  /** Human-readable category name (e.g. "IT Equipment"). */
  name: string;
  /** Absolute count of assets in this category. */
  value: number;
  /** Pre-computed percentage string (e.g. "43.3%"). */
  percentage: string;
}

/** Single data point on the monthly depreciation trend line chart. */
export interface IDepreciationTrendPoint {
  /** Month in `YYYY-MM` format used as the X-axis label. */
  month: string;
  /** Total depreciation amount (CNY) for the month. */
  amount: number;
}

/** Raw expiring asset item returned by the backend API. */
export interface IAssetWarningItem {
  /** Unique asset identifier. */
  id: string;
  /** Display name of the asset. */
  name: string;
  /** Asset category label. */
  category: string;
  /** ISO date string (`YYYY-MM-DD`) representing the expiry / warranty end date. */
  expiryDate: string;
  /** Current net book value of the asset (CNY). */
  value: number;
}

/** Front-end-enriched expiring asset with computed remaining-days metadata. */
export interface IExpiringAsset extends IAssetWarningItem {
  /** Days remaining until expiry. Can be negative if already expired. */
  remainingDays: number;
  /** `true` when remaining days ≤ 7, indicating an urgent warning. */
  isCritical: boolean;
}

/** Shape of the response returned by the dashboard statistics endpoint. */
export interface IDashboardDataResponse {
  /** Aggregated core metrics. */
  stats: IAssetStatSummary;
  /** Per-category counts for the pie chart. */
  categories: Array<{ category: string; count: number }>;
  /** Monthly depreciation amounts for the trend line. */
  depreciationTrend: Array<{ month: string; amount: number }>;
}

// ---------------------------------------------------------------------------
// Query Key Constants
// ---------------------------------------------------------------------------

/** Namespace for all dashboard-related query keys. */
const DASHBOARD_QUERY_KEYS = {
  /** Core statistics, category distribution, and depreciation trend. */
  statistics: ['dashboard', 'statistics'] as const,
  /** List of assets approaching their expiry / warranty end date. */
  expiringAssets: ['dashboard', 'expiring-assets'] as const,
} satisfies Record<string, readonly string[]>;

// ---------------------------------------------------------------------------
// Threshold Constants
// ---------------------------------------------------------------------------

/** Number of days remaining before an asset is considered critically close to expiry. */
const CRITICAL_DAYS_THRESHOLD = 7;

/** Default cache duration (5 minutes) before data is considered stale. */
const STALE_TIME_MS = 1000 * 60 * 5;

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Fetch aggregated dashboard statistics from the backend.
 *
 * Includes core metrics (total/active/idle/scrapped), per-category counts,
 * and monthly depreciation trend data.
 *
 * @returns Promise resolving to the dashboard data response.
 */
const fetchDashboardStats = async (): Promise<IDashboardDataResponse> => {
  const response = await fetch('/api/dashboard/statistics');
  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard statistics: ${response.status}`);
  }
  return response.json();
};

/**
 * Fetch the list of assets that are approaching or have passed their expiry date.
 *
 * @returns Promise resolving to an array of expiring asset warning items.
 */
const fetchExpiringAssets = async (): Promise<IAssetWarningItem[]> => {
  const response = await fetch('/api/assets/expiring?limit=100');
  if (!response.ok) {
    throw new Error(`Failed to fetch expiring assets: ${response.status}`);
  }
  return response.json();
};

// ---------------------------------------------------------------------------
// Shared Query Options
// ---------------------------------------------------------------------------

/** Common TanStack Query options applied to every dashboard query. */
const commonQueryOptions = {
  staleTime: STALE_TIME_MS,
  retry: 2,
  refetchOnWindowFocus: false,
} as const;

// ---------------------------------------------------------------------------
// Hook: useAssetStatistics
// ---------------------------------------------------------------------------

/**
 * Orchestrates all dashboard data fetching, transformation, and state management.
 *
 * Uses TanStack Query for remote data caching and lifecycle management.
 * Computes derived data — such as category percentages and remaining-days
 * countdown — entirely on the frontend as required by the specification.
 *
 * @returns An object containing processed statistics, chart data, expiring
 *          assets, and combined loading / error states.
 *
 * @example
 * ```tsx
 * const { stats, categoryPieData, depreciationTrend, expiringAssets, isLoading } = useAssetStatistics();
 * ```
 */
export const useAssetStatistics = () => {
  // ---- Core statistics query (stat cards, pie chart, line chart) --------
  const statsQuery: UseQueryResult<IDashboardDataResponse, Error> = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.statistics,
    queryFn: fetchDashboardStats,
    ...commonQueryOptions,
  });

  // ---- Expiring assets query (warning list) -----------------------------
  const expiringQuery: UseQueryResult<IAssetWarningItem[], Error> = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.expiringAssets,
    queryFn: fetchExpiringAssets,
    ...commonQueryOptions,
  });

  // ---- Derived data: category pie chart ----------------------------------
  const categoryPieData = useMemo<ICategoryPieData[]>(() => {
    const categories = statsQuery.data?.categories;
    if (!categories || categories.length === 0) return [];

    const totalCount = statsQuery.data?.stats.total ?? 0;

    return categories.map((cat) => ({
      name: cat.category,
      value: cat.count,
      // Guard against division by zero when there are no assets at all.
      percentage:
        totalCount > 0
          ? `${((cat.count / totalCount) * 100).toFixed(1)}%`
          : '0.0%',
    }));
  }, [statsQuery.data?.categories, statsQuery.data?.stats.total]);

  // ---- Derived data: depreciation trend ----------------------------------
  const depreciationTrend = useMemo<IDepreciationTrendPoint[]>(
    () => statsQuery.data?.depreciationTrend ?? [],
    [statsQuery.data?.depreciationTrend],
  );

  // ---- Derived data: expiring assets with remaining-days calculation -----
  const processedExpiringAssets = useMemo<IExpiringAsset[]>(() => {
    if (!expiringQuery.data || expiringQuery.data.length === 0) return [];

    const today = new Date();

    return expiringQuery.data
      .map((asset) => {
        const expiry = parseISO(asset.expiryDate);
        // `differenceInDays` truncates towards zero; negative values indicate
        // the asset has already expired.
        const remainingDays = differenceInDays(expiry, today);

        return {
          id: asset.id,
          name: asset.name,
          category: asset.category,
          expiryDate: asset.expiryDate,
          value: asset.value,
          remainingDays,
          isCritical: remainingDays <= CRITICAL_DAYS_THRESHOLD,
        };
      })
      // Sort by urgency: soonest expiry first; already-expired items are most urgent.
      .sort((a, b) => a.remainingDays - b.remainingDays);
  }, [expiringQuery.data]);

  // ---- Combined UI states ------------------------------------------------
  const isLoading = statsQuery.isLoading || expiringQuery.isLoading;
  const isFetching = statsQuery.isFetching || expiringQuery.isFetching;
  const isError = statsQuery.isError || expiringQuery.isError;
  const firstError = statsQuery.error ?? expiringQuery.error;

  /**
   * Trigger a manual refresh of all dashboard data sources.
   */
  const refetchAll = () => {
    statsQuery.refetch();
    expiringQuery.refetch();
  };

  return {
    // -- Core metrics (SPEC ATB-1) --
    /** Aggregated asset statistics for the four stat cards. */
    stats: statsQuery.data?.stats ?? {
      total: 0,
      active: 0,
      idle: 0,
      scrapped: 0,
    },

    // -- Chart data (SPEC requirement #2 & #3) --
    /** Category distribution data formatted for the ECharts pie chart. */
    categoryPieData,
    /** Monthly depreciation amounts for the ECharts line chart. */
    depreciationTrend,

    // -- Warning list (SPEC ATB-3) --
    /** Expiring assets sorted by urgency with front-end-computed remaining days. */
    expiringAssets: processedExpiringAssets,

    // -- Loading & error states (SPEC ATB-4) --
    /** `true` during the initial load of either query. */
    isLoading,
    /** `true` while any query is fetching (including background refetches). */
    isFetching,
    /** `true` when at least one query has failed. */
    isError,
    /** Human-readable error message, or `null` when there is no error. */
    error: firstError instanceof Error ? firstError.message : null,

    // -- Actions --
    /** Refetch all dashboard queries simultaneously. */
    refetch: refetchAll,
  };
};

/** Return type of the {@link useAssetStatistics} hook. */
export type UseAssetStatisticsReturn = ReturnType<typeof useAssetStatistics>;