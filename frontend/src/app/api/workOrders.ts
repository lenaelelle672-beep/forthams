/**
 * @module frontend/src/app/api/workOrders
 * @description Work Order Approval API client — thin wrappers for
 * approve/reject operations on work orders.
 *
 * API endpoints (assumed backend contract per SWARM-036):
 *   PATCH /api/work-orders/:id/approve  — approve a pending work order
 *   PATCH /api/work-orders/:id/reject   — reject a pending work order (reason required)
 *
 * The apiClient is an axios instance (from utils/api.ts) that already has
 * auth interceptors and base URL (/api) configured.
 *
 * @see frontend/src/app/utils/api.ts
 */

import apiClient from "../utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Payload for reject action — reason is mandatory. */
export interface RejectPayload {
  reason: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Approve a pending work order.
 *
 * Sends PATCH /api/work-orders/:id/approve.
 * No payload required — the backend only needs the work order ID.
 *
 * @param id — work order identifier (e.g. "wo_001")
 * @returns the updated work order record data from the backend
 * @throws Error if the request fails or the backend returns a non-200 status
 */
export async function approveWorkOrder(id: string): Promise<unknown> {
  const response = await apiClient.patch(`/work-orders/${id}/approve`);
  return response.data;
}

/**
 * Reject a pending work order with a mandatory reason.
 *
 * Sends PATCH /api/work-orders/:id/reject with { reason } in the body.
 *
 * @param id — work order identifier (e.g. "wo_001")
 * @param payload — must contain a non-empty reason string
 * @returns the updated work order record data from the backend
 * @throws Error if the request fails or the backend returns a non-200 status
 */
export async function rejectWorkOrder(
  id: string,
  payload: RejectPayload,
): Promise<unknown> {
  const response = await apiClient.patch(`/work-orders/${id}/reject`, payload);
  return response.data;
}
