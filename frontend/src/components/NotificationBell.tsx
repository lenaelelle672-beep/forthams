/**
 * NotificationBell Component
 *
 * 通知铃铛组件 — 接入真实后端 API
 * 使用 app/services/notificationApi 调用后端端点。
 *
 * @component
 * @features
 * - 未读通知数量角标
 * - 通知下拉面板
 * - 标记已读功能
 * - 轮询刷新未读数
 *
 * @usedIn
 * - 可嵌入全局 header 或导航栏
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchPendingNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/app/services/notificationApi';
import type { NotificationItem } from '@/app/services/notificationApi';

interface NotificationBellProps {
  /** Custom class for the bell icon container */
  className?: string;
  /** Refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
  /** Callback when notification is clicked */
  onNotificationClick?: (notification: NotificationItem) => void;
}

// Event type colors for styling
const TYPE_COLORS: Record<string, string> = {
  work_order: 'text-blue-600 bg-blue-50',
  retirement: 'text-orange-600 bg-orange-50',
  asset_expiration: 'text-yellow-600 bg-yellow-50',
  maintenance_reminder: 'text-green-600 bg-green-50',
  system_alert: 'text-red-600 bg-red-50',
};

const TYPE_LABELS: Record<string, string> = {
  work_order: '工单审批',
  retirement: '退役审批',
  asset_expiration: '资产到期',
  maintenance_reminder: '维保提醒',
  system_alert: '系统通知',
};

/**
 * NotificationBell Component
 *
 * 提供通知铃铛 UI 和下拉面板，调用真实后端 API。
 */
export const NotificationBell: React.FC<NotificationBellProps> = ({
  className = '',
  refreshInterval = 30000,
  onNotificationClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 获取未读数
  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await fetchUnreadCount();
      setUnreadCount(typeof count === 'number' ? count : 0);
    } catch {
      // 静默降级
    }
  }, []);

  // 获取通知列表
  const refreshNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchPendingNotifications();
      setNotifications(response.items ?? []);
      setUnreadCount(response.unread_count ?? 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加载 + 轮询未读数
  useEffect(() => {
    refreshUnreadCount();
    if (refreshInterval > 0) {
      const intervalId = setInterval(refreshUnreadCount, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [refreshUnreadCount, refreshInterval]);

  // 打开下拉时加载列表
  useEffect(() => {
    if (isOpen) {
      refreshNotifications();
    }
  }, [isOpen, refreshNotifications]);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // 标记单条已读
  const handleMarkAsRead = useCallback(async (id: number, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  // 标记全部已读
  const handleMarkAllAsRead = useCallback(async () => {
    setMarkingAllRead(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setMarkingAllRead(false);
    }
  }, []);

  // 点击通知项
  const handleNotificationClick = useCallback((notification: NotificationItem) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id, { stopPropagation: () => {} } as unknown as React.MouseEvent);
    }
    onNotificationClick?.(notification);
    setIsOpen(false);
  }, [handleMarkAsRead, onNotificationClick]);

  // 格式化相对时间
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className={`relative ${className}`} data-testid="notification-bell">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-blue-50 rounded-full transition-colors duration-200"
        aria-label="查看通知"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium text-white bg-red-500 rounded-full ring-2 ring-white"
            data-testid="unread-badge"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
          role="menu"
          aria-orientation="vertical"
        >
          {/* Dropdown Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">通知中心</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <span className="text-xs text-gray-400">{unreadCount}条未读</span>
                )}
                {notifications.some(n => !n.read) && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    disabled={markingAllRead}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                  >
                    {markingAllRead ? '处理中...' : '全部已读'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              <svg className="animate-spin h-5 w-5 mx-auto mb-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              加载中...
            </div>
          )}

          {/* Notification List */}
          {!isLoading && (
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">暂无通知</div>
              ) : (
                <ul className="divide-y divide-gray-100" role="list">
                  {notifications.map((notification) => {
                    const typeKey = notification.type || 'system_alert';
                    const colorClass = TYPE_COLORS[typeKey] || TYPE_COLORS.system_alert;
                    const typeLabel = TYPE_LABELS[typeKey] || '通知';
                    return (
                      <li
                        key={notification.id}
                        className={`relative px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${
                          !notification.read ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                        role="menuitem"
                      >
                        {!notification.read && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full" />
                        )}

                        <div className="ml-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                              {notification.title}
                            </p>
                            <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                              {typeLabel}
                            </span>
                          </div>

                          {notification.content && (
                            <p className="mt-1 text-sm text-gray-400 line-clamp-2">
                              {notification.content}
                            </p>
                          )}

                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-gray-400">
                              {formatRelativeTime(notification.created_at)}
                            </span>
                            {!notification.read && (
                              <button
                                type="button"
                                onClick={(e) => handleMarkAsRead(notification.id, e)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                标记已读
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Dropdown Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                type="button"
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                onClick={() => setIsOpen(false)}
              >
                查看全部通知
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
