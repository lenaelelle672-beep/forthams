/**
 * AssetStatusBadge — Reusable asset status badge component.
 *
 * SWARM-066: Extracted from AssetListPage for reuse across asset pages.
 * Renders a colored badge representing the current status of an asset.
 *
 * @module pages/assets/components/AssetStatusBadge
 * @since SWARM-066
 */

import React from 'react';

/* ------------------------------------------------------------------ */
/*  Status configuration                                               */
/* ------------------------------------------------------------------ */

/**
 * Status display configuration mapping status codes to labels and styles.
 *
 * @constant STATUS_MAP
 */
const STATUS_MAP: Record<string, { label: string; className: string }> = {
  IN_USE: { label: '在用', className: 'bg-green-100 text-green-800' },
  ACTIVE: { label: '在用', className: 'bg-green-100 text-green-800' },
  IDLE: { label: '闲置', className: 'bg-yellow-100 text-yellow-800' },
  INACTIVE: { label: '闲置', className: 'bg-gray-100 text-gray-800' },
  MAINTENANCE: { label: '维保中', className: 'bg-blue-100 text-blue-800' },
  SCRAPPED: { label: '已报废', className: 'bg-red-100 text-red-800' },
  RETIRED: { label: '已退役', className: 'bg-orange-100 text-orange-800' },
  DISPOSED: { label: '已处置', className: 'bg-red-100 text-red-800' },
  LOST: { label: '已丢失', className: 'bg-purple-100 text-purple-800' },
  TRANSFERRED: { label: '已转移', className: 'bg-blue-100 text-blue-800' },
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

/**
 * Props for the AssetStatusBadge component.
 *
 * @interface AssetStatusBadgeProps
 * @property {string | undefined} status - Asset status code from backend
 * @property {string} [className] - Optional additional CSS classes
 */
export interface AssetStatusBadgeProps {
  /** Asset status code from backend (e.g., 'IN_USE', 'IDLE') */
  status: string | undefined;
  /** Optional additional CSS class names */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * AssetStatusBadge — Renders a colored inline badge for asset status.
 *
 * Maps backend status codes to Chinese labels and Tailwind CSS classes.
 * Falls back to a gray badge with the raw status value for unknown codes.
 *
 * @param props - Component props
 * @returns A styled inline badge element
 *
 * @example
 * ```tsx
 * <AssetStatusBadge status="IN_USE" />
 * <AssetStatusBadge status={asset.status} className="text-xs" />
 * ```
 */
export const AssetStatusBadge: React.FC<AssetStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const config = STATUS_MAP[status ?? ''] ?? {
    label: status ?? '-',
    className: 'bg-gray-100 text-gray-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className} ${className}`}
      data-testid={`status-badge-${status ?? 'unknown'}`}
    >
      {config.label}
    </span>
  );
};

export default AssetStatusBadge;
