/**
 * @module frontend/src/app/pages/work-orders/components/WorkOrderStatusBadge
 * @description Status badge component for work orders — renders a colored badge
 *              that strictly maps to the backend WorkOrder entity status values.
 *
 * The status values are defined in the backend WorkOrder.java entity:
 *   DRAFT, PENDING, APPROVED, EXECUTING, COMPLETED, REJECTED, CANCELLED
 *
 * No frontend-only states are assumed. The `status` prop must be one of the
 * backend-defined values; an unknown status renders a neutral fallback.
 *
 * @see backend/src/main/java/com/ams/entity/WorkOrder.java
 * @see frontend/src/app/services/workOrderService.ts (WorkOrderStatus type)
 */

import { type WorkOrderStatus, getWorkOrderStatusLabel } from "../../../services/workOrderService";

// ---------------------------------------------------------------------------
// Type & config
// ---------------------------------------------------------------------------

/** Props for WorkOrderStatusBadge. */
interface WorkOrderStatusBadgeProps {
  /** The backend status enum value. */
  status: WorkOrderStatus | string | undefined;
  /** Optional extra CSS classes to merge. */
  className?: string;
  /** Optional test ID for E2E assertions. */
  "data-testid"?: string;
}

/**
 * Strict mapping from backend WorkOrder status values to Tailwind CSS classes.
 *
 * Each key corresponds exactly to a valid `status` string in
 * backend WorkOrder.java (DRAFT/PENDING/APPROVED/EXECUTING/COMPLETED/REJECTED/CANCELLED).
 * The color scheme follows semantic convention:
 *   - DRAFT       → gray (neutral, not yet active)
 *   - PENDING     → yellow (awaiting action)
 *   - APPROVED    → blue (cleared for execution)
 *   - EXECUTING   → indigo (in progress)
 *   - COMPLETED   → green (done)
 *   - REJECTED    → red (denied)
 *   - CANCELLED   → gray-200 (voided)
 */
const STATUS_CLASS_MAP: Record<string, string> = {
  DRAFT: "bg-blue-50 text-gray-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-800",
  EXECUTING: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-blue-50 text-gray-500",
};

/** Fallback classes for unrecognized status values. */
const FALLBACK_CLASSES = "bg-blue-50 text-gray-500";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * WorkOrderStatusBadge — renders a colored pill badge for a work order status.
 *
 * Only covers backend-defined WorkOrderState values. Uses `getWorkOrderStatusLabel`
 * from workOrderService for the display text, which provides Chinese labels.
 *
 * @param props - status, optional className and data-testid
 * @returns a <span> element with appropriate badge styling
 */
export function WorkOrderStatusBadge({
  status,
  className = "",
  "data-testid": testId,
}: WorkOrderStatusBadgeProps) {
  const badgeClasses = STATUS_CLASS_MAP[status ?? ""] ?? FALLBACK_CLASSES;
  const label = getWorkOrderStatusLabel(status);

  return (
    <span
      className={`px-2.5 py-1 text-xs font-medium rounded-full inline-block ${badgeClasses} ${className}`}
      data-testid={testId}
    >
      {label}
    </span>
  );
}

export default WorkOrderStatusBadge;
