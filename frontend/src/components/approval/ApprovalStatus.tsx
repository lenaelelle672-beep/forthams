/**
 * ApprovalStatus Component
 * 
 * 工单审批状态展示组件
 * 
 * 功能范围：
 * - 显示当前工单的审批状态
 * - 渲染审批历史记录列表
 * - 提供审批操作入口（通过/拒绝/退回修改）
 * 
 * 状态机联动：
 * - 组件加载时获取工单当前状态
 * - 审批操作后触发后端状态机状态流转
 * - 状态变更后刷新页面展示
 * 
 * @module components/approval/ApprovalStatus
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Tag, Timeline, Empty, Spin, message, Space, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, UndoOutlined, LoadingOutlined, HistoryOutlined } from '@ant-design/icons';
import { workOrderApi } from '../../pages/WorkOrder/api/workOrderApi';
import type { WorkOrder, ApprovalRecord, ApprovalStatus as ApprovalStatusType } from '../../pages/WorkOrder/types/workOrder';

const { Text, Title } = Typography;

interface ApprovalStatusProps {
  /** 工单 ID */
  workOrderId: string | number;
  /** 当前工单状态 */
  currentStatus: ApprovalStatusType;
  /** 当前用户是否有审批权限 */
  canApprove: boolean;
  /** 审批完成回调 */
  onApprovalComplete?: (newStatus: ApprovalStatusType) => void;
  /** 审批历史记录 */
  approvalHistory?: ApprovalRecord[];
  /** 是否加载中 */
  loading?: boolean;
}

/**
 * 审批操作类型
 */
type ApprovalAction = 'APPROVE' | 'REJECT' | 'RETURN';

/**
 * 审批状态映射配置
 */
const STATUS_CONFIG: Record<ApprovalStatusType, { color: string; label: string }> = {
  'PENDING_APPROVAL': { color: 'orange', label: '待审批' },
  'APPROVED': { color: 'green', label: '已通过' },
  'REJECTED': { color: 'red', label: '已拒绝' },
  'RETURNED': { color: 'purple', label: '退回修改' },
  'DRAFT': { color: 'default', label: '草稿' },
  'SUBMITTED': { color: 'blue', label: '已提交' },
  'CLOSED': { color: 'gray', label: '已关闭' },
};

/**
 * 审批操作映射配置
 */
const ACTION_CONFIG: Record<ApprovalAction, { color: string; icon: React.ReactNode; label: string }> = {
  'APPROVE': { color: 'green', icon: <CheckCircleOutlined />, label: '通过' },
  'REJECT': { color: 'red', icon: <CloseCircleOutlined />, label: '拒绝' },
  'RETURN': { color: 'purple', icon: <UndoOutlined />, label: '退回修改' },
};

/**
 * 格式化时间戳
 */
const formatTimestamp = (timestamp: string | Date): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * 审批状态展示组件
 * 
 * @param props - 组件属性
 * @returns React 组件
 */
