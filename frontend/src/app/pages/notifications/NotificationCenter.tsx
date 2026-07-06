/**
 * @module frontend/src/app/pages/notifications/NotificationCenter
 * @description Notification center dropdown component.
 *
 * Features:
 * - Bell icon button (data-testid="notification-bell") with unread badge
 *   (data-testid="unread-badge")
 * - Dropdown panel (data-testid="notification-dropdown") that toggles on click
 * - Filter bar (NotificationFilterBar) to filter by notification type
 * - List of NotificationItem components (data-testid="notification-item-{id}")
 * - Empty state (data-testid="empty-notifications") when no pending items
 * - Mark-as-read per item via click
 * - Mark-all-as-read button (data-testid="mark-all-read-btn")
 * - Scrollable list with max-height to handle overflow (>20 items)
 * - Uses position:absolute to avoid layout shift (CLS prevention)
 * - Error state with retry button (data-testid="notification-error-retry")
 *
 * State triad: loading (skeleton) / error (message + retry) / data (list)
 *
 * @see frontend/src/app/services/notificationApi.ts
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, CheckCheck, RefreshCw, AlertCircle } from "lucide-react";
import {
  fetchPendingNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../../services/notificationApi";
import type {
  NotificationItem as NotificationItemType,
  NotificationType,
} from "../../services/notificationApi";
import { NotificationItem } from "./NotificationItem";
import { NotificationFilterBar } from "./NotificationFilterBar";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Polling interval for unread count refresh (15 seconds). */
const POLL_INTERVAL_MS = 15_000;

/** Maximum number of items visible before scrolling. */
const MAX_VISIBLE_ITEMS = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * NotificationCenter provides a bell icon with an unread count badge and a
 * dropdown panel listing pending work orders, retirement approvals,
 * asset expiration warnings, maintenance reminders, and system alerts.
 *
 * Features:
 * - 15-second polling for unread count via lightweight endpoint
 * - On-demand full list fetch when dropdown opens
 * - Type-based filtering via NotificationFilterBar
 * - Mark-as-read per item (click) and mark-all-as-read (header button)
 * - Error state with error message and retry/refresh button
 * - Loading skeleton state while fetching
 * - Layout isolation via position:absolute to prevent CLS
 * - Unmount cleanup clears the polling interval
 *
 * @returns JSX element for the notification center
 */
export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(-1); // -1 = not loaded
  const [items, setItems] = useState<NotificationItemType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotificationType | "all">(
    "all",
  );
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Fetch the unread count from the backend.
   * Silent on error — degrades to showing no badge.
   */
  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await fetchUnreadCount();
      setUnreadCount(typeof count === "number" ? count : 0);
    } catch {
      // Silent degradation
    }
  }, []);

  /**
   * Fetch the full notification items list.
   * Called when the dropdown is opened or the filter changes.
   * Implements loading / error / data state triad.
   */
  const refreshItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPendingNotifications({
        type: activeFilter !== "all" ? activeFilter : undefined,
      });
      setItems(response.items ?? []);
      setUnreadCount(response.unread_count ?? 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "加载通知失败";
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  // Polling: refresh unread count every 15 seconds
  useEffect(() => {
    refreshUnreadCount();

    const intervalId = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshUnreadCount]);

  // Fetch items when dropdown opens
  useEffect(() => {
    if (isOpen) {
      refreshItems();
    }
  }, [isOpen, refreshItems]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  /**
   * Toggle the dropdown panel open/closed.
   */
  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  /**
   * Handle filter type change from the filter bar.
   * Updates the active filter which triggers a re-fetch via useEffect.
   *
   * @param filter - the new filter type or "all"
   */
  const handleFilterChange = (filter: NotificationType | "all") => {
    setActiveFilter(filter);
  };

  /**
   * Mark a single notification as read and update local state optimistically.
   *
   * @param id - notification item ID to mark as read
   */
  const handleMarkAsRead = useCallback(
    async (id: number) => {
      // Optimistic update
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await markNotificationAsRead(id);
      } catch {
        // Revert optimistic update on failure
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, read: false } : item,
          ),
        );
        setUnreadCount((prev) => prev + 1);
      }
    },
    [],
  );

  /**
   * Mark all notifications as read and update local state optimistically.
   * Shows loading state on the button during the API call.
   */
  const handleMarkAllAsRead = useCallback(async () => {
    // Optimistic update
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    const prevCount = unreadCount;
    setUnreadCount(0);
    setMarkingAllRead(true);

    try {
      await markAllNotificationsAsRead();
    } catch {
      // Revert optimistic update on failure
      setItems((prev) =>
        prev.map((item) => ({ ...item, read: false })),
      );
      setUnreadCount(prevCount);
    } finally {
      setMarkingAllRead(false);
    }
  }, [unreadCount]);

  /**
   * Retry fetching items after an error.
   */
  const handleRetry = () => {
    refreshItems();
  };

  /** Compute badge display text, capping at "99+" for large counts. */
  const badgeText =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : "";

  /** Whether the badge should be visible. */
  const badgeVisible = unreadCount > 0;

  /** Whether the list has items to display. */
  const hasItems = items.length > 0;

  /** Whether there are unread items (to show mark-all-as-read button). */
  const hasUnread = items.some((item) => !item.read);

  return (
    <div ref={containerRef} className="relative">
      {/* Bell icon button */}
      <button
        type="button"
        data-testid="notification-bell"
        onClick={handleToggle}
        className="relative p-2 hover:bg-blue-50 rounded-lg transition-colors"
        aria-label="查看通知"
      >
        <Bell className="w-5 h-5 text-gray-500" />
        <span className="sr-only">通知</span>
        {/* Unread badge — always mounted to prevent CLS */}
        <span
          data-testid="unread-badge"
          className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none"
          style={{
            backgroundColor: "#ef4444",
            color: "#fff",
            display: badgeVisible ? "inline-flex" : "none",
          }}
        >
          {badgeText}
        </span>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          data-testid="notification-dropdown"
          className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-sm font-semibold text-gray-900">
              通知中心
            </span>
            <div className="flex items-center gap-2">
              {badgeVisible && (
                <span className="text-xs text-gray-400">
                  {unreadCount} 条未读
                </span>
              )}
              {hasUnread && (
                <button
                  type="button"
                  data-testid="mark-all-read-btn"
                  onClick={handleMarkAllAsRead}
                  disabled={markingAllRead}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="全部标记为已读"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {markingAllRead ? "处理中..." : "全部已读"}
                </button>
              )}
            </div>
          </div>

          {/* Filter bar */}
          <NotificationFilterBar
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
          />

          {/* Loading state — skeleton */}
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              加载中...
            </div>
          )}

          {/* Error state with retry */}
          {!loading && error && (
            <div
              data-testid="notification-error-retry"
              className="px-4 py-6 text-center"
            >
              <div className="flex items-center justify-center gap-2 text-red-500 mb-3">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                重试
              </button>
            </div>
          )}

          {/* Notification items list */}
          {!loading && !error && hasItems && (
            <div
              className="overflow-y-auto"
              style={{ maxHeight: `${MAX_VISIBLE_ITEMS * 72}px` }}
            >
              {items.map((item) => (
                <NotificationItem
                  key={item.id}
                  id={item.id}
                  type={item.type}
                  title={item.title}
                  createdAt={item.created_at}
                  read={item.read}
                  onMarkAsRead={handleMarkAsRead}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && !hasItems && (
            <div
              data-testid="empty-notifications"
              className="px-4 py-6 text-center text-sm text-gray-400"
            >
              暂无通知
            </div>
          )}
        </div>
      )}
    </div>
  );
}
