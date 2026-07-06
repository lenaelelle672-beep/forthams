/**
 * @module AuditTrendChart
 * @description 审计日志趋势折线图页面组件，基于 Recharts 渲染操作趋势数据。
 *
 * 支持 API data_points 格式的趋势响应，自动格式化时间轴标签，
 * 并提供加载态、空态和错误降级展示。
 *
 * 对应 SPEC: SWARM-060 Audit Log Dashboard Page
 * - ATB-06: 趋势图表渲染
 * - ATB-03: 趋势数据聚合
 *
 * @since SWARM-060
 */

import React, { useMemo } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 趋势数据点（与 auditService.TrendDataPoint 对齐） */
export interface TrendDataPoint {
  /** 时间戳，ISO 8601 UTC */
  timestamp: string;
  /** 该时间段内的操作计数 */
  count: number;
}

/** 趋势聚合响应 */
export interface AuditLogTrendResponse {
  /** 实际使用的聚合粒度 */
  granularity: 'hour' | 'day' | 'week';
  /** 趋势数据点列表 */
  data_points: TrendDataPoint[];
}

/** 组件属性 */
export interface AuditTrendChartProps {
  /** 趋势数据 */
  trendData: AuditLogTrendResponse | null;
  /** 加载状态 */
  loading?: boolean;
  /** 图表容器高度，默认 320px */
  height?: number;
  /** 错误信息 */
  error?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 聚合粒度中文标签映射 */
const GRANULARITY_LABELS: Record<string, string> = {
  hour: '按小时',
  day: '按天',
  week: '按周',
};

/**
 * 格式化时间轴标签
 *
 * @param timestamp ISO 8601 时间戳
 * @param granularity 聚合粒度
 * @returns 格式化后的标签字符串
 */
const formatTimeLabel = (timestamp: string, granularity: string): string => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp;

  if (granularity === 'hour') {
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:00`;
  }
  if (granularity === 'week') {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  }
  // day
  return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
};

/**
 * 自定义 Tooltip 组件
 *
 * @param props Recharts Tooltip props
 * @returns React 组件
 */
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          padding: '8px 12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}
      >
        <p style={{ margin: 0, fontWeight: 500 }}>{label}</p>
        <p style={{ margin: '4px 0 0', color: '#1890ff' }}>
          操作次数: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AuditTrendChart — 审计日志趋势折线图页面组件
 *
 * 基于 Recharts LineChart 渲染 API 返回的趋势数据点，
 * 自动根据聚合粒度格式化 X 轴标签。
 *
 * @param props 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <AuditTrendChart
 *   trendData={{
 *     granularity: 'day',
 *     data_points: [
 *       { timestamp: '2025-06-01T00:00:00Z', count: 42 },
 *       { timestamp: '2025-06-02T00:00:00Z', count: 38 },
 *     ],
 *   }}
 *   loading={false}
 * />
 * ```
 */
export const AuditTrendChart: React.FC<AuditTrendChartProps> = ({
  trendData,
  loading = false,
  height = 320,
  error = null,
}) => {
  /**
   * 将 API data_points 转换为 Recharts 数据数组
   */
  const chartData = useMemo(() => {
    if (!trendData?.data_points?.length) return [];
    return trendData.data_points.map((point) => ({
      label: formatTimeLabel(point.timestamp, trendData.granularity),
      count: point.count,
    }));
  }, [trendData]);

  /** 聚合粒度标签 */
  const granularityLabel = trendData
    ? GRANULARITY_LABELS[trendData.granularity] ?? trendData.granularity
    : '';

  // 加载态
  if (loading) {
    return (
      <Card data-testid="audit-trend-chart-loading">
        <CardHeader>
          <CardTitle className="text-base">操作趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span style={{ color: '#999' }}>加载中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 错误态
  if (error) {
    return (
      <Card data-testid="audit-trend-chart-error">
        <CardHeader>
          <CardTitle className="text-base">操作趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            style={{
              height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f5222d',
            }}
          >
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 空态
  if (!chartData.length) {
    return (
      <Card data-testid="audit-trend-chart-empty">
        <CardHeader>
          <CardTitle className="text-base">操作趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            style={{
              height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
            }}
          >
            暂无趋势数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="audit-trend-chart">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>操作趋势</span>
          {granularityLabel && (
            <span className="text-xs text-muted-foreground font-normal">
              聚合粒度: {granularityLabel}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height, backgroundColor: '#fff', borderRadius: 8, padding: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
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
                stroke="#1890ff"
                strokeWidth={2}
                dot={{ r: 4, fill: '#1890ff' }}
                activeDot={{ r: 6 }}
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

AuditTrendChart.displayName = 'AuditTrendChart';

export default AuditTrendChart;
