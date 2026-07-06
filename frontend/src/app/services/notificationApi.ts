/**
 * @module frontend/src/app/services/notificationApi
 * @description Notification API service layer — 通知中心 API 服务层
 *
 * API endpoints (proxied via /api):
 *   GET  /notifications             — 分页查询通知列表（独立 notification 表）
 *   GET  /notifications/unread-count — 获取未读通知数量
 *   PUT  /notifications/{id}/read   — 标记单条通知为已读
 *   PUT  /notifications/read-all    — 标记所有通知为已读
 *   DELETE /notifications/{id}      — 删除通知
 *
 * 兼容旧端点（从审批流程派生）：
 *   GET  /notifications/pending         — 待处理审批列表
 *   GET  /notifications/pending/count   — 待处理数量
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
  type: NotificationType | string;
  /** Notification category (APPROVAL / ALERT / SYSTEM) */
  category?: string;
  /** Display title (e.g. work order title or retirement application number) */
  title: string;
  /** Notification content */
  content?: string;
  /** ISO 8601 creation timestamp */
  created_at: string;
  /** Alias for created_at */
  createTime?: string;
  /** Whether the notification has been read by the current user */
  read: boolean;
  /** Alias for read */
  isRead?: boolean;
  /** Related business entity ID */
  refId?: number;
  /** Related business entity type */
  refType?: string;
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
 * Paginated response from GET /notifications.
 */
export interface NotificationPageResponse {
  records: NotificationItem[];
  total: number;
  size: number;
  current: number;
  pages?: number;
}

/**
 * Parameters for filtering notifications.
 * All fields are optional — omitting a field means no filter on that dimension.
 */
export interface NotificationFilterParams {
  /** Filter by notification type */
  type?: NotificationType | "all";
  /** Filter by category */
  category?: string;
  /** Page number (1-based) */
  page?: number;
  /** Page size */
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

/**
 * Fetch the paginated notification list from the independent notification table.
 *
 * Calls GET /api/notifications with optional category/type filters and pagination.
 *
 * @param params - Optional filter and pagination parameters
 * @returns Promise resolving to the paginated notification response
 */
export async function fetchNotifications(
  params?: NotificationFilterParams,
): Promise<NotificationPageResponse> {
  const queryParams: Record<string, string | number> = {};
  if (params?.type && params.type !== "all") {
    queryParams.type = params.type;
  }
  if (params?.category) {
    queryParams.category = params.category;
  }
  if (params?.page) {
    queryParams.page = params.page;
  }
  if (params?.pageSize) {
    queryParams.pageSize = params.pageSize;
  }
  return api.get<NotificationPageResponse>("/notifications", {
    params: queryParams,
  });
}

/**
 * Fetch the aggregated pending notifications for the current logged-in user.
 * Legacy endpoint — data derived from approval processes.
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
 * Uses the new endpoint backed by the independent notification table.
 *
 * @returns Promise resolving to the unread count number
 */
export async function fetchUnreadCount(): Promise<number> {
  return api.get<number>("/notifications/unread-count");
}

/**
 * Mark a single notification as read.
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
 * @returns Promise resolving when the operation completes
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  return api.put<void>("/notifications/read-all");
}

/**
 * Delete a notification.
 *
 * @param id - The notification item ID to delete
 * @returns Promise resolving when the operation completes
 */
export async function deleteNotification(id: number): Promise<void> {
  return api.delete<void>(`/notifications/${id}`);
}
