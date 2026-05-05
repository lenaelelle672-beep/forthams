<template>
  <el-tag :type="tagType" :effect="effect" :size="size" :closable="closable" @close="handleClose">
    <span class="status-tag__icon" v-if="showIcon">
      <component :is="statusIcon" />
    </span>
    {{ displayText }}
  </el-tag>
</template>

<script setup lang="ts">
/**
 * StatusTag Component
 * 
 * 工单审批状态标签组件，用于展示工单当前所处审批阶段的状态。
 * 支持7种状态流转：草稿 → 待审批 → 审批中 → 已通过/已拒绝/已撤回 → 已关闭
 * 
 * @example
 * <!-- 基础用法 -->
 * <StatusTag status="PENDING" />
 * 
 * @example
 * <!-- 带可关闭按钮 -->
 * <StatusTag status="APPROVING" closable @close="handleClose" />
 * 
 * @example
 * <!-- 自定义尺寸和效果 -->
 * <StatusTag status="APPROVED" size="large" effect="dark" />
 * 
 * @example
 * <!-- 显示状态图标 -->
 * <StatusTag status="REJECTED" show-icon />
 * 
 * @requires Element Plus el-tag component
 */

import { computed } from 'vue';
import type { Component } from 'vue';

// 导入 Element Plus 图标
import {
  Document,
  Clock,
  Loading,
  Check,
  Close,
  Delete,
  Lock,
} from '@element-plus/icons-vue';

// 状态枚举定义
export enum WorkOrderStatus {
  DRAFT = 'DRAFT',           // 草稿
  PENDING = 'PENDING',       // 待审批
  APPROVING = 'APPROVING',    // 审批中
  APPROVED = 'APPROVED',      // 已通过
  REJECTED = 'REJECTED',     // 已拒绝
  CANCELLED = 'CANCELLED',   // 已撤回
  CLOSED = 'CLOSED',         // 已关闭
}

// 状态文本映射
const statusTextMap: Record<WorkOrderStatus, string> = {
  [WorkOrderStatus.DRAFT]: '草稿',
  [WorkOrderStatus.PENDING]: '待审批',
  [WorkOrderStatus.APPROVING]: '审批中',
  [WorkOrderStatus.APPROVED]: '已通过',
  [WorkOrderStatus.REJECTED]: '已拒绝',
  [WorkOrderStatus.CANCELLED]: '已撤回',
  [WorkOrderStatus.CLOSED]: '已关闭',
};

// Element Plus tag type 映射
const statusTypeMap: Record<WorkOrderStatus, string> = {
  [WorkOrderStatus.DRAFT]: 'info',
  [WorkOrderStatus.PENDING]: 'warning',
  [WorkOrderStatus.APPROVING]: 'primary',
  [WorkOrderStatus.APPROVED]: 'success',
  [WorkOrderStatus.REJECTED]: 'danger',
  [WorkOrderStatus.CANCELLED]: 'info',
  [WorkOrderStatus.CLOSED]: 'info',
};

// 状态图标映射
const statusIconMap: Record<WorkOrderStatus, Component> = {
  [WorkOrderStatus.DRAFT]: Document,
  [WorkOrderStatus.PENDING]: Clock,
  [WorkOrderStatus.APPROVING]: Loading,
  [WorkOrderStatus.APPROVED]: Check,
  [WorkOrderStatus.REJECTED]: Close,
  [WorkOrderStatus.CANCELLED]: Delete,
  [WorkOrderStatus.CLOSED]: Lock,
};

// Props 定义
export interface StatusTagProps {
  /** 工单状态值 */
  status: WorkOrderStatus | string;
  /** 自定义显示文本 */
  text?: string;
  /** Element Plus tag 类型：success / warning / danger / info / '' */
  type?: string;
  /** Element Plus effect：light / dark */
  effect?: 'light' | 'dark';
  /** 标签尺寸：large / default / small */
  size?: 'large' | 'default' | 'small';
  /** 是否可关闭 */
  closable?: boolean;
  /** 是否显示状态图标 */
  showIcon?: boolean;
}

const props = withDefaults(defineProps<StatusTagProps>(), {
  status: WorkOrderStatus.PENDING,
  text: '',
  effect: 'light',
  size: 'default',
  closable: false,
  showIcon: false,
});

// Emit 定义
const emit = defineEmits<{
  /** 关闭按钮点击事件 */
  (e: 'close', event: MouseEvent): void;
}>();

/**
 * 计算显示文本
 */
const displayText = computed(() => {
  if (props.text) {
    return props.text;
  }
  return statusTextMap[props.status as WorkOrderStatus] || props.status;
});

/**
 * 计算 Element Plus tag type
 */
const tagType = computed(() => {
  if (props.type) {
    return props.type;
  }
  return statusTypeMap[props.status as WorkOrderStatus] || 'info';
});

/**
 * 获取状态图标组件
 */
const statusIcon = computed(() => {
  return statusIconMap[props.status as WorkOrderStatus] || Document;
});

/**
 * 处理关闭事件
 * @param event - 鼠标事件对象
 */
const handleClose = (event: MouseEvent) => {
  emit('close', event);
};
</script>

<style scoped lang="scss">
/**
 * StatusTag 样式
 * 
 * 遵循设计系统变量规范
 */

.status-tag {
  // 状态图标样式
  &__icon {
    display: inline-flex;
    align-items: center;
    margin-right: 4px;
    
    :deep(.el-icon) {
      font-size: 14px;
    }
  }

  // 不同状态的附加样式
  &--pending {
    animation: pulse 2s infinite;
  }
}

// 脉冲动画（用于待审批状态提示）
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>