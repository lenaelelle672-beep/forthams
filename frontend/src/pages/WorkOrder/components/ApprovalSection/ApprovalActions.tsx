import React, { useState } from 'react';
import { Button, Input, Space, Typography, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Title } = Typography;

interface ApprovalActionsProps {
  /**
   * 是否禁用操作按钮
   * Iteration 1 阶段固定为 true（操作逻辑 Phase 2 实现）
   */
  disabled?: boolean;
  
  /**
   * 审批意见内容
   */
  comment: string;
  
  /**
   * 审批意见变更回调
   * @param value 新的审批意见内容
   */
  onCommentChange: (value: string) => void;
  
  /**
   * 审批通过回调（Phase 2 实现具体逻辑）
   * @param comment 审批意见
   */
  onApprove?: (comment: string) => void;
  
  /**
   * 审批驳回回调（Phase 2 实现具体逻辑）
   * @param comment 驳回原因
   */
  onReject?: (comment: string) => void;
}

/**
 * 工单审批操作按钮组件
 * 
 * 提供审批通过/驳回操作按钮及审批意见输入区域。
 * Iteration 1 阶段按钮置灰，操作逻辑预留接口。
 * 
 * @component
 * @example
 * ```tsx
 * <ApprovalActions
 *   disabled={true}
 *   comment={comment}
 *   onCommentChange={setComment}
 *   onApprove={handleApprove}
 *   onReject={handleReject}
 * />
 * ```
 */
const ApprovalActions: React.FC<ApprovalActionsProps> = ({
  disabled = true,
  comment,
  onCommentChange,
  onApprove,
  onReject,
}) => {
  /**
   * 处理审批通过点击事件
   * Iteration 1 阶段仅显示提示信息
   * 
   * @function handleApprove
   * @returns {void}
   */
  const handleApprove = (): void => {
    if (disabled) {
      message.warning('审批操作将在 Phase 2 中启用');
      return;
    }
    onApprove?.(comment);
  };

  /**
   * 处理审批驳回点击事件
   * Iteration 1 阶段仅显示提示信息
   * 
   * @function handleReject
   * @returns {void}
   */
  const handleReject = (): void => {
    if (disabled) {
      message.warning('审批操作将在 Phase 2 中启用');
      return;
    }
    onReject?.(comment);
  };

  return (
    <div 
      className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
      data-testid="approval-actions"
    >
      <Title level={5} className="mb-4">审批操作</Title>
      
      {/* 审批意见输入区域 */}
      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-2">审批意见</label>
        <TextArea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="请输入审批意见（选填）"
          autoSize={{ minRows: 3, maxRows: 6 }}
          data-testid="approval-comment-input"
          disabled={disabled}
        />
      </div>
      
      {/* 操作按钮区域 */}
      <Space size="middle">
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          disabled={disabled}
          onClick={handleApprove}
          title={disabled ? '操作逻辑 Phase 2 实现' : ''}
          data-testid="approve-button"
        >
          通过
        </Button>
        <Button
          danger
          icon={<CloseCircleOutlined />}
          disabled={disabled}
          onClick={handleReject}
          title={disabled ? '操作逻辑 Phase 2 实现' : ''}
          data-testid="reject-button"
        >
          驳回
        </Button>
      </Space>
      
      {/* 禁用状态提示 */}
      {disabled && (
        <p className="text-xs text-gray-400 mt-3">
          审批操作将在 Phase 2 中启用
        </p>
      )}
    </div>
  );
};

export default ApprovalActions;