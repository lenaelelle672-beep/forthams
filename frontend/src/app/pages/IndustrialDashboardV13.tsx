import { useMemo, useState, type CSSProperties } from "react";
import { RefreshCw } from "lucide-react";
import { useDashboardData, type CategoryItem } from "../hooks/useDashboardData";
import "./IndustrialDashboardV13.css";

const INDUSTRIAL_VIDEO_URL = "/industrial-v13-reference.mp4";

const FALLBACK_CATEGORIES: CategoryItem[] = [
  { name: "通用设备", value: 45 },
  { name: "生产设备", value: 30 },
  { name: "办公设备", value: 15 },
  { name: "运输设备", value: 10 },
];

const CATEGORY_COLORS = ["#16f6ff", "#3f6dff", "#ff9d42", "#72f6a8", "#9b7cff", "#ffd166"];

function toNumber(value: number | string | undefined | null, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safeRatio(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function formatNumber(value: number | string | undefined | null) {
  const numeric = toNumber(value, Number.NaN);
  if (!Number.isFinite(numeric)) return "--";
  return new Intl.NumberFormat("zh-CN").format(numeric);
}

function formatCurrencyCompact(value: number | string | undefined | null) {
  const numeric = toNumber(value, Number.NaN);
  if (!Number.isFinite(numeric)) return "--";
  if (Math.abs(numeric) >= 10000) {
    return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(numeric / 10000)}万`;
  }
  return formatNumber(numeric);
}

function buildConicGradient(items: CategoryItem[]) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return "conic-gradient(#16f6ff 0 100%)";

  let cursor = 0;
  const stops = items.map((item, index) => {
    const start = cursor;
    const end = cursor + (item.value / total) * 100;
    cursor = end;
    const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
    return `${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

function HudNumber({ value, unit }: { value: string | number; unit?: string }) {
  return (
    <strong className="industrial-v13-hud-number">
      {value}
      {unit ? <small>{unit}</small> : null}
    </strong>
  );
}

export function IndustrialDashboardV13() {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const { stats, categoryData, expirationAlerts, loading, error, refresh } = useDashboardData();

  const viewModel = useMemo(() => {
    const totalAssets = toNumber(stats?.totalAssets);
    const inUseAssets = toNumber(stats?.inUseAssets);
    const idleAssets = toNumber(stats?.idleAssets);
    const maintenanceAssets = toNumber(stats?.maintenanceAssets);
    const scrapAssets = toNumber(stats?.scrapAssets);
    const pendingApprovals = toNumber(stats?.pendingApprovals);
    const totalValue = toNumber(stats?.totalValue);
    const netValue = toNumber(stats?.netValue);
    const effectiveTotal = totalAssets > 0 ? totalAssets : inUseAssets + idleAssets + maintenanceAssets + scrapAssets;
    const categories = categoryData.length > 0 ? categoryData.slice(0, 6) : FALLBACK_CATEGORIES;

    return {
      totalAssets,
      inUseAssets,
      idleAssets,
      maintenanceAssets,
      scrapAssets,
      pendingApprovals,
      totalValue,
      netValue,
      utilizationRate: safeRatio(inUseAssets, effectiveTotal),
      idleRate: safeRatio(idleAssets, effectiveTotal),
      maintenanceRate: safeRatio(maintenanceAssets, effectiveTotal),
      scrapRate: safeRatio(scrapAssets, effectiveTotal),
      categories,
      conicGradient: buildConicGradient(categories),
    };
  }, [categoryData, stats]);

  const topStats = [
    { label: "资产总数", value: formatNumber(viewModel.totalAssets), unit: "台" },
    { label: "在用设备", value: formatNumber(viewModel.inUseAssets), unit: "台" },
    { label: "待审批", value: formatNumber(viewModel.pendingApprovals), unit: "单" },
  ];

  const statusRows = [
    { name: "在用资产", value: viewModel.inUseAssets, rate: viewModel.utilizationRate, tone: "#72f6a8" },
    { name: "闲置资产", value: viewModel.idleAssets, rate: viewModel.idleRate, tone: "#16f6ff" },
    { name: "维保资产", value: viewModel.maintenanceAssets, rate: viewModel.maintenanceRate, tone: "#ff9d42" },
    { name: "报废资产", value: viewModel.scrapAssets, rate: viewModel.scrapRate, tone: "#ff6b6b" },
  ];

  const rightMetrics = [
    { label: "资产总价值", value: `¥${formatCurrencyCompact(viewModel.totalValue)}`, unit: "" },
    { label: "资产净值", value: `¥${formatCurrencyCompact(viewModel.netValue)}`, unit: "" },
    { label: "资产利用率", value: viewModel.utilizationRate, unit: "%" },
    { label: "待处理审批", value: formatNumber(viewModel.pendingApprovals), unit: "单" },
    { label: "维保预警", value: formatNumber(viewModel.maintenanceAssets), unit: "台" },
    { label: "到期提醒", value: formatNumber(expirationAlerts.length), unit: "条" },
  ];

  return (
    <div className="industrial-v13-screen" aria-label="工业可视化大屏动画">
      {!videoLoaded && !videoFailed ? (
        <div className="industrial-v13-loading" role="status">
          <span />
          <p>正在加载工业可视化动画...</p>
        </div>
      ) : null}

      {videoFailed ? (
        <div className="industrial-v13-error">
          <h1>工业可视化动画加载失败</h1>
          <p>本地视频资源暂时无法播放，请检查静态资源构建结果。</p>
        </div>
      ) : (
        <figure className={`industrial-v13-stage ${videoLoaded ? "is-loaded" : ""}`}>
          <video
            aria-label="工业可视化 3D 工厂动效"
            autoPlay
            className="industrial-v13-reference"
            muted
            onEnded={() => setVideoEnded(true)}
            onError={() => setVideoFailed(true)}
            onLoadedData={() => setVideoLoaded(true)}
            playsInline
            preload="auto"
            src={INDUSTRIAL_VIDEO_URL}
          />

          <div className="industrial-v13-live-hud" aria-label="项目资产实时数据面板">
            <header className="industrial-v13-title">
              <span>工业可视化</span>
              <b>Industrial visualization</b>
              <em>{videoEnded ? "动画已定格" : "动画播放中"}</em>
            </header>

            <section className="industrial-v13-left-panel panel-a">
              <h2>资产设备运转数据</h2>
              <div className="industrial-v13-top-stats">
                {topStats.map((item) => (
                  <div key={item.label}>
                    <HudNumber value={item.value} unit={item.unit} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="industrial-v13-sync-row">
                <span className={loading ? "is-loading" : ""} />
                <div>
                  <b>{error ? "数据接口异常" : "仪表板数据同步"}</b>
                  <small>{error ?? "已接入 /api/dashboard/stats"}</small>
                </div>
                <button type="button" onClick={refresh} aria-label="刷新工业大屏数据">
                  <RefreshCw />
                </button>
              </div>
            </section>

            <section className="industrial-v13-left-panel panel-b">
              <h2>设备运行状态</h2>
              <div className="industrial-v13-rings">
                {statusRows.map((row) => (
                  <div key={row.name} style={{ "--tone": row.tone, "--pct": `${row.rate}%` } as CSSProperties}>
                    <i />
                    <b>{row.rate}%</b>
                    <span>{row.name}</span>
                  </div>
                ))}
              </div>
              <table className="industrial-v13-table">
                <tbody>
                  {statusRows.map((row) => (
                    <tr key={row.name} style={{ "--tone": row.tone } as CSSProperties}>
                      <td>{row.name}</td>
                      <td>{formatNumber(row.value)}</td>
                      <td>{row.rate}%</td>
                      <td>●</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="industrial-v13-left-panel panel-c">
              <h2>资产价值概览</h2>
              <div className="industrial-v13-bars">
                {[
                  { label: "总价值", value: viewModel.totalValue, max: Math.max(viewModel.totalValue, 1), text: `¥${formatCurrencyCompact(viewModel.totalValue)}` },
                  { label: "净值", value: viewModel.netValue, max: Math.max(viewModel.totalValue, 1), text: `¥${formatCurrencyCompact(viewModel.netValue)}` },
                  { label: "待审批", value: viewModel.pendingApprovals, max: Math.max(viewModel.totalAssets, 1), text: `${formatNumber(viewModel.pendingApprovals)} 单` },
                ].map((item) => (
                  <div key={item.label}>
                    <p><span>{item.label}</span><b>{item.text}</b></p>
                    <i style={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }} />
                  </div>
                ))}
              </div>
            </section>

            <section className="industrial-v13-left-panel panel-d">
              <h2>资产分类占比</h2>
              <div className="industrial-v13-category">
                <div className="industrial-v13-donut" style={{ background: viewModel.conicGradient }}>
                  <span>{formatNumber(viewModel.categories.reduce((sum, item) => sum + item.value, 0))}</span>
                </div>
                <div className="industrial-v13-category-list">
                  {viewModel.categories.slice(0, 4).map((item, index) => (
                    <span key={item.name}>
                      <i style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                      {item.name} {item.value}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <aside className="industrial-v13-right-panel">
              {rightMetrics.map((item) => (
                <article key={item.label}>
                  <HudNumber value={item.value} unit={item.unit} />
                  <span>{item.label}</span>
                </article>
              ))}
            </aside>
          </div>
        </figure>
      )}
    </div>
  );
}
