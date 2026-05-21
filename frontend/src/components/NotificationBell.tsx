/**
 * NotificationBell Component
 * 
 * Displays a notification bell icon with unread count badge and provides
 * a dropdown menu for viewing and managing notifications.
 * 
 * @component
 * @features
 * - Unread notification count badge
 * - Notification dropdown panel
 * - Mark as read functionality
 * - Work order approval notifications integration
 * 
 * @usedIn
 * - Global header/navigation bar
 * - WorkOrderApprovePage integration
 * 
 * @spec SWARM-WO-001: 工单审批流程
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// Types
interface Notification {
  id: string;
  title: string;
  content: string;
  eventType: 'APPROVAL_REQUIRED' | 'APPROVAL_COMPLETED' | 'WORK_ORDER_REJECTED' | 'WORK_ORDER_APPROVED';
  workOrderId?: string;
  isRead: boolean;
  createdAt: string;
  recipientId: string;
}

interface NotificationBellProps {
  /** Current user ID for fetching notifications */
  userId?: string;
  /** Callback when notification is clicked */
  onNotificationClick?: (notification: Notification) => void;
  /** Callback when notification is marked as read */
  onMarkAsRead?: (notificationId: string) => void;
  /** Custom class for the bell icon container */
  className?: string;
  /** Refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
}

// Event type labels mapping
const EVENT_TYPE_LABELS: Record<Notification['eventType'], string> = {
  APPROVAL_REQUIRED: '待审批',
  APPROVAL_COMPLETED: '审批完成',
  WORK_ORDER_REJECTED: '工单被拒绝',
  WORK_ORDER_APPROVED: '工单已通过',
};

// Event type colors for styling
const EVENT_TYPE_COLORS: Record<Notification['eventType'], string> = {
  APPROVAL_REQUIRED: 'text-yellow-600 bg-yellow-50',
  APPROVAL_COMPLETED: 'text-green-600 bg-green-50',
  WORK_ORDER_REJECTED: 'text-red-600 bg-red-50',
  WORK_ORDER_APPROVED: 'text-green-600 bg-green-50',
};

/**
 * NotificationBell Component
 * 
 * Provides notification bell UI with unread badge and dropdown panel.
 * Integrates with notification service for real-time updates.
 */
export const NotificationBell: React.FC<NotificationBellProps> = ({
  userId,
  onNotificationClick,
  onMarkAsRead,
  className = '',
  refreshInterval = 30000,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/notifications?recipient_id=${userId}`);
      // const data = await response.json();
      // setNotifications(data.notifications || []);
      
      // Mock data for development
      const mockNotifications: Notification[] = [
        {
          id: 'notif_001',
          title: '工单待审批',
          content: '服务器扩容申请需要您审批',
          eventType: 'APPROVAL_REQUIRED',
          workOrderId: 'WO-2024-001',
          isRead: false,
          createdAt: new Date().toISOString(),
          recipientId: userId,
        },
        {
          id: 'notif_002',
          title: '工单已通过',
          content: '您的工单「采购新设备」已通过审批',
          eventType: 'WORK_ORDER_APPROVED',
          workOrderId: 'WO-2024-002',
          isRead: true,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          recipientId: userId,
        },
      ];
      setNotifications(mockNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Calculate unread count
  useEffect(() => {
    const unread = notifications.filter(n => !n.isRead).length;
    setUnreadCount(unread);
  }, [notifications]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchNotifications();
    
    if (refreshInterval > 0) {
      const intervalId = setInterval(fetchNotifications, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchNotifications, refreshInterval]);

  // Close dropdown when clicking outside
  useEffect(() => {
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
  }, []);

  // Handle marking notification as read
  const handleMarkAsRead = useCallback(async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    try {
      // TODO: Replace with actual API call
      // await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
      
      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      
      onMarkAsRead?.(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [onMarkAsRead]);

  // Handle notification click
  const handleNotificationClick = useCallback((notification: Notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id, { stopPropagation: () => {} } as unknown as React.MouseEvent);
    }
    onNotificationClick?.(notification);
    setIsOpen(false);
  }, [handleMarkAsRead, onNotificationClick]);

  // Format relative time
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

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen(prev => !prev);
  };

  return (
    <div className={`relative ${className}`} data-testid="notification-bell">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-blue-50 rounded-full transition-colors duration-200"
        aria-label="查看通知"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Bell Icon */}
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
              {unreadCount > 0 && (
                <span className="text-xs text-gray-400">
                  {unreadCount}条未读
                </span>
              )}
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
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  <svg className="h-10 w-10 mx-auto mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  暂无通知
                </div>
              ) : (
                <ul className="divide-y divide-gray-100" role="list">
                  {notifications.map((notification) => (
                    <li
                      key={notification.id}
                      className={`relative px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                      role="menuitem"
                    >
                      {/* Unread Indicator */}
                      {!notification.isRead && (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full" />
                      )}

                      <div className="ml-2">
                        {/* Notification Header */}
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium ${notification.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                            {notification.title}
                          </p>
                          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_COLORS[notification.eventType]}`}>
                            {EVENT_TYPE_LABELS[notification.eventType]}
                          </span>
                        </div>

                        {/* Notification Content */}
                        <p className="mt-1 text-sm text-gray-400 line-clamp-2">
                          {notification.content}
                        </p>

                        {/* Footer: Time and Actions */}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                          
                          {!notification.isRead && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkAsRead(notification.id, e)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              标记已读
                            </button>
                          )}
                        </div>

                        {/* Work Order Link */}
                        {notification.workOrderId && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-400">
                              工单号: {notification.workOrderId}
                            </span>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
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
                onClick={() => {
                  // Navigate to all notifications page
                  // window.location.href = '/notifications';
                  setIsOpen(false);
                }}
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

// Export hook for using notification service
export const useNotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      // TODO: Implement actual API call
      // const response = await notificationService.getNotifications(userId);
      // setNotifications(response.data);
      
      // Mock implementation
      const mockData: Notification[] = [];
      setNotifications(mockData);
      setUnreadCount(mockData.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      // TODO: Implement actual API call
      // await notificationService.markAsRead(notificationId);
      
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async (userId: string) => {
    try {
      // TODO: Implement actual API call
      // await notificationService.markAllAsRead(userId);
      
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
};

// Export types for external use
export type { Notification, NotificationBellProps };

export default NotificationBell;