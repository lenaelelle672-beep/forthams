/**
 * CategoryDistributionChart Component
 * 
 * @description
 * 分类分布图表组件，使用 ECharts 饼图/环形图展示各资产类别的数量占比分布。
 * 属于 SWARM-003 仪表板数据看板 Iteration 5 的 Phase 4 实施范围。
 * 
 * @features
 * - 饼图/环形图可视化
 * - 交互式 Tooltip
 * - 点击跳转功能
 * - 响应式布局适配
 * - 空数据状态友好提示
 * 
 * @see {@link https://echarts.apache.org/en/option.html#series-pie ECharts Pie Series}
 */

import React, { useCallback, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';

import { CategoryDistribution } from '../../../types/dashboard.types';

interface CategoryDistributionChartProps {
  /** 分类分布数据数组 */
  data: CategoryDistribution[];
  /** 图表加载状态 */
  loading?: boolean;
  /** 点击分类项的处理函数 */
  onCategoryClick?: (categoryId: string, categoryName: string) => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 分类分布图表组件
 * 
 * @param props - CategoryDistributionChartProps
 * @returns React 组件
 */
export const CategoryDistributionChart: React.FC<CategoryDistributionChartProps> = ({
  data,
  loading = false,
  onCategoryClick,
  className = '',
}) => {
  const { t } = useTranslation();

  /**
   * 将分类数据转换为 ECharts 饼图数据格式
   * 
   * @returns ECharts 需要的 data 数组格式
   */
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    return data.map((item) => ({
      name: item.categoryName || t('dashboard.category.unknown'),
      value: item.count || 0,
      itemStyle: {
        color: item.color || '#5470c6',
      },
      categoryId: item.categoryId,
    }));
  }, [data, t]);

  /**
   * 计算总量用于百分比计算
   */
  const totalCount = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  /**
   * ECharts 图表配置选项
   */
  const chartOption: EChartsOption = useMemo(() => {
    if (chartData.length === 0) {
      return {};
    }

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: { name: string; value: number; percent: number }) => {
          const percentValue = ((params.value / totalCount) * 100).toFixed(1);
          return `
            <div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>${t('dashboard.category.count')}:</span>
              <span style="font-weight: 500;">${params.value}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>${t('dashboard.category.percentage')}:</span>
              <span style="font-weight: 500;">${percentValue}%</span>
            </div>
          `;
        },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        borderRadius: 8,
        padding: [12, 16],
        textStyle: {
          color: '#374151',
          fontSize: 13,
        },
      },
      legend: {
        orient: 'horizontal',
        bottom: 0,
        left: 'center',
        itemWidth: 14,
        itemHeight: 14,
        itemGap: 16,
        textStyle: {
          color: '#6b7280',
          fontSize: 12,
        },
        formatter: (name: string) => {
          const item = chartData.find((d) => d.name === name);
          if (item) {
            const percent = ((item.value / totalCount) * 100).toFixed(0);
            return `{name|${name}} {value|${percent}%}`;
          }
          return name;
        },
      },
      series: [
        {
          name: t('dashboard.category.distribution'),
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#e2e8f0',
            borderWidth: 2,
          },
          label: {
            show: true,
            position: 'outside',
            formatter: '{b}: {d}%',
            fontSize: 11,
            color: '#6b7280',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              scale: 1.05,
            },
            label: {
              show: true,
              fontSize: 13,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: true,
            length: 10,
            length2: 15,
            lineStyle: {
              color: '#d1d5db',
              width: 1,
            },
          },
          data: chartData,
        },
      ],
      animationType: 'scale',
      animationEasing: 'elasticOut',
      animationDuration: 800,
    };
  }, [chartData, totalCount, t]);

  /**
   * 处理图表点击事件
   * 
   * @param params - ECharts 点击参数
   */
  const handleChartClick = useCallback(
    (params: { data: { categoryId?: string; name?: string } }) => {
      if (onCategoryClick && params.data?.categoryId) {
        onCategoryClick(params.data.categoryId, params.data.name || '');
      }
    },
    [onCategoryClick]
  );

  /**
   * 空数据状态的渲染
   */
  const renderEmptyState = () => (
    <div 
      className={`flex flex-col items-center justify-center h-64 text-slate-500 ${className}`}
      role="status"
      aria-label={t('dashboard.category.noData')}
    >
      <svg
        className="w-16 h-16 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
      <p className="text-sm">{t('dashboard.category.noData')}</p>
      <p className="text-xs mt-1 opacity-70">
        {t('dashboard.category.noDataHint')}
      </p>
    </div>
  );

  /**
   * 加载状态的渲染
   */
  const renderLoadingState = () => (
    <div 
      className={`flex flex-col items-center justify-center h-64 ${className}`}
      role="status"
      aria-label={t('dashboard.loading')}
    >
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="mt-4 text-sm text-slate-500">{t('dashboard.loading')}</p>
    </div>
  );

  // 渲染加载状态
  if (loading) {
    return renderLoadingState();
  }

  // 渲染空数据状态
  if (!data || data.length === 0) {
    return renderEmptyState();
  }

  return (
    <div 
      className={`relative w-full h-full min-h-[280px] ${className}`}
      role="img"
      aria-label={t('dashboard.category.chartAriaLabel', { count: chartData.length })}
    >
      <ReactECharts
        option={chartOption}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        onEvents={{ click: handleChartClick }}
        notMerge={true}
        lazyUpdate={true}
        theme="light"
      />
    </div>
  );
};

export default CategoryDistributionChart;