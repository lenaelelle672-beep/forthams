<script setup lang="ts">
/**
 * AlertListItem.vue - 维保到期预警列表项组件
 * 
 * 用途：展示单条维保到期预警信息，支持状态分级显示和一键处理
 * 依赖：SeverityBadge 组件（同级原子组件）
 * 位置：Dashboard 模块 > MaintenanceAlertCard > 子组件
 */

import { computed } from 'vue'
import type { MaintenanceAlert } from '@/types/dashboard'

// Props 定义
interface Props {
  /** 预警数据对象 */
  alert: MaintenanceAlert
  /** 是否显示处理按钮 */
  showAction?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showAction: true
})

// Emits 定义
const emit = defineEmits<{
  /** 标记已处理事件 */
  handle: [alertId: string]
  /** 查看详情事件 */
  detail: [assetId: string]
}>()

/**
 * 计算剩余天数
 * @description 基于到期日期与当前日期差值计算
 */
const daysRemaining = computed(() => {
  const today = new Date()
  const dueDate = new Date(props.alert.dueDate)
  const diffTime = dueDate.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

/**
 * 计算严重程度等级
 * @description 根据剩余天数划分：<7天=critical, 7-30天=warning, >30天=normal
 */
const severityLevel = computed(() => {
  const days = daysRemaining.value
  if (days < 7) return 'critical'
  if (days <= 30) return 'warning'
  return 'normal'
})

/**
 * 格式化到期日期显示
 * @returns 格式：YYYY-MM-DD
 */
const formattedDate = computed(() => {
  const date = new Date(props.alert.dueDate)
  return date.toISOString().split('T')[0]
})

/**
 * 处理标记已处理
 * @description 触发 handle 事件，传递预警 ID
 */
const onMarkHandled = () => {
  emit('handle', props.alert.alertId)
}

/**
 * 处理查看详情
 * @description 触发 detail 事件，传递资产 ID
 */
const onViewDetail = () => {
  emit('detail', props.alert.assetId)
}
</script>

<template>
  <div
    class="alert-item"
    :class="[`severity-${severityLevel}`]"
    data-testid="alert-item"
    :data-severity="severityLevel"
  >
    <div class="alert-content">
      <div class="alert-main">
        <span class="asset-name">{{ alert.assetName }}</span>
        <span class="asset-id">#{{ alert.assetId }}</span>
      </div>
      
      <div class="alert-meta">
        <span class="due-date">
          <span class="label">到期日：</span>
          <span class="value">{{ formattedDate }}</span>
        </span>
        <span class="days-remaining" :class="[`days-${severityLevel}`]">
          {{ daysRemaining }}天后
        </span>
      </div>
      
      <div class="alert-vendor" v-if="alert.vendorName">
        <span class="vendor-label">维保方：</span>
        <span class="vendor-name">{{ alert.vendorName }}</span>
      </div>
    </div>
    
    <div class="alert-actions" v-if="showAction">
      <button
        class="btn-detail"
        @click="onViewDetail"
        aria-label="查看资产详情"
      >
        详情
      </button>
      <button
        class="btn-handle"
        @click="onMarkHandled"
        aria-label="标记已处理"
      >
        标记已处理
      </button>
    </div>
  </div>
</template>

<style scoped>
.alert-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--bg-secondary, #f5f7fa);
  border-left: 4px solid transparent;
  transition: all 0.2s ease;
}

.alert-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 严重程度颜色 */
.alert-item.severity-critical {
  border-left-color: var(--color-danger, #ef4444);
  background: var(--bg-critical, #fef2f2);
}

.alert-item.severity-warning {
  border-left-color: var(--color-warning, #f59e0b);
  background: var(--bg-warning, #fffbeb);
}

.alert-item.severity-normal {
  border-left-color: var(--color-success, #22c55e);
  background: var(--bg-secondary, #f5f7fa);
}

/* 内容区域 */
.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.asset-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.asset-id {
  font-size: 12px;
  color: var(--text-muted, #9ca3af);
}

.alert-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.due-date {
  font-size: 13px;
  color: var(--text-secondary, #4b5563);
}

.due-date .label {
  color: var(--text-muted, #6b7280);
}

.days-remaining {
  font-size: 13px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
}

.days-remaining.days-critical {
  color: var(--color-danger, #ef4444);
  background: var(--bg-critical, #fee2e2);
}

.days-remaining.days-warning {
  color: var(--color-warning, #d97706);
  background: var(--bg-warning, #fde68a);
}

.days-remaining.days-normal {
  color: var(--color-success, #16a34a);
  background: var(--bg-success, #dcfce7);
}

.alert-vendor {
  font-size: 12px;
  color: var(--text-muted, #6b7280);
}

.vendor-label {
  color: var(--text-muted, #9ca3af);
}

/* 操作按钮 */
.alert-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn-detail,
.btn-handle {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-detail {
  background: var(--bg-secondary, #e5e7eb);
  color: var(--text-secondary, #4b5563);
}

.btn-detail:hover {
  background: var(--bg-tertiary, #d1d5db);
}

.btn-handle {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-handle:hover {
  background: var(--color-primary-dark, #2563eb);
}

/* 响应式适配 */
@media (max-width: 640px) {
  .alert-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .alert-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>