import { Component, lazy, Suspense, useEffect, useMemo, useState, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Boxes, Database, Gauge, Radio, RotateCcw, ShieldCheck, Warehouse } from 'lucide-react';
import http from '@/utils/http';

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const fallbackStats = {
  totalAssets: 57,
  inUseAssets: 21,
  idleAssets: 25,
  scrapAssets: 9,
  utilizationRate: 36.8,
  totalValue: 60000,
  netValue: 49000,
  pendingApprovals: 3,
  pendingWorkOrders: 24,
  inventoryProgress: 70,
  criticalAlerts: 7,
};

const BigScreen3DCanvas = lazy(() => import('./BigScreen3DCanvas'));

type Stats = typeof fallbackStats;
type StyleVars = CSSProperties & Record<`--${string}`, string | number>;

type CityMetric = {
  name: string;
  assetCount: number;
  onlineRate: number;
  warningCount: number;
  netValue: number;
};

function canCreateWebGLContext() {
  if (typeof document === 'undefined') return false;

  const canvas = document.createElement('canvas');
  try {
    return Boolean(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl'),
    );
  } catch {
    return false;
  }
}

function WebGLFallback({ reason }: { reason: string }) {
  return (
    <div className="ams3d-webgl-fallback" role="status" aria-live="polite">
      <div className="ams3d-webgl-fallback-card">
        <h2>3D 地图已切换为安全降级模式</h2>
        <p>{reason}</p>
        <p>资产指标面板仍可访问；如需完整 3D 大屏，请在支持 WebGL 的浏览器或启用硬件加速后重试。</p>
      </div>
    </div>
  );
}

class WebGLBoundary extends Component<{ children: ReactNode; onError: (message: string) => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError(error.message || 'WebGL 渲染初始化失败');
  }

  render() {
    if (this.state.failed) {
      return <WebGLFallback reason="当前环境无法创建 WebGL 渲染上下文，已阻止页面崩溃。" />;
    }

    return this.props.children;
  }
}

const cityWeights = [0.18, 0.08, 0.05, 0.07, 0.09, 0.1, 0.045, 0.05, 0.04, 0.035, 0.045, 0.04, 0.055, 0.035, 0.03, 0.025, 0.03, 0.025, 0.02, 0.02];

const categoryBands = [
  { label: 'IT 设备', value: 42, tone: '#bdcfff' },
  { label: '办公家具', value: 24, tone: '#789eff' },
  { label: '生产设备', value: 21, tone: '#3061db' },
  { label: '低值耗材', value: 13, tone: '#91cfd4' },
];

const forecastLines = [24, 31, 28, 38, 45, 41, 55, 62, 58, 72, 68, 84];
const valueBars = [32, 48, 71, 64, 88];
const deviceStats = [
  { label: '办公终端', value: 112, unit: '台', sub: '在线', subValue: 98, icon: <Database size={30} /> },
  { label: '智能仓储', value: 36, unit: '组', sub: '库位', subValue: 420, icon: <Warehouse size={30} /> },
  { label: 'RFID 标签', value: 131, unit: '枚', sub: '读写', subValue: 96, icon: <Radio size={30} /> },
  { label: '审计链路', value: 39, unit: '条', sub: '留痕', subValue: 100, icon: <ShieldCheck size={30} /> },
];

const warningRows = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  event: ['维保到期', '借用超期', '标签离线', '审批积压', '盘点差异'][index % 5],
  count: [8, 6, 4, 3, 2][index % 5] + index,
  alarm: [2, 5, 1, 4, 3][index % 5],
  status: index % 2 === 0 ? '处理中' : '已处理',
}));

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');

.ams3d-page,
.ams3d-page * { box-sizing: border-box; }

.ams3d-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
  color: #e8efff;
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  isolation: isolate;
}

.ams3d-map-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: #000;
}

.ams3d-map-layer canvas {
  display: block;
  background: #000 !important;
}

.ams3d-webgl-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background:
    radial-gradient(circle at 50% 42%, rgba(48, 97, 219, 0.24), transparent 34%),
    linear-gradient(135deg, rgba(7, 16, 42, 0.96), #000 62%);
}

