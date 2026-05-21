/**
 * AssetCategoryChart Component
 * 
 * Displays the distribution of assets across different categories using a donut chart.
 * Part of the Dashboard data visualization suite (SWARM-003).
 * 
 * @description
 * - Fetches category distribution data from dashboardService
 * - Renders interactive ECharts donut/pie chart
 * - Supports tooltips and legend interaction
 * - Auto-refreshes data every 60 seconds
 * - Handles loading, error, and empty states gracefully
 * 
 * @module DashboardPage/components/AssetCategoryChart
 * @version 1.0.0
 * @since Iteration 5
 */

import React, { useEffect, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { getCategoryDistribution } from '../../services/dashboardApi';
import type { CategoryDistributionItem } from '../../types/dashboard.types';
import './AssetCategoryChart.module.css';

/**
 * Props interface for AssetCategoryChart component
 */
export interface AssetCategoryChartProps {
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Optional chart height, defaults to 280px */
  height?: number | string;
  /** Optional callback when a category segment is clicked */
  onCategoryClick?: (categoryId: string, categoryName: string) => void;
  /** Refresh interval in milliseconds, defaults to 60000 (60s) */
  refreshInterval?: number;
}

/**
 * AssetCategoryChart component
 * 
 * Renders a donut chart showing asset distribution across categories.
 * Data is fetched from the dashboard API and auto-refreshed at the specified interval.
 * 
 * @param props - Component props
 * @returns React component
 * 
 * @example
 * ```tsx
 * <AssetCategoryChart 
 *   height={300}
 *   onCategoryClick={(id, name) => console.log(id, name)}
 * />
 * ```
 */
const AssetCategoryChart: React.FC<AssetCategoryChartProps> = ({
  className = '',
  height = 280,
  onCategoryClick,
  refreshInterval = 60000,
}) => {
  // State management
  const [data, setData] = useState<CategoryDistributionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches category distribution data from the API
   * 
   * @async
   * @function fetchData
   * @returns {Promise<void>}
   */
  const fetchData = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const response = await getCategoryDistribution();
      setData(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load category data';
      setError(errorMessage);
      console.error('[AssetCategoryChart] Data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initial data fetch on component mount
   */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Auto-refresh setup with specified interval
   */
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const timer = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return () => {
      clearInterval(timer);
    };
  }, [fetchData, refreshInterval]);

  /**
   * Handles click events on chart segments
   * 
   * @param params - ECharts click event parameters
   */
  const handleChartClick = useCallback(
    (params: echarts.ECElementEvent): void => {
      if (onCategoryClick && params.data) {
        const dataItem = params.data as CategoryDistributionItem;
        onCategoryClick(dataItem.categoryId, dataItem.categoryName);
      }
    },
    [onCategoryClick],
  );

  /**
   * Generates ECharts configuration options
   * 
   * @function getChartOption
   * @returns {echarts.EChartsOption} Chart configuration
   */
  const getChartOption = (): echarts.EChartsOption => {
    // Color palette for chart segments
    const colorPalette = [
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Amber
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#06B6D4', // Cyan
      '#84CC16', // Lime
    ];

    // Calculate total for percentage display
    const total = data.reduce((sum, item) => sum + item.count, 0);

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: '#374151',
          fontSize: 13,
        },
        formatter: (params: { name?: string; value?: number; percent?: number }) => {
          if (params.name && params.value !== undefined && params.percent !== undefined) {
            return `
              <div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
              <div>
                <span style="color: #6B7280;">资产数量：</span>
                <span style="font-weight: 700;">${params.value}</span>
              </div>
              <div>
                <span style="color: #6B7280;">占比：</span>
                <span style="font-weight: 700;">${params.percent.toFixed(1)}%</span>
              </div>
            `;
          }
          return '';
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
          color: '#6B7280',
          fontSize: 12,
        },
        formatter: (name: string): string => {
          const item = data.find((d) => d.categoryName === name);
          if (item) {
            const percent = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0';
            return `${name} (${percent}%)`;
          }
          return name;
        },
      },
      series: [
        {
          name: '资产分类',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: '#e2e8f0',
            borderWidth: 2,
            borderRadius: 4,
          },
          label: {
            show: true,
            position: 'outside',
            formatter: '{b}\n{d}%',
            fontSize: 11,
            color: '#6B7280',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
              scale: true,
              scaleSize: 8,
            },
            label: {
              show: true,
              fontSize: 13,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: true,
            length: 12,
            length2: 8,
            lineStyle: {
              color: '#D1D5DB',
              width: 1,
            },
          },
          data: data.map((item, index) => ({
            value: item.count,
            name: item.categoryName,
            categoryId: item.categoryId,
            itemStyle: {
              color: colorPalette[index % colorPalette.length],
            },
          })),
        },
      ],
      // Center text showing total
      graphic: total > 0 ? [
        {
          type: 'text',
          left: 'center',
          top: '38%',
          style: {
            text: total.toLocaleString(),
            fill: '#1F2937',
            fontSize: 24,
            fontWeight: '700',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '48%',
          style: {
            text: '资产总数',
            fill: '#6B7280',
            fontSize: 12,
          },
        },
      ] : undefined,
    };
  };

  /**
   * Renders loading state
   * 
   * @function renderLoading
   * @returns {JSX.Element} Loading skeleton UI
   */
  const renderLoading = (): JSX.Element => (
    <div className="chart-loading" data-testid="chart-loading">
      <div className="loading-skeleton" />
      <span className="loading-text">加载中...</span>
    </div>
  );

  /**
   * Renders error state
   * 
   * @function renderError
   * @returns {JSX.Element} Error message UI
   */
  const renderError = (): JSX.Element => (
    <div className="chart-error" data-testid="chart-error">
      <div className="error-icon">⚠️</div>
      <p className="error-message">{error || '数据加载失败'}</p>
      <button
        type="button"
        className="retry-button"
        onClick={fetchData}
        aria-label="重新加载"
      >
        重试
      </button>
    </div>
  );

  /**
   * Renders empty state when no data available
   * 
   * @function renderEmpty
   * @returns {JSX.Element} Empty state UI
   */
  const renderEmpty = (): JSX.Element => (
    <div className="chart-empty" data-testid="chart-empty">
      <div className="empty-icon">📊</div>
      <p className="empty-message">暂无分类数据</p>
      <span className="empty-hint">请先添加资产分类</span>
    </div>
  );

  // Determine rendered height
  const chartHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`asset-category-chart ${className}`}
      style={{ height: chartHeight }}
      data-testid="asset-category-chart"
      role="figure"
      aria-label="资产分类分布图"
    >
      {/* Header Section */}
      <div className="chart-header">
        <h3 className="chart-title">资产分类分布</h3>
        <span className="chart-subtitle">按资产类别统计</span>
      </div>

      {/* Chart Content Area */}
      <div className="chart-content">
        {loading && data.length === 0 ? (
          renderLoading()
        ) : error && data.length === 0 ? (
          renderError()
        ) : data.length === 0 ? (
          renderEmpty()
        ) : (
          <ReactECharts
            option={getChartOption()}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            onEvents={{ click: handleChartClick }}
            theme="default"
            notMerge={true}
            lazyUpdate={true}
          />
        )}
      </div>
    </div>
  );
};

export default AssetCategoryChart;