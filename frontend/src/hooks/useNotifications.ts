/**
 * useNotifications Hook
 * 
 * 工单审批流程通知管理 Hook
 * 用于管理工单审批相关的站内通知，包括：
 * - 审批结果通知（通过/拒绝）
 * - 待审批通知
 * - 通知已读状态管理
 * 
 * @module hooks/useNotifications
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * 通知事件类型枚举
 */
export enum NotificationEventType {
  /** 需要审批 */
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  /** 审批通过 */
  APPROVAL_APPROVED = 'APPROVAL_APPROVED',
  /** 审批拒绝 */
  APPROVAL_REJECTED = 'APPROVAL_REJECTED',
  /** 审批转交 */
  APPROVAL_DELEGATED = 'APPROVAL_DELEGATED',
}

/**
 * 通知对象结构
 */
export interface Notification {
  /** 通知唯一标识 */
  id: string;
  /** 通知接收者用户ID */
  recipientId: string;
  /** 关联工单ID */
  workOrderId: string;
  /** 通知标题 */
  title: string;
  /** 通知内容 */
  content: string;
  /** 事件类型 */
  eventType: NotificationEventType;
  /** 是否已读 */
  isRead: boolean;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 通知查询参数
 */
export interface NotificationQueryParams {
  /** 通知接收者ID */
  recipientId?: string;
  /** 是否已读筛选 */
  isRead?: boolean;
  /** 事件类型筛选 */
  eventType?: NotificationEventType;
  /** 关联工单ID */
  workOrderId?: string;
  /** 分页页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * 通知服务接口
 */
export interface NotificationServiceInterface {
  /** 获取通知列表 */
  fetchNotifications(params: NotificationQueryParams): Promise<Notification[]>;
  /** 标记通知为已读 */
  markAsRead(notificationId: string): Promise<void>;
  /** 标记所有通知为已读 */
  markAllAsRead(recipientId: string): Promise<void>;
  /** 获取未读通知数量 */
  getUnreadCount(recipientId: string): Promise<number>;
  /** 删除通知 */
  deleteNotification(notificationId: string): Promise<void>;
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
  markAsRead: (notificationId: string) => Promise<void>;
  /** 标记所有通知已读 */
  markAllAsRead: () => Promise<void>;
  /** 删除通知 */
  deleteNotification: (notificationId: string) => Promise<void>;
  /** 分页信息 */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Mock Notification Service (用于开发和测试)
// ============================================================================

/**
 * Mock通知服务实现
 * 在实际项目中应替换为真实的API调用
 */
class MockNotificationService implements NotificationServiceInterface {
  private mockNotifications: Notification[] = [];

  constructor() {
    // 初始化Mock数据
    this.initMockData();
  }

  /**
   * 初始化Mock测试数据
   */
  private initMockData(): void {
    const now = new Date();
    this.mockNotifications = [
      {
        id: 'notif_001',
        recipientId: 'user_001',
        workOrderId: 'WO-2024-001',
        title: '工单审批通知',
        content: '您提交的工单「服务器扩容申请」已通过审批',
        eventType: NotificationEventType.APPROVAL_APPROVED,
        isRead: false,
        createdAt: new Date(now.getTime() - 3600000),
      },
      {
        id: 'notif_002',
        recipientId: 'user_001',
        workOrderId: 'WO-2024-002',
        title: '待审批工单',
        content: '工单「采购办公设备」需要您进行审批',
        eventType: NotificationEventType.APPROVAL_REQUIRED,
        isRead: false,
        createdAt: new Date(now.getTime() - 7200000),
      },
      {
        id: 'notif_003',
        recipientId: 'user_001',
        workOrderId: 'WO-2024-003',
        title: '工单审批结果',
        content: '您提交的工单「更换网络设备」已被拒绝，原因：预算不足',
        eventType: NotificationEventType.APPROVAL_REJECTED,
        isRead: true,
        createdAt: new Date(now.getTime() - 86400000),
      },
    ];
  }

  /**
   * 获取通知列表
   * @param params 查询参数
   * @returns 通知列表
   */
  async fetchNotifications(params: NotificationQueryParams): Promise<Notification[]> {
    // 模拟API延迟
    await new Promise((resolve) => setTimeout(resolve, 300));

    let filtered = [...this.mockNotifications];

    // 根据参数筛选
    if (params.recipientId) {
      filtered = filtered.filter((n) => n.recipientId === params.recipientId);
    }
    if (params.isRead !== undefined) {
      filtered = filtered.filter((n) => n.isRead === params.isRead);
    }
    if (params.eventType) {
      filtered = filtered.filter((n) => n.eventType === params.eventType);
    }
    if (params.workOrderId) {
      filtered = filtered.filter((n) => n.workOrderId === params.workOrderId);
    }

    // 按创建时间倒序排列
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 分页处理
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return filtered.slice(start, end);
  }

