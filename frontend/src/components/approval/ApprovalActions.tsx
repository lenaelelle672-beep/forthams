import { useState } from 'react';
import { workOrderApi } from '@/api/workorder';
import { useToast } from '@/hooks/useNotifications';
import { WorkOrderStatus } from '@/types/workorder.types';
import RejectModal from './RejectModal';

export interface ApprovalActionsProps {
  workOrderId: string;
  currentStatus: WorkOrderStatus;
  canApprove: boolean;
  onStatusChange?: (newStatus: WorkOrderStatus) => void;
}

/**
 * 工单审批操作组件
 * 
 * 功能需求:
 * 1. canApprove=true 时渲染「通过」「驳回」按钮
 * 2. 驳回点击弹出 RejectModal
 * 3. 操作后显示 Toast 并刷新状态
 * 
 * @description
 * - 仅在 PENDING_REVIEW 状态下显示审批按钮
 * - 审批人必须是 current_approver_id 且不能是创建者
 * - 驳回操作必须填写原因（最多 200 字符）
 */
export function ApprovalActions({
  workOrderId,
  currentStatus,
  canApprove,
  onStatusChange
}: ApprovalActionsProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const { showToast } = useToast();

  const isPendingReview = currentStatus?.value === 'PENDING_REVIEW' || 
                          currentStatus === 'PENDING_REVIEW';

  const handleApprove = async () => {
    if (!canApprove || !isPendingReview) return;
    
    setIsApproving(true);
    try {
      const response = await workOrderApi.approve(workOrderId);
      if (response?.status === 'APPROVED') {
        showToast({
          type: 'success',
          message: '工单已通过审批'
        });
        onStatusChange?.({ value: 'APPROVED', label: '已审批' } as WorkOrderStatus);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '审批失败，请稍后重试';
      showToast({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (rejectReason: string) => {
    if (!canApprove || !isPendingReview) return;
    
    if (!rejectReason || rejectReason.trim().length === 0) {
      showToast({
        type: 'error',
        message: '请填写驳回原因'
      });
      return;
    }

    if (rejectReason.length > 200) {
      showToast({
        type: 'error',
        message: '驳回原因不能超过 200 字符'
      });
      return;
    }

    setIsRejecting(true);
    try {
      const response = await workOrderApi.reject(workOrderId, rejectReason);
      if (response?.status === 'REJECTED') {
        showToast({
          type: 'success',
          message: '工单已驳回'
        });
        onStatusChange?.({ value: 'REJECTED', label: '已驳回' } as WorkOrderStatus);
        setShowRejectModal(false);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '驳回失败，请稍后重试';
      showToast({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setIsRejecting(false);
    }
  };

  // 无审批权限或非待审批状态时不显示按钮
  if (!canApprove || !isPendingReview) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {/* 通过按钮 */}
        <button
          onClick={handleApprove}
          disabled={isApproving || isRejecting}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="通过审批"
        >
          {isApproving ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              处理中...
            </span>
          ) : (
            '通过'
          )}
        </button>

        {/* 驳回按钮 */}
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={isApproving || isRejecting}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="驳回工单"
        >
          {isRejecting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              处理中...
            </span>
          ) : (
            '驳回'
          )}
        </button>
      </div>

      {/* 驳回弹窗 */}
      <RejectModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        maxLength={200}
      />
    </>
  );
}

export default ApprovalActions;