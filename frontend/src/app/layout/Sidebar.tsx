import { NavLink } from "react-router";
import {
  LayoutDashboard,
  Package,
  Wrench,
  Radio,
  Archive,
  DollarSign,
  ClipboardCheck,
  Workflow,
  BarChart3,
  Settings as SettingsIcon,
  TrendingDown,
  MapPin,
  Truck,
  FileText,
  ScrollText,
  TestTube,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { approvalService } from "../services/approvalService";

/** Navigation item configuration */
interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { name: "仪表板", href: "/", icon: LayoutDashboard },
  { name: "资产台账", href: "/assets", icon: Package },
  { name: "重要设备", href: "/equipment", icon: Wrench },
  { name: "RFID盘点", href: "/inventory", icon: Radio },
  { name: "闲置资产", href: "/idle", icon: Archive },
  { name: "资产处置", href: "/disposals", icon: DollarSign },
  { name: "审批流程", href: "/approval", icon: ClipboardCheck },
  { name: "折旧管理", href: "/depreciation", icon: TrendingDown },
  { name: "工单管理", href: "/workorders", icon: FileText },
  { name: "供应商管理", href: "/vendors", icon: Truck },
  { name: "位置管理", href: "/locations", icon: MapPin },
  { name: "审计日志", href: "/audit", icon: ScrollText },
  { name: "流程管理", href: "/workflows", icon: Workflow },
  { name: "数据分析", href: "/analytics", icon: BarChart3 },
  { name: "测试结果", href: "/test-results", icon: TestTube },
  { name: "系统设置", href: "/settings", icon: SettingsIcon },
];

/** Polling interval for pending approval count (30 seconds) */
const POLL_INTERVAL_MS = 30000;

/**
 * Sidebar component with navigation links and pending approval count badge.
 *
 * Fetches the current user's pending approval count via polling every 30 seconds.
 * Displays a badge next to the "审批流程" nav item when count > 0.
 * On error, silently degrades (hides badge) without showing global error toasts.
 */
export function Sidebar() {
  /**
   * -1 = not yet loaded (badge hidden)
   *  0 = loaded but no pending approvals (badge hidden via style)
   * >0 = pending count (badge visible)
   */
  const [pendingCount, setPendingCount] = useState(-1);

  /** Fetches the pending approval count from the backend API. */
  const fetchPendingCount = useCallback(async () => {
    try {
      const count = await approvalService.getPendingCount();
      setPendingCount(typeof count === "number" ? count : 0);
    } catch {
      // Silent degradation: reset to 0 to hide the badge on error
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    // Fetch immediately on mount
    fetchPendingCount();

    // Set up 30-second polling interval
    const intervalId = setInterval(fetchPendingCount, POLL_INTERVAL_MS);

    // Cleanup on unmount to prevent memory leaks
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchPendingCount]);

  /** Computes badge display text, capping at "99+" for large counts. */
  const badgeText =
    pendingCount > 99 ? "99+" : pendingCount > 0 ? String(pendingCount) : "";

  /** Whether the badge should be visible. */
  const badgeVisible = pendingCount > 0;

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <nav className="p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.name}</span>
            {/* Pending approval count badge — always mounted to prevent layout shift */}
            {item.href === "/approval" && (
              <span
                className="approval-badge ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold leading-none"
                style={{
                  backgroundColor: "#ef4444",
                  color: "#fff",
                  display: badgeVisible ? "inline-flex" : "none",
                }}
              >
                {badgeText}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
