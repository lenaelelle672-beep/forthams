import { Package, ShieldCheck } from "lucide-react";
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
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-6">
        <div className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
          正在加载认证状态...
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[calc(var(--radius-xl)+8px)] border border-border bg-background shadow-sm lg:grid-cols-[1.15fr_0.85fr]">
          <section className="hidden flex-col justify-between border-r border-border bg-card px-10 py-12 lg:flex">
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Package className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">forthAMS</p>
                  <h1 className="text-3xl font-semibold text-foreground">企业资产管理系统</h1>
                </div>
              </div>

              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm text-muted-foreground">
                  <ShieldCheck className="size-4 text-primary" />
                  JWT 身份认证已接入
                </div>
                <p className="max-w-md text-base leading-7 text-muted-foreground">
                  登录后即可访问仪表板、台账、审批和数据分析等受保护页面，认证状态将自动持久化并随请求携带。
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "受保护页面", value: "10+" },
                { label: "认证方式", value: "JWT" },
                { label: "会话状态", value: "持久化" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center justify-center px-6 py-10 sm:px-10">
            <Card className="w-full max-w-md border-border shadow-none">
              <CardHeader className="space-y-2">
                <CardTitle className="text-2xl font-semibold text-foreground">
                  欢迎登录
                </CardTitle>
                <CardDescription>
                  请输入用户名和密码以访问受保护的系统页面
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-5"
                  onSubmit={handleSubmit}
                >
                  <div className="space-y-2">
                    <Label htmlFor="username">用户名</Label>
                    <Input
                      id="username"
                      autoComplete="username"
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

                  <div className="space-y-2">
                    <Label htmlFor="password">密码</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
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

                  {error ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}

                  <Button className="w-full" disabled={submitting} type="submit" aria-busy={submitting}>
                    {submitting ? "登录中..." : "登录并进入仪表板"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
