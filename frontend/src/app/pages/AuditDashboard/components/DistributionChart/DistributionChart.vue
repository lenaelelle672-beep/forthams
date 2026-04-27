<template>
  <div class="distribution-chart" data-testid="distribution-chart">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <span class="chart-subtitle">{{ subtitle }}</span>
    </div>
    <div v-if="loading" class="chart-loading" data-testid="loading-spinner">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
    <div v-else-if="error" class="chart-error">
      <span class="error-message">{{ error }}</span>
      <button class="retry-button" @click="handleRetry">重试</button>
    </div>
    <div v-else class="chart-container">
      <div ref="chartRef" class="echarts-instance"></div>
      <div class="chart-legend">
        <div
          v-for="item in legendItems"
          :key="item.name"
          class="legend-item"
          @mouseenter="handleLegendHover(item.name)"
          @mouseleave="handleLegendLeave"
        >
          <span class="legend-color" :style="{ backgroundColor: item.color }"></span>
          <span class="legend-label">{{ item.name }}</span>
          <span class="legend-value">{{ item.value }}</span>
          <span class="legend-percentage">{{ item.percentage }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @file DistributionChart.vue
 * @desc 操作类型分布饼图组件
 * @author SWARM-003 Team
 * @version 1.0.0
 * @date 2024-01-15
 *
 * @describe
 * 该组件用于展示审计日志中不同操作类型的分布情况。
 * 支持按 CREATE, READ, UPDATE, DELETE 等类型统计频次及占比。
 * 图表数据通过 props 传入，支持加载状态、错误处理和重试机制。
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';

// ============================================================
// Types & Interfaces
// ============================================================

/**
 * 操作类型分布数据项
 */
export interface DistributionItem {
  /** 操作类型 */
  operationType: string;
  /** 操作次数 */
  count: number;
  /** 占比百分比 (0-100) */
  percentage: number;
}

/**
 * 图表图例项
 */
interface LegendItem {
  /** 图例名称 */
  name: string;
  /** 图例颜色 */
  color: string;
  /** 操作次数 */
  value: number;
  /** 占比百分比 */
  percentage: number;
}

/**
 * DistributionChart 组件 Props 定义
 */
export interface DistributionChartProps {
  /** 图表标题 */
  title?: string;
  /** 图表副标题 */
  subtitle?: string;
  /** 分布数据列表 */
  data?: DistributionItem[];
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 饼图直径大小 */
  size?: 'small' | 'medium' | 'large';
  /** 是否显示图例 */
  showLegend?: boolean;
  /** 自定义颜色数组 */
  colors?: string[];
}

// ============================================================
// Default Props
// ============================================================

const defaultProps: Required<Omit<DistributionChartProps, 'data' | 'error' | 'colors'>> = {
  title: '操作类型分布',
  subtitle: '统计各操作类型的占比',
  loading: false,
  size: 'medium',
  showLegend: true,
};

// ============================================================
// Props Definition
// ============================================================

const props = withDefaults(defineProps<DistributionChartProps>(), {
  title: () => defaultProps.title,
  subtitle: () => defaultProps.subtitle,
  loading: () => defaultProps.loading,
  error: () => null,
  size: () => defaultProps.size,
  showLegend: () => defaultProps.showLegend,
  colors: () => [
    '#5470c6', // CREATE - 蓝色
    '#91cc75', // READ - 绿色
    '#fac858', // UPDATE - 黄色
    '#ee6666', // DELETE - 红色
    '#73c0de', // 通用 - 浅蓝
    '#3ba272', // 其他 - 深绿
    '#fc8452', // 导出 - 橙色
    '#9a60b4', // 审批 - 紫色
  ],
});

// ============================================================
// Emits
// ============================================================

const emit = defineEmits<{
  /** 点击重试按钮时触发 */
  (e: 'retry'): void;
  /** 饼图扇区点击事件 */
  (e: 'itemClick', item: DistributionItem): void;
  /** 图例切换事件 */
  (e: 'legendChange', selectedLegend: string[]): void;
}>();

// ============================================================
// Refs
// ============================================================

const chartRef = ref<HTMLElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

// ============================================================
// Computed
// ============================================================

/**
 * 计算图例数据项
 * @description 根据分布数据生成图例列表
 */
const legendItems = computed<LegendItem[]>(() => {
  if (!props.data || props.data.length === 0) {
    return [];
  }

  return props.data.map((item, index) => ({
    name: getOperationTypeLabel(item.operationType),
    color: props.colors[index % props.colors.length],
    value: item.count,
    percentage: parseFloat(item.percentage.toFixed(1)),
  }));
});

/**
 * 计算饼图尺寸配置
 * @description 根据 size 属性返回 ECharts 饼图半径配置
 */
const chartRadius = computed(() => {
  switch (props.size) {
    case 'small':
      return ['0%', '60%'];
    case 'large':
      return ['0%', '80%'];
    case 'medium':
    default:
      return ['0%', '70%'];
  }
});

/**
 * 计算图表标题配置
 */
const chartTitle = computed(() => ({
  text: props.title,
  subtext: props.subtitle,
  left: 'center',
  top: 10,
  textStyle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  subtextStyle: {
    fontSize: 12,
    color: '#666',
  },
}));

// ============================================================
// Methods
// ============================================================

/**
 * 获取操作类型的中文标签
 * @param operationType - 操作类型英文标识
 * @returns 中文标签
 */
function getOperationTypeLabel(operationType: string): string {
  const labelMap: Record<string, string> = {
    CREATE: '创建',
    READ: '查看',
    UPDATE: '更新',
    DELETE: '删除',
    EXPORT: '导出',
    APPROVE: '审批',
    REJECT: '驳回',
    TRANSFER: '转移',
    IMPORT: '导入',
    LOGIN: '登录',
    LOGOUT: '登出',
  };
  return labelMap[operationType] || operationType;
}

/**
 * 初始化 ECharts 实例
 * @description 创建图表实例并绑定到 DOM 元素
 */
function initChart(): void {
  if (!chartRef.value) return;

  chartInstance = echarts.init(chartRef.value);
  updateChart();

  // 响应窗口大小变化
  window.addEventListener('resize', handleResize);
}

/**
 * 更新图表数据
 * @description 根据 props.data 更新饼图配置
 */
function updateChart(): void {
  if (!chartInstance) return;

  const option: echarts.EChartsOption = {
    title: chartTitle.value,
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const { name, value, percent } = params;
        return `<strong>${name}</strong><br/>
                操作次数: ${value}<br/>
                占比: ${percent.toFixed(1)}%`;
      },
    },
    legend: {
      show: false, // 使用自定义图例
    },
    series: [
      {
        name: '操作类型分布',
        type: 'pie',
        radius: chartRadius.value,
        center: ['50%', '55%'],
        data: props.data?.map((item, index) => ({
          name: getOperationTypeLabel(item.operationType),
          value: item.count,
          itemStyle: {
            color: props.colors[index % props.colors.length],
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        })),
        label: {
          show: props.size !== 'small',
          formatter: '{b}: {d}%',
          fontSize: 11,
        },
        labelLine: {
          show: props.size !== 'small',
        },
      },
    ],
  };

  chartInstance.setOption(option);
}

