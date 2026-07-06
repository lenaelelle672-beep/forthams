import { useEffect, useState, useMemo } from "react";

const T = {
  bg: "#0b0e14",
  panelBg: "rgba(15,25,40,0.6)",
  border: "rgba(60,180,220,0.15)",
  accent: "#4ecdc4",
  accent2: "#45b7aa",
  gold: "#e8a838",
  text: "#e8f4f8",
  sub: "#7a9aaa",
  subDim: "#5a8a9a",
} as const;

function Panel({ title, children, flex }: { title: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        background: T.panelBg,
        position: "relative",
        overflow: "hidden",
        backdropFilter: "blur(2px)",
        ...(flex ? { flex: 1, display: "flex", flexDirection: "column" } : {}),
      }}
    >
      <div
        style={{
          padding: "10px 14px 6px",
          fontSize: 13,
          fontWeight: 700,
          color: "#a8d8ea",
          letterSpacing: 1,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 10,
            background: `linear-gradient(135deg, ${T.accent} 0 40%, transparent 40% 60%, ${T.accent2} 60%)`,
            transform: "skewX(-12deg)",
            boxShadow: `0 0 8px ${T.accent}4d`,
          }}
        />
        {title}
      </div>
      <div style={{ padding: "6px 14px 10px", ...(flex ? { flex: 1 } : {}) }}>{children}</div>
    </div>
  );
}

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let cur = 0;
    const inc = value / 50;
    const timer = setInterval(() => {
      cur += inc;
      if (cur >= value) {
        cur = value;
        clearInterval(timer);
      }
      setDisplay(cur);
    }, 20);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <span
      style={{
        font: '900 28px "SF Mono","JetBrains Mono",monospace',
        color: T.text,
        textShadow: `0 0 14px rgba(60,180,220,0.4)`,
        letterSpacing: 2,
      }}
    >
      {decimals > 0 ? display.toFixed(decimals) : Math.floor(display).toLocaleString()}
    </span>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 36px", alignItems: "center", gap: 6, margin: "6px 0" }}>
      <span style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>{label}</span>
      <div style={{ height: 4, borderRadius: 99, background: "rgba(60,180,220,0.1)", overflow: "hidden" }}>
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            borderRadius: "inherit",
            background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`,
            boxShadow: `0 0 8px rgba(78,205,196,0.3)`,
            transition: "width 1.5s ease-out",
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: T.sub, fontWeight: 700, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

const BAR_HEIGHTS_LEFT = [34, 58, 46, 78, 62, 92, 72, 86];
const BAR_HEIGHTS_RIGHT = [68, 44, 80, 52, 74, 60, 88, 66];
const PEAK_HEIGHTS = [48, 72, 36, 56, 64];

function BarChart({ heights }: { heights: number[] }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        height: 100,
        padding: "0 4px 10px",
        borderBottom: `1px solid rgba(60,180,220,0.1)`,
        backgroundImage: "linear-gradient(rgba(60,180,220,0.04) 1px, transparent 1px)",
        backgroundSize: "100% 25%",
      }}
    >
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${h}%`,
            borderRadius: "3px 3px 0 0",
            background: `linear-gradient(180deg, ${T.accent}, rgba(78,205,196,0.15))`,
            boxShadow: "0 0 10px rgba(78,205,196,0.2)",
            animation: `barGrow${i % 3} 0.8s ease-out both`,
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}

