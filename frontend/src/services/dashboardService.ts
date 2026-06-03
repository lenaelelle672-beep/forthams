/**
 * Dashboard Service Module
 * @description Provides data fetching services for the dashboard page including asset statistics,
 * category distribution, and maintenance alerts. Implements 60-second polling refresh mechanism.
 * @module frontend/src/services/dashboardService
 * @requires axios
 * @requires frontend/src/types/dashboard.types
 */

import http from '@/utils/http';
import type {
  AssetStatistics,
  CategoryDistribution,
  MaintenanceAlert,
  DashboardStatisticsResponse,
  CategoryDistributionResponse,
  MaintenanceAlertsResponse
} from '../types/dashboard.types';

/** Base API URL for dashboard endpoints */
const API_BASE_URL = '/v1';

/** Refresh interval in milliseconds (60 seconds) */
const REFRESH_INTERVAL_MS = 60000;

/**
 * Fetches asset statistics from the backend API.
 * @description Retrieves aggregate statistics including total assets, online/offline counts, and total value.
 * @async
 * @function getAssetStatistics
 * @returns {Promise<AssetStatistics>} A promise resolving to asset statistics data.
 * @throws {Error} Throws an error if the API request fails or response is invalid.
 * @example
 * ```typescript
 * const stats = await getAssetStatistics();
 * console.log(`Total assets: ${stats.total}`);
 * ```
 */
export async function getAssetStatistics(): Promise<AssetStatistics> {
  try {
    const response = await http.get<DashboardStatisticsResponse>(
      `${API_BASE_URL}/assets/statistics`
    );
    // http 拦截器已解包 response.data，response 现在就是 DashboardStatisticsResponse
    return (response as any).data;
  } catch (error) {
    console.error('[DashboardService] Failed to fetch asset statistics:', error);
    throw error;
  }
}

/**
 * Fetches category distribution data for chart visualization.
 * @description Retrieves the distribution of assets across different categories,
 * used for rendering pie/donut charts on the dashboard.
 * @async
 * @function getCategoryDistribution
 * @returns {Promise<CategoryDistribution>} A promise resolving to category distribution data.
 * @throws {Error} Throws an error if the API request fails or response is invalid.
 * @example
 * ```typescript
 * const distribution = await getCategoryDistribution();
 * distribution.forEach(item => {
 *   console.log(`${item.categoryName}: ${item.count}`);
 * });
 * ```
 */
export async function getCategoryDistribution(): Promise<CategoryDistribution[]> {
  try {
    const response = await http.get<CategoryDistributionResponse>(
      `${API_BASE_URL}/assets/categories/distribution`
    );
    return (response as any).data;
  } catch (error) {
    console.error('[DashboardService] Failed to fetch category distribution:', error);
    throw error;
  }
}

/**
 * Fetches maintenance alerts for upcoming expirations.
 * @description Retrieves maintenance records that are due for expiration within 7 and 30 days,
 * sorted by expiration date in descending order.
 * @async
 * @function getMaintenanceAlerts
 * @returns {Promise<MaintenanceAlert[]>} A promise resolving to an array of maintenance alerts.
 * @throws {Error} Throws an error if the API request fails or response is invalid.
 * @example
 * ```typescript
 * const alerts = await getMaintenanceAlerts();
 * alerts.forEach(alert => {
 *   if (alert.daysUntilExpiration <= 7) {
 *     console.log(`Urgent: ${alert.assetName} maintenance due`);
 *   }
 * });
 * ```
 */
export async function getMaintenanceAlerts(): Promise<MaintenanceAlert[]> {
  try {
    const response = await http.get<MaintenanceAlertsResponse>(
      `${API_BASE_URL}/maintenance/alerts`
    );
    return (response as any).data;
  } catch (error) {
    console.error('[DashboardService] Failed to fetch maintenance alerts:', error);
    throw error;
  }
}

