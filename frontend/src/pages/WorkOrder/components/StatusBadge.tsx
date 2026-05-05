/**
 * StatusBadge Component
 * 
 * Displays workorder status with appropriate styling based on status type.
 * Used in workorder list, detail, and approval pages.
 * 
 * @component
 * @example
 * // Display pending approval status
 * <StatusBadge status="PENDING" />
 * 
 * // Display with custom size
 * <StatusBadge status="APPROVED" size="large" />
 */

import React from 'react';
import { Tag } from 'antd';
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  SwapOutlined,
  EditOutlined
} from '@ant-design/icons';

// Workorder status types
export type WorkorderStatus = 
  | 'DRAFT'        // Draft - not yet submitted
  | 'PENDING'      // Pending approval
  | 'APPROVED'     // Approved
  | 'REJECTED'     // Rejected
  | 'TRANSFERRED'; // Transferred to another approver

// Status configuration mapping
const STATUS_CONFIG: Record<WorkorderStatus, {
  color: string;
  label: string;
  icon: React.ReactNode;
}> = {
  DRAFT: {
    color: 'default',
    label: '草稿',
    icon: <EditOutlined />,
  },
  PENDING: {
    color: 'processing',
    label: '待审批',
    icon: <ClockCircleOutlined />,
  },
  APPROVED: {
    color: 'success',
    label: '已通过',
    icon: <CheckCircleOutlined />,
  },
  REJECTED: {
    color: 'error',
    label: '已拒绝',
    icon: <CloseCircleOutlined />,
  },
  TRANSFERRED: {
    color: 'warning',
    label: '已转交',
    icon: <SwapOutlined />,
  },
};

// Size configuration
const SIZE_CONFIG = {
  small: { fontSize: 12, padding: '0 6px' },
  default: { fontSize: 14, padding: '2px 8px' },
  large: { fontSize: 16, padding: '4px 12px' },
} as const;

export type StatusBadgeSize = keyof typeof SIZE_CONFIG;

export interface StatusBadgeProps {
  /** Workorder status value */
  status: WorkorderStatus;
  /** Badge size variant */
  size?: StatusBadgeSize;
  /** Show icon alongside label */
  showIcon?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * StatusBadge displays a styled badge for workorder approval statuses.
 * 
 * @param props - StatusBadgeProps
 * @returns React Element
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'default',
  showIcon = true,
  className = '',
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const sizeStyle = SIZE_CONFIG[size];

  return (
    <Tag
      color={config.color}
      icon={showIcon ? config.icon : undefined}
      style={{
        fontSize: sizeStyle.fontSize,
        padding: sizeStyle.padding,
      }}
      className={`workorder-status-badge ${className}`}
      data-testid={`status-badge-${status.toLowerCase()}`}
      data-status={status}
    >
      {config.label}
    </Tag>
  );
};

/**
 * Hook to get status display configuration
 * Can be used for custom styling or logic based on status
 * 
 * @param status - WorkorderStatus
 * @returns Status configuration object
 */
export const useStatusConfig = (status: WorkorderStatus) => {
  return STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
};

export default StatusBadge;