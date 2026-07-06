/**
 * @module frontend/src/app/pages/AssetSituationDashboard
 * @description 资产态势大屏 — 工业级暗色科技风数据可视化仪表盘
 *
 * 布局：三栏式 25% | 50% | 25%，内嵌于 RootLayout 主内容区。
 * 图表：recharts (BarChart / AreaChart / PieChart)
 * 3D 架构图：纯 SVG 等距投影模拟
 */

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ─── Design Tokens ──────────────────────────────────────────────────────── */
const T = {
  bg: "#0a0e1a",
  panelBg: "rgba(13,26,48,0.9)",
  border: "#1a3050",
  accent: "#00d4ff",
  accent2: "#0099cc",
  accent3: "#4ecdc4",
  warn: "#ff6b6b",
  gold: "#ffd93d",
  purple: "#a78bfa",
  text: "#e2e8f0",
  sub: "#8899aa",
  grid: "#1a2540",
} as const;

/* ─── Mock Data ──────────────────────────────────────────────────────────── */
const STATS = [
  { label: "活跃", value: "1,143" },
  { label: "消失", value: "113" },
  { label: "重点", value: "113" },
  { label: "允许外联", value: "113" },
];

const VALUE_STATS = [
  { label: "核心资产", count: 113, color: T.warn },
  { label: "重要资产", count: 243, color: T.gold },
  { label: "次要资产", count: 1243, color: T.accent3 },
];

const DISTRICT_DATA = [
  { name: "分区一", value: 230 },
  { name: "分区二", value: 180 },
  { name: "分区三", value: 150 },
  { name: "分区四", value: 120 },
  { name: "分区五", value: 90 },
];

const ACCESS_TOP5 = [
  { name: "重点资产名称一", value: 1000 },
  { name: "重点资产名称二", value: 800 },
  { name: "重点资产名称三", value: 540 },
  { name: "重点资产名称四", value: 400 },
  { name: "重点资产名称五", value: 300 },
];

const TREND_DATA = [
  { date: "09/17", value: 80 },
  { date: "09/19", value: 150 },
  { date: "09/21", value: 120 },
  { date: "09/23", value: 180 },
  { date: "09/25", value: 200 },
  { date: "09/27", value: 160 },
  { date: "09/29", value: 220 },
  { date: "10/01", value: 190 },
  { date: "10/02", value: 210 },
];

const TYPE_TOP5 = [
  { name: "终端设备", value: 1000 },
  { name: "安全设备", value: 800 },
  { name: "工控设备", value: 540 },
  { name: "网络设备", value: 400 },
  { name: "其他资产", value: 300 },
];

const BRAND_DATA = [
  { name: "品牌一", value: 55, color: T.accent },
  { name: "品牌二", value: 15, color: T.warn },
  { name: "品牌三", value: 15, color: T.gold },
  { name: "品牌四", value: 10, color: T.accent3 },
  { name: "品牌五", value: 5, color: T.purple },
];

const OS_DATA = [
  { name: "Win7", value: 380 },
  { name: "Win8", value: 280 },
  { name: "MacOS", value: 220 },
  { name: "Linux", value: 150 },
  { name: "未知", value: 80 },
];

/* ─── Panel Wrapper ──────────────────────────────────────────────────────── */
function Panel({
  title,
  children,
  flex,
}: {
  title: string;
  children: React.ReactNode;
  flex?: boolean;
}) {
  return (
    <div
      style={{
        background: T.panelBg,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        marginBottom: 10,
        overflow: "hidden",
        ...(flex ? { flex: 1, display: "flex", flexDirection: "column" } : {}),
      }}
    >
      <div
        style={{
          background: "linear-gradient(90deg, #0c1a3a 0%, #0a1530 100%)",
          borderLeft: `3px solid ${T.accent}`,
          padding: "5px 10px",
          fontSize: 12,
          fontWeight: 600,
          color: T.text,
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flexShrink: 0,
        }}
      >
        {title}
      </div>
      <div style={{ padding: 10, ...(flex ? { flex: 1 } : {}) }}>{children}</div>
    </div>
  );
}

