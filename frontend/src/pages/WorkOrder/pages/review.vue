<template>
  <div class="work-order-review" data-testid="work-order-review-page">
    <!-- Header Section -->
    <header class="review-header">
      <h1 class="review-title">工单审批</h1>
      <span class="work-order-id" data-testid="work-order-id">{{ workOrderId }}</span>
    </header>

    <!-- Status Badge -->
    <div class="status-section">
      <span 
        class="status-badge" 
        data-testid="status-badge"
        :class="statusClass"
      >
        {{ statusText }}
      </span>
      <span 
        v-if="approvedBy" 
        class="approved-by" 
        data-testid="approved-by"
      >
        审批人: {{ approvedBy }}
      </span>
    </div>

    <!-- Work Order Details -->
    <section class="work-order-details">
      <h2 class="section-title">工单详情</h2>
      <dl class="details-list">
        <div class="detail-item">
          <dt>工单编号</dt>
          <dd>{{ workOrderId }}</dd>
        </div>
        <div class="detail-item">
          <dt>创建者</dt>
          <dd>{{ creator }}</dd>
        </div>
        <div class="detail-item">
          <dt>创建时间</dt>
          <dd>{{ createdAt }}</dd>
        </div>
        <div class="detail-item">
          <dt>当前审批人</dt>
          <dd>{{ currentApprover }}</dd>
        </div>
      </dl>
    </section>

    <!-- Rejection Reason Display -->
    <section 
      v-if="rejectReason" 
      class="reject-reason-section"
      data-testid="reject-reason-display"
    >
      <h2 class="section-title">驳回原因</h2>
      <p class="reject-reason-text">{{ rejectReason }}</p>
    </section>

    <!-- Action Buttons -->
    <section 
      v-if="canApprove" 
      class="action-buttons"
      data-testid="approval-actions"
    >
      <button
        class="btn btn-approve"
        data-testid="btn-approve"
        :disabled="isProcessing"
        @click="handleApprove"
      >
        {{ isProcessing ? '处理中...' : '审批通过' }}
      </button>
      <button
        class="btn btn-reject"
        data-testid="btn-reject"
        :disabled="isProcessing"
        @click="showRejectModal = true"
      >
        驳回
      </button>
    </section>

    <!-- Reject Modal -->
    <div 
      v-if="showRejectModal" 
      class="modal-overlay"
      data-testid="reject-modal"
      @click.self="closeRejectModal"
    >
      <div class="modal-content">
        <h3 class="modal-title">驳回工单</h3>
        
        <div class="form-group">
          <label for="reject-reason" class="form-label">
            驳回原因 <span class="required">*</span>
          </label>
          <textarea
            id="reject-reason"
            v-model="rejectReasonInput"
            class="form-textarea"
            data-testid="input-reason"
            placeholder="请输入驳回原因（至少10个字符）"
            rows="4"
          ></textarea>
          <span 
            v-if="reasonError" 
            class="form-error"
            data-testid="reason-error"
          >
            {{ reasonError }}
          </span>
          <span class="form-hint">
            字符数: {{ rejectReasonInput.length }} / 最少10个字符
          </span>
        </div>

        <div class="modal-actions">
          <button
            class="btn btn-cancel"
            data-testid="btn-cancel-reject"
            @click="closeRejectModal"
          >
            取消
          </button>
          <button
            class="btn btn-confirm-reject"
            data-testid="btn-confirm-reject"
            :disabled="!canSubmitReject"
            @click="handleReject"
          >
            确认驳回
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div 
      v-if="isLoading" 
      class="loading-overlay"
      data-testid="loading-state"
    >
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error State -->
    <div 
      v-if="error" 
      class="error-message"
      data-testid="error-message"
    >
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 工单审批页面
 * 
 * 功能：
 * - 展示工单详情与当前状态
 * - 提供一键审批/驳回操作
 * - 驳回时需填写原因（最少10字符）
 * - 审批成功后触发状态更新与通知
 * 
 * @component
 * @example
 * <WorkOrderReview workOrderId="WO-2025-001" />
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { workOrderApi } from '../api/workOrderApi';
import type { WorkOrder, ApprovalAction, RejectRequest } from '../../types/approval';

// Props
interface Props {
  workOrderId: string;
}

const props = defineProps<Props>();

// State
const workOrder = ref<WorkOrder | null>(null);
const isLoading = ref(false);
const isProcessing = ref(false);
const showRejectModal = ref(false);
const rejectReasonInput = ref('');
const error = ref<string | null>(null);

// Derived state
const statusText = computed(() => {
  if (!workOrder.value) return '';
  const statusMap: Record<string, string> = {
    pending_approval: '待审批',
    approved: '已审批通过',
    rejected: '已驳回',
    closed: '已关闭'
  };
  return statusMap[workOrder.value.status] || workOrder.value.status;
});

const statusClass = computed(() => {
  if (!workOrder.value) return '';
  return `status-${workOrder.value.status}`;
});

const canApprove = computed(() => {
  return workOrder.value?.status === 'pending_approval';
});

const approvedBy = computed(() => {
  return workOrder.value?.approved_by || '';
});

const creator = computed(() => {
  return workOrder.value?.created_by || '';
});

const currentApprover = computed(() => {
  return workOrder.value?.current_approver_id || '';
});

const createdAt = computed(() => {
  return workOrder.value?.created_at || '';
});

const rejectReason = computed(() => {
  return workOrder.value?.reject_reason || '';
});

// Validation
const reasonError = computed(() => {
  if (rejectReasonInput.value.length > 0 && rejectReasonInput.value.length < 10) {
    return '驳回原因至少需要10个字符';
  }
  return null;
});

