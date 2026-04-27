/**
 * @file ApprovalActions.tsx
 * @description 审批操作组件 - 工单审批流程前端实现
 * 
 * ## 功能说明
 * 本模块提供工单审批的核心交互组件，包括：
 * - 审批通过操作 (ApproveAction)
 * - 审批驳回操作 (RejectAction)
 * - 批量审批组件 (BulkApprovalActions)
 * - 审批历史时间线展示 (ApprovalTimeline)
 * 
 * ## 业务规则
 * - 提交人可撤回草稿状态工单
 * - 审批人可对已提交工单执行通过/驳回操作
 * - 驳回必须填写原因
 * - 通过后可附加审批意见（可选）
 * 
 * ## 状态流转
 * - DRAFT → SUBMITTED (提交)
 * - SUBMITTED → APPROVED (通过)
 * - SUBMITTED → REJECTED (驳回至 DRAFT)
 * - REJECTED → SUBMITTED (重新提交)
 * 
 * @requires react
 * @requires frontend/src/types/approval
 * @requires frontend/src/services/approvalService
 */

import React, { useState, useCallback } from 'react';
import { Button, message, Modal, Input } from 'antd';
import { CheckOutlined, CloseOutlined, UndoOutlined } from '@ant-design/icons';
import type { WorkOrderStatus, ApprovalAction } from '@/types/approval';
import { approvalService } from '@/services/approvalService';

const { TextArea } = Input;

interface ApprovalActionsProps {
  /** 工单 ID */
  workOrderId: string;
  /** 当前工单状态 */
  currentStatus: WorkOrderStatus;
  /** 当前用户是否为审批人 */
  isApprover: boolean;
  /** 提交成功后回调 */
  onSuccess?: (action: ApprovalAction) => void;
  /** 提交失败后回调 */
  onError?: (error: Error) => void;
}

/**
 * 审批操作类型枚举
 */
enum ApprovalActionType {
  APPROVE = 'approve',
  REJECT = 'reject',
  RESUBMIT = 'resubmit',
}

/**
 * ApproveAction - 审批通过组件
 * 
 * @description
 * 提供审批通过的交互界面，包含可选的审批意见输入框。
 * 仅当工单状态为 SUBMITTED 且当前用户为审批人时可用。
 * 
 * @param props - 组件属性
 * @param props.workOrderId - 工单 ID
 * @param props.onSuccess - 成功回调
 * @param props.onError - 失败回调
 * @returns 审批通过按钮组件
 * 
 * @example
 * ```tsx
 * <ApproveAction
 *   workOrderId="WO-001"
 *   onSuccess={() => message.success('审批通过')}
 * />
 * ```
 */
