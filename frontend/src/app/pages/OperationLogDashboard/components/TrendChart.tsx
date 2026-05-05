/**
 * TrendChart - 资产趋势折线图组件
 * 用于展示资产新增趋势的 ECharts 折线图
 * @module OperationLogDashboard/components/TrendChart
 * @description 仪表板趋势图表组件，支持资产数量趋势可视化
 */
import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';

export interface TrendChartData {
  /** X轴标签（时间序列） */
  labels: string[];
  /** Y轴数值（资产数量） */
  values: number[];
}

export interface TrendChartProps {
  /** 图表标题 */
  title?: string;
  /** 图表数据 */
  data: TrendChartData;
  /** 加载状态 */
  loading?: boolean;
  /** 图表高度，默认 280px */
  height?: number;
}

/**
 * TrendChart 组件
 * 使用 ECharts 渲染资产趋势折线图，支持响应式自适应
 */
const TrendChart: React.FC<TrendChartProps> = ({
  title = '资产新增趋势',
  data,
  loading = false,
  height = 280
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 初始化 ECharts 实例
  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  // 响应窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 计算数据范围，用于 Y 轴自适应
  const yAxisMax = useMemo(() => {
    if (!data?.values?.length) return undefined;
    const maxValue = Math.max(...data.values);
    return Math.ceil(maxValue * 1.2); // 向上取整并预留 20% 空间
  }, [data?.values]);

  // ECharts 配置
  const chartOptions: echarts.EChartsOption = useMemo(() => ({
    title: {
      text: title,
      left: 'left',
      top: 10,
      textStyle: {
        fontSize: 16,
        fontWeight: 500,
        color: '#303133'
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e4e7ed',
      borderWidth: 1,
      textStyle: {
        color: '#303133',
        fontSize: 12
      },
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: '#909399'
        }
      },
      formatter: (params: any) => {
        const item = params[0];
        if (!item) return '';
        return `
          <div style="padding: 4px 8px;">
            <div style="font-weight: 500; margin-bottom: 4px;">${item.name}</div>
            <div style="color: #409eff;">
              <span style="font-weight: 600;">${item.value}</span> 件
            </div>
          </div>
        `;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '18%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data?.labels || [],
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: '#dcdfe6'
        }
      },
      axisLabel: {
        color: '#606266',
        fontSize: 11
      },
      axisTick: {
        alignWithLabel: true
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: yAxisMax,
      axisLine: {
        show: false
      },
      axisLabel: {
        color: '#606266',
        fontSize: 11
      },
      splitLine: {
        lineStyle: {
          color: '#ebeef5',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        name: '新增资产',
        type: 'line',
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: 6,
        data: data?.values || [],
        lineStyle: {
          width: 2,
          color: '#409eff'
        },
        itemStyle: {
          color: '#409eff',
          borderColor: '#fff',
          borderWidth: 2,
          shadowColor: 'rgba(64, 158, 255, 0.3)',
          shadowBlur: 4
        },
        emphasis: {
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: 'rgba(64, 158, 255, 0.5)'
          }
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
          ])
        }
      }
    ],
    animationDuration: 800,
    animationEasing: 'cubicOut'
  }), [data, title, yAxisMax]);

  // 更新图表配置
  useEffect(() => {
    if (loading || !chartInstance.current) return;

    chartInstance.current.setOption(chartOptions, true);
  }, [chartOptions, loading]);

  // 加载状态骨架屏
  if (loading) {
    return (
      <div
        className="trend-chart trend-chart--loading"
        style={{ height }}
        data-testid="trend-chart-loading"
      >
        <div className="el-skeleton is-animated" style={{ padding: '40px 20px 20px' }}>
          <div className="el-skeleton__item" style={{ width: '100%', height: height - 60 }} />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={chartRef}
      className="trend-chart"
      style={{ height, width: '100%' }}
      data-testid="trend-chart"
    />
  );
};

export default TrendChart;