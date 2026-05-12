/**
 * @module frontend/src/app/pages/notifications/NotificationItem
 * @description Renders a single notification item in the notification dropdown list.
 *
 * Displays an icon based on the notification type (work_order, retirement,
 * asset_expiration, maintenance_reminder, system_alert), the item title,
 * a formatted creation timestamp, and a visual read/unread indicator.
 *
 * Supports mark-as-read interaction via onClick handler.
 * Bound to data-testid="notification-item-{id}" for E2E test targeting.
 */

import {
  ClipboardCheck,
  ArchiveRestore,
  Clock,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import type { NotificationType } from "../../services/notificationApi";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for the NotificationItem component. */
interface NotificationItemProps {
  /** Unique identifier of the notification item */
  id: number;
  /** Business type of the notification */
  type: NotificationType;
  /** Display title text */
  title: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Whether this notification has been read */
  read: boolean;
  /** Callback to mark this notification as read */
  onMarkAsRead?: (id: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format an ISO 8601 date string into a human-readable relative/local string.
 *
 * @param isoString - ISO 8601 timestamp
 * @returns formatted date string (e.g. "2025-06-01 10:00")
 */
function formatCreatedAt(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return isoString;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

/**
 * Get the icon component for a given notification type.
 *
 * @param type - notification type
 * @returns React component for the corresponding icon
 */
function getIcon(type: NotificationType) {
  switch (type) {
    case "work_order":
      return ClipboardCheck;
    case "retirement":
      return ArchiveRestore;
    case "asset_expiration":
      return Clock;
    case "maintenance_reminder":
      return Wrench;
    case "system_alert":
      return AlertTriangle;
    default:
      return ClipboardCheck;
  }
}

/**
 * Get the display label for a notification type.
 *
 * @param type - notification type
 * @returns Chinese display label
 */
function getTypeLabel(type: NotificationType): string {
  switch (type) {
    case "work_order":
      return "工单审批";
    case "retirement":
      return "退役审批";
    case "asset_expiration":
      return "资产到期";
    case "maintenance_reminder":
      return "维保提醒";
    case "system_alert":
      return "系统通知";
    default:
      return "通知";
  }
}

/**
 * Get the color classes for the icon background based on notification type.
 *
 * @param type - notification type
 * @returns Tailwind CSS class string for background and text color
 */
function getIconColorClass(type: NotificationType): string {
  switch (type) {
    case "work_order":
      return "bg-blue-100 text-blue-600";
    case "retirement":
      return "bg-orange-100 text-orange-600";
    case "asset_expiration":
      return "bg-yellow-100 text-yellow-600";
    case "maintenance_reminder":
      return "bg-green-100 text-green-600";
    case "system_alert":
      return "bg-red-100 text-red-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a single notification item row with icon, title, type label,
 * timestamp, and read/unread indicator.
 *
 * Clicking the item triggers the onMarkAsRead callback if provided and
 * the item is unread.
 *
 * Bound to `data-testid="notification-item-{id}"` for E2E test selectors.
 *
 * @param props - NotificationItemProps
 * @returns JSX element for the notification item
 */
export function NotificationItem({
  id,
  type,
  title,
  createdAt,
  read,
  onMarkAsRead,
}: NotificationItemProps) {
  const Icon = getIcon(type);
  const typeLabel = getTypeLabel(type);
  const iconColorClass = getIconColorClass(type);

  /**
   * Handle click on the notification item.
   * Triggers mark-as-read if the item is unread and callback is provided.
   */
  const handleClick = () => {
    if (!read && onMarkAsRead) {
      onMarkAsRead(id);
    }
  };

  return (
    <div
      data-testid={`notification-item-${id}`}
      className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 ${
        !read ? "bg-blue-50/40" : ""
      }`}
      onClick={handleClick}
    >
      {/* Unread indicator dot */}
      {!read && (
        <div className="flex-shrink-0 mt-2">
          <span
            data-testid={`unread-dot-${id}`}
            className="block w-2 h-2 rounded-full bg-blue-500"
          />
        </div>
      )}

      {/* Type icon */}
      <div className="flex-shrink-0 mt-0.5">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${iconColorClass}`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">
            {typeLabel}
          </span>
        </div>
        <p
          className={`text-sm truncate mt-0.5 ${
            !read ? "font-semibold text-gray-900" : "font-medium text-gray-700"
          }`}
        >
          {title}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {formatCreatedAt(createdAt)}
        </p>
      </div>
    </div>
  );
}
