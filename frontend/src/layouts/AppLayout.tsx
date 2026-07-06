/**
 * @file layouts/AppLayout.tsx
 * @description 主应用布局 — 侧边栏 + 顶栏 + 内容区
 *
 * UI 打磨：侧边栏增加品牌色渐变背景、菜单项 hover 添加磁性吸附效果提示
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getUnreadCount } from '@/api/notification';
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
  ChevronDown,
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
  User,
  Activity,
  HelpCircle,
} from 'lucide-react';

import { SpatialTimeProvider } from '@/components/shared/SpatialTimeContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { canAccessRoute } from '@/utils/routePermissions';

type NavItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  permissionPath?: string;
  activePrefix?: string;
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
      { path: '/fixed-assets/workbench?menu=home', label: '资产运营中枢', icon: Shield },
      { path: '/dashboard', label: '旧版仪表板', icon: LayoutDashboard },
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
      { path: '/workflows-v2',      label: '流程定义 2', icon: Workflow, permissionPath: '/workflows' },
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
  {
    path: '/settings',
    label: '后台设置 OS',
    icon: Settings,
    permissionPath: '/settings/sysconfig',
    activePrefix: '/settings',
  },
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
  const location = useLocation();

  const { hasRole, user } = useAuth();

  // 大屏导航——仅 ADMIN 或 SUPER_ADMIN 角色可见
  const navGroups = useMemo(() => {
    const groups = NAV_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccessRoute(item.permissionPath ?? item.path, user)),
      }))
      .filter((group) => group.items.length > 0);
    const hasAdminRole = hasRole('ADMIN') || hasRole('SUPER_ADMIN');
    const hasRoleMetadata = Boolean(user?.roles && user.roles.length > 0);
    if (hasAdminRole) {
      const systemItems = SYSTEM_NAV_ITEMS.filter((item) => canAccessRoute(item.permissionPath ?? item.path, user));
      groups.push({
        group: '系统管理',
        items: systemItems,
      });
    }
    if (hasAdminRole || !hasRoleMetadata) {
      groups.push({
        group: '大屏',
        items: [
          { path: '/bigscreen',    label: '态势大屏', icon: MonitorDot },
          { path: '/bigscreen-3d', label: '3D 大屏',  icon: Monitor },
        ],
      });
    }
    return groups;
  }, [hasRole, user]);

  const bottomItems = useMemo(
    () => NAV_BOTTOM_ITEMS.filter((item) => canAccessRoute(item.permissionPath ?? item.path, user)),
    [user],
  );

  // ── 认证守卫：无 token 时重定向登录页 ──────────────────────────────────
  useEffect(() => {
    if (!user && !sessionStorage.getItem('auth_token') && !localStorage.getItem('auth_token')) {
      navigate('/login', { replace: true });
    }
  }, [navigate, user]);

  // 未读通知数
  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 60_000,
    retry: false,
  });

  const sidebarWidth = collapsed ? 64 : 240;

  // 主题切换由 ThemeToggle 组件内部处理

  const handleLogout = () => {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_info');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    localStorage.removeItem('ams_auth_token');
    localStorage.removeItem('ams_auth_user');
    navigate('/login');
  };

  // ── 右上角用户下拉菜单 ────────────────────────────────────────────────
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

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
                const activeByPrefix = item.activePrefix
                  ? location.pathname.startsWith(item.activePrefix)
                  : false;
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
                        isActive || activeByPrefix
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

          {bottomItems.map(({ path, label, icon: Icon }) => (
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

        {/* 底部系统信息 */}
        <div className="flex-shrink-0 border-t border-[#1a2d47] px-3 py-2.5">
          {!collapsed ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs text-[#64748b]">系统运行正常</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://portal.uniview.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#64748b] hover:text-[#94a3b8] transition-colors"
                  title="帮助文档"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </a>
                <span className="text-[10px] text-[#475569] font-mono">v1.0</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[9px] text-[#475569] font-mono">v1.0</span>
            </div>
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
        <header
          className="z-10 flex h-16 flex-none items-center justify-end border-b border-[var(--surface-border)] bg-[var(--surface-card-glass)] px-6 shadow-[var(--shadow-card)] backdrop-blur-xl"
        >
          {/* 右：主题切换 + 通知 + 用户 */}
          <div className="flex items-center gap-3">
            {/* 深色模式切换按钮（三态：light → dark → system） */}
            <ThemeToggle />

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

            {/* 用户下拉菜单 */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2.5 transition hover:bg-slate-100"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#1d4ed8] to-[#6366f1] text-xs font-semibold text-white shadow-sm shadow-blue-500/30 ring-2 ring-white">
                  {(userInfo.realName || userInfo.username || 'A')[0].toUpperCase()}
                </span>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-slate-800 leading-tight">
                    {userInfo.realName || userInfo.username || '系统管理员'}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {userInfo.roles?.[0] || '管理员'}
                  </p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 z-50 overflow-hidden">
                  {/* 用户信息头 */}
                  <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1d4ed8] to-[#6366f1] text-sm font-bold text-white flex-shrink-0">
                        {(userInfo.realName || userInfo.username || 'A')[0].toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {userInfo.realName || userInfo.username || '系统管理员'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {userInfo.roles?.[0] || '管理员'}
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* 菜单项 */}
                  <div className="py-1">
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      个人信息
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      后台设置 OS
                    </button>
                  </div>
                  {/* 退出 */}
                  <div className="border-t border-slate-100 py-1">
                    <button
                      onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>
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
