/**
 * StatCard Component
 * 
 * Displays a single statistic card on the dashboard with value, trend indicators,
 * and icon support. Designed for asset management statistics including
 * depreciation-related metrics.
 * 
 * @module DashboardPage/components/StatCard
 * @version 1.0.0
 * @since SWARM-2026-Q2-003
 */

import React from 'react';
import './StatCard.module.css';

/**
 * Trend direction for statistics
 */
export type TrendDirection = 'up' | 'down' | 'neutral';

/**
 * StatCard component props
 */
export interface StatCardProps {
  /** Card title/label */
  title: string;
  /** Primary value to display */
  value: string | number;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Trend direction indicator */
  trend?: TrendDirection;
  /** Trend percentage or value */
  trendValue?: string | number;
  /** Icon component or name */
  icon?: React.ReactNode;
  /** Card background color variant */
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  /** Whether to show loading state */
  loading?: boolean;
  /** CSS class for additional styling */
  className?: string;
  /** Click handler for the card */
  onClick?: () => void;
}

/**
 * Formats a numeric value for display
 * 
 * @param value - The value to format
 * @returns Formatted string representation
 */
const formatValue = (value: string | number): string => {
  if (typeof value === 'number') {
    return value.toLocaleString('zh-CN', {
      maximumFractionDigits: 2,
    });
  }
  return value;
};

/**
 * StatCard Component
 * 
 * A reusable dashboard statistic card component that displays key metrics
 * with trend indicators. Supports various visual variants and loading states.
 * 
 * @example
 * ```tsx
 * <StatCard
 *   title="总资产折旧"
 *   value={125000}
 *   trend="up"
 *   trendValue="+5.2%"
 *   icon={<DepreciationIcon />}
 *   variant="primary"
 * />
 * ```
 * 
 * @param props - StatCard component properties
 * @returns React component
 */
export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  variant = 'default',
  loading = false,
  className = '',
  onClick,
}) => {
  /**
   * Gets the CSS class for trend direction
   */
  const getTrendClass = (): string => {
    switch (trend) {
      case 'up':
        return 'stat-card-trend-up';
      case 'down':
        return 'stat-card-trend-down';
      default:
        return 'stat-card-trend-neutral';
    }
  };

  /**
   * Renders the trend indicator element
   */
  const renderTrendIndicator = (): React.ReactNode => {
    if (!trend || !trendValue) return null;

    return (
      <div className={`stat-card-trend ${getTrendClass()}`}>
        <span className="stat-card-trend-arrow">
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
        </span>
        <span className="stat-card-trend-value">{trendValue}</span>
      </div>
    );
  };

  /**
   * Renders loading skeleton
   */
  const renderLoadingSkeleton = (): React.ReactNode => {
    return (
      <div className="stat-card-skeleton">
        <div className="stat-card-skeleton-title" />
        <div className="stat-card-skeleton-value" />
        <div className="stat-card-skeleton-trend" />
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`stat-card stat-card-${variant} ${className}`}>
        {renderLoadingSkeleton()}
      </div>
    );
  }

  return (
    <div
      className={`stat-card stat-card-${variant} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="stat-card-header">
        <h3 className="stat-card-title">{title}</h3>
        {icon && <div className="stat-card-icon">{icon}</div>}
      </div>

      <div className="stat-card-body">
        <div className="stat-card-value">{formatValue(value)}</div>
        {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
        {renderTrendIndicator()}
      </div>
    </div>
  );
};

/**
 * exports
 */
export default StatCard;