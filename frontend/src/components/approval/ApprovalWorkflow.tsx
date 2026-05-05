/**
 * ApprovalWorkflow Component
 * 
 * 审批流程状态可视化组件，展示审批节点流转状态。
 * 用于工单详情页（OrderDetail）中展示审批流程图。
 * 
 * @module components/approval
 * @version 1.0.0 (Iteration 1)
 */

import React from 'react';
import { Timeline, Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { ApprovalNode } from '../../types/approval';

/**
 * Props for ApprovalWorkflow component
 */
interface ApprovalWorkflowProps {
  /** 审批节点列表 */
  nodes: ApprovalNode[];
  /** 是否显示时间戳 */
  showTimestamp?: boolean;
  /** 自定义类名 */
  className?: string;
  /** data-testid for testing */
  'data-testid'?: string;
}

/**
 * 获取节点状态对应的图标
 * 
 * @param status - 审批节点状态
 * @returns 对应的 React 图标组件
 */
const getStatusIcon = (status: ApprovalNode['status']): React.ReactNode => {
  switch (status) {
    case 'approved':
      return <CheckCircleOutlined className="node-icon-approved" />;
    case 'rejected':
      return <CloseCircleOutlined className="node-icon-rejected" />;
    case 'pending':
    default:
      return <ClockCircleOutlined className="node-icon-pending" />;
  }
};

/**
 * 获取节点状态对应的 Ant Design Tag 颜色
 * 
 * @param status - 审批节点状态
 * @returns Ant Design Tag 的 color 属性
 */
const getStatusColor = (status: ApprovalNode['status']): string => {
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

/**
 * 获取节点状态的中文标签文本
 * 
 * @param status - 审批节点状态
 * @returns 中文状态文本
 */
const getStatusText = (status: ApprovalNode['status']): string => {
  switch (status) {
    case 'approved':
      return '已通过';
    case 'rejected':
      return '已驳回';
    case 'pending':
    default:
      return '待审批';
  }
};

/**
 * 格式化时间戳为中文格式
 * 
 * @param timestamp - ISO 格式的时间戳字符串
 * @returns 格式化后的中文日期时间字符串 (YYYY-MM-DD HH:mm)
 */
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

/**
 * 渲染单个审批节点的内容
 * 
 * @param node - 审批节点数据
 * @param showTimestamp - 是否显示时间戳
 * @returns React 节点数组
 */
const renderNodeContent = (node: ApprovalNode, showTimestamp: boolean): React.ReactNode[] => {
  const content: React.ReactNode[] = [
    <div key="title" className="approval-node-title">
      <UserOutlined /> {node.nodeName}
    </div>,
    <div key="approver" className="approval-node-approver">
      审批人：{node.approverName}
    </div>,
  ];

  if (showTimestamp && node.approveTime) {
    content.push(
      <div key="time" className="approval-node-time">
        审批时间：{formatTimestamp(node.approveTime)}
      </div>
    );
  }

  return content;
};

/**
 * ApprovalWorkflow Component
 * 
 * 工单审批流程可视化组件，用于展示审批节点链式流转状态。
 * 支持 pending（待审批）、approved（已通过）、rejected（已驳回）三种状态。
 * 
 * @example
 * ```tsx
 * const mockNodes: ApprovalNode[] = [
 *   { nodeId: '1', nodeName: '部门主管审批', status: 'approved', approverId: 'u001', approverName: '张三', approveTime: '2024-01-15T10:30:00Z' },
 *   { nodeId: '2', nodeName: '财务复核', status: 'pending', approverId: 'u002', approverName: '李四', approveTime: null },
 * ];
 * 
 * <ApprovalWorkflow nodes={mockNodes} data-testid="approval-workflow" />
 * ```
 */
export const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({
  nodes,
  showTimestamp = true,
  className = '',
  'data-testid': dataTestId = 'approval-workflow',
}) => {
  /**
   * 构建 Timeline 组件的 items 配置
   * 
   * @returns Ant Design Timeline items 数组
   */
  const getTimelineItems = () => {
    return nodes.map((node, index) => ({
      key: node.nodeId,
      dot: getStatusIcon(node.status),
      children: (
        <div 
          className={`workflow-node node-status-${node.status}`}
          data-node-id={node.nodeId}
          data-node-status={node.status}
        >
          <div className="node-content">
            {renderNodeContent(node, showTimestamp)}
          </div>
          <div className="node-status">
            <Tag color={getStatusColor(node.status)} icon={getStatusIcon(node.status)}>
              {getStatusText(node.status)}
            </Tag>
          </div>
          
          {/* 节点间连接线 */}
          {index < nodes.length - 1 && (
            <div className="workflow-connector" />
          )}
        </div>
      ),
      color: node.status === 'approved' ? 'green' : node.status === 'rejected' ? 'red' : 'gray',
    }));
  };

  /**
   * 验证节点数据
   * 
   * @returns 是否有效
   */
  const isValidData = (): boolean => {
    return Array.isArray(nodes) && nodes.length > 0;
  };

  if (!isValidData()) {
    return (
      <div 
        className={`approval-workflow-empty ${className}`}
        data-testid={dataTestId}
      >
        <ClockCircleOutlined />
        <span>暂无审批流程信息</span>
      </div>
    );
  }

  return (
    <div 
      className={`approval-workflow ${className}`}
      data-testid={dataTestId}
    >
      <div className="workflow-header">
        <h4 className="workflow-title">审批流程</h4>
        <Tooltip title="审批流程状态图">
          <span className="workflow-hint">查看审批进度</span>
        </Tooltip>
      </div>
      
      <Timeline 
        className="approval-timeline"
        items={getTimelineItems()}
        mode="left"
      />
    </div>
  );
};

/**
 * Default export for ApprovalWorkflow component
 */
export default ApprovalWorkflow;