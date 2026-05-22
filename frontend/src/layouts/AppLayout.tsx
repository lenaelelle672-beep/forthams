/**
 * @file layouts/AppLayout.tsx
 * @description 主应用布局 — 侧边栏 + 顶栏 + 内容区
 *
 * 严格遵循 forthAMS Design System：
 * - 侧边栏：240px, #0a1628 深海蓝，白色文字
 * - 顶栏：64px，白色，底部边框 #e5e7eb
 * - 内容区：#f8fafc 背景，24px padding
 */

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import http from '@/utils/http';
import {
  LayoutDashboard,
  Package,
  Cpu,
  ScanLine,
  ClipboardList,
  CheckSquare,
  Recycle,
  BarChart3,
  Settings,
  Bell,
  Search,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Warehouse,
  AlertTriangle,
  FileText,
  Users,
  MapPin,
  Workflow,
  TrendingDown,
  Handshake,
  Archive,
  MonitorDot,
  Monitor,
  BoxesIcon,
} from 'lucide-react';

type NavItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
};

type NavGroup = {
  group: string;
  items: NavItem[];
};

// ── 导航菜单分组配置 ──────────────────────────────────────────────────────────
const NAV_GROUPS: NavGroup[] = [
  {
    group: '概览',
    items: [
      { path: '/dashboard', label: '仪表板', icon: LayoutDashboard },
      { path: '/analytics', label: '数据分析', icon: BarChart3 },
    ],
  },
  {
    group: '资产管理',
    items: [
      { path: '/assets',       label: '资产台账', icon: Package },
      { path: '/equipment',    label: '重要设备', icon: Cpu },
      { path: '/idle',         label: '闲置资产', icon: Warehouse },
      { path: '/depreciation', label: '折旧管理', icon: TrendingDown },
    ],
  },
  {
    group: '运营管理',
    items: [
      { path: '/inventory',  label: 'RFID 盘点', icon: ScanLine },
      { path: '/workorders', label: '工单管理', icon: ClipboardList },
      { path: '/approvals',  label: '审批流程', icon: CheckSquare },
      { path: '/workflows',  label: '工作流',   icon: Workflow },
    ],
  },
  {
    group: '退役与处置',
    items: [
      { path: '/retirement',   label: '退役管理', icon: Archive },
      { path: '/disposals',    label: '资产处置', icon: Recycle },
      { path: '/compensation', label: '赔偿管理', icon: Handshake },
    ],
  },
  {
    group: '监控与审计',
    items: [
      { path: '/audit', label: '审计日志', icon: FileText },
    ],
  },
  {
    group: '大屏',
    items: [
      { path: '/bigscreen',   label: '态势大屏',   icon: MonitorDot, external: true },
      { path: '/bigscreen-3d', label: '3D 大屏', icon: Monitor, external: true },
    ],
  },
];

const NAV_BOTTOM_ITEMS: NavItem[] = [
  { path: '/vendors',   label: '供应商',  icon: Users },
  { path: '/locations', label: '位置管理', icon: MapPin },
  { path: '/settings',  label: '系统设置', icon: Settings },
];

// ── 主布局组件 ────────────────────────────────────────────────────────────────
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  // 未读通知数
  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await http.get<any>('/notifications/unread-count');
      return res?.data?.count ?? res?.count ?? 0;
    },
    refetchInterval: 60_000,
    retry: false,
  });

  const sidebarWidth = collapsed ? 64 : 240;

  const handleLogout = () => {
    // 清除所有可能的认证 key（兼容新旧两套存储）
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_info');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    localStorage.removeItem('ams_auth_token');
    localStorage.removeItem('ams_auth_user');
    navigate('/login');
  };

  const userInfo = (() => {
    try {
      // 优先读 sessionStorage，fallback 到 localStorage
      const raw =
        sessionStorage.getItem('user_info') ||
        localStorage.getItem('ams_auth_user') ||
        localStorage.getItem('user_info') ||
        '{}';
      return JSON.parse(raw);
    } catch {
      return {};
    }
  })();

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      {/* ── 侧边栏 ──────────────────────────────────────────────────────────── */}
      <aside
        className="relative flex-none flex flex-col h-full transition-all duration-200"
        style={{
          width: sidebarWidth,
          backgroundColor: '#0a1628',
        }}
      >
        {/* Logo 区 */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-[#1a2d47] flex-shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-base tracking-tight truncate">
                资产管理系统
              </span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center mx-auto">
              <Shield className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* 导航主区 */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.group} className="mb-2">
              {!collapsed && (
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#4a5568]">
                  {group.group}
                </div>
              )}
              {collapsed && (
                <div className="mx-auto my-1 h-px bg-[#1a2d47]" />
              )}
              {group.items.map((item) => {
                const { path, label, icon: Icon } = item;
                if (item.external) {
                  return (
                    <a
                      key={path}
                      href={path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium text-[#94a3b8] hover:bg-[#1a2d47] hover:text-white"
                      title={collapsed ? label : undefined}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                      {!collapsed && <span className="ml-auto text-[10px] opacity-40">↗</span>}
                    </a>
                  );
                }
                return (
                  <NavLink
                    key={path}
                    to={path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                        isActive
                          ? 'bg-[#1e3a5f] text-white border-l-2 border-blue-400 pl-[10px]'
                          : 'text-[#94a3b8] hover:bg-[#1a2d47] hover:text-white'
                      }`
                    }
                    title={collapsed ? label : undefined}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}

          {/* 分隔线 */}
          <div className="border-t border-[#1a2d47] my-3 mx-1" />

          {NAV_BOTTOM_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                  isActive
                    ? 'bg-[#1e3a5f] text-white border-l-2 border-blue-400 pl-[10px]'
                    : 'text-[#94a3b8] hover:bg-[#1a2d47] hover:text-white'
                }`
              }
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* 底部用户区 */}
        <div className="flex-shrink-0 border-t border-[#1a2d47] p-3">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {(userInfo.realName || userInfo.username || 'A')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {userInfo.realName || userInfo.username || '系统管理员'}
                </p>
                <p className="text-[#64748b] text-xs truncate">
                  {userInfo.roles?.[0] || 'SUPER_ADMIN'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-[#64748b] hover:text-white transition-colors"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex justify-center text-[#64748b] hover:text-white transition-colors py-1"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 折叠按钮 */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute flex items-center justify-center w-5 h-10 bg-[#1a2d47] rounded-r-md text-[#64748b] hover:text-white transition-colors"
          style={{ left: sidebarWidth, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* ── 右侧主区 ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 顶栏 */}
        <header className="flex-none flex items-center justify-between h-16 px-6 bg-white border-b border-[#e5e7eb] z-10">
          {/* 左：搜索 */}
          <div className="flex items-center gap-4">
            <div className="relative hidden md:flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索资产、工单..."
                className="h-8 pl-9 pr-4 w-56 text-sm bg-[#f8fafc] border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* 右：通知 + 用户 */}
          <div className="flex items-center gap-3">
            <NavLink
              to="/notifications"
              className="relative w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>

            <button
              className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold"
              title={userInfo.realName || '用户'}
            >
              {(userInfo.realName || userInfo.username || 'A')[0].toUpperCase()}
            </button>
          </div>
        </header>

        {/* 内容区 */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-6" id="main-scroll-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
