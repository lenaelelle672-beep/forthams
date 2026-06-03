import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Shield, User, Lock, ShieldCheck, Package, Building2, Wrench, BarChart3, LogIn, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { login } from '@/api/auth';

const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

type LoginForm = z.infer<typeof loginSchema>;

// 开发环境使用演示账号，生产环境通过环境变量注入（为空则隐藏）
const isDev = import.meta.env.DEV;
const envDemoUser = import.meta.env.VITE_DEMO_USERNAME;
const envDemoPass = import.meta.env.VITE_DEMO_PASSWORD;

const DEMO_ACCOUNTS: Array<{ label: string; desc: string; username: string; password: string; Icon: typeof ShieldCheck }> = isDev
  ? [
      { label: '系统管理员', desc: '全域权限', username: envDemoUser || 'admin', password: envDemoPass || 'admin123', Icon: ShieldCheck },
      { label: '资产管理员', desc: '全生命周期', username: 'asset', password: 'asset123', Icon: Package },
      { label: '部门负责人', desc: '资源审批', username: 'manager', password: 'manager123', Icon: Building2 },
      { label: '运维人员', desc: '巡检维修', username: 'staff', password: 'staff123', Icon: Wrench },
    ]
  : envDemoUser && envDemoPass
    ? [{ label: '演示账号', desc: '只读权限', username: envDemoUser, password: envDemoPass, Icon: ShieldCheck }]
    : [];

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  // 页面加载时从 localStorage 恢复记住的用户名
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
      // 记住我：保存或清除用户名
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
    <main className="relative min-h-screen overflow-hidden bg-[#071225] text-slate-100 selection:bg-blue-300/30">
      <div aria-hidden className="absolute inset-0">
        <div className="absolute left-[-12%] top-[-18%] h-[460px] w-[460px] rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-[-18%] right-[-10%] h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-45" />
      </div>

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_520px]">
        <section className="hidden min-h-screen flex-col justify-between px-[6vw] py-10 lg:flex">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100 shadow-lg shadow-black/10 backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />
            forthAMS Control Center
          </div>

          <div className="max-w-[680px]">
            <h1 className="text-5xl font-semibold leading-tight tracking-[-0.04em] text-white xl:text-[64px]">
              统一资产、流程与审计的运营入口
            </h1>
            <p className="mt-6 max-w-[560px] text-base leading-8 text-slate-300">
              为资产台账、盘点、审批和审计提供一致的登录起点，帮助运营团队稳定进入核心工作台。
            </p>

            <div className="mt-10 grid max-w-[620px] grid-cols-3 gap-3">
              {[
                { label: '资产台账', value: '统一入口', Icon: Package },
                { label: '审批流程', value: '权限守护', Icon: Shield },
                { label: '运营分析', value: '实时洞察', Icon: BarChart3 },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/10 backdrop-blur">
                  <Icon className="h-5 w-5 text-cyan-100" />
                  <p className="mt-4 text-sm font-semibold text-white">{label}</p>
                  <p className="mt-1 text-xs text-slate-400">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid max-w-[760px] grid-cols-2 gap-4">
            {[
              '多角色权限隔离',
              '统一组织身份认证',
              '审计日志全链路留痕',
              '移动盘点与审批协同',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#071225]/55 px-4 py-3 shadow-inner backdrop-blur">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <span className="text-sm text-slate-200">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:bg-[#061226]/55 lg:backdrop-blur-sm">
          <div className="w-full max-w-[460px]">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.08] p-7 shadow-[0_28px_80px_rgba(0,0,0,0.32)] ring-1 ring-white/[0.04] backdrop-blur-2xl sm:p-8">
              <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />
              <header className="mb-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/15 bg-blue-400/10 shadow-inner">
                  <Shield className="h-6 w-6 text-blue-100" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100/75">Secure Sign In</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">登录资产管理系统</h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">使用组织账号进入 forthAMS 工作台。</p>
              </header>

              <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="username">
                    用户名
                  </label>
                  <div className="group relative flex items-center rounded-xl border border-white/10 bg-[#061126]/70 transition-all duration-200 hover:border-white/20 focus-within:border-blue-300/70 focus-within:bg-[#071833]/80 focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.16)]">
                    <User className="absolute left-4 h-5 w-5 text-slate-500 transition-colors group-focus-within:text-blue-100" />
                    <input
                      {...register('username')}
                      id="username"
                      type="text"
                      placeholder="请输入账号"
                      className="w-full border-none bg-transparent py-3.5 pl-12 pr-4 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:ring-0"
                    />
                  </div>
                  {errors.username && <p className="ml-1 text-xs text-red-200">{errors.username.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="password">
                    密码
                  </label>
                  <div className="group relative flex items-center rounded-xl border border-white/10 bg-[#061126]/75 transition-all duration-200 hover:border-white/20 focus-within:border-blue-300/70 focus-within:bg-[#071832]/85 focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.16)]">
                    <Lock className="absolute left-4 h-5 w-5 text-slate-500 transition-colors group-focus-within:text-blue-100" />
                    <input
                      {...register('password')}
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="请输入密码"
                      className="w-full border-none bg-transparent py-3.5 pl-12 pr-12 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 text-slate-500 transition-colors hover:text-slate-100"
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="ml-1 text-xs text-red-200">{errors.password.message}</p>}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <label className="group flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-500 bg-[#1b2a44] text-blue-500 focus:ring-blue-400 focus:ring-offset-[#071225]"
                    />
                    <span className="text-sm font-medium text-slate-300 transition-colors group-hover:text-white">记住用户名</span>
                  </label>
                  <button
                    type="button"
                    className="text-sm font-medium text-blue-100 underline-offset-4 transition-colors hover:text-white hover:underline"
                    onClick={() => toast.info('请联系管理员重置密码')}
                  >
                    忘记密码？
                  </button>
                </div>

                {errorMsg && (
                  <div className="rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-100">
                    {errorMsg}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={loginMutation.isPending}
                  className="!h-11 w-full !rounded-xl !text-base !font-semibold !shadow-lg !shadow-blue-500/20 transition-transform active:scale-[0.99]"
                >
                  登录系统
                </Button>
              </form>

              <div className="mt-6 border-t border-white/10 pt-6">
                <a
                  href={`${import.meta.env.VITE_API_BASE || ''}/api/oauth2/authorization/maxkey`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] py-3 text-center text-sm font-semibold text-slate-100 shadow-lg transition-all hover:-translate-y-0.5 hover:border-blue-300/30 hover:bg-white/[0.1]"
                >
                  <LogIn className="h-4 w-4" />
                  MaxKey 单点登录
                </a>
                <p className="mt-2 text-center text-[11px] text-slate-500">使用组织统一身份认证登录</p>
              </div>

              {DEMO_ACCOUNTS.length > 0 && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100/80">快捷账号</p>
                      <p className="text-[11px] text-slate-500">授权演示环境可用</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {DEMO_ACCOUNTS.map(({ label, desc, username, password, Icon }) => (
                      <button
                        key={username}
                        type="button"
                        onClick={() => fillAndLogin(username, password)}
                        disabled={loginMutation.isPending}
                        className="rounded-xl border border-white/10 bg-[#071225]/45 px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:bg-white/[0.08] disabled:opacity-40"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-blue-100" />
                          <span className="text-xs font-medium text-slate-100">{label}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <footer className="mt-8 text-center text-xs text-slate-600">
              <p>© 2026 资产管理系统 版权所有</p>
              <div className="mt-2 flex justify-center gap-4">
                <a className="hover:text-slate-300" href="#">安全策略</a>
                <a className="hover:text-slate-300" href="#">服务条款</a>
              </div>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
