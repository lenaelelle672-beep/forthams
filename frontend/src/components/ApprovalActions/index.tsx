/**
 * ApprovalActions Component Specification
 * 工单审批操作组件规格文档
 * 
 * @version 1.0.0
 * @specRef feat(wo): 工单审批流程前端页面 - Iteration 1
 * @lastUpdated 2025-01-25
 */

import React, { useState, useCallback } from 'react';
import { Button, Space, Modal, Input, message, Tooltip } from 'antd';
import { CheckOutlined, CloseOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useApprovalStore } from '@/stores/approvalStore';
import type { WorkOrder, ApprovalRecord } from '@/types/workorder.types';

const { TextArea } = Input;

/**
 * ApprovalActions Props Interface
 * 审批操作组件属性接口
 */
export interface ApprovalActionsProps {
  /** 工单数据 */
  workOrder: WorkOrder;
  /** 是否禁用操作按钮 */
  disabled?: boolean;
  /** 审批通过回调 */
  onApprove?: (record: ApprovalRecord) => void;
  /** 审批拒绝回调 */
  onReject?: (record: ApprovalRecord) => void;
  /** 审批完成回调 */
  onComplete?: (action: 'approve' | 'reject', record: ApprovalRecord) => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * ApprovalActions Component
 * 工单审批操作组件
 * 
 * 功能说明：
 * - 提供工单的审批通过/拒绝操作入口
 * - 支持审批意见填写
 * - 包含二次确认机制
 * - 集成审批状态管理
 * 
 * 使用约束：
 * - 仅在工单状态为 PENDING 时显示
 * - 仅审批人有权限操作
 * - 拒绝时必须填写原因
 * 
 * @param props - 组件属性
 * @returns React 组件
 * 
 * @example
 * ```tsx
 * <ApprovalActions
 *   workOrder={workOrder}
 *   onComplete={(action, record) => console.log(action, record)}
 * />
 * ```
 */
export const ApprovalActions: React.FC<ApprovalActionsProps> = ({
  workOrder,
  disabled = false,
  onApprove,
  onReject,
  onComplete,
  className,
}) => {
  // ==================== State Management ====================
  
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approveComment, setApproveComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  // Zustand store actions
  const { approveWorkOrder, rejectWorkOrder, getApprovalHistory } = useApprovalStore();

  // ==================== Validation Rules ====================
  
  /**
   * 拒绝原因验证规则
   * - 必填
   * - 最少 5 个字符
   * - 最多 500 个字符
   */
  const validateRejectReason = useCallback((value: string): string | null => {
    if (!value || value.trim().length === 0) {
      return '请输入拒绝原因';
    }
    if (value.trim().length < 5) {
      return '拒绝原因至少需要 5 个字符';
    }
    if (value.length > 500) {
      return '拒绝原因不能超过 500 个字符';
    }
    return null;
  }, []);

  /**
   * 审批意见验证规则
   * - 非必填
   * - 最多 500 个字符
   */
  const validateApproveComment = useCallback((value: string): string | null => {
    if (value.length > 500) {
      return '审批意见不能超过 500 个字符';
    }
    return null;
  }, []);

  // ==================== Action Handlers ====================
  
  /**
   * 打开审批通过弹窗
   */
  const handleOpenApproveModal = useCallback(() => {
    if (disabled) {
      message.warning('当前工单不允许审批操作');
      return;
    }
    if (workOrder.status !== 'PENDING') {
      message.warning('仅待审批状态的工单可以审批');
      return;
    }
    setApproveComment('');
    setApproveModalOpen(true);
  }, [disabled, workOrder.status]);

  /**
   * 打开审批拒绝弹窗
   */
  const handleOpenRejectModal = useCallback(() => {
    if (disabled) {
      message.warning('当前工单不允许审批操作');
      return;
    }
    if (workOrder.status !== 'PENDING') {
      message.warning('仅待审批状态的工单可以审批');
      return;
    }
    setRejectReason('');
    setRejectModalOpen(true);
  }, [disabled, workOrder.status]);

  /**
   * 执行审批通过操作
   */
  const handleApprove = useCallback(async () => {
    // Validation
    const validationError = validateApproveComment(approveComment);
    if (validationError) {
      message.error(validationError);
      return;
    }

    setLoading('approve');

    try {
      // Build approval record
      const approvalRecord: ApprovalRecord = {
        id: `apr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workOrderId: workOrder.id,
        approverId: 'current_user', // TODO: Replace with actual user ID from auth context
        approverName: 'Current User', // TODO: Replace with actual user name
        action: 'APPROVE',
        comment: approveComment.trim() || undefined,
        timestamp: new Date().toISOString(),
      };

      // Call API
      await approveWorkOrder(workOrder.id, approvalRecord);

      // Success handling
      message.success('工单审批通过');
      setApproveModalOpen(false);
      
      // Trigger callbacks
      onApprove?.(approvalRecord);
      onComplete?.('approve', approvalRecord);

    } catch (error) {
      console.error('Approval failed:', error);
      message.error('审批操作失败，请重试');
    } finally {
      setLoading(null);
    }
  }, [approveComment, workOrder.id, approveWorkOrder, onApprove, onComplete, validateApproveComment]);

  /**
   * 执行审批拒绝操作
   */
  const handleReject = useCallback(async () => {
    // Validation
    const validationError = validateRejectReason(rejectReason);
    if (validationError) {
      message.error(validationError);
      return;
    }

    setLoading('reject');

    try {
      // Build approval record
      const approvalRecord: ApprovalRecord = {
        id: `apr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workOrderId: workOrder.id,
        approverId: 'current_user', // TODO: Replace with actual user ID from auth context
        approverName: 'Current User', // TODO: Replace with actual user name
        action: 'REJECT',
        comment: rejectReason.trim(),
        timestamp: new Date().toISOString(),
      };

      // Call API
      await rejectWorkOrder(workOrder.id, approvalRecord);

      // Success handling
      message.success('工单已拒绝');
      setRejectModalOpen(false);
      
      // Trigger callbacks
      onReject?.(approvalRecord);
      onComplete?.('reject', approvalRecord);

    } catch (error) {
      console.error('Rejection failed:', error);
      message.error('审批操作失败，请重试');
    } finally {
      setLoading(null);
    }
  }, [rejectReason, workOrder.id, rejectWorkOrder, onReject, onComplete, validateRejectReason]);

  /**
   * 取消操作并关闭弹窗
   */
  const handleCancel = useCallback(() => {
    setApproveModalOpen(false);
    setRejectModalOpen(false);
    setApproveComment('');
    setRejectReason('');
  }, []);

  // ==================== Render Helpers ====================
  
  /**
   * 判断是否显示审批操作按钮
   * 条件：工单状态为 PENDING 且未禁用
   */
  const shouldShowActions = workOrder.status === 'PENDING' && !disabled;

  // ==================== Component Render ====================
  
  return (
    <>
      <Space className={className} size="middle">
        <Tooltip title={!shouldShowActions ? '工单不在可审批状态' : ''}>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleOpenApproveModal}
            disabled={!shouldShowActions}
            className="bg-green-600 hover:bg-green-700"
          >
            通过
          </Button>
        </Tooltip>
        
        <Tooltip title={!shouldShowActions ? '工单不在可审批状态' : ''}>
          <Button
            danger
            icon={<CloseOutlined />}
            onClick={handleOpenRejectModal}
            disabled={!shouldShowActions}
          >
            拒绝
          </Button>
        </Tooltip>
      </Space>

      {/* 审批通过确认弹窗 */}
      <Modal
        title={
          <Space>
            <CheckOutlined className="text-green-600" />
            <span>确认审批通过</span>
          </Space>
        }
        open={approveModalOpen}
        onOk={handleApprove}
        onCancel={handleCancel}
        confirmLoading={loading === 'approve'}
        okText="确认通过"
        cancelText="取消"
        width={480}
      >
        <div className="py-4">
          <p className="mb-4 text-gray-600">
            确定要通过此工单的审批吗？
          </p>
          
          <div className="mb-2 text-sm font-medium text-gray-700">
            工单信息
          </div>
          <div className="p-3 mb-4 bg-gray-50 rounded-md">
            <div className="text-sm">
              <span className="text-gray-500">工单编号：</span>
              <span className="font-medium">{workOrder.id}</span>
            </div>
            <div className="text-sm mt-1">
              <span className="text-gray-500">工单标题：</span>
              <span className="font-medium">{workOrder.title}</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              审批意见（可选）
            </label>
            <TextArea
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="请输入审批意见，可为空"
              rows={3}
              maxLength={500}
              showCount
            />
          </div>
        </div>
      </Modal>

      {/* 审批拒绝确认弹窗 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined className="text-red-500" />
            <span>确认审批拒绝</span>
          </Space>
        }
        open={rejectModalOpen}
        onOk={handleReject}
        onCancel={handleCancel}
        confirmLoading={loading === 'reject'}
        okText="确认拒绝"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        width={480}
      >
        <div className="py-4">
          <p className="mb-4 text-gray-600">
            确定要拒绝此工单的审批吗？拒绝后无法撤销。
          </p>
          
          <div className="mb-2 text-sm font-medium text-gray-700">
            工单信息
          </div>
          <div className="p-3 mb-4 bg-gray-50 rounded-md">
            <div className="text-sm">
              <span className="text-gray-500">工单编号：</span>
              <span className="font-medium">{workOrder.id}</span>
            </div>
            <div className="text-sm mt-1">
              <span className="text-gray-500">工单标题：</span>
              <span className="font-medium">{workOrder.title}</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              <span className="text-red-500 mr-1">*</span>
              拒绝原因（必填）
            </label>
            <TextArea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因，至少 5 个字符"
              rows={4}
              maxLength={500}
              showCount
              status={rejectReason.trim().length > 0 && rejectReason.trim().length < 5 ? 'error' : undefined}
            />
            {rejectReason.trim().length > 0 && rejectReason.trim().length < 5 && (
              <div className="mt-1 text-xs text-red-500">
                拒绝原因至少需要 5 个字符
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

/**
 * Default export
 */
export default ApprovalActions;

// ==================== Type Exports ====================

export type { ApprovalActionsProps };

// ==================== Sub-components ====================

/**
 * ApprovalButtonGroup
 * 审批按钮组子组件
 * 用于更细粒度的按钮控制
 */
export interface ApprovalButtonGroupProps {
  workOrder: WorkOrder;
  disabled?: boolean;
  showApprove?: boolean;
  showReject?: boolean;
  size?: 'small' | 'middle' | 'large';
  onApprove?: (record: ApprovalRecord) => void;
  onReject?: (record: ApprovalRecord) => void;
}

export const ApprovalButtonGroup: React.FC<ApprovalButtonGroupProps> = ({
  workOrder,
  disabled = false,
  showApprove = true,
  showReject = true,
  size = 'middle',
  onApprove,
  onReject,
}) => {
  const canApprove = workOrder.status === 'PENDING' && !disabled && showApprove;
  const canReject = workOrder.status === 'PENDING' && !disabled && showReject;

  const handleApprove = async () => {
    if (!canApprove) return;
    
    const record: ApprovalRecord = {
      id: `apr_${Date.now()}`,
      workOrderId: workOrder.id,
      approverId: 'current_user',
      approverName: 'Current User',
      action: 'APPROVE',
      timestamp: new Date().toISOString(),
    };
    
    onApprove?.(record);
  };

  const handleReject = async () => {
    if (!canReject) return;
    
    const record: ApprovalRecord = {
      id: `apr_${Date.now()}`,
      workOrderId: workOrder.id,
      approverId: 'current_user',
      approverName: 'Current User',
      action: 'REJECT',
      timestamp: new Date().toISOString(),
    };
    
    onReject?.(record);
  };

  return (
    <Space size={size}>
      {showApprove && (
        <Button
          type="primary"
          size={size}
          icon={<CheckOutlined />}
          onClick={handleApprove}
          disabled={!canApprove}
        >
          通过
        </Button>
      )}
      {showReject && (
        <Button
          danger
          size={size}
          icon={<CloseOutlined />}
          onClick={handleReject}
          disabled={!canReject}
        >
          拒绝
        </Button>
      )}
    </Space>
  );
};