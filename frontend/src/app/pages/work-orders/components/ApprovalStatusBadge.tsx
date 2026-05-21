/**
 * @module frontend/src/app/pages/work-orders/components/ApprovalStatusBadge
 * @description Approval status badge component — renders a colored pill badge
 *              that maps approval status values to display labels and CSS classes.
 *
 * This is a pure presentational component with zero side-effects.
 * Status values: "pending" | "approved" | "rejected"
 *
 * @see frontend/src/app/services/workOrderService.ts (ApprovalStatus type)
 */

import type { ApprovalStatus } from "../../../services/workOrderService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for ApprovalStatusBadge. */
export interface ApprovalStatusBadgeProps {
  /** The approval status value. */
  status: ApprovalStatus | string;
  /** Optional extra CSS classes to merge. */
  className?: string;
  /** Optional test ID for E2E assertions. */
  "data-testid"?: string;
}

// ---------------------------------------------------------------------------
// Mapping config
// ---------------------------------------------------------------------------

/**
 * Map approval status to Chinese display label.
 *
 * @param status — the approval status string
 * @returns human-readable Chinese label
 */
function getApprovalStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "待审批",
    approved: "已通过",
    rejected: "已驳回",
  };
  return labels[status] ?? status ?? "-";
}

/**
 * Strict mapping from approval status values to Tailwind CSS classes.
 *
 * Color scheme:
 *   pending  → yellow (awaiting action)
 *   approved → green (accepted)
 *   rejected → red   (denied)
 */
const STATUS_CLASS_MAP: Record<string, string> = {
  pending: "badge-pending bg-yellow-100 text-yellow-800",
  approved: "badge-approved bg-green-100 text-green-800",
  rejected: "badge-rejected bg-red-100 text-red-800",
};

/** Fallback classes for unrecognized status values. */
const FALLBACK_CLASSES = "bg-blue-50 text-gray-500";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ApprovalStatusBadge — renders a colored pill badge for an approval status.
 *
 * Pure presentational component. Maps "pending" / "approved" / "rejected"
 * to Chinese labels and semantic CSS classes (e.g. `badge-pending`).
 *
 * @param props - status, optional className and data-testid
 * @returns a <span> element with appropriate badge styling
 */
export function ApprovalStatusBadge({
  status,
  className = "",
  "data-testid": testId,
}: ApprovalStatusBadgeProps) {
  const badgeClasses = STATUS_CLASS_MAP[status] ?? FALLBACK_CLASSES;
  const label = getApprovalStatusLabel(status);

  return (
    <span
      className={`px-2.5 py-1 text-xs font-medium rounded-full inline-block ${badgeClasses} ${className}`}
      data-testid={testId}
    >
      {label}
    </span>
  );
}

export default ApprovalStatusBadge;
