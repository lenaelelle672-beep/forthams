/**
 * ApproverInfo Component
 * 
 * Displays detailed information about approvers in a work order approval workflow.
 * Shows approver name, department, and approval timestamp.
 * 
 * @module components/approval/ApproverInfo
 * @version 1.0.0
 */

import React from 'react';
import { Card, Descriptions, Tag, Timeline, Typography } from 'antd';
import { UserOutlined, BankOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { ApproverInfo as ApproverInfoType } from '../../types/approval';

const { Text, Title } = Typography;

export interface ApproverInfoProps {
  /** List of approvers to display */
  approvers: ApproverInfoType[];
  /** Current approval stage index (0-based) */
  currentStage?: number;
  /** Optional title for the section */
  title?: string;
}

/**
 * Format date string to localized Chinese format
 * 
 * @param {string | null} dateString - ISO date string or null
 * @returns {string | null} Formatted date string or null
 * 
 * @example
 * // Returns "2024-01-15 10:30"
 * formatDate("2024-01-15T10:30:00");
 */
const formatDate = (dateString: string | null): string | null => {
  if (!dateString) {
    return null;
  }
  
  try {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    console.error('Failed to format date:', error);
    return null;
  }
};

/**
 * Get status tag color based on approval time
 * 
 * @param {string | null} approveTime - Approval timestamp
 * @returns {string} Tag color string
 */
const getStatusColor = (approveTime: string | null): string => {
  return approveTime ? 'success' : 'warning';
};

/**
 * Get status text based on approval time
 * 
 * @param {string | null} approveTime - Approval timestamp
 * @returns {string} Status text
 */
const getStatusText = (approveTime: string | null): string => {
  return approveTime ? '已审批' : '待审批';
};

/**
 * ApproverInfo Component
 * 
 * Renders a card displaying information about work order approvers.
 * Each approver shows their name, department, and approval status with timestamp.
 * 
 * @param {ApproverInfoProps} props - Component props
 * @returns {JSX.Element} Rendered component
 * 
 * @example
 * ```tsx
 * <ApproverInfo 
 *   approvers={[
 *     { id: 'u001', name: '张三', department: '研发部', approveTime: '2024-01-15 10:30' },
 *     { id: 'u002', name: '李四', department: '财务部', approveTime: null }
 *   ]}
 *   title="审批人信息"
 * />
 * ```
 */
export const ApproverInfo: React.FC<ApproverInfoProps> = ({
  approvers,
  currentStage = 0,
  title = '审批人信息',
}) => {
  /**
   * Render individual approver item
   * 
   * @param {ApproverInfoType} approver - Approver data
   * @param {number} index - Approver index in list
   * @returns {JSX.Element} Rendered approver item
   */
  const renderApproverItem = (approver: ApproverInfoType, index: number): JSX.Element => {
    const isCurrent = index === currentStage;
    const formattedTime = formatDate(approver.approveTime);
    const statusColor = getStatusColor(approver.approveTime);
    const statusText = getStatusText(approver.approveTime);

    return (
      <Timeline.Item
        key={approver.id}
        color={approver.approveTime ? 'green' : 'gray'}
        dot={approver.approveTime ? undefined : <ClockCircleOutlined />}
      >
        <Card 
          size="small" 
          className={`approver-card ${isCurrent ? 'approver-card--current' : ''}`}
          style={{ 
            borderColor: isCurrent ? '#1890ff' : undefined,
            backgroundColor: isCurrent ? '#f0f7ff' : undefined,
          }}
        >
          <Descriptions size="small" column={1} colon={false}>
            <Descriptions.Item 
              label={
                <span>
                  <UserOutlined style={{ marginRight: 8 }} />
                  姓名
                </span>
              }
            >
              <Text strong>{approver.name}</Text>
              {isCurrent && (
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  当前审批人
                </Tag>
              )}
            </Descriptions.Item>

            <Descriptions.Item 
              label={
                <span>
                  <BankOutlined style={{ marginRight: 8 }} />
                  部门
                </span>
              }
            >
              {approver.department}
            </Descriptions.Item>

            <Descriptions.Item 
              label={
                <span>
                  <ClockCircleOutlined style={{ marginRight: 8 }} />
                  状态
                </span>
              }
            >
              <Tag color={statusColor}>{statusText}</Tag>
              {formattedTime && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {formattedTime}
                </Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Timeline.Item>
    );
  };

  return (
    <Card 
      title={
        <Title level={5} style={{ marginBottom: 0 }}>
          {title}
        </Title>
      }
      data-testid="approver-info"
      className="approver-info-card"
    >
      {approvers.length === 0 ? (
        <Text type="secondary">暂无审批人信息</Text>
      ) : (
        <Timeline mode="left">
          {approvers.map((approver, index) => renderApproverItem(approver, index))}
        </Timeline>
      )}
    </Card>
  );
};

/**
 * ApproverInfoItem Component
 * 
 * Renders a single approver information row.
 * Useful for embedding in other components.
 * 
 * @param {ApproverInfoType} approver - Approver data
 * @param {boolean} isCurrent - Whether this is the current approver
 * @returns {JSX.Element} Rendered approver row
 */
export const ApproverInfoItem: React.FC<{
  approver: ApproverInfoType;
  isCurrent?: boolean;
}> = ({ approver, isCurrent = false }) => {
  const formattedTime = formatDate(approver.approveTime);

  return (
    <div 
      className={`approver-info-item ${isCurrent ? 'approver-info-item--current' : ''}`}
      data-testid="approver-info-item"
    >
      <UserOutlined className="approver-icon" />
      <div className="approver-details">
        <Text strong>{approver.name}</Text>
        <Text type="secondary" style={{ marginLeft: 8 }}>
          {approver.department}
        </Text>
        {isCurrent && (
          <Tag color="blue" style={{ marginLeft: 8 }}>
            待审批
          </Tag>
        )}
        {!isCurrent && formattedTime && (
          <Text type="secondary" style={{ marginLeft: 8 }}>
            {formattedTime}
          </Text>
        )}
      </div>
    </div>
  );
};

export default ApproverInfo;