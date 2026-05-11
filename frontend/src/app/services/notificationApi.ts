/**
 * @module frontend/src/app/services/notificationApi
 * @description Notification API service layer — aggregates pending work orders
 * and retirement approvals into a unified notification feed.
 *
 * API endpoint (proxied via /api):
 *   GET /notifications/pending  — returns unread_count and items array
 *
 * Each item contains: id, type (work_order | retirement), title, created_at.
 *
 * @see frontend/src/app/services/workOrderService.ts
 * @see frontend/src/app/services/retirementService.ts
 */

import { api } from "../utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The type of a notification item, indicating the source business module.
 * - work_order: pending work order approval
 * - retirement: pending retirement/disposal approval
 */
export type NotificationType = "work_order" | "retirement";

/**
 * A single notification item as returned by the backend API.
 * Mirrors the VO returned by NotificationController.
 */
export interface NotificationItem {
  /** Unique identifier of the notification item */
  id: number;
  /** Business type: work_order or retirement */
  type: NotificationType;
  /** Display title (e.g. work order title or retirement application number) */
  title: string;
  /** ISO 8601 creation timestamp */
  created_at: string;
}

/**
 * Response shape from GET /notifications/pending.
 * Contains the unread count and the list of pending notification items.
 */
export interface PendingNotificationsResponse {
  /** Total number of unread pending items */
  unread_count: number;
  /** Array of pending notification items */
  items: NotificationItem[];
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

/**
 * Fetch the aggregated pending notifications for the current logged-in user.
 *
 * Calls GET /api/notifications/pending with auth token injected via interceptor.
 * The backend aggregates pending work orders and retirement approvals that
 * require the current user's action.
 *
 * @returns Promise resolving to the pending notifications response
 */
export async function fetchPendingNotifications(): Promise<PendingNotificationsResponse> {
  return api.get<PendingNotificationsResponse>("/notifications/pending");
}

/**
 * Fetch only the unread count for the current user.
 * Optimized lightweight endpoint for badge polling.
 *
 * Calls GET /api/notifications/pending/count.
 *
 * @returns Promise resolving to the unread count number
 */
export async function fetchUnreadCount(): Promise<number> {
  return api.get<number>("/notifications/pending/count");
}
