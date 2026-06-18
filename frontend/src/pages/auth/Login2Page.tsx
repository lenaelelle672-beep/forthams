import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Lock, User, ShieldCheck, Package, Building2, Wrench, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { login } from '@/api/auth';

const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

type LoginForm = z.infer<typeof loginSchema>;

const isDev = import.meta.env.DEV;
const envDemoUser = import.meta.env.VITE_DEMO_USERNAME;
const envDemoPass = import.meta.env.VITE_DEMO_PASSWORD;

const DEMO_ACCOUNTS = isDev
  ? [
      { label: '系统管理员', username: envDemoUser || 'admin', password: envDemoPass || 'admin123', Icon: ShieldCheck },
      { label: '资产管理员', username: 'asset', password: 'asset123', Icon: Package },
      { label: '部门负责人', username: 'manager', password: 'manager123', Icon: Building2 },
      { label: '运维人员', username: 'staff', password: 'staff123', Icon: Wrench },
    ]
  : envDemoUser && envDemoPass
    ? [{ label: '演示账号', username: envDemoUser, password: envDemoPass, Icon: ShieldCheck }]
    : [];

/* ═══════════════════════════════════════════════════════════
   Canvas 全屏动画 — 资产管理网络拓扑
   ═══════════════════════════════════════════════════════════ */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'hub' | 'asset' | 'data';
  color: string;
  alpha: number;
  pulsePhase: number;
  pulseSpeed: number;
}

interface Pulse {
  progress: number;
  speed: number;
  si: number;
  ti: number;
  color: string;
  size: number;
}

const PALETTE = ['#3b82f6', '#6366f1', '#06b6d4', '#8b5cf6', '#22d3ee'];
const CONNECTION_DIST = 180;
const HUB_COUNT = 6;
const ASSET_COUNT = 40;
const MAX_PULSES = 30;

function createParticles(w: number, h: number): Particle[] {
  const particles: Particle[] = [];

  for (let i = 0; i < HUB_COUNT; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: 4 + Math.random() * 3,
      type: 'hub',
      color: PALETTE[i % PALETTE.length],
      alpha: 0.9,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.015 + Math.random() * 0.01,
    });
  }

  for (let i = 0; i < ASSET_COUNT; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      radius: 1.5 + Math.random() * 2,
      type: 'asset',
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      alpha: 0.5 + Math.random() * 0.4,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.02,
    });
  }

  return particles;
}

function drawHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rotation: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + rotation;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const frameRef = useRef(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const sizeRef = useRef({ w: 0, h: 0 });

  const handleMouse = useCallback((e: MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      if (particlesRef.current.length === 0) {
        particlesRef.current = createParticles(w, h);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouse);

    let raf: number;
    let hexRotation = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const { w, h } = sizeRef.current;
      const particles = particlesRef.current;
      const pulses = pulsesRef.current;
      const frame = frameRef.current++;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, w, h);

      // ── 背景渐变 ──
      const bgGrad = ctx.createRadialGradient(w * 0.3, h * 0.3, 0, w * 0.5, h * 0.5, w * 0.8);
      bgGrad.addColorStop(0, '#0c1a32');
      bgGrad.addColorStop(0.5, '#071225');
      bgGrad.addColorStop(1, '#040b18');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // ── 网格 ──
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.03)';
      ctx.lineWidth = 0.5;
      const gridSize = 60;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // ── 旋转六边形装饰 ──
      hexRotation += 0.001;
      const hexPositions = [
        { x: w * 0.15, y: h * 0.2, r: 80 },
        { x: w * 0.85, y: h * 0.75, r: 100 },
        { x: w * 0.7, y: h * 0.15, r: 60 },
        { x: w * 0.25, y: h * 0.8, r: 70 },
      ];
      for (const hp of hexPositions) {
        drawHexagon(ctx, hp.x, hp.y, hp.r, hexRotation);
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();
        drawHexagon(ctx, hp.x, hp.y, hp.r * 0.6, -hexRotation * 1.5);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.04)';
        ctx.stroke();
      }

      // ── 扫描线 ──
      const scanY = ((frame * 0.5) % (h + 200)) - 100;
      const scanGrad = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
      scanGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
      scanGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.04)');
      scanGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 60, w, 120);

      // ── 更新粒子位置 ──
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.pulsePhase += p.pulseSpeed;

        if (p.x < -50) p.x = w + 50;
        if (p.x > w + 50) p.x = -50;
        if (p.y < -50) p.y = h + 50;
        if (p.y > h + 50) p.y = -50;

        // 鼠标交互：轻微排斥
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200 && dist > 0) {
          const force = (200 - dist) / 200 * 0.15;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // 速度衰减
        p.vx *= 0.998;
        p.vy *= 0.998;
      }

      // ── 绘制连接线 ──
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[j].x - particles[i].x;
          const dy = particles[j].y - particles[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.25;
            const isHub = particles[i].type === 'hub' || particles[j].type === 'hub';
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = isHub
              ? `rgba(99, 102, 241, ${alpha * 1.5})`
              : `rgba(59, 130, 246, ${alpha})`;
            ctx.lineWidth = isHub ? 1.2 : 0.6;
            ctx.stroke();

            // 随机生成数据包脉冲
            if (dist < CONNECTION_DIST * 0.7 && Math.random() < 0.0008 && pulses.length < MAX_PULSES) {
              pulses.push({
                progress: 0,
                speed: 0.005 + Math.random() * 0.008,
                si: i,
                ti: j,
                color: particles[i].color,
                size: 1.5 + Math.random() * 2,
              });
            }
          }
        }
      }

      // ── 更新 & 绘制数据包脉冲 ──
      for (let k = pulses.length - 1; k >= 0; k--) {
        const pulse = pulses[k];
        pulse.progress += pulse.speed;
        if (pulse.progress >= 1) {
          pulses.splice(k, 1);
          continue;
        }
        const sp = particles[pulse.si];
        const tp = particles[pulse.ti];
        if (!sp || !tp) { pulses.splice(k, 1); continue; }
        const px = sp.x + (tp.x - sp.x) * pulse.progress;
        const py = sp.y + (tp.y - sp.y) * pulse.progress;

        ctx.beginPath();
        ctx.arc(px, py, pulse.size, 0, Math.PI * 2);
        ctx.fillStyle = pulse.color;
        ctx.globalAlpha = 1 - pulse.progress * 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;

        // 脉冲拖尾
        const tailLen = 0.06;
        const tailStart = Math.max(0, pulse.progress - tailLen);
        const tx = sp.x + (tp.x - sp.x) * tailStart;
        const ty = sp.y + (tp.y - sp.y) * tailStart;
        const trailGrad = ctx.createLinearGradient(tx, ty, px, py);
        trailGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
        trailGrad.addColorStop(1, pulse.color);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(px, py);
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = pulse.size * 0.6;
        ctx.stroke();
      }

      // ── 绘制粒子 ──
      for (const p of particles) {
        const pulse = 1 + Math.sin(p.pulsePhase) * 0.3;
        const r = p.radius * pulse;

        if (p.type === 'hub') {
          // Hub 外发光
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
          glow.addColorStop(0, p.color + '30');
          glow.addColorStop(0.5, p.color + '08');
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.fillRect(p.x - r * 6, p.y - r * 6, r * 12, r * 12);

          // Hub 环
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = p.color + '25';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        // 粒子本体
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;

        // 粒子核心高光
        if (p.type === 'hub') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.7;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // ── 底部数据流文字 ──
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
      const dataStrings = [
        'ASSET_SYNC:OK', 'RFID_SCAN:ACTIVE', 'DEPRECIATION:CALC',
        'WORK_ORDER:FLOW', 'INVENTORY:COUNT', 'MAINTENANCE:QUEUE',
        '0xA3F2:VALID', 'NODE_MESH:STABLE', 'AUDIT_LOG:STREAM',
      ];
      for (let i = 0; i < 12; i++) {
        const str = dataStrings[i % dataStrings.length];
        const x = ((frame * 0.3 + i * 160) % (w + 200)) - 100;
        const y = h - 20 + Math.sin(frame * 0.01 + i) * 8;
        ctx.fillText(str, x, y);
      }

      // ── 鼠标附近光晕 ──
      if (mouse.x > 0 && mouse.y > 0) {
        const mouseGlow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 150);
        mouseGlow.addColorStop(0, 'rgba(59, 130, 246, 0.06)');
        mouseGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = mouseGlow;
        ctx.fillRect(mouse.x - 150, mouse.y - 150, 300, 300);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
    };
  }, [handleMouse]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════
   登录页面主组件
   ═══════════════════════════════════════════════════════════ */