/* ─── Dark Chart Tooltip ─────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(8,12,24,0.97)",
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        padding: "6px 10px",
        fontSize: 11,
        color: T.text,
      }}
    >
      <div style={{ color: T.sub, marginBottom: 2 }}>{label}</div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color ?? T.accent }}>
          {p.name ? `${p.name}: ` : ""}
          {p.value}
        </div>
      ))}
    </div>
  );
}

/* ─── Horizontal Progress Bar ────────────────────────────────────────────── */
function HBar({ name, value, max, idx }: { name: string; value: number; max: number; idx: number }) {
  const COLORS = [T.accent, T.accent2, "#0077aa", "#005588", "#003366"];
  const color = COLORS[idx % COLORS.length];
  const pct = (value / max) * 100;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span
          style={{
            fontSize: 11,
            color: T.sub,
            maxWidth: 130,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
        <span style={{ fontSize: 11, color: T.text, fontFamily: "monospace", flexShrink: 0 }}>
          {value}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "rgba(0,100,150,0.2)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, rgba(0,212,255,0.3))`,
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}

/* ─── Tech Point Network SVG ──────────────────────────────────────────────── */
function ArchDiagram() {
  const cx = 255;
  const cy = 204;
  const nodes = [
    { id: "core", label: "资产中枢", x: cx, y: cy, r: 15, level: "核心", color: T.accent },
    { id: "asset", label: "资产台账", x: 254, y: 74, r: 9, level: "主数据", color: T.accent },
    { id: "rfid", label: "RFID盘点", x: 368, y: 115, r: 8, level: "采集", color: T.accent3 },
    { id: "audit", label: "审计日志", x: 415, y: 218, r: 8, level: "追踪", color: T.purple },
    { id: "approval", label: "审批流程", x: 334, y: 318, r: 8, level: "流转", color: T.gold },
    { id: "warning", label: "预警监控", x: 176, y: 315, r: 8, level: "告警", color: T.warn },
    { id: "warehouse", label: "位置资产", x: 98, y: 205, r: 8, level: "空间", color: T.accent3 },
    { id: "supplier", label: "供应商", x: 151, y: 111, r: 7, level: "外部", color: T.purple },
  ];

  const links = [
    ["core", "asset"],
    ["core", "rfid"],
    ["core", "audit"],
    ["core", "approval"],
    ["core", "warning"],
    ["core", "warehouse"],
    ["core", "supplier"],
    ["asset", "rfid"],
    ["rfid", "audit"],
    ["approval", "warning"],
    ["warehouse", "supplier"],
  ];

  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <svg
      viewBox="0 0 510 400"
      style={{ width: "100%", height: "100%" }}
      aria-label="资产科技节点态势动画"
    >
      <defs>
        <radialGradient id="techCoreGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={T.accent} stopOpacity="0.18" />
          <stop offset="45%" stopColor={T.accent} stopOpacity="0.08" />
          <stop offset="100%" stopColor={T.accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="techNodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="38%" stopColor={T.accent} stopOpacity="0.86" />
          <stop offset="100%" stopColor={T.accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="techBeam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={T.accent} stopOpacity="0" />
          <stop offset="50%" stopColor={T.accent} stopOpacity="0.78" />
          <stop offset="100%" stopColor={T.accent} stopOpacity="0" />
        </linearGradient>
        <filter id="techGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="techGrid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0v28" fill="none" stroke={T.accent} strokeOpacity="0.06" strokeWidth="1" />
          <circle cx="0" cy="0" r="1" fill={T.accent} fillOpacity="0.13" />
        </pattern>
      </defs>

      <style>{`
        .tech-orbit { transform-box: fill-box; transform-origin: center; animation: techSpin 18s linear infinite; }
        .tech-orbit.fast { animation-duration: 11s; animation-direction: reverse; }
        .tech-orbit.slow { animation-duration: 28s; }
        .tech-node { animation: techNodePulse 2.8s ease-in-out infinite; }
        .tech-node:nth-of-type(2n) { animation-delay: .45s; }
        .tech-link { stroke-dasharray: 8 10; animation: techDash 2.6s linear infinite; }
        .tech-scan { transform-box: fill-box; transform-origin: center; animation: techScan 5s linear infinite; }
        .tech-float { animation: techFloat 4.2s ease-in-out infinite; }
        .tech-packet { filter: url(#techGlow); }
        @keyframes techSpin { to { transform: rotate(360deg); } }
        @keyframes techDash { to { stroke-dashoffset: -72; } }
        @keyframes techNodePulse { 0%,100% { opacity: .74; } 50% { opacity: 1; } }
        @keyframes techScan { to { transform: rotate(360deg); } }
        @keyframes techFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>

      <rect width="510" height="400" fill="url(#techGrid)" opacity={0.9} />
      <circle cx={cx} cy={cy} r="178" fill="url(#techCoreGlow)" />
      <ellipse cx={cx} cy={330} rx="185" ry="36" fill={T.accent} opacity="0.05" />

      <g className="tech-orbit slow" opacity="0.75">
        <ellipse cx={cx} cy={cy} rx="172" ry="112" fill="none" stroke={T.accent} strokeWidth="1" strokeOpacity="0.35" />
        <ellipse cx={cx} cy={cy} rx="112" ry="172" fill="none" stroke={T.purple} strokeWidth="0.7" strokeOpacity="0.18" />
      </g>
      <g className="tech-orbit fast" opacity="0.9">
        <ellipse cx={cx} cy={cy} rx="128" ry="78" fill="none" stroke={T.accent3} strokeWidth="1" strokeOpacity="0.4" />
        <circle cx={cx + 128} cy={cy} r="3.2" fill={T.accent3} filter="url(#techGlow)" />
        <circle cx={cx - 128} cy={cy} r="2.4" fill={T.accent} filter="url(#techGlow)" />
      </g>
      <g className="tech-orbit" opacity="0.86">
        <ellipse cx={cx} cy={cy} rx="72" ry="72" fill="none" stroke={T.accent} strokeWidth="0.8" strokeOpacity="0.34" />
        <circle cx={cx} cy={cy - 72} r="3" fill={T.accent} filter="url(#techGlow)" />
      </g>

      <g className="tech-scan" opacity="0.46">
        <path d={`M${cx} ${cy} L${cx + 168} ${cy - 44} A174 174 0 0 1 ${cx + 124} ${cy + 122} Z`} fill={T.accent} opacity="0.12" />
      </g>

      {links.map(([fromId, toId]) => {
        const from = nodeById.get(fromId)!;
        const to = nodeById.get(toId)!;
        const pathId = `tech-path-${fromId}-${toId}`;
        return (
          <g key={pathId}>
            <path
              id={pathId}
              className="tech-link"
              d={`M${from.x} ${from.y} C${(from.x + to.x) / 2} ${from.y}, ${(from.x + to.x) / 2} ${to.y}, ${to.x} ${to.y}`}
              fill="none"
              stroke="url(#techBeam)"
              strokeWidth="1.2"
              strokeOpacity="0.72"
            />
            {fromId === "core" ? (
              <circle className="tech-packet" r="2.7" fill={to.color}>
                <animateMotion dur={`${2.6 + to.x / 260}s`} repeatCount="indefinite" path={`M${from.x} ${from.y} C${(from.x + to.x) / 2} ${from.y}, ${(from.x + to.x) / 2} ${to.y}, ${to.x} ${to.y}`} />
              </circle>
            ) : null}
          </g>
        );
      })}

      <g className="tech-float">
        <circle cx={cx} cy={cy} r="42" fill={T.accent} opacity="0.08" />
        <circle cx={cx} cy={cy} r="25" fill="none" stroke={T.accent} strokeWidth="1.2" strokeOpacity="0.6" filter="url(#techGlow)" />
        <circle cx={cx} cy={cy} r="13" fill="url(#techNodeGlow)" filter="url(#techGlow)" />
        <text x={cx} y={cy + 38} fill={T.text} fontSize="12" fontWeight="700" textAnchor="middle">
          资产智能中枢
        </text>
        <text x={cx} y={cy + 54} fill={T.sub} fontSize="9" textAnchor="middle">
          DATA · FLOW · RISK · CONTROL
        </text>
      </g>

      {nodes.filter((node) => node.id !== "core").map((node, index) => (
        <g key={node.id} className="tech-node" style={{ animationDelay: `${index * 0.16}s` }}>
          <circle cx={node.x} cy={node.y} r={node.r + 10} fill={node.color} opacity="0.08" />
          <circle cx={node.x} cy={node.y} r={node.r + 4} fill="none" stroke={node.color} strokeWidth="1" strokeOpacity="0.38" />
          <circle cx={node.x} cy={node.y} r={node.r} fill={node.color} opacity="0.78" filter="url(#techGlow)" />
          <circle cx={node.x - 2} cy={node.y - 2} r="2.3" fill="#fff" opacity="0.8" />
          <text x={node.x} y={node.y + 25} fill={T.text} fontSize="10" fontWeight="650" textAnchor="middle">
            {node.label}
          </text>
          <text x={node.x} y={node.y + 38} fill={T.sub} fontSize="8" textAnchor="middle">
            {node.level}
          </text>
        </g>
      ))}

      <g opacity="0.82">
        <text x="24" y="34" fill={T.accent} fontSize="11" fontWeight="700">
          ASSET NODE MAP
        </text>
        <text x="24" y="51" fill={T.sub} fontSize="8.5">
          资产数据链路 / 实时拓扑 / 风险态势
        </text>
      </g>
    </svg>
  );
}

/* ─── Corner Decoration ──────────────────────────────────────────────────── */
function Corners() {
  const size = 18;
  const corners = [
    { top: 8, left: 8, bt: "top", bl: "left" },
    { top: 8, right: 8, bt: "top", bl: "right" },
    { bottom: 8, left: 8, bt: "bottom", bl: "left" },
    { bottom: 8, right: 8, bt: "bottom", bl: "right" },
  ] as const;

  return (
    <>
      {corners.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            ...(c.bt === "top" ? { top: c.top } : { bottom: (c as { bottom: number }).bottom }),
            ...(c.bl === "left" ? { left: (c as { left: number }).left } : { right: (c as { right: number }).right }),
            width: size,
            height: size,
            borderTop: c.bt === "top" ? `2px solid ${T.border}` : "none",
            borderBottom: c.bt === "bottom" ? `2px solid ${T.border}` : "none",
            borderLeft: c.bl === "left" ? `2px solid ${T.border}` : "none",
            borderRight: c.bl === "right" ? `2px solid ${T.border}` : "none",
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export function AssetSituationDashboard() {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setClock(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
          `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const maxAccess = Math.max(...ACCESS_TOP5.map((d) => d.value));
  const maxType = Math.max(...TYPE_TOP5.map((d) => d.value));

  return (
    <div
      style={{
        margin: "-1.5rem",
        minHeight: "calc(100vh - 4rem)",
        background: `linear-gradient(135deg, ${T.bg} 0%, #0d1525 50%, #0a1020 100%)`,
        color: T.text,
        fontFamily: "'PingFang SC', 'Source Han Sans CN', 'Noto Sans SC', sans-serif",
        padding: "12px 16px",
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Corners />

      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 48,
          marginBottom: 10,
          position: "relative",
          flexShrink: 0,
        }}
      >
        {/* Left deco */}
        <div style={{ display: "flex", alignItems: "center", marginRight: 14 }}>
          <div
            style={{
              width: 56,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${T.accent})`,
            }}
          />
          <div
            style={{
              width: 7,
              height: 7,
              background: T.accent,
              transform: "rotate(45deg)",
              margin: "0 5px",
              boxShadow: `0 0 8px ${T.accent}`,
            }}
          />
          <div style={{ width: 28, height: 1, background: T.accent, opacity: 0.6 }} />
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: T.accent,
            textShadow: `0 0 18px ${T.accent}aa, 0 0 36px ${T.accent}44`,
            letterSpacing: "0.18em",
            margin: 0,
          }}
        >
          资产态势大屏
        </h1>

        {/* Right deco */}
        <div style={{ display: "flex", alignItems: "center", marginLeft: 14 }}>
          <div style={{ width: 28, height: 1, background: T.accent, opacity: 0.6 }} />
          <div
            style={{
              width: 7,
              height: 7,
              background: T.accent,
              transform: "rotate(45deg)",
              margin: "0 5px",
              boxShadow: `0 0 8px ${T.accent}`,
            }}
          />
          <div
            style={{
              width: 56,
              height: 1,
              background: `linear-gradient(90deg, ${T.accent}, transparent)`,
            }}
          />
        </div>

        {/* Live clock */}
        <div
          style={{
            position: "absolute",
            right: 4,
            fontSize: 11,
            color: T.sub,
            fontFamily: "monospace",
            letterSpacing: "0.05em",
          }}
        >
          {clock}
        </div>
      </div>

      {/* ── Three-Column Grid ── */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "25% 50% 25%",
          gap: 10,
          minHeight: 0,
        }}
      >
        {/* ────── LEFT ────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Panel 1: Stats Overview */}
          <Panel title="资产统计概览">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 7,
              }}
            >
              {STATS.map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "rgba(10,20,40,0.7)",
                    border: `1px solid ${T.border}`,
                    borderRadius: 4,
                    padding: "8px 6px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: T.accent,
                      fontFamily: "monospace",
                      textShadow: `0 0 10px ${T.accent}66`,
                    }}
                  >
                    {s.value}
                  </div>
                  <div style={{ fontSize: 10, color: T.sub, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Panel 2: Value Stats */}
          <Panel title="资产价值统计">
            <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 10 }}>
              {VALUE_STATS.map((v) => (
                <div key={v.label} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      margin: "0 auto 4px",
                      background: `${v.color}22`,
                      border: `1px solid ${v.color}88`,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                    }}
                  >
                    ▣
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: v.color,
                      fontFamily: "monospace",
                    }}
                  >
                    {v.count.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 9, color: T.sub }}>{v.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: T.sub, marginBottom: 3 }}>分区资产数 TOP5</div>
            <ResponsiveContainer width="100%" height={75}>
              <BarChart data={DISTRICT_DATA} margin={{ top: 2, right: 0, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: T.sub, fontSize: 9 }} stroke={T.grid} />
                <YAxis tick={{ fill: T.sub, fontSize: 9 }} stroke={T.grid} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="value" fill={T.accent} radius={[2, 2, 0, 0]} name="数量" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          {/* Panel 3: Access Top5 */}
          <Panel title="重点数据资产被访问量 TOP5" flex>
            <div>
              {ACCESS_TOP5.map((d, i) => (
                <HBar key={d.name} name={d.name} value={d.value} max={maxAccess} idx={i} />
              ))}
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                {[
                  { label: "内网访问", color: T.accent },
                  { label: "VPN访问", color: T.purple },
                ].map((leg) => (
                  <span
                    key={leg.label}
                    style={{
                      fontSize: 10,
                      color: T.sub,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: leg.color,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    {leg.label}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* ────── CENTER ────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* 3D Architecture Diagram */}
          <div
            style={{
              background: T.panelBg,
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              marginBottom: 10,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            <div
              style={{
                background: "linear-gradient(90deg, #0c1a3a 0%, #0a1530 100%)",
                borderLeft: `3px solid ${T.accent}`,
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: T.text,
                letterSpacing: "0.06em",
                flexShrink: 0,
              }}
            >
              资产科技节点态势图
            </div>
            <div style={{ flex: 1, padding: "6px 0 0", minHeight: 0 }}>
              <ArchDiagram />
            </div>
          </div>

          {/* Activity Trend */}
          <Panel title="资产活跃度趋势图">
            <ResponsiveContainer width="100%" height={115}>
              <AreaChart
                data={TREND_DATA}
                margin={{ top: 5, right: 8, bottom: 0, left: -22 }}
              >
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T.accent} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={T.accent} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.grid} />
                <XAxis dataKey="date" tick={{ fill: T.sub, fontSize: 9 }} stroke={T.grid} />
                <YAxis
                  tick={{ fill: T.sub, fontSize: 9 }}
                  stroke={T.grid}
                  domain={[0, 250]}
                  ticks={[0, 50, 100, 150, 200, 250]}
                />
                <Tooltip content={<DarkTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="活跃资产"
                  stroke={T.accent}
                  strokeWidth={2}
                  fill="url(#trendGrad)"
                  dot={{ fill: T.accent, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: T.accent }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        {/* ────── RIGHT ────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Panel 1: Asset Type Top5 */}
          <Panel title="资产类型 TOP5">
            {TYPE_TOP5.map((d, i) => (
              <HBar key={d.name} name={d.name} value={d.value} max={maxType} idx={i} />
            ))}
          </Panel>

          {/* Panel 2: Brand Donut */}
          <Panel title="资产品牌 TOP5">
            <div style={{ display: "flex", alignItems: "center" }}>
              <PieChart width={106} height={96}>
                <Pie
                  data={BRAND_DATA}
                  cx={53}
                  cy={48}
                  innerRadius={26}
                  outerRadius={43}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {BRAND_DATA.map((entry, idx) => (
                    <Cell key={`brand-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
              </PieChart>
              <div style={{ marginLeft: 8, flex: 1 }}>
                {BRAND_DATA.map((b) => (
                  <div
                    key={b.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: b.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        color: T.sub,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.name}
                    </span>
                    <span
                      style={{ fontSize: 10, color: T.text, fontFamily: "monospace", flexShrink: 0 }}
                    >
                      {b.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {/* Panel 3: OS Distribution */}
          <Panel title="操作系统分布 TOP5" flex>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={OS_DATA} margin={{ top: 5, right: 4, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: T.sub, fontSize: 9 }} stroke={T.grid} />
                <YAxis tick={{ fill: T.sub, fontSize: 9 }} stroke={T.grid} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="value" name="数量" radius={[2, 2, 0, 0]}>
                  {OS_DATA.map((_, idx) => (
                    <Cell
                      key={`os-${idx}`}
                      fill={T.accent}
                      fillOpacity={1 - idx * 0.12}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      </div>
    </div>
  );
}
