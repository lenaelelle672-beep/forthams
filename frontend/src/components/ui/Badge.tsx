/**
 * @file components/ui/Badge.tsx
 * @description 状态徽章组件
 * StatusBadge 支持 forthAMS 8 种业务状态，颜色与 Design System 严格对齐
 */

import * as React from 'react';
import { cn } from '@/utils/cn';
import type { AssetStatus } from '@/types/asset';

// ── 通用 Badge ─────────────────────────────────────────────────────────────────

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'gray';
}

const badgeVariants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger:  'bg-red-100   text-red-700',
  info:    'bg-cyan-100  text-cyan-700',
  purple:  'bg-purple-100 text-purple-700',
  gray:    'bg-gray-100  text-gray-600',
};

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        badgeVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// ── 资产状态 StatusBadge ───────────────────────────────────────────────────────

const ASSET_STATUS_BADGE: Record<
  AssetStatus,
  { label: string; className: string }
> = {
  IN_USE:             { label: '在用',   className: 'bg-[#dcfce7] text-[#16a34a]' },
  IDLE:               { label: '闲置',   className: 'bg-[#dbeafe] text-[#2563eb]' },
  MAINTENANCE:        { label: '维修中', className: 'bg-[#fef3c7] text-[#d97706]' },
  PENDING_RETIREMENT: { label: '待退役', className: 'bg-[#f3e8ff] text-[#9333ea]' },
  RETIRED:            { label: '已退役', className: 'bg-[#f3f4f6] text-[#6b7280]' },
  SCRAPPED:           { label: '已报废', className: 'bg-[#fee2e2] text-[#dc2626]' },
  CLEARED:            { label: '已清退', className: 'bg-[#f5f5f4] text-[#78716c]' },
};

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: AssetStatus | string;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const config = ASSET_STATUS_BADGE[status as AssetStatus];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config?.className ?? 'bg-gray-100 text-gray-600',
        className,
      )}
      {...props}
    >
      {config?.label ?? status}
    </span>
  );
}

// ── 工单状态 Badge ─────────────────────────────────────────────────────────────

const WO_STATUS_CONFIG: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  DRAFT:               { label: '草稿',      variant: 'gray'    },
  PENDING:             { label: '待审批',    variant: 'default' },
  APPROVING_LEVEL_1:   { label: '一级审批中', variant: 'warning' },
  APPROVING_LEVEL_2:   { label: '二级审批中', variant: 'warning' },
  APPROVED:            { label: '已通过',    variant: 'success' },
  REJECTED:            { label: '已驳回',    variant: 'danger'  },
  CANCELLED:           { label: '已取消',    variant: 'gray'    },
};

export function WorkOrderStatusBadge({ status }: { status: string }) {
  const config = WO_STATUS_CONFIG[status] ?? { label: status, variant: 'gray' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
