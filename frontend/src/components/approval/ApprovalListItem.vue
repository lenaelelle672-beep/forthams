<template>
  <div
    v-if="isLoading"
    class="approval-list-item approval-list-item--loading"
    role="listitem"
    aria-busy="true"
  >
    <div class="skeleton-wrapper">
      <div class="skeleton skeleton--avatar"></div>
      <div class="skeleton-content">
        <div class="skeleton skeleton--title"></div>
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--text skeleton--text-short"></div>
      </div>
      <div class="skeleton skeleton--badge"></div>
    </div>
  </div>

  <div
    v-else-if="errorState"
    class="approval-list-item approval-list-item--error"
    role="alert"
  >
    <div class="error-content">
      <el-icon class="error-icon" :size="24">
        <WarningFilled />
      </el-icon>
      <span class="error-message">{{ errorMessage }}</span>
      <el-button
        type="primary"
        size="small"
        class="retry-button"
        @click="handleRetry"
      >
        重试
      </el-button>
    </div>
  </div>

  <div
    v-else-if="!approval"
    class="approval-list-item approval-list-item--empty"
    role="listitem"
  >
    <div class="empty-content">
      <el-icon class="empty-icon" :size="48">
        <DocumentDelete />
      </el-icon>
      <span class="empty-message">暂无审批数据</span>
    </div>
  </div>

  <div
    v-else
    class="approval-list-item"
    :class="{
      'approval-list-item--pending': isPending,
      'approval-list-item--approved': isApproved,
      'approval-list-item--rejected': isRejected,
      'approval-list-item--hoverable': true
    }"
    role="listitem"
    tabindex="0"
    @click="handleClick"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <div class="item-avatar">
      <el-avatar :size="40" :src="approval.applicantAvatar">
        {{ approval.applicantName?.charAt(0) || 'U' }}
      </el-avatar>
    </div>

    <div class="item-content">
      <div class="item-header">
        <h3 class="item-title">{{ approval.title }}</h3>
        <ApprovalStatusBadge
          :status="approval.status"
          :size="badgeSize"
        />
      </div>

      <p class="item-description">
        {{ approval.description || '暂无描述' }}
      </p>

      <div class="item-meta">
        <span class="meta-item">
          <el-icon :size="14">
            <User />
          </el-icon>
          {{ approval.applicantName || '未知申请人' }}
        </span>
        <span class="meta-item">
          <el-icon :size="14">
            <Clock />
          </el-icon>
          {{ formattedCreateTime }}
        </span>
        <span v-if="approval.processType" class="meta-item">
          <el-icon :size="14">
            <Connection />
          </el-icon>
          {{ approval.processType }}
        </span>
      </div>

      <div v-if="approval.tags?.length" class="item-tags">
        <el-tag
          v-for="tag in visibleTags"
          :key="tag"
          size="small"
          type="info"
        >
          {{ tag }}
        </el-tag>
        <el-tag
          v-if="approval.tags.length > 3"
          size="small"
          type="info"
        >
          +{{ approval.tags.length - 3 }}
        </el-tag>
      </div>
    </div>

    <div class="item-actions">
      <el-button
        v-if="isPending && canApprove"
        type="primary"
        size="small"
        :loading="isOperating"
        :disabled="isOperating"
        @click.stop="handleApprove"
      >
        通过
      </el-button>
      <el-button
        v-if="isPending && canReject"
        type="danger"
        size="small"
        :loading="isOperating"
        :disabled="isOperating"
        @click.stop="handleReject"
      >
        驳回
      </el-button>
      <el-button
        v-if="isPending"
        type="info"
        size="small"
        text
        @click.stop="handleViewDetail"
      >
        查看详情
      </el-button>
    </div>

    <div v-if="isPending" class="pending-indicator">
      <span class="pulse-dot"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ApprovalListItem Component
 * 
 * 审批列表项组件 - 展示单个审批任务的信息
 * 实现与 ApprovalService 的双向数据绑定
 * 
 * @description
 * - 显示审批任务的基本信息（标题、描述、申请人、时间等）
 * - 根据审批状态渲染不同的视觉样式
 * - 提供审批操作按钮（通过、驳回）
 * - 支持加载状态、错误状态、空状态展示
 * 
 * @example
 * ```vue
 * <ApprovalListItem
 *   :approval="approvalData"
 *   :is-loading="false"
 *   :error-state="null"
 *   @click="onItemClick"
 *   @approve="onApprove"
 *   @reject="onReject"
 * />
 * ```
 * 
 * @see {@link https://spec.example.com/swarm-052 | SWARM-052 Specification}
 */
import { computed, toRef } from 'vue';
import { useRouter } from 'vue-router';
import {
  WarningFilled,
  DocumentDelete,
  User,
  Clock,
  Connection
} from '@element-plus/icons-vue';
import type { Approval, ApprovalStatus } from '@/types/approval';
import { useApprovalStore } from '@/stores/approvalStore';
import ApprovalStatusBadge from './ApprovalStatusBadge.vue';

// Props 定义
interface Props {
  /** 审批数据对象 */
  approval: Approval | null;
  /** 加载状态 */
  isLoading?: boolean;
  /** 错误状态对象 */
  errorState?: Error | null;
  /** 是否显示小尺寸徽章 */
  badgeSize?: 'small' | 'default' | 'large';
  /** 是否禁用操作按钮 */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  approval: null,
  isLoading: false,
  errorState: null,
  badgeSize: 'default',
  disabled: false
});

