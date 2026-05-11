/**
 * @module frontend/src/app/pages/notifications/NotificationCenter
 * @description Notification center dropdown component.
 *
 * Features:
 * - Bell icon button (data-testid="notification-bell") with unread badge
 *   (data-testid="unread-badge")
 * - Dropdown panel (data-testid="notification-dropdown") that toggles on click
 * - List of NotificationItem components (data-testid="notification-item-{id}")
 * - Empty state (data-testid="empty-notifications") when no pending items
 * - Scrollable list with max-height to handle overflow (>20 items)
 * - Uses position:absolute to avoid layout shift (CLS prevention)
 *
 * @see frontend/src/app/services/notificationApi.ts
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell } from "lucide-react";
import {
  fetchPendingNotifications,
  fetchUnreadCount,
} from "../../services/notificationApi";
import type { NotificationItem as NotificationItemType } from "../../services/notificationApi";
import { NotificationItem } from "./NotificationItem";

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
 * dropdown panel listing pending work order and retirement approvals.
 *
 * The unread count is polled every 15 seconds via a lightweight endpoint.
 * The full item list is fetched on-demand when the dropdown is opened.
 *
 * Layout isolation: The dropdown uses position:absolute to prevent CLS.
 * Unmount cleanup clears the polling interval.
 *
 * @returns JSX element for the notification center
 */
export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(-1); // -1 = not loaded
  const [items, setItems] = useState<NotificationItemType[]>([]);
  const [loading, setLoading] = useState(false);
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
   * Called when the dropdown is opened.
   */
  const refreshItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchPendingNotifications();
      setItems(response.items ?? []);
      setUnreadCount(response.unread_count ?? 0);
    } catch {
      // On error, keep existing items or show empty
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  /** Compute badge display text, capping at "99+" for large counts. */
  const badgeText =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : "";

  /** Whether the badge should be visible. */
  const badgeVisible = unreadCount > 0;

  /** Whether the list has items to display. */
  const hasItems = items.length > 0;

  return (
    <div ref={containerRef} className="relative">
      {/* Bell icon button */}
      <button
        type="button"
        data-testid="notification-bell"
        onClick={handleToggle}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="查看通知"
      >
        <Bell className="w-5 h-5 text-gray-600" />
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">
              待办通知
            </span>
            {badgeVisible && (
              <span className="text-xs text-gray-400">
                {unreadCount} 条未读
              </span>
            )}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              加载中...
            </div>
          )}

          {/* Notification items list */}
          {!loading && hasItems && (
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
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && !hasItems && (
            <div
              data-testid="empty-notifications"
              className="px-4 py-6 text-center text-sm text-gray-400"
            >
              暂无待办通知
            </div>
          )}
        </div>
      )}
    </div>
  );
}
