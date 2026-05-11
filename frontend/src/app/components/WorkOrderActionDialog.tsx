/**
 * @module frontend/src/app/components/WorkOrderActionDialog
 * @description Modal confirmation dialog for work order approve/reject actions.
 *
 * Features:
 * - Modal dialog that blocks underlying table interaction
 * - Dynamic title based on action type (approve / reject)
 * - Required reason textarea for reject action (hidden for approve)
 * - Loading state during API call
 * - Calls Layer 1 API functions (approveWorkOrder / rejectWorkOrder)
 *
 * @see frontend/src/app/api/workOrders.ts
 */

import React, { useState, useCallback } from "react";
import {
  approveWorkOrder,
  rejectWorkOrder,
  type RejectPayload,
} from "../api/workOrders";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WorkOrderActionDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Action type — determines title, submit behavior, and reason field visibility. */
  type: "approve" | "reject";
  /** The work order ID to operate on. */
  workOrderId: string;
  /** Called when the dialog should close (cancel or backdrop click). */
  onClose: () => void;
  /** Called after a successful approve/reject operation. */
  onSuccess: () => void;
  /** Whether a parent-level loading state is active. */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * WorkOrderActionDialog — modal confirmation dialog for approve/reject actions.
 *
 * When type is "reject", a required reason textarea is rendered.
 * When type is "approve", only a confirmation prompt is shown.
 *
 * On confirm, calls the appropriate API function from Layer 1.
 * On success, invokes the onSuccess callback to trigger data refresh.
 *
 * @param props — dialog configuration and callbacks
 */
export function WorkOrderActionDialog({
  open,
  type,
  workOrderId,
  onClose,
  onSuccess,
  loading: externalLoading = false,
}: WorkOrderActionDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReject = type === "reject";
  const isLoading = externalLoading || submitting;

  /** Reset internal state when dialog opens/closes. */
  React.useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  /**
   * Handle confirm button click — calls approve or reject API.
   */
  const handleConfirm = useCallback(async () => {
    if (isReject && !reason.trim()) {
      setError("Reject reason is required");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (type === "approve") {
        await approveWorkOrder(workOrderId);
      } else {
        const payload: RejectPayload = { reason: reason.trim() };
        await rejectWorkOrder(workOrderId, payload);
      }

      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }, [type, workOrderId, reason, isReject, onSuccess]);

  // ---------------------------------------------------------------------------
  // Render guard
  // ---------------------------------------------------------------------------

  if (!open) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={type === "approve" ? "Confirm Approval" : "Confirm Rejection"}
      data-testid={`work-order-action-dialog-${type}`}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h2 className="text-lg font-semibold text-gray-900">
          {type === "approve" ? "Confirm Approval" : "Confirm Rejection"}
        </h2>

        {/* Body */}
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            {type === "approve"
              ? `Are you sure you want to approve work order ${workOrderId}?`
              : `Please provide a reason for rejecting work order ${workOrderId}:`}
          </p>

          {/* Reason textarea — only for reject */}
          {isReject && (
            <div className="mt-3">
              <label
                htmlFor="reject-reason"
                className="block text-sm font-medium text-gray-700"
              >
                Reason
              </label>
              <textarea
                id="reject-reason"
                name="reason"
                aria-label="Reason"
                role="textbox"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
                placeholder="Enter reject reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isLoading}
                data-testid="reject-reason-input"
              />
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-3 text-sm text-red-600" data-testid="dialog-error">
            {error}
          </p>
        )}

        {/* Footer buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || (isReject && !reason.trim())}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              type === "approve"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isLoading ? "Processing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkOrderActionDialog;
