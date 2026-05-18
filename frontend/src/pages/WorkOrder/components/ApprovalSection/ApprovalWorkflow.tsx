/**
 * ApprovalWorkflow Component
 * 
 * 工单审批工作流展示组件 (SWARM-222 Iteration 1)
 * 
 * 功能范围:
 * - ApprovalWorkflow: 审批流程状态可视化组件，展示审批节点流转状态
 * - ApproverInfo: 审批人信息展示组件，显示当前审批人/已审批人详情
 * - Approve/Reject Buttons: 审批操作按钮组，支持通过/驳回两种决策
 * - ApprovalComment: 审批意见输入区，支持审批人填写审批备注
 * 
 * @module ApprovalWorkflow
 * @description 工单审批工作流组件 - Iteration 1 UI 占位实现
 */

import React, { useState } from 'react';
import { Card, Timeline, Tag, Button, Input, Tooltip, Space, Typography, Avatar, Descriptions } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  DislikeOutlined,
  LikeOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { ThemeConfig } from 'antd/dist/theme/interface';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * 审批节点状态枚举
 */
export type ApprovalNodeStatus = 'pending' | 'approved' | 'rejected';

/**
 * 审批节点信息
 */
export interface ApprovalNode {
  nodeId: string;
  nodeName: string;
  status: ApprovalNodeStatus;
  approverId: string;
  approverName: string;
  approveTime: string | null;
  comment?: string;
}

/**
 * 审批人信息
 */
export interface ApproverInfo {
  id: string;
  name: string;
  department: string;
  approveTime: string | null;
  status: ApprovalNodeStatus;
  comment?: string;
}

/**
 * 审批操作类型
 */
export type ApprovalAction = 'APPROVE' | 'REJECT';

/**
 * ApprovalWorkflow 组件 Props
 */
export interface ApprovalWorkflowProps {
  /** 审批节点列表 */
  nodes?: ApprovalNode[];
  /** 审批人信息列表 */
  approvers?: ApproverInfo[];
  /** 工单ID */
  workOrderId?: string;
  /** 是否可操作 (Iteration 1 固定为 false) */
  disabled?: boolean;
  /** 审批意见 */
  comment?: string;
  /** 意见变更回调 */
  onCommentChange?: (comment: string) => void;
  /** 审批操作回调 (Iteration 1 暂不实现) */
  onApprove?: (action: ApprovalAction, comment: string) => void;
  /** 加载状态 */
  loading?: boolean;
}

// ============================================================================
// Mock Data (Iteration 1 使用 Mock 数据)
// ============================================================================

const MOCK_APPROVAL_NODES: ApprovalNode[] = [
  {
    nodeId: '1',
    nodeName: '部门主管审批',
    status: 'approved',
    approverId: 'u001',
    approverName: '张三',
    approveTime: '2024-01-15 10:30',
    comment: '申请材料齐全，同意审批',
  },
  {
    nodeId: '2',
    nodeName: '财务复核',
    status: 'approved',
    approverId: 'u002',
    approverName: '李四',
    approveTime: '2024-01-16 14:20',
    comment: '预算核对无误',
  },
  {
    nodeId: '3',
    nodeName: '最终审批',
    status: 'pending',
    approverId: 'u003',
    approverName: '王五',
    approveTime: null,
  },
];

const MOCK_APPROVERS: ApproverInfo[] = [
  {
    id: 'u001',
    name: '张三',
    department: '研发部',
    approveTime: '2024-01-15 10:30',
    status: 'approved',
    comment: '申请材料齐全，同意审批',
  },
  {
    id: 'u002',
    name: '李四',
    department: '财务部',
    approveTime: '2024-01-16 14:20',
    status: 'approved',
    comment: '预算核对无误',
  },
  {
    id: 'u003',
    name: '王五',
    department: '管理层',
    approveTime: null,
    status: 'pending',
  },
];

// ============================================================================
// Sub-Components
// ============================================================================

