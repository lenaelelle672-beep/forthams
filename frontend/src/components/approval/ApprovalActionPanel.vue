<template>
  <div class="approval-action-panel" :class="{ 'is-loading': isLoading }">
    <div class="panel-header">
      <h3 class="panel-title">审批操作</h3>
      <el-tag v-if="isOperationLocked" type="warning" size="small" class="lock-indicator">
        <el-icon><Lock /></el-icon>
        操作进行中
      </el-tag>
    </div>

    <div class="panel-content">
      <!-- 操作按钮组 -->
      <div class="action-buttons">
        <el-button
          type="success"
          :disabled="!canApprove || isOperationLocked"
          :loading="isApproveLoading"
          class="action-btn approve-btn"
          @click="handleApprove"
        >
          <el-icon v-if="!isApproveLoading"><Check /></el-icon>
          {{ isApproveLoading ? '审批中...' : '通过' }}
        </el-button>

        <el-button
          type="danger"
          :disabled="!canReject || isOperationLocked"
          :loading="isRejectLoading"
          class="action-btn reject-btn"
          @click="handleReject"
        >
          <el-icon v-if="!isRejectLoading"><Close /></el-icon>
          {{ isRejectLoading ? '驳回中...' : '驳回' }}
        </el-button>

        <el-button
          type="info"
          :disabled="!canRevoke || isOperationLocked"
          :loading="isRevokeLoading"
          class="action-btn revoke-btn"
          @click="handleRevoke"
        >
          <el-icon v-if="!isRevokeLoading"><RefreshLeft /></el-icon>
          {{ isRevokeLoading ? '撤回中...' : '撤回' }}
        </el-button>
      </div>

      <!-- 审批意见表单 -->
      <div class="opinion-section">
        <label class="opinion-label">审批意见</label>
        <el-input
          v-model="opinionText"
          type="textarea"
          :rows="3"
          :maxlength="500"
          show-word-limit
          placeholder="请输入审批意见（可选）"
          :disabled="isOperationLocked"
          class="opinion-input"
        />
      </div>

      <!-- 提交按钮 -->
      <div class="submit-section">
        <el-button
          type="primary"
          :disabled="!canSubmit || isOperationLocked"
          :loading="isSubmitLoading"
          class="submit-btn"
          @click="handleSubmit"
        >
          {{ isSubmitLoading ? '提交中...' : '提交审批' }}
        </el-button>
      </div>
    </div>

    <!-- 错误提示 -->
    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="error"
      show-icon
      class="error-alert"
      :closable="true"
      @close="clearError"
    />

    <!-- 操作成功提示 -->
    <el-message
      v-if="successMessage"
      :type="'success'"
      :text="successMessage"
      class="success-toast"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * ApprovalActionPanel 组件
 * 
 * 审批操作面板组件，提供审批操作的 UI 界面。
 * 支持通过、驳回、撤回等操作，与 ApprovalService 实现双向绑定。
 * 
 * @description
 * - 绑定 pendingOperations 状态（操作锁定）
 * - 绑定 currentApproval 状态（详情数据）
 * - 提供审批意见录入功能
 * - 操作响应时间 ≤ 300ms
 * 
 * @example
 * ```vue
 * <ApprovalActionPanel
 *   :approval-id="currentApproval.id"
 *   @action-complete="onActionComplete"
 * />
 * ```
 */

import { computed, ref, watch, onMounted } from 'vue';
import { Check, Close, RefreshLeft, Lock } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useApprovalStore } from '@/stores/approvalStore';
import { useApprovalBinding } from '@/composables/useApprovalBinding';
import type { ApprovalStatus } from '@/types/approval';

// Props 定义
interface Props {
  /** 审批记录 ID */
  approvalId?: string;
  /** 是否显示提交按钮 */
  showSubmitButton?: boolean;
  /** 提交按钮文本 */
  submitButtonText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  approvalId: '',
  showSubmitButton: true,
  submitButtonText: '提交审批'
});

// Emits 定义
interface Emits {
  /** 操作完成事件 */
  (e: 'action-complete', data: { approvalId: string; action: string }): void;
  /** 操作失败事件 */
  (e: 'action-error', error: Error): void;
}

const emit = defineEmits<Emits>();

// Store 和 Binding
const approvalStore = useApprovalStore();
const { updateApprovalStatus, submitApproval, isOperationPending } = useApprovalBinding();

// 组件内部状态
const opinionText = ref<string>('');
const errorMessage = ref<string>('');
const successMessage = ref<string>('');

// 当前审批记录 - 通过 computed 绑定 store 状态
const currentApproval = computed(() => {
  if (props.approvalId) {
    return approvalStore.currentApproval;
  }
  return null;
});

// 操作锁定状态 - 绑定 pendingOperations
const isOperationLocked = computed(() => {
  if (props.approvalId) {
    return isOperationPending(props.approvalId);
  }
  return false;
});

// 各操作加载状态
const isApproveLoading = computed(() => {
  return isOperationPending(props.approvalId) && approvalStore.pendingOperations.get(props.approvalId) === 'approve';
});

const isRejectLoading = computed(() => {
  return isOperationPending(props.approvalId) && approvalStore.pendingOperations.get(props.approvalId) === 'reject';
});

const isRevokeLoading = computed(() => {
  return isOperationPending(props.approvalId) && approvalStore.pendingOperations.get(props.approvalId) === 'revoke';
});

const isSubmitLoading = computed(() => {
  return isOperationPending(props.approvalId) && approvalStore.pendingOperations.get(props.approvalId) === 'submit';
});

