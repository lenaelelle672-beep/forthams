/**
 * @module frontend/src/app/pages/notifications/NotificationFilterBar
 * @description Filter bar for the notification center dropdown.
 *
 * Renders a horizontal row of filter buttons allowing the user to
 * filter notifications by type (all, work_order, retirement,
 * asset_expiration, maintenance_reminder, system_alert).
 *
 * Bound to data-testid="notification-filter-bar" for E2E test targeting.
 * Each filter button uses data-testid="filter-btn-{type}" for granular selection.
 */

import type { NotificationType } from "../../services/notificationApi";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for the NotificationFilterBar component. */
interface NotificationFilterBarProps {
  /** Currently active filter type, or "all" for no filter */
  activeFilter: NotificationType | "all";
  /** Callback invoked when the user selects a different filter */
  onFilterChange: (filter: NotificationType | "all") => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Filter option definitions with display labels.
 * The "all" option shows every notification regardless of type.
 */
const FILTER_OPTIONS: Array<{
  value: NotificationType | "all";
  label: string;
}> = [
  { value: "all", label: "全部" },
  { value: "work_order", label: "工单审批" },
  { value: "retirement", label: "退役审批" },
  { value: "asset_expiration", label: "资产到期" },
  { value: "maintenance_reminder", label: "维保提醒" },
  { value: "system_alert", label: "系统通知" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a horizontal filter bar with pill-shaped buttons for each
 * notification type. The active filter is visually highlighted.
 *
 * @param props - NotificationFilterBarProps
 * @returns JSX element for the filter bar
 */
export function NotificationFilterBar({
  activeFilter,
  onFilterChange,
}: NotificationFilterBarProps) {
  return (
    <div
      data-testid="notification-filter-bar"
      className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 overflow-x-auto"
    >
      {FILTER_OPTIONS.map((option) => {
        const isActive = activeFilter === option.value;

        return (
          <button
            key={option.value}
            type="button"
            data-testid={`filter-btn-${option.value}`}
            onClick={() => onFilterChange(option.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-gray-500 hover:bg-blue-50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
