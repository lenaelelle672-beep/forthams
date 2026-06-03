/**
 * @file layouts/AppLayout.tsx
 * @description 主应用布局 — 侧边栏 + 顶栏 + 内容区
 *
 * UI 打磨：侧边栏增加品牌色渐变背景、菜单项 hover 添加磁性吸附效果提示
 */

import { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '@/app/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import http from '@/utils/http';
import {
  LayoutDashboard,
  Package,
  Cpu,
  ScanLine,
  CheckSquare,
  Recycle,
  BarChart3,
  Settings,
  Bell,
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
  MonitorDot,
  Monitor,
  FileBarChart,
  FolderTree,
  Wrench,
  Calendar,
  Sun,
  Moon,
} from 'lucide-react';

import GlobalSearch from '@/components/GlobalSearch';
import { SpatialTimeProvider } from '@/components/shared/SpatialTimeContext';
import { useTheme } from '@/hooks/useTheme';

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
      { path: '/asset-models', label: '资产型号', icon: Package },
      { path: '/equipment',    label: '重要设备', icon: Cpu },
      { path: '/idle',         label: '闲置资产', icon: Warehouse },
      { path: '/depreciation', label: '折旧管理', icon: TrendingDown },
    ],
  },
  {
    group: '运营管理',
    items: [
      { path: '/inventory',         label: 'RFID 盘点', icon: ScanLine },
      { path: '/maintenance',       label: '维保记录', icon: Wrench },
      { path: '/maintenance/plans', label: '维保计划', icon: Calendar },
      { path: '/approvals',         label: '审批流程', icon: CheckSquare },
      { path: '/workflows',         label: '工作流',   icon: Workflow },
    ],
  },
  {
    group: '采购与合同',
    items: [
      { path: '/purchase-orders', label: '采购订单', icon: Handshake },
      { path: '/contracts',       label: '合同管理', icon: FileText },
    ],
  },
  {
    group: '空间与能耗',
    items: [
      { path: '/gis',        label: 'GIS 地图', icon: MapPin },
      { path: '/floorplans', label: '楼层平面图', icon: Monitor },
      { path: '/energy',     label: '能耗管理', icon: Cpu },
    ],
  },
  {
    group: '软件与合规',
    items: [
      { path: '/licenses', label: '软件许可证', icon: Shield },
      { path: '/sam',      label: 'SAM 合规', icon: Shield },
    ],
  },
  {
    group: '退役与处置',
    items: [
      { path: '/disposals',  label: '资产处置', icon: Recycle },
    ],
  },
  {
    group: '报表',
    items: [
      { path: '/reports', label: '报表中心', icon: FileBarChart },
    ],
  },
  {
    group: '监控与审计',
    items: [
      { path: '/audit', label: '审计日志', icon: FileText },
    ],
  },
];

const SYSTEM_NAV_ITEMS: NavItem[] = [
  { path: '/system/users', label: '用户管理', icon: Users },
  { path: '/system/roles', label: '角色管理', icon: Shield },
  { path: '/system/menus', label: '菜单管理', icon: FolderTree },
  { path: '/system/depts', label: '部门管理', icon: MapPin },
  { path: '/system/posts', label: '岗位管理', icon: Workflow },
  { path: '/system/custom-fields', label: '自定义字段', icon: Settings },
  { path: '/system/custom-fieldsets', label: '字段集', icon: FolderTree },
  { path: '/settings/sysconfig', label: '参数配置', icon: Settings },
];

const NAV_BOTTOM_ITEMS: NavItem[] = [
  { path: '/categories', label: '资产分类', icon: FolderTree },
  { path: '/manufacturers', label: '制造商', icon: Cpu },
  { path: '/vendors',   label: '供应商',  icon: Users },
  { path: '/locations', label: '位置管理', icon: MapPin },
];

