/**
 * StatisticsPanel Component
 * 
 * Displays asset statistics overview with four key metric cards:
 * - Total Assets Count
 * - Online Assets Count
 * - Offline Assets Count
 * - Total Assets Value
 * 
 * Fetches data from real API endpoints via @tanstack/react-query.
 * 
 * @since Iteration 5 (Phase 3)
 */

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDashboardStats } from '@/api/asset';
import type { DashboardStats } from '@/types/asset';
import type { ApiResponse } from '@/types/common';
import StatCard from '../StatCard/StatCard';
import './StatisticsPanel.module.css';

// Type definitions for asset statistics
interface AssetStatistics {
  /** Total number of assets in the system */
  totalCount: number;
  /** Number of assets currently online/active */
  onlineCount: number;
  /** Number of assets currently offline/inactive */
  offlineCount: number;
  /** Total monetary value of all assets */
  totalValue: number;
}

interface StatisticsPanelProps {
  /** Optional callback fired when data is loaded */
  onDataLoaded?: (data: AssetStatistics) => void;
  /** Optional initial data to display while fetching */
  initialData?: AssetStatistics | null;
  /** Whether to enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds (default: 60000ms / 60s) */
  refreshInterval?: number;
}

interface TrendIndicator {
  /** Trend direction: 'up', 'down', or 'neutral' */
  direction: 'up' | 'down' | 'neutral';
  /** Percentage change value */
  percentage: number;
}

/**
 * Formats large numbers with locale-aware separators
 * 
 * @param value - The number to format
 * @param locale - Locale string for formatting (default: 'zh-CN')
 * @returns Formatted number string
 */
const formatNumber = (value: number, locale: string = 'zh-CN'): string => {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Formats currency values with proper symbol and decimal places
 * 
 * @param value - The monetary value to format
 * @param currency - Currency code (default: 'CNY')
 * @returns Formatted currency string
 */
const formatCurrency = (value: number, currency: string = 'CNY'): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * StatisticsPanel Component
 * 
 * Displays a panel containing four stat cards showing key asset metrics:
 * - Total Assets
 * - Online Assets
 * - Offline Assets
 * - Total Value
 * 
 * Features:
 * - Real data fetching via getDashboardStats API
 * - Configurable auto-refresh polling (default: 60 seconds)
 * - Responsive grid layout
 * - Loading and error states
 */
const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  onDataLoaded,
  initialData,
  autoRefresh = true,
  refreshInterval = 60000,
}) => {
  const queryClient = useQueryClient();

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
    staleTime: refreshInterval,
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  // Extract stats from API response, falling back to initialData
  const apiStats = (response as ApiResponse<DashboardStats> | undefined)?.data;
  const statistics: AssetStatistics | null = apiStats
    ? {
        totalCount: apiStats.totalAssets ?? 0,
        onlineCount: apiStats.inUseAssets ?? 0,
        offlineCount: apiStats.idleAssets ?? 0,
        totalValue: apiStats.totalValue ?? 0,
      }
    : initialData ?? null;

  const errorMessage = error instanceof Error ? error.message : null;

  // Derive trend indicators from statistics for future use
  const getTrendIndicator = (type: 'total' | 'online' | 'offline' | 'value'): TrendIndicator => {
    // In production, this would compare current vs previous period data
    // Currently returns neutral trend as placeholder
    return {
      direction: 'neutral',
      percentage: 0,
    };
  };

  // Loading state - display skeleton cards
  if (isLoading && !statistics) {
    return (
      <div 
        className="statistics-panel"
        role="region"
        aria-label="资产总览统计"
        aria-busy="true"
      >
        <div className="statistics-grid">
          <StatCard
            title="资产总量"
            value={0}
            icon="box"
            loading
            variant="default"
          />
          <StatCard
            title="在线数量"
            value={0}
            icon="online"
            loading
            variant="success"
          />
          <StatCard
            title="离线数量"
            value={0}
            icon="offline"
            loading
            variant="warning"
          />
          <StatCard
            title="总价值"
            value={0}
            icon="value"
            loading
            variant="info"
            isCurrency
          />
        </div>
      </div>
    );
  }

  // Error state - display error message
  if (errorMessage && !statistics) {
    return (
      <div 
        className="statistics-panel"
        role="region"
        aria-label="资产总览统计"
      >
        <div className="statistics-error" role="alert">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{errorMessage}</span>
          <button 
            className="retry-button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] })}
            aria-label="重新加载统计数据"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // Main render - display stat cards with statistics data
  return (
    <div 
      className="statistics-panel"
      role="region"
      aria-label="资产总览统计"
    >
      <div className="statistics-grid">
        {/* Total Assets Card */}
        <StatCard
          title="资产总量"
          value={statistics?.totalCount ?? 0}
          icon="box"
          description="系统中所有资产总数"
          trend={getTrendIndicator('total')}
          variant="default"
        />
        
        {/* Online Assets Card */}
        <StatCard
          title="在线数量"
          value={statistics?.onlineCount ?? 0}
          icon="online"
          description="当前在线/活跃资产数"
          trend={getTrendIndicator('online')}
          variant="success"
        />
        
        {/* Offline Assets Card */}
        <StatCard
          title="离线数量"
          value={statistics?.offlineCount ?? 0}
          icon="offline"
          description="当前离线/未激活资产数"
          trend={getTrendIndicator('offline')}
          variant="warning"
        />
        
        {/* Total Value Card */}
        <StatCard
          title="总价值"
          value={statistics?.totalValue ?? 0}
          icon="value"
          description="所有资产估算总价值"
          trend={getTrendIndicator('value')}
          variant="info"
          isCurrency
        />
      </div>
    </div>
  );
};

export {
  StatisticsPanel,
  type AssetStatistics,
  type StatisticsPanelProps,
  type TrendIndicator,
  formatNumber,
  formatCurrency,
};

export default StatisticsPanel;
