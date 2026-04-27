/**
 * WorkOrderDetailCard Component
 * 
 * 工单详情卡片组件 - SWARM-S5-001 工单审批流程
 * 
 * 功能职责：
 * - 展示工单基本信息（标题、描述、状态、审批人等）
 * - 提供审批操作入口（审批通过/驳回按钮）
 * - 展示审批历史记录
 * - 收集审批意见
 * 
 * @description
 * 本组件是工单审批流程的前端核心组件，负责：
 * 1. 展示工单的完整信息供审批人决策
 * 2. 提供简洁的审批操作界面
 * 3. 记录审批过程中的用户意见
 * 4. 展示工单的历史审批记录
 * 
 * 状态流转对应关系：
 * - PENDING_APPROVAL → 可执行审批通过/驳回
 * - APPROVED / REJECTED → 仅展示，不可操作
 * - 其他状态 → 根据业务规则显示
 * 
 * @version 1.0.0
 * @date 2025-01-20
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, Typography, Space, Tag, Button, Input, Timeline, message, Divider, Descriptions, Avatar, Tooltip } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import type { DescriptionsProps } from 'antd';

const { Title, Text, Paragraph } = Typography;

/**
 * 工单状态枚举 - 与后端 WorkOrderStatus 保持一致
 */
export enum WorkOrderStatusEnum {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

/**
 * 工单状态展示配置
 */
const STATUS_CONFIG: Record<WorkOrderStatusEnum, { color: string; label: string }> = {
  [WorkOrderStatusEnum.DRAFT]: { color: 'default', label: '草稿' },
  [WorkOrderStatusEnum.PENDING_APPROVAL]: { color: 'warning', label: '待审批' },
  [WorkOrderStatusEnum.APPROVED]: { color: 'success', label: '已通过' },
  [WorkOrderStatusEnum.REJECTED]: { color: 'error', label: '已驳回' },
  [WorkOrderStatusEnum.IN_PROGRESS]: { color: 'processing', label: '进行中' },
  [WorkOrderStatusEnum.COMPLETED]: { color: 'success', label: '已完成' },
  [WorkOrderStatusEnum.CANCELLED]: { color: 'default', label: '已取消' }
};

/**
 * 审批历史记录项
 */
export interface ApprovalHistoryItem {
  id: string;
  approverId: string;
  approverName: string;
  action: 'APPROVE' | 'REJECT' | 'SUBMIT' | 'CANCEL';
  comment?: string;
  createdAt: string;
}

/**
 * WorkOrderDetailCard 组件属性
 */
export interface WorkOrderDetailCardProps {
  /** 工单ID */
  workOrderId: string;
  /** 工单标题 */
  title: string;
  /** 工单描述 */
  description: string;
  /** 当前状态 */
  status: WorkOrderStatusEnum;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 当前审批人ID */
  currentApproverId?: string;
  /** 当前审批人名称 */
  currentApproverName?: string;
  /** 创建人ID */
  creatorId?: string;
  /** 创建人名称 */
  creatorName?: string;
  /** 审批历史记录列表 */
  approvalHistory?: ApprovalHistoryItem[];
  /** 当前登录用户ID（用于权限校验） */
  currentUserId?: string;
  /** 审批通过回调 */
  onApprove?: (workOrderId: string, comment: string) => Promise<void>;
  /** 审批驳回回调 */
  onReject?: (workOrderId: string, comment: string) => Promise<void>;
  /** 加载状态 */
  loading?: boolean;
}

/**
 * WorkOrderDetailCard - 工单详情卡片组件
 * 
 * @description
 * 展示工单的详细信息，提供审批操作界面。组件根据工单状态决定是否显示审批按钮。
 * 只有 PENDING_APPROVAL 状态的工单，且当前用户为审批人时，才显示审批操作按钮。
 * 
 * @param props - 组件属性
 * @returns React 组件
 * 
 * @example
 * ```tsx
 * <WorkOrderDetailCard
 *   workOrderId="WO-001"
 *   title="服务器扩容申请"
 *   description="需要增加2台服务器..."
 *   status={WorkOrderStatusEnum.PENDING_APPROVAL}
 *   currentApproverId="USER-123"
 *   currentApproverName="张三"
 *   onApprove={async (id, comment) => {
 *     await api.approveWorkOrder(id, comment);
 *   }}
 *   onReject={async (id, comment) => {
 *     await api.rejectWorkOrder(id, comment);
 *   }}
 * />
 * ```
 */
const WorkOrderDetailCard: React.FC<WorkOrderDetailCardProps> = ({
  workOrderId,
  title,
  description,
  status,
  createdAt,
  updatedAt,
  currentApproverId,
  currentApproverName,
  creatorId,
  creatorName,
  approvalHistory = [],
  currentUserId,
  onApprove,
  onReject,
  loading = false
}) => {
  // 审批意见状态
  const [comment, setComment] = useState<string>('');
  // 提交中状态
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  // 计算是否有审批权限：工单状态为待审批且当前用户为审批人
  const canApprove = status === WorkOrderStatusEnum.PENDING_APPROVAL && currentUserId === currentApproverId;
  
  // 计算是否可以编辑审批意见：仅在待审批状态时可编辑
  const canEditComment = status === WorkOrderStatusEnum.PENDING_APPROVAL;

  /**
   * 处理审批通过操作
   * 
   * @description
   * 用户点击"审批通过"按钮后调用此函数。
   * 函数会：
   * 1. 设置提交中状态，防止重复提交
   * 2. 调用 onApprove 回调传入工单ID和审批意见
   * 3. 根据结果展示成功/失败消息
   * 4. 重置提交状态
   * 
   * @returns Promise<void>
   */
  const handleApprove = useCallback(async (): Promise<void> => {
    if (!onApprove) {
      message.warning('审批功能未配置');
      return;
    }

    try {
      setSubmitting(true);
      await onApprove(workOrderId, comment);
      message.success('审批通过成功');
      setComment('');
    } catch (error) {
      message.error('审批通过失败，请重试');
      console.error('Approve error:', error);
    } finally {
      setSubmitting(false);
    }
  }, [workOrderId, comment, onApprove]);

  /**
   * 处理审批驳回操作
   * 
   * @description
   * 用户点击"审批驳回"按钮后调用此函数。
   * 函数会：
   * 1. 校验是否填写了驳回意见（驳回必须填写原因）
   * 2. 设置提交中状态，防止重复提交
   * 3. 调用 onReject 回调传入工单ID和审批意见
   * 4. 根据结果展示成功/失败消息
   * 5. 重置提交状态
   * 
   * @returns Promise<void>
   */
  const handleReject = useCallback(async (): Promise<void> => {
    if (!onReject) {
      message.warning('审批功能未配置');
      return;
    }

    // 驳回操作必须填写意见
    if (!comment.trim()) {
      message.warning('请填写驳回原因');
      return;
    }

    try {
      setSubmitting(true);
      await onReject(workOrderId, comment);
      message.success('审批驳回成功');
      setComment('');
    } catch (error) {
      message.error('审批驳回失败，请重试');
      console.error('Reject error:', error);
    } finally {
      setSubmitting(false);
    }
  }, [workOrderId, comment, onReject]);

  /**
   * 重置审批意见
   * 
   * @description
   * 清除当前输入的审批意见内容
   */
  const handleResetComment = useCallback((): void => {
    setComment('');
  }, []);

  /**
   * 格式化日期显示
   * 
   * @param dateString - ISO 格式的日期字符串
   * @returns 格式化后的日期字符串
   */
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  /**
   * 获取审批动作的图标
   * 
   * @param action - 审批动作类型
   * @returns 对应的图标元素
   */
  const getActionIcon = (action: ApprovalHistoryItem['action']): React.ReactNode => {
    switch (action) {
      case 'APPROVE':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'REJECT':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'SUBMIT':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case 'CANCEL':
        return <CloseCircleOutlined style={{ color: '#8c8c8c' }} />;
      default:
        return <FileTextOutlined />;
    }
  };

  /**
   * 获取审批动作的标签文本
   * 
   * @param action - 审批动作类型
   * @returns 操作描述文本
   */
  const getActionLabel = (action: ApprovalHistoryItem['action']): string => {
    switch (action) {
      case 'APPROVE':
        return '审批通过';
      case 'REJECT':
        return '审批驳回';
      case 'SUBMIT':
        return '提交审批';
      case 'CANCEL':
        return '取消审批';
      default:
        return action;
    }
  };

  /**
   * 工单基本信息项配置
   */
  const descriptionItems: DescriptionsProps['items'] = [
    {
      key: 'status',
      label: '工单状态',
      children: (
        <Tag color={STATUS_CONFIG[status]?.color || 'default'}>
          {STATUS_CONFIG[status]?.label || status}
        </Tag>
      )
    },
    {
      key: 'currentApprover',
      label: '当前审批人',
      children: currentApproverName ? (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <span>{currentApproverName}</span>
        </Space>
      ) : (
        <Text type="secondary">暂无</Text>
      )
    },
    {
      key: 'creator',
      label: '创建人',
      children: creatorName ? (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <span>{creatorName}</span>
        </Space>
      ) : (
        <Text type="secondary">未知</Text>
      )
    },
    {
      key: 'createdAt',
      label: '创建时间',
      children: formatDate(createdAt)
    },
    {
      key: 'updatedAt',
      label: '更新时间',
      children: formatDate(updatedAt)
    }
  ];

  return (
    <Card 
      loading={loading}
      className="work-order-detail-card"
      title={
        <Space>
          <FileTextOutlined />
          <span>工单详情</span>
        </Space>
      }
    >
      {/* 工单标题 */}
      <Title level={4} style={{ marginBottom: 16 }}>
        {title || '未命名工单'}
      </Title>

      {/* 工单基本信息 */}
      <Descriptions 
        column={2}
        size="small"
        items={descriptionItems}
        style={{ marginBottom: 24 }}
      />

      {/* 工单描述 */}
      <div style={{ marginBottom: 24 }}>
        <Text strong>工单描述：</Text>
        <Paragraph 
          style={{ marginTop: 8 }}
          type="secondary"
          ellipsis={{ rows: 4, expandable: true }}
        >
          {description || '暂无描述'}
        </Paragraph>
      </div>

      <Divider />

      {/* 审批操作区域 - 仅在可审批状态下显示 */}
      {canApprove && (
        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>
            审批操作：
          </Text>
          
          {/* 审批意见输入 */}
          <Input.TextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={status === WorkOrderStatusEnum.PENDING_APPROVAL 
              ? '请输入审批意见（驳回时必填）...' 
              : '暂无审批意见'
            }
            disabled={!canEditComment}
            rows={3}
            maxLength={500}
            showCount
            style={{ marginBottom: 16 }}
          />

          {/* 操作按钮组 */}
          <Space size="middle">
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleApprove}
              loading={submitting}
              disabled={submitting}
            >
              审批通过
            </Button>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={handleReject}
              loading={submitting}
              disabled={submitting}
            >
              审批驳回
            </Button>
            {comment && (
              <Button onClick={handleResetComment}>
                清空意见
              </Button>
            )}
          </Space>
        </div>
      )}

      {/* 非待审批状态的信息提示 */}
      {!canApprove && status !== WorkOrderStatusEnum.PENDING_APPROVAL && (
        <div style={{ marginBottom: 24 }}>
          <Text type="secondary">
            <ClockCircleOutlined style={{ marginRight: 8 }} />
            该工单已处理，当前状态：{STATUS_CONFIG[status]?.label || status}
          </Text>
        </div>
      )}

      {/* 审批历史记录 */}
      {approvalHistory.length > 0 && (
        <>
          <Divider />
          <div>
            <Text strong style={{ display: 'block', marginBottom: 16 }}>
              <HistoryOutlined style={{ marginRight: 8 }} />
              审批历史
            </Text>
            <Timeline
              items={approvalHistory.map((item) => ({
                dot: getActionIcon(item.action),
                children: (
                  <div key={item.id}>
                    <Space align="center">
                      <Tooltip title={`审批人ID: ${item.approverId}`}>
                        <Text strong>{item.approverName}</Text>
                      </Tooltip>
                      <Tag color={
                        item.action === 'APPROVE' ? 'success' :
                        item.action === 'REJECT' ? 'error' : 'default'
                      }>
                        {getActionLabel(item.action)}
                      </Tag>
                    </Space>
                    {item.comment && (
                      <Paragraph 
                        type="secondary" 
                        style={{ margin: '4px 0 8px 0', fontSize: 12 }}
                      >
                        意见：{item.comment}
                      </Paragraph>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </div>
                )
              }))}
            />
          </div>
        </>
      )}

      {/* 无审批历史时的提示 */}
      {approvalHistory.length === 0 && (
        <>
          <Divider />
          <Text type="secondary">
            <HistoryOutlined style={{ marginRight: 8 }} />
           暂无审批记录
          </Text>
        </>
      )}
    </Card>
  );
};

export default WorkOrderDetailCard;
export type { WorkOrderDetailCardProps, ApprovalHistoryItem };