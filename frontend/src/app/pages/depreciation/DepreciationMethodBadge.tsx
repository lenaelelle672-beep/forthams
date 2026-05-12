/**
 * DepreciationMethodBadge — Visual badge for displaying depreciation method.
 *
 * Renders a styled badge indicating which depreciation calculation method
 * applies to a given schedule row or asset. Supports:
 * - straight_line (直线法)
 * - double_declining (双倍余额递减法)
 * - double_declining_balance (双倍余额递减法)
 * - Fallback for unknown methods
 *
 * Uses the project Badge UI component for consistent styling.
 *
 * @module pages/depreciation/DepreciationMethodBadge
 * @since SWARM-067
 */

import React from 'react';
import { Badge } from '../../components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Supported depreciation method keys.
 * Must stay in sync with backend depreciation method identifiers.
 */
export type DepreciationMethodKey =
  | 'straight_line'
  | 'double_declining'
  | 'double_declining_balance'
  | string;

/**
 * Props for the DepreciationMethodBadge component.
 */
export interface DepreciationMethodBadgeProps {
  /** The depreciation method key from the backend */
  method?: DepreciationMethodKey | null;
  /** Optional additional CSS class */
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Method label and style configuration map.
 * Each entry provides a Chinese display label and a tailwind color scheme.
 */
const METHOD_CONFIG: Record<
  string,
  { label: string; bgClass: string; textClass: string }
> = {
  straight_line: {
    label: '直线法',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
  },
  double_declining: {
    label: '双倍余额递减法',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-700',
  },
  double_declining_balance: {
    label: '双倍余额递减法',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-700',
  },
};

/**
 * Fallback configuration for unknown method keys.
 */
const FALLBACK_CONFIG = {
  label: '未知方法',
  bgClass: 'bg-gray-100',
  textClass: 'text-gray-600',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the display configuration for a given method key.
 *
 * @param method - The depreciation method key
 * @returns Label and CSS class configuration
 */
function resolveMethodConfig(method: string): {
  label: string;
  bgClass: string;
  textClass: string;
} {
  return METHOD_CONFIG[method] ?? { ...FALLBACK_CONFIG, label: method };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DepreciationMethodBadge component
 *
 * Renders a compact, color-coded badge showing the depreciation method.
 * Used inside the DepreciationScheduleTable to annotate each schedule row
 * with its calculation method.
 *
 * @param props - Component props
 * @returns The badge JSX
 */
export const DepreciationMethodBadge: React.FC<DepreciationMethodBadgeProps> = ({
  method,
  className,
}) => {
  if (!method) {
    return (
      <span
        className={`text-xs text-gray-400 ${className ?? ''}`}
        data-testid="method-badge-empty"
      >
        -
      </span>
    );
  }

  const config = resolveMethodConfig(method);

  return (
    <Badge
      variant="outline"
      className={`${config.bgClass} ${config.textClass} border-0 text-xs font-medium ${className ?? ''}`}
      data-testid={`method-badge-${method}`}
    >
      {config.label}
    </Badge>
  );
};

export default DepreciationMethodBadge;