const canSubmitReject = computed(() => {
  return rejectReasonInput.value.length >= 10 && !isProcessing.value;
});

// Methods
/**
 * 加载工单详情
 */
async function loadWorkOrder() {
  isLoading.value = true;
  error.value = null;
  
  try {
    const response = await workOrderApi.getWorkOrderById(props.workOrderId);
    workOrder.value = response.data;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载工单失败';
    console.error('Failed to load work order:', err);
  } finally {
    isLoading.value = false;
  }
}

/**
 * 处理审批通过操作
 */
async function handleApprove() {
  if (isProcessing.value) return;
  
  isProcessing.value = true;
  error.value = null;
  
  try {
    const action: ApprovalAction = {
      work_order_id: props.workOrderId,
      action: 'approve',
      performed_by: getCurrentUserId(),
      performed_at: new Date().toISOString()
    };
    
    const response = await workOrderApi.approveWorkOrder(props.workOrderId, action);
    
    // 更新本地状态
    workOrder.value = {
      ...workOrder.value!,
      status: 'approved',
      approved_by: getCurrentUserId(),
      approved_at: new Date().toISOString(),
      version: response.data.version
    };
    
    // 显示成功提示（可集成 toast 组件）
    showSuccessMessage('工单已审批通过');
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : '审批失败';
    console.error('Failed to approve work order:', err);
  } finally {
    isProcessing.value = false;
  }
}

/**
 * 处理驳回操作
 */
async function handleReject() {
  if (!canSubmitReject.value) return;
  
  isProcessing.value = true;
  error.value = null;
  
  try {
    const request: RejectRequest = {
      work_order_id: props.workOrderId,
      reason: rejectReasonInput.value,
      performed_by: getCurrentUserId(),
      performed_at: new Date().toISOString()
    };
    
    const response = await workOrderApi.rejectWorkOrder(props.workOrderId, request);
    
    // 更新本地状态
    workOrder.value = {
      ...workOrder.value!,
      status: 'rejected',
      reject_reason: rejectReasonInput.value,
      rejected_by: getCurrentUserId(),
      rejected_at: new Date().toISOString(),
      version: response.data.version
    };
    
    // 关闭弹窗并重置
    closeRejectModal();
    
    // 显示成功提示
    showSuccessMessage('工单已驳回');
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : '驳回失败';
    console.error('Failed to reject work order:', err);
  } finally {
    isProcessing.value = false;
  }
}

/**
 * 关闭驳回弹窗
 */
function closeRejectModal() {
  showRejectModal.value = false;
  rejectReasonInput.value = '';
  reasonError.value = null;
}

/**
 * 获取当前用户ID
 * TODO: 接入真实用户认证系统
 */
function getCurrentUserId(): string {
  // 临时实现，后续应从用户上下文获取
  return 'current_user_id';
}

/**
 * 显示成功消息
 */
function showSuccessMessage(message: string) {
  // TODO: 集成全局 toast/notification 系统
  console.log('[SUCCESS]', message);
}

/**
 * 处理 WebSocket 状态更新
 */
function handleStateUpdate(event: CustomEvent) {
  const { work_order_id, status, version } = event.detail;
  
  if (work_order_id === props.workOrderId && workOrder.value) {
    workOrder.value = {
      ...workOrder.value,
      status,
      version
    };
  }
}

// Lifecycle
onMounted(() => {
  loadWorkOrder();
  
  // 订阅 WebSocket 状态更新事件
  window.addEventListener('work-order-state-updated', handleStateUpdate as EventListener);
});

onUnmounted(() => {
  // 取消订阅
  window.removeEventListener('work-order-state-updated', handleStateUpdate as EventListener);
});
</script>

<style scoped>
.work-order-review {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.review-title {
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.work-order-id {
  font-size: 14px;
  color: #6b7280;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.status-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
}

.status-pending_approval {
  background: #fef3c7;
  color: #92400e;
}

.status-approved {
  background: #d1fae5;
  color: #065f46;
}

.status-rejected {
  background: #fee2e2;
  color: #991b1b;
}

.status-closed {
  background: #e5e7eb;
  color: #4b5563;
}

.approved-by {
  font-size: 14px;
  color: #6b7280;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 16px 0;
}

.work-order-details {
  margin-bottom: 24px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 6px;
}

.details-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin: 0;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item dt {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-item dd {
  font-size: 14px;
  color: #1f2937;
  margin: 0;
}

.reject-reason-section {
  margin-bottom: 24px;
  padding: 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
}

.reject-reason-text {
  margin: 0;
  font-size: 14px;
  color: #991b1b;
  line-height: 1.6;
}

.action-buttons {
  display: flex;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-approve {
  background: #10b981;
  color: #fff;
}

.btn-approve:hover:not(:disabled) {
  background: #059669;
}

.btn-reject {
  background: #ef4444;
  color: #fff;
}

.btn-reject:hover:not(:disabled) {
  background: #dc2626;
}

.btn-cancel {
  background: #e5e7eb;
  color: #374151;
}

.btn-cancel:hover:not(:disabled) {
  background: #d1d5db;
}

.btn-confirm-reject {
  background: #ef4444;
  color: #fff;
}

.btn-confirm-reject:hover:not(:disabled) {
  background: #dc2626;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 20px 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.required {
  color: #ef4444;
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;
}

.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-error {
  display: block;
  font-size: 12px;
  color: #ef4444;
  margin-top: 6px;
}

.form-hint {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-top: 6px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 100;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-message {
  padding: 12px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #991b1b;
  font-size: 14px;
  margin-top: 16px;
}
</style>