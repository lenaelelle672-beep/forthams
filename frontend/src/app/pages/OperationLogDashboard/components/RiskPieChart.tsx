/**
 * RiskPieChart Component
 * 
 * 操作日志仪表板 - 风险分布饼图组件
 * 展示各类风险等级的操作占比分布
 * 
 * @since 1.0.0
 * @ SWARM-003 Operation Log Dashboard
 */

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

// ============================================================
// Type Definitions
// ============================================================

/**
 * 风险等级枚举
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * 风险分布数据项
 */
export interface RiskDistributionItem {
  level: RiskLevel;
  count: number;
  ratio: number;
  label?: string;
}

/**
 * RiskPieChart 组件属性接口
 */
export interface RiskPieChartProps {
  /** 风险分布数据数组 */
  data: RiskDistributionItem[];
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 自定义风险等级颜色映射 */
  colors?: Record<RiskLevel, string>;
  /** 饼图直径占比 (0-1)，默认 0.8 */
  radiusRatio?: number;
  /** 是否显示图例，默认 true */
  showLegend?: boolean;
  /** 是否显示数据标签，默认 true */
  showLabel?: boolean;
  /** 组件高度，默认 300px */
  height?: number | string;
  /** 饼图中心标题 */
  title?: string;
  /** 点击扇区回调 */
  onSectorClick?: (level: RiskLevel, item: RiskDistributionItem) => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================================
// Default Configuration
// ============================================================

/**
 * 默认风险等级颜色配置
 * 对应附录 6.1 风险等级定义
 */
export const DEFAULT_RISK_COLORS: Record<RiskLevel, string> = {
  LOW: '#52c41a',      // 绿色 - 低风险
  MEDIUM: '#faad14',   // 橙色 - 中风险
  HIGH: '#fa8c16',     // 珊瑚色 - 高风险
  CRITICAL: '#ff4d4f', // 红色 - 极高风险
};

/**
 * 风险等级中文标签映射
 */
export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW: '低风险',
  MEDIUM: '中风险',
  HIGH: '高风险',
  CRITICAL: '极高风险',
};

/**
 * 风险等级图标映射 (用于图例)
 */
export const RISK_LEVEL_ICONS: Record<RiskLevel, string> = {
  LOW: 'circle',
  MEDIUM: 'roundRect',
  HIGH: 'triangle',
  CRITICAL: 'diamond',
};

// ============================================================
// Component Implementation
// ============================================================

/**
 * 风险分布饼图组件
 * 
 * @description
 * 使用 ECharts 渲染交互式风险分布饼图，支持：
 * - 自定义颜色配置
 * - 交互式扇区点击
 * - 响应式尺寸调整
 * - 加载状态占位
 * 
 * @example
 * ```tsx
 * <RiskPieChart
 *   data={[
 *     { level: 'LOW', count: 150, ratio: 60.0 },
 *     { level: 'MEDIUM', count: 60, ratio: 24.0 },
 *     { level: 'HIGH', count: 25, ratio: 10.0 },
 *     { level: 'CRITICAL', count: 15, ratio: 6.0 },
 *   ]}
 *   onSectorClick={(level, item) => console.log(level, item)}
 * />
 * ```
 */