const { Text, Paragraph } = Typography;

/**
 * ApproverInfo Component
 * 
 * 审批人信息展示组件
 * 显示审批人姓名、部门、审批时间等信息
 * 
 * @param {ApproverInfo} approver - 审批人信息
 * @param {number} index - 序号
 */
interface ApproverInfoCardProps {
  approver: ApproverInfo;
  index: number;
}

const ApproverInfoCard: React.FC<ApproverInfoCardProps> = ({ approver, index }) => {
  const getStatusColor = (status: ApprovalNodeStatus): string => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending':
      default:
        return 'default';
    }
  };

  const getStatusText = (status: ApprovalNodeStatus): string => {
    switch (status) {
      case 'approved':
        return '已审批';
      case 'rejected':
        return '已驳回';
      case 'pending':
      default:
        return '待审批';
    }
  };

  return (
    <Card
      size="small"
      style={{ marginBottom: 12 }}
      data-testid="approver-info"
    >
      <Descriptions column={2} size="small" colon={false}>
        <Descriptions.Item label="序号">{index + 1}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={getStatusColor(approver.status)}>
            {getStatusText(approver.status)}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="姓名">
          <Space>
            <Avatar size="small" icon={<UserOutlined />} />
            <Text strong>{approver.name}</Text>
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="部门">{approver.department}</Descriptions.Item>
        {approver.approveTime && (
          <Descriptions.Item label="审批时间">
            {approver.approveTime}
          </Descriptions.Item>
        )}
        {approver.comment && (
          <Descriptions.Item label="审批意见" span={2}>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {approver.comment}
            </Paragraph>
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );
};

/**
 * ApprovalActions Component
 * 
 * 审批操作按钮组
 * Iteration 1: 按钮置灰，操作逻辑 Phase 2 实现
 * 
 * @param {Object} props - 组件属性
 */
interface ApprovalActionsProps {
  disabled: boolean;
  onApprove: (action: ApprovalAction) => void;
}

const ApprovalActions: React.FC<ApprovalActionsProps> = ({ disabled, onApprove }) => {
  return (
    <Space size="large" data-testid="approval-actions">
      <Tooltip title={disabled ? '操作逻辑 Phase 2 实现' : ''}>
        <Button
          type="primary"
          icon={<LikeOutlined />}
          disabled={disabled}
          onClick={() => onApprove('APPROVE')}
        >
          通过
        </Button>
      </Tooltip>
      <Tooltip title={disabled ? '操作逻辑 Phase 2 实现' : ''}>
        <Button
          danger
          icon={<DislikeOutlined />}
          disabled={disabled}
          onClick={() => onApprove('REJECT')}
        >
          驳回
        </Button>
      </Tooltip>
    </Space>
  );
};

/**
 * ApprovalComment Component
 * 
 * 审批意见输入组件
 * 支持文本输入，用于填写审批备注
 * 
 * @param {Object} props - 组件属性
 */
interface ApprovalCommentProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const ApprovalComment: React.FC<ApprovalCommentProps> = ({ value, onChange, disabled }) => {
  return (
    <Input.TextArea
      data-testid="approval-comment-input"
      placeholder="请输入审批意见（选填）"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={3}
      maxLength={500}
      showCount
    />
  );
};

/**
 * WorkflowNodeItem Component
 * 
 * 工作流节点渲染组件
 * 根据节点状态显示不同图标和颜色
 * 
 * @param {Object} props - 组件属性
 */
interface WorkflowNodeItemProps {
  node: ApprovalNode;
  isLast: boolean;
}

const WorkflowNodeItem: React.FC<WorkflowNodeItemProps> = ({ node, isLast }) => {
  const getTimelineIcon = (status: ApprovalNodeStatus): React.ReactNode => {
    switch (status) {
      case 'approved':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'rejected':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'pending':
      default:
        return <ClockCircleOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  const getStatusTag = (status: ApprovalNodeStatus): React.ReactNode => {
    const config = {
      approved: { color: 'success', text: '已通过' },
      rejected: { color: 'error', text: '已驳回' },
      pending: { color: 'default', text: '待审批' },
    };
    const { color, text } = config[status];
    return <Tag color={color}>{text}</Tag>;
  };

  return (
    <Timeline.Item
      dot={getTimelineIcon(node.status)}
      className={`workflow-node node-status-${node.status}`}
    >
      <Card size="small" style={{ marginBottom: isLast ? 0 : 16 }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space align="center">
            <Text strong>{node.nodeName}</Text>
            {getStatusTag(node.status)}
          </Space>
          <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
            <Text type="secondary">
              <UserOutlined /> {node.approverName}
            </Text>
            {node.approveTime && (
              <Text type="secondary">{node.approveTime}</Text>
            )}
          </Space>
          {node.comment && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <EditOutlined /> {node.comment}
            </Text>
          )}
        </Space>
      </Card>
      {!isLast && <div className="workflow-connector" />}
    </Timeline.Item>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * ApprovalWorkflow Component
 * 
 * 工单审批工作流主组件
 * 整合审批流程可视化、审批人信息、操作按钮和意见输入
 * 
 * Iteration 1 目标:
 * - ✅ 审批组件基础结构搭建
 * - ✅ ApproverInfo 信息展示 (Mock 数据)
 * - ✅ 审批按钮 UI 占位 (disabled 状态)
 * - ✅ 审批意见输入框
 * 
 * @param {ApprovalWorkflowProps} props - 组件属性
 */
const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({
  nodes = MOCK_APPROVAL_NODES,
  approvers = MOCK_APPROVERS,
  workOrderId,
  disabled = true, // Iteration 1: 固定为 true
  comment = '',
  onCommentChange,
  onApprove,
  loading = false,
}) => {
  // Local state for comment input
  const [localComment, setLocalComment] = useState(comment);

  /**
   * 处理审批意见变更
   * 
   * @param {string} value - 新的审批意见文本
   */
  const handleCommentChange = (value: string): void => {
    setLocalComment(value);
    onCommentChange?.(value);
  };

  /**
   * 处理审批操作
   * 
   * @param {ApprovalAction} action - 审批操作类型
   */
  const handleApprove = (action: ApprovalAction): void => {
    onApprove?.(action, localComment);
  };

  return (
    <Card
      title="审批流程"
      loading={loading}
      data-testid="approval-workflow"
      style={{ marginBottom: 16 }}
    >
      {/* 审批流程节点 Timeline */}
      <Typography.Title level={5} style={{ marginBottom: 16 }}>
        审批进度
      </Typography.Title>
      <Timeline data-testid="approval-timeline">
        {nodes.map((node, index) => (
          <WorkflowNodeItem
            key={node.nodeId}
            node={node}
            isLast={index === nodes.length - 1}
          />
        ))}
      </Timeline>

      {/* 审批人信息列表 */}
      <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>
        审批人详情
      </Typography.Title>
      {approvers.map((approver, index) => (
        <ApproverInfoCard
          key={approver.id}
          approver={approver}
          index={index}
        />
      ))}

      {/* 审批意见输入 */}
      <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>
        审批意见
      </Typography.Title>
      <ApprovalComment
        value={localComment}
        onChange={handleCommentChange}
        disabled={disabled}
      />

      {/* 审批操作按钮 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <ApprovalActions
          disabled={disabled}
          onApprove={handleApprove}
        />
      </div>
    </Card>
  );
};

export default ApprovalWorkflow;

// ============================================================================
// Export Types for External Usage
// ============================================================================
export type {
  ApprovalWorkflowProps,
  ApprovalNode,
  ApproverInfo,
  ApprovalAction,
  ApprovalNodeStatus,
  ApproverInfoCardProps,
  ApprovalActionsProps,
  ApprovalCommentProps,
  WorkflowNodeItemProps,
};
