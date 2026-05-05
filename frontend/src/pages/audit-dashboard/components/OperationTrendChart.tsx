import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, Spin, Button, Empty, Radio } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useAuditDashboardStore } from '../store/audit-dashboard-store';
import { useAuditTrends } from '../hooks/useAuditTrends';
import type { TrendDataPoint } from '../types';

/** Granularity type matching the Zustand store definition. */
type Granularity = 'day' | 'week' | 'month';

/** Chinese labels for the granularity radio group. */
const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: '日',
  week: '周',
  month: '月',
};

/**
 * OperationTrendChart – 操作趋势折线图（Layer 4）
 *
 * Renders an ECharts smooth area-line chart of audit-log operation counts over
 * time. The granularity (日/周/月) is persisted to the shared Zustand store so
 * that other consumers can react to changes. Data is provided by the
 * `useAuditTrends` hook which automatically re-fetches when the global date
 * range or granularity changes.
 *
 * @see ATB-02 – 操作趋势折线图渲染与粒度切换
 */
const OperationTrendChart: React.FC = () => {
  const granularity = useAuditDashboardStore((s) => s.granularity);
  const setGranularity = useAuditDashboardStore((s) => s.setGranularity);

  const { data, loading, error, refetch } = useAuditTrends();

  const dataPoints: TrendDataPoint[] = data?.dataPoints ?? [];

  /**
   * Build the ECharts option object.
   * Memoised to avoid re-computation on every render.
   */
  const chartOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderWidth: 1,
        borderColor: '#e8e8e8',
        textStyle: { color: '#333' },
        formatter: (params: Array<{ axisValue: string; value: number }>) => {
          const point = params?.[0];
          if (!point) return '';
          return `<div style="padding:4px 0">
            <div style="font-weight:600;margin-bottom:4px">${point.axisValue}</div>
            <div>操作次数：<span style="color:#1890ff;font-weight:600">${point.value}</span></div>
          </div>`;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '12%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        boundaryGap: false,
        data: dataPoints.map((d) => d.date),
        axisLine: { lineStyle: { color: '#d9d9d9' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#8c8c8c',
          fontSize: 12,
          formatter: (value: string) => {
            if (granularity === 'day') {
              return value.length >= 10 ? value.slice(5) : value;
            }
            return value;
          },
        },
      },
      yAxis: {
        type: 'value' as const,
        name: '操作次数',
        nameTextStyle: { color: '#8c8c8c', fontSize: 12 },
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: 'dashed' as const, color: '#f0f0f0' } },
        axisLabel: { color: '#8c8c8c' },
      },
      series: [
        {
          name: '操作次数',
          type: 'line' as const,
          smooth: true,
          symbolSize: 6,
          showSymbol: dataPoints.length <= 60,
          data: dataPoints.map((d) => d.count),
          lineStyle: { width: 2.5, color: '#1890ff' },
          itemStyle: { color: '#1890ff' },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24, 144, 255, 0.35)' },
                { offset: 1, color: 'rgba(24, 144, 255, 0.02)' },
              ],
            },
          },
        },
      ],
    };
  }, [dataPoints, granularity]);

  /** Render the inner content based on current state. */
  const renderContent = () => {
    if (loading) {
      return (
        <div
          style={{
            height: 350,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spin size="large" tip="加载中...">
            <div style={{ height: 350 }} />
          </Spin>
        </div>
      );
    }

    if (error) {
      return (
        <div
          style={{
            height: 350,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p style={{ color: '#ff4d4f', marginBottom: 16 }}>{error}</p>
          <Button icon={<ReloadOutlined />} onClick={refetch}>
            重试
          </Button>
        </div>
      );
    }

    if (dataPoints.length === 0) {
      return (
        <div
          style={{
            height: 350,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Empty description="暂无数据" />
        </div>
      );
    }

    return (
      <ReactECharts
        option={chartOption}
        style={{ height: 350, width: '100%' }}
        notMerge={true}
        lazyUpdate={true}
      />
    );
  };

  return (
    <Card
      title="操作趋势"
      data-testid="trend-chart"
      extra={
        <Radio.Group
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as Granularity)}
          size="small"
          data-testid="granularity-radio"
          optionType="button"
          buttonStyle="solid"
        >
          {(['day', 'week', 'month'] as Granularity[]).map((g) => (
            <Radio.Button key={g} value={g}>
              {GRANULARITY_LABELS[g]}
            </Radio.Button>
          ))}
        </Radio.Group>
      }
    >
      {renderContent()}
    </Card>
  );
};

export default OperationTrendChart;