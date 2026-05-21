/**
 * StatusBadge Component
 * 
 * Displays visual status indicators for retirement requests with
 * appropriate color coding based on the current state.
 * 
 * @component
 * @example
 * ```tsx
 * <StatusBadge status="PENDING" label="审批中" />
 * <StatusBadge status="APPROVED" label="已批准" />
 * <StatusBadge status="REJECTED" label="已驳回" />
 * ```
 * 
 * @remarks
 * - PENDING: Yellow/amber background, indicates awaiting action
 * - APPROVED: Green background, indicates completed/success
 * - REJECTED: Red background, indicates rejected/failed
 * - DRAFT: Gray background, indicates incomplete state
 */

import React from 'react';
import { clsx } from 'clsx';

/** Retirement request status enumeration */
export type RetirementStatus = 
  | 'DRAFT'      // Application not yet submitted
  | 'PENDING'    // Awaiting approval
  | 'APPROVED'   // Application approved
  | 'REJECTED';  // Application rejected

/** Configuration for status badge styling */
interface StatusConfig {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  icon?: string;
}

const STATUS_CONFIG: Record<RetirementStatus, StatusConfig> = {
  DRAFT: {
    backgroundColor: 'bg-blue-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
  },
  PENDING: {
    backgroundColor: 'bg-amber-50',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
    icon: '⏳',
  },
  APPROVED: {
    backgroundColor: 'bg-green-50',
    textColor: 'text-green-800',
    borderColor: 'border-green-200',
    icon: '✓',
  },
  REJECTED: {
    backgroundColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    icon: '✗',
  },
};

/** Props for StatusBadge component */
export interface StatusBadgeProps {
  /** Current status of the retirement request */
  status: RetirementStatus;
  /** Display label for the status */
  label: string;
  /** Additional CSS classes for customization */
  className?: string;
  /** Size variant of the badge */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the status icon */
  showIcon?: boolean;
}

/**
 * StatusBadge Component
 * 
 * Renders a styled badge displaying the current status of a retirement
 * application with appropriate color coding and optional icon.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className,
  size = 'md',
  showIcon = true,
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        config.backgroundColor,
        config.textColor,
        config.borderColor,
        sizeClasses[size],
        className
      )}
      data-testid={`status-badge-${status.toLowerCase()}`}
      data-status={status}
    >
      {showIcon && config.icon && (
        <span className="flex-shrink-0" aria-hidden="true">
          {config.icon}
        </span>
      )}
      <span className="font-medium">{label}</span>
    </span>
  );
};

/**
 * Maps retirement request status to default display label
 */
export const getDefaultStatusLabel = (status: RetirementStatus): string => {
  const labels: Record<RetirementStatus, string> = {
    DRAFT: '草稿',
    PENDING: '审批中',
    APPROVED: '已批准',
    REJECTED: '已驳回',
  };
  return labels[status] || '未知状态';
};

/**
 * StatusBadge with automatic label resolution
 */
export const RetirementStatusBadge: React.FC<{
  status: RetirementStatus;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}> = ({ status, ...props }) => (
  <StatusBadge
    status={status}
    label={getDefaultStatusLabel(status)}
    {...props}
  />
);

export default StatusBadge;