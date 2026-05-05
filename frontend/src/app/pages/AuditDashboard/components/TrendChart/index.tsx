/**
 * TrendChart Component
 * 
 * Displays operation trend data as a line chart using Recharts.
 * Shows daily operation counts over the selected time range (typically last 7 days).
 * 
 * @component
 * @requires recharts
 * @since 1.0.0
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TrendChartProps {
  /** Data to display in the chart, keyed by date string (YYYY-MM-DD) */
  data: Record<string, number>;
  /** Loading state indicator */
  loading?: boolean;
  /** Height of the chart container in pixels */
  height?: number;
  /** Color of the trend line */
  lineColor?: string;
}

/**
 * Transform raw data object into array format for Recharts
 * 
 * @param data - Record of date strings to counts
 * @returns Array of { date, count } objects sorted by date
 * @performance Time complexity O(n log n) due to sorting
 */
const transformChartData = (data: Record<string, number>) => {
  return Object.entries(data)
    .map(([date, count]) => ({
      date,
      count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Custom tooltip formatter for chart interactions
 */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        padding: '8px 12px',
      }}>
        <p style={{ margin: 0, fontWeight: 500 }}>{label}</p>
        <p style={{ margin: '4px 0 0', color: '#1890ff' }}>
          操作次数: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

/**
 * TrendChart displays a line chart showing operation trends over time.
 * 
 * @example
 * ```tsx
 * <TrendChart 
 *   data={{ "2025-01-01": 42, "2025-01-02": 38 }}
 *   height={300}
 *   loading={false}
 * />
 * ```
 */
const TrendChart: React.FC<TrendChartProps> = ({
  data,
  loading = false,
  height = 300,
  lineColor = '#1890ff',
}) => {
  const chartData = transformChartData(data);

  if (loading) {
    return (
      <div 
        style={{ 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          borderRadius: '8px',
          border: '1px solid #f0f0f0',
        }}
      >
        <span style={{ color: '#999' }}>加载中...</span>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div 
        style={{ 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          borderRadius: '8px',
          border: '1px solid #f0f0f0',
        }}
      >
        <span style={{ color: '#999' }}>暂无趋势数据</span>
      </div>
    );
  }

  return (
    <div 
      className="recharts-container"
      style={{ 
        height, 
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '16px',
        border: '1px solid #f0f0f0',
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => value.slice(5)} // Show MM-DD format
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            allowDecimals={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={() => '操作次数'}
          />
          <Line
            type="monotone"
            dataKey="count"
            name="操作次数"
            stroke={lineColor}
            strokeWidth={2}
            dot={{ r: 4, fill: lineColor }}
            activeDot={{ r: 6 }}
            animationDuration={500}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

TrendChart.displayName = 'TrendChart';

export default TrendChart;

// Named exports for granular imports
export { TrendChart };
export type { TrendChartProps };