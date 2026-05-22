/**
 * useNotifications Hook
 *
 * 通知中心数据管理 Hook — 调用真实后端 API
 * 基于 NotificationController 的独立 notification 表端点。
 *
 * 用法：
 * - NotificationsPage 使用 api/notification.ts + TanStack Query（推荐）
 * - 其他组件可使用此 Hook 获取通知数据
 *
 * @module hooks/useNotifications
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getNotifications,
  getUnreadCount,
  markAsRead as apiMarkAsRead,
  markAllAsRead as apiMarkAllAsRead,
  deleteNotification as apiDeleteNotification,
} from '@/api/notification';
import type { Notification } from '@/types/common';

/**
 * 通知查询参数
 */
export interface NotificationQueryParams {
  /** 按分类过滤（APPROVAL / ALERT / SYSTEM） */
  category?: string;
  /** 按类型过滤 */
  type?: string;
  /** 是否只看未读 */
  isRead?: boolean;
  /** 分页页码（从 1 开始） */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * useNotifications Hook 返回类型
 */
export interface UseNotificationsReturn {
  /** 通知列表 */
  notifications: Notification[];
  /** 未读通知数量 */
  unreadCount: number;
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新通知列表 */
  refresh: () => Promise<void>;
  /** 标记单条通知已读 */
  markAsRead: (notificationId: number) => Promise<void>;
  /** 标记所有通知已读 */
  markAllAsRead: () => Promise<void>;
  /** 删除通知 */
  deleteNotification: (notificationId: number) => Promise<void>;
  /** 分页信息 */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * useNotifications Hook
 *
 * 调用真实后端 API 获取和管理通知数据。
 *
 * @param options 配置选项
 * @param options.category 按分类过滤
 * @param options.type 按类型过滤
 * @param options.pageSize 每页数量，默认 10
 * @param options.pollingInterval 轮询间隔（毫秒），0 不轮询，默认 0
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { unreadCount, notifications, markAsRead, refresh } = useNotifications({
 *     pollingInterval: 30000,
 *   });
 *   // ...
 * }
 * ```
 */
export function useNotifications(
  options: {
    category?: string;
    type?: string;
    pageSize?: number;
    pollingInterval?: number;
  } = {}
): UseNotificationsReturn {
  const {
    category,
    type,
    pageSize = 10,
    pollingInterval = 0,
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [listResponse, countResponse] = await Promise.all([
        getNotifications({ category, type, page, pageSize }),
        getUnreadCount(),
      ]);

      const pageData = (listResponse as any)?.data;
      setNotifications(pageData?.records ?? []);
      setTotal(pageData?.total ?? 0);
      setTotalPages(pageData?.pages ?? Math.ceil((pageData?.total ?? 0) / pageSize));

      const count = (countResponse as any)?.data;
      setUnreadCount(typeof count === 'number' ? count : 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取通知列表失败';
      setError(errorMessage);
      console.error('[useNotifications] refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [category, type, page, pageSize]);

  const markAsRead = useCallback(
    async (notificationId: number) => {
      try {
        await apiMarkAsRead(notificationId);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '标记已读失败';
        setError(errorMessage);
        console.error('[useNotifications] markAsRead error:', err);
      }
    },
    []
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await apiMarkAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '批量标记已读失败';
      setError(errorMessage);
      console.error('[useNotifications] markAllAsRead error:', err);
    }
  }, []);

  const deleteNotification = useCallback(
    async (notificationId: number) => {
      const notification = notifications.find((n) => n.id === notificationId);
      const wasUnread = notification && !notification.isRead;

      try {
        await apiDeleteNotification(notificationId);
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        if (wasUnread) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '删除通知失败';
        setError(errorMessage);
        console.error('[useNotifications] deleteNotification error:', err);
      }
    },
    [notifications]
  );

  // 初始化加载
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 轮询机制
  useEffect(() => {
    if (pollingInterval <= 0) return;
    const timer = setInterval(() => {
      refresh();
    }, pollingInterval);
    return () => clearInterval(timer);
  }, [pollingInterval, refresh]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

export default useNotifications;
