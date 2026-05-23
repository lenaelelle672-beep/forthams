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
  LogOut,
  TrendingDown,
  MapPin,
  Truck,
  FileText,
  ScrollText,
  Monitor,
  Sparkles,
  Factory,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { NotificationCenter } from "../pages/notifications/NotificationCenter";
import GlobalSearch from "@/components/GlobalSearch";

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
      { name: "科技大屏", href: "/cyber-v12", icon: Sparkles },
      { name: "工业大屏", href: "/industrial-v13", icon: Factory },
      { name: "系统设置", href: "/settings", icon: SettingsIcon },
    ],
  },
];

const SIDEBAR_W = 160;

export function SidebarLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 right-0 z-40 h-11 bg-white border-b border-gray-200/80" style={{ left: SIDEBAR_W }}>
        <div className="flex items-center justify-end h-full px-4">

          <div className="flex items-center gap-2.5">
            <GlobalSearch />
            <NotificationCenter />
            <div className="flex items-center gap-2 pl-2.5 border-l border-gray-200">
              <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center">
                <User className="w-3 h-3 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-600 hidden sm:block">
                {user?.realName ?? user?.username ?? "管理员"}
              </span>
              <Button
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                onClick={logout}
                size="sm"
                variant="ghost"
              >
                <LogOut className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <aside
        className="fixed left-0 top-0 bottom-0 bg-[#0a1628] border-r border-[#1a2d47] overflow-y-auto overflow-x-hidden z-50 flex flex-col"
        style={{ width: SIDEBAR_W }}
      >
        <div className="flex items-center gap-2 h-11 px-3 border-b border-[#1a2d47] flex-shrink-0">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <Package className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-bold text-white tracking-wide">资产管理平台</span>
        </div>

        <nav className="flex-1 py-1.5 px-1.5" role="navigation" aria-label="主导航">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              {group.label && (
                <div className="px-2 pt-3 pb-1">
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end={item.href === "/"}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-colors",
                      isActive
                        ? "bg-blue-600/90 text-white font-medium"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                    ].join(" ")
                  }
                >
                  <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="px-3 py-2 border-t border-[#1a2d47] flex-shrink-0">
          <div className="text-[9px] text-slate-600 text-center">v1.0.0</div>
        </div>
      </aside>

      <main
        className="p-4 lg:p-5 min-h-screen bg-white"
        style={{ marginLeft: SIDEBAR_W, paddingTop: 60 }}
      >
        <Outlet />
      </main>
    </div>
  );
}
