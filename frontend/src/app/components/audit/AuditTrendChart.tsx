/**
 * @module AuditTrendChart
 * @description 审计日志趋势折线图组件，基于 Recharts 渲染操作趋势数据。
 * 支持 trend data_points 格式的 API 响应，自动格式化时间轴标签。
 *
 * 对应 SPEC: ATB-06 趋势图表渲染
 *
 * @since SWARM-030
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
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 趋势数据点（与 useAuditLogs hook 输出对齐） */
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
  /** 趋势数据（来自 useAuditLogs.trendData） */
  trendData: AuditLogTrendResponse | null;
  /** 加载状态 */
  loading?: boolean;
  /** 图表容器高度，默认 320px */
  height?: number;
  /** 趋势线颜色 */
  lineColor?: string;
  /** 错误信息（来自 API 请求失败） */
  error?: string | null;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** 格式化粒度对应的标签 */
const GRANULARITY_LABELS: Record<string, string> = {
  hour: '按小时',
  day: '按天',
  week: '按周',
};

/**
 * 格式化趋势数据点为 Recharts 可消费的数组。
 *
 * @param dataPoints 后端返回的数据点列表
 * @param granularity 聚合粒度
 * @returns 排序后的图表数据数组
 */
function transformDataPoints(
  dataPoints: TrendDataPoint[],
  granularity: 'hour' | 'day' | 'week'
): Array<{ label: string; count: number; fullTimestamp: string }> {
  return [...dataPoints]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((dp) => {
      const date = new Date(dp.timestamp);
      let label: string;

      if (granularity === 'hour') {
        // 显示 MM-DD HH:mm
        label = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      } else if (granularity === 'week') {
        // 显示 MM-DD ~ MM-DD (周一)
        label = `${date.getMonth() + 1}/${date.getDate()}`;
      } else {
        // day: 显示 MM-DD
        label = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }

      return {
        label,
        count: dp.count,
        fullTimestamp: dp.timestamp,
      };
    });
}

/**
 * 自定义 Tooltip 组件，展示完整时间与操作计数
 */
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#334155' }}>
        {label}
      </p>
      <p style={{ margin: '4px 0 0', color: '#3b82f6', fontSize: 14 }}>
        操作次数: {payload[0].value}
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AuditTrendChart — 审计日志趋势折线图
 *
 * 将 useAuditLogs hook 返回的 trendData 渲染为交互式折线图，
 * 支持按小时/天/周三种聚合粒度的自适应时间标签。
 *
 * @param props 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * const { trendData, trendLoading } = useAuditLogs(token);
 * <AuditTrendChart trendData={trendData} loading={trendLoading} />
 * ```
 */
const AuditTrendChart: React.FC<AuditTrendChartProps> = ({
  trendData,
  loading = false,
  height = 320,
  lineColor = '#3b82f6',
  error = null,
}) => {
  /** 将后端数据转换为图表格式 */
  const chartData = useMemo(() => {
    if (!trendData?.data_points?.length) return [];
    return transformDataPoints(trendData.data_points, trendData.granularity);
  }, [trendData]);

  /** 粒度标签 */
  const granularityLabel = trendData
    ? GRANULARITY_LABELS[trendData.granularity] ?? trendData.granularity
    : '';

  return (
    <Card data-testid="audit-trend-chart-container">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: lineColor,
            }}
          />
          操作趋势
          {granularityLabel && (
            <span className="text-xs text-muted-foreground font-normal" data-testid="trend-chart-granularity">
              ({granularityLabel})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* ATB-04: 接口异常降级处理 — 错误状态展示 */}
        {error ? (
          <div
            data-testid="audit-trend-chart-error"
            role="alert"
            style={{
              height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#fef2f2',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '14px',
            }}
          >
            <span>趋势数据加载失败: {error}</span>
          </div>
        ) : loading ? (
          <div
            style={{
              height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #f1f5f9',
            }}
          >
            <span className="text-muted-foreground text-sm">加载中...</span>
          </div>
        ) : chartData.length === 0 ? (
          <div
            style={{
              height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #f1f5f9',
            }}
          >
            <span className="text-muted-foreground text-sm">暂无趋势数据</span>
          </div>
        ) : (
          <div style={{ height }} data-testid="trend-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  allowDecimals={false}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '8px' }}
                  formatter={() => '操作次数'}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="操作次数"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={{ r: 3, fill: lineColor }}
                  activeDot={{ r: 5 }}
                  animationDuration={500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

AuditTrendChart.displayName = 'AuditTrendChart';

export default AuditTrendChart;
export { AuditTrendChart };
