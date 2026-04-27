<template>
  <div class="trend-chart-container">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <div class="chart-actions">
        <slot name="actions"></slot>
      </div>
    </div>
    <div 
      ref="chartRef" 
      class="chart-canvas"
      :style="{ height: `${height}px` }"
    ></div>
    <div v-if="loading" class="chart-loading">
      <div class="loading-spinner"></div>
      <span>数据加载中...</span>
    </div>
    <div v-else-if="!hasData" class="chart-empty">
      <span>暂无数据</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * TrendChart.vue - 资产趋势折线图组件
 * 
 * 功能说明:
 * - 展示资产数量/价值的近6个月变化趋势
 * - 支持多系列数据绑定
 * - 提供 tooltip 交互和图例控制
 * 
 * 使用方式:
 * <TrendChart 
 *   :data="trendData" 
 *   :loading="false"
 *   title="资产价值趋势"
 *   :height="320"
 * />
 * 
 * @module components/dashboard
 * @author SWARM-003 Team
 * @version 1.0.0
 */

import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ECharts, EChartsOption } from 'echarts';

// 注册 ECharts 组件
echarts.use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

// Props 定义
interface Props {
  /** 图表标题 */
  title?: string;
  /** 图表数据 */
  data: TrendDataItem[];
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 图表高度（px） */
  height?: number;
  /** X轴数据类型 */
  xAxisType?: 'category' | 'time';
  /** Y轴名称 */
  yAxisName?: string;
  /** 是否显示区域填充 */
  areaStyle?: boolean;
  /** 颜色配置 */
  colors?: string[];
}

interface TrendDataItem {
  /** 日期/月份标签 */
  date: string;
  /** 数值 */
  value: number;
  /** 系列名称（多系列时使用） */
  series?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '资产趋势',
  loading: false,
  height: 320,
  xAxisType: 'category',
  yAxisName: '',
  areaStyle: true,
  colors: () => ['#5470c6', '#91cc75', '#fac858', '#ee6666'],
});

// Emits 定义
const emit = defineEmits<{
  /** 点击数据点事件 */
  (e: 'clickPoint', data: TrendDataItem, index: number): void;
  /** 图表渲染完成 */
  (e: 'ready', chart: ECharts): void;
}>();

// Refs
const chartRef = ref<HTMLElement | null>(null);
let chartInstance: ECharts | null = null;

// 计算属性
const hasData = computed(() => props.data && props.data.length > 0);

/**
 * 处理数据，转换为 ECharts 需要的格式
 */
const processedData = computed(() => {
  if (!props.data || props.data.length === 0) return { dates: [], series: [] };

  const dates = [...new Set(props.data.map(item => item.date))];
  const seriesMap = new Map<string, number[]>();
  
  // 初始化所有系列
  props.data.forEach(item => {
    const seriesName = item.series || '资产数量';
    if (!seriesMap.has(seriesName)) {
      seriesMap.set(seriesName, []);
    }
  });

  // 填充数据
  seriesMap.forEach((values, seriesName) => {
    dates.forEach(date => {
      const item = props.data.find(
        d => d.date === date && (d.series || '资产数量') === seriesName
      );
      values.push(item ? item.value : 0);
    });
  });

  return { dates, series: Array.from(seriesMap.entries()) };
});

/**
 * 初始化图表
 */
const initChart = () => {
  if (!chartRef.value || chartInstance) return;

  chartInstance = echarts.init(chartRef.value);
  updateChart();
  emit('ready', chartInstance);
};

/**
 * 更新图表配置
 */
const updateChart = () => {
  if (!chartInstance) return;

  const option: EChartsOption = {
    title: {
      show: false,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985',
        },
      },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const date = params[0].axisValue;
        let result = `<strong>${date}</strong><br/>`;
        params.forEach((item: any) => {
          const color = item.color instanceof Object 
            ? item.color.colorStops?.[0]?.color || '#5470c6'
            : item.color || '#5470c6';
          const value = item.value?.toLocaleString() || 0;
          result += `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${color};"></span>${item.seriesName}: ${value}<br/>`;
        });
        return result;
      },
    },
    legend: {
      data: processedData.value.series.map(([name]) => name),
      bottom: 0,
      type: 'scroll',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: props.xAxisType,
      data: processedData.value.dates,
      boundaryGap: false,
      axisLabel: {
        formatter: (value: string) => {
          // 格式化日期显示
          if (value.length > 7) {
            return value.substring(5);
          }
          return value;
        },
      },
    },
    yAxis: {
      type: 'value',
      name: props.yAxisName,
      nameTextStyle: {
        padding: [0, 0, 0, 40],
      },
      axisLabel: {
        formatter: (value: number) => {
          if (value >= 10000) {
            return `${(value / 10000).toFixed(1)}w`;
          }
          if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}k`;
          }
          return value.toString();
        },
      },
    },
    series: processedData.value.series.map(([name, values], index) => ({
      name,
      type: 'line',
      data: values,
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: {
        width: 2,
      },
      itemStyle: {
        color: props.colors[index % props.colors.length],
      },
      areaStyle: props.areaStyle ? {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: `${props.colors[index % props.colors.length]}80` },
          { offset: 1, color: `${props.colors[index % props.colors.length]}10` },
        ]),
      } : undefined,
      emphasis: {
        focus: 'series',
        itemStyle: {
          borderWidth: 2,
          borderColor: '#fff',
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
        },
      },
    })),
  };

  chartInstance.setOption(option, true);
};

/**
 * 处理窗口resize
 */
const handleResize = () => {
  chartInstance?.resize();
};

/**
 * 处理数据点点击
 */
const handleClick = (params: any) => {
  if (params.componentType === 'series') {
    const dataIndex = params.dataIndex;
    const seriesIndex = params.seriesIndex;
    const item = props.data[dataIndex];
    if (item) {
      emit('clickPoint', item, dataIndex);
    }
  }
};

// 监听数据变化
watch(() => props.data, () => {
  updateChart();
}, { deep: true });

// 监听加载状态
watch(() => props.loading, (isLoading) => {
  if (!isLoading && hasData.value) {
    updateChart();
  }
});

// 生命周期
onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
  chartInstance?.on('click', handleClick);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance?.off('click', handleClick);
  chartInstance?.dispose();
  chartInstance = null;
});

// 暴露方法给父组件
defineExpose({
  /** 获取 ECharts 实例 */
  getChartInstance: () => chartInstance,
  /** 刷新图表 */
  refresh: () => updateChart(),
  /** 导出图表为图片 */
  exportImage: (type: string = 'png', quality: number = 1) => {
    return chartInstance?.getDataURL({
      type,
      pixelRatio: quality,
      backgroundColor: '#fff',
    });
  },
});
</script>

<style scoped>
.trend-chart-container {
  position: relative;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.chart-actions {
  display: flex;
  gap: 8px;
}

.chart-canvas {
  width: 100%;
  min-height: 200px;
}

.chart-loading,
.chart-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #909399;
  font-size: 14px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e4e7ed;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.chart-empty {
  background: #f5f7fa;
  padding: 40px 60px;
  border-radius: 8px;
}
</style>