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
import { getAssetStatusMeta } from '../../../constants/assetStatus';

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
  const config = getAssetStatusMeta(status);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.badgeClass} ${className}`}
      data-testid={`status-badge-${status ?? 'unknown'}`}
    >
      {config.label}
    </span>
  );
};

export default AssetStatusBadge;
