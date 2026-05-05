<script setup lang="ts">
/**
 * AuditEmptyState Component
 * 
 * 审计日志为空状态展示组件
 * 用于资产详情页的审计日志面板中，当没有审计记录时展示友好的空状态提示
 * 
 * @description
 * - 属于 Layer 4 原子组件层级
 * - 被 AuditLogPanel 容器组件引用
 * - 支持自定义图标、标题、描述和操作按钮
 * 
 * @example
 * ```vue
 * <AuditEmptyState
 *   title="暂无审计记录"
 *   description="该资产暂无变更历史"
 *   :action="{ label: '刷新', handler: handleRefresh }"
 * />
 * ```
 * 
 * @see {@link https://project-docs.example.com/audit-module} 审计模块文档
 * @requires Vue 3.2+
 * @since Iteration 7
 */

import { computed } from 'vue';

/**
 * Props 接口定义
 * @interface AuditEmptyStateProps
 */
interface AuditEmptyStateProps {
  /** 空状态图标组件 */
  icon?: string;
  /** 空状态标题 */
  title?: string;
  /** 空状态描述 */
  description?: string;
  /** 操作按钮配置 */
  action?: {
    label: string;
    handler: () => void;
    variant?: 'primary' | 'secondary';
  };
  /** 自定义 CSS 类名 */
  className?: string;
}

// 默认 props 值
const defaultProps = {
  title: '暂无审计记录',
  description: '当前资产暂无变更历史',
  icon: 'document',
  action: null,
  className: ''
};

/**
 * 组件 props
 * 使用 withDefaults 确保所有属性都有默认值
 */
const props = withDefaults(defineProps<AuditEmptyStateProps>(), defaultProps);

/**
 * 计算属性：合并自定义类名
 */
const containerClass = computed(() => [
  'audit-empty-state',
  props.className
]);

/**
 * 图标 SVG 路径配置
 * 支持多种图标类型
 */
const iconPaths: Record<string, string> = {
  document: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  search: 'M11 17.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM21 21l-4.35-4.35',
  chart: 'M18 20V10 M12 20V4 M6 20v-6',
  clock: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2'
};

/**
 * 获取当前图标的 SVG 路径
 */
const currentIconPath = computed(() => {
  return iconPaths[props.icon] || iconPaths.document;
});

/**
 * 操作按钮点击处理
 * 带防御性检查，确保 handler 存在
 */
function handleActionClick(): void {
  if (props.action?.handler) {
    try {
      props.action.handler();
    } catch (error) {
      console.warn('[AuditEmptyState] Action handler execution failed:', error);
    }
  }
}
</script>

<template>
  <div :class="containerClass" role="status" aria-live="polite">
    <!-- 空状态图标 -->
    <div class="audit-empty-state__icon">
      <svg
        v-if="icon === 'custom'"
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <slot name="icon" />
      </svg>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path :d="currentIconPath" />
      </svg>
    </div>

    <!-- 空状态内容 -->
    <div class="audit-empty-state__content">
      <h3 class="audit-empty-state__title">
        {{ title }}
      </h3>
      <p class="audit-empty-state__description">
        {{ description }}
      </p>
    </div>

    <!-- 操作按钮插槽 -->
    <div v-if="$slots.action || action" class="audit-empty-state__action">
      <slot name="action">
        <button
          v-if="action"
          type="button"
          :class="[
            'audit-empty-state__button',
            `audit-empty-state__button--${action.variant || 'secondary'}`
          ]"
          @click="handleActionClick"
        >
          {{ action.label }}
        </button>
      </slot>
    </div>
  </div>
</template>

<style scoped>
/**
 * AuditEmptyState Component Styles
 * 
 * 采用 BEM 命名规范，作用域隔离
 * 支持自定义主题变量覆盖
 */

/* 容器样式 */
.audit-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--audit-empty-state-padding, 48px 24px);
  text-align: var(--audit-empty-state-align, center);
  background-color: var(--audit-empty-state-bg, transparent);
  border-radius: var(--audit-empty-state-radius, 8px);
  min-height: var(--audit-empty-state-min-height, 200px);
}

/* 图标区域 */
.audit-empty-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--audit-empty-state-icon-gap, 24px);
  color: var(--audit-empty-state-icon-color, #9ca3af);
  opacity: var(--audit-empty-state-icon-opacity, 0.6);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.audit-empty-state:hover .audit-empty-state__icon {
  opacity: 0.8;
  transform: scale(1.05);
}

/* 内容区域 */
.audit-empty-state__content {
  display: flex;
  flex-direction: column;
  gap: var(--audit-empty-state-content-gap, 8px);
  max-width: var(--audit-empty-state-content-max-width, 320px);
}

/* 标题 */
.audit-empty-state__title {
  font-size: var(--audit-empty-state-title-size, 18px);
  font-weight: var(--audit-empty-state-title-weight, 600);
  color: var(--audit-empty-state-title-color, #374151);
  margin: 0;
  line-height: 1.4;
}

/* 描述 */
.audit-empty-state__description {
  font-size: var(--audit-empty-state-desc-size, 14px);
  color: var(--audit-empty-state-desc-color, #6b7280);
  margin: 0;
  line-height: 1.6;
}

/* 操作按钮区域 */
.audit-empty-state__action {
  margin-top: var(--audit-empty-state-action-gap, 24px);
}

/* 按钮基础样式 */
.audit-empty-state__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--audit-empty-state-btn-padding, 10px 20px);
  font-size: var(--audit-empty-state-btn-size, 14px);
  font-weight: var(--audit-empty-state-btn-weight, 500);
  border-radius: var(--audit-empty-state-btn-radius, 6px);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.audit-empty-state__button:focus-visible {
  box-shadow: 0 0 0 2px var(--audit-empty-state-focus-color, #3b82f6);
}

/* 主要按钮变体 */
.audit-empty-state__button--primary {
  background-color: var(--audit-empty-state-btn-primary-bg, #3b82f6);
  color: var(--audit-empty-state-btn-primary-color, #ffffff);
}

.audit-empty-state__button--primary:hover {
  background-color: var(--audit-empty-state-btn-primary-hover-bg, #2563eb);
}

/* 次要按钮变体 */
.audit-empty-state__button--secondary {
  background-color: var(--audit-empty-state-btn-secondary-bg, #f3f4f6);
  color: var(--audit-empty-state-btn-secondary-color, #374151);
}

.audit-empty-state__button--secondary:hover {
  background-color: var(--audit-empty-state-btn-secondary-hover-bg, #e5e7eb);
}

/* 幽灵按钮变体 */
.audit-empty-state__button--ghost {
  background-color: transparent;
  color: var(--audit-empty-state-btn-ghost-color, #6b7280);
}

.audit-empty-state__button--ghost:hover {
  background-color: var(--audit-empty-state-btn-ghost-hover-bg, #f3f4f6);
}

/* 响应式适配 */
@media (max-width: 640px) {
  .audit-empty-state {
    padding: 32px 16px;
    min-height: 160px;
  }

  .audit-empty-state__icon {
    margin-bottom: 16px;
  }

  .audit-empty-state__icon svg {
    width: 48px;
    height: 48px;
  }

  .audit-empty-state__title {
    font-size: 16px;
  }

  .audit-empty-state__description {
    font-size: 13px;
  }
}
</style>