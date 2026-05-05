<template>
  <!-- StatCard: 仪表板资产统计卡片组件 -->
  <div class="stat-card" :class="{ 'stat-card--loading': loading }">
    <!-- 骨架屏：loading 为 true 时展示 -->
    <el-skeleton v-if="loading" :rows="2" animated class="stat-card__skeleton" />

    <!-- 正常内容 -->
    <template v-else>
      <div class="stat-card__header">
        <!-- 图标区域 -->
        <div v-if="icon" class="stat-card__icon-wrapper">
          <el-icon class="stat-card__icon">
            <component :is="icon" />
          </el-icon>
        </div>
        <!-- 标题 -->
        <span class="stat-card__title">{{ title }}</span>
      </div>

      <div class="stat-card__body">
        <!-- 主数值，使用千位分隔符格式化 -->
        <span class="stat-card__value">{{ formattedValue }}</span>

        <!-- 趋势角标：可选 -->
        <span
          v-if="trend !== undefined"
          class="stat-card__trend"
          :class="trend.isUp ? 'stat-card__trend--up' : 'stat-card__trend--down'"
          :aria-label="trend.isUp ? '上升趋势' : '下降趋势'"
        >
          <el-icon class="stat-card__trend-icon">
            <ArrowUp v-if="trend.isUp" />
            <ArrowDown v-else />
          </el-icon>
          <span class="stat-card__trend-value">{{ trend.value.toFixed(1) }}%</span>
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * StatCard 组件
 *
 * 仪表板资产统计卡片，用于展示单项汇总数值（如资产总数、分类数量等）。
 * 支持 loading 骨架屏、数字千位格式化、可选趋势角标与图标。
 *
 * @example
 * <StatCard title="资产总数" :value="1234" icon="Box" :trend="{ value: 5.2, isUp: true }" />
 */

import { computed } from 'vue'
import { ArrowUp, ArrowDown } from '@element-plus/icons-vue'

// ── Props 接口定义 ──────────────────────────────────────────────────
export interface StatCardTrend {
  /** 趋势百分比数值（正整数或小数） */
  value: number
  /** true = 上升（绿色），false = 下降（红色） */
  isUp: boolean
}

export interface StatCardProps {
  /** 卡片标题，如「资产总数」 */
  title: string
  /** 主展示数值（整数） */
  value: number
  /** Element Plus 图标名称，如 'Box'、'Monitor' */
  icon?: string
  /** 趋势数据（可选） */
  trend?: StatCardTrend
  /** 是否处于加载状态，true 时展示骨架屏 */
  loading?: boolean
}

const props = withDefaults(defineProps<StatCardProps>(), {
  icon: undefined,
  trend: undefined,
  loading: false,
})

// ── 计算属性 ────────────────────────────────────────────────────────

/**
 * 将 value 格式化为带千位分隔符的字符串。
 * 例如：10000 → '10,000'；1234 → '1,234'
 */
const formattedValue = computed<string>(() =>
  props.value.toLocaleString('en-US'),
)
</script>

<style scoped>
/* ── 卡片容器 ── */
.stat-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 280px;
  min-height: 120px;
  padding: 16px 20px;
  background: var(--el-bg-color, #ffffff);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  box-sizing: border-box;
  transition: box-shadow 0.2s ease;
}

.stat-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

/* ── 骨架屏 ── */
.stat-card__skeleton {
  width: 100%;
}

/* ── 头部：图标 + 标题 ── */
.stat-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-card__icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--el-color-primary-light-9, #ecf5ff);
}

.stat-card__icon {
  font-size: 18px;
  color: var(--el-color-primary, #409eff);
}

.stat-card__title {
  font-size: 13px;
  color: var(--el-text-color-secondary, #909399);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── 主体：数值 + 趋势 ── */
.stat-card__body {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.stat-card__value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-text-color-primary, #303133);
  line-height: 1;
  letter-spacing: -0.5px;
}

/* ── 趋势角标 ── */
.stat-card__trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
  margin-bottom: 3px;
}

.stat-card__trend--up {
  color: var(--el-color-success, #67c23a);
  background: var(--el-color-success-light-9, #f0f9eb);
}

.stat-card__trend--down {
  color: var(--el-color-danger, #f56c6c);
  background: var(--el-color-danger-light-9, #fef0f0);
}

.stat-card__trend-icon {
  font-size: 11px;
}

.stat-card__trend-value {
  font-variant-numeric: tabular-nums;
}
</style>