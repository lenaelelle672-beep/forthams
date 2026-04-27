/**
 * StatisticsPanel Component
 * 
 * Displays asset statistics overview with four key metric cards:
 * - Total Assets Count
 * - Online Assets Count
 * - Offline Assets Count
 * - Total Assets Value
 * 
 * Part of SWARM-003 Dashboard Data Board Specification
 * @see {@link https://spec.example.com/swarm-003} for full requirements
 * 
 * @since Iteration 5 (Phase 3)
 */

import React, { useState, useEffect, useCallback } from 'react';
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

// Mock API function - in production, this would call the actual backend API
// GET /api/v1/assets/statistics
const fetchAssetStatistics = async (): Promise<AssetStatistics> => {
  // Simulating API call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Mock data - in production, replace with actual API call
  return {
    totalCount: 12584,
    onlineCount: 9823,
    offlineCount: 2761,
    totalValue: 45678900.50,
  };
};

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
 * - Automatic data fetching on mount
 * - Configurable auto-refresh polling (default: 60 seconds)
 * - Responsive grid layout
 * - Loading and error states
 * 
 * @param props - Component props
 * @param props.onDataLoaded - Optional callback when data loads
 * @param props.initialData - Optional initial data to display
 * @param props.autoRefresh - Enable/disable auto-refresh (default: true)
 * @param props.refreshInterval - Refresh interval in ms (default: 60000)
 * @returns React component
 */
const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  onDataLoaded,
  initialData,
  autoRefresh = true,
  refreshInterval = 60000,
}) => {
  // State management for asset statistics
  const [statistics, setStatistics] = useState<AssetStatistics | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /**
   * Loads asset statistics from the API
   * Updates state with fetched data and triggers optional callback
   * 
   * @returns Promise resolving to AssetStatistics or void on error
   */
  const loadStatistics = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await fetchAssetStatistics();
      setStatistics(data);
      setLastUpdated(new Date());
      
      // Trigger callback if provided
      if (onDataLoaded) {
        onDataLoaded(data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to load asset statistics';
      setError(errorMessage);
      console.error('[StatisticsPanel] Failed to load statistics:', err);
    } finally {
      setLoading(false);
    }
  }, [onDataLoaded]);

  // Initial data load on mount
  useEffect(() => {
    if (!initialData) {
      loadStatistics();
    }
  }, [loadStatistics, initialData]);

  // Auto-refresh polling setup
  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const intervalId = setInterval(() => {
      loadStatistics();
    }, refreshInterval);

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [autoRefresh, refreshInterval, loadStatistics]);

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
  if (loading && !statistics) {
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
  if (error && !statistics) {
    return (
      <div 
        className="statistics-panel"
        role="region"
        aria-label="资产总览统计"
      >
        <div className="statistics-error" role="alert">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button 
            className="retry-button"
            onClick={loadStatistics}
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
      {/* Accessibility: announce last updated time */}
      {lastUpdated && (
        <div className="sr-only" aria-live="polite">
          数据更新时间: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
      
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