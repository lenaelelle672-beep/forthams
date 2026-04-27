/**
 * AssetCategoryChart Component
 * 
 * Displays the distribution of assets across different categories using a donut chart.
 * Part of the Dashboard data visualization system (SWARM-003).
 * 
 * @description
 * This component renders an interactive ECharts donut chart showing asset category
 * distribution. It supports tooltips on hover and responsive layout.
 * 
 * @features
 * - Donut chart visualization of asset categories
 * - Interactive tooltips showing category details
 * - Responsive container with proper sizing
 * - Loading and empty states
 * - Accessible chart alternatives
 * 
 * @usage
 * ```tsx
 * <AssetCategoryChart 
 *   data={categoryData}
 *   loading={isLoading}
 *   onCategoryClick={(categoryId) => navigateToCategory(categoryId)}
 * />
 * ```
 * 
 * @dependencies
 * - echarts: ^5.4.0
 * - echarts-for-react: ^3.0.0
 * 
 * @see SPEC.md - SWARM-003 Dashboard Data Visualization
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';

// Type definitions for chart data
export interface CategoryDataItem {
  /** Unique identifier for the category */
  categoryId: string | number;
  /** Display name of the category */
  categoryName: string;
  /** Number of assets in this category */
  assetCount: number;
  /** Percentage share of total assets */
  percentage: number;
  /** Optional color for the chart segment */
  color?: string;
}

export interface AssetCategoryChartProps {
  /** Array of category distribution data */
  data: CategoryDataItem[];
  /** Loading state indicator */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Callback when a category segment is clicked */
  onCategoryClick?: (categoryId: string | number, categoryName: string) => void;
  /** Chart title displayed above the chart */
  title?: string;
  /** Custom height for the chart container */
  height?: string | number;
  /** Whether to show the legend */
  showLegend?: boolean;
  /** CSS class name for custom styling */
  className?: string;
}

// Default color palette for chart segments
const DEFAULT_COLOR_PALETTE = [
  '#5470C6', '#91CC75', '#FAC858', '#EE6666', '#73C0DE',
  '#3BA272', '#FC8452', '#9A60B4', '#EA7CCC', '#0068B7',
  '#33BDCB', '#F0AA55', '#A28CD6', '#FF6B6B', '#4ECDC4'
];

/**
 * Formats a number with thousands separator
 * 
 * @param value - The number to format
 * @returns Formatted string with comma separators
 */
const formatNumber = (value: number): string => {
  return value.toLocaleString('zh-CN');
};

/**
 * Calculates percentage with fixed decimal places
 * 
 * @param value - The percentage value
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * AssetCategoryChart Component
 * 
 * Renders an interactive donut chart displaying asset category distribution.
 * Features include tooltips, click handlers, and responsive design.
 */
