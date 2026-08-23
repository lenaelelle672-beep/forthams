/**
 * @file pages/profile/UserProfilePage.tsx
 * @description 个人信息页 — 展示当前登录用户基本信息
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { getUserDetail } from '@/api/user-management';
import { getCurrentTenant } from '@/api/tenant';
import type { UserDetail } from '@/api/user-management';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { PageTransition } from '@/components/ui/PageTransition';
import { SkeletonCard } from '@/components/ui';
import {
  User,
  Shield,
  Building2,
  Mail,
  Phone,
  Clock,
  MapPin,
  Key,
  Hash,
  BadgeCheck,
  Crown,
} from 'lucide-react';

export default function UserProfilePage() {
  const { t } = useTranslation('user');
  const { user } = useAuth();
  const userId = user?.userId;

  const getRoleLabel = useMemo(
    () => (code: string) => t(`roleLabels.${code}`, { defaultValue: code }),
    [t],
  );
  const getStatusLabel = useMemo(
    () => (code: number) => ({
      label: code === 1 ? t('accountStatus.disabled') : t('accountStatus.active'),
      color:
        code === 1
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }),
    [t],
  );

  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ['user-profile', userId],
    queryFn: () => getUserDetail(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const { data: currentTenant } = useQuery({
    queryKey: ['current-tenant-plan'],
    queryFn: getCurrentTenant,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-5">
        <SkeletonCard className="h-48" />
        <SkeletonCard className="h-64" />
      </div>
    );
  }

  const hasProfileIdentity = Boolean(
    detail
    && typeof detail === 'object'
    && (typeof (detail as UserDetail).id === 'number'
      || typeof (detail as UserDetail).realName === 'string'
      || typeof (detail as UserDetail).username === 'string'),
  );

  // Fallback to AuthContext data if API fails or returns a non-user payload
  const profile = hasProfileIdentity ? detail as UserDetail : {
    id: user?.userId ?? 0,
    username: user?.username ?? '',
    realName: user?.realName ?? '',
    roles: (Array.isArray(user?.roles) ? user.roles : []).map((r) => ({ id: 0, roleCode: r, roleName: getRoleLabel(r) })),
    email: undefined,
    phone: undefined,
    deptName: undefined,
    deptId: undefined,
    loginIp: undefined,
    loginDate: undefined,
    status: 0,
    createTime: undefined,
  };

  const displayName = profile.realName || profile.username || t('profile.systemAdmin');
  const initial = displayName[0].toUpperCase();
  const profileRoles = Array.isArray(profile.roles) ? profile.roles : [];
  const authRoles = Array.isArray(user?.roles) ? user.roles : [];
  const permissionList = Array.isArray((profile as { permissions?: unknown }).permissions)
    ? (profile as { permissions: string[] }).permissions
    : [];
  const roleNames = profileRoles.length > 0
    ? profileRoles.map((r: any) => getRoleLabel(r.roleCode))
    : authRoles.map((r: string) => getRoleLabel(r));
  const statusCfg = getStatusLabel(profile.status ?? 0);

  return (
    <PageTransition>
      <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[900px] space-y-6">
          {/* ── 头部 Profile Card ── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-8">
              <div className="flex items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 text-3xl font-bold text-white backdrop-blur-sm ring-4 ring-white/30">
                  {initial}
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-white">{displayName}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {roleNames.map((r: string) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm"
                      >
                        <Shield className="w-3 h-3" />
                        {r}
                      </span>
                    ))}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ${statusCfg.color}`}
                    >
                      <BadgeCheck className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* ── 基本信息 ── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>{t('profile.title')}</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">{t('profile.accountBasic')}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoRow
                icon={<Hash className="w-4 h-4" />}
                label={t('profile.userID')}
                value={`#${profile.id}`}
                mono
              />
              <InfoRow
                icon={<User className="w-4 h-4" />}
                label={t('profile.username')}
                value={profile.username || '—'}
                mono
              />
              <InfoRow
                icon={<User className="w-4 h-4" />}
                label={t('profile.realName')}
                value={profile.realName || '—'}
              />
              <InfoRow
                icon={<Building2 className="w-4 h-4" />}
                label={t('profile.dept')}
                value={profile.deptName || t('profile.noDept')}
              />
              <InfoRow
                icon={<Crown className="w-4 h-4" />}
                label="当前套餐"
                value={currentTenant?.plan || '—'}
                mono
              />
              <InfoRow
                icon={<Mail className="w-4 h-4" />}
                label={t('profile.email')}
                value={profile.email || t('profile.noEmail')}
              />
              <InfoRow
                icon={<Phone className="w-4 h-4" />}
                label={t('profile.phone')}
                value={profile.phone || t('profile.noPhone')}
              />
            </CardContent>
          </Card>

          {/* ── 角色与权限 ── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-50 rounded-lg">
                  <Key className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <CardTitle>{t('profile.rolePermission')}</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">{t('profile.roleDesc')}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profileRoles.length > 0
                  ? profileRoles.map((r: any) => (
                      <span
                        key={r.roleCode}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {getRoleLabel(r.roleCode)}
                      </span>
                    ))
                  : authRoles.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {getRoleLabel(r)}
                      </span>
                    ))}
                {profileRoles.length === 0 && authRoles.length === 0 && (
                    <span className="text-sm text-slate-400">{t('profile.noRole')}</span>
                  )}
              </div>
              {permissionList.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    {t('profile.permissionCount', { count: permissionList.length })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {permissionList.slice(0, 20).map((p: string) => (
                      <span
                        key={p}
                        className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600"
                      >
                        {p}
                      </span>
                    ))}
                    {permissionList.length > 20 && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                        +{permissionList.length - 20} {t('profile.more')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 登录信息 ── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <Clock className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle>{t('profile.loginInfo')}</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">{t('profile.loginDesc')}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoRow
                icon={<Clock className="w-4 h-4" />}
                label={t('profile.loginDate')}
                value={
                  profile.loginDate ? profile.loginDate.replace('T', ' ').substring(0, 16) : '—'
                }
              />
              <InfoRow
                icon={<MapPin className="w-4 h-4" />}
                label={t('profile.loginIp')}
                value={profile.loginIp || '—'}
                mono
              />
              <InfoRow
                icon={<Clock className="w-4 h-4" />}
                label={t('profile.createTime')}
                value={
                  profile.createTime ? profile.createTime.replace('T', ' ').substring(0, 16) : '—'
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

// ── 信息行组件 ──

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p
          className={`mt-0.5 text-sm font-medium text-slate-800 truncate ${mono ? 'font-mono' : ''}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
