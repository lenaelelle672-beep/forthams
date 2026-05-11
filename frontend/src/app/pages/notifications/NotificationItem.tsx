/**
 * @module frontend/src/app/pages/notifications/NotificationItem
 * @description Renders a single notification item in the notification dropdown list.
 *
 * Displays an icon based on the notification type (work_order or retirement),
 * the item title, and a formatted creation timestamp. Bound to
 * data-testid="notification-item-{id}" for E2E test targeting.
 */

import { ClipboardCheck, ArchiveRestore } from "lucide-react";
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
    default:
      return "待办";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a single notification item row with icon, title, type label, and timestamp.
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
}: NotificationItemProps) {
  const Icon = getIcon(type);
  const typeLabel = getTypeLabel(type);

  return (
    <div
      data-testid={`notification-item-${id}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
    >
      <div className="flex-shrink-0 mt-0.5">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            type === "work_order"
              ? "bg-blue-100 text-blue-600"
              : "bg-orange-100 text-orange-600"
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">{typeLabel}</span>
        </div>
        <p className="text-sm font-medium text-gray-900 truncate mt-0.5">
          {title}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {formatCreatedAt(createdAt)}
        </p>
      </div>
    </div>
  );
}
