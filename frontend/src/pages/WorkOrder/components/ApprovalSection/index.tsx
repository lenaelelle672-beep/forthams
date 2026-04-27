import React, { useState } from 'react';
import { Card, Steps, Button, Input, Timeline, Tag, Space, Typography, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  DepartmentOutlined,
} from '@ant-design/icons';
import type { StepsProps } from 'antd';

const { TextArea } = Input;
const { Title, Text } = Typography;

/**
 * 审批节点数据接口
 * @interface ApprovalNode
 */
interface ApprovalNode {
  /** 节点ID */
  nodeId: string;
  /** 节点名称 */
  nodeName: string;
  /** 审批状态: pending-待审批, approved-已通过, rejected-已驳回 */
  status: 'pending' | 'approved' | 'rejected';
  /** 审批人ID */
  approverId: string;
  /** 审批人姓名 */
  approverName: string;
  /** 审批时间 */
  approveTime: string | null;
  /** 审批意见 */
  comment?: string;
}

/**
 * 审批人信息接口
 * @interface ApproverInfo
 */
interface ApproverInfo {
  /** 审批人ID */
  id: string;
  /** 审批人姓名 */
  name: string;
  /** 所属部门 */
  department: string;
  /** 审批时间 */
  approveTime: string | null;
  /** 审批状态 */
  status: 'pending' | 'approved' | 'rejected';
}

/**
 * 审批操作类型
 * @type {('APPROVE' | 'REJECT')}
 */
type ApprovalActionType = 'APPROVE' | 'REJECT';

/**
 * 组件属性接口
 * @interface ApprovalSectionProps
 */
interface ApprovalSectionProps {
  /** 工单ID */
  workOrderId: string;
  /** 工单状态 */
  workOrderStatus: string;
  /** 审批节点列表 */
  approvalNodes?: ApprovalNode[];
  /** 审批人列表 */
  approvers?: ApproverInfo[];
  /** 审批操作回调 */
  onApprovalAction?: (action: ApprovalActionType, comment: string) => Promise<void>;
  /** 是否加载中 */
  loading?: boolean;
}

/**
 * 获取状态对应的步骤进度状态
 * 
 * @function getStepStatus
 * @param {string} status - 审批状态
 * @returns {'wait' | 'process' | 'finish' | 'error'}
 */
const getStepStatus = (status: string): 'wait' | 'process' | 'finish' | 'error' => {
  switch (status) {
    case 'approved':
      return 'finish';
    case 'rejected':
      return 'error';
    case 'pending':
      return 'process';
    default:
      return 'wait';
  }
};

/**
 * 获取状态显示文案
 * 
 * @function getStatusText
 * @param {string} status - 审批状态
 * @returns {string}
 */
const getStatusText = (status: string): string => {
  switch (status) {
    case 'approved':
      return '已通过';
    case 'rejected':
      return '已驳回';
    case 'pending':
      return '待审批';
    default:
      return '未知';
  }
};

/**
 * 获取状态对应的图标
 * 
 * @function getStatusIcon
 * @param {string} status - 审批状态
 * @returns {React.ReactNode}
 */
const getStatusIcon = (status: string): React.ReactNode => {
  switch (status) {
    case 'approved':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    case 'rejected':
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    case 'pending':
      return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    default:
      return <ClockCircleOutlined />;
  }
};

/**
 * 审批section组件
 * 
 * 工单审批页面核心区域组件，包含审批流程展示、审批人信息、操作按钮和意见输入。
 * Iteration 1阶段：UI占位展示，按钮操作逻辑暂未实现。
 * 
 * @component
 * @param {ApprovalSectionProps} props - 组件属性
 * @returns {React.ReactElement}
 */
