/**
 * @file api/notification.ts
 * @description 通知中心 API
 * 对应后端：NotificationController (/notifications)
 */

import http from '@/utils/http';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type { Notification } from '@/types/common';

export interface NotificationListQuery {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
  type?: string;
  category?: string;
}

/** 获取通知列表 */
export const getNotifications = (params?: NotificationListQuery) =>
  http.get<PaginatedResponse<Notification>>('/notifications', { params });

/** 获取未读通知数量 */
export const getUnreadCount = () =>
  http.get<ApiResponse<number>>('/notifications/pending/count');

/** 标记通知为已读 */
export const markAsRead = (id: number) =>
  http.put<ApiResponse<void>>(`/notifications/${id}/read`);

/** 标记全部已读 */
export const markAllAsRead = () =>
  http.put<ApiResponse<void>>('/notifications/read-all');

/** 删除通知 */
export const deleteNotification = (id: number) =>
  http.delete<ApiResponse<void>>(`/notifications/${id}`);
