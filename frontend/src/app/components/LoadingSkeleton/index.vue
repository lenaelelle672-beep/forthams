<template>
  <div class="loading-skeleton" :class="[`loading-skeleton--${variant}`, { 'loading-skeleton--animated': animated }]">
    <!-- 卡片变体 -->
    <template v-if="variant === 'card'">
      <div class="skeleton-card">
        <div class="skeleton-card__icon">
          <el-skeleton-item variant="circle" :style="{ width: iconSize, height: iconSize }" />
        </div>
        <div class="skeleton-card__content">
          <el-skeleton-item variant="text" :style="{ width: titleWidth }" />
          <el-skeleton-item variant="h1" :style="{ width: valueWidth, marginTop: '8px' }" />
        </div>
      </div>
    </template>

    <!-- 列表变体 -->
    <template v-else-if="variant === 'list'">
      <div class="skeleton-list">
        <div v-for="i in rows" :key="i" class="skeleton-list__item">
          <el-skeleton-item variant="circle" style="width: 32px; height: 32px; flex-shrink: 0;" />
          <div class="skeleton-list__text">
            <el-skeleton-item variant="text" :style="{ width: '60%' }" />
            <el-skeleton-item variant="text" :style="{ width: '40%', marginTop: '4px' }" />
          </div>
          <el-skeleton-item variant="text" :style="{ width: '60px', flexShrink: 0 }" />
        </div>
      </div>
    </template>

    <!-- 图表变体 -->
    <template v-else-if="variant === 'chart'">
      <div class="skeleton-chart">
        <div class="skeleton-chart__header">
          <el-skeleton-item variant="text" :style="{ width: '120px' }" />
          <el-skeleton-item variant="text" :style="{ width: '80px' }" />
        </div>
        <div class="skeleton-chart__body">
          <div class="skeleton-chart__bars">
            <div v-for="i in 6" :key="i" class="skeleton-chart__bar-wrapper">
              <div 
                class="skeleton-chart__bar"
                :style="{ height: `${Math.random() * 60 + 40}%` }"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 面板变体 -->
    <template v-else-if="variant === 'panel'">
      <div class="skeleton-panel">
        <div class="skeleton-panel__header">
          <el-skeleton-item variant="text" :style="{ width: '100px' }" />
          <el-skeleton-item variant="text" :style="{ width: '50px' }" />
        </div>
        <div class="skeleton-panel__body">
          <el-skeleton :rows="rows" />
        </div>
      </div>
    </template>

    <!-- 默认/文本变体 -->
    <template v-else>
      <el-skeleton :rows="rows" :animated="animated" />
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * LoadingSkeleton 组件
 * 
 * 用于仪表板各模块加载状态的骨架屏展示
 * 支持多种变体以适配不同的展示场景
 * 
 * @example
 * // 统计卡片加载态
 * <LoadingSkeleton variant="card" />
 * 
 * // 列表加载态
 * <LoadingSkeleton variant="list" :rows="5" />
 * 
 * // 图表加载态
 * <LoadingSkeleton variant="chart" />
 * 
 * // 面板加载态
 * <LoadingSkeleton variant="panel" :rows="3" />
 */

interface Props {
  /** 骨架屏变体类型 */
  variant?: 'card' | 'list' | 'chart' | 'panel' | 'text'
  /** 行数（用于 list/panel/text 变体） */
  rows?: number
  /** 是否显示动画 */
  animated?: boolean
  /** 图标尺寸（仅 card 变体有效） */
  iconSize?: string
  /** 标题宽度（仅 card 变体有效） */
  titleWidth?: string
  /** 数值宽度（仅 card 变体有效） */
  valueWidth?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text',
  rows: 3,
  animated: true,
  iconSize: '48px',
  titleWidth: '60%',
  valueWidth: '80%'
})
</script>

<style scoped lang="scss">
.loading-skeleton {
  width: 100%;
  
  &--animated {
    :deep(.el-skeleton__item) {
      background: linear-gradient(
        90deg,
        var(--el-skeleton-color, #ebeef5) 25%,
        var(--el-skeleton-to-color, #f5f7fa) 50%,
        var(--el-skeleton-color, #ebeef5) 75%
      );
      background-size: 400% 100%;
      animation: skeleton-loading 1.4s ease-in-out infinite;
    }
  }
}

/**
 * 卡片变体样式
 * 用于资产统计卡片等场景
 */
.skeleton-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--el-bg-color, #fff);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background: var(--el-fill-color-light, #f5f7fa);
  }

  &__content {
    flex: 1;
  }
}

/**
 * 列表变体样式
 * 用于预警列表等场景
 */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--el-fill-color-light, #f5f7fa);
    border-radius: 6px;
  }

  &__text {
    flex: 1;
  }
}

/**
 * 图表变体样式
 * 用于趋势图表区域
 */
.skeleton-chart {
  padding: 16px;
  background: var(--el-bg-color, #fff);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  &__body {
    height: 200px;
  }

  &__bars {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    height: 100%;
    padding: 0 16px;
  }

  &__bar-wrapper {
    display: flex;
    align-items: flex-end;
    height: 100%;
    width: 40px;
  }

  &__bar {
    width: 100%;
    background: linear-gradient(
      180deg,
      var(--el-color-primary-light-8, #ecf5ff) 0%,
      var(--el-color-primary-light-5, #c6e2ff) 100%
    );
    border-radius: 4px 4px 0 0;
  }
}

/**
 * 面板变体样式
 * 用于预警面板等场景
 */
.skeleton-panel {
  padding: 16px;
  background: var(--el-bg-color, #fff);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
  }

  &__body {
    min-height: 100px;
  }
}

/**
 * 骨架屏加载动画
 */
@keyframes skeleton-loading {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
</style>