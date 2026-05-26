import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Bell,
  Database,
  Droplets,
  Gauge,
  Package,
  Plane,
  Users,
} from 'lucide-react';
import http from '@/utils/http';
import AssetMapChart from '@/components/bigscreen/AssetMapChart';

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

type Stats = typeof fallbackStats;
type StyleVars = CSSProperties & Record<`--${string}`, string | number>;

function normalizeStats(input: Partial<Stats> | { data?: Partial<Stats> } | null | undefined): Stats {
  const raw = ((input as { data?: Partial<Stats> } | null | undefined)?.data ?? input ?? {}) as Partial<Stats>;
  const total = typeof raw.totalAssets === 'number' ? raw.totalAssets : fallbackStats.totalAssets;
  const inUse = typeof raw.inUseAssets === 'number' ? raw.inUseAssets : fallbackStats.inUseAssets;

  return {
    ...fallbackStats,
    totalAssets: total,
    inUseAssets: inUse,
    idleAssets: typeof raw.idleAssets === 'number' ? raw.idleAssets : fallbackStats.idleAssets,
    scrapAssets: typeof raw.scrapAssets === 'number' ? raw.scrapAssets : fallbackStats.scrapAssets,
    utilizationRate: typeof raw.utilizationRate === 'number'
      ? raw.utilizationRate
      : total > 0
        ? Math.round((inUse / total) * 1000) / 10
        : fallbackStats.utilizationRate,
    totalValue: typeof raw.totalValue === 'number' ? raw.totalValue : fallbackStats.totalValue,
    netValue: typeof raw.netValue === 'number' ? raw.netValue : fallbackStats.netValue,
    pendingApprovals: typeof raw.pendingApprovals === 'number' ? raw.pendingApprovals : fallbackStats.pendingApprovals,
    pendingWorkOrders: typeof raw.pendingWorkOrders === 'number' ? raw.pendingWorkOrders : fallbackStats.pendingWorkOrders,
    inventoryProgress: typeof raw.inventoryProgress === 'number' ? raw.inventoryProgress : fallbackStats.inventoryProgress,
    criticalAlerts: typeof raw.criticalAlerts === 'number' ? raw.criticalAlerts : fallbackStats.criticalAlerts,
  };
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');

.bs-page,
.bs-page * { box-sizing: border-box; }

.bs-page {
  --cyan: #31d6ff;
  --blue: #1678ff;
  --gold: #ffd45c;
  --orange: #ff9f43;
  --pink: #ff4f9a;
  --green: #5fffc1;
  --text: #effaff;
  --muted: rgba(180, 218, 255, 0.62);
  position: relative;
  width: 100vw;
  height: 100vh;
  min-width: 1180px;
  min-height: 650px;
  overflow: hidden;
  color: var(--text);
  isolation: isolate;
  background-color: #020a24;
  background:
    radial-gradient(circle at 50% 43%, rgba(18, 116, 235, 0.42), transparent 29%),
    radial-gradient(circle at 50% 48%, rgba(0, 214, 255, 0.18), transparent 44%),
    linear-gradient(180deg, #062254 0%, #041942 42%, #030c27 100%);
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.bs-page::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    linear-gradient(rgba(74, 183, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(74, 183, 255, 0.03) 1px, transparent 1px),
    radial-gradient(circle at 50% 46%, rgba(22, 118, 236, 0.42), rgba(7, 39, 104, 0.24) 38%, rgba(2, 12, 38, 0.72) 70%, rgba(1, 5, 18, 0.96) 100%),
    linear-gradient(180deg, #041d4c 0%, #061945 48%, #020a24 100%);
  background-size: 48px 48px, 48px 48px, 100% 100%;
  pointer-events: none;
}

.bs-page::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  z-index: 1;
  height: 120px;
  background: linear-gradient(180deg, rgba(1, 8, 29, 0.9), rgba(1, 8, 29, 0));
  pointer-events: none;
}

.bs-topline {
  position: absolute;
  top: 16px;
  left: 26px;
  right: 26px;
  z-index: 10;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  pointer-events: none;
}

.bs-top-left,
.bs-top-right {
  display: flex;
  align-items: center;
  gap: 18px;
  color: rgba(231, 246, 255, 0.92);
  font-size: 12px;
  line-height: 1;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.45);
}

.bs-top-right { justify-content: flex-end; gap: 12px; }
.bs-top-left strong { color: #fff; font-weight: 700; }

.bs-title {
  display: grid;
  justify-items: center;
  gap: 3px;
  transform: translateY(-3px);
}

.bs-title-main {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #d9f4ff;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1;
  text-shadow: 0 0 18px rgba(52, 202, 255, 0.5), 0 4px 16px rgba(0, 0, 0, 0.42);
}

.bs-logo {
  position: relative;
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  border: 1px solid rgba(125, 224, 255, 0.45);
  background: radial-gradient(circle at 35% 35%, rgba(104, 214, 255, 0.35), rgba(7, 39, 95, 0.22) 60%, rgba(4, 15, 44, 0.18));
  box-shadow: inset 0 0 18px rgba(49, 214, 255, 0.18), 0 0 18px rgba(49, 214, 255, 0.18);
}

.bs-logo svg { width: 31px; height: 31px; }

.bs-title-sub {
  color: rgba(193, 226, 255, 0.66);
  font-size: 13px;
  letter-spacing: 0.02em;
}

.bs-main {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 30.8% minmax(430px, 38.4%) 30.8%;
  gap: 24px;
  width: 100%;
  height: 100%;
  padding: 72px 26px 20px;
  color: var(--text);
  background: transparent !important;
  background-color: transparent !important;
}

.bs-side,
.bs-center {
  position: relative;
  min-width: 0;
  min-height: 0;
}

.bs-side {
  z-index: 6;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bs-center {
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bs-center-tabs {
  position: absolute;
  top: 0;
  z-index: 7;
  display: flex;
  align-items: center;
  border: 1px solid rgba(93, 176, 255, 0.34);
  background: rgba(8, 39, 88, 0.64);
  box-shadow: inset 0 0 16px rgba(75, 171, 255, 0.08);
}

.bs-center-tabs span {
  min-width: 48px;
  padding: 4px 10px;
  color: rgba(207, 235, 255, 0.58);
  font-size: 12px;
  text-align: center;
}

.bs-center-tabs .active {
  color: #fff;
  background: linear-gradient(180deg, rgba(69, 161, 255, 0.45), rgba(24, 89, 168, 0.42));
}

.bs-globe-shell {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  padding-top: 16px;
}

.bs-panel {
  position: relative;
  overflow: hidden;
  color: var(--text);
  background:
    linear-gradient(90deg, rgba(2, 24, 67, 0.88), rgba(3, 25, 71, 0.54) 56%, rgba(3, 18, 55, 0.18)),
    linear-gradient(180deg, rgba(11, 68, 136, 0.12), rgba(9, 25, 66, 0.06));
  border-top: 1px solid rgba(77, 180, 255, 0.42);
  box-shadow: 0 -1px 0 rgba(138, 222, 255, 0.12) inset;
}

.bs-panel::before,
.bs-panel::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(63, 190, 255, 0.66), transparent);
  pointer-events: none;
}

.bs-panel::before { top: 0; }
.bs-panel::after { bottom: 0; opacity: 0.36; }

.bs-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 0 9px;
  color: #f4fbff;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-shadow: 0 0 10px rgba(58, 202, 255, 0.28);
}

.bs-panel-header svg {
  width: 17px;
  height: 17px;
  color: #d6f8ff;
  filter: drop-shadow(0 0 5px rgba(49, 214, 255, 0.48));
}

.bs-panel-body { padding: 0 0 12px; }

.bs-analysis { flex: 0 0 220px; }
.bs-aircraft { flex: 0 0 126px; }
.bs-delay { flex: 0 0 164px; }
.bs-exception { flex: 1 1 0; min-height: 0; }
.bs-people { flex: 0 0 192px; }
.bs-carrier { flex: 0 0 156px; }
.bs-fuel { flex: 0 0 112px; }
.bs-watch { flex: 1; min-height: 0; }
.bs-income { width: 100%; height: 154px; flex: 0 0 154px; }

.bs-kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding-top: 1px;
}

.bs-kpi {
  display: grid;
  grid-template-columns: 46px 1fr;
  align-items: center;
  min-width: 0;
}

.bs-kpi-ring {
  position: relative;
  width: 44px;
  height: 44px;
}

.bs-kpi-ring svg { width: 44px; height: 44px; transform: rotate(-90deg); }
.bs-kpi-ring span {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--tone);
  font-size: 13px;
  font-weight: 800;
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--tone) 65%, transparent));
}

