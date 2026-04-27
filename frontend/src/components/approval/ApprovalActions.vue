<template>
  <div class="approval-actions" data-testid="approval-actions-container">
    <!-- Loading State -->
    <div v-if="loading" class="approval-actions__loading">
      <span class="spinner"></span>
      <span>{{ t('approval.processing') }}</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="approval-actions__error" data-testid="approval-error">
      <span class="error-icon">⚠</span>
      <span>{{ error }}</span>
    </div>

    <!-- Actions Container -->
    <div v-else class="approval-actions__buttons">
      <!-- Approve Button -->
      <button
        v-if="canApprove"
        class="btn btn--approve"
        data-testid="btn-approve"
        :disabled="isProcessing"
        @click="handleApprove"
      >
        <span class="btn__icon">✓</span>
        <span class="btn__label">{{ t('approval.approve') }}</span>
      </button>

      <!-- Reject Button -->
      <button
        v-if="canReject"
        class="btn btn--reject"
        data-testid="btn-reject"
        :disabled="isProcessing"
        @click="openRejectModal"
      >
        <span class="btn__icon">✕</span>
        <span class="btn__label">{{ t('approval.reject') }}</span>
      </button>
    </div>

    <!-- Reject Modal -->
    <Teleport to="body">
      <div
        v-if="showRejectModal"
        class="modal-overlay"
        data-testid="reject-modal"
        @click.self="closeRejectModal"
      >
        <div class="modal">
          <div class="modal__header">
            <h3 class="modal__title">{{ t('approval.rejectTitle') }}</h3>
            <button class="modal__close" data-testid="btn-close-reject-modal" @click="closeRejectModal">✕</button>
          </div>

          <div class="modal__body">
            <label class="form-label" for="reject-reason">
              {{ t('approval.rejectReasonLabel') }}
              <span class="required">*</span>
            </label>
            <textarea
              id="reject-reason"
              v-model="rejectReason"
              class="form-textarea"
              data-testid="input-reason"
              :placeholder="t('approval.rejectReasonPlaceholder')"
              :class="{ 'form-textarea--error': reasonValidationError }"
              rows="4"
            ></textarea>
            <div v-if="reasonValidationError" class="form-error" data-testid="reason-error">
              {{ reasonValidationError }}
            </div>
            <div class="form-hint">
              {{ t('approval.rejectReasonHint') }}
            </div>
          </div>

          <div class="modal__footer">
            <button
              class="btn btn--secondary"
              data-testid="btn-cancel-reject"
              @click="closeRejectModal"
            >
              {{ t('approval.cancel') }}
            </button>
            <button
              class="btn btn--danger"
              data-testid="btn-confirm-reject"
              :disabled="!isRejectReasonValid || isProcessing"
              @click="handleReject"
            >
              <span v-if="isProcessing" class="spinner spinner--small"></span>
              {{ t('approval.confirmReject') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Success Toast -->
    <Teleport to="body">
      <div
        v-if="showSuccessToast"
        class="toast toast--success"
        data-testid="approval-success-toast"
      >
        <span class="toast__icon">✓</span>
        <span>{{ successMessage }}</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * ApprovalActions Component
 * 
 * Provides one-click approve/reject functionality for work orders.
 * Integrates with the backend state machine to advance work order lifecycle
 * and triggers notifications upon approval decisions.
 * 
 * @component
 * @fires approve - When user approves the work order
 * @fires reject - When user rejects the work order with reason
 * 
 * @example
 * <ApprovalActions
 *   :work-order="workOrder"
 *   :current-user-id="currentUserId"
 *   @approval-complete="handleApprovalComplete"
 * />
 */
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { workOrderApi } from '@/pages/WorkOrder/api/workOrderApi';
import type { WorkOrder } from '@/pages/WorkOrder/types/workOrder';

// =============================================================================
// Types & Interfaces
// =============================================================================

interface ApprovalActionsProps {
  /** The work order to approve/reject */
  workOrder: WorkOrder | null;
  /** Current user's ID for permission check */
  currentUserId: string;
  /** Whether to show the approve button */
  showApproveButton?: boolean;
  /** Whether to show the reject button */
  showRejectButton?: boolean;
}

interface ApprovalActionsEmits {
  /** Emitted when approval/rejection completes successfully */
  (e: 'approval-complete', result: ApprovalResult): void;
  /** Emitted when an error occurs during approval process */
  (e: 'approval-error', error: string): void;
}

interface ApprovalResult {
  workOrderId: string;
  action: 'approved' | 'rejected';
  timestamp: number;
}

// =============================================================================
// Props & Emits
// =============================================================================

const props = withDefaults(defineProps<ApprovalActionsProps>(), {
  showApproveButton: true,
  showRejectButton: true,
});

const emit = defineEmits<ApprovalActionsEmits>();

// =============================================================================
// Composables
// =============================================================================

const { t } = useI18n();

// =============================================================================
// State
// =============================================================================

/** Loading state for async operations */
const loading = ref(false);

/** Processing state to prevent double submissions */
const isProcessing = ref(false);

/** Error message to display */
const error = ref<string | null>(null);

/** Whether the reject modal is open */
const showRejectModal = ref(false);

/** Rejection reason input */
const rejectReason = ref('');

/** Last operation timestamp for idempotency window */
const lastOperationTimestamp = ref<number | null>(null);

/** Show success toast notification */
const showSuccessToast = ref(false);

/** Success message content */
const successMessage = ref('');

// =============================================================================
// Constants
// =============================================================================

/** Minimum character count for rejection reason */
const MIN_REASON_LENGTH = 10;

/** Idempotency window in milliseconds */
const IDEMPOTENCY_WINDOW_MS = 5000;

// =============================================================================
// Computed
// =============================================================================

/**
 * Check if user has permission to approve the work order
 * Rules:
 * - Work order must be in 'pending_approval' status
 * - User must be the current approver
 * - User cannot approve their own work order
 */
const canApprove = computed(() => {
  if (!props.workOrder || !props.currentUserId) {
    return false;
  }
  
  // Check status - only pending_approval status allows approval
  if (props.workOrder.status !== 'pending_approval') {
    return false;
  }
  
  // Check permission - user must be current approver and not creator
  const isCurrentApprover = props.workOrder.current_approver_id === props.currentUserId;
  const isNotCreator = props.workOrder.created_by !== props.currentUserId;
  
  return props.showApproveButton && isCurrentApprover && isNotCreator;
});

/**
 * Check if user has permission to reject the work order
 * Same rules as approve, plus:
 * - User must provide a valid rejection reason
 */
const canReject = computed(() => {
  return canApprove.value && props.showRejectButton;
});

/**
 * Validate rejection reason length
 * Minimum 10 characters as per SPEC requirement
 */
const reasonValidationError = computed(() => {
  if (rejectReason.value.length === 0) {
    return null;
  }
  if (rejectReason.value.length < MIN_REASON_LENGTH) {
    return t('approval.reasonTooShort', { minLength: MIN_REASON_LENGTH });
  }
  return null;
});

/**
 * Check if the rejection reason is valid for submission
 */
const isRejectReasonValid = computed(() => {
  return rejectReason.value.length >= MIN_REASON_LENGTH;
});

/**
 * Check if the operation is within the idempotency window
 * Prevents duplicate submissions within 5 seconds
 */
const isWithinIdempotencyWindow = computed(() => {
  if (!lastOperationTimestamp.value) {
    return false;
  }
  return Date.now() - lastOperationTimestamp.value < IDEMPOTENCY_WINDOW_MS;
});

// =============================================================================
// Methods
// =============================================================================

/**
 * Handle approve button click
 * Calls backend API to approve the work order and advance state machine
 */
async function handleApprove(): Promise<void> {
  if (!props.workOrder || isProcessing.value || isWithinIdempotencyWindow.value) {
    return;
  }

  try {
    isProcessing.value = true;
    error.value = null;
    lastOperationTimestamp.value = Date.now();

    const result = await workOrderApi.approveWorkOrder(props.workOrder.id, props.currentUserId);

    // Update local state
    if (props.workOrder) {
      props.workOrder.status = 'approved';
      props.workOrder.approved_by = props.currentUserId;
      props.workOrder.approved_at = new Date().toISOString();
    }

    // Show success feedback
    showSuccess('approved');
    
    // Emit success event for parent components
    emit('approval-complete', {
      workOrderId: props.workOrder.id,
      action: 'approved',
      timestamp: Date.now(),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : t('approval.approveFailed');
    error.value = errorMsg;
    emit('approval-error', errorMsg);
  } finally {
    isProcessing.value = false;
  }
}

/**
 * Open the reject modal
 */
function openRejectModal(): void {
  showRejectModal.value = true;
  rejectReason.value = '';
}

/**
 * Close the reject modal and reset form
 */
function closeRejectModal(): void {
  showRejectModal.value = false;
  rejectReason.value = '';
}

/**
 * Handle reject confirmation
 * Calls backend API to reject the work order with reason
 */
async function handleReject(): Promise<void> {
  if (!props.workOrder || !isRejectReasonValid.value || isProcessing.value) {
    return;
  }

  try {
    isProcessing.value = true;
    error.value = null;
    lastOperationTimestamp.value = Date.now();

    const result = await workOrderApi.rejectWorkOrder(
      props.workOrder.id,
      props.currentUserId,
      rejectReason.value
    );

    // Update local state
    if (props.workOrder) {
      props.workOrder.status = 'rejected';
      props.workOrder.reject_reason = rejectReason.value;
      props.workOrder.rejected_by = props.currentUserId;
      props.workOrder.rejected_at = new Date().toISOString();
    }

    // Close modal and show success
    closeRejectModal();
    showSuccess('rejected');
    
    // Emit success event for parent components
    emit('approval-complete', {
      workOrderId: props.workOrder.id,
      action: 'rejected',
      timestamp: Date.now(),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : t('approval.rejectFailed');
    error.value = errorMsg;
    emit('approval-error', errorMsg);
  } finally {
    isProcessing.value = false;
  }
}

/**
 * Show success toast notification
 * @param action - The action that was performed
 */
function showSuccess(action: 'approved' | 'rejected'): void {
  successMessage.value = action === 'approved'
    ? t('approval.approveSuccess')
    : t('approval.rejectSuccess');
  showSuccessToast.value = true;
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    showSuccessToast.value = false;
  }, 3000);
}

/**
 * Reset component state
 */
function reset(): void {
  loading.value = false;
  isProcessing.value = false;
  error.value = null;
  showRejectModal.value = false;
  rejectReason.value = '';
  lastOperationTimestamp.value = null;
  showSuccessToast.value = false;
}

// =============================================================================
// Watchers
// =============================================================================

/**
 * Reset state when work order changes
 */
watch(() => props.workOrder, () => {
  reset();
});

// =============================================================================
// Expose
// =============================================================================

defineExpose({
  canApprove,
  canReject,
  reset,
});
</script>

<style scoped>
/**
 * ApprovalActions Component Styles
 * 
 * @styles
 * - Container styles for layout and positioning
 * - Button styles for approve/reject actions
 * - Modal styles for reject reason input
 * - Toast styles for success notifications
 * - Utility classes for loading and error states
 */

/* Container */
.approval-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-background, #fff);
  border-radius: 8px;
  border: 1px solid var(--color-border, #e5e7eb);
}

.approval-actions__loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.875rem;
}

.approval-actions__error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-error, #dc2626);
  font-size: 0.875rem;
  padding: 0.5rem;
  background: var(--color-error-light, #fef2f2);
  border-radius: 4px;
}

.approval-actions__buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn__icon {
  font-size: 1rem;
}

.btn--approve {
  background: var(--color-success, #059669);
  color: white;
}

.btn--approve:hover:not(:disabled) {
  background: var(--color-success-dark, #047857);
}

.btn--reject {
  background: var(--color-error, #dc2626);
  color: white;
}

.btn--reject:hover:not(:disabled) {
  background: var(--color-error-dark, #b91c1c);
}

.btn--secondary {
  background: var(--color-secondary, #6b7280);
  color: white;
}

.btn--secondary:hover:not(:disabled) {
  background: var(--color-secondary-dark, #4b5563);
}

.btn--danger {
  background: var(--color-error, #dc2626);
  color: white;
}

.btn--danger:hover:not(:disabled) {
  background: var(--color-error-dark, #b91c1c);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.modal__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin: 0;
}

.modal__close {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}

.modal__close:hover {
  color: var(--color-text-primary, #111827);
}

.modal__body {
  padding: 1.5rem;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

/* Form Elements */
.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
  margin-bottom: 0.5rem;
}

.required {
  color: var(--color-error, #dc2626);
  margin-left: 0.125rem;
}

.form-textarea {
  width: 100%;
  padding: 0.75rem;
  font-size: 0.875rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  resize: vertical;
  font-family: inherit;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea--error {
  border-color: var(--color-error, #dc2626);
}

.form-textarea--error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.form-error {
  font-size: 0.75rem;
  color: var(--color-error, #dc2626);
  margin-top: 0.375rem;
}

.form-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6b7280);
  margin-top: 0.375rem;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  z-index: 1100;
  animation: slideIn 0.3s ease;
}

.toast--success {
  background: var(--color-success, #059669);
  color: white;
}

.toast__icon {
  font-size: 1.125rem;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Spinner */
.spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

.spinner--small {
  width: 0.875rem;
  height: 0.875rem;
  margin-right: 0.375rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>