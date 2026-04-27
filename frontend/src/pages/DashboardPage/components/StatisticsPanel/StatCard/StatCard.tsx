/**
 * StatCard Component
 * 
 * @description
 * A single statistics card component for displaying key metrics on the dashboard.
 * Part of the StatisticsPanel which shows asset overview statistics including
 * total count, online/offline counts, and total asset value.
 * 
 * @module DashboardPage/components/StatisticsPanel/StatCard
 * @version 1.0
 * @since 2024-01-15
 * 
 * @see {@link https://spec.example.com/SWARM-003|SWARM-003 Specification}
 * 
 * @example
 * ```tsx
 * <StatCard
 *   title="资产总量"
 *   value={1234}
 *   icon={<TotalIcon />}
 *   trend={{ value: 5.2, direction: 'up' }}
 *   color="blue"
 * />
 * ```
 */

import React, { useMemo } from 'react';

/**
 * Trend direction enumeration
 * 
 * @description
 * Defines the direction of trend indicators for statistics
 */
export enum TrendDirection {
  UP = 'up',
  DOWN = 'down',
  NEUTRAL = 'neutral',
}

/**
 * Color theme enumeration for stat cards
 * 
 * @description
 * Defines available color themes for card styling
 */
export enum StatCardColor {
  BLUE = 'blue',
  GREEN = 'green',
  ORANGE = 'orange',
  RED = 'red',
  PURPLE = 'purple',
  GRAY = 'gray',
}

/**
 * Trend indicator props
 * 
 * @description
 * Configuration for the trend indicator displayed on the card
 */
export interface TrendIndicatorProps {
  /** Trend value as percentage or absolute number */
  value: number;
  /** Direction of trend: 'up', 'down', or 'neutral' */
  direction: TrendDirection | string;
  /** Optional label suffix */
  suffix?: string;
}

/**
 * StatCard component props
 * 
 * @description
 * Configuration interface for the StatCard component
 */
export interface StatCardProps {
  /** Card title/label */
  title: string;
  /** Primary value to display */
  value: number | string;
  /** Optional icon component to display */
  icon?: React.ReactNode;
  /** Trend indicator configuration */
  trend?: TrendIndicatorProps;
  /** Color theme for the card */
  color?: StatCardColor | string;
  /** Loading state indicator */
  loading?: boolean;
  /** Unit/format suffix for the value */
  unit?: string;
  /** Accessibility label override */
  ariaLabel?: string;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Trend indicator component
 * 
 * @description
 * Renders a trend indicator with arrow and percentage/value display
 * 
 * @param props - Trend indicator configuration
 * @returns React element with trend indicator UI
 * 
 * @example
 * ```tsx
 * <TrendIndicator value={5.2} direction="up" suffix="%" />
 * ```
 */
const TrendIndicator: React.FC<TrendIndicatorProps> = ({ value, direction, suffix = '%' }) => {
  const normalizedDirection = direction in TrendDirection ? direction : TrendDirection.NEUTRAL;
  
  const trendStyles = useMemo(() => {
    const baseStyles = 'inline-flex items-center gap-1 text-sm font-medium';
    if (normalizedDirection === TrendDirection.UP) {
      return `${baseStyles} text-green-600`;
    } else if (normalizedDirection === TrendDirection.DOWN) {
      return `${baseStyles} text-red-600`;
    }
    return `${baseStyles} text-gray-500`;
  }, [normalizedDirection]);
  
  const arrowIcon = useMemo(() => {
    if (normalizedDirection === TrendDirection.UP) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    } else if (normalizedDirection === TrendDirection.DOWN) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    }
    return null;
  }, [normalizedDirection]);
  
  const formattedValue = useMemo(() => {
    const absValue = Math.abs(value);
    return `${value >= 0 ? '+' : '-'}${absValue}${suffix}`;
  }, [value, suffix]);
  
  return (
    <span className={trendStyles} data-testid="trend-indicator">
      {arrowIcon}
      <span>{formattedValue}</span>
    </span>
  );
};

/**
 * Color configuration mapping
 * 
 * @description
 * Maps color enum values to Tailwind CSS class names
 */
