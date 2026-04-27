<template>
  <div class="category-chart-wrapper" data-testid="category-chart">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <el-select
        v-if="enableFilter"
        v-model="selectedCategory"
        placeholder="筛选分类"
        clearable
        size="small"
        class="category-filter"
        @change="handleFilterChange"
      >
        <el-option
          v-for="item in categoryOptions"
          :key="item.categoryId"
          :label="item.categoryName"
          :value="item.categoryId"
        />
      </el-select>
    </div>
    <div
      ref="chartRef"
      class="chart-container"
      :style="{ height: `${height}px` }"
    />
    <div v-if="loading" class="chart-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>
    <div v-if="error" class="chart-error" data-testid="error-state">
      <el-icon><WarningFilled /></el-icon>
      <span>{{ error }}</span>
      <el-button size="small" @click="handleRetry">重试</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 分类分布图表组件
 * @description 展示资产分类占比的环形图组件，支持图例筛选、hover 高亮、点击跳转
 * @see {@link https://echarts.apache.org/}
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { Loading, WarningFilled } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'

// 类型定义
export interface CategoryItem {
  categoryId: string
  categoryName: string
  count: number
  percentage?: number
}

interface Props {
  /** 图表标题 */
  title?: string
  /** 分类数据列表 */
  data?: CategoryItem[]
  /** 图表高度 */
  height?: number
  /** 是否显示筛选下拉框 */
  enableFilter?: boolean
  /** 是否显示图例 */
  showLegend?: boolean
  /** 图例位置 */
  legendPosition?: 'top' | 'bottom' | 'left' | 'right'
  /** 加载状态 */
  loading?: boolean
  /** 错误信息 */
  error?: string
}

interface Emits {
  (e: 'category-click', category: CategoryItem): void
  (e: 'filter-change', categoryId: string | null): void
  (e: 'chart-ready', chartInstance: echarts.ECharts): void
}

const props = withDefaults(defineProps<Props>(), {
  title: '资产分类分布',
  data: () => [],
  height: 300,
  enableFilter: false,
  showLegend: true,
  legendPosition: 'bottom',
  loading: false,
  error: ''
})

const emit = defineEmits<Emits>()

const router = useRouter()
const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const selectedCategory = ref<string | null>(null)

// 计算筛选后的数据
const filteredData = computed(() => {
  if (!selectedCategory.value) {
    return props.data
  }
  return props.data.filter(item => item.categoryId === selectedCategory.value)
})

// 分类选项（用于筛选下拉框）
const categoryOptions = computed(() => props.data)

// 颜色配置
const colorPalette = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
  '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#48b8d0'
]

/**
 * 生成图表配置
 */
const getChartOption = (): EChartsOption => {
  const data = filteredData.value.map((item, index) => ({
    name: item.categoryName,
    value: item.count,
    categoryId: item.categoryId,
    itemStyle: {
      color: colorPalette[index % colorPalette.length]
    }
  }))

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const { name, value, percent } = params
        return `
          <div style="font-weight: 500;">
            <div>${name}</div>
            <div style="margin-top: 4px;">
              数量: <span style="color: #5470c6;">${value}</span>
            </div>
            <div>
              占比: <span style="color: #5470c6;">${percent.toFixed(1)}%</span>
            </div>
          </div>
        `
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e4e7ed',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: {
        color: '#303133'
      }
    },
    legend: props.showLegend ? {
      show: true,
      orient: props.legendPosition === 'top' || props.legendPosition === 'bottom' ? 'horizontal' : 'vertical',
      top: props.legendPosition === 'top' ? 0 : props.legendPosition === 'bottom' ? 'auto' : 10,
      bottom: props.legendPosition === 'bottom' ? 0 : 'auto',
      left: props.legendPosition === 'left' ? 0 : 'auto',
      right: props.legendPosition === 'right' ? 0 : 'auto',
      textStyle: {
        color: '#606266'
      },
      formatter: (name: string) => {
        const item = props.data.find(d => d.categoryName === name)
        if (item) {
          return `${name} (${item.count})`
        }
        return name
      }
    } : { show: false },
    series: [
      {
        name: '资产分类',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          position: 'outside',
          formatter: '{b}: {d}%',
          color: '#606266',
          fontSize: 12
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
            borderWidth: 3
          },
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: true,
          lineStyle: {
            color: '#c0c4cc'
          },
          smooth: 0.2,
          length: 10,
          length2: 20
        },
        data,
        animationType: 'scale',
        animationEasing: 'elasticOut',
        animationDuration: 800
      }
    ]
  }
}