export const ApproveAction: React.FC<{
  workOrderId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}> = ({ workOrderId, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);

  /**
   * 处理审批通过操作
   * 
   * @async
   * @description
   * 调用后端 API 执行审批通过操作：
   * 1. 设置加载状态
   * 2. 调用 approvalService.approve()
   * 3. 成功后显示消息并触发回调
   * 4. 失败时捕获错误并触发错误回调
   */
  const handleApprove = useCallback(async () => {
    setLoading(true);
    try {
      await approvalService.approve(workOrderId, comment || undefined);
      message.success('工单审批通过');
      setShowComment(false);
      setComment('');
      onSuccess?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('审批失败');
      message.error(err.message);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [workOrderId, comment, onSuccess, onError]);

  return (
    <div className="approval-action approve-action">
      {!showComment ? (
        <Button
          type="primary"
          icon={<CheckOutlined />}
          onClick={() => setShowComment(true)}
          disabled={loading}
        >
          通过
        </Button>
      ) : (
        <div className="approval-comment-form">
          <TextArea
            placeholder="请输入审批意见（可选）"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            showCount
          />
          <div className="action-buttons">
            <Button onClick={() => setShowComment(false)}>取消</Button>
            <Button
              type="primary"
              loading={loading}
              onClick={handleApprove}
              icon={<CheckOutlined />}
            >
              确认通过
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * RejectAction - 审批驳回组件
 * 
 * @description
 * 提供审批驳回的交互界面，驳回必须填写原因。
 * 仅当工单状态为 SUBMITTED 且当前用户为审批人时可用。
 * 
 * @param props - 组件属性
 * @param props.workOrderId - 工单 ID
 * @param props.onSuccess - 成功回调
 * @param props.onError - 失败回调
 * @returns 审批驳回按钮组件
 * 
 * @example
 * ```tsx
 * <RejectAction
 *   workOrderId="WO-001"
 *   onSuccess={() => refreshList()}
 * />
 * ```
 */
export const RejectAction: React.FC<{
  workOrderId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}> = ({ workOrderId, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [visible, setVisible] = useState(false);

  /**
   * 处理审批驳回操作
   * 
   * @async
   * @description
   * 调用后端 API 执行审批驳回操作：
   * 1. 校验驳回原因必填
   * 2. 设置加载状态
   * 3. 调用 approvalService.reject()
   * 4. 成功后重置表单并触发回调
   */
  const handleReject = useCallback(async () => {
    if (!reason.trim()) {
      message.error('请填写驳回原因');
      return;
    }

    setLoading(true);
    try {
      await approvalService.reject(workOrderId, reason);
      message.success('工单已驳回');
      setVisible(false);
      setReason('');
      onSuccess?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('驳回失败');
      message.error(err.message);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [workOrderId, reason, onSuccess, onError]);

  return (
    <>
      <Button
        danger
        icon={<CloseOutlined />}
        onClick={() => setVisible(true)}
      >
        驳回
      </Button>
      <Modal
        title="驳回工单"
        open={visible}
        onCancel={() => {
          setVisible(false);
          setReason('');
        }}
        onOk={handleReject}
        confirmLoading={loading}
        okText="确认驳回"
        cancelText="取消"
      >
        <div className="rejection-form">
          <label className="required">驳回原因：</label>
          <TextArea
            placeholder="请输入驳回原因（必填）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={500}
            showCount
          />
          <p className="hint">驳回后工单将返回给提交人修改</p>
        </div>
      </Modal>
    </>
  );
};

/**
 * ResubmitAction - 重新提交组件
 * 
 * @description
 * 提供重新提交草稿工单的交互界面。
 * 仅当工单状态为 DRAFT（被驳回后）且当前用户为提交人时可用。
 * 
 * @param props - 组件属性
 * @param props.workOrderId - 工单 ID
 * @param props.onSuccess - 成功回调
 * @returns 重新提交按钮组件
 */
export const ResubmitAction: React.FC<{
  workOrderId: string;
  onSuccess?: () => void;
}> = ({ workOrderId, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  /**
   * 处理重新提交操作
   */
  const handleResubmit = useCallback(async () => {
    setLoading(true);
    try {
      await approvalService.resubmit(workOrderId);
      message.success('工单已重新提交');
      onSuccess?.();
    } catch (error) {
      message.error('提交失败');
    } finally {
      setLoading(false);
    }
  }, [workOrderId, onSuccess]);

  return (
    <Button
      icon={<UndoOutlined />}
      onClick={handleResubmit}
      loading={loading}
    >
      重新提交
    </Button>
  );
};

/**
 * ApprovalActions - 审批操作主组件
 * 
 * @description
 * 整合所有审批操作的容器组件，根据工单状态和用户角色
 * 动态显示可用的操作按钮。
 * 
 * @param props - 组件属性
 * @returns 审批操作容器组件
 */
export const ApprovalActions: React.FC<ApprovalActionsProps> = ({
  workOrderId,
  currentStatus,
  isApprover,
  onSuccess,
  onError,
}) => {
  /**
   * 根据状态判断可用操作
   * 
   * @description
   * - DRAFT: 显示提交按钮
   * - SUBMITTED + 审批人: 显示通过/驳回按钮
   * - REJECTED: 显示重新提交按钮
   */
  const renderActions = () => {
    switch (currentStatus) {
      case WorkOrderStatus.DRAFT:
        return (
          <ResubmitAction
            workOrderId={workOrderId}
            onSuccess={onSuccess}
          />
        );

      case WorkOrderStatus.SUBMITTED:
        if (isApprover) {
          return (
            <div className="approval-actions">
              <ApproveAction
                workOrderId={workOrderId}
                onSuccess={onSuccess}
                onError={onError}
              />
              <RejectAction
                workOrderId={workOrderId}
                onSuccess={onSuccess}
                onError={onError}
              />
            </div>
          );
        }
        return null;

      case WorkOrderStatus.REJECTED:
        return (
          <ResubmitAction
            workOrderId={workOrderId}
            onSuccess={onSuccess}
          />
        );

      case WorkOrderStatus.APPROVED:
      case WorkOrderStatus.CLOSED:
      default:
        return null;
    }
  };

  return (
    <div className="approval-actions-container">
      {renderActions()}
    </div>
  );
};

/**
 * ApprovalTimeline - 审批历史时间线组件
 * 
 * @description
 * 展示工单的完整审批历史，以时间线形式呈现。
 * 每个节点包含操作类型、操作人、时间和备注信息。
 * 
 * @param props - 组件属性
 * @param props.records - 审批记录列表
 * @returns 审批历史时间线组件
 * 
 * @example
 * ```tsx
 * <ApprovalTimeline records={approvalHistory} />
 * ```
 */
interface ApprovalTimelineProps {
  records: Array<{
    id: string;
    action: ApprovalAction;
    operatorName: string;
    operatedAt: string;
    comment?: string;
    reason?: string;
  }>;
}

export const ApprovalTimeline: React.FC<ApprovalTimelineProps> = ({ records }) => {
  /**
   * 获取操作类型对应的显示文本和图标
   */
  const getActionDisplay = (action: ApprovalAction) => {
    const actionMap: Record<ApprovalAction, { label: string; color: string }> = {
      [ApprovalAction.SUBMIT]: { label: '提交', color: '#1890ff' },
      [ApprovalAction.APPROVE]: { label: '通过', color: '#52c41a' },
      [ApprovalAction.REJECT]: { label: '驳回', color: '#ff4d4f' },
      [ApprovalAction.RESUBMIT]: { label: '重新提交', color: '#faad14' },
    };
    return actionMap[action] || { label: action, color: '#999' };
  };

  if (!records || records.length === 0) {
    return (
      <div className="approval-timeline-empty">
        <p>暂无审批记录</p>
      </div>
    );
  }

  return (
    <div className="approval-timeline" data-testid="approval-timeline">
      {records.map((record, index) => {
        const { label, color } = getActionDisplay(record.action);
        return (
          <div
            key={record.id}
            className="timeline-node"
            data-testid="timeline-node"
          >
            <div className="timeline-dot" style={{ backgroundColor: color }} />
            {index < records.length - 1 && <div className="timeline-line" />}
            <div className="timeline-content">
              <div className="timeline-header">
                <span
                  className="timeline-action"
                  data-testid="action"
                  style={{ color }}
                >
                  {label}
                </span>
                <span className="timeline-time">{record.operatedAt}</span>
              </div>
              <div className="timeline-body">
                <span className="timeline-operator">{record.operatorName}</span>
                {record.comment && (
                  <p className="timeline-comment">{record.comment}</p>
                )}
                {record.reason && (
                  <p className="timeline-reason">原因：{record.reason}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * BulkApprovalActions - 批量审批组件
 * 
 * @description
 * 支持对多个工单进行批量审批操作。
 * 适用于审批人需要处理大量待审批工单的场景。
 * 
 * @param props - 组件属性
 * @param props.workOrderIds - 工单 ID 列表
 * @param props.onComplete - 批量操作完成回调
 * @returns 批量审批操作组件
 */
export const BulkApprovalActions: React.FC<{
  workOrderIds: string[];
  onComplete?: (results: Array<{ id: string; success: boolean; error?: string }>) => void;
}> = ({ workOrderIds, onComplete }) => {
  const [loading, setLoading] = useState(false);

  /**
   * 批量通过操作
   */
  const handleBulkApprove = useCallback(async () => {
    setLoading(true);
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of workOrderIds) {
      try {
        await approvalService.approve(id);
        results.push({ id, success: true });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    setLoading(false);
    onComplete?.(results);
  }, [workOrderIds, onComplete]);

  return (
    <div className="bulk-approval-actions">
      <Button
        type="primary"
        icon={<CheckOutlined />}
        onClick={handleBulkApprove}
        loading={loading}
        disabled={workOrderIds.length === 0}
      >
        批量通过 ({workOrderIds.length})
      </Button>
    </div>
  );
};

export default ApprovalActions;