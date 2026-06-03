/**
 * @file pages/auth/LoginPage.tsx
 * @description 登录页 — V3 Design System 重构
 *
 * 设计语言：深色太空主题 + 品牌渐变 + 雷达扫描动画 + 玻璃拟态
 * 功能：账号密码登录、记住用户名、MaxKey SSO、快捷演示账号
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import {
  Eye, EyeOff, Shield, User, Lock, ShieldCheck, Package,
  Building2, Wrench, BarChart3, LogIn, CheckCircle2,
  Radar, Fingerprint, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { login } from '@/api/auth';

// ─── Schema ──────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

type LoginForm = z.infer<typeof loginSchema>;

// ─── Demo Accounts ──────────────────────────────────────────────────────────

const isDev = import.meta.env.DEV;
const envDemoUser = import.meta.env.VITE_DEMO_USERNAME;
const envDemoPass = import.meta.env.VITE_DEMO_PASSWORD;

const DEMO_ACCOUNTS: Array<{
  label: string;
  desc: string;
  username: string;
  password: string;
  Icon: typeof ShieldCheck;
  gradient: string;
}> = isDev
  ? [
      { label: '系统管理员', desc: '全域权限', username: envDemoUser || 'admin', password: envDemoPass || 'admin123', Icon: ShieldCheck, gradient: 'from-blue-500 to-cyan-400' },
      { label: '资产管理员', desc: '全生命周期', username: 'asset', password: 'asset123', Icon: Package, gradient: 'from-violet-500 to-purple-400' },
      { label: '部门负责人', desc: '资源审批', username: 'manager', password: 'manager123', Icon: Building2, gradient: 'from-emerald-500 to-teal-400' },
      { label: '运维人员', desc: '巡检维修', username: 'staff', password: 'staff123', Icon: Wrench, gradient: 'from-amber-500 to-orange-400' },
    ]
  : envDemoUser && envDemoPass
    ? [{ label: '演示账号', desc: '只读权限', username: envDemoUser, password: envDemoPass, Icon: ShieldCheck, gradient: 'from-blue-500 to-cyan-400' }]
    : [];

// ─── Radar Animation ────────────────────────────────────────────────────────

function RadarAnimation() {
  return (
    <div className="absolute right-[12%] top-[18%] h-[280px] w-[280px] opacity-20">
      <div className="absolute inset-0 rounded-full border border-cyan-400/30" />
      <div className="absolute inset-6 rounded-full border border-cyan-400/20" />
      <div className="absolute inset-12 rounded-full border border-cyan-400/15" />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)]" />
      <div
        className="absolute left-1/2 top-1/2 h-[140px] w-[2px] origin-top -translate-x-1/2"
        style={{
          background: 'linear-gradient(to bottom, rgba(34,211,238,0.8), transparent)',
          animation: 'radar-sweep 3s linear infinite',
        }}
      />
      <div className="absolute left-[30%] top-[25%] h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
      <div className="absolute left-[65%] top-[40%] h-1 w-1 rounded-full bg-blue-300 animate-pulse" style={{ animationDelay: '0.5s' }} />
      <div className="absolute left-[45%] top-[70%] h-1.5 w-1.5 rounded-full bg-indigo-300 animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute left-[75%] top-[65%] h-1 w-1 rounded-full bg-cyan-200 animate-pulse" style={{ animationDelay: '1.5s' }} />
    </div>
  );
}

// ─── Floating Orbs Background ───────────────────────────────────────────────

function FloatingOrbs() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute left-[-15%] top-[-20%] h-[500px] w-[500px] rounded-full bg-blue-600/15 blur-[100px]" />
      <div className="absolute bottom-[-20%] right-[-12%] h-[560px] w-[560px] rounded-full bg-cyan-500/10 blur-[100px]" />
      <div className="absolute left-[40%] top-[60%] h-[300px] w-[300px] rounded-full bg-indigo-600/[0.08] blur-[80px]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />
      <div
        className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent"
        style={{ top: '30%', animation: 'scan-line 8s ease-in-out infinite' }}
      />
    </div>
  );
}

// ─── Feature Card ───────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  gradient: string;
}

function FeatureCard({ icon: Icon, title, subtitle, gradient }: FeatureCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.07]">
      <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{subtitle}</p>
      <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/[0.03] opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
    </div>
  );
}

// ─── Trust Badge ────────────────────────────────────────────────────────────

function TrustBadge({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 backdrop-blur">
      <Icon className="h-3.5 w-3.5 text-emerald-400" />
      <span className="text-[13px] font-medium text-slate-300">{text}</span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  useEffect(() => {
    const saved = localStorage.getItem('remembered_username');
    if (saved) {
      setValue('username', saved);
      setRememberMe(true);
    }
  }, [setValue]);

  const loginMutation = useMutation({
    mutationFn: (data: LoginForm) => login(data),
    onSuccess: (res) => {
      const { token, userId, username, realName } = res;
      if (!token) {
        toast.error('登录响应缺少 token');
        return;
      }
      sessionStorage.setItem('auth_token', token);
      sessionStorage.setItem('user_info', JSON.stringify({ userId, username, realName }));
      if (rememberMe) {
        localStorage.setItem('remembered_username', username);
      } else {
        localStorage.removeItem('remembered_username');
      }
      navigate('/dashboard', { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.message || '网络错误，请检查网络后重试';
      toast.error(msg);
      setErrorMsg(msg);
    },
  });

  const onSubmit = (data: LoginForm) => {
    setErrorMsg(null);
    loginMutation.mutate(data);
  };

  const fillAndLogin = (username: string, password: string) => {
    setValue('username', username);
    setValue('password', password);
    setErrorMsg(null);
    setTimeout(() => {
      loginMutation.mutate({ username, password });
    }, 200);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060e1f] text-slate-100 selection:bg-blue-400/30">
      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes radar-sweep {
          from { transform: translateX(-50%) rotate(0deg); }
          to   { transform: translateX(-50%) rotate(360deg); }
        }
        @keyframes scan-line {
          0%, 100% { top: 20%; opacity: 0; }
          10% { opacity: 1; }
          50% { top: 80%; opacity: 0.5; }
          90% { opacity: 0; }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes ring-pulse {
          0% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.05); opacity: 0.15; }
          100% { transform: scale(1); opacity: 0.3; }
        }
      `}</style>

      <FloatingOrbs />

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_540px]">
        {/* ── 左侧品牌面板 ─────────────────────────────────────────── */}
        <section className="hidden min-h-screen flex-col justify-between px-[6vw] py-10 lg:flex">
          {/* 顶部标签 */}
          <div
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-blue-200/90 backdrop-blur"
            style={{ animation: 'float-slow 6s ease-in-out infinite' }}
          >
            <Fingerprint className="h-3.5 w-3.5 text-cyan-300" />
            forthAMS · Enterprise Asset Management
          </div>

          <RadarAnimation />

          {/* 主标题区 */}
          <div className="relative z-10 max-w-[680px]">
            <h1
              className="text-5xl font-bold leading-[1.15] tracking-tight xl:text-[62px]"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #93c5fd 40%, #22d3ee 70%, #a78bfa 100%)',
                backgroundSize: '200% 200%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'gradient-shift 8s ease infinite',
              }}
            >
              统一资产、流程与审计的运营入口
            </h1>
            <p className="mt-6 max-w-[540px] text-[15px] leading-[1.9] text-slate-400">
              为资产台账、盘点、审批和审计提供一致的登录起点，帮助运营团队稳定进入核心工作台。
            </p>

            {/* 功能卡片 */}
            <div className="mt-10 grid max-w-[620px] grid-cols-3 gap-3">
              <FeatureCard icon={Package} title="资产台账" subtitle="全生命周期追溯" gradient="from-blue-600 to-cyan-500" />
              <FeatureCard icon={Shield} title="审批流程" subtitle="多级权限守护" gradient="from-violet-600 to-purple-500" />
              <FeatureCard icon={BarChart3} title="运营分析" subtitle="实时数据洞察" gradient="from-emerald-600 to-teal-500" />
            </div>
          </div>

          {/* 底部信任标签 */}
          <div className="relative z-10 grid max-w-[720px] grid-cols-2 gap-3">
            <TrustBadge icon={CheckCircle2} text="多角色权限隔离" />
            <TrustBadge icon={CheckCircle2} text="统一组织身份认证" />
            <TrustBadge icon={CheckCircle2} text="审计日志全链路留痕" />
            <TrustBadge icon={CheckCircle2} text="移动盘点与审批协同" />
          </div>
        </section>

        {/* ── 右侧登录面板 ─────────────────────────────────────────── */}
        <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:bg-[#060e1f]/60 lg:backdrop-blur-sm">
          <div className="w-full max-w-[460px]">
            <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.06] p-7 shadow-[0_32px_100px_rgba(0,0,0,0.4)] ring-1 ring-white/[0.04] backdrop-blur-2xl sm:p-8">
              {/* 顶部渐变光条 */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
                style={{
                  background: 'linear-gradient(90deg, transparent, #3b82f6, #06b6d4, #8b5cf6, transparent)',
                  backgroundSize: '200% 100%',
                  animation: 'gradient-shift 4s ease infinite',
                }}
              />

              {/* 装饰环 */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-blue-400/[0.08]"
                style={{ animation: 'ring-pulse 4s ease-in-out infinite' }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border border-cyan-400/[0.06]"
                style={{ animation: 'ring-pulse 4s ease-in-out infinite', animationDelay: '1s' }}
              />

              {/* 头部 */}
              <header className="mb-8">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/25">
                  <Activity className="h-7 w-7 text-white" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-cyan-300/70">Secure Sign In</p>
                <h2 className="mt-2 text-[28px] font-bold tracking-tight text-white">登录资产管理系统</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">使用组织账号进入 forthAMS 工作台</p>
              </header>

              {/* 表单 */}
              <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <label className="ml-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400" htmlFor="username">
                    用户名
                  </label>
                  <div className="group relative flex items-center rounded-xl border border-white/[0.08] bg-white/[0.04] transition-all duration-200 hover:border-white/[0.15] focus-within:border-blue-400/60 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]">
                    <User className="absolute left-4 h-[18px] w-[18px] text-slate-600 transition-colors group-focus-within:text-blue-300" />
                    <input
                      {...register('username')}
                      id="username"
                      type="text"
                      placeholder="请输入账号"
                      autoComplete="username"
                      className="w-full border-none bg-transparent py-3.5 pl-12 pr-4 text-[15px] text-slate-100 outline-none placeholder:text-slate-600 focus:ring-0"
                    />
                  </div>
                  {errors.username && (
                    <p className="ml-1 text-xs text-red-300/90">{errors.username.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400" htmlFor="password">
                    密码
                  </label>
                  <div className="group relative flex items-center rounded-xl border border-white/[0.08] bg-white/[0.04] transition-all duration-200 hover:border-white/[0.15] focus-within:border-blue-400/60 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]">
                    <Lock className="absolute left-4 h-[18px] w-[18px] text-slate-600 transition-colors group-focus-within:text-blue-300" />
                    <input
                      {...register('password')}
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="请输入密码"
                      autoComplete="current-password"
                      className="w-full border-none bg-transparent py-3.5 pl-12 pr-12 text-[15px] text-slate-100 outline-none placeholder:text-slate-600 focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 text-slate-600 transition-colors hover:text-slate-300"
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="ml-1 text-xs text-red-300/90">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <label className="group flex cursor-pointer items-center gap-3">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="h-4 w-4 rounded border border-white/15 bg-white/[0.06] transition-all peer-checked:border-blue-400 peer-checked:bg-blue-500 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400/40" />
                      <CheckCircle2 className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
                    </div>
                    <span className="text-[13px] font-medium text-slate-400 transition-colors group-hover:text-slate-200">记住用户名</span>
                  </label>
                  <button
                    type="button"
                    className="text-[13px] font-medium text-blue-300/80 transition-colors hover:text-blue-200"
                    onClick={() => toast.info('请联系管理员重置密码')}
                  >
                    忘记密码？
                  </button>
                </div>

                {errorMsg && (
                  <div className="rounded-xl border border-red-400/20 bg-red-500/[0.08] px-4 py-3 text-center text-sm font-medium text-red-200">
                    {errorMsg}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={loginMutation.isPending}
                  className="!h-[48px] w-full !rounded-xl !text-[15px] !font-bold !shadow-lg !shadow-blue-500/25 transition-all hover:!shadow-blue-500/40 active:!scale-[0.98]"
                  style={{
                    background: loginMutation.isPending
                      ? undefined
                      : 'linear-gradient(135deg, #1d4ed8, #2563eb, #0891b2)',
                    backgroundSize: '200% 200%',
                  }}
                >
                  {loginMutation.isPending ? '登录中...' : '登录系统'}
                </Button>
              </form>

              {/* SSO */}
              <div className="mt-6 border-t border-white/[0.06] pt-6">
                <a
                  href={`${import.meta.env.VITE_API_BASE || ''}/api/oauth2/authorization/maxkey`}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-center text-sm font-semibold text-slate-200 transition-all hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-white/[0.08]"
                >
                  <LogIn className="h-4 w-4 text-blue-300" />
                  MaxKey 单点登录
                </a>
                <p className="mt-2 text-center text-[11px] text-slate-600">使用组织统一身份认证登录</p>
              </div>

              {/* 快捷账号 */}
              {DEMO_ACCOUNTS.length > 0 && (
                <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5">
                  <div className="mb-3 flex items-center gap-2">
                    <Radar className="h-3.5 w-3.5 text-cyan-400" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200/70">快捷账号</p>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      演示环境
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {DEMO_ACCOUNTS.map(({ label, desc, username, password, Icon, gradient }) => (
                      <button
                        key={username}
                        type="button"
                        onClick={() => fillAndLogin(username, password)}
                        disabled={loginMutation.isPending}
                        className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.06] disabled:opacity-40"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-sm`}>
                            <Icon className="h-3.5 w-3.5 text-white" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-200">{label}</span>
                            <p className="text-[10px] text-slate-500">{desc}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 底部版权 */}
            <footer className="mt-8 text-center">
              <p className="text-[11px] text-slate-600">© 2026 forthAMS 资产管理系统 · 版权所有</p>
              <div className="mt-2 flex justify-center gap-5">
                <a className="text-[11px] text-slate-600 transition-colors hover:text-slate-400" href="#">安全策略</a>
                <a className="text-[11px] text-slate-600 transition-colors hover:text-slate-400" href="#">服务条款</a>
              </div>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