const ApprovalSection: React.FC<ApprovalSectionProps> = ({
  workOrderId,
  workOrderStatus,
  approvalNodes = [],
  approvers = [],
  onApprovalAction,
  loading = false,
}) => {
  // 审批意见状态
  const [comment, setComment] = useState<string>('');
  // 操作类型状态
  const [actionType, setActionType] = useState<ApprovalActionType | null>(null);
  // 提交中状态
  const [submitting, setSubmitting] = useState<boolean>(false);

  /**
   * 判断当前用户是否可以进行审批操作
   *
   * @function canApproveReject
   * @returns {boolean}
   */
  const canApproveReject = (): boolean => {
    return workOrderStatus === 'PENDING_APPROVAL';
  };

  /**
   * 格式化日期字符串为中文显示格式
   *
   * @function formatDate
   * @param {string} dateString - ISO格式日期字符串
   * @returns {string} 格式化后的日期字符串
   */
  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * 处理审批操作（通过/驳回）
   * Iteration 1阶段仅设置操作类型，不实际提交
   *
   * @function handleApprove
   * @param {ApprovalActionType} action - 操作类型
   * @returns {void}
   */
  const handleApprove = (action: ApprovalActionType): void => {
    setActionType(action);
    // Iteration 1: 仅记录操作类型，不触发实际提交
    // Phase 2将实现实际API调用
  };

  /**
   * 提交审批操作
   * Iteration 1阶段为占位实现
   *
   * @async
   * @function submitApproval
   * @returns {Promise<void>}
   */
  const submitApproval = async (): Promise<void> => {
    if (!actionType) return;

    try {
      setSubmitting(true);
      
      if (onApprovalAction) {
        await onApprovalAction(actionType, comment);
      }
      
      // 清空状态
      setActionType(null);
      setComment('');
    } catch (error) {
      console.error('审批操作失败:', error);
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 渲染审批流程步骤条
   * 
   * @function renderApprovalWorkflow
   * @returns {React.ReactNode}
   */
  const renderApprovalWorkflow = (): React.ReactNode => {
    if (approvalNodes.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          暂无审批流程信息
        </div>
      );
    }

    const stepsItems: StepsProps['items'] = approvalNodes.map((node) => ({
      title: node.nodeName,
      description: node.approverName || '待分配',
      status: getStepStatus(node.status),
      icon: getStatusIcon(node.status),
    }));

    return (
      <div data-testid="approval-workflow" style={{ padding: '16px 0' }}>
        <Steps current={approvalNodes.findIndex(n => n.status === 'pending')} items={stepsItems} />
      </div>
    );
  };

  /**
   * 渲染审批人信息卡片
   * 
   * @function renderApproverInfo
   * @returns {React.ReactNode}
   */
  const renderApproverInfo = (): React.ReactNode => {
    if (approvers.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          暂无审批人信息
        </div>
      );
    }

    return (
      <div data-testid="approver-info" style={{ padding: '16px 0' }}>
        <Title level={5} style={{ marginBottom: 16 }}>审批人信息</Title>
        <Timeline
          items={approvers.map((approver) => ({
            color: approver.status === 'approved' ? 'green' : approver.status === 'rejected' ? 'red' : 'blue',
            children: (
              <Card size="small" style={{ marginBottom: 8 }}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space>
                    <UserOutlined />
                    <Text strong>{approver.name}</Text>
                    <Tag color={
                      approver.status === 'approved' ? 'success' : 
                      approver.status === 'rejected' ? 'error' : 'warning'
                    }>
                      {getStatusText(approver.status)}
                    </Tag>
                  </Space>
                  <Space>
                    <DepartmentOutlined />
                    <Text type="secondary">{approver.department}</Text>
                  </Space>
                  {approver.approveTime && (
                    <Space>
                      <CalendarOutlined />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDate(approver.approveTime)}
                      </Text>
                    </Space>
                  )}
                </Space>
              </Card>
            ),
          }))}
        />
      </div>
    );
  };

  /**
   * 渲染审批操作按钮组
   * Iteration 1阶段：按钮置灰，显示提示"操作逻辑 Phase 2 实现"
   * 
   * @function renderApprovalActions
   * @returns {React.ReactNode}
   */
  const renderApprovalActions = (): React.ReactNode => {
    const isOperationEnabled = canApproveReject();
    
    // Iteration 1: 按钮统一禁用，提示操作逻辑Phase 2实现
    const isDisabled = true;
    const tooltipTitle = '操作逻辑 Phase 2 实现';

    return (
      <div data-testid="approval-actions" style={{ padding: '16px 0' }}>
        <Title level={5} style={{ marginBottom: 16 }}>审批操作</Title>
        <Space>
          <Tooltip title={tooltipTitle}>
            <Button
              type="primary"
              disabled={isDisabled}
              loading={submitting && actionType === 'APPROVE'}
              onClick={() => handleApprove('APPROVE')}
              icon={<CheckCircleOutlined />}
            >
              通过
            </Button>
          </Tooltip>
          <Tooltip title={tooltipTitle}>
            <Button
              danger
              disabled={isDisabled}
              loading={submitting && actionType === 'REJECT'}
              onClick={() => handleApprove('REJECT')}
              icon={<CloseCircleOutlined />}
            >
              驳回
            </Button>
          </Tooltip>
        </Space>
        {!isOperationEnabled && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              当前工单状态不允许审批操作
            </Text>
          </div>
        )}
      </div>
    );
  };

  /**
   * 渲染审批意见输入区
   * 
   * @function renderApprovalComment
   * @returns {React.ReactNode}
   */
  const renderApprovalComment = (): React.ReactNode => {
    return (
      <div data-testid="approval-comment-input" style={{ padding: '16px 0' }}>
        <Title level={5} style={{ marginBottom: 16 }}>审批意见</Title>
        <TextArea
          placeholder="请输入审批意见（选填）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={500}
          showCount
          disabled={submitting}
        />
      </div>
    );
  };

  return (
    <Card title="审批流程" loading={loading}>
      {renderApprovalWorkflow()}
      {renderApproverInfo()}
      {renderApprovalActions()}
      {renderApprovalComment()}
    </Card>
  );
};

export default ApprovalSection;

// 导出组件类型供外部使用
export type { ApprovalSectionProps, ApprovalNode, ApproverInfo, ApprovalActionType };