// Emits 定义
interface Emits {
  /** 点击列表项 */
  (e: 'click', approval: Approval): void;
  /** 审批通过 */
  (e: 'approve', approval: Approval): void;
  /** 审批驳回 */
  (e: 'reject', approval: Approval): void;
  /** 查看详情 */
  (e: 'view-detail', approval: Approval): void;
  /** 重试操作 */
  (e: 'retry'): void;
}

const emit = defineEmits<Emits>();

// Router 实例
const router = useRouter();

// Store 引用 - 实现双向绑定的关键
const approvalStore = useApprovalStore();

/**
 * 判断当前操作是否处于 pending 状态
 * 绑定 pendingOperations 状态
 */
const isOperating = computed(() => {
  if (!props.approval?.id) return false;
  return approvalStore.pendingOperations.has(props.approval.id);
});

/**
 * 审批状态判断 - 计算属性实现响应式绑定
 */
const isPending = computed(() => {
  return props.approval?.status === 'PENDING' || 
         props.approval?.status === 'UNDER_REVIEW';
});

const isApproved = computed(() => {
  return props.approval?.status === 'APPROVED' || 
         props.approval?.status === 'APPROVED';
});

const isRejected = computed(() => {
  return props.approval?.status === 'REJECTED' || 
         props.approval?.status === 'REJECTED';
});

/**
 * 错误消息格式化
 */
const errorMessage = computed(() => {
  if (!props.errorState) return '加载失败';
  return props.errorState.message || '数据加载失败，请重试';
});

/**
 * 格式化创建时间
 */
