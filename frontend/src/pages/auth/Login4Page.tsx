import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useLocation } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useLoginForm } from './hooks/useLoginForm';
import { DEMO_ACCOUNTS } from './loginConfig';

const assetBase = '/mock/workspace-preview';
const sceneAsset = (name: string) => `${assetBase}/scene/${name}.png`;
const moduleAsset = (name: string) => `${assetBase}/asset-kit-v4/modules/${name}.png`;
const login5ProductHero = `${sceneAsset('login5-stitch-factory-cn-v4')}?v=20260614-cn-v4`;

const trustItems = [
  '安全单点登录',
  '设备健康预警',
  '运维闭环协同',
] as const;

const login5Modules = [
  { label: '机加设备集群', value: '100%', note: '在线协同', image: moduleAsset('module-machining-cluster') },
  { label: '数据监控中心', value: '98.6%', note: '实时采集', image: moduleAsset('module-data-monitoring') },
  { label: '资产运维中心', value: '86', note: '健康指数', image: moduleAsset('module-asset-ops') },
] as const;

export default function Login4Page() {
  const { pathname } = useLocation();
  const { form, errorMsg, rememberMe, setRememberMe, isPending, handleSubmit, fillAndLogin } = useLoginForm();
  const { register, formState: { errors } } = form;
  const [showPassword, setShowPassword] = useState(false);
  const ssoHref = `${import.meta.env.VITE_API_BASE || ''}/api/oauth2/authorization/maxkey`;
  const versionLinks = [
    { href: '/login', label: '标准版' },
    { href: '/login2', label: '全息版' },
    { href: '/login3', label: '流星版' },
    { href: '/login4', label: '当前版' },
    { href: '/login5', label: '设计稿版' },
  ];

  if (pathname === '/login5') {
    return (
      <main className="login5-suite-shell min-h-screen overflow-hidden bg-[#eef6ff] text-[#13223a]">
        <div className="login5-bg" aria-hidden />

        <header className="login5-topbar">
          <a href="/fixed-assets/workbench" className="login5-brand" aria-label="进入固定资产工作台">
            <span><ShieldCheck /></span>
            <strong>UNIVIEW</strong>
            <em>固定资产平台</em>
          </a>

          <nav className="login5-nav" aria-label="登录页版本">
            {versionLinks.map((item) => (
              item.href === pathname ? (
                <span key={item.href}>{item.label}</span>
              ) : (
                <a key={item.href} href={item.href}>{item.label}</a>
              )
            ))}
          </nav>
        </header>

        <section className="login5-layout" aria-label="UNIVIEW 固定资产平台登录">
          <section className="login5-hero" aria-label="固定资产产品视觉">
            <div className="login5-hero-copy">
              <span>UNIVIEW 固定资产平台</span>
              <h1>固定资产智能运维中枢</h1>
              <p>连接 MES、设备状态、维保工单与资产全生命周期，让产线、仓储、巡检和安全态势在同一工作台闭环。</p>
            </div>

            <div className="login5-hero-stage">
              <img src={login5ProductHero} alt="UNIVIEW 固定资产智能运维中枢产品图" />
              <div className="login5-stage-chip is-left">
                <strong>12</strong>
                <span>在线产线</span>
              </div>
              <div className="login5-stage-chip is-right">
                <strong>1.25k</strong>
                <span>采集设备</span>
              </div>
            </div>

            <div className="login5-module-grid" aria-label="产品能力入口">
              {login5Modules.map((module) => (
                <article key={module.label}>
                  <img src={module.image} alt="" loading="lazy" />
                  <div>
                    <strong>{module.label}</strong>
                    <span>{module.note}</span>
                  </div>
                  <em>{module.value}</em>
                </article>
              ))}
            </div>
          </section>

          <aside className="login5-panel" aria-label="登录表单">
            <div className="login5-panel-head">
              <span><ShieldCheck /></span>
              <div>
                <strong>登录系统</strong>
                <em>使用组织账号进入固定资产平台</em>
              </div>
            </div>

            <form className="login5-form" onSubmit={handleSubmit}>
              <div className="login5-field">
                <label htmlFor="login5-username">用户名</label>
                <div>
                  <User />
                  <input
                    {...register('username')}
                    id="login5-username"
                    type="text"
                    autoComplete="username"
                    placeholder="请输入账号"
                  />
                </div>
                {errors.username ? <p>{errors.username.message}</p> : null}
              </div>

              <div className="login5-field">
                <label htmlFor="login5-password">密码</label>
                <div>
                  <Lock />
                  <input
                    {...register('password')}
                    id="login5-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {errors.password ? <p>{errors.password.message}</p> : null}
              </div>

              <div className="login5-form-row">
                <label>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>记住用户名</span>
                </label>
                <button type="button" onClick={() => toast.info('请联系管理员重置密码')}>
                  忘记密码?
                </button>
              </div>

              {errorMsg ? <div className="login5-error">{errorMsg}</div> : null}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isPending}
                className="login5-submit !h-12 w-full !rounded-[8px] !bg-[#0969e8] !text-[15px] !font-black !shadow-none hover:!bg-[#005bd4]"
              >
                登录并进入工作台
              </Button>
            </form>

            <a href={ssoHref} className="login5-sso">
              <LogIn />
              UNIVIEW 统一身份认证
            </a>

            {DEMO_ACCOUNTS.length > 0 ? (
              <div className="login5-demo">
                <div>
                  <strong>演示账户</strong>
                  <span>开发环境快速体验</span>
                </div>
                <div className="login5-demo-grid">
                  {DEMO_ACCOUNTS.slice(0, 4).map(({ label, desc, username, password, Icon }) => (
                    <button
                      key={username}
                      type="button"
                      onClick={() => fillAndLogin(username, password)}
                      disabled={isPending}
                    >
                      <Icon />
                      <span>
                        <strong>{label}</strong>
                        <em>{desc}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <footer className="login5-footer">
              <a href="/workspace-preview">
                查看工作台预览
                <ArrowRight />
              </a>
              <span>2026 UNIVIEW</span>
            </footer>
          </aside>
        </section>

        <style>{`
          .login5-suite-shell,
          .login5-suite-shell * {
            box-sizing: border-box;
          }
          .login5-suite-shell {
            position: relative;
            background: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
          }
          .login5-bg {
            display: none;
          }
          .login5-bg::after {
            display: none;
          }
          .login5-topbar {
            display: none;
          }
          .login5-brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            color: #0f2443;
            text-decoration: none;
          }
          .login5-brand span {
            display: grid;
            width: 38px;
            height: 38px;
            place-items: center;
            border: 1px solid #d6e7ff;
            border-radius: 10px;
            background: #f7fbff;
          }
          .login5-brand svg {
            width: 21px;
            height: 21px;
            color: #1677ff;
          }
          .login5-brand strong {
            font-size: 23px;
            font-weight: 950;
            line-height: 1;
          }
          .login5-brand em {
            color: #526b88;
            font-size: 12px;
            font-style: normal;
            font-weight: 900;
          }
          .login5-nav {
            display: flex;
            align-items: center;
            gap: 3px;
          }
          .login5-nav a,
          .login5-nav span {
            display: inline-flex;
            align-items: center;
            height: 72px;
            padding: 0 15px;
            border-bottom: 2px solid transparent;
            color: #31475f;
            font-size: 12px;
            font-weight: 850;
            text-decoration: none;
          }
          .login5-nav span {
            color: #075cad;
            border-bottom-color: #1677ff;
          }
          .login5-layout {
            position: relative;
            z-index: 1;
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(400px, 440px);
            align-items: stretch;
            width: 100%;
            min-height: 100vh;
            padding: 0;
            gap: 0;
          }
          .login5-hero {
            min-width: 0;
            min-height: 100vh;
            position: relative;
            overflow: hidden;
            color: #fff;
            background: #061b38;
          }
          .login5-hero::after {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              linear-gradient(90deg, rgba(2,13,36,.72) 0%, rgba(2,13,36,.32) 26%, rgba(2,13,36,.06) 58%, rgba(2,13,36,0) 100%),
              linear-gradient(180deg, rgba(2,13,36,.05), rgba(2,13,36,.2));
          }
          .login5-hero-copy {
            display: none;
          }
          .login5-hero-copy span {
            color: #55e1ef;
            font-size: 11px;
            font-weight: 950;
            letter-spacing: .16em;
          }
          .login5-hero-copy h1 {
            margin: 8px 0 10px;
            color: #fff;
            font-size: clamp(26px, 2.2vw, 36px);
            font-weight: 950;
            line-height: 1.12;
            letter-spacing: 0;
            text-shadow: 0 18px 42px rgba(0,0,0,.22);
          }
          .login5-hero-copy p {
            max-width: 380px;
            margin: 0;
            color: rgba(235,247,255,.88);
            font-size: 13px;
            font-weight: 700;
            line-height: 1.72;
          }
          .login5-hero-stage {
            position: absolute;
            inset: 0;
            overflow: hidden;
            max-width: none;
            border: 0;
            border-radius: 0;
            background: #061b38;
          }
          .login5-hero-stage img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: left center;
            opacity: 1;
          }
          .login5-stage-chip {
            position: absolute;
            display: grid;
            min-width: 104px;
            gap: 2px;
            padding: 10px 12px;
            border: 1px solid rgba(202,231,255,.82);
            border-radius: 8px;
            background: rgba(255,255,255,.86);
            color: #13223a;
            backdrop-filter: blur(12px);
          }
          .login5-stage-chip strong {
            color: #075cad;
            font-size: 22px;
            font-weight: 950;
            line-height: 1;
          }
          .login5-stage-chip span {
            color: #5f7894;
            font-size: 11px;
            font-weight: 900;
          }
          .login5-stage-chip.is-left {
            display: none;
          }
          .login5-stage-chip.is-right {
            display: none;
          }
          .login5-module-grid {
            display: none;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            max-width: 670px;
            margin-top: 14px;
          }
          .login5-module-grid article {
            display: grid;
            grid-template-columns: 52px minmax(0, 1fr) auto;
            align-items: center;
            gap: 10px;
            min-height: 70px;
            padding: 10px;
            border: 1px solid rgba(191,222,255,.42);
            border-radius: 10px;
            background: rgba(255,255,255,.13);
            backdrop-filter: blur(14px);
          }
          .login5-module-grid img {
            width: 52px;
            height: 52px;
            border-radius: 8px;
            object-fit: cover;
          }
          .login5-module-grid strong,
          .login5-module-grid span {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .login5-module-grid strong {
            color: #fff;
            font-size: 13px;
            font-weight: 950;
          }
          .login5-module-grid span {
            margin-top: 4px;
            color: rgba(230,246,255,.74);
            font-size: 11px;
            font-weight: 800;
          }
          .login5-module-grid em {
            color: #55e1ef;
            font-size: 16px;
            font-style: normal;
            font-weight: 950;
          }
          .login5-panel {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-self: stretch;
            height: 100vh;
            min-height: 650px;
            padding: 56px 44px 36px;
            border: 0;
            border-left: 1px solid #d9e6f5;
            border-radius: 0;
            background: #ffffff;
            backdrop-filter: none;
            box-shadow: none;
          }
          .login5-panel-head {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            margin-bottom: 28px;
            text-align: center;
          }
          .login5-panel-head > span {
            display: grid;
            width: 44px;
            height: 44px;
            place-items: center;
            border: 1px solid #d8e9ff;
            border-radius: 10px;
            background: linear-gradient(180deg, #fff, #f1f7ff);
          }
          .login5-panel-head svg {
            width: 23px;
            height: 23px;
            color: #1677ff;
          }
          .login5-panel-head strong,
          .login5-panel-head em {
            display: block;
            font-style: normal;
          }
          .login5-panel-head strong {
            color: #172032;
            font-size: 27px;
            font-weight: 950;
            line-height: 1.1;
          }
          .login5-panel-head em {
            margin-top: 6px;
            color: #5f7288;
            font-size: 13px;
            font-weight: 800;
          }
          .login5-form {
            display: grid;
            gap: 13px;
          }
          .login5-field {
            display: grid;
            gap: 7px;
          }
          .login5-field label {
            color: #526b88;
            font-size: 12px;
            font-weight: 900;
          }
          .login5-field > div {
            position: relative;
            display: flex;
            align-items: center;
            height: 48px;
            border: 1px solid #d7e2ee;
            border-radius: 8px;
            background: #f8fbff;
          }
          .login5-field svg {
            width: 18px;
            height: 18px;
            color: #85a0bd;
          }
          .login5-field > div > svg {
            position: absolute;
            left: 15px;
          }
          .login5-field input:not([type="checkbox"]) {
            width: 100%;
            height: 100%;
            border: 0;
            background: transparent;
            outline: none;
            padding: 0 44px;
            color: #13223a;
            font-size: 15px;
            font-weight: 800;
          }
          .login5-field > div:focus-within {
            border-color: #1677ff;
            box-shadow: 0 0 0 3px rgba(22,119,255,.1);
          }
          .login5-field > div button {
            position: absolute;
            right: 13px;
            display: grid;
            width: 26px;
            height: 26px;
            place-items: center;
            border: 0;
            background: transparent;
            cursor: pointer;
          }
          .login5-field p,
          .login5-error {
            margin: 0;
            color: #de3b3b;
            font-size: 12px;
            font-weight: 800;
          }
          .login5-form-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            color: #607691;
            font-size: 13px;
            font-weight: 800;
          }
          .login5-form-row label {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
          }
          .login5-form-row input {
            width: 16px;
            height: 16px;
            accent-color: #1677ff;
          }
          .login5-form-row button {
            border: 0;
            color: #1677ff;
            background: transparent;
            cursor: pointer;
            font-size: 13px;
            font-weight: 900;
          }
          .login5-error {
            border: 1px solid #ffc5c5;
            border-radius: 8px;
            background: #fff2f2;
            padding: 10px 12px;
            text-align: center;
          }
          .login5-sso {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 42px;
            margin-top: 12px;
            border: 1px solid #1677ff;
            border-radius: 8px;
            color: #075cad;
            background: #fff;
            font-size: 13px;
            font-weight: 900;
            text-decoration: none;
          }
          .login5-sso svg {
            width: 17px;
            height: 17px;
            color: #1677ff;
          }
          .login5-demo {
            margin-top: 18px;
            padding-top: 16px;
            border-top: 1px solid #e2eaf5;
          }
          .login5-demo > div:first-child {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
          }
          .login5-demo > div:first-child strong {
            color: #354f6d;
            font-size: 13px;
            font-weight: 950;
          }
          .login5-demo > div:first-child span {
            color: #8196ad;
            font-size: 11px;
            font-weight: 800;
          }
          .login5-demo-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }
          .login5-demo-grid button {
            display: flex;
            align-items: center;
            gap: 8px;
            min-height: 52px;
            border: 1px solid #dce6f2;
            border-radius: 6px;
            background: #fff;
            cursor: pointer;
            padding: 8px;
            text-align: left;
          }
          .login5-demo-grid button:disabled {
            cursor: default;
            opacity: .45;
          }
          .login5-demo-grid svg {
            width: 16px;
            height: 16px;
            flex: 0 0 auto;
            color: #1677ff;
          }
          .login5-demo-grid strong,
          .login5-demo-grid em {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-style: normal;
          }
          .login5-demo-grid strong {
            color: #284360;
            font-size: 12px;
            font-weight: 900;
          }
          .login5-demo-grid em {
            margin-top: 3px;
            color: #8398af;
            font-size: 10px;
            font-weight: 800;
          }
          .login5-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-top: auto;
            padding-top: 14px;
            color: #8aa0b8;
            font-size: 11px;
            font-weight: 800;
          }
          .login5-footer a {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #1677ff;
            text-decoration: none;
          }
          .login5-footer svg {
            width: 13px;
            height: 13px;
          }
          @media (max-height: 820px) and (min-width: 1041px) {
            .login5-layout {
              padding: 0;
            }
            .login5-panel {
              height: 100vh;
              min-height: 0;
              padding: 34px 40px 24px;
            }
            .login5-panel-head {
              margin-bottom: 18px;
            }
            .login5-panel-head strong {
              font-size: 26px;
            }
            .login5-form {
              gap: 11px;
            }
            .login5-field > div {
              height: 46px;
            }
            .login5-sso {
              height: 40px;
              margin-top: 10px;
            }
            .login5-demo {
              margin-top: 12px;
              padding-top: 12px;
            }
            .login5-demo-grid button {
              min-height: 46px;
              padding: 7px;
            }
            .login5-hero-stage img {
              height: 100%;
            }
            .login5-hero-copy {
              bottom: 54px;
            }
          }
          @media (max-width: 1180px) {
            .login5-layout {
              grid-template-columns: 1fr;
              padding: 28px 22px;
            }
            .login5-panel {
              order: -1;
              width: min(452px, 100%);
              min-height: auto;
              margin: 0 auto;
            }
            .login5-hero {
              width: min(760px, 100%);
              margin: 0 auto;
            }
          }
          @media (max-width: 720px) {
            .login5-topbar {
              height: 64px;
              padding: 0 16px;
            }
            .login5-brand em,
            .login5-nav {
              display: none;
            }
            .login5-layout {
              min-height: calc(100vh - 64px);
              padding: 18px;
            }
            .login5-panel {
              padding: 22px;
            }
            .login5-hero-copy h1 {
              font-size: 34px;
            }
            .login5-module-grid {
              grid-template-columns: 1fr;
            }
            .login5-hero-stage {
              display: none;
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="login4-pro-shell min-h-screen overflow-hidden bg-[#f7f9ff] text-[#14243d]">
      <div className="login4-pro-bg" aria-hidden />

      <section className="login4-pro-frame">
        <header className="login4-pro-header">
          <a href="/fixed-assets/workbench" className="login4-pro-brand">
            <span className="login4-pro-brand-mark">
              <ShieldCheck />
            </span>
            <span>
              <strong>UNIVIEW</strong>
              <em>固定资产平台</em>
            </span>
          </a>

          <nav className="login4-pro-nav" aria-label="登录页版本">
            {versionLinks.map((item) => (
              item.href === pathname ? (
                <span key={item.href}>{item.label}</span>
              ) : (
                <a key={item.href} href={item.href}>{item.label}</a>
              )
            ))}
          </nav>
        </header>

        <div className="login4-pro-content">
          <section className="login4-pro-hero" aria-label="固定资产平台产品入口">
            <div className="login4-pro-hero-copy">
              <p>UNIVIEW 固定资产平台</p>
              <h1>UNIVIEW 固定资产</h1>
              <span>连接 MES、设备状态、维保工单与资产全生命周期。</span>
            </div>

            <div className="login4-pro-trust">
              {trustItems.map((item) => (
                <span key={item}>
                  <CheckCircle2 />
                  {item}
                </span>
              ))}
            </div>
          </section>

          <aside className="login4-pro-login" aria-label="登录表单">
            <div className="login4-login-head">
              <div>
                <p>登录系统</p>
                <span>使用组织账号进入固定资产平台</span>
              </div>
            </div>

            <form className="login4-form" onSubmit={handleSubmit}>
              <div className="login4-field">
                <label htmlFor="login4-username">用户名</label>
                <div>
                  <User />
                  <input
                    {...register('username')}
                    id="login4-username"
                    type="text"
                    autoComplete="username"
                    placeholder="请输入账号"
                  />
                </div>
                {errors.username ? <p>{errors.username.message}</p> : null}
              </div>

              <div className="login4-field">
                <label htmlFor="login4-password">密码</label>
                <div>
                  <Lock />
                  <input
                    {...register('password')}
                    id="login4-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {errors.password ? <p>{errors.password.message}</p> : null}
              </div>

              <div className="login4-form-row">
                <label>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>记住用户名</span>
                </label>
                <button type="button" onClick={() => toast.info('请联系管理员重置密码')}>
                  忘记密码?
                </button>
              </div>

              {errorMsg ? <div className="login4-error">{errorMsg}</div> : null}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isPending}
                className="login4-submit !h-12 w-full !rounded-[12px] !bg-[#1677ff] !text-[15px] !font-black !shadow-none hover:!bg-[#0f67e8]"
              >
                登录并进入工作台
              </Button>
            </form>

            <a href={ssoHref} className="login4-sso">
              <LogIn />
              UNIVIEW 统一身份认证
            </a>

            {DEMO_ACCOUNTS.length > 0 ? (
              <div className="login4-demo">
                <div>
                  <strong>演示账户</strong>
                  <span>开发环境快速体验</span>
                </div>
                <div className="login4-demo-grid">
                  {DEMO_ACCOUNTS.map(({ label, desc, username, password, Icon }) => (
                    <button
                      key={username}
                      type="button"
                      onClick={() => fillAndLogin(username, password)}
                      disabled={isPending}
                    >
                      <Icon />
                      <span>
                        <strong>{label}</strong>
                        <em>{desc}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <footer className="login4-pro-footer">
              <a href="/workspace-preview">
                查看工作台预览
                <ArrowRight />
              </a>
              <span>2026 UNIVIEW</span>
            </footer>
          </aside>
        </div>
      </section>

      <style>{`
        .login4-pro-shell,
        .login4-pro-shell * {
          box-sizing: border-box;
        }
        .login4-pro-shell {
          position: relative;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        }
        .login4-pro-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(246, 250, 255, 0) 0%, rgba(246, 250, 255, 0) 64%, rgba(248, 251, 255, .035) 82%, rgba(248, 251, 255, .09) 100%),
            url("${sceneAsset('login4-immersive-hero')}") left center / cover no-repeat,
            linear-gradient(135deg, #edf6ff 0%, #f8fbff 100%);
          filter: saturate(1.18) contrast(1.1) brightness(1.02);
        }
        .login4-pro-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 83% 48%, rgba(255,255,255,.018) 0%, rgba(255,255,255,.006) 22%, rgba(255,255,255,0) 48%),
            linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0) 72%, rgba(255,255,255,.006));
        }
        .login4-pro-frame {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-rows: 72px minmax(0, 1fr);
          width: 100%;
          min-height: 100vh;
          margin: 0 auto;
          overflow: hidden;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }
        .login4-pro-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 0 44px;
          color: #102143;
          border-bottom: 1px solid rgba(216,232,255,.88);
          background: rgba(255,255,255,.70);
          backdrop-filter: blur(18px);
        }
        .login4-pro-brand {
          display: inline-flex;
          align-items: center;
          gap: 13px;
          color: inherit;
          text-decoration: none;
        }
        .login4-pro-brand-mark {
          display: grid;
          width: 40px;
          height: 40px;
          place-items: center;
          border: 1px solid #d7e6fa;
          border-radius: 10px;
          background: #f4f9ff;
        }
        .login4-pro-brand-mark svg {
          width: 23px;
          height: 23px;
          color: #1677ff;
        }
        .login4-pro-brand strong,
        .login4-pro-brand em {
          display: block;
          font-style: normal;
          line-height: 1;
        }
        .login4-pro-brand strong {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 0;
        }
        .login4-pro-brand em {
          margin-top: 7px;
          color: #56708e;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .12em;
        }
        .login4-pro-nav {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
        }
        .login4-pro-nav a,
        .login4-pro-nav span {
          display: inline-flex;
          align-items: center;
          height: 72px;
          padding: 0 16px;
          border-radius: 0;
          color: #31465f;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
          border-bottom: 2px solid transparent;
        }
        .login4-pro-nav span {
          color: #075cad;
          background: transparent;
          border-bottom-color: #1677ff;
        }
        .login4-pro-content {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 438px;
          align-items: center;
          justify-content: stretch;
          gap: 0;
          min-height: 0;
          padding: 46px clamp(64px, 5vw, 108px) 34px clamp(36px, 3.4vw, 64px);
        }
        .login4-pro-hero {
          position: relative;
          display: grid;
          align-self: end;
          grid-template-rows: auto auto;
          gap: 18px;
          min-width: 0;
          overflow: visible;
          padding: 0 0 30px;
          transform: translateY(calc(-1 * clamp(66px, 9vh, 94px)));
        }
        .login4-pro-hero-copy {
          position: relative;
          z-index: 1;
          width: max-content;
          max-width: min(520px, 100%);
          margin-left: clamp(0px, .7vw, 14px);
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          backdrop-filter: none;
        }
        .login4-pro-hero-copy p {
          margin: 0 0 7px;
          color: #116ee8;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .12em;
          text-shadow: 0 2px 12px rgba(255,255,255,.72);
          opacity: .92;
        }
        .login4-pro-hero-copy h1 {
          margin: 0;
          color: #172032;
          font-size: clamp(32px, 2.65vw, 48px);
          font-weight: 950;
          line-height: 1.08;
          letter-spacing: 0;
          text-shadow: 0 2px 10px rgba(255,255,255,.38), 0 10px 24px rgba(16,47,90,.12);
          opacity: .92;
        }
        .login4-pro-hero-copy span {
          display: block;
          max-width: 440px;
          margin-top: 10px;
          color: #445a73;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.58;
          text-shadow: 0 1px 8px rgba(255,255,255,.56);
          opacity: .9;
        }
        .login4-pro-trust {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          max-width: min(560px, 100%);
          margin-left: clamp(0px, .7vw, 14px);
        }
        .login4-pro-trust span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 31px;
          padding: 0 11px;
          border: 1px solid rgba(184,214,249,.88);
          border-radius: 6px;
          color: #294661;
          background: rgba(255,255,255,.58);
          backdrop-filter: blur(10px);
          font-size: 12px;
          font-weight: 900;
          text-shadow: 0 1px 8px rgba(255,255,255,.56);
        }
        .login4-pro-trust svg {
          width: 16px;
          height: 16px;
          color: #267cff;
        }
        .login4-pro-login {
          display: flex;
          flex-direction: column;
          height: min(646px, calc(100vh - 118px));
          min-height: 612px;
          padding: 36px 42px 30px;
          border: 1px solid rgba(216,232,255,.96);
          border-radius: 12px;
          background: rgba(255,255,255,.94);
          backdrop-filter: blur(16px);
          box-shadow: 0 14px 30px rgba(23, 52, 92, .07);
        }
        .login4-login-head {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 0;
          margin-bottom: 24px;
          text-align: center;
        }
        .login4-login-head img {
          display: none;
        }
        .login4-login-head p {
          margin: 0;
          color: #172032;
          font-size: 30px;
          font-weight: 950;
          letter-spacing: 0;
        }
        .login4-login-head span {
          display: block;
          margin-top: 6px;
          color: #5b6d82;
          font-size: 13px;
          font-weight: 800;
        }
        .login4-form {
          display: grid;
          gap: 13px;
        }
        .login4-field {
          display: grid;
          gap: 7px;
        }
        .login4-field label {
          color: #526b88;
          font-size: 12px;
          font-weight: 900;
        }
        .login4-field > div {
          position: relative;
          display: flex;
          align-items: center;
          height: 48px;
          border: 1px solid #d7dce5;
          border-radius: 8px;
          background: #fff;
        }
        .login4-field svg {
          width: 18px;
          height: 18px;
          color: #85a0bd;
        }
        .login4-field > div > svg {
          position: absolute;
          left: 15px;
        }
        .login4-field input:not([type="checkbox"]) {
          width: 100%;
          height: 100%;
          border: 0;
          background: transparent;
          outline: none;
          padding: 0 44px 0 44px;
          color: #14243d;
          font-size: 15px;
          font-weight: 800;
        }
        .login4-field input::placeholder {
          color: #9aacbf;
          font-weight: 700;
        }
        .login4-field > div:focus-within {
          border-color: #2b82ff;
          box-shadow: 0 0 0 3px rgba(43,130,255,.1);
        }
        .login4-field > div button {
          position: absolute;
          right: 13px;
          display: grid;
          width: 26px;
          height: 26px;
          place-items: center;
          border: 0;
          background: transparent;
          cursor: pointer;
        }
        .login4-field p {
          margin: 0;
          color: #de3b3b;
          font-size: 12px;
          font-weight: 800;
        }
        .login4-form-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: #607691;
          font-size: 13px;
          font-weight: 800;
        }
        .login4-form-row label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        .login4-form-row input {
          width: 16px;
          height: 16px;
          accent-color: #1677ff;
        }
        .login4-form-row button {
          border: 0;
          color: #1677ff;
          background: transparent;
          cursor: pointer;
          font-size: 13px;
          font-weight: 900;
        }
        .login4-error {
          border: 1px solid #ffc5c5;
          border-radius: 8px;
          background: #fff2f2;
          padding: 10px 12px;
          color: #d63838;
          text-align: center;
          font-size: 13px;
          font-weight: 800;
        }
        .login4-sso {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 44px;
          margin-top: 12px;
          border: 1px solid #1677ff;
          border-radius: 8px;
          color: #075cad;
          background: #fff;
          font-size: 13px;
          font-weight: 900;
          text-decoration: none;
        }
        .login4-sso svg {
          width: 17px;
          height: 17px;
          color: #1677ff;
        }
        .login4-demo {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid #e2eaf5;
        }
        .login4-demo > div:first-child {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .login4-demo > div:first-child strong {
          color: #354f6d;
          font-size: 13px;
          font-weight: 950;
        }
        .login4-demo > div:first-child span {
          color: #8196ad;
          font-size: 11px;
          font-weight: 800;
        }
        .login4-demo-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
        }
        .login4-demo-grid button {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 52px;
          border: 1px solid #dce6f2;
          border-radius: 6px;
          background: #fff;
          cursor: pointer;
          padding: 8px;
          text-align: left;
        }
        .login4-demo-grid button:disabled {
          cursor: default;
          opacity: .45;
        }
        .login4-demo-grid svg {
          width: 16px;
          height: 16px;
          flex: 0 0 auto;
          color: #1677ff;
        }
        .login4-demo-grid strong,
        .login4-demo-grid em {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-style: normal;
        }
        .login4-demo-grid strong {
          color: #284360;
          font-size: 12px;
          font-weight: 900;
        }
        .login4-demo-grid em {
          margin-top: 3px;
          color: #8398af;
          font-size: 10px;
          font-weight: 800;
        }
        .login4-pro-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: auto;
          padding-top: 14px;
          color: #8aa0b8;
          font-size: 11px;
          font-weight: 800;
        }
        .login4-pro-footer a {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #1677ff;
          text-decoration: none;
        }
        .login4-pro-footer svg {
          width: 13px;
          height: 13px;
        }
        @media (max-height: 820px) and (min-width: 1041px) {
          .login4-pro-content {
            padding-top: 34px;
            padding-bottom: 24px;
          }
          .login4-pro-hero {
            gap: 12px;
            transform: translateY(calc(-1 * clamp(54px, 8vh, 76px)));
          }
          .login4-pro-trust {
            gap: 8px;
          }
          .login4-pro-trust span {
            min-height: 28px;
            padding: 0 9px;
            font-size: 11px;
          }
          .login4-pro-login {
            height: min(618px, calc(100vh - 150px));
            min-height: 0;
            padding: 28px 38px 22px;
          }
          .login4-login-head {
            margin-bottom: 18px;
          }
          .login4-login-head p {
            font-size: 28px;
          }
          .login4-form {
            gap: 11px;
          }
          .login4-field > div {
            height: 46px;
          }
          .login4-sso {
            height: 40px;
            margin-top: 10px;
          }
          .login4-demo {
            margin-top: 12px;
            padding-top: 12px;
          }
          .login4-demo > div:first-child {
            margin-bottom: 8px;
          }
          .login4-demo-grid {
            gap: 8px;
          }
          .login4-demo-grid button {
            min-height: 46px;
            padding: 7px;
          }
          .login4-pro-footer {
            padding-top: 10px;
          }
        }
        @media (max-width: 1040px) {
          .login4-pro-bg {
            background:
              linear-gradient(180deg, rgba(248,251,255,.34), rgba(248,251,255,.78)),
              url("${sceneAsset('login4-immersive-hero')}") 14% center / cover no-repeat,
              #f7fbff;
          }
          .login4-pro-content {
            grid-template-columns: 1fr;
            align-items: start;
            padding: 32px 22px;
          }
          .login4-pro-login {
            order: -1;
            width: min(460px, 100%);
            min-height: auto;
            margin: 0 auto;
          }
          .login4-pro-nav {
            display: none;
          }
          .login4-pro-hero {
            align-self: auto;
            padding: 0;
            transform: none;
          }
          .login4-pro-hero-copy h1 {
            font-size: clamp(38px, 9vw, 58px);
          }
        }
        @media (max-width: 640px) {
          .login4-pro-shell {
            padding: 0;
          }
          .login4-pro-frame {
            min-height: 100vh;
            grid-template-rows: 64px auto;
            border-radius: 0;
          }
          .login4-pro-header {
            padding: 0 16px;
          }
          .login4-pro-content {
            padding: 18px;
          }
          .login4-pro-login,
          .login4-pro-hero {
            padding: 18px;
            border-radius: 18px;
          }
          .login4-pro-hero {
            display: none;
          }
          .login4-demo-grid {
            grid-template-columns: 1fr;
          }
          .login4-pro-footer {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
