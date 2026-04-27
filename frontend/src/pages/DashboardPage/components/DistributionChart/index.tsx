/**
 * DistributionChart Component
 * 
 * 资产分类分布图表组件 - 展示资产分类占比和数量分布
 * 
 * 功能特性：
 * - 饼图：展示资产分类占比
 * - 柱状图：展示分类数量
 * - 响应式布局适配
 * - 加载态/错误态/空数据态处理
 * 
 * @module DashboardPage/components/DistributionChart
 * @requires echarts
 * @since Phase 1 - Dashboard Basic Layer
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import type { ECharts, EChartsOption } from 'echarts';
import { Card, Empty, Spin, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

/** 图表数据类型 */
export interface ChartDataPoint {
  /** 分类名称 */
  name: string;
  /** 数量/值 */
  value: number;
  /** 可选：颜色 */
  color?: string;
}

/** 分布图表数据 */
export interface DistributionData {
  /** 饼图数据 */
  pieData: ChartDataPoint[];
  /** 柱状图数据 */
  barData: ChartDataPoint[];
}

/** 组件 Props */
export interface DistributionChartProps {
  /** 图表数据 */
  data?: DistributionData;
  /** 是否加载中 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 刷新回调 */
  onRefresh?: () => void;
  /** 图表高度 */
  height?: number | string;
  /** 是否显示饼图 */
  showPieChart?: boolean;
  /** 是否显示柱状图 */
  showBarChart?: boolean;
}

/** 默认颜色配置 */
const DEFAULT_COLORS = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
  '#ea7ccc',
];

/**
 * 格式化数值显示
 * 超过10000显示为"1.2万"格式
 */
const formatNumber = (value: number): string => {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return value.toLocaleString();
};

/**
 * 计算饼图扇区占比
 * 验证数据一致性使用
 */
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 100) / 100; // 保留2位小数
};

/**
 * DistributionChart 组件
 * 
 * @param props - 组件属性
 * @returns React 组件
 */
const DistributionChart: React.FC<DistributionChartProps> = ({
  data,
  loading = false,
  error = null,
  onRefresh,
  height = 400,
  showPieChart = true,
  showBarChart = true,
}) => {
  // Chart refs
  const pieChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);
  
  // ECharts instances
  const pieChartInstance = useRef<ECharts | null>(null);
  const barChartInstance = useRef<ECharts | null>(null);
  
  // Local state
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * 初始化图表实例
   * 仅在组件挂载时执行一次
   */
  useEffect(() => {
    if (showPieChart && pieChartRef.current && !pieChartInstance.current) {
      pieChartInstance.current = echarts.init(pieChartRef.current);
    }
    if (showBarChart && barChartRef.current && !barChartInstance.current) {
      barChartInstance.current = echarts.init(barChartRef.current);
    }
    setIsInitialized(true);

    // 清理函数
    return () => {
      pieChartInstance.current?.dispose();
      barChartInstance.current?.dispose();
      pieChartInstance.current = null;
      barChartInstance.current = null;
    };
  }, [showPieChart, showBarChart]);

  /**
   * 处理窗口resize事件
   * 确保图表自适应
   */
  useEffect(() => {
    const handleResize = () => {
      pieChartInstance.current?.resize();
      barChartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * 切换图例项显示/隐藏
   * @param name - 图例名称
   */
  const toggleSeries = useCallback((name: string) => {
    setHiddenSeries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  }, []);

  /**
   * 渲染饼图
   */
  const renderPieChart = useCallback(() => {
    if (!pieChartInstance.current || !data?.pieData) return;

    const pieOption: EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const { name, value, percent } = params;
          return `${name}<br/>数量: ${formatNumber(value)}<br/>占比: ${percent}%`;
        },
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        selected: Object.fromEntries(
          Array.from(hiddenSeries).map((name) => [name, false])
        ),
        selectedMode: 'single',
      },
      color: DEFAULT_COLORS,
      series: [
        {
          name: '资产分类',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data: data.pieData.map((item, index) => ({
            name: item.name,
            value: item.value,
            itemStyle: {
              color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
            },
          })),
        },
      ],
    };

    pieChartInstance.current.setOption(pieOption);

    // 绑定图例点击事件
    pieChartInstance.current.off('legendselectchanged');
    pieChartInstance.current.on('legendselectchanged', (params: any) => {
      const { selected, name } = params;
      if (!selected[name]) {
        toggleSeries(name);
      } else if (hiddenSeries.has(name)) {
        toggleSeries(name);
      }
    });
  }, [data, hiddenSeries, toggleSeries]);

  /**
   * 渲染柱状图
   */
  const renderBarChart = useCallback(() => {
    if (!barChartInstance.current || !data?.barData) return;

    const barOption: EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => {
          const { name, value } = params[0];
          return `${name}<br/>数量: ${formatNumber(value)}`;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.barData.map((item) => item.name),
        axisLabel: {
          rotate: 45,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => formatNumber(value),
        },
      },
      series: [
        {
          name: '资产数量',
          type: 'bar',
          data: data.barData.map((item, index) => ({
            value: item.value,
            itemStyle: {
              color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
            },
          })),
          barWidth: '60%',
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };

    barChartInstance.current.setOption(barOption);
  }, [data]);

  /**
   * 更新图表数据
   * 当data变化时重新渲染
   */
  useEffect(() => {
    if (isInitialized && !loading && !error && data) {
      renderPieChart();
      renderBarChart();
    }
  }, [isInitialized, loading, error, data, renderPieChart, renderBarChart]);

  /**
   * 渲染加载态
   */
  if (loading) {
    return (
      <Card className="distribution-chart-card">
        <div className="chart-loading" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" tip="图表加载中..." />
        </div>
      </Card>
    );
  }

  /**
   * 渲染错误态
   */
  if (error) {
    return (
      <Card className="distribution-chart-card">
        <div className="chart-error" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <Empty description={<span style={{ color: '#ff4d4f' }}>{error}</span>} />
          {onRefresh && (
            <Button icon={<ReloadOutlined />} onClick={onRefresh}>
              重试
            </Button>
          )}
        </div>
      </Card>
    );
  }

  /**
   * 渲染空数据态
   */
  const hasNoData = !data || (
    (!showPieChart || data.pieData.length === 0) &&
    (!showBarChart || data.barData.length === 0)
  );

  if (hasNoData) {
    return (
      <Card className="distribution-chart-card">
        <div className="chart-empty" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="暂无分类数据" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="distribution-chart-card" title="资产分类分布">
      <div className="chart-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {showPieChart && (
          <div
            ref={pieChartRef}
            className="pie-chart"
            style={{ height: typeof height === 'number' ? height / 2 : height }}
          />
        )}
        {showBarChart && (
          <div
            ref={barChartRef}
            className="bar-chart"
            style={{ height: typeof height === 'number' ? height / 2 : height }}
          />
        )}
      </div>
    </Card>
  );
};

export default DistributionChart;