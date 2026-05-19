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
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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

  const from =
    (location.state as LoginLocationState | null)?.from?.pathname ?? "/";

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
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/85 px-5 py-4 text-sm text-gray-600 shadow-xl shadow-blue-950/5 backdrop-blur">
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
    <div className="relative min-h-screen overflow-hidden bg-[#f3f7fb] text-gray-950">
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
          18%, 62% { opacity: 0.28; }
          100% { transform: translateX(82%) rotate(10deg); opacity: 0; }
        }

        @keyframes loginNodePulse {
          0%, 100% { opacity: 0.38; transform: scale(0.92); }
          50% { opacity: 0.88; transform: scale(1.08); }
        }

        .login-animated-bg {
          background:
            radial-gradient(circle at 18% 18%, rgba(37, 99, 235, 0.18), transparent 32%),
            radial-gradient(circle at 82% 24%, rgba(14, 165, 233, 0.14), transparent 30%),
            linear-gradient(135deg, #f8fbff 0%, #edf4fb 48%, #f6f9fc 100%);
        }

        .login-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(54px);
          will-change: transform;
          animation: loginOrbitalDrift 14s ease-in-out infinite;
        }

        .login-orb-primary {
          left: -7rem;
          top: -12%;
          width: 22rem;
          height: 22rem;
          background: rgba(37, 99, 235, 0.26);
        }

        .login-orb-secondary {
          right: -8rem;
          top: 6rem;
          width: 28rem;
          height: 28rem;
          background: rgba(56, 189, 248, 0.2);
          animation-delay: -5s;
        }

        .login-orb-tertiary {
          bottom: -14rem;
          left: 34%;
          width: 32rem;
          height: 32rem;
          background: rgba(99, 102, 241, 0.12);
          animation-delay: -9s;
        }

        .login-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(15, 23, 42, 0.052) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15, 23, 42, 0.052) 1px, transparent 1px);
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
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
          animation: loginSignalSweep 13s ease-in-out infinite;
        }

        .login-node {
          position: absolute;
          width: 0.65rem;
          height: 0.65rem;
          border-radius: 9999px;
          border: 1px solid rgba(37, 99, 235, 0.32);
          background: rgba(255, 255, 255, 0.88);
          box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.055);
          animation: loginNodePulse 4.8s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .login-animated-bg *, .login-grid, .login-sweep {
            animation: none !important;
          }
        }
      `}</style>

      <div className="login-animated-bg pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="login-orb login-orb-primary" />
        <div className="login-orb login-orb-secondary" />
        <div className="login-orb login-orb-tertiary" />
        <div className="login-grid" />
        <div className="login-sweep" />
        <span className="login-node left-[16%] top-[26%]" />
        <span className="login-node right-[22%] top-[18%] [animation-delay:-1.5s]" />
        <span className="login-node bottom-[24%] left-[48%] [animation-delay:-3s]" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.82fr)] lg:px-10">
        <section className="hidden lg:block">
          <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/70 p-10 shadow-2xl shadow-blue-950/10 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                <Package className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">forthAMS</p>
                <h1 className="text-2xl font-semibold text-gray-950">企业资产管理系统</h1>
              </div>
            </div>

            <div className="mt-14 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                <ShieldCheck className="size-4" />
                安全登录入口
              </div>
              <div className="space-y-4">
                <p className="text-5xl font-semibold leading-tight tracking-[-0.05em] text-gray-950 [text-wrap:balance]">
                  让每一次资产流转都清晰可追踪
                </p>
                <p className="max-w-xl text-base leading-8 text-gray-600 [text-wrap:pretty]">
                  通过统一身份认证进入资产台账、审批流程、折旧管理和审计看板，保持关键资产数据与操作记录一致。
                </p>
              </div>
            </div>

            <div className="mt-12 grid gap-4">
              {platformModules.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="group flex gap-4 rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-100 hover:bg-white hover:shadow-lg hover:shadow-blue-950/5"
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-950">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-gray-600">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-wrap gap-3 border-t border-gray-200/70 pt-6">
              {trustSignals.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-2 rounded-full bg-gray-950 px-3 py-1.5 text-xs font-medium text-white shadow-sm"
                >
                  <CheckCircle2 className="size-3.5 text-blue-200" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                <Package className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">forthAMS</p>
                <h1 className="text-xl font-semibold text-gray-950">企业资产管理系统</h1>
              </div>
            </div>

            <Card className="w-full overflow-hidden rounded-[1.75rem] border-white/80 bg-white/90 shadow-2xl shadow-blue-950/10 backdrop-blur-xl">
              <CardHeader className="space-y-3 px-6 pt-7 sm:px-8 sm:pt-8">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <LockKeyhole className="size-6" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-semibold tracking-[-0.03em] text-gray-950">
                    欢迎登录
                  </CardTitle>
                  <CardDescription className="leading-6 text-gray-600">
                    使用系统账号进入受保护的资产管理工作台
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-5 px-0 pb-1 sm:px-2"
                  onSubmit={handleSubmit}
                >
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-700" htmlFor="username">用户名</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="username"
                        autoComplete="username"
                        className="h-12 rounded-xl border-gray-200 bg-white/90 pl-10 text-gray-950 shadow-sm transition-all placeholder:text-gray-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
                        placeholder="请输入用户名"
                        value={formData.username}
                        disabled={submitting}
                        onChange={(event) =>
                          setFormData((current) => ({
                            ...current,
                            username: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-gray-700" htmlFor="password">密码</Label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        className="h-12 rounded-xl border-gray-200 bg-white/90 pl-10 text-gray-950 shadow-sm transition-all placeholder:text-gray-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
                        placeholder="请输入密码"
                        value={formData.password}
                        disabled={submitting}
                        onChange={(event) =>
                          setFormData((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>

                  {error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                      {error}
                    </div>
                  ) : null}

                  <Button
                    aria-busy={submitting}
                    className="h-12 w-full rounded-xl bg-blue-600 text-base text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-blue-600/30 focus-visible:ring-blue-500/30"
                    data-testid="btn-login"
                    disabled={submitting}
                    type="submit"
                  >
                    {submitting ? "登录中..." : "登录并进入仪表板"}
                  </Button>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-gray-700">
                    <div className="mb-3 flex items-center gap-2 font-medium text-blue-700">
                      <ShieldCheck className="size-4" />
                      测试账号
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl bg-white/80 px-3 py-2 shadow-sm">
                        <p className="text-xs text-gray-500">用户名</p>
                        <code className="mt-1 block font-mono text-sm font-semibold text-gray-950">
                          {testAccount.username}
                        </code>
                      </div>
                      <div className="rounded-xl bg-white/80 px-3 py-2 shadow-sm">
                        <p className="text-xs text-gray-500">密码</p>
                        <code className="mt-1 block font-mono text-sm font-semibold text-gray-950">
                          {testAccount.password}
                        </code>
                      </div>
                    </div>
                  </div>

                  <p className="flex items-center justify-center gap-2 text-center text-xs text-gray-500">
                    <ShieldCheck className="size-3.5 text-blue-600" />
                    登录成功后将按原访问路径自动跳转
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