const AssetCategoryChart: React.FC<AssetCategoryChartProps> = ({
  data,
  loading = false,
  error = null,
  onCategoryClick,
  title,
  height = 300,
  showLegend = true,
  className = ''
}) => {
  const { t } = useTranslation();
  const chartRef = useRef<ReactECharts>(null);
  const [chartReady, setChartReady] = useState(false);

  /**
   * Handles chart click events for category selection
   * 
   * @param params - ECharts event parameters containing clicked data
   */
  const handleChartClick = useCallback((params: echarts.ECElementEvent) => {
    if (params.componentType === 'series' && onCategoryClick) {
      const dataIndex = params.dataIndex;
      const clickedItem = data[dataIndex];
      if (clickedItem) {
        onCategoryClick(clickedItem.categoryId, clickedItem.categoryName);
      }
    }
  }, [data, onCategoryClick]);

  /**
   * Prepares ECharts configuration options
   * 
   * @returns Configured ECharts option object
   */
  const getChartOption = useCallback((): EChartsOption => {
    const processedData = data.map((item, index) => ({
      name: item.categoryName,
      value: item.assetCount,
      itemStyle: {
        color: item.color || DEFAULT_COLOR_PALETTE[index % DEFAULT_COLOR_PALETTE.length]
      },
      categoryId: item.categoryId,
      percentage: item.percentage
    }));

    const totalAssets = data.reduce((sum, item) => sum + item.assetCount, 0);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e0e0e0',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: '#333',
          fontSize: 13
        },
        formatter: (params: echarts.TooltipComponentFormatterCallbackParams) => {
          const param = params as { name: string; value: number; percent: number; data: { percentage: number } };
          return `
            <div style="font-weight: 600; margin-bottom: 8px;">
              ${param.name}
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px;">
              <span>数量:</span>
              <span style="font-weight: 500;">${formatNumber(param.value)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px;">
              <span>占比:</span>
              <span style="font-weight: 500;">${formatPercentage(param.percent)}</span>
            </div>
          `;
        }
      },
      legend: showLegend ? {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        itemWidth: 14,
        itemHeight: 14,
        itemGap: 12,
        textStyle: {
          color: '#666',
          fontSize: 12
        },
        formatter: (name: string) => {
          const item = data.find(d => d.categoryName === name);
          if (item) {
            return `{name|${name}}  {value|${formatNumber(item.assetCount)}}`;
          }
          return name;
        },
        rich: {
          name: {
            color: '#666',
            fontSize: 12,
            verticalAlign: 'middle'
          },
          value: {
            color: '#333',
            fontSize: 12,
            fontWeight: 600,
            align: 'right'
          }
        }
      } : undefined,
      series: [
        {
          name: t('dashboard.categoryDistribution') || '资产分类分布',
          type: 'pie',
          radius: ['45%', '70%'],
          center: showLegend ? ['35%', '50%'] : ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              scale: true,
              scaleSize: 10
            },
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              formatter: `{total|${formatNumber(totalAssets)}}\n{label|资产总数}`
            },
            labelLine: {
              show: false
            }
          },
          labelLine: {
            show: false
          },
          data: processedData,
          animationType: 'scale',
          animationEasing: 'elasticOut',
          animationDelay: (idx: number) => Math.random() * 200 + idx * 50
        }
      ]
    };
  }, [data, showLegend, t]);

  /**
   * Handles chart initialization completion
   */
  const handleChartInit = useCallback(() => {
    setChartReady(true);
  }, []);

  /**
   * Handles events when chart is ready
   */
  useEffect(() => {
    if (chartReady && chartRef.current) {
      const chartInstance = chartRef.current.getEchartsInstance();
      chartInstance.on('click', handleChartClick);
      
      return () => {
        chartInstance.off('click', handleChartClick);
      };
    }
  }, [chartReady, handleChartClick]);

  /**
   * Updates chart when data changes
   */
  useEffect(() => {
    if (chartReady && chartRef.current) {
      const chartInstance = chartRef.current.getEchartsInstance();
      chartInstance.setOption(getChartOption());
    }
  }, [data, chartReady, getChartOption]);

  // Render loading state
  if (loading) {
    return (
      <div 
        className={`asset-category-chart asset-category-chart--loading ${className}`}
        style={{ height }}
        role="status"
        aria-label={t('common.loading') || '加载中'}
      >
        <div className="asset-category-chart__loading-spinner">
          <div className="spinner" />
          <span>{t('dashboard.loadingChart') || '加载图表...'}</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div 
        className={`asset-category-chart asset-category-chart--error ${className}`}
        style={{ height }}
        role="alert"
      >
        <div className="asset-category-chart__error-content">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!data || data.length === 0) {
    return (
      <div 
        className={`asset-category-chart asset-category-chart--empty ${className}`}
        style={{ height }}
        role="status"
      >
        <div className="asset-category-chart__empty-content">
          <span className="empty-icon">📊</span>
          <span>{t('dashboard.noCategoryData') || '暂无分类数据'}</span>
        </div>
      </div>
    );
  }

  // Render main chart
  return (
    <div 
      className={`asset-category-chart ${className}`}
      role="img"
      aria-label={t('dashboard.chartAriaLabel') || '资产分类分布图表'}
    >
      {title && (
        <h3 className="asset-category-chart__title">{title}</h3>
      )}
      <div className="asset-category-chart__container" style={{ height }}>
        <ReactECharts
          ref={chartRef}
          option={getChartOption()}
          style={{ height: '100%', width: '100%' }}
          onChartInit={handleChartInit}
          opts={{
            renderer: 'canvas',
            devicePixelRatio: window.devicePixelRatio || 1
          }}
          theme="default"
        />
      </div>
    </div>
  );
};

AssetCategoryChart.displayName = 'AssetCategoryChart';

export default AssetCategoryChart;