/**
 * 处理窗口大小变化
 * @description 防抖处理窗口 resize 事件
 */
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
function handleResize(): void {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    chartInstance?.resize();
  }, 100);
}

/**
 * 处理重试按钮点击
 * @description 触发 retry 事件
 */
function handleRetry(): void {
  emit('retry');
}

/**
 * 处理图例项鼠标悬停
 * @param legendName - 悬停的图例名称
 */
function handleLegendHover(legendName: string): void {
  if (!chartInstance) return;
  chartInstance.dispatchAction({
    type: 'highlight',
    seriesName: '操作类型分布',
    name: legendName,
  });
}

/**
 * 处理图例项鼠标离开
 */
function handleLegendLeave(): void {
  if (!chartInstance) return;
  chartInstance.dispatchAction({
    type: 'downplay',
    seriesName: '操作类型分布',
  });
}

/**
 * 销毁图表实例
 * @description 清理资源，移除事件监听
 */
function disposeChart(): void {
  window.removeEventListener('resize', handleResize);
  if (resizeTimer) {
    clearTimeout(resizeTimer);
    resizeTimer = null;
  }
  chartInstance?.dispose();
  chartInstance = null;
}

// ============================================================
// Lifecycle Hooks
// ============================================================

/**
 * 组件挂载时初始化图表
 */
onMounted(() => {
  initChart();
});

/**
 * 组件卸载时销毁图表
 */
onUnmounted(() => {
  disposeChart();
});

// ============================================================
// Watchers
// ============================================================

/**
 * 监听数据变化，更新图表
 */
watch(
  () => props.data,
  () => {
    updateChart();
  },
  { deep: true }
);

/**
 * 监听尺寸变化，重新设置饼图半径
 */
watch(
  () => props.size,
  () => {
    updateChart();
  }
);
</script>

<style scoped>
.distribution-chart {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 16px;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}

.chart-header {
  margin-bottom: 12px;
  text-align: center;
}

.chart-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.chart-subtitle {
  font-size: 12px;
  color: #666;
  display: block;
  margin-top: 4px;
}

.chart-loading,
.chart-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #666;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #5470c6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-message {
  color: #ee6666;
  font-size: 14px;
}

.retry-button {
  padding: 6px 16px;
  background-color: #5470c6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background-color: #4263ab;
}

.chart-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.echarts-instance {
  flex: 1;
  min-height: 200px;
}

.chart-legend {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 16px;
  padding: 0 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.legend-item:hover {
  background-color: #f5f5f5;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-label {
  flex: 1;
  font-size: 13px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-value {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.legend-percentage {
  font-size: 12px;
  color: #999;
  min-width: 45px;
  text-align: right;
}
</style>