const RiskPieChart: React.FC<RiskPieChartProps> = ({
  data,
  loading = false,
  colors = DEFAULT_RISK_COLORS,
  radiusRatio = 0.8,
  showLegend = true,
  showLabel = true,
  height = 300,
  title,
  onSectorClick,
  className = '',
}) => {
  // DOM ref for ECharts instance
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  // ============================================================
  // Chart Configuration
  // ============================================================

  /**
   * 构建 ECharts 配置选项
   * @performance O(n) 时间复杂度，n 为 data 数组长度
   */
  const buildChartOption = (): echarts.EChartsOption => {
    // 准备饼图数据
    const pieData = data.map((item) => ({
      name: item.label || RISK_LEVEL_LABELS[item.level],
      value: item.count,
      level: item.level,
      ratio: item.ratio,
    }));

    // 构建图例数据
    const legendData = data.map((item) => ({
      name: item.label || RISK_LEVEL_LABELS[item.level],
      icon: RISK_LEVEL_ICONS[item.level],
    }));

    // 配置项
    const option: echarts.EChartsOption = {
      // ATB-BC-001: 防御性检查 - 标题可选
      title: title
        ? {
            text: title,
            left: 'center',
            top: 10,
            textStyle: {
              fontSize: 16,
              fontWeight: 500,
              color: '#333',
            },
          }
        : undefined,
      // ATB-BC-002: tooltip 配置
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const { name, value, data } = params;
          return `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="font-weight: 600; margin-bottom: 4px;">${name}</div>
              <div>操作次数: <strong>${value}</strong></div>
              <div>占比: <strong>${data.ratio.toFixed(1)}%</strong></div>
            </div>
          `;
        },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e8e8e8',
        borderWidth: 1,
        textStyle: {
          color: '#333',
        },
      },
      // ATB-BC-003: 图例配置
      legend: showLegend
        ? {
            show: true,
            orient: 'horizontal',
            bottom: 10,
            data: legendData,
            itemWidth: 14,
            itemHeight: 14,
            itemGap: 16,
            textStyle: {
              color: '#666',
              fontSize: 12,
            },
            formatter: (name: string) => {
              const item = data.find(
                (d) => (d.label || RISK_LEVEL_LABELS[d.level]) === name
              );
              return item ? `${name} (${item.count})` : name;
            },
          }
        : undefined,
      // ATB-BC-004: 饼图系列配置
      series: [
        {
          name: '风险分布',
          type: 'pie',
          radius: [`${(1 - radiusRatio) * 50}%`, `${radiusRatio * 50}%`],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2,
          },
          // ATB-BC-005: 标签配置
          label: showLabel
            ? {
                show: true,
                position: 'outside',
                formatter: '{b}\n{d}%',
                color: '#666',
                fontSize: 12,
                lineHeight: 18,
              }
            : { show: false },
          labelLine: {
            show: showLabel,
            lineStyle: {
              color: '#ccc',
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              scale: true,
              scaleSize: 10,
            },
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
          },
          data: pieData,
          // ATB-BC-006: 颜色映射
          color: data.map((item) => colors[item.level]),
        },
      ],
      // ATB-BC-007: 动画配置
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut',
    };

    return option;
  };

  // ============================================================
  // Chart Lifecycle
  // ============================================================

  /**
   * 初始化 ECharts 实例
   * @performance O(1) 时间复杂度
   */
  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化 ECharts 实例
    chartInstanceRef.current = echarts.init(chartRef.current);

    // 绑定扇区点击事件
    if (onSectorClick) {
      chartInstanceRef.current.on('click', (params: any) => {
        const { data } = params;
        if (data && data.level) {
          const item = data as RiskDistributionItem & { level: RiskLevel };
          onSectorClick(item.level, item);
        }
      });
    }

    // 组件卸载时销毁实例
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, [onSectorClick]);

  /**
   * 更新图表数据
   * @performance O(n) 时间复杂度
   */
  useEffect(() => {
    if (!chartInstanceRef.current) return;

    // ATB-BC-001: 防御性检查 - 空数据处理
    if (!data || data.length === 0) {
      chartInstanceRef.current.setOption({
        series: [
          {
            data: [],
          },
        ],
      });
      return;
    }

    // 更新配置
    const option = buildChartOption();
    chartInstanceRef.current.setOption(option, true);
  }, [data, colors, showLegend, showLabel, radiusRatio, title]);

  /**
   * 响应式尺寸调整
   * @performance O(1) 时间复杂度
   */
  useEffect(() => {
    const handleResize = () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // ============================================================
  // Render
  // ============================================================

  /**
   * 计算容器高度样式
   */
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: typeof height === 'number' ? `${height}px` : height,
    minHeight: typeof height === 'number' ? `${height}px` : height,
  };

  // ATB-BC-008: 加载状态渲染
  if (loading) {
    return (
      <div
        className={`risk-pie-chart risk-pie-chart--loading ${className}`}
        style={containerStyle}
        data-testid="risk-chart"
      >
        <div className="risk-pie-chart__loader">
          <div className="risk-pie-chart__spinner" />
          <span className="risk-pie-chart__loading-text">加载中...</span>
        </div>
      </div>
    );
  }

  // ATB-BC-009: 空数据状态渲染
  if (!data || data.length === 0) {
    return (
      <div
        className={`risk-pie-chart risk-pie-chart--empty ${className}`}
        style={containerStyle}
        data-testid="risk-chart"
      >
        <div className="risk-pie-chart__empty">
          <span className="risk-pie-chart__empty-icon">📊</span>
          <span className="risk-pie-chart__empty-text">暂无风险分布数据</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`risk-pie-chart ${className}`}
      style={containerStyle}
      data-testid="risk-chart"
    >
      <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

// ============================================================
// Default Export with Memoization
// ============================================================

/**
 * 风险分布饼图组件 (带记忆化优化)
 * 
 * @performance 使用 React.memo 避免不必要的重渲染
 *               当 data, colors, loading 未变化时不会重渲染
 */
export const MemoizedRiskPieChart = React.memo(RiskPieChart);

export default MemoizedRiskPieChart;