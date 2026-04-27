import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useApprovalStore } from '@/store/approvalStore';
import { toast } from 'sonner';
import { WorkOrderState } from '../../WorkOrder/types/workOrder';

interface ApprovalDialogProps {
  /** 工单ID */
  workOrderId: string;
  /** 当前工单状态 */
  currentState: WorkOrderState;
  /** 对话框是否打开 */
  open: boolean;
  /** 关闭对话框回调 */
  onClose: () => void;
  /** 审批成功回调 */
  onSuccess?: () => void;
}

/**
 * 审批操作对话框组件
 * 提供审批通过/拒绝的二次确认功能
 * 支持审批意见录入
 * 
 * @example
 * ```tsx
 * <ApprovalDialog
 *   workOrderId="WO-2025-001"
 *   currentState={WorkOrderState.PENDING}
 *   open={isDialogOpen}
 *   onClose={() => setIsDialogOpen(false)}
 *   onSuccess={() => refetchData()}
 * />
 * ```
 */
export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
  workOrderId,
  currentState,
  open,
  onClose,
  onSuccess,
}) => {
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { approveWorkOrder, rejectWorkOrder } = useApprovalStore();

  /**
   * 处理审批通过操作
   * @description 执行审批通过逻辑，包括状态转换、事件发布
   */
  const handleApprove = useCallback(async () => {
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      await approveWorkOrder(workOrderId, reason || undefined);
      toast.success('审批成功', {
        description: '工单已通过审批',
      });
      setReason('');
      setActionType(null);
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('审批失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [workOrderId, reason, isSubmitting, approveWorkOrder, onSuccess, onClose]);

  /**
   * 处理审批拒绝操作
   * @description 执行审批拒绝逻辑，包括状态回退、事件发布
   */
  const handleReject = useCallback(async () => {
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      await rejectWorkOrder(workOrderId, reason);
      toast.success('已拒绝', {
        description: '工单审批已拒绝',
      });
      setReason('');
      setActionType(null);
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('拒绝失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [workOrderId, reason, isSubmitting, rejectWorkOrder, onSuccess, onClose]);

  /**
   * 处理取消操作
   * @description 重置表单状态并关闭对话框
   */
  const handleCancel = useCallback(() => {
    setReason('');
    setActionType(null);
    onClose();
  }, [onClose]);

  /**
   * 获取对话框标题
   * @returns 根据操作类型返回对应标题
   */
  const getDialogTitle = (): string => {
    if (actionType === 'approve') {
      return '确认通过审批';
    }
    if (actionType === 'reject') {
      return '确认拒绝审批';
    }
    return '审批操作';
  };

  /**
   * 获取对话框描述
   * @returns 根据操作类型返回对应描述
   */
  const getDialogDescription = (): string => {
    if (actionType === 'approve') {
      return '请确认是否通过该工单的审批申请';
    }
    if (actionType === 'reject') {
      return '请输入拒绝原因以便后续追踪';
    }
    return '请选择审批操作';
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {!actionType ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                请选择审批操作：
              </p>
              <div className="flex gap-3">
                <Button
                  variant="default"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => setActionType('approve')}
                  disabled={currentState !== WorkOrderState.PENDING && 
                             currentState !== WorkOrderState.IN_PROGRESS}
                >
                  通过
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setActionType('reject')}
                  disabled={currentState !== WorkOrderState.PENDING && 
                             currentState !== WorkOrderState.IN_PROGRESS}
                >
                  拒绝
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {getDialogDescription()}
              </p>
              
              {/* 审批意见输入区域 */}
              <div className="space-y-2">
                <label htmlFor="reason" className="text-sm font-medium">
                  审批意见 {actionType === 'reject' && <span className="text-red-500">*</span>}
                </label>
                <Textarea
                  id="reason"
                  placeholder="请输入审批意见（可选，最多500字符）"
                  value={reason}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setReason(e.target.value);
                    }
                  }}
                  className="min-h-[100px] resize-none"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {reason.length}/500
                </p>
              </div>

              {/* 拒绝操作时显示意见必填提示 */}
              {actionType === 'reject' && !reason.trim() && (
                <p className="text-xs text-amber-600">
                  请输入审批意见以继续
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {actionType ? (
            <>
              <Button
                variant="outline"
                onClick={() => setActionType(null)}
                disabled={isSubmitting}
              >
                返回
              </Button>
              <Button
                variant={actionType === 'approve' ? 'default' : 'destructive'}
                onClick={actionType === 'approve' ? handleApprove : handleReject}
                disabled={
                  isSubmitting || 
                  (actionType === 'reject' && !reason.trim())
                }
                className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {isSubmitting ? '处理中...' : '确认'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleCancel}>
              取消
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApprovalDialog;