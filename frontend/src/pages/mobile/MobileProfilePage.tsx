/**
 * @file pages/mobile/MobileProfilePage.tsx
 * @description 移动端「我的」页面 — 用户信息 + 退出登录
 *
 * 设计：
 * - 头像 + 姓名 + 角色 + 租户信息展示
 * - 退出登录按钮
 * - 移动端内联样式风格，与 MobileDashboardPage 保持一致
 */

import { useNavigate } from 'react-router';
import { useAuth } from '@/app/context/AuthContext';
import { PageTransition } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  User,
  Shield,
  Building2,
  Mail,
  LogOut,
  ChevronRight,
} from 'lucide-react';

/* ── 页面组件 ──────────────────────────────────────────────────────────────── */
function MobileProfileContent() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const displayName = user?.realName || user?.username || '未知用户';
  const roleLabel = user?.roles?.length ? user.roles.join(', ') : '普通用户';
  const tenantName = (user as any)?.tenantName || '默认租户';
  const email = (user as any)?.email || '';
  const avatarChar = displayName.charAt(0).toUpperCase();

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '12px' }}>
        {/* 用户信息卡片 */}
        <div style={{
          background: 'linear-gradient(135deg, #071225 0%, #0f2a4a 100%)',
          borderRadius: '18px',
          padding: '28px 20px 24px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(15,23,42,0.15)',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #0f766e)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            fontWeight: 700,
            margin: '0 auto 12px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          }}>
            {avatarChar}
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            {displayName}
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            {roleLabel}
          </div>
        </div>

        {/* 信息列表 */}
        <div style={{
          background: '#fff',
          borderRadius: '18px',
          border: '1px solid rgba(226,232,240,0.9)',
          boxShadow: '0 10px 26px rgba(15,23,42,0.07)',
          overflow: 'hidden',
        }}>
          <ProfileItem icon={<User size={18} />} label="姓名" value={displayName} />
          <ProfileItem icon={<Shield size={18} />} label="角色" value={roleLabel} />
          <ProfileItem icon={<Building2 size={18} />} label="租户" value={tenantName} />
          {email && <ProfileItem icon={<Mail size={18} />} label="邮箱" value={email} />}
        </div>

        {/* 退出登录 */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '14px',
            backgroundColor: '#fff',
            border: '1px solid #fecaca',
            borderRadius: '14px',
            color: '#dc2626',
            fontSize: '15px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
        >
          <LogOut size={18} />
          退出登录
        </button>

        {/* 版本信息 */}
        <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', paddingTop: '8px' }}>
          forthAMS v1.0 · 移动端
        </div>
      </div>
    </PageTransition>
  );
}

/* ── 导出页面 ──────────────────────────────────────────────────────────────── */
export default function MobileProfilePage() {
  return (
    <ErrorBoundary>
      <MobileProfileContent />
    </ErrorBoundary>
  );
}

/* ── 子组件 ──────────────────────────────────────────────────────────────── */
function ProfileItem({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '14px 16px',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ color: '#64748b', marginRight: '12px', display: 'flex' }}>
        {icon}
      </div>
      <div style={{ fontSize: '14px', color: '#64748b', width: '56px', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: '#0f172a', textAlign: 'right' }}>
        {value}
      </div>
      <ChevronRight size={16} color="#d1d5db" style={{ marginLeft: '8px' }} />
    </div>
  );
}
