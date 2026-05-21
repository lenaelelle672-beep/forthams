import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Shield, User, Lock, ShieldCheck, Package, Building2, Wrench } from 'lucide-react';
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

const DEMO_ACCOUNTS = [
  { label: '系统管理员', desc: '全域权限', username: 'admin', password: 'admin123', Icon: ShieldCheck },
  { label: '资产管理员', desc: '全生命周期', username: 'asset', password: 'asset123', Icon: Package },
  { label: '部门负责人', desc: '资源审批', username: 'manager', password: 'manager123', Icon: Building2 },
  { label: '运维人员', desc: '巡检维修', username: 'staff', password: 'staff123', Icon: Wrench },
] as const;

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

  useParticleCanvas(canvasRef);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const loginMutation = useMutation({
    mutationFn: (data: LoginForm) => login(data),
    onSuccess: (res) => {
      const { token, userInfo } = res.data;
      if (!token) {
        toast.error('登录响应缺少 token');
        return;
      }
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_info', JSON.stringify(userInfo));
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

        @keyframes login1-scan {
          0% { transform: translateY(-110%); opacity: 0; }
          20%, 72% { opacity: .82; }
          100% { transform: translateY(110%); opacity: 0; }
        }

        @keyframes login1-flow {
          to { stroke-dashoffset: -42; }
        }

        @keyframes login1-pulse {
          0%, 100% { opacity: .45; transform: scale(.98); }
          50% { opacity: 1; transform: scale(1.04); }
        }

        .login1-asset-card {
          background: linear-gradient(135deg, rgba(22, 34, 59, .72), rgba(8, 18, 38, .42));
          border: 1px solid rgba(148, 197, 255, .14);
          box-shadow: 0 24px 80px rgba(0, 0, 0, .28), inset 0 1px 0 rgba(255,255,255,.08);
          backdrop-filter: blur(22px);
        }

        .login1-asset-visual {
          animation: login1-float 7s ease-in-out infinite;
        }

        .login1-asset-visual::after {
          content: '';
          position: absolute;
          inset: 12%;
          border-radius: 999px;
          background: linear-gradient(180deg, transparent, rgba(85, 200, 255, .20), transparent);
          filter: blur(4px);
          animation: login1-scan 4.8s ease-in-out infinite;
        }

        .login1-flow-line {
          stroke-dasharray: 12 10;
          animation: login1-flow 2.2s linear infinite;
        }

        .login1-node-glow {
          transform-box: fill-box;
          transform-origin: center;
          animation: login1-pulse 3.6s ease-in-out infinite;
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
        <section className="login1-left relative min-h-[640px] overflow-hidden rounded-[40px] p-8 text-[#dae2fd]">
          <div className="absolute inset-0 rounded-[40px] border border-white/10 bg-[linear-gradient(135deg,rgba(23,31,51,0.56),rgba(7,18,37,0.22))] shadow-[0_40px_140px_rgba(0,0,0,0.28)] backdrop-blur-[18px]" />
          <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#2563eb]/20 blur-3xl" />
          <div className="absolute bottom-8 right-10 h-80 w-80 rounded-full bg-[#14b8a6]/20 blur-3xl" />

          <div className="relative z-10 max-w-[680px]">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#6eb8ff]/20 bg-[#071225]/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#9ecbff]">
              <span className="h-2 w-2 rounded-full bg-[#5fffc1] shadow-[0_0_18px_rgba(95,255,193,.8)]" />
              资产数字孪生中心
            </div>
            <h1 className="max-w-[620px] text-[52px] font-semibold leading-[1.04] tracking-[-0.04em] text-white">
              资产全生命周期，实时可视化掌控
            </h1>
            <p className="mt-5 max-w-[560px] text-base leading-8 text-[#b8c8e6]">
              聚合设备台账、位置分布、巡检维修、审批处置等关键数据，构建统一资产运营指挥入口。
            </p>
          </div>

          <div className="login1-asset-visual relative z-10 mx-auto mt-8 h-[330px] max-w-[620px]">
            <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-[36px] border border-[#5ab4ff]/30 bg-[linear-gradient(145deg,rgba(37,99,235,.42),rgba(20,184,166,.16))] shadow-[0_0_80px_rgba(37,99,235,.36)]" />
            <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-3xl border border-white/20 bg-[#06152d]/70 shadow-[inset_0_1px_30px_rgba(136,210,255,.18)]" />
            <Package className="absolute left-1/2 top-1/2 z-10 h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-[#d8f5ff] drop-shadow-[0_0_20px_rgba(94,220,255,.7)]" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 620 330" fill="none" aria-hidden="true">
              <ellipse cx="310" cy="166" rx="250" ry="104" stroke="rgba(94,220,255,.18)" strokeWidth="1" />
              <ellipse cx="310" cy="166" rx="210" ry="76" stroke="rgba(255,255,255,.11)" strokeWidth="1" />
              <path className="login1-flow-line" d="M112 166 C198 64 420 62 508 166" stroke="rgba(94,220,255,.62)" strokeWidth="2" />
              <path className="login1-flow-line" d="M114 190 C230 286 426 282 506 188" stroke="rgba(95,255,193,.52)" strokeWidth="2" />
              <path className="login1-flow-line" d="M310 58 C356 112 356 220 310 274" stroke="rgba(180,197,255,.46)" strokeWidth="2" />
              <path className="login1-flow-line" d="M310 58 C264 112 264 220 310 274" stroke="rgba(180,197,255,.35)" strokeWidth="2" />
              <g className="login1-node-glow">
                <circle cx="112" cy="166" r="24" fill="rgba(37,99,235,.28)" stroke="rgba(180,213,255,.65)" />
                <path d="M100 166h24M112 154v24" stroke="rgba(230,246,255,.82)" strokeWidth="2" />
              </g>
              <g className="login1-node-glow" style={{ animationDelay: '.4s' }}>
                <circle cx="508" cy="166" r="24" fill="rgba(20,184,166,.24)" stroke="rgba(150,255,225,.62)" />
                <path d="M496 158h24v18h-24zM502 152h12" stroke="rgba(230,246,255,.82)" strokeWidth="2" />
              </g>
              <g className="login1-node-glow" style={{ animationDelay: '.8s' }}>
                <circle cx="310" cy="58" r="22" fill="rgba(255,212,92,.20)" stroke="rgba(255,221,132,.64)" />
                <path d="M300 62l10-16 10 16zM300 66h20" stroke="rgba(255,246,218,.86)" strokeWidth="2" />
              </g>
              <g className="login1-node-glow" style={{ animationDelay: '1.2s' }}>
                <circle cx="310" cy="274" r="22" fill="rgba(255,79,154,.18)" stroke="rgba(255,142,189,.56)" />
                <path d="M300 266h20v16h-20zM306 260h8" stroke="rgba(255,230,241,.84)" strokeWidth="2" />
              </g>
            </svg>
          </div>

          <div className="relative z-10 mt-8 grid grid-cols-3 gap-4">
            {[
              ['资产总量', '12,846', '+18%'],
              ['在线设备', '9,732', '实时同步'],
              ['待办流程', '128', '需处理'],
            ].map(([label, value, tag]) => (
              <div key={label} className="login1-asset-card rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#88a0c2]">{label}</p>
                <strong className="mt-3 block text-2xl font-semibold text-white">{value}</strong>
                <span className="mt-2 inline-flex rounded-full bg-[#2563eb]/20 px-2.5 py-1 text-[11px] font-medium text-[#9ed8ff]">{tag}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="login1-panel-column relative z-10 flex w-full max-w-[480px] flex-col items-center justify-self-end">
        <div
          className="glass-card w-full rounded-xl p-8 mb-8"
          style={{
            background: 'rgba(23, 31, 51, 0.6)',
            backdropFilter: 'blur(24px)',
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
              Secure Asset Gateway
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
                  className="h-5 w-5 rounded border-[#434655] bg-[#2d3449] text-[#2563eb] focus:ring-offset-[#0b1326] focus:ring-[#2563eb]"
                />
                <span className="text-sm font-medium text-[#c3c6d7] group-hover:text-[#dae2fd] transition-colors">
                  记住我
                </span>
              </label>
              <a className="text-sm font-medium text-[#b4c5ff] hover:text-[#adc6ff] transition-colors underline-offset-4 hover:underline" href="#">
                忘记密码？
              </a>
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
                  background: 'rgba(23, 31, 51, 0.6)',
                  backdropFilter: 'blur(24px)',
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

        <footer className="mt-12 text-center">
          <p className="text-xs text-[#434655]">© 2026 资产管理系统. All rights reserved.</p>
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
