/**
 * @module frontend/src/app/services/notificationApi
 * @description Notification API service layer — aggregates pending work orders,
 * retirement approvals, asset expiration warnings, maintenance reminders,
 * and system alerts into a unified notification feed.
 *
 * API endpoints (proxied via /api):
 *   GET  /notifications/pending         — returns unread_count and items array
 *   GET  /notifications/pending/count   — returns lightweight unread count
 *   PUT  /notifications/{id}/read       — marks a single notification as read
 *   PUT  /notifications/read-all        — marks all notifications as read
 *
 * Each item contains: id, type, title, created_at, read.
 *
 * @see frontend/src/app/utils/api.ts
 */

import { api } from "../utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The type of a notification item, indicating the source business module.
 * - work_order:        pending work order approval
 * - retirement:        pending retirement/disposal approval
 * - asset_expiration:  asset approaching or past expiration/warranty date
 * - maintenance_reminder: upcoming or overdue maintenance task
 * - system_alert:      system-level notification or announcement
 */
export type NotificationType =
  | "work_order"
  | "retirement"
  | "asset_expiration"
  | "maintenance_reminder"
  | "system_alert";

/**
 * A single notification item as returned by the backend API.
 * Mirrors the VO returned by NotificationController.
 */
export interface NotificationItem {
  /** Unique identifier of the notification item */
  id: number;
  /** Business type of the notification */
  type: NotificationType;
  /** Display title (e.g. work order title or retirement application number) */
  title: string;
  /** ISO 8601 creation timestamp */
  created_at: string;
  /** Whether the notification has been read by the current user */
  read: boolean;
}

/**
 * Response shape from GET /notifications/pending.
 * Contains the unread count and the list of notification items.
 */
export interface PendingNotificationsResponse {
  /** Total number of unread notification items */
  unread_count: number;
  /** Array of notification items */
  items: NotificationItem[];
}

/**
 * Parameters for filtering notifications.
 * All fields are optional — omitting a field means no filter on that dimension.
 */
export interface NotificationFilterParams {
  /** Filter by notification type */
  type?: NotificationType | "all";
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

/**
 * Fetch the aggregated pending notifications for the current logged-in user.
 *
 * Calls GET /api/notifications/pending with auth token injected via interceptor.
 * The backend aggregates pending work orders, retirement approvals,
 * expiration warnings, maintenance reminders, and system alerts that
 * are relevant to the current user.
 *
 * @param params - Optional filter parameters
 * @returns Promise resolving to the pending notifications response
 */
export async function fetchPendingNotifications(
  params?: NotificationFilterParams,
): Promise<PendingNotificationsResponse> {
  const queryParams: Record<string, string> = {};
  if (params?.type && params.type !== "all") {
    queryParams.type = params.type;
  }
  return api.get<PendingNotificationsResponse>("/notifications/pending", {
    params: queryParams,
  });
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

/**
 * Mark a single notification as read.
 *
 * Calls PUT /api/notifications/{id}/read.
 *
 * @param id - The notification item ID to mark as read
 * @returns Promise resolving when the operation completes
 */
export async function markNotificationAsRead(id: number): Promise<void> {
  return api.put<void>(`/notifications/${id}/read`);
}

/**
 * Mark all notifications as read for the current user.
 *
 * Calls PUT /api/notifications/read-all.
 *
 * @returns Promise resolving when the operation completes
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  return api.put<void>("/notifications/read-all");
}
