/**
 * @file pages/auth/LoginPage.tsx
 * @description UNIVIEW 固定资产品牌导向登录页 — 固定资产平台入口
 *
 * 设计原则:
 *   - 品牌优先：左侧突出 UNIVIEW 品牌 + 固定资产产品名 + 核心能力
 *   - 简洁专业：无 Canvas / Three.js 重动效，纯 CSS 轻量渐变
 *   - 响应式：桌面双栏，移动端单栏居中
 *   - 代码清晰：表单逻辑拆入 hooks，UI 拆入 components
 */

import { Shield, Package } from 'lucide-react';
import { useLoginForm } from './hooks/useLoginForm';
import { LoginFormFields, DemoAccounts, SsoButton } from './components';

/* ── Brand tagline (overlaid on hero image) ────────────────────────────────── */
const TAGLINES = [
  { text: '资产全生命周期管理', sub: '从采购到报废，一个平台全覆盖' },
  { text: '智能审批 · 实时盘点', sub: '流程闭环，数据驱动决策' },
] as const;

/* ── LoginPage ──────────────────────────────────────────────────────────────── */

export default function LoginPage() {
  const { form, errorMsg, rememberMe, setRememberMe, isPending, handleSubmit, fillAndLogin } = useLoginForm();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060e1e] text-slate-100">
      {/* ── Subtle background gradient ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 15% 40%, rgba(29,78,216,0.12) 0%, transparent 60%),' +
            'radial-gradient(ellipse 60% 50% at 80% 20%, rgba(14,165,233,0.08) 0%, transparent 50%)',
        }}
      />

      {/* ── Two-column layout ── */}
      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_520px]">
        {/* ══════════════════════════════════════════════════════════════════════
            LEFT: Hero image with brand overlay
            ══════════════════════════════════════════════════════════════════════ */}
        <section className="relative hidden lg:block">
          {/* Full-bleed background image */}
          <img
            src="/images/login-hero.png"
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Gradient overlay for text readability */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to right, rgba(6,14,30,0.82) 0%, rgba(6,14,30,0.55) 40%, rgba(6,14,30,0.35) 70%, rgba(6,14,30,0.70) 100%),' +
                'linear-gradient(to top, rgba(6,14,30,0.85) 0%, transparent 40%)',
            }}
          />

          {/* Brand content overlay */}
          <div className="relative z-10 flex h-full flex-col justify-between px-[6vw] py-12">
            {/* Top: brand badge */}
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 py-1.5 backdrop-blur-md">
              <Package className="h-3.5 w-3.5 text-blue-300" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-100/90">
                UNIVIEW · 宇视科技
              </span>
            </div>

            {/* Middle: headline */}
            <div className="max-w-[520px]">
              <h1 className="text-[2.75rem] font-bold leading-[1.15] tracking-[-0.03em] text-white drop-shadow-lg xl:text-[3.25rem]">
                固定资产平台的
                <span className="block bg-gradient-to-r from-blue-300 to-cyan-200 bg-clip-text text-transparent">
                  智能运维入口
                </span>
              </h1>
              <p className="mt-5 max-w-[440px] text-[15px] leading-relaxed text-slate-300/90 drop-shadow">
                UNIVIEW 固定资产连接资产台账、流程审批、盘点巡检和运营分析，
                帮助团队高效进入固定资产工作台。
              </p>

              {/* Tagline chips */}
              <div className="mt-8 flex flex-wrap gap-3">
                {TAGLINES.map((t) => (
                  <div
                    key={t.text}
                    className="rounded-xl border border-white/[0.1] bg-white/[0.06] px-4 py-2.5 backdrop-blur-md"
                  >
                    <p className="text-sm font-semibold text-white">{t.text}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{t.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom: subtle footer strip */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
              <span className="tracking-wide">System Online · 运行稳定</span>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            RIGHT: Login form
            ══════════════════════════════════════════════════════════════════════ */}
        <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[420px]">
            {/* ── Mobile brand header (visible below lg) ── */}
            <div className="mb-8 text-center lg:hidden">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/90 shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/20">
                <Package className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">UNIVIEW 固定资产</h2>
              <p className="mt-1 text-[13px] text-slate-500">宇视科技 · 固定资产平台</p>
            </div>

            {/* ── Login card ── */}
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b1628]/70 p-7 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-8">
              {/* Top accent line */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background: 'linear-gradient(90deg, transparent 10%, rgba(59,130,246,0.4) 50%, transparent 90%)',
                }}
              />

              {/* Card header */}
              <header className="mb-7 hidden lg:block">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/80 to-blue-500/80 shadow-lg shadow-blue-600/20 ring-1 ring-blue-400/15">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-bold tracking-tight text-white">UNIVIEW 固定资产</p>
                    <p className="text-[11px] tracking-wide text-slate-500">固定资产平台</p>
                  </div>
                </div>
                <h1 className="text-[22px] font-semibold leading-snug text-white">
                  欢迎回来
                </h1>
                <p className="mt-1 text-[13px] text-slate-500">
                  使用组织账号登录，进入固定资产工作台
                </p>
              </header>

              {/* Mobile compact header */}
              <header className="mb-6 text-center lg:hidden">
                <h1 className="text-xl font-semibold text-white">登录系统</h1>
                <p className="mt-1 text-[13px] text-slate-500">使用组织账号进入工作台</p>
              </header>

              {/* Form */}
              <LoginFormFields
                form={form}
                errorMsg={errorMsg}
                rememberMe={rememberMe}
                onRememberChange={setRememberMe}
                isPending={isPending}
                onSubmit={handleSubmit}
              />

              {/* SSO */}
              <SsoButton />

              {/* Demo accounts */}
              <DemoAccounts onFillAndLogin={fillAndLogin} isPending={isPending} />
            </div>

            {/* Footer */}
            <footer className="mt-6 flex items-center justify-between px-1">
              <div className="flex items-center gap-3 text-[11px] text-slate-600">
                <a href="/login2" className="transition-colors hover:text-slate-400">全息版</a>
                <span className="text-slate-700">·</span>
                <a href="/login3" className="transition-colors hover:text-slate-400">流星版</a>
              </div>
              <p className="text-[11px] text-slate-700">&copy; 2026 浙江宇视科技有限公司</p>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
