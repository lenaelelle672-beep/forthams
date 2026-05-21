import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  KeyRound,
  LockKeyhole,
  Package,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";

interface LoginLocationState {
  from?: {
    pathname?: string;
  };
}

const platformModules = [
  {
    title: "统一资产台账",
    description: "资产、位置、供应商和责任人信息在一个视图中保持同步。",
    icon: Package,
  },
  {
    title: "审批流程闭环",
    description: "处置、折旧、报废等关键操作进入可追踪的审批链路。",
    icon: ClipboardCheck,
  },
  {
    title: "实时运营看板",
    description: "登录后直达仪表板，快速识别待办、风险和资产价值变化。",
    icon: BarChart3,
  },
] as const;

const trustSignals = ["JWT 安全会话", "角色权限控制", "操作审计留痕"];

const testAccount = {
  username: "admin",
  password: "admin123",
};

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);

  const from =
    (location.state as LoginLocationState | null)?.from?.pathname ?? "/";

  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let w = 0;
    let h = 0;
    const PARTICLE_COUNT = 70;
    const CONNECT_DIST = 150;

    type Particle = { x: number; y: number; vx: number; vy: number; r: number };

    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59, 130, 246, 0.4)";
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const username = formData.username.trim();
    const password = formData.password;

    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await login({ username, password });
      navigate(from, { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "登录失败，请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060b18] px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-[#1e3a5f] bg-[#0a1628] px-5 py-4 text-sm text-gray-500 shadow-xl shadow-blue-950/20 backdrop-blur">
          <div className="size-2.5 animate-pulse rounded-full bg-blue-600" />
          正在加载认证状态...
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060b18] text-slate-100">
      <style>{`
        @keyframes loginOrbitalDrift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(36px, -28px, 0) scale(1.08); }
        }

        @keyframes loginGridFloat {
          0% { background-position: 0 0, 0 0; }
          100% { background-position: 72px 48px, -48px 72px; }
        }

        @keyframes loginSignalSweep {
          0% { transform: translateX(-62%) rotate(10deg); opacity: 0; }
          18%, 62% { opacity: 0.15; }
          100% { transform: translateX(82%) rotate(10deg); opacity: 0; }
        }

        @keyframes loginNodePulse {
          0%, 100% { opacity: 0.38; transform: scale(0.92); }
          50% { opacity: 0.88; transform: scale(1.08); }
        }

        @keyframes loginScanLine {
          0% { top: -10%; }
          100% { top: 110%; }
        }

        @keyframes loginRadarSweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes loginDataFlow {
          0% { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }

        @keyframes loginFloatUp {
          0% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { opacity: 1; }
          100% { transform: translateY(-60px) scale(0.5); opacity: 0; }
        }

        @keyframes loginHexSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(60deg); }
        }

        @keyframes loginCodeFlicker {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
          25%, 75% { opacity: 0.5; }
        }

        .login-animated-bg {
          background:
            radial-gradient(circle at 18% 18%, rgba(37, 99, 235, 0.12), transparent 32%),
            radial-gradient(circle at 82% 24%, rgba(14, 165, 233, 0.08), transparent 30%),
            radial-gradient(circle at 50% 80%, rgba(59, 130, 246, 0.06), transparent 40%),
            linear-gradient(135deg, #060b18 0%, #0a1628 48%, #0f172a 100%);
        }

        .login-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(64px);
          will-change: transform;
          animation: loginOrbitalDrift 14s ease-in-out infinite;
        }

        .login-orb-primary {
          left: -7rem;
          top: -12%;
          width: 22rem;
          height: 22rem;
          background: rgba(37, 99, 235, 0.18);
        }

        .login-orb-secondary {
          right: -8rem;
          top: 6rem;
          width: 28rem;
          height: 28rem;
          background: rgba(14, 165, 233, 0.12);
          animation-delay: -5s;
        }

        .login-orb-tertiary {
          bottom: -14rem;
          left: 34%;
          width: 32rem;
          height: 32rem;
          background: rgba(59, 130, 246, 0.08);
          animation-delay: -9s;
        }

        .login-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(59, 130, 246, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.045) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(circle at center, black, transparent 78%);
          animation: loginGridFloat 28s linear infinite;
        }

        .login-sweep {
          position: absolute;
          top: -35%;
          bottom: -35%;
          left: 24%;
          width: 34%;
          background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.15), transparent);
          animation: loginSignalSweep 13s ease-in-out infinite;
        }

        .login-scan {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent 5%, rgba(59, 130, 246, 0.4) 20%, rgba(14, 165, 233, 0.6) 50%, rgba(59, 130, 246, 0.4) 80%, transparent 95%);
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), 0 0 60px rgba(59, 130, 246, 0.1);
          animation: loginScanLine 6s linear infinite;
          pointer-events: none;
        }

        .login-node {
          position: absolute;
          width: 0.65rem;
          height: 0.65rem;
          border-radius: 9999px;
          border: 1px solid rgba(59, 130, 246, 0.4);
          background: rgba(59, 130, 246, 0.3);
          box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.06), 0 0 12px rgba(59, 130, 246, 0.15);
          animation: loginNodePulse 4.8s ease-in-out infinite;
        }

        .login-radar {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(59, 130, 246, 0.12);
        }

        .login-radar::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 50%;
          height: 2px;
          background: linear-gradient(90deg, rgba(59, 130, 246, 0.6), transparent);
          transform-origin: left center;
          animation: loginRadarSweep 6s linear infinite;
        }

        .login-radar-1 {
          right: 8%;
          top: 12%;
          width: 180px;
          height: 180px;
        }
        .login-radar-1::before {
          content: '';
          position: absolute;
          inset: 25%;
          border-radius: 50%;
          border: 1px solid rgba(59, 130, 246, 0.08);
        }

        .login-radar-2 {
          left: 5%;
          bottom: 10%;
          width: 140px;
          height: 140px;
          animation: loginRadarSweep 8s linear infinite reverse;
        }
        .login-radar-2::before {
          content: '';
          position: absolute;
          inset: 30%;
          border-radius: 50%;
          border: 1px solid rgba(14, 165, 233, 0.1);
        }

        .login-data-stream {
          position: absolute;
          width: 1px;
          height: 80px;
          animation: loginDataFlow linear infinite;
        }

        .login-hex-float {
          position: absolute;
          animation: loginFloatUp 8s ease-out infinite;
        }

        .login-code-block {
          position: absolute;
          font-family: 'Courier New', monospace;
          font-size: 10px;
          line-height: 1.6;
          color: rgba(59, 130, 246, 0.25);
          white-space: pre;
          animation: loginCodeFlicker 4s ease-in-out infinite;
          pointer-events: none;
          user-select: none;
        }

        .login-particle-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .login-hero-orbit {
          position: relative;
          width: min(44vw, 520px);
          aspect-ratio: 1;
          border-radius: 50%;
          background:
            radial-gradient(circle at center, rgba(59, 130, 246, 0.16), transparent 28%),
            repeating-radial-gradient(circle at center, rgba(96, 165, 250, 0.14) 0 1px, transparent 1px 48px);
          box-shadow: inset 0 0 80px rgba(59, 130, 246, 0.1), 0 0 80px rgba(37, 99, 235, 0.1);
        }

        .login-hero-orbit::before,
        .login-hero-orbit::after {
          content: '';
          position: absolute;
          inset: 12%;
          border-radius: 50%;
          border: 1px solid rgba(96, 165, 250, 0.18);
          animation: loginRadarSweep 10s linear infinite;
        }

        .login-hero-orbit::after {
          inset: 25%;
          border-style: dashed;
          animation-duration: 14s;
          animation-direction: reverse;
        }

        .login-hero-card {
          border: 1px solid rgba(59, 130, 246, 0.24);
          background: linear-gradient(135deg, rgba(10, 22, 40, 0.76), rgba(15, 23, 42, 0.54));
          box-shadow: 0 18px 60px rgba(15, 23, 42, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(18px);
        }

        .login-hero-pulse {
          animation: loginNodePulse 3.5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .login-animated-bg *, .login-grid, .login-sweep, .login-scan {
            animation: none !important;
          }
        }
      `}</style>

      <div className="login-animated-bg pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <canvas ref={particleCanvasRef} className="login-particle-canvas" />

        <div className="login-orb login-orb-primary" />
        <div className="login-orb login-orb-secondary" />
        <div className="login-orb login-orb-tertiary" />
        <div className="login-grid" />
        <div className="login-sweep" />
        <div className="login-scan" />

        <span className="login-node left-[16%] top-[26%]" />
        <span className="login-node right-[22%] top-[18%]" style={{ animationDelay: '-1.5s' }} />
        <span className="login-node bottom-[24%] left-[48%]" style={{ animationDelay: '-3s' }} />
        <span className="login-node left-[8%] bottom-[32%]" style={{ animationDelay: '-2s' }} />
        <span className="login-node right-[12%] bottom-[40%]" style={{ animationDelay: '-4s' }} />
        <span className="login-node left-[38%] top-[12%]" style={{ animationDelay: '-0.8s' }} />

        <div className="login-radar login-radar-1" />
        <div className="login-radar login-radar-2" />

        <div className="login-data-stream left-[10%]" style={{ height: '100px', background: 'linear-gradient(to bottom, transparent, rgba(59,130,246,0.3), transparent)', animationDuration: '7s', animationDelay: '0s' }} />
        <div className="login-data-stream left-[25%]" style={{ height: '60px', background: 'linear-gradient(to bottom, transparent, rgba(14,165,233,0.25), transparent)', animationDuration: '5s', animationDelay: '-2s' }} />
        <div className="login-data-stream right-[20%]" style={{ height: '120px', background: 'linear-gradient(to bottom, transparent, rgba(59,130,246,0.2), transparent)', animationDuration: '9s', animationDelay: '-4s' }} />
        <div className="login-data-stream right-[35%]" style={{ height: '80px', background: 'linear-gradient(to bottom, transparent, rgba(14,165,233,0.3), transparent)', animationDuration: '6s', animationDelay: '-1s' }} />
        <div className="login-data-stream left-[55%]" style={{ height: '90px', background: 'linear-gradient(to bottom, transparent, rgba(59,130,246,0.2), transparent)', animationDuration: '8s', animationDelay: '-3s' }} />

        <div className="login-hex-float left-[15%] bottom-[15%]" style={{ animationDelay: '-1s' }}>
          <svg width="32" height="36" viewBox="0 0 32 36" fill="none">
            <polygon points="16,0 32,9 32,27 16,36 0,27 0,9" stroke="rgba(59,130,246,0.2)" strokeWidth="1" fill="rgba(59,130,246,0.03)" />
          </svg>
        </div>
        <div className="login-hex-float right-[18%] top-[35%]" style={{ animationDelay: '-3.5s' }}>
          <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
            <polygon points="12,0 24,7 24,21 12,28 0,21 0,7" stroke="rgba(14,165,233,0.2)" strokeWidth="1" fill="rgba(14,165,233,0.03)" />
          </svg>
        </div>
        <div className="login-hex-float left-[42%] top-[8%]" style={{ animationDelay: '-5s' }}>
          <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
            <polygon points="10,0 20,6 20,18 10,24 0,18 0,6" stroke="rgba(59,130,246,0.15)" strokeWidth="1" fill="rgba(59,130,246,0.02)" />
          </svg>
        </div>
        <div className="login-hex-float right-[8%] bottom-[20%]" style={{ animationDelay: '-6.5s' }}>
          <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
            <polygon points="14,0 28,8 28,24 14,32 0,24 0,8" stroke="rgba(59,130,246,0.18)" strokeWidth="1" fill="rgba(59,130,246,0.02)" />
          </svg>
        </div>

        <div className="login-code-block left-[6%] top-[45%]">{`0x4A2F → asset.id
  status: 在用
  scan(deep) ✓`}</div>
        <div className="login-code-block right-[6%] bottom-[30%]" style={{ animationDelay: '-2s' }}>{`node.cluster(3)
  latency: 12ms
  ▓▓▓▓▓░░ 72%`}</div>
        <div className="login-code-block left-[70%] top-[10%]" style={{ animationDelay: '-1.5s', fontSize: '9px' }}>{`AUTH/JWT/RBAC
  enc: AES-256
  ████████ OK`}</div>
        <div className="login-code-block right-[45%] bottom-[8%]" style={{ animationDelay: '-3s', fontSize: '9px' }}>{`sync.stream()
  δ: 0.003ms
  ──► complete`}</div>
      </div>

      <div className="relative z-10 grid min-h-screen items-center gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:px-16 xl:px-24">
        <section className="hidden min-h-[640px] items-center lg:flex" aria-label="资产管理平台能力展示">
          <div className="w-full max-w-3xl">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                <Package className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300/80">Asset Management Platform</p>
                <h1 className="text-3xl font-bold tracking-tight text-white">资产管理平台</h1>
              </div>
            </div>

            <div className="relative">
              <div className="login-hero-orbit mx-auto">
                <div className="absolute left-1/2 top-1/2 flex size-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2rem] border border-blue-400/25 bg-blue-500/10 shadow-2xl shadow-blue-500/20 backdrop-blur">
                  <Package className="size-12 text-blue-200" />
                </div>
                <div className="login-hero-pulse absolute left-[16%] top-[22%] size-3 rounded-full bg-cyan-300 shadow-[0_0_22px_rgba(103,232,249,0.75)]" />
                <div className="login-hero-pulse absolute bottom-[24%] left-[30%] size-2 rounded-full bg-blue-300 shadow-[0_0_18px_rgba(147,197,253,0.72)]" style={{ animationDelay: '-1s' }} />
                <div className="login-hero-pulse absolute right-[18%] top-[38%] size-2.5 rounded-full bg-sky-300 shadow-[0_0_20px_rgba(125,211,252,0.72)]" style={{ animationDelay: '-2s' }} />
              </div>

              <div className="absolute left-0 top-8 w-64 rounded-2xl p-4 login-hero-card">
                <p className="text-xs uppercase tracking-[0.22em] text-blue-300/70">Asset Ledger</p>
                <div className="mt-3 text-3xl font-semibold text-white">12,846</div>
                <p className="mt-1 text-xs text-slate-400">资产全生命周期在线追踪</p>
              </div>

              <div className="absolute bottom-10 right-2 w-72 rounded-2xl p-4 login-hero-card">
                <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                  <span>运行态势</span>
                  <span className="text-cyan-300">实时同步</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['在用', '闲置', '审批'].map((item, index) => (
                    <div key={item} className="rounded-xl border border-blue-400/10 bg-blue-500/10 p-3 text-center">
                      <div className="text-lg font-semibold text-white">{[86, 9, 5][index]}%</div>
                      <div className="mt-1 text-[10px] text-slate-400">{item}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-3 xl:grid-cols-3">
              {platformModules.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl p-4 login-hero-card">
                    <Icon className="size-5 text-blue-300" />
                    <p className="mt-3 text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center lg:min-h-0 lg:justify-end" aria-label="登录表单">
          <div className="relative w-full max-w-[440px]">
            <div className="mb-7 text-center lg:text-left">
              <div className="mb-4 flex items-center justify-center gap-3 lg:justify-start">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-600/90 text-white shadow-xl shadow-blue-600/30 ring-1 ring-blue-400/20">
                  <Package className="size-7" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300/80">Asset Platform</p>
                  <h2 className="text-2xl font-bold text-white">资产管理平台</h2>
                </div>
              </div>
              <p className="text-sm text-slate-400">统一资产台账、流程审批、折旧管理与审计追踪</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#1e3a5f]/50 bg-[#0a1628]/88 shadow-2xl shadow-blue-950/40 backdrop-blur-xl">
            <div className="px-7 pt-7 pb-2 sm:px-8 sm:pt-8">
              <div className="mb-1 flex items-center gap-2">
                <LockKeyhole className="size-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-100">安全登录</span>
              </div>
              <p className="text-xs text-gray-400">使用系统账号进入受保护的资产管理工作台</p>
            </div>
            <div className="px-7 pb-7 sm:px-8">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500" htmlFor="username">用户名</Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
                    <Input
                      id="username"
                      autoComplete="username"
                      className="h-11 rounded-lg border-[#1e3a5f] bg-[#0f172a] pl-10 text-sm text-slate-100 shadow-sm placeholder:text-slate-600 focus-visible:border-blue-500/60 focus-visible:ring-blue-500/15"
                      placeholder="请输入用户名"
                      value={formData.username}
                      disabled={submitting}
                      onChange={(event) => setFormData((c) => ({ ...c, username: event.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500" htmlFor="password">密码</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      className="h-11 rounded-lg border-[#1e3a5f] bg-[#0f172a] pl-10 text-sm text-slate-100 shadow-sm placeholder:text-slate-600 focus-visible:border-blue-500/60 focus-visible:ring-blue-500/15"
                      placeholder="请输入密码"
                      value={formData.password}
                      disabled={submitting}
                      onChange={(event) => setFormData((c) => ({ ...c, password: event.target.value }))}
                      required
                    />
                  </div>
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-400" role="alert">
                    {error}
                  </div>
                ) : null}

                <Button
                  aria-busy={submitting}
                  className="h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/30 focus-visible:ring-blue-500/30"
                  data-testid="btn-login"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? "登录中..." : "登录并进入仪表板"}
                </Button>

                <div className="rounded-xl border border-[#1e3a5f]/30 bg-[#1e3a5f]/15 p-3 text-xs">
                  <div className="mb-2 flex items-center gap-1.5 font-medium text-blue-400/80">
                    <ShieldCheck className="size-3.5" />
                    测试账号
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-[#0f172a] px-2.5 py-1.5">
                      <span className="text-[10px] text-slate-600">用户名</span>
                      <code className="block font-mono text-xs font-semibold text-blue-300">{testAccount.username}</code>
                    </div>
                    <div className="rounded-lg bg-[#0f172a] px-2.5 py-1.5">
                      <span className="text-[10px] text-slate-600">密码</span>
                      <code className="block font-mono text-xs font-semibold text-blue-300">{testAccount.password}</code>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4 pt-1 text-[10px] text-slate-600">
                  {trustSignals.map((s) => (
                    <span key={s} className="flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-blue-500/50" />
                      {s}
                    </span>
                  ))}
                </div>
              </form>
            </div>
          </div>
          </div>
        </section>
      </div>
    </div>
  );
}