export function CyberDashboardV12() {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setClock(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  return (
    <div
      style={{
        margin: "-1.5rem",
        height: "calc(100vh - 4rem)",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #0b0e14 0%, #0d1321 30%, #111827 60%, #0f1623 100%)",
        color: "#c8d6e5",
        fontFamily: '"Inter","PingFang SC","Microsoft YaHei",sans-serif',
      }}
    >
      <style>{`
        @keyframes barGrow0{from{transform:scaleY(0);transform-origin:bottom}}
        @keyframes barGrow1{from{transform:scaleY(0);transform-origin:bottom}}
        @keyframes barGrow2{from{transform:scaleY(0);transform-origin:bottom}}
        @keyframes peakGlow{to{filter:drop-shadow(0 0 12px rgba(78,205,196,0.6));transform:translateY(-4px)}}
        @keyframes donutSpin{to{transform:rotate(360deg)}}
        @keyframes donutCounter{to{transform:rotate(-360deg)}}
        @keyframes waveFlow{to{transform:translate(-50%,-54%) perspective(800px) rotateX(58deg) rotateZ(-2deg);background-position:100% 0}}
        @keyframes scanDown{0%{top:32%;opacity:0}15%,75%{opacity:1}100%{top:70%;opacity:0}}
        @keyframes dotBounce{to{transform:translateY(-10px) scale(1.15)}}
        @keyframes beamPulse{to{opacity:.4;transform:translateY(6px) scaleX(1.06)}}
        @keyframes surfaceFloat{to{transform:translate(-50%,-52%) perspective(800px) rotateX(58deg) rotateZ(-2deg)}}
        @keyframes pFloat{0%{transform:translateY(0) translateX(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-100vh) translateX(30px);opacity:0}}
        @keyframes panelSweep{0%,40%{left:-40%;opacity:0}55%{opacity:1}100%{left:140%;opacity:0}}
      `}</style>

      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 1 + Math.random() * 2,
              height: 1 + Math.random() * 2,
              borderRadius: "50%",
              background: "rgba(80,200,230,0.6)",
              boxShadow: "0 0 6px rgba(80,200,230,0.4)",
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: "pFloat linear infinite",
              animationDuration: `${8 + Math.random() * 12}s`,
              animationDelay: `${Math.random() * 6}s`,
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          height: "100%",
          display: "grid",
          gridTemplateColumns: "280px 1fr 280px",
          gridTemplateRows: "64px 1fr 220px",
          gap: 12,
          padding: 12,
        }}
      >
        {/* Header */}
        <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 16, font: '600 12px "SF Mono","JetBrains Mono",monospace', color: T.subDim }}>
            <span>FORTHAMS</span><span>杭州</span><span>{dateStr}</span>
          </div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(60,180,220,0.4), transparent)" }} />
          <div style={{ padding: "0 32px", fontSize: 26, fontWeight: 800, color: "#e8f4f8", letterSpacing: 6, textShadow: "0 0 20px rgba(60,180,220,0.5), 0 0 40px rgba(60,180,220,0.2)", whiteSpace: "nowrap" }}>
            企业资产态势监控中心
          </div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(60,180,220,0.4), transparent)" }} />
          <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 16, font: '600 12px "SF Mono","JetBrains Mono",monospace', color: T.subDim }}>
            <span>星期三</span><span>{clock}</span>
          </div>
        </div>

        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel title="资产类型分布">
            <div>
              <AnimatedNumber value={5234} /><span style={{ fontSize: 11, color: T.subDim, fontWeight: 700, marginLeft: 4 }}>台/套</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: 90, padding: "8px 0", borderBottom: `1px solid rgba(60,180,220,0.1)` }}>
              {PEAK_HEIGHTS.map((h, i) => (
                <div key={i} style={{ width: 28, height: h, background: `linear-gradient(180deg, ${T.accent}, rgba(78,205,196,0.15))`, clipPath: "polygon(50% 0, 85% 100%, 15% 100%)", filter: "drop-shadow(0 0 6px rgba(78,205,196,0.4))", animation: "peakGlow 3s ease-in-out infinite alternate", animationDelay: `${-i * 0.6}s` }} />
              ))}
            </div>
          </Panel>

          <Panel title="资产负载分布">
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
              <div style={{ width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, #0f1923 0 42%, transparent 43%), conic-gradient(#4ecdc4 0 35%, #45b7aa 35% 60%, #e8a838 60% 78%, rgba(60,180,220,0.15) 78%)", position: "relative", boxShadow: "0 0 20px rgba(78,205,196,0.15)", animation: "donutSpin 15s linear infinite" }}>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: T.text, font: '900 18px "SF Mono","JetBrains Mono",monospace', textShadow: "0 0 12px rgba(60,180,220,0.4)", animation: "donutCounter 15s linear infinite" }}>5,234</div>
              </div>
            </div>
            <div style={{ marginTop: 6 }}>
              {[{ c: T.accent, l: "设备类 42%" }, { c: T.accent2, l: "电子类 25%" }, { c: T.gold, l: "家具类 15%" }, { c: "rgba(60,180,220,0.3)", l: "其他 18%" }].map((item) => (
                <div key={item.l} style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0", fontSize: 11, color: T.sub, fontWeight: 700 }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: item.c }} />{item.l}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="资产风险趋势" flex>
            <div style={{ height: 100, position: "relative", borderBottom: `1px solid rgba(60,180,220,0.1)`, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 8, right: 8, height: 60, bottom: 16, borderBottom: `2px solid rgba(78,205,196,0.65)`, borderRadius: "50% 50% 0 0", transform: "skewX(-6deg)", boxShadow: "0 0 12px rgba(78,205,196,0.25)" }} />
              <div style={{ position: "absolute", left: 8, right: 8, height: 40, bottom: 8, borderBottom: `2px solid rgba(232,168,56,0.65)`, borderRadius: "50% 50% 0 0", transform: "skewX(10deg)" }} />
            </div>
          </Panel>
        </div>

        {/* Center Area */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: "30px 60px 40px", border: `1px solid rgba(60,180,220,0.12)`, backgroundImage: "linear-gradient(rgba(60,180,220,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(60,180,220,0.04) 1px, transparent 1px)", backgroundSize: "50px 50px", transform: "perspective(800px) rotateX(62deg)", boxShadow: "0 0 50px rgba(60,180,220,0.08)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: "20%", right: "20%", top: "15%", height: "35%", background: "linear-gradient(180deg, rgba(78,205,196,0.18), rgba(60,180,220,0.06), transparent)", clipPath: "polygon(48% 0, 52% 0, 100% 100%, 0 100%)", filter: "blur(0.5px)", animation: "beamPulse 4s ease-in-out infinite alternate", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: "50%", top: "46%", width: 520, height: 260, transform: "translate(-50%,-50%) perspective(800px) rotateX(58deg) rotateZ(-2deg)", border: "1px solid rgba(78,205,196,0.2)", backgroundImage: "linear-gradient(rgba(78,205,196,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(78,205,196,0.06) 1px, transparent 1px)", backgroundSize: "100% 20%, 12% 100%", boxShadow: "0 0 60px rgba(78,205,196,0.1)", animation: "surfaceFloat 7s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", left: "50%", top: "46%", width: 480, height: 180, transform: "translate(-50%,-50%) perspective(800px) rotateX(58deg) rotateZ(-2deg)", background: "linear-gradient(180deg, rgba(78,205,196,0.55), rgba(60,180,220,0.3) 45%, rgba(60,180,220,0.02) 80%)", clipPath: "polygon(0 76%,8% 52%,18% 46%,28% 56%,38% 38%,48% 34%,58% 22%,68% 26%,78% 14%,88% 22%,100% 12%,100% 54%,88% 60%,78% 70%,68% 68%,58% 76%,48% 80%,38% 84%,28% 92%,18% 82%,8% 86%,0 100%)", filter: "drop-shadow(0 0 16px rgba(78,205,196,0.45))", backgroundSize: "200% 100%", animation: "waveFlow 5s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", left: "50%", top: "52%", width: 460, height: 160, transform: "translate(-50%,-50%) perspective(800px) rotateX(58deg) rotateZ(-2deg)", background: "linear-gradient(180deg, rgba(232,168,56,0.6), rgba(200,140,40,0.3), rgba(200,140,40,0.02))", clipPath: "polygon(0 80%,10% 62%,20% 56%,30% 60%,40% 50%,50% 46%,60% 38%,70% 46%,80% 34%,100% 40%,100% 74%,80% 70%,70% 78%,60% 74%,50% 82%,40% 80%,30% 90%,20% 82%,10% 86%,0 100%)", opacity: 0.75, animation: "waveFlow 5s ease-in-out infinite alternate", animationDelay: "-1.2s" }} />
          <div style={{ position: "absolute", left: "12%", right: "12%", height: 3, background: "linear-gradient(90deg, transparent, #4ecdc4, #45b7aa, #4ecdc4, transparent)", boxShadow: "0 0 16px rgba(78,205,196,0.5)", animation: "scanDown 3.5s ease-in-out infinite", pointerEvents: "none" }} />
          {[
            { left: "22%", top: "50%", bg: T.accent, delay: "0s" },
            { left: "64%", top: "32%", bg: T.accent, delay: "-1s" },
            { left: "76%", top: "48%", bg: T.gold, delay: "-2s" },
          ].map((dot, i) => (
            <div key={i} style={{ position: "absolute", left: dot.left, top: dot.top, width: 8, height: 8, borderRadius: "50%", background: dot.bg, boxShadow: `0 0 18px ${dot.bg}, 0 0 0 6px ${dot.bg}14`, animation: "dotBounce 4s ease-in-out infinite alternate", animationDelay: dot.delay }} />
          ))}
          <div style={{ position: "absolute", left: "14%", right: "14%", bottom: 100, display: "flex", justifyContent: "space-between", color: "#6a8a9a", font: '700 11px "SF Mono","JetBrains Mono",monospace' }}>
            {["2017", "2019", "2021", "2023", "2025"].map((y) => <span key={y}>{y}</span>)}
          </div>
          <div style={{ position: "absolute", bottom: 40, width: "100%", textAlign: "center", fontSize: 18, fontWeight: 900, color: "#d8eef6", letterSpacing: 4, textShadow: "0 0 18px rgba(60,180,220,0.45)" }}>
            近十年资产价值与纳管趋势
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel title="本年度盘点执行率">
            <div><AnimatedNumber value={96.2} decimals={2} /><span style={{ fontSize: 11, color: T.subDim, fontWeight: 700, marginLeft: 4 }}>%</span></div>
            <ProgressBar label="No.1" value={98} />
            <ProgressBar label="No.2" value={90} />
            <ProgressBar label="No.3" value={87} />
          </Panel>

          <Panel title="跨部门流转执行率">
            <div><AnimatedNumber value={89.5} decimals={2} /><span style={{ fontSize: 11, color: T.subDim, fontWeight: 700, marginLeft: 4 }}>%</span></div>
            <ProgressBar label="部门一" value={95} />
            <ProgressBar label="部门二" value={88} />
            <ProgressBar label="部门三" value={82} />
          </Panel>

          <Panel title="项目级资产利用率">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 6 }}>
              {[
                { v: "56.9%", l: "整体资产\n利用率" },
                { v: "67.4%", l: "维保处置\n进度" },
                { v: "79.2%", l: "财资回收\n入账率" },
              ].map((m) => (
                <div key={m.l} style={{ display: "grid", placeItems: "center", textAlign: "center", padding: 6, border: `1px solid rgba(60,180,220,0.1)`, background: "rgba(60,180,220,0.03)", borderRadius: 4 }}>
                  <div style={{ color: T.text, font: '900 18px "SF Mono","JetBrains Mono",monospace', textShadow: "0 0 10px rgba(60,180,220,0.3)", letterSpacing: 1 }}>{m.v}</div>
                  <div style={{ color: "#6a8a9a", fontSize: 10, fontWeight: 700, lineHeight: 1.4, whiteSpace: "pre-line" }}>{m.l}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Bottom Row */}
        <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Panel title="入库 / 领用趋势"><BarChart heights={BAR_HEIGHTS_LEFT} /></Panel>
          <Panel title="资产状态分布">
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
              <div style={{ width: 100, height: 100, borderRadius: "50%", background: "radial-gradient(circle, #0f1923 0 42%, transparent 43%), conic-gradient(#4ecdc4 0 40%, #45b7aa 40% 65%, #e8a838 65% 82%, rgba(60,180,220,0.15) 82%)", boxShadow: "0 0 18px rgba(78,205,196,0.15)", animation: "donutSpin 16s linear infinite", flexShrink: 0, position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: T.text, font: '900 16px "SF Mono","JetBrains Mono",monospace', textShadow: "0 0 10px rgba(60,180,220,0.4)", animation: "donutCounter 16s linear infinite" }}>8426</div>
              </div>
              <div>
                {[{ c: T.accent, l: "业务活动 20%" }, { c: T.accent2, l: "单位管控 45%" }, { c: T.gold, l: "资产处置 24%" }, { c: "rgba(60,180,220,0.3)", l: "其他费用 11%" }].map((item) => (
                  <div key={item.l} style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0", fontSize: 11, color: T.sub, fontWeight: 700 }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: item.c }} />{item.l}
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="支出 / 维保分布"><BarChart heights={BAR_HEIGHTS_RIGHT} /></Panel>
        </div>
      </div>

      {/* Bottom Info Bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,14,20,0.8)", borderTop: "1px solid rgba(60,180,220,0.08)", font: '600 11px "SF Mono","JetBrains Mono",monospace', color: "#4a6a7a", gap: 24, zIndex: 10 }}>
        <span>本年预算执行 32,457.78 万元</span>
        <span>同比 +6.03%</span>
        <span>纳管资产 8,426 台/套</span>
        <span>RFID 同步率 98%</span>
      </div>
    </div>
  );
}