.ams3d-webgl-fallback-card {
  max-width: 520px;
  border: 1px solid rgba(189, 207, 255, 0.28);
  border-radius: 20px;
  padding: 28px;
  background: rgba(7, 16, 42, 0.78);
  box-shadow: 0 0 36px rgba(48, 97, 219, 0.28);
  text-align: center;
}

.ams3d-webgl-fallback-card h2 {
  margin: 0 0 10px;
  color: #fff;
  font-size: 24px;
  letter-spacing: 2px;
}

.ams3d-webgl-fallback-card p {
  margin: 0;
  color: rgba(232, 239, 255, 0.76);
  line-height: 1.7;
}

.ams3d-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 5;
  width: ${DESIGN_WIDTH}px;
  height: ${DESIGN_HEIGHT}px;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(var(--stage-scale));
  transform-origin: center center;
}

.ams3d-header {
  position: relative;
  height: 85px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  animation: ams3d-slide-down 0.7s ease 2s both;
}

.ams3d-header svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.ams3d-title {
  position: relative;
  z-index: 2;
  display: grid;
  justify-items: center;
  gap: 2px;
  margin-top: 2px;
}

.ams3d-title-main {
  display: flex;
  align-items: center;
  gap: 14px;
  color: #fff;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: 8px;
  line-height: 1;
  text-shadow: 0 0 18px rgba(120, 158, 255, 0.76), 0 8px 22px rgba(48, 97, 219, 0.5);
}