/**
 * 初始化图表
 */
const initChart = async () => {
  if (!chartRef.value) return

  await nextTick()

  if (chartInstance) {
    chartInstance.dispose()
  }

  chartInstance = echarts.init(chartRef.value)

  chartInstance.on('click', (params: any) => {
    const category = filteredData.value.find(
      item => item.categoryName === params.name
    )
    if (category) {
      handleCategoryClick(category)
    }
  })

  chartInstance.on('mouseover', (params: any) => {
    if (chartInstance) {
      chartInstance.dispatchAction({
        type: 'highlight',
        seriesIndex: 0,
        dataIndex: params.dataIndex
      })
    }
  })

  chartInstance.on('mouseout', (params: any) => {
    if (chartInstance) {
      chartInstance.dispatchAction({
        type: 'downplay',
        seriesIndex: 0,
        dataIndex: params.dataIndex
      })
    }
  })

  updateChart()
  emit('chart-ready', chartInstance)
}

/**
 * 更新图表
 */
const updateChart = () => {
  if (!chartInstance) return

  const option = getChartOption()
  chartInstance.setOption(option, true)
}

/**
 * 处理分类点击事件
 * @param category 选中的分类项
 */
const handleCategoryClick = (category: CategoryItem) => {
  emit('category-click', category)
  // 路由跳转到分类筛选页
  router.push({
    path: '/assets',
    query: { categoryId: category.categoryId }
  })
}

/**
 * 处理筛选变化
 * @param categoryId 选中的分类ID
 */
const handleFilterChange = (categoryId: string | null) => {
  emit('filter-change', categoryId)
  updateChart()
}

/**
 * 重试加载
 */
const handleRetry = () => {
  emit('filter-change', null)
  selectedCategory.value = null
  updateChart()
}

/**
 * 响应式调整图表大小
 */
const handleResize = () => {
  if (chartInstance) {
    chartInstance.resize()
  }
}

// 监听数据变化
watch(() => props.data, () => {
  updateChart()
}, { deep: true })

// 监听高度变化
watch(() => props.height, async () => {
  await nextTick()
  handleResize()
})

// 挂载时初始化
onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

// 卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})

// 暴露方法供父组件调用
defineExpose({
  /** 更新图表数据 */
  updateData: (data: CategoryItem[]) => {
    updateChart()
  },
  /** 获取图表实例 */
  getChartInstance: () => chartInstance,
  /** 导出图表为图片 */
  exportImage: (type: string = 'png') => {
    if (chartInstance) {
      return chartInstance.getDataURL({
        type,
        pixelRatio: 2,
        backgroundColor: '#fff'
      })
    }
    return null
  }
})
</script>

<style scoped>
.category-chart-wrapper {
  position: relative;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.04);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.chart-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.category-filter {
  width: 160px;
}

.chart-container {
  width: 100%;
  min-height: 200px;
}

.chart-loading,
.chart-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #909399;
  font-size: 14px;
}

.chart-error {
  color: #f56c6c;
}

.chart-error .el-button {
  margin-top: 8px;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .category-chart-wrapper {
    padding: 12px;
  }

  .chart-title {
    font-size: 14px;
  }

  .category-filter {
    width: 100%;
  }
}

@media (min-width: 1200px) {
  .category-chart-wrapper {
    padding: 20px;
  }

  .chart-container {
    min-height: 280px;
  }
}
</style>