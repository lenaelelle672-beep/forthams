import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAuditData } from '../../hooks/useAuditData';
import type { AuditTrendPoint } from '../../types/audit.types';
import styles from './TrendChart.module.css';

/**
 * Determines the appropriate time granularity based on the query time range.
 * Per SPEC: ≤7 days → hourly, 8-30 days → daily, >30 days → weekly.
 * @param startTime - Start time of the query range (ISO 8601 UTC string)
 * @param endTime - End time of the query range (ISO 8601 UTC string)
 * @returns The granularity level for both API request and axis label formatting
 */
export function resolveGranularity(
  startTime: string,
  endTime: string
): 'hour' | 'day' | 'week' {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const diffDays = (endMs - startMs) / (1000 * 60 * 60 * 24);

  if (diffDays <= 7) return 'hour';
  if (diffDays <= 30) return 'day';
  return 'week';
}

/**
 * Formats a UTC ISO 8601 timestamp into a human-readable local-time string,
 * with the format adapted to the current granularity level.
 * @param timestamp - ISO 8601 UTC timestamp string from the API
 * @param granularity - Current display granularity
 * @returns Formatted local-time string suitable for chart axis labels
 */
export function formatTimestamp(
  timestamp: string,
  granularity: 'hour' | 'day' | 'week'
): string {
  const date = new Date(timestamp);

  switch (granularity) {
    case 'hour': {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hour = String(date.getHours()).padStart(2, '0');
      return `${month}/${day} ${hour}:00`;
    }
    case 'day': {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}/${day}`;
    }
    case 'week': {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}/${day}周`;
    }
    default:
      return date.toLocaleString();
  }
}

/**
 * Returns the Chinese label for the x-axis name based on granularity.
 * @param granularity - Current display granularity
 * @returns Localized axis name string
 */
function getGranularityAxisName(granularity: 'hour' | 'day' | 'week'): string {
  switch (granularity) {
    case 'hour':
      return '时间(小时)';
    case 'day':
      return '时间(天)';
    case 'week':
      return '时间(周)';
  }
}

/** Props for the TrendChart component */
export interface TrendChartProps {
  /** Start time of the query range in ISO 8601 UTC format */
  startTime: string;
  /** End time of the query range in ISO 8601 UTC format */
  endTime: string;
}

/**
 * TrendChart renders a line chart visualizing audit log operation frequency over time.
 *
 * Key behaviors per SPEC:
 * - Granularity auto-adapts based on the selected time range:
 *   ≤7 days → hourly, 8-30 days → daily, >30 days → weekly aggregation.
 * - All timestamps from the API (UTC) are converted to the user's local timezone for display.
 * - Chart re-renders when startTime/endTime props change, triggering a new data fetch.
 * - Handles loading, empty-data, and error states gracefully.
 * - Uses SVG renderer for accessibility and testability (ATB-06 references SVG container).
 */
export const TrendChart: React.FC<TrendChartProps> = ({ startTime, endTime }) => {
  const { trendData, trendLoading, trendError } = useAuditData(startTime, endTime);

  /** Derive granularity from the current time range */
  const granularity = useMemo(
    () => resolveGranularity(startTime, endTime),
    [startTime, endTime]
  );

  /** Build ECharts option object, memoized on data and granularity */
  const chartOption = useMemo(() => {
    // Empty / no-data state
    if (!trendData || trendData.length === 0) {
      return {
        title: {
          text: '操作趋势',
          left: 'center',
          textStyle: { fontSize: 14, color: '#666' },
        },
        graphic: {
          type: 'text' as const,
          left: 'center',
          top: 'middle',
          style: {
            text: '暂无数据',
            fontSize: 14,
            fill: '#999',
          },
        },
        xAxis: { show: false },
        yAxis: { show: false },
      };
    }

    const xData = trendData.map((point: AuditTrendPoint) =>
      formatTimestamp(point.timestamp, granularity)
    );
    const yData = trendData.map((point: AuditTrendPoint) => point.count);

    return {
      title: {
        text: '操作趋势',
        left: 'center',
        textStyle: { fontSize: 14, color: '#333' },
      },
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: Array<{ name: string; value: number }>) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `${p.name}<br/>操作次数: ${p.value}`;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        boundaryGap: false,
        data: xData,
        axisLabel: {
          rotate: granularity === 'hour' ? 45 : 0,
          fontSize: 11,
        },
        name: getGranularityAxisName(granularity),
      },
      yAxis: {
        type: 'value' as const,
        name: '操作次数',
        minInterval: 1,
      },
      series: [
        {
          name: '操作次数',
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: yData,
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(64,158,255,0.3)' },
                { offset: 1, color: 'rgba(64,158,255,0.02)' },
              ],
            },
          },
          lineStyle: { color: '#409EFF', width: 2 },
          itemStyle: { color: '#409EFF' },
        },
      ],
    };
  }, [trendData, granularity]);

  /** Error state rendering */
  if (trendError) {
    return (
      <div className={styles.container} data-testid="trend-chart-error">
        <div className={styles.error}>趋势数据加载失败: {trendError}</div>
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="trend-chart">
      <ReactECharts
        option={chartOption}
        style={{ height: '100%', width: '100%' }}
        showLoading={trendLoading}
        opts={{ renderer: 'svg' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};

export default TrendChart;