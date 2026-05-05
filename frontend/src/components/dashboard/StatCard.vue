<script setup lang="ts">
/**
 * StatCard 组件
 * @description 用于展示单个统计数据卡片，支持数值显示、同比趋势和点击跳转
 * @designRef Figma Dashboard组件库 - StatCard
 */
import { computed } from 'vue'

interface Props {
  /** 卡片标题 */
  title: string
  /** 统计数值 */
  value: number | string
  /** 同比变化值（正数表示增长，负数表示下降） */
  change?: number
  /** 变化百分比 */
  changePercent?: number
  /** 变化趋势图标类型：up-上升箭头, down-下降箭头, neutral-持平 */
  trend?: 'up' | 'down' | 'neutral'
  /** 图标类型 */
  icon?: string
  /** 图标颜色 */
  iconColor?: string
  /** 卡片背景色 */
  bgColor?: string
  /** 是否可点击跳转 */
  clickable?: boolean
  /** 跳转目标路由 */
  to?: string
  /** 加载状态 */
  loading?: boolean
  /** 错误状态 */
  error?: boolean
  /** 错误消息 */
  errorMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  change: 0,
  changePercent: 0,
  trend: 'neutral',
  icon: 'box',
  iconColor: '#409EFF',
  bgColor: '#ffffff',
  clickable: false,
  loading: false,
  error: false,
  errorMessage: '数据加载失败'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

/**
 * 格式化数值显示
 * 大于10000的数字以万为单位显示
 */
const formattedValue = computed(() => {
  if (props.loading) return '—'
  if (props.error) return '—'
  
  const numValue = typeof props.value === 'number' ? props.value : parseFloat(props.value)
  if (isNaN(numValue)) return props.value
  
  if (numValue >= 10000) {
    return (numValue / 10000).toFixed(1) + 'w'
  }
  return numValue.toLocaleString()
})

/**
 * 趋势样式类
 */
const trendClass = computed(() => {
  switch (props.trend) {
    case 'up': return 'trend-up'
    case 'down': return 'trend-down'
    default: return 'trend-neutral'
  }
})

/**
 * 趋势图标
 */
const trendIcon = computed(() => {
  switch (props.trend) {
    case 'up': return '↑'
    case 'down': return '↓'
    default: return '→'
  }
})

/**
 * 处理卡片点击
 */
const handleClick = (event: MouseEvent) => {
  if (props.clickable && !props.loading && !props.error) {
    emit('click', event)
  }
}
</script>

<template>
  <div
    class="stat-card"
    :class="{ clickable, loading, error: error }"
    :style="{ '--bg-color': bgColor, '--icon-color': iconColor }"
    :data-testid="`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`"
    @click="handleClick"
  >
    <!-- 加载状态骨架屏 -->
    <div v-if="loading" class="stat-card-skeleton">
      <div class="skeleton-icon"></div>
      <div class="skeleton-content">
        <div class="skeleton-title"></div>
        <div class="skeleton-value"></div>
        <div class="skeleton-change"></div>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="stat-card-error">
      <span class="error-icon">⚠</span>
      <span class="error-message">{{ errorMessage }}</span>
    </div>

    <!-- 正常内容 -->
    <template v-else>
      <div class="stat-card-header">
        <span class="stat-icon" :class="`icon-${icon}`">
          <!-- 根据 icon 类型显示不同图标 -->
          <svg v-if="icon === 'box'" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
          <svg v-else-if="icon === 'check-circle'" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <svg v-else-if="icon === 'pause-circle'" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
          </svg>
          <svg v-else-if="icon === 'tool'" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 7.4 1.3L9 17l9 9 1.7-7z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10"/>
          </svg>
        </span>
      </div>

      <div class="stat-card-body">
        <span class="stat-title">{{ title }}</span>
        <span class="stat-value">{{ formattedValue }}</span>
      </div>

      <div class="stat-card-footer">
        <span v-if="change !== 0" class="stat-change" :class="trendClass">
          <span class="trend-icon">{{ trendIcon }}</span>
          <span class="change-value">{{ Math.abs(change) }}</span>
          <span v-if="changePercent" class="change-percent">({{ changePercent }}%)</span>
        </span>
        <span v-else class="stat-change trend-neutral">—</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--bg-color);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  border: 1px solid #e8e8e8;
}

.stat-card.clickable {
  cursor: pointer;
}

.stat-card.clickable:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.stat-card.loading,
.stat-card.error {
  cursor: default;
}

/* 加载状态骨架屏 */
.stat-card-skeleton {
  display: flex;
  gap: 12px;
}

.skeleton-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-title {
  width: 60%;
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-value {
  width: 80%;
  height: 24px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-change {
  width: 40%;
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 错误状态 */
.stat-card-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 0;
}

.error-icon {
  font-size: 24px;
  color: #f56c6c;
}

.error-message {
  font-size: 12px;
  color: #909399;
}

/* 正常内容 */
.stat-card-header {
  display: flex;
  justify-content: flex-start;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--icon-color);
  color: #fff;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
}

.stat-card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-title {
  font-size: 14px;
  color: #909399;
  line-height: 1.4;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

.stat-card-footer {
  display: flex;
  align-items: center;
}

.stat-change {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.trend-up {
  color: #67c23a;
  background: rgba(103, 194, 58, 0.1);
}

.trend-down {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);
}

.trend-neutral {
  color: #909399;
  background: rgba(144, 147, 153, 0.1);
}

.trend-icon {
  font-size: 14px;
}

.change-value {
  font-weight: 500;
}

.change-percent {
  opacity: 0.8;
}
</style>