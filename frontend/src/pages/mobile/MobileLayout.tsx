/**
 * @file pages/mobile/MobileLayout.tsx
 * @description 移动端布局 — 顶部状态栏 + 底部 Tab 导航 + 内容区
 *
 * 设计：
 * - 固定底部导航栏（首页/资产/扫码/我的）
 * - 顶部状态栏显示标题和通知
 * - 移动优先，触摸友好
 */

import { Outlet, NavLink, useNavigate, useLocation } from 'react-router';
import { useAuth } from '@/app/context/AuthContext';
import {
  LayoutDashboard,
  Package,
  ScanLine,
  User,
  Bell,
  LogOut,
} from 'lucide-react';

const TABS = [
  { path: '/m', icon: LayoutDashboard, label: '首页' },
  { path: '/m/assets', icon: Package, label: '资产' },
  { path: '/m/scan', icon: ScanLine, label: '扫码' },
  { path: '/m/profile', icon: User, label: '我的' },
];

export default function MobileLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const getTitle = () => {
    const path = location.pathname;
    if (path === '/m' || path === '/m/') return '资产管理系统';
    if (path.startsWith('/m/assets')) return '资产列表';
    if (path.startsWith('/m/scan')) return '扫码查询';
    if (path.startsWith('/m/profile')) return '个人中心';
    return '资产管理系统';
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      maxWidth: '100vw',
      background: 'linear-gradient(180deg, #eef4ff 0%, #f8fafc 42%, #ffffff 100%)',
      overflow: 'hidden',
    }}>
      {/* 顶部导航栏 */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        background: 'linear-gradient(135deg, #071225 0%, #0f2a4a 100%)',
        color: '#fff',
        minHeight: '54px',
        boxShadow: '0 10px 28px rgba(15, 23, 42, 0.18)',
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
          {getTitle()}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/m/notifications')}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="通知"
          >
            <Bell size={20} />
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="退出"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '14px 12px',
      }}>
        <Outlet />
      </main>

      {/* 底部导航栏 */}
      <nav style={{
        display: 'flex',
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderTop: '1px solid rgba(226,232,240,0.9)',
        boxShadow: '0 -12px 30px rgba(15,23,42,0.08)',
        backdropFilter: 'blur(16px)',
        flexShrink: 0,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {TABS.map((tab) => {
          const isActive = location.pathname === tab.path ||
            (tab.path !== '/m' && location.pathname.startsWith(tab.path));
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 0 7px',
                textDecoration: 'none',
                color: isActive ? '#004191' : '#64748b',
                fontSize: '11px',
                gap: '3px',
                transition: 'color 0.15s, transform 0.15s',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              <tab.icon size={22} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
