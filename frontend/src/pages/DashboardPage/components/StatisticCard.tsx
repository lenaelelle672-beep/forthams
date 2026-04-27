/**
 * StatisticCard Component
 * 
 * Displays a single statistic metric with optional trend indicator.
 * Used in DashboardPage for asset classification statistics and status distribution.
 * 
 * @component
 * @example
 * ```tsx
 * <StatisticCard
 *   title="服务器"
 *   value={42}
 *   trend={+5}
 *   icon={<ServerIcon />}
 * />
 * ```
 */

import React from 'react';
import { Card, Typography, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';

const { Text, Title } = Typography;

export interface StatisticCardProps {
  /** Card title (e.g., asset category name) */
  title: string;
  /** Numeric value to display */
  value: number | string;
  /** Optional trend percentage (positive = up, negative = down) */
  trend?: number;
  /** Optional icon to display */
  icon?: React.ReactNode;
  /** Card background color */
  color?: string;
  /** Custom CSS class name */
  className?: string;
  /** Loading state */
  loading?: boolean;
  /** Click handler */
  onClick?: () => void;
}

/**
 * StatisticCard displays a single metric with trend indicator.
 * 
 * @param props - StatisticCardProps
 * @returns React component
 */
export const StatisticCard: React.FC<StatisticCardProps> = ({
  title,
  value,
  trend,
  icon,
  color = '#1890ff',
  className,
  loading = false,
  onClick,
}) => {
  /**
   * Determines trend styling based on value.
   * Positive trend shows green, negative shows red.
   */
  const getTrendColor = (): string => {
    if (!trend) return '#8c8c8c';
    return trend > 0 ? '#52c41a' : '#ff4d4f';
  };

  /**
   * Renders trend indicator icon and percentage.
   */
  const renderTrend = () => {
    if (trend === undefined || trend === null) return null;
    
    const isPositive = trend > 0;
    const IconComponent = isPositive ? ArrowUpOutlined : ArrowDownOutlined;
    
    return (
      <Space size={4}>
        <IconComponent style={{ color: getTrendColor() }} />
        <Text style={{ color: getTrendColor(), fontSize: 12 }}>
          {Math.abs(trend)}%
        </Text>
      </Space>
    );
  };

  const cardStyles: CSSProperties = {
    borderRadius: 8,
    transition: 'all 0.3s ease',
    cursor: onClick ? 'pointer' : 'default',
  };

  const headerStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  };

  const valueStyles: CSSProperties = {
    fontSize: 32,
    fontWeight: 700,
    color: '#262626',
    lineHeight: 1.2,
  };

  return (
    <Card
      className={className}
      style={cardStyles}
      styles={{ body: { padding: 20 } }}
      loading={loading}
      onClick={onClick}
      hoverable={!!onClick}
    >
      <div style={headerStyles}>
        <Text type="secondary" style={{ fontSize: 14 }}>
          {title}
        </Text>
        {icon && (
          <span style={{ color, fontSize: 20 }}>{icon}</span>
        )}
      </div>
      
      <div style={valueStyles}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      
      {renderTrend()}
    </Card>
  );
};

export default StatisticCard;