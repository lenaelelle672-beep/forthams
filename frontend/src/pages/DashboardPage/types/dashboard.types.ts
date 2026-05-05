/**
 * Dashboard Page Type Definitions
 * Based on Spec: [SWARM-P2-007-FE] 资产全景运营数据仪表板
 * Phase 2: 核心业务数据可视化看板构建 (Iteration 1)
 *
 * Defines all TypeScript interfaces for the dashboard including:
 * - Core statistics cards (总数/在用/闲置/报废)
 * - Chart data (category pie chart, depreciation line chart)
 * - Expiring asset warning list
 */

// =============================================================================
// Core Statistics Types (Top Row — Stat Cards)
// =============================================================================

/** Single statistic card data structure */
export interface IAssetStat {
  /** Card title displayed to the user (e.g., "资产总数", "在用", "闲置", "报废") */
  label: string;
  /** The numerical or formatted string value to display */
  value: number | string;
  /** Optional trend indicator showing change over previous period */
  trend?: {
    /** Percentage change value (e.g., 12.5 means +12.5%) */
    percentage: number;
    /** Whether the trend direction is positive (up) or negative (down) */
    isPositive: boolean;
  };
  /** Icon identifier for UI rendering (maps to icon component/library) */
  iconName: string;
  /** CSS class or color token for theme-consistent card styling */
  colorClass: string;
}

/** Aggregated statistics response from backend API */
export interface IDashboardStatsResponse {
  /** Total number of assets in the system */
  totalCount: number;
  /** Assets currently in active use (在用) */
  activeCount: number;
  /** Idle / available assets not in use (闲置) */
  idleCount: number;
  /** Scrapped / disposed assets (报废) */
  scrappedCount: number;
  /** ISO 8601 timestamp of the last data refresh */
  lastUpdated: string;
}

// =============================================================================
// Chart Data Types (Middle Row — Pie Chart & Line Chart)
// =============================================================================

/** Single data point for the asset category distribution pie chart */
export interface ICategoryPieData {
  /** Category name displayed in chart legend (e.g., "IT Equipment", "Furniture") */
  name: string;
  /** Count of assets in this category */
  value: number;
  /** Pre-calculated percentage from backend or computed on frontend */
  percentage?: number;
}

/** Single data point for the monthly depreciation trend line chart */
export interface IDepreciationTrend {
  /** Month label for X-axis (e.g., "2024-01" or "Jan 2024") */
  month: string;
  /** Depreciation amount for this month in currency units */
  amount: number;
}

/** Full depreciation trend response from backend API */
export interface IDepreciationTrendResponse {
  /** Array of monthly data points for the line chart */
  data: IDepreciationTrend[];
  /** Year-to-date total accumulated depreciation */
  totalDepreciationYTD: number;
}

// =============================================================================
// Warning List Types (Bottom Row — Expiring Assets)
// =============================================================================

/**
 * Raw expiring asset data returned from the backend API.
 * Note: urgency status is NOT provided by backend — it must be computed
 * on the frontend by comparing expiryDate with the current date.
 * Per spec: "剩余天数需前端结合当前日期与后端返回的到期日实时计算，不依赖后端静态字段"
 */
export interface IExpiringAsset {
  /** Unique identifier of the asset */
  id: string | number;
  /** Display name of the asset */
  assetName: string;
  /** Asset category for quick visual identification */
  category: string;
  /** Expiry date as ISO date string (YYYY-MM-DD) — used for frontend remaining-days calculation */
  expiryDate: string;
  /** Optional unique asset code / tag number */
  assetCode?: string;
  /** Optional department or location for additional context */
  department?: string;
}

/**
 * UI-enriched type after frontend processing of raw API data.
 * Adds computed fields derived from IExpiringAsset.expiryDate.
 */
export interface IExpiringAssetUI extends IExpiringAsset {
  /** Formatted expiry date for display (YYYY-MM-DD per ATB requirements) */
  formattedExpiry: string;
  /** Days remaining until expiry, computed as ceil(expiryDate - today) */
  remainingDays: number;
  /** True if remainingDays <= CRITICAL threshold (7 days) — triggers red/warning styling */
  isUrgent: boolean;
}

// =============================================================================
// Aggregated API Response Wrapper
// =============================================================================

/** Complete dashboard data response combining all sections */
export interface IDashboardDataResponse {
  /** Top row — aggregated statistics */
  stats: IDashboardStatsResponse;
  /** Middle row left — category distribution for pie chart */
  categoryPieData: ICategoryPieData[];
  /** Middle row right — monthly depreciation trend for line chart */
  depreciationTrend: IDepreciationTrendResponse;
  /** Bottom row — list of assets approaching expiry */
  expiringAssets: IExpiringAsset[];
}

// =============================================================================
// Component Props Interfaces
// =============================================================================

/** Props for the StatCard atomic component */
export interface StatCardProps {
  /** Card title text */
  title: string;
  /** Value to display prominently */
  value: number | string;
  /** Icon identifier */
  iconName: string;
  /** Optional trend data */
  trend?: { percentage: number; isPositive: boolean };
  /** Theme color class */
  colorClass: string;
  /** data-testid attribute for Playwright E2E testing */
  dataTestId?: string;
}

/** Props for the DashboardChart wrapper component */
export interface DashboardChartProps {
  /** Chart title */
  title: string;
  /** Chart type — 'pie' for category distribution, 'line' for depreciation trend */
  type: 'pie' | 'line';
  /** Chart data payload */
  data: ICategoryPieData[] | IDepreciationTrend[];
  /** Chart container height in pixels */
  height?: number;
  /** Whether data is still loading */
  loading?: boolean;
  /** Error message to display if fetch failed */
  error?: string;
  /** data-testid attribute for Playwright E2E testing */
  dataTestId?: string;
}

/** Props for a single WarningListItem component */
export interface WarningListItemProps {
  /** Processed asset data with computed urgency fields */
  asset: IExpiringAssetUI;
}

// =============================================================================
// Enums & Constants
// =============================================================================

/**
 * Thresholds for expiry warning color logic as per ATB requirements:
 * - <= 7 days: critical (red/urgent highlight)
 * - <= 30 days: warning (orange/yellow highlight)
 */
export enum ExpiryWarningThreshold {
  /** Days remaining at or below this value trigger urgent red styling */
  CRITICAL = 7,
  /** Days remaining at or below this value trigger warning styling */
  WARNING = 30,
}

/**
 * Dashboard UI configuration constants per spec constraints:
 * - MAX_WARNING_ITEMS: default display limit (10 items per spec)
 * - AUTO_SCROLL_SPEED: animation interval for warning list scroll effect
 * - CHART_ANIMATION_DURATION: ECharts transition duration in ms
 */
export const DASHBOARD_CONFIG = {
  /** Spec: default display 10 records, max 100 DOM nodes */
  MAX_WARNING_ITEMS: 10,
  /** Maximum DOM nodes before pagination/virtualization is required */
  MAX_DOM_NODES: 100,
  /** Milliseconds between scroll animation frames */
  AUTO_SCROLL_SPEED: 50,
  /** ECharts animation duration in milliseconds */
  CHART_ANIMATION_DURATION: 800,
} as const;

// =============================================================================
// Utility Types
// =============================================================================

/** Loading states for dashboard data sections */
export type DashboardLoadingStatus = 'idle' | 'loading' | 'success' | 'error';

/** Error categories specific to dashboard data fetching */
export type DashboardErrorType =
  | 'NETWORK_ERROR'
  | 'DATA_FORMAT_MISMATCH'
  | 'AUTH_EXPIRED'
  | 'SERVER_500';