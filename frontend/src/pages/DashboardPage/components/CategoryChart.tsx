/**
 * CategoryChart Component
 * 
 * 资产分类统计图表组件，用于展示资产按分类分布的饼图/柱状图可视化。
 * 
 * @description
 * - 展示资产分类统计的分布情况
 * - 支持饼图和柱状图两种展示模式
 * - 包含加载状态、错误状态、空数据状态处理
 * - 数据来源于 AssetStatisticsService
 * 
 * @component
 * @example
 * ```tsx
 * <CategoryChart
 *   data={categoryStatistics}
 *   loading={false}
 *   chartType="pie"
 * />
 * ```
 */

import React, { useState, useMemo } from 'react';
import { Card, Segmented, Empty, Spin, Alert } from 'antd';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

// 资产分类枚举
export type AssetCategory = 
  | '服务器'
  | '网络设备'
  | '存储设备'
  | '软件许可'
  | '云资源';

// 图表数据类型
export interface CategoryDataItem {
  category: AssetCategory;
  count: number;
  percentage: number;
}

// 组件 Props 定义
export interface CategoryChartProps {
  /** 分类统计数据 */
  data: CategoryDataItem[];
  /** 加载状态 */
  loading?: boolean;
  /** 图表类型：饼图/柱状图 */
  chartType?: 'pie' | 'bar';
  /** 错误信息 */
  error?: string | null;
  /** 是否显示百分比 */
  showPercentage?: boolean;
  /** 图表高度 */
  height?: number;
  /** 是否显示图例 */
  showLegend?: boolean;
  /** 自定义颜色列表 */
  colorList?: string[];
  /** 标题 */
  title?: string;
  /** 点击回调 */
  onCategoryClick?: (category: AssetCategory, data: CategoryDataItem) => void;
}

// 默认颜色列表
const DEFAULT_COLORS = [
  '#5470c6', // 服务器 - 蓝
  '#91cc75', // 网络设备 - 绿
  '#fac858', // 存储设备 - 黄
  '#ee6666', // 软件许可 - 红
  '#73c0de', // 云资源 - 青
];

// 分类名称映射（英文转中文显示）
const CATEGORY_NAME_MAP: Record<AssetCategory, string> = {
  '服务器': '服务器',
  '网络设备': '网络设备',
  '存储设备': '存储设备',
  '软件许可': '软件许可',
  '云资源': '云资源',
};

/**
 * CategoryChart 组件
 * 
 * 用于展示资产分类统计的图表组件，支持饼图和柱状图两种展示模式。
 * 提供完整的加载状态、错误状态、空数据状态处理。
 */
export const CategoryChart: React.FC<CategoryChartProps> = ({
  data,
  loading = false,
  chartType = 'pie',
  error = null,
  showPercentage = true,
  height = 300,
  showLegend = true,
  colorList = DEFAULT_COLORS,
  title = '资产分类统计',
  onCategoryClick,
}) => {
  const [selectedChartType, setSelectedChartType] = useState<'pie' | 'bar'>(chartType);
  
  // 计算总数
  const totalCount = useMemo(() => {
    return data.reduce((sum, item) => sum + item.count, 0);
  }, [data]);

  // 生成饼图配置
  const getPieOption = useMemo((): EChartsOption => {
    const pieData = data.map((item, index) => ({
      name: CATEGORY_NAME_MAP[item.category] || item.category,
      value: item.count,
      itemStyle: {
        color: colorList[index % colorList.length],
      },
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const { name, value, percent } = params;
          return `${name}<br/>数量: ${value}<br/>占比: ${percent}%`;
        },
      },
      legend: showLegend ? {
        orient: 'horizontal',
        bottom: 10,
        data: data.map(item => CATEGORY_NAME_MAP[item.category] || item.category),
      } : undefined,
      series: [
        {
          name: title,
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: showPercentage,
            formatter: '{b}: {c} ({d}%)',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          data: pieData,
        },
      ],
    };
  }, [data, colorList, showLegend, showPercentage, title]);

  // 生成柱状图配置
  const getBarOption = useMemo((): EChartsOption => {
    const categories = data.map(item => CATEGORY_NAME_MAP[item.category] || item.category);
    const values = data.map((item, index) => ({
      value: item.count,
      itemStyle: {
        color: colorList[index % colorList.length],
      },
    }));

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => {
          const item = params[0];
          return `${item.name}<br/>数量: ${item.value}`;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: showLegend ? '15%' : '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          interval: 0,
          rotate: 0,
        },
      },
      yAxis: {
        type: 'value',
        name: '资产数量',
      },
      series: [
        {
          name: title,
          type: 'bar',
          barWidth: '50%',
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
          },
          data: values,
        },
      ],
    };
  }, [data, colorList, showLegend, title]);

  // 获取当前图表配置
  const currentOption = useMemo(() => {
    return selectedChartType === 'pie' ? getPieOption : getBarOption;
  }, [selectedChartType, getPieOption, getBarOption]);

  // 处理图表点击
  const handleChartClick = (params: any) => {
    if (onCategoryClick && params.name) {
      const category = data.find(
        item => (CATEGORY_NAME_MAP[item.category] || item.category) === params.name
      );
      if (category) {
        onCategoryClick(category.category, category);
      }
    }
  };

  // 渲染加载状态
  if (loading) {
    return (
      <Card title={title} style={{ height: height + 80 }}>
        <div 
          style={{ 
            height, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}
        >
          <Spin size="large" tip="加载中..." />
        </div>
      </Card>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <Card title={title} style={{ height: height + 80 }}>
        <Alert
          message="数据加载失败"
          description={error}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  // 渲染空数据状态
  if (!data || data.length === 0) {
    return (
      <Card title={title} style={{ height: height + 80 }}>
        <Empty 
          description="暂无资产分类数据" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      </Card>
    );
  }

  return (
    <Card 
      title={title}
      extra={
        <Segmented
          value={selectedChartType}
          onChange={(value) => setSelectedChartType(value as 'pie' | 'bar')}
          options={[
            { label: '饼图', value: 'pie' },
            { label: '柱状图', value: 'bar' },
          ]}
        />
      }
      style={{ height: height + 80 }}
    >
      <div 
        ref={(node) => {
          if (node && !loading && !error && data.length > 0) {
            const chart = echarts.getInstanceByDom(node);
            if (chart) {
              chart.setOption(currentOption);
              chart.off('click');
              chart.on('click', handleChartClick);
            } else {
              const newChart = echarts.init(node);
              newChart.setOption(currentOption);
              newChart.on('click', handleChartClick);
            }
          }
        }}
        style={{ 
          height, 
          width: '100%' 
        }}
        data-testid="category-chart"
      />
    </Card>
  );
};

export default CategoryChart;