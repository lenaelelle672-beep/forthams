/**
 * StatCard Component
 * 
 * Displays a single statistic card with label, value, optional icon, and trend indicator.
 * Used within the StatisticsPanel component in the Dashboard page.
 * 
 * @module StatCard
 * @version 1.0.0
 * @since Iteration-5
 */

import React from 'react';
import styles from './StatCard.module.css';

/**
 * Props interface for StatCard component
 */
export interface StatCardProps {
  /** The label text displayed above the value */
  label: string;
  /** The numeric or string value to display */
  value: string | number;
  /** Optional icon component to display */
  icon?: React.ReactNode;
  /** Optional CSS class for custom styling */
  className?: string;
  /** Optional trend direction: 'up', 'down', or 'neutral' */
  trend?: 'up' | 'down' | 'neutral';
  /** Optional trend percentage/value text */
  trendValue?: string;
  /** Optional click handler for interactive cards */
  onClick?: () => void;
}

/**
 * Formats the value for display
 * - Numbers are formatted with locale-specific separators
 * - Strings are passed through as-is
 * 
 * @param val - The value to format
 * @returns Formatted string value
 */
const formatValue = (val: string | number): string => {
  if (typeof val === 'number') {
    return val.toLocaleString('zh-CN');
  }
  return val;
};

/**
 * StatCard Component
 * 
 * A single statistic card that displays:
 * - An optional icon
 * - A label (e.g., "资产总量")
 * - A formatted value
 * - An optional trend indicator (up/down/neutral)
 * 
 * @example
 * ```tsx
 * <StatCard
 *   label="资产总量"
 *   value={1523}
 *   icon={<IconAsset />}
 *   trend="up"
 *   trendValue="+12.5%"
 * />
 * ```
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  className = '',
  trend,
  trendValue,
  onClick,
}) => {
  /**
   * Determines the CSS class for trend indicator
   * @returns CSS module class name for trend styling
   */
  const getTrendClass = (): string => {
    switch (trend) {
      case 'up':
        return styles.trendUp;
      case 'down':
        return styles.trendDown;
      default:
        return styles.trendNeutral;
    }
  };

  /**
   * Gets the trend arrow symbol
   * @returns Arrow character for trend direction
   */
  const getTrendArrow = (): string => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '→';
    }
  };

  return (
    <div
      className={`${styles.statCard} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Header section with icon and label */}
      <div className={styles.header}>
        {icon && <div className={styles.iconWrapper}>{icon}</div>}
        <span className={styles.label}>{label}</span>
      </div>

      {/* Value section */}
      <div className={styles.valueWrapper}>
        <span className={styles.value}>{formatValue(value)}</span>
      </div>

      {/* Trend indicator section */}
      {trend && trendValue && (
        <div className={`${styles.trend} ${getTrendClass()}`}>
          <span className={styles.trendArrow}>{getTrendArrow()}</span>
          <span className={styles.trendValue}>{trendValue}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Default export for StatCard component
 */
export default StatCard;