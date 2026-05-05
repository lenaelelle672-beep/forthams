import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Card, Spin, Empty, Button, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTopOperators } from '../hooks/useTopOperators';
import type { TopOperatorItem } from '../types';

const { Text } = Typography;

/**
 * 操作人排行 TOP10 横向条形图组件。
 *
 * 基于全局时间范围，展示操作次数排名前 10 的操作人。
 * Y 轴为操作人姓名，X 轴为操作次数，条目按操作次数从高到低排列（最高的条在顶部）。
 * 数据通过 useTopOperators hook 获取，自动响应全局时间范围变化。
 *
 * @see ATB-04 操作人排行 TOP10 横向条形图
 */
const TopOperatorsChart: React.FC = () => {
  const { data, loading, error, refetch } = useTopOperators();

  /**
   * 将数据按操作次数升序排列（ECharts yAxis 从下到上渲染），
   * 保证最高的条形出现在图表顶部。防御性限制最多 10 条。
   */
  const sortedData = useMemo<TopOperatorItem[]>(() => {
    if (!data || data.length === 0) return [];
    return [...data]
      .sort((a, b) => b.count - a.count) // 先降序以取前 10
      .slice(0, 10)
      .sort((a, b) => a.count - b.count); // 再升序以适配 ECharts 从下到上的渲染
  }, [data]);

  const chartOption = useMemo(() => {
    if (sortedData.length === 0) return {};

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '3%',
        right: '12%',
        bottom: '3%',
        top: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: '操作次数',
        axisLabel: { color: '#8c8c8c' },
        splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
      },
      yAxis: {
        type: 'category',
        data: sortedData.map((item) => item.name),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#d9d9d9' } },
        axisLabel: {
          color: '#595959',
          width: 80,
          overflow: 'truncate' as const,
        },
      },
      series: [
        {
          name: '操作次数',
          type: 'bar' as const,
          data: sortedData.map((item) => item.count),
          barWidth: '60%',
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#69c0ff' },
              { offset: 1, color: '#1890ff' },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: 'right' as const,
            formatter: '{c}',
            color: '#595959',
            fontSize: 12,
          },
          emphasis: {
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#40a9ff' },
                { offset: 1, color: '#096dd9' },
              ]),
            },
          },
        },
      ],
    };
  }, [sortedData]);

  return (
    <Card
      title="操作人排行 TOP10"
      data-testid="top-operators-chart"
      extra={
        !loading && !error && sortedData.length > 0 ? (
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={refetch}
            size="small"
            aria-label="刷新排行数据"
          />
        ) : null
      }
    >
      {loading ? (
        <div
          style={{
            height: 380,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spin size="large" />
        </div>
      ) : error ? (
        <div
          style={{
            height: 380,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <Text type="danger">{error}</Text>
          <Button
            type="primary"
            ghost
            icon={<ReloadOutlined />}
            onClick={refetch}
          >
            重试
          </Button>
        </div>
      ) : sortedData.length === 0 ? (
        <div
          style={{
            height: 380,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Empty description="暂无数据" />
        </div>
      ) : (
        <ReactECharts
          option={chartOption}
          style={{ height: 380, width: '100%' }}
          notMerge={true}
          lazyUpdate={true}
          opts={{ renderer: 'canvas' }}
        />
      )}
    </Card>
  );
};

export default TopOperatorsChart;