.ams3d-title-main svg { color: #bdcfff; filter: drop-shadow(0 0 10px #789eff); }

.ams3d-title-sub {
  color: rgba(189, 207, 255, 0.72);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  letter-spacing: 10px;
}

.ams3d-meta,
.ams3d-status {
  position: absolute;
  top: 24px;
  z-index: 2;
  display: flex;
  gap: 18px;
  color: rgba(232, 239, 255, 0.7);
  font-size: 13px;
}

.ams3d-meta { left: 32px; }
.ams3d-status { right: 32px; }
.ams3d-meta strong,
.ams3d-status strong { color: #bdcfff; font-family: 'JetBrains Mono', monospace; }

.ams3d-grid {
  position: absolute;
  inset: 85px 0 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(6, minmax(0, 1fr));
  gap: 20px;
  padding: 20px;
  background: transparent !important;
}

.ams3d-card {
  position: relative;
  overflow: hidden;
  min-height: 0;
  pointer-events: auto;
  background: linear-gradient(180deg, rgba(3, 11, 28, 0.74), rgba(2, 6, 18, 0.52));
  box-shadow: inset 0 0 30px rgba(48, 97, 219, 0.08), 0 18px 42px rgba(0, 0, 0, 0.24);
  opacity: 0;
}

.ams3d-card.left { animation: ams3d-slide-right 0.8s ease both; }
.ams3d-card.right { animation: ams3d-slide-left 0.8s ease both; }
.ams3d-card:nth-of-type(1), .ams3d-card:nth-of-type(4) { animation-delay: 2.35s; }
.ams3d-card:nth-of-type(2), .ams3d-card:nth-of-type(5) { animation-delay: 2.45s; }
.ams3d-card:nth-of-type(3), .ams3d-card:nth-of-type(6) { animation-delay: 2.55s; }

.ams3d-card-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.ams3d-card-inner {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  flex-direction: column;
}

.ams3d-card-title {
  position: relative;
  display: flex;
  min-height: 50px;
  align-items: center;
  justify-content: space-between;
  margin: 0 20px;
  border-bottom: 1px solid rgba(186, 206, 255, 0.33);
  color: #e8efff;
  font-size: 16px;
  font-weight: 700;
  line-height: 50px;
}

.ams3d-card-title::before {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 50px;
  height: 4px;
  background: #bdcfff;
  box-shadow: 0 0 12px rgba(189, 207, 255, 0.72);
}

.ams3d-card-title::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  width: 4px;
  height: 4px;
  border-radius: 2px;
  background: #bdcfff;
}

.ams3d-card-title-main { display: inline-flex; align-items: center; gap: 8px; }
.ams3d-card-title svg { color: #789eff; filter: drop-shadow(0 0 8px rgba(120, 158, 255, 0.72)); }
.ams3d-card-title small { color: rgba(189, 207, 255, 0.48); font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; }

.ams3d-card-content {
  flex: 1;
  min-height: 0;
  padding: 18px 20px 20px;
}

.ams3d-kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.ams3d-kpi { padding: 12px; border: 1px solid rgba(120, 158, 255, 0.14); background: rgba(4, 12, 30, 0.6); }
.ams3d-kpi span { display: block; color: rgba(232, 239, 255, 0.62); font-size: 13px; }
.ams3d-kpi strong { display: block; margin-top: 8px; color: #3061db; font-family: 'JetBrains Mono', monospace; font-size: 28px; line-height: 1; text-shadow: 0 0 12px rgba(48, 97, 219, 0.6); }
.ams3d-kpi small { margin-left: 4px; color: rgba(232, 239, 255, 0.54); font-size: 12px; }

.ams3d-bars { display: grid; gap: 13px; }
.ams3d-bar-row { display: grid; grid-template-columns: 76px 1fr 44px; align-items: center; gap: 10px; color: rgba(232, 239, 255, 0.72); font-size: 13px; }
.ams3d-bar-track { height: 8px; overflow: hidden; background: rgba(120, 158, 255, 0.1); transform: skewX(-24deg); }
.ams3d-bar-fill { width: var(--pct); height: 100%; background: linear-gradient(90deg, rgba(0, 0, 0, 0.12), var(--tone)); box-shadow: 0 0 14px color-mix(in srgb, var(--tone) 60%, transparent); animation: ams3d-grow-x 1.2s ease 2.9s both; transform-origin: left center; }
.ams3d-bar-num { color: #bdcfff; font-family: 'JetBrains Mono', monospace; text-align: right; }

.ams3d-line-chart { position: relative; width: 100%; height: 100%; min-height: 126px; }
.ams3d-line-chart svg { width: 100%; height: 100%; overflow: visible; }
.ams3d-line-chart polyline { stroke-dasharray: 450; stroke-dashoffset: 450; animation: ams3d-draw-line 2s ease 3s both; }
.ams3d-line-grid { stroke: rgba(255, 255, 255, 0.08); stroke-width: 1; }

.ams3d-column-bars { display: grid; height: 100%; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; align-items: end; }
.ams3d-column { display: grid; align-content: end; justify-items: center; gap: 8px; color: rgba(232, 239, 255, 0.62); font-size: 12px; }
.ams3d-column-value { color: #bdcfff; font-family: 'JetBrains Mono', monospace; }
.ams3d-column-bar { width: 30px; height: var(--height); min-height: 28px; background: linear-gradient(180deg, #bdcfff, #3061db 62%, rgba(0, 0, 0, 0.1)); box-shadow: 0 0 14px rgba(48, 97, 219, 0.62); animation: ams3d-grow-y 1.1s ease 3s both; transform-origin: bottom center; }

.ams3d-device-grid { display: grid; height: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.ams3d-device { display: flex; align-items: center; gap: 10px; color: rgba(232, 239, 255, 0.78); }
.ams3d-device-icon { display: grid; width: 54px; height: 54px; place-items: center; border: 1px solid #3061db; border-radius: 999px; color: #789eff; box-shadow: 0 0 14px rgba(48, 97, 219, 0.58); }
.ams3d-device strong { color: #3061db; font-family: 'JetBrains Mono', monospace; font-size: 24px; text-shadow: 0 0 10px currentColor; }
.ams3d-device small { color: #bdcfff; font-family: 'JetBrains Mono', monospace; }

.ams3d-city-list { display: grid; gap: 10px; }
.ams3d-city-row { display: grid; grid-template-columns: 64px 1fr 44px; gap: 10px; align-items: center; color: rgba(232, 239, 255, 0.7); font-size: 13px; }
.ams3d-city-row strong { color: #e8efff; }
.ams3d-city-track { height: 8px; background: rgba(120, 158, 255, 0.1); }
.ams3d-city-fill { width: var(--pct); height: 100%; background: linear-gradient(90deg, #3061db, #bdcfff); box-shadow: 0 0 12px rgba(120, 158, 255, 0.54); }
.ams3d-focus { margin-top: 14px; padding: 10px; border: 1px solid rgba(120, 158, 255, 0.18); background: rgba(4, 12, 30, 0.54); color: rgba(232, 239, 255, 0.72); font-size: 13px; }
.ams3d-focus strong { display: block; margin-bottom: 5px; color: #bdcfff; font-size: 17px; }

.ams3d-warning-table { height: 100%; overflow: hidden; }
.ams3d-warning-head,
.ams3d-warning-row { display: grid; grid-template-columns: 38px 1fr 58px 58px 62px; gap: 8px; align-items: center; min-height: 34px; color: rgba(232, 239, 255, 0.72); font-size: 13px; }
.ams3d-warning-head { color: rgba(232, 239, 255, 0.54); }
.ams3d-warning-body { animation: ams3d-scroll-y 10s linear 3s infinite; }
.ams3d-warning-row { color: #3061db; font-family: 'JetBrains Mono', monospace; }
.ams3d-warning-row span:nth-child(2) { color: #bdcfff; font-family: Inter, sans-serif; }
.ams3d-warning-row b { color: #ffa800; font-weight: 500; }

.ams3d-bottom-halo {
  position: absolute;
  left: 50%;
  bottom: 26px;
  z-index: 1;
  width: 520px;
  height: 72px;
  border-top: 1px solid rgba(120, 158, 255, 0.52);
  border-radius: 50%;
  transform: translateX(-50%);
  box-shadow: 0 -12px 42px rgba(48, 97, 219, 0.26);
}

.ams3d-map-label {
  width: max-content;
  min-width: max-content;
  color: #fff;
  font-size: 12px;
  text-shadow: 0 0 8px rgba(120, 158, 255, 0.8), 0 2px 8px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
}

@keyframes ams3d-slide-down { from { opacity: 0; transform: translateY(-100%); } to { opacity: 1; transform: translateY(0); } }
@keyframes ams3d-slide-right { from { opacity: 0; transform: translateX(-100%); } to { opacity: 1; transform: translateX(0); } }
@keyframes ams3d-slide-left { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
@keyframes ams3d-grow-x { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes ams3d-grow-y { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes ams3d-draw-line { to { stroke-dashoffset: 0; } }
@keyframes ams3d-scroll-y { 0%, 16% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
`;

function formatNumber(value: number | string | undefined | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return new Intl.NumberFormat('zh-CN').format(n);
}

function formatWan(value: number) {
  return `${(value / 10000).toFixed(1)}万`;
}

function HeaderRail() {
  return (
    <svg fill="none" viewBox="0 0 1920 85" preserveAspectRatio="none" aria-hidden="true">
      <g clipPath="url(#ams-demo2-header-clip)">
        <path fill="#3061DB" fillOpacity="0.5" d="M0 0h1920v85H0z" opacity="0.08" />
        <path fill="#3061DB" fillOpacity="0.3" d="M22 83h344.5v2H22zM379 83h345v2H379zM736.5 83h346v2h-346z" />
        <path fill="#3061DB" d="M1 2h76.5v2H1zM81.5 2H89v2h-7.5z" />
        <path fill="#3061DB" fillOpacity="0.3" d="M93 2h527v2H93z" />
        <path fill="#3061DB" d="M625 2h11.5v2H625z" />
        <path fill="#789EFF" fillOpacity="0.28" d="M1223 19.5h134V67h-134z" />
        <path fill="#3061DB" fillRule="evenodd" d="M1218.25 55.5v16.25H1236v-2.5h-15.25V55.5h-2.5Zm140 0v13.75h-15.5v2.5h17.75V55.5h-2.25ZM1219.5 15.5h-1.25v16.25h2.5V18H1236v-2.5h-16.5Zm123.25 2.5v-2.5h17.75v16.25h-2.5V18h-15.25Z" />
        <g fill="#3061DB" opacity="0.8">
          <path fillOpacity="0.9" d="M691.851 19.469h3.44L680.939 29h-3.44l14.352-9.531Z" />
          <path fillOpacity="0.7" d="M698.206 19.469h3.44L687.294 29h-3.44l14.352-9.531Z" />
          <path fillOpacity="0.5" d="M704.56 19.469H708L693.648 29h-3.44l14.352-9.531Z" />
        </g>
        <path fill="url(#ams-demo2-header-line)" d="M708 27h400v2H708z" />
      </g>
      <defs>
        <linearGradient id="ams-demo2-header-line" x1="708" x2="1108" y1="29" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#789EFF" stopOpacity="0.45" />
          <stop offset="1" stopColor="#789EFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id="ams-demo2-header-clip"><path fill="#fff" d="M0 85h1920V0H0v85Z" /></clipPath>
      </defs>
    </svg>
  );
}

function Panel({ title, tag, icon, side, style, children }: { title: string; tag: string; icon: ReactNode; side: 'left' | 'right'; style: CSSProperties; children: ReactNode }) {
  return (
    <section className={`ams3d-card ${side}`} style={style}>
      <svg className="ams3d-card-frame" fill="none" viewBox="0 0 260 180" preserveAspectRatio="none" aria-hidden="true">
        <path fill="#3061DB" fillRule="evenodd" d="M206 10 190 0H9L0 9v171h45l4.5-4h161l4.5 4h45V10h-54Zm53 1h-53.287l-16-10H9.414L1 9.414V179h43.62l4.5-4h161.76l4.5 4H259V11Z" />
        <path fill="#789eff" d="m51 178-2 2h162l-2-2H51ZM0 0v7l7-7H0Z" />
        <path stroke="#789eff" strokeWidth={2} d="M1 169v10h10M259 21V11h-10" />
      </svg>
      <div className="ams3d-card-inner">
        <div className="ams3d-card-title">
          <span className="ams3d-card-title-main">{icon}{title}</span>
          <small>{tag}</small>
        </div>
        <div className="ams3d-card-content">{children}</div>
      </div>
    </section>
  );
}

function NumberTicker({ value, options, className }: { value: number; options?: Intl.NumberFormatOptions; className?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={className}>{new Intl.NumberFormat('zh-CN', options).format(display)}</span>;
}

function LinePreview() {
  const points = forecastLines.map((value, index) => `${index * 31 + 12},${112 - value}`).join(' ');
  return (
    <div className="ams3d-line-chart">
      <svg viewBox="0 0 370 130" preserveAspectRatio="none">
        {[22, 50, 78, 106].map((y) => <line key={y} className="ams3d-line-grid" x1="0" x2="370" y1={y} y2={y} />)}
        <polyline points={points} fill="none" stroke="#3061DB" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={points} fill="none" stroke="#BDCFFF" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
      </svg>
    </div>
  );
}

function ValueColumns() {
  return (
    <div className="ams3d-column-bars">
      {valueBars.map((value, index) => (
        <div key={value} className="ams3d-column">
          <span className="ams3d-column-value">{value}</span>
          <div className="ams3d-column-bar" style={{ '--height': `${Math.max(34, value)}%` } as StyleVars} />
          <span>{['50', '100', '500', '1000', '1000+'][index]}</span>
        </div>
      ))}
    </div>
  );
}

function DeviceGrid() {
  return (
    <div className="ams3d-device-grid">
      {deviceStats.map((item) => (
        <div key={item.label} className="ams3d-device">
          <div className="ams3d-device-icon">{item.icon}</div>
          <div>
            <div>{item.label} <strong>{item.value}</strong> <span>{item.unit}</span></div>
            <div>{item.sub} <small>{item.subValue}</small></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WarningTable() {
  const rows = [...warningRows, ...warningRows];
  return (
    <div className="ams3d-warning-table">
      <div className="ams3d-warning-head"><span>序号</span><span>异常事件</span><span>次数</span><span>报警</span><span>状态</span></div>
      <div className="ams3d-warning-body">
        {rows.map((row, index) => (
          <div key={`${row.id}-${index}`} className="ams3d-warning-row">
            <span>{row.id}</span><span>{row.event}</span><span>{row.count}</span><span>{row.alarm}</span><b>{row.status}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

const cityNames = ['成都市', '自贡市', '攀枝花市', '泸州市', '德阳市', '绵阳市', '广元市', '遂宁市', '内江市', '乐山市', '南充市', '眉山市', '宜宾市', '广安市', '达州市', '雅安市', '巴中市', '资阳市', '阿坝藏族羌族自治州', '甘孜藏族自治州', '凉山彝族自治州'];

function buildCityMetrics(stats: Stats): CityMetric[] {
  const names = cityNames;
  const totalWeight = names.reduce((sum, _, index) => sum + (cityWeights[index] ?? 0.02), 0);
  return names.map((name, index) => {
    const ratio = (cityWeights[index] ?? 0.02) / totalWeight;
    return {
      name,
      assetCount: Math.max(2, Math.round(stats.totalAssets * ratio)),
      onlineRate: Math.max(82, Math.min(99.8, 94 + ((index * 7) % 10) / 2)),
      warningCount: Math.max(0, Math.round(stats.criticalAlerts * ratio + (index % 3 === 0 ? 1 : 0))),
      netValue: Math.round(stats.netValue * ratio),
    };
  });
}

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

export default function BigScreen3DPage() {
  const stageScale = useStageScale();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [time, setTime] = useState(new Date());
  const [webglState, setWebglState] = useState<{ supported: boolean; reason: string }>(() => ({
    supported: canCreateWebGLContext(),
    reason: '当前浏览器或设备不支持 WebGL，已使用可访问降级视图。',
  }));

  const { data: apiStats } = useQuery<Stats>({
    queryKey: ['dashboard', 'stats', 'demo2-style'],
    queryFn: async () => {
      try {
        const res = await http.get<any>('/dashboard/stats');
        const raw = res?.data ?? res ?? {};
        const total = typeof raw.totalAssets === 'number' ? raw.totalAssets : fallbackStats.totalAssets;
        const inUse = typeof raw.inUseAssets === 'number' ? raw.inUseAssets : fallbackStats.inUseAssets;
        return {
          ...fallbackStats,
          totalAssets: total,
          inUseAssets: inUse,
          idleAssets: typeof raw.idleAssets === 'number' ? raw.idleAssets : fallbackStats.idleAssets,
          scrapAssets: typeof raw.scrapAssets === 'number' ? raw.scrapAssets : fallbackStats.scrapAssets,
          utilizationRate: total > 0 ? Math.round((inUse / total) * 1000) / 10 : fallbackStats.utilizationRate,
          totalValue: typeof raw.totalValue === 'number' ? raw.totalValue : fallbackStats.totalValue,
          netValue: typeof raw.netValue === 'number' ? raw.netValue : fallbackStats.netValue,
          pendingApprovals: typeof raw.pendingApprovals === 'number' ? raw.pendingApprovals : fallbackStats.pendingApprovals,
          pendingWorkOrders: typeof raw.pendingWorkOrders === 'number' ? raw.pendingWorkOrders : fallbackStats.pendingWorkOrders,
          inventoryProgress: typeof raw.inventoryProgress === 'number' ? raw.inventoryProgress : fallbackStats.inventoryProgress,
          criticalAlerts: typeof raw.criticalAlerts === 'number' ? raw.criticalAlerts : fallbackStats.criticalAlerts,
        };
      } catch {
        return fallbackStats;
      }
    },
    initialData: fallbackStats,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = apiStats ?? fallbackStats;
  const cityMetrics = useMemo(() => buildCityMetrics(stats), [stats]);
  const selectedMetric = cityMetrics.find((item) => item.name === selectedCity) ?? cityMetrics.find((item) => item.name.includes('成都')) ?? cityMetrics[0];
  const topCities = cityMetrics.slice().sort((a, b) => b.assetCount - a.assetCount).slice(0, 5);
  const dateText = `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')}`;
  const timeText = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}`;

  return (
    <div className="ams3d-page">
      <style>{CSS}</style>
      <div className="ams3d-map-layer">
        {webglState.supported ? (
          <WebGLBoundary onError={(message) => setWebglState({ supported: false, reason: message })}>
            <Suspense fallback={<WebGLFallback reason="3D 地图资源加载中，请稍候。" />}>
              <BigScreen3DCanvas
                selectedCity={selectedCity}
                onSelectCity={setSelectedCity}
                onIntroComplete={() => setMapReady(true)}
                onError={(message) => setWebglState({ supported: false, reason: message || 'WebGL 渲染初始化失败' })}
              />
            </Suspense>
          </WebGLBoundary>
        ) : (
          <WebGLFallback reason={webglState.reason} />
        )}
      </div>

      <div className="ams3d-stage" style={{ '--stage-scale': stageScale } as StyleVars}>
        <header className="ams3d-header">
          <HeaderRail />
          <div className="ams3d-meta">
            <span>开场动画：<strong>{mapReady ? '完成' : '播放中'}</strong></span>
            <span>当前城市：<strong>{selectedCity ?? '四川全域'}</strong></span>
          </div>
          <div className="ams3d-title">
            <div className="ams3d-title-main"><Radio size={28} />固定资产智慧运营大屏</div>
            <div className="ams3d-title-sub">FIXED ASSET INTELLIGENCE PLATFORM</div>
          </div>
          <div className="ams3d-status">
            <span>{dateText}</span>
            <span><strong>{timeText}</strong></span>
            <span>地图节点：<strong>{cityMetrics.length}</strong></span>
          </div>
        </header>

        <main className="ams3d-grid">
          <Panel side="left" style={{ gridArea: '1 / 1 / 3 / 2' }} title="资产规模指标" tag="SUMMARY" icon={<Gauge size={18} />}>
            <div className="ams3d-kpis">
              <div className="ams3d-kpi"><span>资产总数</span><strong><NumberTicker value={stats.totalAssets} options={{ maximumFractionDigits: 0 }} /><small>件</small></strong></div>
              <div className="ams3d-kpi"><span>在用资产</span><strong><NumberTicker value={stats.inUseAssets} options={{ maximumFractionDigits: 0 }} /><small>件</small></strong></div>
              <div className="ams3d-kpi"><span>资产原值</span><strong>{formatWan(stats.totalValue)}</strong></div>
              <div className="ams3d-kpi"><span>资产净值</span><strong>{formatWan(stats.netValue)}</strong></div>
            </div>
          </Panel>

          <Panel side="left" style={{ gridArea: '3 / 1 / 5 / 2' }} title="资产分类结构" tag="CATEGORY" icon={<Boxes size={18} />}>
            <div className="ams3d-bars">
              {categoryBands.map((item) => (
                <div key={item.label} className="ams3d-bar-row" style={{ '--tone': item.tone, '--pct': `${item.value}%` } as StyleVars}>
                  <span>{item.label}</span>
                  <div className="ams3d-bar-track"><div className="ams3d-bar-fill" /></div>
                  <span className="ams3d-bar-num">{item.value}%</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel side="left" style={{ gridArea: '5 / 1 / 7 / 2' }} title="价值趋势预测" tag="FORECAST" icon={<Activity size={18} />}>
            <LinePreview />
          </Panel>

          <Panel side="right" style={{ gridArea: '1 / 4 / 3 / 5' }} title="设备在线总览" tag="IOT" icon={<Database size={18} />}>
            <DeviceGrid />
          </Panel>

          <Panel side="right" style={{ gridArea: '3 / 4 / 5 / 5' }} title="城市资产TOP5" tag="TOP 5" icon={<RotateCcw size={18} />}>
            <div className="ams3d-city-list">
              {topCities.map((city) => (
                <div key={city.name} className="ams3d-city-row" style={{ '--pct': `${Math.min(100, city.assetCount * 8)}%` } as StyleVars}>
                  <strong>{city.name}</strong><div className="ams3d-city-track"><div className="ams3d-city-fill" /></div><span>{city.assetCount}</span>
                </div>
              ))}
            </div>
            <div className="ams3d-focus">
              <strong>{selectedMetric?.name ?? '成都市'}</strong>
              资产 {selectedMetric?.assetCount ?? 0} 件，在线率 {(selectedMetric?.onlineRate ?? 0).toFixed(1)}%，净值 {formatWan(selectedMetric?.netValue ?? 0)}。
            </div>
          </Panel>

          <Panel side="right" style={{ gridArea: '5 / 4 / 7 / 5' }} title="风险异常队列" tag="WARNING" icon={<AlertTriangle size={18} />}>
            <WarningTable />
          </Panel>

          <div className="ams3d-bottom-halo" />
        </main>
      </div>
    </div>
  );
}
