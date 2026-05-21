import { useState, useEffect, useCallback } from 'react';
import { getDashboardStatistics } from '../../services/dashboardApi';
import type { DashboardStatistics } from '../../types/dashboard.types';

/**
 * Statistics Panel Component
 * 
 * Displays asset overview statistics including:
 * - Total asset count
 * - Online asset count
 * - Offline asset count
 * - Total asset value
 * 
 * Data refreshes automatically every 60 seconds.
 * 
 * @component
 * @example
 * ```tsx
 * <StatisticsPanel />
 * ```
 */
export function StatisticsPanel() {
  const [statistics, setStatistics] = useState<DashboardStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches dashboard statistics from the API
   * Updates the component state with the latest data
   */
  const fetchStatistics = useCallback(async () => {
    try {
      setError(null);
      const data = await getDashboardStatistics();
      setStatistics(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load statistics';
      setError(errorMessage);
      console.error('[StatisticsPanel] Failed to fetch statistics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initial data fetch and 60-second polling interval setup
   */
  useEffect(() => {
    fetchStatistics();

    const pollInterval = setInterval(() => {
      fetchStatistics();
    }, 60000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [fetchStatistics]);

  /**
   * Formats a number to locale string with thousand separators
   * @param value - The number to format
   * @returns Formatted string (e.g., "1,234,567")
   */
  const formatNumber = (value: number): string => {
    return value.toLocaleString('zh-CN');
  };

  /**
   * Formats a currency value to locale string with unit
   * @param value - The value in yuan
   * @returns Formatted string (e.g., "1580万")
   */
  const formatCurrency = (value: number): string => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(2)}亿`;
    }
    if (value >= 10000) {
      return `${(value / 10000).toFixed(2)}万`;
    }
    return formatNumber(value);
  };

  if (loading) {
    return (
      <div className="statistics-panel" data-testid="statistics-panel">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className="stat-card bg-[#1e293b] rounded-lg p-6 shadow-sm animate-pulse"
              data-testid={`stat-card-skeleton-${index}`}
            >
              <div className="h-4 bg-[#1e3a5f] rounded w-24 mb-4"></div>
              <div className="h-8 bg-[#1e3a5f] rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !statistics) {
    return (
      <div className="statistics-panel" data-testid="statistics-panel">
        <div className="bg-[#1e293b] rounded-lg p-6 shadow-sm">
          <div className="text-center text-slate-500">
            <span className="stat-empty-state">暂无统计数据</span>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      id: 'total',
      label: '资产总量',
      value: formatNumber(statistics.total),
      icon: '📦',
      className: 'stat-card stat-card-total',
    },
    {
      id: 'online',
      label: '在线数量',
      value: formatNumber(statistics.online),
      icon: '🟢',
      className: 'stat-card stat-card-online',
    },
    {
      id: 'offline',
      label: '离线数量',
      value: formatNumber(statistics.offline),
      icon: '⚫',
      className: 'stat-card stat-card-offline',
    },
    {
      id: 'value',
      label: '资产总价值',
      value: formatCurrency(statistics.total_value),
      icon: '💰',
      className: 'stat-card stat-card-value',
    },
  ];

  return (
    <div className="statistics-panel" data-testid="statistics-panel">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.id}
            className={`${card.className} bg-[#1e293b] rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow duration-200`}
            data-testid={`stat-card-${card.id}`}
            role="region"
            aria-label={card.label}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-400">{card.label}</span>
              <span className="text-xl" role="img" aria-hidden="true">
                {card.icon}
              </span>
            </div>
            <div
              className="stat-value text-2xl font-bold text-slate-100"
              data-value={card.value}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatisticsPanel;