/**
 * ApprovalActionBar.tsx
 *
 * 工单审批操作栏组件。
 * 仅在工单状态为 PENDING_APPROVAL 时渲染，提供：
 *  - 审批意见输入框（可选填）
 *  - 审批通过按钮 → POST /api/v1/wo/{id}/approve
 *  - 审批驳回按钮 → POST /api/v1/wo/{id}/reject
 *
 * 审批成功后触发 onSuccess 回调，由父组件负责页面状态刷新。
 *
 * @module ApprovalActionBar
 */

import React, { useState, useCallback } from 'react';
import { Button, Input, Space, message, Popconfirm, Divider, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, CommentOutlined } from '@ant-design/icons';
import { approveWorkOrder, rejectWorkOrder } from '../api/workOrderApi';
import { WorkOrderStatus } from '../types/workOrder';

const { TextArea } = Input;
const { Text } = Typography;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/**
 * ApprovalActionBar 组件 Props 定义
 */
export interface ApprovalActionBarProps {
  /** 目标工单 ID */
  workOrderId: string;
  /** 当前工单状态；非 PENDING_APPROVAL 时组件不渲染 */
  status: WorkOrderStatus;
  /** 审批/驳回成功后的回调，父组件可在此刷新工单详情 */
  onSuccess?: (action: 'approve' | 'reject') => void;
  /** 审批失败后的回调（可选）*/
  onError?: (action: 'approve' | 'reject', error: Error) => void;
  /** 是否禁用（例如当前用户无审批权限时）*/
  disabled?: boolean;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

/**
 * 工单审批操作栏
 *
 * 包含审批意见输入框、审批通过与审批驳回两个操作按钮。
 * 仅当工单处于 PENDING_APPROVAL 状态时渲染；否则返回 null。
 *
 * @param props - {@link ApprovalActionBarProps}
 * @returns JSX.Element | null
 */
const ApprovalActionBar: React.FC<ApprovalActionBarProps> = ({
  workOrderId,
  status,
  onSuccess,
  onError,
  disabled = false,
}) => {
  /** 审批意见文本内容 */
  const [comment, setComment] = useState<string>('');
  /** 审批通过加载状态 */
  const [approving, setApproving] = useState<boolean>(false);
  /** 审批驳回加载状态 */
  const [rejecting, setRejecting] = useState<boolean>(false);

  // 只有 PENDING_APPROVAL 状态的工单才展示审批操作栏
  if (status !== WorkOrderStatus.PENDING_APPROVAL) {
    return null;
  }

  /**
   * 执行审批通过操作
   *
   * 调用 POST /api/v1/wo/{workOrderId}/approve，
   * 成功后显示提示并触发 onSuccess 回调。
   */
  const handleApprove = useCallback(async () => {
    setApproving(true);
    try {
      await approveWorkOrder(workOrderId, comment.trim());
      message.success('审批通过成功');
      setComment('');
      onSuccess?.('approve');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      message.error(`审批失败：${error.message}`);
      onError?.('approve', error);
    } finally {
      setApproving(false);
    }
  }, [workOrderId, comment, onSuccess, onError]);

  /**
   * 执行审批驳回操作
   *
   * 调用 POST /api/v1/wo/{workOrderId}/reject。
   * 驳回前通过 Popconfirm 再次确认，防止误操作。
   * 成功后显示提示并触发 onSuccess 回调。
   */
  const handleReject = useCallback(async () => {
    setRejecting(true);
    try {
      await rejectWorkOrder(workOrderId, comment.trim());
      message.success('已驳回该工单');
      setComment('');
      onSuccess?.('reject');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      message.error(`驳回失败：${error.message}`);
      onError?.('reject', error);
    } finally {
      setRejecting(false);
    }
  }, [workOrderId, comment, onSuccess, onError]);

  /** 任意操作正在加载中 */
  const loading = approving || rejecting;

  return (
    <div
      data-testid="approval-action-bar"
      style={{
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        padding: '20px 24px',
        marginTop: 24,
      }}
    >
      {/* 标题区 */}
      <Space align="center" style={{ marginBottom: 12 }}>
        <CommentOutlined style={{ color: '#1677ff', fontSize: 16 }} />
        <Text strong style={{ fontSize: 15 }}>
          审批操作
        </Text>
      </Space>

      <Divider style={{ margin: '0 0 16px' }} />

      {/* 审批意见输入框 */}
      <TextArea
        data-testid="approval-comment-input"
        placeholder="请输入审批意见（可选）"
        rows={3}
        maxLength={500}
        showCount
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={loading || disabled}
        style={{ marginBottom: 16, resize: 'none' }}
      />

      {/* 操作按钮区 */}
      <Space size="middle">
        {/* 审批通过 */}
        <Button
          data-testid="approve-button"
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={approving}
          disabled={rejecting || disabled}
          onClick={handleApprove}
          style={{ minWidth: 108 }}
        >
          审批通过
        </Button>

        {/* 审批驳回（带二次确认） */}
        <Popconfirm
          title="确认驳回"
          description="驳回后工单将退回申请人，是否确认？"
          okText="确认驳回"
          cancelText="取消"
          okButtonProps={{ danger: true, loading: rejecting }}
          onConfirm={handleReject}
          disabled={approving || disabled}
        >
          <Button
            data-testid="reject-button"
            danger
            icon={<CloseCircleOutlined />}
            loading={rejecting}
            disabled={approving || disabled}
            style={{ minWidth: 108 }}
          >
            审批驳回
          </Button>
        </Popconfirm>
      </Space>
    </div>
  );
};

export default ApprovalActionBar;