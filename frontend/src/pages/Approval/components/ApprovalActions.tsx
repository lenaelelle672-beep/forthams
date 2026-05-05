/**
 * ApprovalActions Component
 * 
 * Provides approve/reject action buttons for work order approval workflow.
 * Implements confirmation dialog and toast notifications per spec SWARM-2025-Q2-P0-003.
 * 
 * @component
 * @features
 *   - Approve/Reject buttons with confirmation dialog
 *   - Comment/reason validation (max 500 chars for rejection)
 *   - Toast notifications for action results
 *   - Loading states during async operations
 *   - Permission-based button visibility
 * 
 * @requirements
 *   - Level 4: Frontend Layer (ApprovalActions component)
 *   - Level 4.3: 弹窗与反馈 - 二次确认 Dialog, Toast 通知
 *   - E2E-006: 二次确认弹窗 - 点击通过/拒绝按钮弹出确认
 *   - E2E-007: 意见必填校验 - 拒绝时未输入意见点击确认
 */

import React, { useState } from 'react';
import { Button, Dialog, DialogContent, DialogActions, TextField, Typography, Box, CircularProgress } from '@mui/material';
import { CheckCircle, Cancel, Send } from '@mui/icons-material';
import { toast } from 'sonner';

// Type definitions for approval actions
export interface ApprovalActionsProps {
  /** Work order ID for the approval action */
  workOrderId: string;
  /** Current version for optimistic locking */
  version: number;
  /** Callback when approval action succeeds */
  onSuccess?: (result: ApprovalResult) => void;
  /** Callback when approval action fails */
  onError?: (error: Error) => void;
  /** Whether the user has approval permission */
  canApprove?: boolean;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Additional CSS class for styling */
  className?: string;
}

/** Result of approval action */
export interface ApprovalResult {
  workOrderId: string;
  action: 'approve' | 'reject';
  version: number;
  timestamp: Date;
  reason?: string;
}

/** Dialog state for confirmation */
interface DialogState {
  isOpen: boolean;
  action: 'approve' | 'reject' | null;
  reason: string;
  isSubmitting: boolean;
}

/**
 * ApprovalActions Component
 * 
 * Renders approve/reject buttons with confirmation dialog for work order approval.
 * Follows spec requirements for confirmation flow and validation.
 * 
 * @param props - Component props including workOrderId, version, callbacks
 * @returns React component with approve/reject functionality
 */