const colorConfig: Record<StatCardColor | string, { bg: string; icon: string; border: string }> = {
  [StatCardColor.BLUE]: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    border: 'border-blue-100',
  },
  [StatCardColor.GREEN]: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    border: 'border-green-100',
  },
  [StatCardColor.ORANGE]: {
    bg: 'bg-orange-50',
    icon: 'text-orange-600',
    border: 'border-orange-100',
  },
  [StatCardColor.RED]: {
    bg: 'bg-red-50',
    icon: 'text-red-600',
    border: 'border-red-100',
  },
  [StatCardColor.PURPLE]: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    border: 'border-purple-100',
  },
  [StatCardColor.GRAY]: {
    bg: 'bg-gray-50',
    icon: 'text-gray-600',
    border: 'border-gray-100',
  },
};

/**
 * StatCard component
 * 
 * @description
 * A single statistics card component for displaying key metrics on the dashboard.
 * Displays a title, value, optional icon, and trend indicator with proper styling.
 * Part of the StatisticsPanel (资产总览统计组件) from SWARM-003 specification.
 * 
 * @param props - StatCard component configuration
 * @returns React element with styled statistics card
 * 
 * @see {@link StatisticsPanel}
 * @see {@link https://spec.example.com/SWARM-003|SWARM-003 Specification}
 * 
 * @example
 * Basic usage:
 * ```tsx
 * <StatCard
 *   title="资产总量"
 *   value={1234}
 *   icon={<AssetIcon />}
 *   color="blue"
 * />
 * ```
 * 
 * With trend indicator:
 * ```tsx
 * <StatCard
 *   title="在线资产"
 *   value={892}
 *   trend={{ value: 3.5, direction: 'up' }}
 *   color="green"
 * />
 * ```
 * 
 * @since 1.0
 */
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  color = StatCardColor.BLUE,
  loading = false,
  unit,
  ariaLabel,
  className = '',
}) => {
  /**
   * Formats the value for display
   * 
   * @description
   * Converts numeric values to locale-formatted strings
   * and appends unit suffix if provided
   */
  const formattedValue = useMemo(() => {
    if (typeof value === 'string') {
      return unit ? `${value}${unit}` : value;
    }
    const formatted = value.toLocaleString('zh-CN');
    return unit ? `${formatted}${unit}` : formatted;
  }, [value, unit]);
  
  /**
   * Computes color-specific styling classes
   */
  const colorClasses = useMemo(() => {
    return colorConfig[color] || colorConfig[StatCardColor.GRAY];
  }, [color]);
  
  /**
   * Generates accessibility attributes
   */
  const accessibilityProps = useMemo(() => {
    if (ariaLabel) {
      return { 'aria-label': ariaLabel };
    }
    return {
      'aria-label': `${title}: ${formattedValue}${trend ? `, 趋势: ${trend.direction}` : ''}`,
    };
  }, [title, formattedValue, trend, ariaLabel]);
  
  /**
   * Loading skeleton state
   */
  if (loading) {
    return (
      <div
        className={`bg-white rounded-xl p-6 border border-gray-100 shadow-sm ${className}`}
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-8 bg-gray-200 rounded w-2/3 mb-4" />
          <div className="h-3 bg-gray-200 rounded w-1/4" />
        </div>
        <span className="sr-only">加载中...</span>
      </div>
    );
  }
  
  return (
    <div
      className={`
        bg-white rounded-xl p-6 border ${colorClasses.border} shadow-sm
        hover:shadow-md transition-shadow duration-200
        ${className}
      `}
      data-testid="stat-card"
      {...accessibilityProps}
    >
      {/* Header with icon and title */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`p-2 rounded-lg ${colorClasses.bg}`}>
              <span className={`block ${colorClasses.icon}`}>
                {icon}
              </span>
            </div>
          )}
          <h3 className="text-sm font-medium text-gray-600">
            {title}
          </h3>
        </div>
      </div>
      
      {/* Value display */}
      <div className="mb-2" data-testid="stat-card-value">
        <span className="text-3xl font-bold text-gray-900">
          {formattedValue}
        </span>
      </div>
      
      {/* Trend indicator */}
      {trend && (
        <div className="mt-2" data-testid="stat-card-trend">
          <TrendIndicator
            value={trend.value}
            direction={trend.direction}
            suffix={trend.suffix}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Default props for StatCard component
 * 
 * @description
 * Provides default configuration values when props are not explicitly provided
 */
StatCard.defaultProps = {
  color: StatCardColor.BLUE,
  loading: false,
  className: '',
};

export default StatCard;

// Named exports for enhanced tree-shaking and granular imports
export { StatCard, TrendIndicator, StatCardColor, TrendDirection };
export type { StatCardProps, TrendIndicatorProps };