  /**
   * 标记通知为已读
   * @param notificationId 通知ID
   */
  async markAsRead(notificationId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const notification = this.mockNotifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
    }
  }

  /**
   * 标记所有通知为已读
   * @param recipientId 接收者ID
   */
  async markAllAsRead(recipientId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.mockNotifications
      .filter((n) => n.recipientId === recipientId)
      .forEach((n) => {
        n.isRead = true;
      });
  }

  /**
   * 获取未读通知数量
   * @param recipientId 接收者ID
   * @returns 未读数量
   */
  async getUnreadCount(recipientId: string): Promise<number> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.mockNotifications.filter(
      (n) => n.recipientId === recipientId && !n.isRead
    ).length;
  }

  /**
   * 删除通知
   * @param notificationId 通知ID
   */
  async deleteNotification(notificationId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const index = this.mockNotifications.findIndex((n) => n.id === notificationId);
    if (index !== -1) {
      this.mockNotifications.splice(index, 1);
    }
  }
}

// ============================================================================
// Default Service Instance
// ============================================================================

let defaultService: NotificationServiceInterface | null = null;

/**
 * 获取默认通知服务实例
 * @returns 通知服务实例
 */
function getDefaultService(): NotificationServiceInterface {
  if (!defaultService) {
    defaultService = new MockNotificationService();
  }
  return defaultService;
}

/**
 * 设置通知服务实例（用于测试或自定义服务实现）
 * @param service 通知服务实例
 */
export function setNotificationService(service: NotificationServiceInterface): void {
  defaultService = service;
}

// ============================================================================
// useNotifications Hook Implementation
// ============================================================================

/**
 * useNotifications Hook
 * 
 * 管理工单审批相关的站内通知
 * 
 * @param options 配置选项
 * @param options.userId 当前用户ID
 * @param options.initialLoad 是否在初始化时加载数据，默认true
 * @param options.pollingInterval 轮询间隔（毫秒），设为0则不轮询，默认0
 * @param options.service 通知服务实例，默认使用Mock服务
 * @returns useNotifications返回对象
 * 
 * @example
 * ```tsx
 * function NotificationBell() {
 *   const { unreadCount, notifications, markAsRead } = useNotifications({
 *     userId: 'user_001',
 *     pollingInterval: 30000,
 *   });
 * 
 *   return (
 *     <div className="notification-bell">
 *       <span className="badge">{unreadCount}</span>
 *       <NotificationList
 *         notifications={notifications}
 *         onRead={markAsRead}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useNotifications(
  options: {
    userId?: string;
    initialLoad?: boolean;
    pollingInterval?: number;
    service?: NotificationServiceInterface;
  } = {}
): UseNotificationsReturn {
  const {
    userId = 'current_user_id',
    initialLoad = true,
    pollingInterval = 0,
    service: customService,
  } = options;

  // 状态管理
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });

  // 获取服务实例
  const service = customService || getDefaultService();

  // ============================================================================
  // Core Functions
  // ============================================================================

  /**
   * 刷新通知列表
   */
  const refresh = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params: NotificationQueryParams = {
        recipientId: userId,
        page: pagination.page,
        pageSize: pagination.pageSize,
      };

      const [notificationList, count] = await Promise.all([
        service.fetchNotifications(params),
        service.getUnreadCount(userId),
      ]);

      setNotifications(notificationList);
      setUnreadCount(count);
      setPagination((prev) => ({
        ...prev,
        total: count,
        totalPages: Math.ceil(count / prev.pageSize),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取通知列表失败';
      setError(errorMessage);
      console.error('[useNotifications] refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, pagination.page, pagination.pageSize, service]);

  /**
   * 标记单条通知已读
   * @param notificationId 通知ID
   */
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await service.markAsRead(notificationId);

        // 更新本地状态
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
    [service]
  );

  /**
   * 标记所有通知已读
   */
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      await service.markAllAsRead(userId);

      // 更新本地状态
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '批量标记已读失败';
      setError(errorMessage);
      console.error('[useNotifications] markAllAsRead error:', err);
    }
  }, [userId, service]);

  /**
   * 删除通知
   * @param notificationId 通知ID
   */
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      const notification = notifications.find((n) => n.id === notificationId);
      const wasUnread = notification && !notification.isRead;

      try {
        await service.deleteNotification(notificationId);

        // 更新本地状态
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
    [service, notifications]
  );

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * 初始化加载
   */
  useEffect(() => {
    if (initialLoad && userId) {
      refresh();
    }
  }, [initialLoad, userId, refresh]);

  /**
   * 轮询机制
   */
  useEffect(() => {
    if (pollingInterval <= 0 || !userId) return;

    const timer = setInterval(() => {
      refresh();
    }, pollingInterval);

    return () => clearInterval(timer);
  }, [pollingInterval, userId, refresh]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    pagination,
  };
}

// ============================================================================
// Export Types and Utilities
// ============================================================================

export default useNotifications;