export const ApprovalActions: React.FC<ApprovalActionsProps> = ({
  workOrderId,
  version,
  onSuccess,
  onError,
  canApprove = true,
  isLoading = false,
  className,
}) => {
  // Dialog state management
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    action: null,
    reason: '',
    isSubmitting: false,
  });

  /**
   * Opens confirmation dialog for specified action
   * 
   * @param action - 'approve' or 'reject'
   */
  const handleOpenDialog = (action: 'approve' | 'reject') => {
    if (!canApprove) {
      toast.error('您没有审批权限');
      return;
    }
    setDialogState({
      isOpen: true,
      action,
      reason: '',
      isSubmitting: false,
    });
  };

  /**
   * Closes confirmation dialog and resets state
   */
  const handleCloseDialog = () => {
    setDialogState({
      isOpen: false,
      action: null,
      reason: '',
      isSubmitting: false,
    });
  };

  /**
   * Validates reason field for rejection
   * Per spec: 最大 500 字符
   * 
   * @returns Validation result with isValid flag and error message
   */
  const validateReason = (): { isValid: boolean; error?: string } => {
    if (dialogState.action === 'reject') {
      const trimmedReason = dialogState.reason.trim();
      if (trimmedReason.length === 0) {
        return { isValid: false, error: '请输入审批意见' };
      }
      if (trimmedReason.length > 500) {
        return { isValid: false, error: '审批意见不能超过 500 字符' };
      }
    }
    return { isValid: true };
  };

  /**
   * Handles submission of approval action
   * Implements confirmation flow and error handling per spec
   */
  const handleSubmit = async () => {
    // Validate reason for rejection
    const validation = validateReason();
    if (!validation.isValid) {
      toast.error(validation.error || '请填写审批意见');
      return;
    }

    setDialogState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const action = dialogState.action;
      const apiEndpoint = `/api/v1/work-orders/${workOrderId}/${action}`;
      const requestBody = {
        version,
        reason: action === 'reject' ? dialogState.reason.trim() : undefined,
      };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `审批${action === 'approve' ? '通过' : '拒绝'}失败`);
      }

      // Handle successful approval
      const result: ApprovalResult = {
        workOrderId,
        action: action as 'approve' | 'reject',
        version: version + 1,
        timestamp: new Date(),
        reason: action === 'reject' ? dialogState.reason.trim() : undefined,
      };

      // Show success toast per spec requirements
      toast.success(action === 'approve' ? '审批通过' : '已拒绝', {
        description: action === 'approve' ? '工单已审批通过' : '工单已拒绝',
      });

      handleCloseDialog();
      onSuccess?.(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '操作失败';
      
      // Handle specific error cases per spec
      // IT-005: 并发冲突处理 - 同一工单两次审批请求第二次返回 409
      // IT-008: 状态已终态拒绝修改 - APPROVED 状态工单调用 approve 返回 422
      if (errorMessage.includes('409') || errorMessage.includes('conflict')) {
        toast.error('工单已被其他用户审批，请刷新后重试');
      } else if (errorMessage.includes('422') || errorMessage.includes('终态')) {
        toast.error('工单状态已无法修改');
      } else {
        toast.error(errorMessage);
      }
      
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setDialogState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  /**
   * Handles reason input change with validation
   */
  const handleReasonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    // Enforce max 500 char limit per spec
    if (value.length <= 500) {
      setDialogState(prev => ({ ...prev, reason: value }));
    }
  };

  // Permission check - hide actions if user cannot approve
  if (!canApprove && !isLoading) {
    return null;
  }

  return (
    <>
      <Box className={className} sx={{ display: 'flex', gap: 2 }}>
        {/* Approve Button */}
        <Button
          variant="contained"
          color="success"
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
          disabled={isLoading || !canApprove}
          onClick={() => handleOpenDialog('approve')}
          data-testid="approve-button"
          sx={{
            minWidth: 120,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          通过
        </Button>

        {/* Reject Button */}
        <Button
          variant="contained"
          color="error"
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <Cancel />}
          disabled={isLoading || !canApprove}
          onClick={() => handleOpenDialog('reject')}
          data-testid="reject-button"
          sx={{
            minWidth: 120,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          拒绝
        </Button>
      </Box>

      {/* Confirmation Dialog - E2E-006 */}
      <Dialog
        open={dialogState.isOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        data-testid="confirmation-dialog"
      >
        <DialogContent>
          <Typography variant="h6" component="div" gutterBottom>
            确认{dialogState.action === 'approve' ? '通过' : '拒绝'}审批
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {dialogState.action === 'approve'
              ? '确定要通过此工单的审批申请吗？'
              : '请输入拒绝原因以便申请人了解情况。'}
          </Typography>

          {/* Reason input for rejection - E2E-007 validation */}
          {dialogState.action === 'reject' && (
            <TextField
              label="审批意见"
              multiline
              rows={4}
              fullWidth
              value={dialogState.reason}
              onChange={handleReasonChange}
              placeholder="请输入拒绝原因（必填，最多500字符）"
              required
              inputProps={{ maxLength: 500 }}
              helperText={`${dialogState.reason.length}/500 字符`}
              error={dialogState.reason.length > 500}
              data-testid="reason-input"
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCloseDialog}
            disabled={dialogState.isSubmitting}
            data-testid="cancel-button"
          >
            取消
          </Button>
          <Button
            variant="contained"
            color={dialogState.action === 'approve' ? 'success' : 'error'}
            onClick={handleSubmit}
            disabled={dialogState.isSubmitting || (dialogState.action === 'reject' && !dialogState.reason.trim())}
            startIcon={dialogState.isSubmitting ? <CircularProgress size={20} color="inherit" /> : <Send />}
            data-testid="confirm-button"
          >
            {dialogState.isSubmitting ? '处理中...' : '确认'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ApprovalActions;