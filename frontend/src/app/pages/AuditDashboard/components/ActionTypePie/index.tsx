/**
 * ActionTypePie Component
 * 
 * Displays the distribution of audit operation action types as a donut chart.
 * Part of the SWARM-AUD-001 Operation Log Dashboard.
 * 
 * @module AuditDashboard/components/ActionTypePie
 * @requires recharts
 * @requires antd
 */

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Spin } from 'antd';

/**
 * Props for ActionTypePie component
 * 
 * @interface ActionTypePieProps
 */
export interface ActionTypePieProps {
  /**
   * Data mapping action types to their counts
   * Key: action type string (e.g., "CREATE", "UPDATE", "DELETE", "QUERY")
   * Value: count of occurrences
   */
  data: Record<string, number>;
  
  /** Loading state indicator */
  loading?: boolean;
  
  /** Height of the chart container in pixels */
  height?: number;
}

/**
 * Color palette for pie chart segments
 * Provides 8 distinct colors for action type differentiation
 */
const CHART_COLORS: string[] = [
  '#1890ff', // blue - primary action
  '#52c41a', // green - success states
  '#faad14', // yellow - warnings
  '#f5222d', // red - destructive actions
  '#722ed1', // purple - administrative
  '#13c2c2', // cyan - informational
  '#eb2f96', // magenta - special operations
  '#fa8c16', // orange - misc operations
];

/**
 * Maximum number of legend items to display
 */
const MAX_LEGEND_ITEMS: number = 5;

/**
 * ActionTypePie displays a donut chart showing the distribution of audit operation types.
 * 
 * Features:
 * - Donut chart visualization with customizable inner radius
 * - Top 5 action types displayed in legend (others grouped or hidden)
 * - Interactive tooltips showing exact counts and percentages
 * - Loading state with spinner overlay
 * - Empty state when no data available
 * 
 * @param props - Component props
 * @param props.data - Record of action type to count mapping
 * @param props.loading - Whether data is being loaded
 * @param props.height - Chart container height (default: 300)
 * @returns React component
 * 
 * @example
 * ```tsx
 * // Basic usage with action type counts
 * <ActionTypePie 
 *   data={{ 
 *     CREATE: 45, 
 *     UPDATE: 30, 
 *     DELETE: 15, 
 *     QUERY: 10 
 *   }}
 * />
 * 
 * // With loading state
 * <ActionTypePie 
 *   data={actionTypeData}
 *   loading={isLoading}
 *   height={400}
 * />
 * ```
 * 
 * @since 1.0.0
 * @performance Memoizes processed chart data to prevent unnecessary recalculations
 */
export const ActionTypePie: React.FC<ActionTypePieProps> = ({
  data,
  loading = false,
  height = 300,
}) => {
  /**
   * Process and transform raw data into chart-compatible format
   * - Converts Record<string, number> to PieChart data array
   * - Sorts by count descending
   * - Limits to top N items for legend readability
   * 
   * @performance useMemo prevents recalculation on each render
   */
  const chartData = useMemo(() => {
    if (!data || typeof data !== 'object') {
      return [];
    }

    const entries = Object.entries(data).filter(([_, count]) => count > 0);
    
    const sortedEntries = entries.sort(([, a], [, b]) => b - a);
    
    const total = sortedEntries.reduce((sum, [_, count]) => sum + count, 0);

    return sortedEntries.slice(0, MAX_LEGEND_ITEMS).map(([name, value], index) => ({
      name,
      value,
      percentage: total > 0 ? ((value / total) * 100).toFixed(1) : '0',
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [data]);

  /**
   * Calculate total count from data for display purposes
   */
  const totalCount = useMemo(() => {
    return Object.values(data || {}).reduce((sum, count) => sum + count, 0);
  }, [data]);

  /**
   * Custom tooltip formatter for chart hover interaction
   */
  const customTooltipFormatter = (value: number, name: string, props: { payload?: { percentage?: string } }) => {
    const percentage = props.payload?.percentage || '0';
    return [`${value} 次 (${percentage}%)`, name];
  };

  /**
   * Custom legend formatter to show name and count
   */
  const customLegendFormatter = (value: string, entry: { payload?: { value?: number; percentage?: string } }) => {
    const count = entry.payload?.value || 0;
    const percentage = entry.payload?.percentage || '0';
    return (
      <span style={{ color: '#595959', marginRight: 12 }}>
        {value}: {count} ({percentage}%)
      </span>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div 
        className="action-type-pie-container"
        style={{ 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#fafafa',
          borderRadius: 8,
          border: '1px solid #f0f0f0',
        }}
      >
        <Spin tip="加载中..." />
      </div>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <div 
        className="action-type-pie-container"
        style={{ 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#fafafa',
          borderRadius: 8,
          border: '1px solid #f0f0f0',
          color: '#8c8c8c',
        }}
      >
        暂无操作类型数据
      </div>
    );
  }

  return (
    <div 
      className="action-type-pie-container"
      style={{ 
        height, 
        background: '#fff',
        borderRadius: 8,
        padding: '16px 16px 8px 16px',
        border: '1px solid #f0f0f0',
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <h4 style={{ margin: 0, color: '#262626', fontWeight: 500 }}>
          操作类型分布
        </h4>
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>
          共 {totalCount} 条记录
        </span>
      </div>
      
      <ResponsiveContainer width="100%" height={height - 50}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color}
                stroke="#fff"
                strokeWidth={2}
              />
            ))}
          </Pie>
          
          <Tooltip 
            formatter={customTooltipFormatter}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          />
          
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={customLegendFormatter}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ActionTypePie;