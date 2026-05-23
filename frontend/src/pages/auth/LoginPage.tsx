import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Shield, User, Lock, ShieldCheck, Package, Building2, Wrench, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { login } from '@/api/auth';

const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

type LoginForm = z.infer<typeof loginSchema>;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  hue: number;
  life: number;
  maxLife: number;
}

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

function useParticleCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const timeRef = useRef(0);

  const initParticles = useCallback((width: number, height: number) => {
    const count = Math.min(Math.floor((width * height) / 6000), 120);
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.4 + 0.15,
      hue: Math.random() * 60 + 200,
      life: 0,
      maxLife: Math.random() * 500 + 300,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (particlesRef.current.length === 0) initParticles(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    });

    const CONNECTION_DIST = 120;
    const MOUSE_DIST = 200;

    const animate = () => {
      timeRef.current++;
      ctx.fillStyle = 'rgba(11, 19, 38, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;
        const lifeRatio = p.life / p.maxLife;
        const fadeIn = Math.min(p.life / 60, 1);
        const fadeOut = lifeRatio > 0.8 ? 1 - (lifeRatio - 0.8) / 0.2 : 1;
        const alpha = p.opacity * fadeIn * fadeOut;

        if (p.life >= p.maxLife) {
          p.x = Math.random() * canvas.width;
          p.y = Math.random() * canvas.height;
          p.life = 0;
          p.maxLife = Math.random() * 500 + 300;
        }

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_DIST) {
          const force = (MOUSE_DIST - dist) / MOUSE_DIST * 0.006;
          p.vx += dx * force;
          p.vy += dy * force;
        }

        p.vx *= 0.988;
        p.vy *= 0.988;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > canvas.width) { p.x = canvas.width; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > canvas.height) { p.y = canvas.height; p.vy *= -1; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 75%, ${alpha})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const ddx = p.x - p2.x;
          const ddy = p.y - p2.y;
          const d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d < CONNECTION_DIST) {
            const lineAlpha = (1 - d / CONNECTION_DIST) * 0.15 * fadeIn * fadeOut;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `hsla(${p.hue}, 70%, 65%, ${lineAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [canvasRef, initParticles]);
}

export default function LoginPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  useParticleCanvas(canvasRef);

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
      const { token, userId, username, realName } = res.data;
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
      const status = err?.response?.status;
      const msg =
        status === 401
          ? '用户名或密码错误'
          : err?.response?.data?.message || err?.message || '网络错误，请检查网络后重试';
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
    <main
      className="login1-screen relative flex h-screen w-full overflow-hidden font-sans"
      style={{ background: 'radial-gradient(circle at top left, #131b2e 0%, #0b1326 100%)' }}
    >
      <style>{`
        .login1-screen {
          background:
            radial-gradient(circle at 18% 16%, rgba(37, 99, 235, 0.32), transparent 34%),
            radial-gradient(circle at 74% 28%, rgba(20, 184, 166, 0.18), transparent 32%),
            linear-gradient(135deg, #101827 0%, #071225 50%, #050b17 100%) !important;
          background-color: #071225 !important;
          isolation: isolate;
        }

        @keyframes login1-float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -14px, 0); }
        }

        @keyframes rainbowShift {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }

        @keyframes login1-pulse {
          0%, 100% { opacity: .45; transform: scale(.98); }
          50% { opacity: 1; transform: scale(1.04); }
        }

        .login1-asset-card {
          background: rgba(22, 34, 59, 0.18);
          border: 1px solid rgba(148, 197, 255, .14);
          box-shadow: 0 24px 80px rgba(0, 0, 0, .28), inset 0 1px 0 rgba(255,255,255,.08);
        }

        @media (max-width: 1024px) {
          .login1-layout {
            grid-template-columns: 1fr !important;
            overflow-y: auto;
            padding: 32px 24px !important;
          }

          .login1-left {
            min-height: 420px;
          }

          .login1-panel-column {
            justify-self: center !important;
            width: min(480px, 100%) !important;
          }
        }

        @media (max-width: 720px) {
          .login1-left {
            display: none;
          }
        }
      `}</style>
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
      }} />

      <div className="login1-layout relative z-10 grid h-full w-full grid-cols-[minmax(0,1fr)_minmax(420px,500px)] items-center gap-12 px-[6vw] py-8">
        <section className="login1-left relative min-h-[640px] overflow-hidden p-8 text-[#dae2fd]">
          <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#2563eb]/20 blur-3xl" />
          <div className="absolute bottom-8 right-10 h-80 w-80 rounded-full bg-[#14b8a6]/20 blur-3xl" />

          <div className="relative z-10 max-w-[680px]">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#6eb8ff]/20 bg-[#071225]/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#9ecbff]">
              <span className="h-2 w-2 rounded-full bg-[#5fffc1] shadow-[0_0_18px_rgba(95,255,193,.8)]" />
              星空无界 · UNI 有方
            </div>
            <h1 className="max-w-[620px] text-[52px] font-semibold leading-[1.04] tracking-[-0.04em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
              仰望星空，<br />驾驭资产万象
            </h1>
            <p className="mt-5 max-w-[560px] text-base leading-8 text-[#b8c8e6] drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
              以 Universe 之广，纳资产之全。<br />
              设备、流程、数据，尽在 UNI 统一视界。
            </p>
          </div>

          <div className="relative z-10 mx-auto mt-8 flex h-[330px] max-w-[620px] items-center justify-center gap-6">
            <div className="relative flex h-56 w-56 items-center justify-center">
              <div className="absolute inset-0 animate-[login1-pulse_4s_ease-in-out_infinite] rounded-[40px] border border-[#5ab4ff]/20 bg-[linear-gradient(145deg,rgba(37,99,235,.18),rgba(20,184,166,.08))]" />
              <div className="absolute inset-4 animate-[login1-float_6s_ease-in-out_infinite] rounded-2xl border border-white/10 bg-[#06152d]/40" />
              <svg className="absolute inset-0 h-full w-full animate-[spin_6s_linear_infinite]" viewBox="0 0 224 224" fill="none">
                <circle cx="112" cy="112" r="96" stroke="rgba(94,220,255,.12)" strokeWidth="1" strokeDasharray="8 6" />
                <circle cx="112" cy="112" r="72" stroke="rgba(94,220,255,.08)" strokeWidth="1" strokeDasharray="4 8" />
                <line x1="112" y1="112" x2="112" y2="16" stroke="rgba(94,220,255,.25)" strokeWidth="1.5" />
              </svg>
              <div className="relative z-10 flex items-center justify-center h-20 w-20">
                <svg className="absolute inset-0 h-full w-full animate-[spin_8s_linear_infinite]" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="36" stroke="rgba(94,220,255,.2)" strokeWidth="1" strokeDasharray="6 5" />
                  <circle cx="40" cy="40" r="26" stroke="rgba(94,220,255,.13)" strokeWidth="1" strokeDasharray="3 7" />
                  <line x1="40" y1="40" x2="40" y2="4" stroke="rgba(94,220,255,.3)" strokeWidth="1.2" />
                  <circle cx="40" cy="40" r="16" stroke="rgba(94,220,255,.08)" strokeWidth="0.8" />
                </svg>
                <div className="relative flex flex-col items-center">
                  <span className="text-[32px] font-black tracking-[0.18em] bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(255,255,255,.5)]" style={{ fontFamily: "'Arial Black','Impact','Inter',sans-serif", backgroundImage: 'linear-gradient(90deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#9b59b6,#ff6b6b)', backgroundSize: '300% 100%', animation: 'rainbowShift 3s linear infinite', lineHeight: 1 }}>
                    UNI
                  </span>
                  <span className="text-[32px] font-black tracking-[0.18em] bg-clip-text text-transparent scale-y-[-1] opacity-20 translate-y-1" style={{ fontFamily: "'Arial Black','Impact','Inter',sans-serif", backgroundImage: 'linear-gradient(90deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#9b59b6,#ff6b6b)', backgroundSize: '300% 100%', animation: 'rainbowShift 3s linear infinite', lineHeight: 1, WebkitBackgroundClip: 'text', maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)' }}>
                    UNI
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              {[
                { icon: Shield, label: '全生命周期追踪' },
                { icon: BarChart3, label: '实时数据看板' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-5 py-3 backdrop-blur-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563eb]/20">
                    <Icon className="h-4 w-4 text-[#9ecbff]" />
                  </div>
                  <span className="text-sm font-medium text-[#c3d4f0]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="login1-panel-column relative z-10 flex w-full max-w-[480px] flex-col items-center justify-self-end">
        <div
          className="glass-card w-full rounded-xl p-8 mb-8"
          style={{
            background: 'rgba(23, 31, 51, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <header className="flex flex-col items-center mb-10 text-center">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 border border-[#2563eb]/20" style={{ background: 'rgba(37, 99, 235, 0.12)' }}>
              <Shield className="w-7 h-7 text-[#b4c5ff]" />
            </div>
            <h1 className="text-[28px] font-semibold text-[#dae2fd] tracking-tight leading-9">
              资产管理系统
            </h1>
            <p className="text-sm font-medium text-[#c3c6d7] mt-2 uppercase tracking-[0.2em]">
              安全资产网关
            </p>
          </header>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#c3c6d7] uppercase tracking-wider ml-1" htmlFor="username">
                用户名
              </label>
              <div className="relative flex items-center border border-white/10 rounded-lg bg-[#060e20]/50 group transition-all duration-200 focus-within:shadow-[0_0_15px_rgba(37,99,235,0.3)] focus-within:border-[#2563eb]">
                <User className="absolute left-4 w-5 h-5 text-[#8d90a0] group-focus-within:text-[#b4c5ff]" />
                <input
                  {...register('username')}
                  id="username"
                  type="text"
                  placeholder="请输入账号"
                  className="w-full bg-transparent border-none py-3.5 pl-12 pr-4 text-[#dae2fd] placeholder:text-[#434655] focus:ring-0 text-base outline-none"
                />
              </div>
              {errors.username && <p className="text-xs text-[#ffb4ab] ml-1">{errors.username.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#c3c6d7] uppercase tracking-wider ml-1" htmlFor="password">
                密码
              </label>
              <div className="relative flex items-center border border-white/10 rounded-lg bg-[#060e20]/50 group transition-all duration-200 focus-within:shadow-[0_0_15px_rgba(37,99,235,0.3)] focus-within:border-[#2563eb]">
                <Lock className="absolute left-4 w-5 h-5 text-[#8d90a0] group-focus-within:text-[#b4c5ff]" />
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-none py-3.5 pl-12 pr-12 text-[#dae2fd] placeholder:text-[#434655] focus:ring-0 text-base outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 text-[#8d90a0] hover:text-[#dae2fd] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-[#ffb4ab] ml-1">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-5 w-5 rounded border-[#434655] bg-[#2d3449] text-[#2563eb] focus:ring-offset-[#0b1326] focus:ring-[#2563eb]"
                />
                <span className="text-sm font-medium text-[#c3c6d7] group-hover:text-[#dae2fd] transition-colors">
                  记住我
                </span>
              </label>
              <button
                type="button"
                className="text-sm font-medium text-[#b4c5ff] hover:text-[#adc6ff] transition-colors underline-offset-4 hover:underline"
                onClick={() => toast.info('请联系管理员重置密码')}
              >
                忘记密码？
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg text-sm text-center border" style={{ background: 'rgba(147,0,10,0.2)', borderColor: 'rgba(255,180,171,0.2)', color: '#ffb4ab' }}>
                {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loginMutation.isPending}
              className="w-full !py-4 !text-base !font-semibold !rounded-lg !shadow-lg !shadow-[#2563eb]/20"
              style={{ background: '#2563eb' }}
            >
              登录系统
            </Button>
          </form>
        </div>

        {DEMO_ACCOUNTS.length > 0 && (
        <section className="w-full">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-grow bg-white/10" />
            <h2 className="text-xs font-semibold text-[#8d90a0] tracking-[0.15em] uppercase whitespace-nowrap">
              快捷账号
            </h2>
            <div className="h-px flex-grow bg-white/10" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {DEMO_ACCOUNTS.map(({ label, desc, username, password, Icon }) => (
              <button
                key={username}
                type="button"
                onClick={() => fillAndLogin(username, password)}
                disabled={loginMutation.isPending}
                className="p-4 rounded-xl flex flex-col items-center text-center group hover:-translate-y-1 transition-all disabled:opacity-40"
                style={{
                  background: 'rgba(23, 31, 51, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Icon className="w-6 h-6 text-[#8d90a0] group-hover:text-[#b4c5ff] mb-2 transition-colors" />
                <span className="text-sm font-medium text-[#dae2fd]">{label}</span>
                <span className="text-[10px] text-[#434655] mt-1">{desc}</span>
              </button>
            ))}
          </div>
        </section>
        )}

        <footer className="mt-12 text-center">
          <p className="text-xs text-[#434655]">© 2026 资产管理系统 版权所有</p>
          <div className="mt-2 flex justify-center gap-4">
            <a className="text-[10px] text-[#434655] hover:text-[#8d90a0]" href="#">安全策略</a>
            <a className="text-[10px] text-[#434655] hover:text-[#8d90a0]" href="#">服务条款</a>
          </div>
        </footer>
        </div>
      </div>
    </main>
  );
}