const formattedCreateTime = computed(() => {
  if (!props.approval?.createTime) return '--';
  const date = new Date(props.approval.createTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes <= 0 ? '刚刚' : `${diffMinutes}分钟前`;
    }
    return `${diffHours}小时前`;
  }
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

/**
 * 显示的标签（最多显示3个）
 */
const visibleTags = computed(() => {
  if (!props.approval?.tags) return [];
  return props.approval.tags.slice(0, 3);
});

/**
 * 是否有审批权限
 */
const canApprove = computed(() => {
  // TODO: 集成权限判断 Hook
  // return useApprovalPermission().canApprove(props.approval);
  return !props.disabled && isPending.value;
});

const canReject = computed(() => {
  return !props.disabled && isPending.value;
});

/**
 * 点击列表项
 * 触发双向绑定的状态更新并导航
 */
const handleClick = () => {
  if (props.disabled || isOperating.value) return;
  if (props.approval) {
    // 触发事件 - 通知父组件
    emit('click', props.approval);
    // 双 向绑定: 通过 Pinia Store 更新当前审批对象
    approvalStore.setCurrentApproval(props.approval);
  }
};

/**
 * 审批通过处理
 * 实现乐观更新逻辑
 */
const handleApprove = async () => {
  if (!props.approval || isOperating.value) return;
  
  try {
    // 双 向绑定: 通过 Store Action 更新状态（乐观更新）
    await approvalStore.updateApprovalStatus(
      props.approval.id,
      'APPROVED'
    );
    emit('approve', props.approval);
  } catch (error) {
    console.error('审批通过失败:', error);
    // 失败回滚由 Store 内部的 ApprovalService 处理
  }
};

/**
 * 审批驳回处理
 * 实现乐观更新逻辑
 */
const handleReject = async () => {
  if (!props.approval || isOperating.value) return;
  
  try {
    // 双 向绑定: 通过 Store Action 更新状态（乐观更新）
    await approvalStore.updateApprovalStatus(
      props.approval.id,
      'REJECTED'
    );
    emit('reject', props.approval);
  } catch (error) {
    console.error('审批驳回失败:', error);
    // 失败回滚由 Store 内部的 ApprovalService 处理
  }
};

/**
 * 查看详情处理
 */
const handleViewDetail = () => {
  if (!props.approval || isOperating.value) return;
  emit('view-detail', props.approval);
  router.push(`/approval/detail/${props.approval.id}`);
};

/**
 * 重试操作
 */
const handleRetry = () => {
  emit('retry');
};
</script>

<style scoped>
.approval-list-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.approval-list-item--hoverable:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #409eff;
}

.approval-list-item:focus {
  outline: 2px solid #409eff;
  outline-offset: 2px;
}

.approval-list-item--loading,
.approval-list-item--error,
.approval-list-item--empty {
  cursor: default;
  pointer-events: none;
}

.approval-list-item--loading {
  background: #fafafa;
}

.approval-list-item--error {
  background: #fef0f0;
  border-color: #fde2e2;
}

.approval-list-item--empty {
  justify-content: center;
  background: #fafafa;
  border-style: dashed;
}

/* 状态样式 */
.approval-list-item--pending {
  border-left: 4px solid #e6a23c;
}

.approval-list-item--approved {
  border-left: 4px solid #67c23a;
}

.approval-list-item--rejected {
  border-left: 4px solid #f56c6c;
}

/* Skeleton Loading */
.skeleton-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
}

.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton--avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton--title {
  height: 20px;
  width: 60%;
}

.skeleton--text {
  height: 14px;
  width: 100%;
}

.skeleton--text-short {
  width: 40%;
}

.skeleton--badge {
  width: 60px;
  height: 24px;
  border-radius: 12px;
  flex-shrink: 0;
}

/* Error State */
.error-content {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  justify-content: center;
}

.error-icon {
  color: #f56c6c;
}

.error-message {
  color: #f56c6c;
  font-size: 14px;
}

.retry-button {
  margin-left: 8px;
}

/* Empty State */
.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  color: #c0c4cc;
}

.empty-message {
  color: #909399;
  font-size: 14px;
}

/* Item Content */
.item-avatar {
  flex-shrink: 0;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.item-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-description {
  margin: 0 0 12px;
  font-size: 14px;
  color: #606266;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: #909399;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

/* Item Actions */
.item-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.approval-list-item:hover .item-actions {
  opacity: 1;
}

/* Pending Indicator */
.pending-indicator {
  position: absolute;
  top: 16px;
  right: 16px;
}

.pulse-dot {
  display: block;
  width: 8px;
  height: 8px;
  background: #e6a23c;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(230, 162, 60, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(230, 162, 60, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(230, 162, 60, 0);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .approval-list-item {
    flex-wrap: wrap;
  }

  .item-actions {
    width: 100%;
    flex-direction: row;
    justify-content: flex-end;
    opacity: 1;
    margin-top: 12px;
  }
}
</style>