// 整体加载状态
const isLoading = computed(() => approvalStore.loadingState.isLoading);

// 操作权限判断
const canApprove = computed(() => {
  const approval = currentApproval.value;
  return approval?.status === 'pending' || approval?.status === 'PENDING';
});

const canReject = computed(() => {
  const approval = currentApproval.value;
  return approval?.status === 'pending' || approval?.status === 'PENDING';
});

const canRevoke = computed(() => {
  const approval = currentApproval.value;
  return approval?.status === 'pending' || approval?.status === 'PENDING';
});

const canSubmit = computed(() => {
  return props.showSubmitButton && !isOperationLocked.value;
});

/**
 * 处理审批通过操作
 * 使用乐观更新策略，立即更新 UI 然后请求后端
 */
async function handleApprove(): Promise<void> {
  if (!props.approvalId || isOperationLocked.value) {
    return;
  }

  clearMessages();

  try {
    await updateApprovalStatus(props.approvalId, 'approved' as ApprovalStatus, opinionText.value);
    showSuccess('审批通过成功');
    emit('action-complete', { approvalId: props.approvalId, action: 'approve' });
  } catch (error) {
    handleError(error as Error, '审批通过失败');
    emit('action-error', error as Error);
  }
}

/**
 * 处理审批驳回操作
 * 使用乐观更新策略，立即更新 UI 然后请求后端
 */
async function handleReject(): Promise<void> {
  if (!props.approvalId || isOperationLocked.value) {
    return;
  }

  clearMessages();

  try {
    await updateApprovalStatus(props.approvalId, 'rejected' as ApprovalStatus, opinionText.value);
    showSuccess('审批驳回成功');
    emit('action-complete', { approvalId: props.approvalId, action: 'reject' });
  } catch (error) {
    handleError(error as Error, '审批驳回失败');
    emit('action-error', error as Error);
  }
}

/**
 * 处理审批撤回操作
 * 使用乐观更新策略，立即更新 UI 然后请求后端
 */
async function handleRevoke(): Promise<void> {
  if (!props.approvalId || isOperationLocked.value) {
    return;
  }

  clearMessages();

  try {
    await updateApprovalStatus(props.approvalId, 'revoked' as ApprovalStatus, opinionText.value);
    showSuccess('审批撤回成功');
    emit('action-complete', { approvalId: props.approvalId, action: 'revoke' });
  } catch (error) {
    handleError(error as Error, '审批撤回失败');
    emit('action-error', error as Error);
  }
}

/**
 * 处理提交审批操作
 * 提交新的审批申请
 */
async function handleSubmit(): Promise<void> {
  if (isOperationLocked.value) {
    return;
  }

  clearMessages();

  try {
    await submitApproval({
      approvalId: props.approvalId,
      opinion: opinionText.value
    });
    showSuccess('提交成功');
    emit('action-complete', { approvalId: props.approvalId, action: 'submit' });
  } catch (error) {
    handleError(error as Error, '提交失败');
    emit('action-error', error as Error);
  }
}

/**
 * 处理错误信息
 * @param error 错误对象
 * @param defaultMessage 默认错误消息
 */
function handleError(error: Error, defaultMessage: string): void {
  console.error('[ApprovalActionPanel] Operation error:', error);
  errorMessage.value = error.message || defaultMessage;
}

/**
 * 显示成功消息
 * @param message 成功消息文本
 */
function showSuccess(message: string): void {
  ElMessage.success(message);
  successMessage.value = message;
  // 300ms 内清除成功消息
  setTimeout(() => {
    successMessage.value = '';
  }, 3000);
}

/**
 * 清除所有消息
 */
function clearMessages(): void {
  errorMessage.value = '';
  successMessage.value = '';
}

/**
 * 清除错误信息
 */
function clearError(): void {
  errorMessage.value = '';
}

// 监听审批记录 ID 变化，加载详情
watch(
  () => props.approvalId,
  async (newId) => {
    if (newId && newId !== currentApproval.value?.id) {
      await approvalStore.fetchApprovalDetail(newId);
    }
  },
  { immediate: true }
);

// 组件挂载时如果已有审批 ID 则加载详情
onMounted(async () => {
  if (props.approvalId && !currentApproval.value) {
    await approvalStore.fetchApprovalDetail(props.approvalId);
  }
});
</script>

<style scoped>
.approval-action-panel {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s ease;
}

.approval-action-panel.is-loading {
  opacity: 0.7;
  pointer-events: none;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.lock-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
  flex: 1;
  min-width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.approve-btn {
  background-color: var(--el-color-success);
  border-color: var(--el-color-success);
}

.approve-btn:hover:not(:disabled) {
  background-color: var(--el-color-success-light-3);
  border-color: var(--el-color-success-light-3);
}

.reject-btn {
  background-color: var(--el-color-danger);
  border-color: var(--el-color-danger);
}

.reject-btn:hover:not(:disabled) {
  background-color: var(--el-color-danger-light-3);
  border-color: var(--el-color-danger-light-3);
}

.revoke-btn {
  background-color: var(--el-color-info);
  border-color: var(--el-color-info);
}

.opinion-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.opinion-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.opinion-input {
  width: 100%;
}

.submit-section {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

.submit-btn {
  width: 100%;
  max-width: 200px;
}

.error-alert {
  margin-top: 16px;
}

.success-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
}

/* 响应式适配 */
@media (max-width: 480px) {
  .action-buttons {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }
}
</style>