// ── 主布局组件 ────────────────────────────────────────────────────────────────
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const { hasRole, user } = useAuth();

  // 大屏导航——仅 ADMIN 或 SUPER_ADMIN 角色可见
  const navGroups = useMemo(() => {
    const groups = [...NAV_GROUPS];
    if (hasRole('ADMIN') || hasRole('SUPER_ADMIN')) {
      groups.push({
        group: '系统管理',
        items: SYSTEM_NAV_ITEMS,
      });
      groups.push({
        group: '大屏',
        items: [
          { path: '/bigscreen',    label: '态势大屏', icon: MonitorDot },
          { path: '/bigscreen-3d', label: '3D 大屏',  icon: Monitor },
        ],
      });
    }
    return groups;
  }, [hasRole]);

  // ── 认证守卫：无 token 时重定向登录页 ──────────────────────────────────
  useEffect(() => {
    if (!user && !sessionStorage.getItem('auth_token') && !localStorage.getItem('auth_token')) {
      navigate('/login', { replace: true });
    }
  }, [navigate, user]);

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

  const { isDark, toggleDarkMode } = useTheme();

  const handleLogout = () => {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_info');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    localStorage.removeItem('ams_auth_token');
    localStorage.removeItem('ams_auth_user');
    navigate('/login');
  };

  const userInfo = {
    realName: user?.realName,
    username: user?.username,
    roles: user?.roles,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.08),transparent_30%),var(--app-background)]">
      {/* ── 侧边栏：品牌色渐变背景 ── */}
      <aside
        className="relative flex h-full flex-none flex-col border-r border-white/10 shadow-[18px_0_50px_rgba(15,23,42,0.18)] transition-all duration-200"
        style={{
          width: sidebarWidth,
          background: 'linear-gradient(180deg, #071426 0%, #0f2147 44%, #08111f 100%)',
        }}
      >
        {/* Logo 区 */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-[#1a2d47] flex-shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#6366f1] flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-500/30">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-base tracking-tight truncate">
                资产管理系统
              </span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#6366f1] flex items-center justify-center mx-auto shadow-sm shadow-blue-500/30">
              <Shield className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* 导航主区 */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 [scrollbar-width:thin]">
          {navGroups.map((group) => (
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
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#94a3b8] transition hover:bg-white/[0.08] hover:text-white hover:shadow-inner hover:translate-x-0.5 motion-reduce:hover:translate-x-0"
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
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
                        isActive
                          ? 'bg-gradient-to-r from-white/[0.15] to-white/[0.05] text-white ring-1 ring-white/[0.15] shadow-inner shadow-black/10'
                          : 'text-[#94a3b8] hover:bg-white/[0.08] hover:text-white hover:translate-x-0.5 motion-reduce:hover:translate-x-0'
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
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium ${
                  isActive
                    ? 'bg-gradient-to-r from-white/[0.15] to-white/[0.05] text-white ring-1 ring-white/[0.15] shadow-inner shadow-black/10'
                    : 'text-[#94a3b8] hover:bg-white/[0.08] hover:text-white hover:translate-x-0.5 motion-reduce:hover:translate-x-0'
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1d4ed8] to-[#6366f1] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
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
        <header className="z-10 flex h-16 flex-none items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface-card-glass)] px-6 shadow-[var(--shadow-card)] backdrop-blur-xl">
          {/* 左：搜索 */}
          <div className="flex items-center gap-3">
            <GlobalSearch />
          </div>

          {/* 右：主题切换 + 通知 + 用户 */}
          <div className="flex items-center gap-3">
            {/* 深色模式切换按钮 */}
            <button
              onClick={toggleDarkMode}
              aria-label={isDark ? '切换到亮色模式' : '切换到深色模式'}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
              title={isDark ? '切换到亮色模式' : '切换到深色模式'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <NavLink
              to="/notifications"
              aria-label="查看通知"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>

            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#1d4ed8] to-[#6366f1] text-xs font-semibold text-white shadow-sm shadow-blue-500/30 ring-2 ring-white"
              title={userInfo.realName || '用户'}
            >
              {(userInfo.realName || userInfo.username || 'A')[0].toUpperCase()}
            </button>
          </div>
        </header>

        {/* 内容区 */}
        <main className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.06),transparent_28%),linear-gradient(180deg,var(--app-background-soft),var(--app-background))]">
          <div className="h-full overflow-y-auto p-4 md:p-6 [scrollbar-width:thin]" id="main-scroll-container">
            <SpatialTimeProvider>
              <Outlet />
            </SpatialTimeProvider>
          </div>
        </main>
      </div>
    </div>
  );
}