.bs-kpi-value {
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 0 12px rgba(49, 214, 255, 0.28);
}

.bs-kpi-value small {
  margin-left: 4px;
  color: rgba(212, 236, 255, 0.58);
  font-size: 10px;
  font-weight: 500;
}

.bs-kpi-prev { margin-top: 6px; color: rgba(190, 225, 255, 0.62); font-size: 12px; }
.bs-kpi-prev b { color: #4ccfff; font-weight: 700; }

.bs-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px 20px;
  margin-top: 12px;
}

.bs-mini-stat {
  position: relative;
  padding-bottom: 10px;
}

.bs-mini-stat::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 2px;
  height: 1px;
  background: linear-gradient(90deg, rgba(49, 214, 255, 0.66), rgba(49, 214, 255, 0.2), transparent);
}

.bs-mini-value {
  color: #f8fdff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
}

.bs-mini-label {
  margin-top: 5px;
  color: rgba(185, 219, 255, 0.6);
  font-size: 12px;
}

.bs-aircraft-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 1px 0 8px;
}

.bs-aircraft-card {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 9px;
  align-items: center;
}

.bs-aircraft-card svg { color: #54cfff; }
.bs-aircraft-card strong {
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
}

.bs-aircraft-card span { color: rgba(190, 225, 255, 0.62); font-size: 12px; }

.bs-subrow,
.bs-fuel-row,
.bs-carrier-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.bs-subitem strong,
.bs-carrier-item strong,
.bs-fuel-item strong {
  display: block;
  color: #f7fbff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  line-height: 1;
}

.bs-subitem span,
.bs-carrier-item span,
.bs-fuel-item span {
  display: block;
  margin-top: 6px;
  color: rgba(190, 225, 255, 0.62);
  font-size: 12px;
}

.bs-delay-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.43fr) minmax(0, 0.57fr);
  gap: 10px;
}

