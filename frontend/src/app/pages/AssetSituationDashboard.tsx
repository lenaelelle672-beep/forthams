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
  text: "#ffffff",
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

const ARCH_LAYERS = [
  { label: "现场设备层", desc: "数控机床 · 机械臂 · 变频器", highlight: false },
  { label: "现场控制层", desc: "PLC · RTU · HMI", highlight: false },
  { label: "过程控制层", desc: "DCS · SCADA · 工程师站", highlight: false },
  { label: "生产执行层", desc: "MES · 操作员站 · 历史数据库", highlight: false },
  { label: "办公管理层", desc: "ERP · CRM · OA", highlight: true },
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

/* ─── 3D Architecture SVG ────────────────────────────────────────────────── */
function ArchDiagram() {
  const cx = 210;
  const baseY = 330;
  const spacingY = 54;
  const baseRx = 145;
  const baseRy = 36;
  const shrink = 0.81;

  return (
    <svg
      viewBox="0 0 510 400"
      style={{ width: "100%", height: "100%" }}
      aria-label="工业资产架构分层图"
    >
      <defs>
        <radialGradient id="archBgGlow" cx="50%" cy="70%" r="50%">
          <stop offset="0%" stopColor={T.accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={T.accent} stopOpacity="0" />
        </radialGradient>
        <filter id="archGlow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="softBlur">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.accent} stopOpacity="0.6" />
          <stop offset="100%" stopColor={T.accent} stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Ambient glow */}
      <ellipse cx={cx} cy={baseY - 80} rx={200} ry={110} fill="url(#archBgGlow)" />

      {/* Central light column (blurred background) */}
      <rect
        x={cx - 3}
        y={55}
        width={6}
        height={baseY - 55}
        fill={T.accent}
        opacity={0.15}
        filter="url(#softBlur)"
      />
      {/* Central dashed line */}
      <line
        x1={cx}
        y1={70}
        x2={cx}
        y2={baseY - 5}
        stroke={T.accent}
        strokeWidth={1}
        strokeDasharray="5,5"
        opacity={0.45}
      />

      {/* Layers — rendered bottom-to-top (i=0 is the largest base) */}
      {ARCH_LAYERS.map((layer, i) => {
        const rx = baseRx * Math.pow(shrink, i);
        const ry = baseRy * Math.pow(shrink, i);
        const y = baseY - i * spacingY;
        const isTop = i === ARCH_LAYERS.length - 1;
        const fillColor = isTop ? "#ff9632" : T.accent;
        const fillOpacity = isTop ? 0.32 : 0.18 + i * 0.02;
        const strokeOpacity = isTop ? 0.9 : 0.65;

        return (
          <g key={layer.label}>
            {/* Shadow rim below disc for 3D depth */}
            <ellipse
              cx={cx}
              cy={y + 7}
              rx={rx * 0.95}
              ry={ry * 0.55}
              fill="rgba(0,0,0,0.25)"
            />

            {/* Main disc */}
            <ellipse
              cx={cx}
              cy={y}
              rx={rx}
              ry={ry}
              fill={fillColor}
              fillOpacity={fillOpacity}
              stroke={fillColor}
              strokeWidth={isTop ? 2 : 1.5}
              strokeOpacity={strokeOpacity}
              filter={isTop ? "url(#archGlow)" : undefined}
            />

            {/* Inner concentric ring */}
            <ellipse
              cx={cx}
              cy={y}
              rx={rx * 0.52}
              ry={ry * 0.52}
              fill="none"
              stroke={fillColor}
              strokeWidth={0.6}
              opacity={0.35}
            />

            {/* Device dots on disc surface */}
            {[-0.55, -0.1, 0.35].map((offset, di) => (
              <circle
                key={di}
                cx={cx + rx * offset}
                cy={y - ry * 0.2}
                r={2.5}
                fill={fillColor}
                opacity={0.75}
              />
            ))}

            {/* Connector line to label */}
            <line
              x1={cx + rx + 2}
              y1={y}
              x2={cx + rx + 20}
              y2={y}
              stroke={T.sub}
              strokeWidth={0.8}
              opacity={0.6}
            />
            <circle cx={cx + rx + 2} cy={y} r={2} fill={T.sub} opacity={0.5} />

            {/* Layer label */}
            <text
              x={cx + rx + 24}
              y={y - 5}
              fill={isTop ? "#ff9632" : T.text}
              fontSize={isTop ? 12 : 11}
              fontWeight={isTop ? 700 : 400}
              fontFamily="'PingFang SC', 'Source Han Sans CN', sans-serif"
            >
              {layer.label}
            </text>
            <text
              x={cx + rx + 24}
              y={y + 9}
              fill={T.sub}
              fontSize={9.5}
              fontFamily="'PingFang SC', 'Source Han Sans CN', sans-serif"
            >
              {layer.desc}
            </text>
          </g>
        );
      })}

      {/* Crown marker at top */}
      <circle
        cx={cx}
        cy={baseY - (ARCH_LAYERS.length - 1) * spacingY - 24}
        r={10}
        fill={T.accent}
        opacity={0.45}
        filter="url(#archGlow)"
      />
      <circle
        cx={cx}
        cy={baseY - (ARCH_LAYERS.length - 1) * spacingY - 24}
        r={4}
        fill={T.text}
        opacity={0.9}
      />
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
              工业资产架构分层视图
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
