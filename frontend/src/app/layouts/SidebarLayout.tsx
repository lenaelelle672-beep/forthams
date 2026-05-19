/**
 * @module frontend/src/app/layouts/SidebarLayout
 * @description Main application layout with sidebar navigation and top header bar.
 *
 * Integrates the NotificationCenter component into the header area,
 * providing the notification bell icon (data-testid="notification-bell")
 * and unread badge (data-testid="unread-badge") in the fixed top bar.
 *
 * Layout structure:
 * - Fixed header (top, full width, z-40) with logo, search, NotificationCenter, user info
 * - Fixed sidebar (left, below header) with grouped navigation links
 * - Mobile overlay + hamburger menu for responsive layout
 * - Main content area (offset by sidebar width and header height) renders <Outlet />
 *
 * CLS prevention: NotificationCenter uses position:relative/absolute isolation;
 * the main content area's bounding box is unaffected by notification dropdown toggling.
 *
 * @see frontend/src/app/pages/notifications/NotificationCenter.tsx
 * @see frontend/src/app/components/RootLayout.tsx
 */

import { Outlet, NavLink, useNavigate } from "react-router";
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
  User,
  Search,
  LogOut,
  TrendingDown,
  MapPin,
  Truck,
  FileText,
  ScrollText,
  Menu,
  X,
  Monitor,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { NotificationCenter } from "../pages/notifications/NotificationCenter";

// ---------------------------------------------------------------------------
// Navigation configuration — grouped by functional area
// ---------------------------------------------------------------------------

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { name: "仪表板", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "资产管理",
    items: [
      { name: "资产台账", href: "/assets", icon: Package },
      { name: "重要设备", href: "/equipment", icon: Wrench },
      { name: "RFID盘点", href: "/inventory", icon: Radio },
      { name: "闲置资产", href: "/idle", icon: Archive },
    ],
  },
  {
    label: "业务流程",
    items: [
      { name: "资产处置", href: "/disposals", icon: DollarSign },
      { name: "审批流程", href: "/approval", icon: ClipboardCheck },
      { name: "折旧管理", href: "/depreciation", icon: TrendingDown },
      { name: "工单管理", href: "/workorders", icon: FileText },
    ],
  },
  {
    label: "资源管理",
    items: [
      { name: "供应商管理", href: "/vendors", icon: Truck },
      { name: "位置管理", href: "/locations", icon: MapPin },
    ],
  },
  {
    label: "系统",
    items: [
      { name: "审计日志", href: "/audit", icon: ScrollText },
      { name: "流程管理", href: "/workflows", icon: Workflow },
      { name: "数据分析", href: "/analytics", icon: BarChart3 },
      { name: "资产大屏", href: "/situation", icon: Monitor },
      { name: "系统设置", href: "/settings", icon: SettingsIcon },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SidebarLayout provides the full application shell with:
 * - A fixed top header bar containing the app logo, global search,
 *   NotificationCenter bell component, and user profile/logout
 * - A fixed left sidebar with grouped navigation links
 * - Mobile hamburger menu with overlay for responsive layout
 * - A main content area rendering the matched route via <Outlet />
 *
 * @returns JSX element for the complete application layout
 */
export function SidebarLayout() {
  const [searchQuery, setSearchQuery] = useState("");
  const [headerMessage, setHeaderMessage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleGlobalSearch = (event: FormEvent) => {
    event.preventDefault();
    const keyword = searchQuery.trim();
    if (!keyword) {
      setHeaderMessage("请输入资产名称或编号后再搜索");
      return;
    }
    setHeaderMessage(`正在搜索"${keyword}"`);
    navigate(`/assets?keyword=${encodeURIComponent(keyword)}`);
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ====== Top Header Bar ====== */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40 shadow-sm">
        <div className="flex items-center justify-between h-16 px-4 lg:px-6">
          {/* Left: Mobile menu toggle + Logo */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              aria-label={isSidebarOpen ? "关闭导航" : "打开导航"}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen
                ? <X className="w-5 h-5" />
                : <Menu className="w-5 h-5" />}
            </button>

            {/* Logo + title */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-semibold text-gray-900 hidden sm:block">
                企业资产管理系统
              </span>
              <span className="text-base font-semibold text-gray-900 sm:hidden">
                forthAMS
              </span>
            </div>
          </div>

          {/* Right: Search, Notification, User */}
          <div className="flex items-center gap-3">
            {/* Global search — hidden on xs */}
            <form className="relative hidden md:block" onSubmit={handleGlobalSearch}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索资产..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 lg:w-64 pl-9 pr-4 h-9 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </form>

            {/* Notification Center */}
            <NotificationCenter />

            {/* User profile & Logout */}
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-sm hidden sm:block">
                <div className="font-medium text-gray-900 leading-tight">
                  {user?.realName ?? user?.username ?? "管理员"}
                </div>
                <div className="text-gray-400 text-xs leading-tight">{user?.username ?? "admin"}</div>
              </div>
              <Button
                className="h-8 px-2 text-gray-500 hover:text-gray-700"
                onClick={logout}
                size="sm"
                variant="ghost"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">退出</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Header message toast */}
      {headerMessage && (
        <div className="fixed top-[4.5rem] right-4 z-50 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700 shadow-md">
          {headerMessage}
        </div>
      )}

      {/* ====== Mobile overlay ====== */}
      {isSidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ====== Left Sidebar ====== */}
      <aside
        className={[
          "fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto z-40",
          "transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <nav className="p-3 space-y-1" role="navigation" aria-label="主导航">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              {/* Group label */}
              {group.label && (
                <div className="px-3 pt-4 pb-1.5 first:pt-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
              )}

              {/* Nav items */}
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end={item.href === "/"}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    ].join(" ")
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* ====== Main Content Area ====== */}
      <main className="lg:ml-64 mt-16 p-4 lg:p-6 min-h-[calc(100vh-4rem)]">
        <Outlet />
      </main>
    </div>
  );
}