.bs-thermo-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.bs-thermo { display: grid; justify-items: center; gap: 5px; color: rgba(205, 232, 255, 0.72); font-size: 11px; }
.bs-thermo b { color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 16px; }
.bs-thermo-tube {
  position: relative;
  width: 16px;
  height: 44px;
  border-radius: 99px;
  border: 1px solid rgba(181, 232, 255, 0.5);
  background: rgba(10, 48, 92, 0.45);
  box-shadow: inset 0 0 10px rgba(49, 214, 255, 0.2);
}
.bs-thermo-tube i {
  position: absolute;
  left: 3px;
  right: 3px;
  bottom: 3px;
  height: var(--pct);
  border-radius: 99px;
  background: linear-gradient(180deg, #fff7a2, var(--tone));
  box-shadow: 0 0 10px var(--tone);
}

.bs-bars { display: grid; gap: 8px; }
.bs-bar-row { display: grid; grid-template-columns: 72px minmax(0, 1fr) 24px; align-items: center; gap: 8px; font-size: 12px; }
.bs-bar-label { color: rgba(210, 236, 255, 0.74); }
.bs-bar-track { height: 4px; background: rgba(49, 214, 255, 0.16); overflow: hidden; }
.bs-bar-fill { height: 100%; width: var(--pct); background: linear-gradient(90deg, rgba(72, 226, 255, 0.45), #64e8ff); box-shadow: 0 0 10px rgba(49, 214, 255, 0.55); }
.bs-bar-num { color: #fff; font-family: 'JetBrains Mono', monospace; text-align: right; }

.bs-table {
  width: 100%;
  border-collapse: collapse;
  color: rgba(226, 244, 255, 0.78);
  font-size: 12px;
}

.bs-table th {
  padding: 6px 6px 8px;
  color: rgba(174, 218, 255, 0.72);
  font-weight: 500;
  text-align: left;
}

.bs-table td {
  padding: 6px;
  border-left: 2px solid transparent;
  font-family: 'JetBrains Mono', monospace;
}

.bs-table tbody tr:nth-child(odd) { background: rgba(14, 73, 138, 0.12); }
.bs-table tbody tr td:first-child { border-left-color: rgba(49, 214, 255, 0.58); }
.bs-table .cyan { color: #43dfff; }
.bs-table .gold { color: #ffd45c; }
.bs-table .green { color: #5fffc1; }

.bs-people-layout {
  display: grid;
  grid-template-columns: 32% 68%;
  gap: 10px;
}

.bs-people-rings { display: grid; gap: 8px; }
.bs-person-ring { display: grid; grid-template-columns: 44px 1fr; align-items: center; gap: 8px; }
.bs-person-ring strong { color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 14px; }
.bs-person-ring span { color: rgba(190, 225, 255, 0.72); font-size: 11px; }

.bs-group-bars {
  position: relative;
  height: 134px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: end;
  gap: 16px;
  padding: 18px 0 20px 18px;
  border-left: 1px solid rgba(93, 180, 255, 0.16);
  background:
    linear-gradient(rgba(125, 189, 255, 0.18) 1px, transparent 1px) 0 18px / 100% 25%,
    linear-gradient(90deg, rgba(49, 214, 255, 0.08), transparent 58%);
}

.bs-group { display: flex; align-items: end; justify-content: center; gap: 4px; height: 92px; }
.bs-group i { display: block; width: 7px; height: var(--h); border-radius: 7px 7px 0 0; background: var(--tone); box-shadow: 0 0 10px color-mix(in srgb, var(--tone) 58%, transparent); }
.bs-group-label { position: absolute; bottom: 2px; color: rgba(202, 231, 255, 0.62); font-size: 11px; transform: translateX(-4px); }

.bs-carrier-grid { gap: 16px 18px; }
.bs-carrier-item,
.bs-fuel-item { min-width: 0; }
.bs-carrier-item strong small,
.bs-fuel-item strong small { margin-left: 4px; color: rgba(190, 225, 255, 0.62); font-size: 11px; }

.bs-fuel-row { gap: 20px; }
.bs-fuel-item strong { font-size: 19px; }

.bs-income-body {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 12px;
  align-items: stretch;
}
.bs-income-scale {
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  align-items: center;
  color: rgba(176, 213, 255, 0.52);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.bs-income-chart { width: 100%; height: 104px; }

.bs-flight-row { display: grid; grid-template-columns: 74px 1fr 104px 64px 58px; gap: 8px; align-items: center; padding: 6px 0; border-top: 1px solid rgba(96, 180, 255, 0.16); font-size: 12px; }
.bs-flight-tag { display: inline-grid; min-width: 34px; padding: 2px 8px; place-items: center; border-radius: 999px; color: #fff; background: linear-gradient(90deg, #28d7ff, #1f80ff); font-weight: 800; }
.bs-flight-route { color: #fff; }
.bs-flight-time { color: rgba(218, 241, 255, 0.78); font-family: 'JetBrains Mono', monospace; text-align: right; }
.bs-flight-status { color: #5fffc1; text-align: right; }

@media (max-height: 760px) {
  .bs-main { padding-top: 64px; gap: 18px; }
  .bs-side { gap: 10px; }
  .bs-panel-header { padding: 8px 0 7px; font-size: 14px; }
  .bs-panel-body { padding-bottom: 9px; }
  .bs-mini-grid { margin-top: 11px; gap: 11px 16px; }
  .bs-income { height: 136px; flex-basis: 136px; }
  .bs-income-chart { height: 88px; }
}
`;

function formatNumber(value: number | string | undefined | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return new Intl.NumberFormat('zh-CN').format(n);
}

function formatWan(value: number) {
  return `${(value / 10000).toFixed(1)}万`;
}

function Panel({ title, icon, children, className = '' }: { title: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bs-panel ${className}`}>
      <div className="bs-panel-header">
        {icon}
        <span>{title}</span>
      </div>
      <div className="bs-panel-body">{children}</div>
    </section>
  );
}

function KpiRing({ icon, value, unit, prev, color, percent }: { icon: string; value: string; unit?: string; prev: string; color: string; percent: number }) {
  const radius = 18;
  const circumference = Math.PI * 2 * radius;
  return (
    <div className="bs-kpi" style={{ '--tone': color } as StyleVars}>
      <div className="bs-kpi-ring">
        <svg viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(160,220,255,.18)" strokeWidth="3" />
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent / 100)}
            strokeLinecap="round"
            strokeWidth="3"
          />
        </svg>
        <span>{icon}</span>
      </div>
      <div>
        <div className="bs-kpi-value">今 {value}{unit ? <small>{unit}</small> : null}</div>
        <div className="bs-kpi-prev"><b>昨</b> {prev}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color = '#eaf8ff' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bs-mini-stat">
      <div className="bs-mini-value" style={{ color }}>{value}</div>
      <div className="bs-mini-label">{label}</div>
    </div>
  );
}

function SubItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bs-subitem">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Thermo({ label, value, color, pct }: { label: string; value: number; color: string; pct: number }) {
  return (
    <div className="bs-thermo" style={{ '--tone': color, '--pct': `${pct}%` } as StyleVars}>
      <span>{label}</span>
      <b>{value}</b>
      <div className="bs-thermo-tube"><i /></div>
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="bs-bar-row" style={{ '--pct': `${Math.max(8, (value / max) * 100)}%` } as StyleVars}>
      <span className="bs-bar-label">{label}</span>
      <div className="bs-bar-track"><div className="bs-bar-fill" /></div>
      <span className="bs-bar-num">{value}</span>
    </div>
  );
}

function TinyRing({ color, percent }: { color: string; percent: number }) {
  const radius = 17;
  const circumference = Math.PI * 2 * radius;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="20" cy="20" r={radius} fill="none" stroke="rgba(155,220,255,.16)" strokeWidth="3" />
      <circle cx="20" cy="20" r={radius} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} />
    </svg>
  );
}

function IncomeChart() {
  const bars = [62, 76, 69, 84, 58, 78, 72];
  const line1 = 'M20 68 C62 46 82 46 120 57 C160 68 176 24 220 36 C260 49 278 80 316 60 C360 36 386 40 430 26';
  const line2 = 'M20 44 C66 36 92 32 128 46 C170 62 188 74 226 64 C265 51 278 30 316 36 C360 45 380 58 430 50';
  return (
    <div className="bs-income-body">
      <div className="bs-income-scale"><span>12,000</span><span>10,000</span><span>8,000</span><span>6,000</span></div>
      <svg className="bs-income-chart" viewBox="0 0 452 108" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bsBarA" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="rgba(57,219,255,.92)" />
            <stop offset="1" stopColor="rgba(57,219,255,.12)" />
          </linearGradient>
          <linearGradient id="bsBarB" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="rgba(89,255,199,.78)" />
            <stop offset="1" stopColor="rgba(89,255,199,.10)" />
          </linearGradient>
        </defs>
        {[20, 86, 152, 218, 284, 350, 416].map((x, i) => (
          <g key={x}>
            <rect x={x} y={92 - bars[i]} width="10" height={bars[i]} fill="url(#bsBarA)" rx="2" />
            <rect x={x + 15} y={92 - bars[i] * 0.62} width="10" height={bars[i] * 0.62} fill="url(#bsBarB)" rx="2" />
            <text x={x + 10} y="105" textAnchor="middle" fill="rgba(205,232,255,.58)" fontSize="9">03-{12 + i}</text>
          </g>
        ))}
        {[24, 48, 72].map((y) => <line key={y} x1="0" y1={y} x2="452" y2={y} stroke="rgba(120,188,255,.18)" strokeWidth="1" />)}
        <path d={line1} fill="none" stroke="#ffd45c" strokeWidth="2" />
        <path d={line2} fill="none" stroke="#54eaff" strokeWidth="2" />
        {[68, 57, 36, 60, 26].map((y, i) => <circle key={i} cx={[20, 120, 220, 316, 430][i]} cy={y} r="3" fill="#ffd45c" />)}
      </svg>
    </div>
  );
}

export default function BigScreenPage() {
  const { data: apiStats } = useQuery<Stats>({
    queryKey: ['bigscreen', 'stats'],
    queryFn: async () => {
      try {
        const res = await http.get<any>('/bigscreen/stats');
        return normalizeStats(res);
      } catch (err: any) {
        // 区分 403 权限不足与网络错误
        if (err?.response?.status === 403) {
          console.warn('[BigScreen] 权限不足，使用 fallback 数据');
        }
        return fallbackStats;
      }
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
    throwOnError: false,
    initialData: fallbackStats,
  });

  const stats = normalizeStats(apiStats);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const view = useMemo(() => {
    const maintenance = Math.max(6, stats.pendingWorkOrders ?? 0);
    return {
      totalText: formatNumber(stats.totalAssets),
      valueWan: formatWan(stats.totalValue),
      netWan: formatWan(stats.netValue),
      maintenance,
      normalRate: Math.max(0, Math.min(100, 100 - (stats.criticalAlerts / Math.max(stats.totalAssets, 1)) * 100)),
    };
  }, [stats]);

  const pad = (value: number) => String(value).padStart(2, '0');
  const dateText = `${time.getFullYear().toString().slice(2)}/${pad(time.getMonth() + 1)}/${pad(time.getDate())}`;

  return (
    <div className="bs-page">
      <style>{CSS}</style>

      <header className="bs-topline">
        <div className="bs-top-left">
          <span>值班领导：<strong>王珂玉</strong></span>
          <span>值班经理：<strong>吴菲菲 段琪</strong></span>
        </div>

        <div className="bs-title" aria-label="资产运营分析平台">
          <div className="bs-title-main">
            <span className="bs-logo" aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none">
                <path d="M10 34C25 33 35 24 46 12C40 29 27 38 10 42" stroke="#c8f6ff" strokeWidth="3" strokeLinecap="round" />
                <path d="M16 45C29 44 41 37 55 24C49 39 36 50 17 52" stroke="#62dfff" strokeWidth="3" strokeLinecap="round" />
                <path d="M18 22C28 22 35 17 43 10" stroke="#7ee8ff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span>资产运营分析平台</span>
          </div>
          <div className="bs-title-sub">Asset Operation Analysis Platform</div>
        </div>

        <div className="bs-top-right">
          <span>{dateText}</span>
          <span>星期四</span>
          <span>湿度52%</span>
          <span>风速2米/秒</span>
          <span>多云 6°</span>
        </div>
      </header>

      <main className="bs-main">
        <aside className="bs-side">
          <Panel className="bs-analysis" title="资产运行分析" icon={<Plane />}>
            <div className="bs-kpi-row">
              <KpiRing icon="资" value={view.totalText} prev="56 件" color="#55ddff" percent={78} />
              <KpiRing icon="率" value={stats.utilizationRate.toFixed(1)} unit="%" prev="34.2%" color="#ffd45c" percent={Math.max(8, stats.utilizationRate)} />
              <KpiRing icon="值" value={view.netWan} prev="4.8万" color="#ff4f9a" percent={82} />
            </div>
            <div className="bs-mini-grid">
              <MiniStat label="今日新增数量" value="10" color="#55ddff" />
              <MiniStat label="今日借用数量" value="2" color="#55ddff" />
              <MiniStat label="今日调拨数量" value="10" color="#55ddff" />
              <MiniStat label="昨日取消数量" value="8" color="#55ddff" />
              <MiniStat label="昨日盘点数量" value="6" color="#55ddff" />
              <MiniStat label="昨日返库数量" value="15" color="#55ddff" />
            </div>
          </Panel>

          <Panel className="bs-aircraft" title="今日资产信息" icon={<Database />}>
            <div className="bs-aircraft-main">
              <div className="bs-aircraft-card">
                <Package size={28} />
                <div><strong>186架</strong><span>在册飞机总数</span></div>
              </div>
              <div className="bs-aircraft-card">
                <Gauge size={28} />
                <div><strong>176架</strong><span>执行航班飞机数</span></div>
              </div>
            </div>
            <div className="bs-subrow">
              <SubItem label="定检飞机数量" value="10架" />
              <SubItem label="故障飞机数量" value="6架" />
              <SubItem label="备勤飞机数量" value="88架" />
            </div>
          </Panel>

          <Panel className="bs-delay" title="资产异常分析" icon={<Activity />}>
            <div className="bs-delay-grid">
              <div>
                <div style={{ color: 'rgba(190,225,255,.65)', fontSize: 12, marginBottom: 8 }}>异常阈值：100</div>
                <div className="bs-thermo-row">
                  <Thermo label="2小时内" value={12} color="#36dfff" pct={34} />
                  <Thermo label="2-4小时" value={75} color="#9bff63" pct={78} />
                  <Thermo label="4小时以上" value={13} color="#ffd45c" pct={42} />
                </div>
              </div>
              <div className="bs-bars">
                {[
                  ['天气因素', 28],
                  ['航空管制', 24],
                  ['机械故障', 20],
                  ['飞机调配', 16],
                  ['机场原因', 12],
                ].map(([label, value]) => <BarRow key={label} label={String(label)} value={Number(value)} max={28} />)}
              </div>
            </div>
          </Panel>

          <Panel className="bs-exception" title="今日不正常情况明细" icon={<BarChart3 />}>
            <table className="bs-table">
              <thead>
                <tr><th>航班</th><th>起站</th><th>延误状态</th><th>延误原因</th></tr>
              </thead>
              <tbody>
                {[
                  ['318', '成都-北京', '返航', '天气因素'],
                  ['319', '重庆-北京', '返航', '航空管制'],
                  ['341', '哈尔滨-北京', '返航', '机械故障'],
                  ['332', '杭州-北京', '取消', '旅客原因'],
                  ['332', '杭州-北京', '备降', '旅客原因'],
                ].map((row) => (
                  <tr key={row.join('-')}>
                    <td>{row[0]}</td><td>{row[1]}</td><td className="cyan">{row[2]}</td><td>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </aside>

        <section className="bs-center">
          <div className="bs-center-tabs"><span className="active">国际</span><span>国内</span></div>
          <div className="bs-globe-shell">
            <AssetMapChart height="100%" />
          </div>
          <Panel className="bs-income" title="收入运力信息" icon={<Database />}>
            <IncomeChart />
          </Panel>
        </section>

        <aside className="bs-side">
          <Panel className="bs-people" title="人员信息" icon={<Users />}>
            <div className="bs-people-layout">
              <div className="bs-people-rings">
                {[
                  ['飞行', '#ffd45c'],
                  ['空乘', '#36dfff'],
                  ['空保', '#357dff'],
                ].map(([label, color]) => (
                  <div className="bs-person-ring" key={label}>
                    <div style={{ position: 'relative', width: 40, height: 40 }}>
                      <TinyRing color={color} percent={75} />
                      <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color, fontSize: 10, fontWeight: 800 }}>{label}</span>
                    </div>
                    <div><strong>264人</strong><span>75.2%</span></div>
                  </div>
                ))}
              </div>
              <div className="bs-group-bars">
                {[
                  ['机长', [50, 35, 28, 32]],
                  ['副驾', [42, 30, 22, 24]],
                  ['机长(合外)', [38, 26, 20, 18]],
                  ['副驾(合外)', [44, 32, 26, 30]],
                ].map(([label, heights]) => (
                  <div className="bs-group" key={String(label)}>
                    {(heights as number[]).map((height, i) => (
                      <i key={i} style={{ '--h': `${height}px`, '--tone': ['#6cd9ff', '#7b6dff', '#ffd45c', '#ff6e9e'][i] } as StyleVars} />
                    ))}
                    <span className="bs-group-label">{String(label)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel className="bs-carrier" title="承运情况分析" icon={<Package />}>
            <div className="bs-carrier-grid">
              <div className="bs-carrier-item"><strong>2350</strong><span>今日计划航班数</span></div>
              <div className="bs-carrier-item"><strong>8800</strong><span>实时承运人数</span></div>
              <div className="bs-carrier-item"><strong>87.68%</strong><span>实时客座率</span></div>
              <div className="bs-carrier-item"><strong>18</strong><span>今日VIP旅客数</span></div>
              <div className="bs-carrier-item"><strong>32</strong><span>今日特殊旅客数</span></div>
              <div className="bs-carrier-item"><strong>2100</strong><span>今日提供座位数</span></div>
            </div>
          </Panel>

          <Panel className="bs-fuel" title="油量信息" icon={<Droplets />}>
            <div className="bs-fuel-row">
              <div className="bs-fuel-item"><strong>10.77<small>0.22 ↑</small></strong><span>耗油量（万吨）</span></div>
              <div className="bs-fuel-item"><strong>5.78<small>1.46 ↑</small></strong><span>节油量（百吨）</span></div>
              <div className="bs-fuel-item"><strong>12.24<small>0.00 -</small></strong><span>燃油价格（元/吨）</span></div>
            </div>
          </Panel>

          <Panel className="bs-watch" title="重点关注航班信息" icon={<Bell />}>
            {[
              ['重点', '3U8888', '西昌 - 成都', '13:05 - 14:10', '1类'],
              ['预警', '3U8888', '三亚 - 成都', '13:05 - 14:10', '2类'],
              ['重点', '3U8888', '西昌 - 成都', '13:05 - 14:10', '2类'],
            ].map((row, index) => (
              <div className="bs-flight-row" key={index}>
                <span className="bs-flight-tag" style={{ background: row[0] === '预警' ? 'linear-gradient(90deg,#32f4ff,#35d979)' : undefined }}>{row[0]}</span>
                <span>{row[1]}</span>
                <span className="bs-flight-route">{row[2]}</span>
                <span className="bs-flight-time">{row[3]}</span>
                <span className="bs-flight-status">{row[4]}</span>
              </div>
            ))}
            <div style={{ marginTop: 7, color: 'rgba(205,232,255,.66)', fontSize: 12 }}>
              关舱门：13:05　起飞：15:30　落地：14:10
            </div>
          </Panel>
        </aside>
      </main>
    </div>
  );
}
