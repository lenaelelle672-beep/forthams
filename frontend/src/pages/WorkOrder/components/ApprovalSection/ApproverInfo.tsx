/**
 * ApproverInfo Component
 * 
 * Displays detailed information about approvers in the work order approval workflow.
 * Shows approver name, department, and approval timestamp.
 * 
 * @module WorkOrder/components/ApprovalSection
 * @requires React
 * @requires antd
 */

import React from 'react';
import { Card, Descriptions, Tag, Timeline, Empty } from 'antd';
import { UserOutlined, ClockCircleOutlined, CheckCircleOutlined, TeamOutlined } from '@ant-design/icons';

/**
 * Represents an individual approver's information
 * 
 * @interface ApproverInfoProps
 */
interface ApproverInfoProps {
  /** Unique identifier for the approver */
  id: string;
  /** Full name of the approver */
  name: string;
  /** Department name where the approver belongs */
  department: string;
  /** ISO timestamp of when approval was completed, null if pending */
  approveTime: string | null;
  /** Whether this approver has completed their review */
  isApproved?: boolean;
}

/**
 * Props for the ApproverInfo component
 * 
 * @interface ApproverInfoComponentProps
 */
interface ApproverInfoComponentProps {
  /** List of approvers to display */
  approvers: ApproverInfoProps[];
  /** Current approval status of the work order */
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  /** Title for the section */
  title?: string;
}

/**
 * Format a date string to localized Chinese format
 * 
 * @function formatApproveTime
 * @param {string | null} dateString - ISO date string or null
 * @returns {string} Formatted date string or placeholder text
 */
const formatApproveTime = (dateString: string | null): string => {
  if (!dateString) {
    return '待审批';
  }
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
 * Get status tag color based on approval status
 * 
 * @function getStatusColor
 * @param {string | null} approveTime - Approval timestamp
 * @param {string} [approvalStatus] - Overall approval status
 * @returns {string} Color code for the status tag
 */
const getStatusColor = (
  approveTime: string | null,
  approvalStatus?: string
): string => {
  if (approveTime) {
    return 'success';
  }
  if (approvalStatus === 'rejected') {
    return 'error';
  }
  return 'warning';
};

/**
 * Get status text based on approval status
 * 
 * @function getStatusText
 * @param {string | null} approveTime - Approval timestamp
 * @returns {string} Status text
 */
const getStatusText = (approveTime: string | null): string => {
  return approveTime ? '已审批' : '待审批';
};

/**
 * ApproverInfo Component
 * 
 * Displays a list of approvers with their details in a card layout.
 * Uses Timeline to show the chronological approval flow.
 * 
 * @param {ApproverInfoComponentProps} props - Component props
 * @returns {React.ReactElement} Rendered component
 * 
 * @example
 * ```tsx
 * <ApproverInfo
 *   approvers={[
 *     { id: 'u001', name: '张三', department: '研发部', approveTime: '2024-01-15T10:30:00Z' },
 *     { id: 'u002', name: '李四', department: '财务部', approveTime: null }
 *   ]}
 *   approvalStatus="pending"
 *   title="审批信息"
 * />
 * ```
 */
const ApproverInfo: React.FC<ApproverInfoComponentProps> = ({
  approvers,
  approvalStatus = 'pending',
  title = '审批信息',
}) => {
  /**
   * Render individual approver item in timeline
   * 
   * @function renderApproverItem
   * @param {ApproverInfoProps} approver - Approver data
   * @param {number} index - Array index
   * @returns {React.ReactElement} Timeline item element
   */
  const renderApproverItem = (
    approver: ApproverInfoProps,
    index: number
  ): React.ReactElement => {
    const isCompleted = !!approver.approveTime;
    
    return (
      <Timeline.Item
        key={approver.id || index}
        color={isCompleted ? 'green' : 'gray'}
        dot={isCompleted ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
      >
        <div 
          className="approver-item"
          data-testid={`approver-item-${approver.id}`}
        >
          <Descriptions size="small" column={1}>
            <Descriptions.Item>
              <span className="approver-name">
                <UserOutlined style={{ marginRight: 8 }} />
                {approver.name}
              </span>
              <Tag 
                color={getStatusColor(approver.approveTime, approvalStatus)}
                style={{ marginLeft: 8 }}
              >
                {getStatusText(approver.approveTime)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item>
              <span className="approver-department">
                <TeamOutlined style={{ marginRight: 8 }} />
                {approver.department}
              </span>
            </Descriptions.Item>
            {approver.approveTime && (
              <Descriptions.Item>
                <span className="approver-time">
                  <ClockCircleOutlined style={{ marginRight: 8 }} />
                  {formatApproveTime(approver.approveTime)}
                </span>
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>
      </Timeline.Item>
    );
  };

  /**
   * Render empty state when no approvers provided
   * 
   * @function renderEmptyState
   * @returns {React.ReactElement} Empty state component
   */
  const renderEmptyState = (): React.ReactElement => {
    return (
      <Empty
        description="暂无审批信息"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  };

  return (
    <Card 
      title={title} 
      className="approver-info-card"
      data-testid="approver-info"
    >
      {approvers && approvers.length > 0 ? (
        <Timeline mode="left" className="approver-timeline">
          {approvers.map((approver, index) => renderApproverItem(approver, index))}
        </Timeline>
      ) : (
        renderEmptyState()
      )}
    </Card>
  );
};

export default ApproverInfo;
export type { ApproverInfoProps, ApproverInfoComponentProps };