/**
 * Fetches all dashboard data in parallel.
 * @description Combines all three API calls (asset statistics, category distribution, maintenance alerts)
 * into a single async operation for efficient data loading.
 * @async
 * @function fetchDashboardData
 * @returns {Promise<{ statistics: AssetStatistics; distribution: CategoryDistribution; alerts: MaintenanceAlert[] }>}
 * A promise resolving to an object containing all dashboard data.
 * @throws {Error} Throws an error if any of the API requests fail.
 * @example
 * ```typescript
 * const data = await fetchDashboardData();
 * console.log(`Assets: ${data.statistics.total}, Categories: ${data.distribution.length}`);
 * ```
 */
export async function fetchDashboardData(): Promise<{
  statistics: AssetStatistics;
  distribution: CategoryDistribution[];
  alerts: MaintenanceAlert[];
}> {
  const [statistics, distribution, alerts] = await Promise.all([
    getAssetStatistics(),
    getCategoryDistribution(),
    getMaintenanceAlerts()
  ]);

  return { statistics, distribution: distribution as CategoryDistribution[], alerts };
}

/**
 * Creates a polling mechanism for automatic data refresh.
 * @description Returns a cleanup function that can be used to stop the polling.
 * @function createDashboardPolling
 * @param {() => void} fetchCallback - Callback function to execute on each poll cycle.
 * @param {number} [intervalMs=REFRESH_INTERVAL_MS] - Poll interval in milliseconds.
 * @returns {() => void} A cleanup function to stop the polling.
 * @example
 * ```typescript
 * const stopPolling = createDashboardPolling(() => {
 *   loadDashboardData();
 * }, 60000);
 * // To stop polling:
 * stopPolling();
 * ```
 */
export function createDashboardPolling(
  fetchCallback: () => void,
  intervalMs: number = REFRESH_INTERVAL_MS
): () => void {
  const intervalId = setInterval(fetchCallback, intervalMs);
  
  // Return cleanup function
  return () => {
    clearInterval(intervalId);
  };
}

/**
 * Filters maintenance alerts by urgency level.
 * @description Classifies alerts into urgent (≤7 days) and warning (≤30 days) categories.
 * @function filterAlertsByUrgency
 * @param {MaintenanceAlert[]} alerts - Array of maintenance alerts to filter.
 * @returns {{ urgent: MaintenanceAlert[]; warning: MaintenanceAlert[] }} Filtered alert groups.
 * @example
 * ```typescript
 * const { urgent, warning } = filterAlertsByUrgency(alerts);
 * console.log(`Urgent alerts: ${urgent.length}`);
 * ```
 */
export function filterAlertsByUrgency(alerts: MaintenanceAlert[]): {
  urgent: MaintenanceAlert[];
  warning: MaintenanceAlert[];
} {
  const urgent = alerts.filter(alert => alert.daysUntilExpiration <= 7);
  const warning = alerts.filter(
    alert => alert.daysUntilExpiration > 7 && alert.daysUntilExpiration <= 30
  );

  return { urgent, warning };
}

/**
 * Transforms category distribution data for ECharts pie chart format.
 * @description Converts raw category distribution into ECharts-compatible data format
 * for rendering pie/donut charts with proper legend and tooltip support.
 * @function transformCategoryForChart
 * @param {CategoryDistribution} distribution - Raw category distribution data.
 * @returns {Array<{ name: string; value: number }>} ECharts-compatible data array.
 * @example
 * ```typescript
 * const chartData = transformCategoryForChart(distribution);
 * // Use chartData in ECharts series configuration
 * ```
 */
export function transformCategoryForChart(
  distribution: CategoryDistribution | CategoryDistribution[]
): Array<{ name: string; value: number }> {
  const items: CategoryDistribution[] = Array.isArray(distribution) ? distribution : [distribution];
  return items.map(item => ({
    name: item.categoryName,
    value: item.count
  }));
}

// Re-export types for external usage
export type { AssetStatistics, CategoryDistribution, MaintenanceAlert };

// Default export with all service methods
const dashboardService = {
  getAssetStatistics,
  getCategoryDistribution,
  getMaintenanceAlerts,
  fetchDashboardData,
  createDashboardPolling,
  filterAlertsByUrgency,
  transformCategoryForChart
};

export default dashboardService;