export default function Login2Page() {
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
    setTimeout(() => loginMutation.mutate({ username, password }), 200);
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-slate-100">
      {/* 全屏 Canvas 动画背景 */}
      <NetworkCanvas />

      {/* 内容层 */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-[440px]">

          {/* 顶部品牌标识 */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200 backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
              forthAMS
            </div>
            <h1
              className="text-4xl font-bold tracking-tight sm:text-5xl"
              style={{
                backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #93c5fd 35%, #22d3ee 65%, #a78bfa 100%)',
                backgroundSize: '200% 200%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'login2-gradient 5s ease infinite',
              }}
            >
              资产管理系统
            </h1>
            <p className="mt-2 text-sm text-slate-400/80">
              统一资产、流程与审计的运营入口
            </p>
          </div>

          {/* 登录卡片 */}
          <div
            className="rounded-2xl border border-white/[0.08] p-6 sm:p-8"
            style={{
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(24px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* 顶部光线 */}
            <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              {/* 用户名 */}
              <div className="space-y-1.5">
                <label className="ml-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400" htmlFor="l2-username">
                  用户名
                </label>
                <div className="group relative flex items-center rounded-xl border border-white/[0.08] bg-white/[0.04] transition-all duration-200 focus-within:border-blue-400/50 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]">
                  <User className="absolute left-3.5 h-4 w-4 text-slate-500 transition-colors group-focus-within:text-blue-300" />
                  <input
                    {...register('username')}
                    id="l2-username"
                    type="text"
                    placeholder="请输入账号"
                    className="w-full border-none bg-transparent py-3 pl-11 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                  />
                </div>
                {errors.username && <p className="ml-1 text-xs text-red-300">{errors.username.message}</p>}
              </div>

              {/* 密码 */}
              <div className="space-y-1.5">
                <label className="ml-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400" htmlFor="l2-password">
                  密码
                </label>
                <div className="group relative flex items-center rounded-xl border border-white/[0.08] bg-white/[0.04] transition-all duration-200 focus-within:border-blue-400/50 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]">
                  <Lock className="absolute left-3.5 h-4 w-4 text-slate-500 transition-colors group-focus-within:text-blue-300" />
                  <input
                    {...register('password')}
                    id="l2-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    className="w-full border-none bg-transparent py-3 pl-11 pr-11 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 text-slate-500 transition-colors hover:text-slate-200"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="ml-1 text-xs text-red-300">{errors.password.message}</p>}
              </div>

              {/* 记住我 + 忘记密码 */}
              <div className="flex items-center justify-between">
                <label className="group flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-white/[0.06] text-blue-500 focus:ring-blue-400/40 focus:ring-offset-0"
                  />
                  <span className="text-xs text-slate-400 transition-colors group-hover:text-slate-200">记住用户名</span>
                </label>
                <button
                  type="button"
                  className="text-xs text-blue-300/70 transition-colors hover:text-blue-200"
                  onClick={() => toast.info('请联系管理员重置密码')}
                >
                  忘记密码？
                </button>
              </div>

              {/* 错误提示 */}
              {errorMsg && (
                <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
                  {errorMsg}
                </div>
              )}

              {/* 登录按钮 */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loginMutation.isPending}
                className="!h-11 w-full !rounded-xl !text-sm !font-semibold !shadow-lg !shadow-blue-500/25 transition-all hover:shadow-blue-500/40 active:scale-[0.98]"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #1d4ed8, #4f46e5, #0891b2)',
                }}
              >
                登录系统
              </Button>
            </form>

            {/* MaxKey SSO */}
            <div className="mt-5 border-t border-white/[0.06] pt-5">
              <a
                href={`${import.meta.env.VITE_API_BASE || ''}/api/oauth2/authorization/maxkey`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-xs font-medium text-slate-300 transition-all hover:border-blue-300/20 hover:bg-white/[0.08]"
              >
                <LogIn className="h-3.5 w-3.5" />
                MaxKey 单点登录
              </a>
            </div>

            {/* 快捷账号 */}
            {DEMO_ACCOUNTS.length > 0 && (
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">快捷账号</p>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-medium text-blue-300">演示环境</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map(({ label, username, password, Icon }) => (
                    <button
                      key={username}
                      type="button"
                      onClick={() => fillAndLogin(username, password)}
                      disabled={loginMutation.isPending}
                      className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-left transition-all hover:border-blue-400/20 hover:bg-white/[0.07] disabled:opacity-40"
                    >
                      <Icon className="h-3.5 w-3.5 text-blue-300/70" />
                      <span className="text-xs text-slate-300">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 底部 */}
          <footer className="mt-6 text-center text-[10px] text-slate-600">
            <p>&copy; 2026 forthAMS 资产管理系统</p>
          </footer>
        </div>
      </div>

      {/* 动画 keyframes */}
      <style>{`
        @keyframes login2-gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </main>
  );
}