export const ApprovalStatus: React.FC<ApprovalStatusProps> = ({
  workOrderId,
  currentStatus,
  canApprove,
  onApprovalComplete,
  approvalHistory: initialHistory = [],
  loading: externalLoading = false,
}) => {
  const { t } = useTranslation();
  
  // 组件内部状态
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>(initialHistory);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedAction, setSelectedAction] = useState<ApprovalAction | null>(null);

  // 合并加载状态
  const isLoading = externalLoading || internalLoading;

  /**
   * 加载审批历史记录
   */
  const fetchApprovalHistory = useCallback(async () => {
    if (!workOrderId) return;
    
    setInternalLoading(true);
    try {
      const history = await workOrderApi.getApprovalHistory(workOrderId);
      setApprovalHistory(history);
    } catch (error) {
      console.error('Failed to fetch approval history:', error);
      message.error('加载审批历史失败');
    } finally {
      setInternalLoading(false);
    }
  }, [workOrderId]);

  // 组件挂载时加载审批历史
  useEffect(() => {
    fetchApprovalHistory();
  }, [fetchApprovalHistory]);

  /**
   * 处理审批提交
   * 
   * 流程：
   * 1. 验证审批意见
   * 2. 调用后端 API 提交审批
   * 3. 后端触发状态机状态流转
   * 4. 刷新审批历史记录
   * 5. 通知父组件状态变更
   */
  const handleApprovalSubmit = useCallback(async () => {
    if (!selectedAction) {
      message.warning('请选择审批操作');
      return;
    }

    // 审批意见最小长度校验（后端同步）
    if (!comment || comment.trim().length < 5) {
      message.warning('审批意见至少需要5个字符');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 调用后端审批 API，触发状态机流转
      const result = await workOrderApi.submitApproval(workOrderId, {
        action: selectedAction,
        comment: comment.trim(),
        timestamp: new Date().toISOString(),
      });

      // 状态机流转成功，刷新审批历史
      await fetchApprovalHistory();
      
      // 重置表单状态
      setComment('');
      setSelectedAction(null);

      // 提示用户
      message.success(`审批${ACTION_CONFIG[selectedAction].label}成功`);
      
      // 通知父组件状态变更
      if (onApprovalComplete && result?.newStatus) {
        onApprovalComplete(result.newStatus as ApprovalStatusType);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '审批提交失败';
      console.error('Approval submission failed:', error);
      message.error(errorMessage);
      
      // 触发重试提示
      throw new Error(`审批提交失败: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedAction, comment, workOrderIdId, fetchApprovalHistory, onApprovalComplete]);

  /**
   * 处理取消操作
   */
  const handleCancel = useCallback(() => {
    setComment('');
    setSelectedAction(null);
  }, []);

  /**
   * 渲染审批操作区域
   */
  const renderApprovalActions = () => {
    // 非审批状态或无权限时隐藏操作区域
    if (currentStatus !== 'PENDING_APPROVAL' || !canApprove) {
      return null;
    }

    return (
      <Card 
        title="审批操作" 
        size="small"
        className="approval-actions-card"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* 操作按钮组 */}
          <Space wrap>
            {(Object.keys(ACTION_CONFIG) as ApprovalAction[]).map((action) => (
              <Button
                key={action}
                type={selectedAction === action ? 'primary' : 'default'}
                danger={action === 'REJECT'}
                icon={ACTION_CONFIG[action].icon}
                onClick={() => setSelectedAction(action)}
                disabled={isSubmitting}
              >
                {ACTION_CONFIG[action].label}
              </Button>
            ))}
          </Space>

          {/* 审批意见输入 */}
          <div className="approval-comment-section">
            <Text type="secondary" className="comment-label">
              审批意见（必填，至少5个字符）
            </Text>
            <textarea
              className="approval-comment-input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请输入审批意见..."
              disabled={isSubmitting}
              rows={3}
              minLength={5}
            />
          </div>

          {/* 提交/取消按钮 */}
          <Space>
            <Button
              type="primary"
              onClick={handleApprovalSubmit}
              loading={isSubmitting}
              disabled={!selectedAction || comment.trim().length < 5}
            >
              提交审批
            </Button>
            <Button onClick={handleCancel} disabled={isSubmitting}>
              取消
            </Button>
          </Space>
        </Space>
      </Card>
    );
  };

  /**
   * 渲染审批历史记录
   */
  const renderApprovalHistory = () => {
    if (isLoading) {
      return (
        <div className="approval-history-loading">
          <Spin indicator={<LoadingOutlined spin />} />
          <Text type="secondary">加载审批历史...</Text>
        </div>
      );
    }

    if (approvalHistory.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无审批记录"
        />
      );
    }

    return (
      <Timeline mode="left" className="approval-timeline">
        {approvalHistory.map((record, index) => (
          <Timeline.Item
            key={record.id || index}
            color={STATUS_CONFIG[record.action as ApprovalStatusType]?.color || 'blue'}
            label={formatTimestamp(record.createdAt || record.timestamp)}
          >
            <Card size="small" className="approval-history-item">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Space>
                  <Tag color={STATUS_CONFIG[record.action as ApprovalStatusType]?.color}>
                    {STATUS_CONFIG[record.action as ApprovalStatusType]?.label || record.action}
                  </Tag>
                  <Text type="secondary">
                    审批人：{record.approverName || record.approver}
                  </Text>
                </Space>
                {record.comment && (
                  <Text className="approval-comment">
                    意见：{record.comment}
                  </Text>
                )}
              </Space>
            </Card>
          </Timeline.Item>
        ))}
      </Timeline>
    );
  };

  return (
    <div className="approval-status-container" data-testid="approval-status">
      {/* 当前审批状态 */}
      <Card 
        title="审批状态" 
        size="small"
        extra={
          <Tag color={STATUS_CONFIG[currentStatus]?.color}>
            {STATUS_CONFIG[currentStatus]?.label}
          </Tag>
        }
      >
        <Space>
          <HistoryOutlined />
          <Text>工单 ID：{workOrderId}</Text>
        </Space>
      </Card>

      {/* 审批操作区域 */}
      {renderApprovalActions()}

      {/* 审批历史记录 */}
      <Card 
        title="审批历史" 
        size="small"
        className="approval-history-card"
      >
        {renderApprovalHistory()}
      </Card>
    </div>
  );
};

export default ApprovalStatus;