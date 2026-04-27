<script setup lang="ts">
/**
 * ApprovalStatusBadge Component
 * 
 * 审批状态徽章组件，用于展示审批流程中的各种状态。
 * 绑定 approval.status 属性，支持实时状态同步。
 * 
 * @module components/approval/ApprovalStatusBadge
 * @requires Vue 3.4+
 * @requires Element Plus 2.5+
 * 
 * @example
 * // 基本用法
 * <ApprovalStatusBadge :status="approval.status" />
 * 
 * // 带尺寸控制
 * <ApprovalStatusBadge :status="approval.status" size="large" />
 */
import { computed } from 'vue';

// 审批状态枚举
export type ApprovalStatus = 
  | 'pending'      // 待审批
  | 'approving'    // 审批中
  | 'approved'     // 已通过
  | 'rejected'     // 已驳回
  | 'cancelled'    // 已撤回
  | 'expired';     // 已过期

// 组件 Props 定义
interface Props {
  /** 审批状态值 */
  status: ApprovalStatus;
  /** 徽章尺寸: small | default | large */
  size?: 'small' | 'default' | 'large';
  /** 是否显示状态图标 */
  showIcon?: boolean;
  /** 是否使用简约样式（无背景色） */
  plain?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default',
  showIcon: true,
  plain: false,
});

// 状态配置映射表
const statusConfig: Record<ApprovalStatus, {
  label: string;
  type: 'warning' | 'primary' | 'success' | 'danger' | 'info' | 'warning';
  icon: string;
}> = {
  pending: {
    label: '待审批',
    type: 'warning',
    icon: 'clock',
  },
  approving: {
    label: '审批中',
    type: 'primary',
    icon: 'loading',
  },
  approved: {
    label: '已通过',
    type: 'success',
    icon: 'check-circle',
  },
  rejected: {
    label: '已驳回',
    type: 'danger',
    icon: 'close-circle',
  },
  cancelled: {
    label: '已撤回',
    type: 'info',
    icon: 'minus-circle',
  },
  expired: {
    label: '已过期',
    type: 'info',
    icon: 'clock',
  },
};

// 计算当前状态配置
const currentConfig = computed(() => {
  return statusConfig[props.status] || statusConfig.pending;
});

// 计算标签文本
const statusLabel = computed(() => currentConfig.value.label);

// 计算 Element Plus 类型
const elementType = computed(() => currentConfig.value.type);

// 计算图标名称
const iconName = computed(() => props.showIcon ? currentConfig.value.icon : '');

// 计算尺寸样式
const sizeClass = computed(() => {
  const sizeMap = {
    small: 'approval-status-badge--small',
    default: 'approval-status-badge--default',
    large: 'approval-status-badge--large',
  };
  return sizeMap[props.size];
});

// 计算是否简约模式
const plainClass = computed(() => props.plain ? 'approval-status-badge--plain' : '');
</script>

<template>
  <el-tag
    :type="elementType"
    :class="[
      'approval-status-badge',
      sizeClass,
      plainClass,
    ]"
    :disable-transitions="true"
    effect="plain"
  >
    <span v-if="showIcon" class="approval-status-badge__icon">
      <el-icon v-if="iconName === 'clock'">
        <Clock />
      </el-icon>
      <el-icon v-else-if="iconName === 'loading'" class="is-loading">
        <Loading />
      </el-icon>
      <el-icon v-else-if="iconName === 'check-circle'">
        <CircleCheck />
      </el-icon>
      <el-icon v-else-if="iconName === 'close-circle'">
        <CircleClose />
      </el-icon>
      <el-icon v-else-if="iconName === 'minus-circle'">
        <MinusCircle />
      </el-icon>
      <el-icon v-else>
        <Clock />
      </el-icon>
    </span>
    <span class="approval-status-badge__label">{{ statusLabel }}</span>
  </el-tag>
</template>

<script lang="ts">
// Element Plus 图标导入
import {
  Clock,
  Loading,
  CircleCheck,
  CircleClose,
  MinusCircle,
} from '@element-plus/icons-vue';

export default {
  name: 'ApprovalStatusBadge',
  components: {
    Clock,
    Loading,
    CircleCheck,
    CircleClose,
    MinusCircle,
  },
};
</script>

<style scoped>
/**
 * ApprovalStatusBadge Styles
 * 
 * 审批状态徽章样式定义
 */

/* 基础样式 */
.approval-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  border-radius: 4px;
  transition: all 0.3s ease;
  cursor: default;
}

/* 图标样式 */
.approval-status-badge__icon {
  display: inline-flex;
  align-items: center;
  font-size: inherit;
}

.approval-status-badge__icon .el-icon {
  font-size: inherit;
}

/* 标签文字样式 */
.approval-status-badge__label {
  line-height: 1;
}

/* 尺寸变体 */

/* 小尺寸 */
.approval-status-badge--small {
  padding: 2px 6px;
  font-size: 12px;
}

.approval-status-badge--small .approval-status-badge__icon {
  font-size: 12px;
}

/* 默认尺寸 */
.approval-status-badge--default {
  padding: 4px 10px;
  font-size: 13px;
}

.approval-status-badge--default .approval-status-badge__icon {
  font-size: 14px;
}

/* 大尺寸 */
.approval-status-badge--large {
  padding: 6px 14px;
  font-size: 14px;
}

.approval-status-badge--large .approval-status-badge__icon {
  font-size: 16px;
}

/* 简约模式变体 */
.approval-status-badge--plain {
  background-color: transparent;
  border: 1px solid currentColor;
  opacity: 0.9;
}

.approval-status-badge--plain:hover {
  opacity: 1;
}

/* 状态颜色变体 - 使用 Element Plus 类型 */

/* 待审批 - warning */
:deep(.el-tag--warning) {
  --el-tag-bg-color: #fdf6ec;
  --el-tag-border-color: #faecd8;
  --el-tag-text-color: #e6a23c;
}

/* 审批中 - primary */
:deep(.el-tag--primary) {
  --el-tag-bg-color: #ecf5ff;
  --el-tag-border-color: #d9ecff;
  --el-tag-text-color: #409eff;
}

/* 已通过 - success */
:deep(.el-tag--success) {
  --el-tag-bg-color: #f0f9eb;
  --el-tag-border-color: #e1f3d8;
  --el-tag-text-color: #67c23a;
}

/* 已驳回 - danger */
:deep(.el-tag--danger) {
  --el-tag-bg-color: #fef0f0;
  --el-tag-border-color: #fde2e2;
  --el-tag-text-color: #f56c6c;
}

/* 已撤回/已过期 - info */
:deep(.el-tag--info) {
  --el-tag-bg-color: #f4f4f5;
  --el-tag-border-color: #e9e9eb;
  --el-tag-text-color: #909399;
}

/* 动画效果 */
@keyframes pulse-warning {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.approval-status-badge--default:has(.el-tag--warning) .approval-status-badge__icon,
.approval-status-badge--large:has(.el-tag--warning) .approval-status-badge__icon {
  animation: pulse-warning 2s ease-in-out infinite;
}

/* 加载状态图标旋转 */
.is-loading {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>