/**
 * TrendChart Component
 * 
 * @description
 * Displays operation trend data as a line chart, showing the frequency
 * of operations over time. Used in the AuditDashboard to visualize
 * system usage patterns and detect anomalies.
 * 
 * @component
 * @example
 * <TrendChart
 *   :data="trendData"
 *   :loading="isLoading"
 *   :granularity="granularity"
 *   @chart-click="handleChartClick"
 * />
 */

<template>
  <div class="trend-chart-container" data-testid="trend-chart">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <span class="chart-subtitle">{{ subtitle }}</span>
    </div>
    
    <div v-if="loading" class="chart-loading" data-testid="loading-spinner">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
    
    <div 
      v-else-if="data && data.length > 0" 
      ref="chartContainer" 
      class="chart-wrapper"
    ></div>
    
    <div v-else class="chart-empty">
      <span class="empty-icon">📊</span>
      <span class="empty-text">暂无数据</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Props for TrendChart component
 */
interface Props {
  /** Trend data points containing timestamp and count */
  data?: TrendDataPoint[];
  /** Loading state indicator */
  loading?: boolean;
  /** Chart title */
  title?: string;
  /** Chart subtitle with time range info */
  subtitle?: string;
  /** Time granularity: 'hour', 'day', 'week' */
  granularity?: 'hour' | 'day' | 'week';
  /** Chart height in pixels */
  height?: number;
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  loading: false,
  title: '操作趋势',
  subtitle: '最近7天操作频次统计',
  granularity: 'day',
  height: 300,
});

// Emits for chart interactions
const emit = defineEmits<{
  (e: 'chart-click', point: TrendDataPoint): void;
  (e: 'chart-ready', instance: unknown): void;
}>();

// Refs
const chartContainer = ref<HTMLElement | null>(null);
let chartInstance: unknown = null;

/**
 * TrendDataPoint interface
 * Represents a single data point in the trend chart
 */
interface TrendDataPoint {
  timestamp: string;
  count: number;
  label?: string;
}

/**
 * Format timestamp based on granularity
 * @param timestamp - ISO timestamp string
 * @param granularity - Time granularity level
 * @returns Formatted label string
 */
function formatTimestamp(timestamp: string, granularity: string): string {
  const date = new Date(timestamp);
  
  switch (granularity) {
    case 'hour':
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    case 'day':
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    case 'week':
      return `第${getWeekNumber(date)}周`;
    default:
      return date.toLocaleDateString('zh-CN');
  }
}

/**
 * Get ISO week number
 * @param date - Date object
 * @returns Week number of the year
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Get chart colors based on theme
 * @returns Color configuration object
 */
function getChartColors(): Record<string, string> {
  return {
    primary: '#3b82f6',
    primaryLight: 'rgba(59, 130, 246, 0.2)',
    grid: '#e5e7eb',
    text: '#6b7280',
    tooltip: '#1f2937',
  };
}

/**
 * Initialize and render the ECharts instance
 * Sets up the line chart with proper configuration
 */
function initChart(): void {
  if (!chartContainer.value || !props.data?.length) return;

  // Dynamic import for ECharts (lazy load)
  import('echarts').then((echarts) => {
    if (!chartContainer.value) return;

    chartInstance = echarts.init(chartContainer.value);
    
    const colors = getChartColors();
    const labels = props.data.map((d) => 
      formatTimestamp(d.timestamp, props.granularity || 'day')
    );
    const values = props.data.map((d) => d.count);

    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: colors.tooltip,
        borderColor: colors.grid,
        textStyle: {
          color: '#fff',
        },
        formatter: (params: { name: string; value: number }[]) => {
          if (!params?.[0]) return '';
          const { name, value } = params[0];
          return `<strong>${name}</strong><br/>操作次数: ${value}`;
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
        boundaryGap: false,
        data: labels,
        axisLine: {
          lineStyle: {
            color: colors.grid,
          },
        },
        axisLabel: {
          color: colors.text,
          rotate: labels.length > 7 ? 45 : 0,
        },
      },
      yAxis: {
        type: 'value',
        name: '操作次数',
        nameTextStyle: {
          color: colors.text,
        },
        axisLine: {
          show: false,
        },
        axisLabel: {
          color: colors.text,
        },
        splitLine: {
          lineStyle: {
            color: colors.grid,
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: '操作次数',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 3,
            color: colors.primary,
          },
          itemStyle: {
            color: colors.primary,
            borderWidth: 2,
            borderColor: '#fff',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: colors.primaryLight },
                { offset: 1, color: 'rgba(59, 130, 246, 0)' },
              ],
            },
          },
          data: values,
        },
      ],
    };

    (chartInstance as echarts.ECharts).setOption(option);
    emit('chart-ready', chartInstance);

    // Handle click events
    (chartInstance as echarts.ECharts).on('click', (params: { dataIndex: number }) => {
      if (params.dataIndex >= 0 && props.data[params.dataIndex]) {
        emit('chart-click', props.data[params.dataIndex]);
      }
    });
  });
}

/**
 * Resize chart to fit container
 * Should be called when container size changes
 */
function resizeChart(): void {
  if (chartInstance) {
    (chartInstance as { resize: () => void }).resize();
  }
}

/**
 * Dispose chart instance and free resources
 * Should be called on component unmount
 */
function disposeChart(): void {
  if (chartInstance) {
    (chartInstance as { dispose: () => void }).dispose();
    chartInstance = null;
  }
}

// Watch for data changes and re-render
watch(
  () => [props.data, props.loading],
  ([newData, newLoading]) => {
    if (!newLoading && newData) {
      nextTick(() => {
        if (chartInstance) {
          disposeChart();
        }
        initChart();
      });
    }
  },
  { immediate: true }
);

// Handle resize events
onMounted(() => {
  window.addEventListener('resize', resizeChart);
  initChart();
});

// Cleanup on unmount
onUnmounted(() => {
  window.removeEventListener('resize', resizeChart);
  disposeChart();
});

// Expose methods for parent component
defineExpose({
  resize: resizeChart,
  getInstance: () => chartInstance,
});
</script>

<style scoped>
.trend-chart-container {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chart-header {
  margin-bottom: 16px;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 4px 0;
}

.chart-subtitle {
  font-size: 12px;
  color: #6b7280;
}

.chart-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  gap: 12px;
  color: #6b7280;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.chart-wrapper {
  width: 100%;
  height: v-bind('props.height + "px"');
  min-height: 200px;
}

.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  gap: 8px;
  color: #9ca3af;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
}
</style>