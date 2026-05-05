<script setup lang="ts">
/**
 * @file SeverityBadge.vue
 * @description 维保预警严重程度标签组件
 * @author SWARM-003 Team
 * @since Iteration 2
 */

defineProps<{
  /**
   * 预警严重程度
   * - critical: 紧急 (< 7天到期)
   * - warning: 警示 (7-30天到期)
   * - normal: 正常 (> 30天到期)
   */
  severity: 'critical' | 'warning' | 'normal'
}>()

/**
 * 严重程度配置映射
 */
const severityConfig = {
  critical: {
    label: '紧急',
    color: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fecaca'
  },
  warning: {
    label: '警示',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fde68a'
  },
  normal: {
    label: '正常',
    color: '#22c55e',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0'
  }
}
</script>

<template>
  <span
    class="severity-badge"
    :style="{
      color: severityConfig[severity].color,
      backgroundColor: severityConfig[severity].bgColor,
      borderColor: severityConfig[severity].borderColor
    }"
  >
    <span class="severity-dot" :style="{ backgroundColor: severityConfig[severity].color }"></span>
    <span class="severity-label">{{ severityConfig[severity].label }}</span>
  </span>
</template>

<style scoped>
.severity-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  white-space: nowrap;
}

.severity-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.severity-label {
  line-height: 1;
}
</style>