/**
 * @file SmartReportPage.tsx
 * @description RFID 盘点智能报告页面
 *
 * 由 Stitch 设计稿转换（Project: 2014907722451863252, Screen: fc51ef74f0854b369d3b6a74b2ba8dfd）
 * 设计稿预览：frontend/src/pages/inventory/smart-report/stitch-design.html
 *
 * 路由：/inventory/smart-report/:taskId
 */

import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Download,
  Package,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

// ─── 模拟数据（后续替换为 API 调用）────────────────────────────────────────────

const MOCK_KPI = {
  totalAssets: 1248,
  scannedCount: 1208,
  completionRate: 96.8,
  completionTrend: '+3.2%',
  discrepancyCount: 40,
  deficitCount: 28,
  surplusCount: 12,
  accuracy: 96.8,
  accuracyTrend: '+12.5%',
};

const MOCK_TREND_DATA = [
  { month: '12月', accuracy: 82, completion: 88 },
  { month: '1月',  accuracy: 86, completion: 90 },
  { month: '2月',  accuracy: 88, completion: 91 },
  { month: '3月',  accuracy: 91, completion: 93 },
  { month: '4月',  accuracy: 94, completion: 95 },
  { month: '5月',  accuracy: 96.8, completion: 97 },
];

const MOCK_DEPT_STATS = [
  { name: '行政部', rate: 99, color: '#2563eb' },
  { name: '研发部', rate: 98, color: '#2563eb' },
  { name: '销售部', rate: 95, color: '#f59e0b' },
  { name: '财务部', rate: 94, color: '#f59e0b' },
  { name: '运营部', rate: 91, color: '#ef4444' },
];

const MOCK_DISCREPANCY_ITEMS = [
  { id: 'AST-2039', name: 'Dell XPS 15',       category: 'IT设备', dept: '运营部', type: '盘亏' as const },
  { id: 'AST-4412', name: '人体工学椅',          category: '办公家具', dept: '销售部', type: '盘亏' as const },
  { id: 'AST-8821', name: 'ThinkPad T14',       category: 'IT设备', dept: '研发部', type: '盘盈' as const },
  { id: 'AST-3301', name: '投影仪 Epson EB-X',  category: '会议设备', dept: '行政部', type: '位置异常' as const },
  { id: 'AST-5567', name: '工业扫描仪',           category: '专用设备', dept: '运营部', type: '盘亏' as const },
];

type DiscrepancyType = '盘亏' | '盘盈' | '位置异常';

const DISCREPANCY_BADGE: Record<DiscrepancyType, { bg: string; text: string }> = {
  '盘亏':   { bg: 'bg-red-50',    text: 'text-red-600' },
  '盘盈':   { bg: 'bg-green-50',  text: 'text-green-700' },
  '位置异常': { bg: 'bg-orange-50', text: 'text-orange-600' },
};

// ─── 子组件 ─────────────────────────────────────────────────────────────────

/** KPI 统计卡片 */
function KpiCard({
  label,
  value,
  sub,
  trend,
  trendColor,
  icon: Icon,
  accentColor,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendColor?: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden flex flex-col">
      {/* 顶部色条 */}
      <div className="h-1" style={{ backgroundColor: accentColor }} />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#64748b]">{label}</span>
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: accentColor + '18' }}
          >
            <Icon className="w-4 h-4" style={{ color: accentColor } as React.CSSProperties} />
          </span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-[#0f172a]">{value}</span>
          {trend && (
            <span
              className="mb-0.5 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: (trendColor ?? '#10b981') + '18',
                color: trendColor ?? '#10b981',
              }}
            >
              ↑ {trend}
            </span>
          )}
        </div>
        {sub && <p className="text-xs text-[#94a3b8]">{sub}</p>}
      </div>
    </div>
  );
}

/** 近6次趋势折线面积图（纯 SVG） */
function TrendChart() {
  const W = 400;
  const H = 160;
  const PAD = { top: 16, right: 12, bottom: 24, left: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const minVal = 78;
  const maxVal = 100;

  const toX = (i: number) => PAD.left + (i / (MOCK_TREND_DATA.length - 1)) * chartW;
  const toY = (v: number) => PAD.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

  const accPts = MOCK_TREND_DATA.map((d, i) => ({ x: toX(i), y: toY(d.accuracy) }));
  const comPts = MOCK_TREND_DATA.map((d, i) => ({ x: toX(i), y: toY(d.completion) }));

  const polyline = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x},${p.y}`).join(' ');

  const areaPath = (pts: { x: number; y: number }[]) => {
    const bottom = PAD.top + chartH;
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    return `${line} L${pts[pts.length - 1].x},${bottom} L${pts[0].x},${bottom} Z`;
  };

  return (
    <div className="flex-1 relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gradAcc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradCom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 面积填充 */}
        <path d={areaPath(accPts)} fill="url(#gradAcc)" />
        <path d={areaPath(comPts)} fill="url(#gradCom)" />
        {/* 折线 */}
        <polyline points={polyline(accPts)} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
        <polyline points={polyline(comPts)} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" strokeDasharray="5,3" />
        {/* 数据点 */}
        {accPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#3b82f6" strokeWidth="2" />
        ))}
        {/* X 轴标签 */}
        {MOCK_TREND_DATA.map((d, i) => (
          <text
            key={i}
            x={toX(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize="9"
            fill="#94a3b8"
            fontFamily="Inter, sans-serif"
          >
            {d.month}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** 差异分布圆环图（CSS border trick） */
function DonutChart() {
  // 近似三段：正常96.8% ≈ 348° / 盘亏2.2% ≈ 8° / 盘盈1.0% ≈ 4°
  const segments = [
    { label: '正常', value: '1,208', pct: '96.8%', color: '#10b981', deg: 348 },
    { label: '盘亏', value: '28',    pct: '2.2%',  color: '#ef4444', deg: 8 },
    { label: '盘盈', value: '12',    pct: '1.0%',  color: '#f59e0b', deg: 4 },
  ];

  // conic-gradient
  const conic = `conic-gradient(
    ${segments[0].color} 0deg ${segments[0].deg}deg,
    ${segments[1].color} ${segments[0].deg}deg ${segments[0].deg + segments[1].deg}deg,
    ${segments[2].color} ${segments[0].deg + segments[1].deg}deg 360deg
  )`;

  return (
    <div className="flex flex-col items-center gap-4 flex-1 justify-center">
      <div className="relative w-36 h-36">
        <div
          className="w-full h-full rounded-full"
          style={{ background: conic }}
        />
        {/* 中心挖空 */}
        <div className="absolute inset-0 m-5 rounded-full bg-white flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#0f172a]">40</span>
          <span className="text-xs text-[#94a3b8]">差异</span>
        </div>
      </div>
      {/* 图例 */}
      <div className="space-y-2 w-full px-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[#64748b]">{s.label}</span>
            </div>
            <div className="flex gap-2 text-[#0f172a] font-mono">
              <span>{s.value}</span>
              <span className="text-[#94a3b8]">{s.pct}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 主页面 ─────────────────────────────────────────────────────────────────

export default function SmartReportPage() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId?: string }>();

  // TODO: 替换为真实 API
  // const { data } = useQuery(['smart-report', taskId], () => fetchSmartReport(taskId));

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* ── 顶部面包屑 Header ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 h-14 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] transition-colors"
          aria-label="返回"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <nav className="flex items-center gap-1.5 text-sm text-[#94a3b8]">
          <span
            className="hover:text-[#2563eb] cursor-pointer transition-colors"
            onClick={() => navigate('/inventory')}
          >
            RFID 盘点
          </span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-[#0f172a] font-medium">智能报告</span>
        </nav>
      </div>

      {/* ── 主内容区 ────────────────────────────────────────────────────────── */}
      <div className="p-6 space-y-6 max-w-[1280px] mx-auto">

        {/* 页面标题行 */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-2xl font-bold text-[#0f172a]">智能盘点报告</h1>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                2026年05月 Q2
              </span>
            </div>
            <p className="text-sm text-[#64748b]">
              任务：2026年5月全面盘点 · <span className="text-[#10b981] font-medium">✓ 已完成</span> · 2026-05-18
              {taskId && <span className="ml-2 text-[#94a3b8] font-mono text-xs">#{taskId}</span>}
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shrink-0">
            <Download className="w-4 h-4" />
            导出报告
          </button>
        </div>

        {/* ── KPI 卡片行 ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="总资产数"
            value="1,248"
            sub="本次盘点范围"
            icon={Package}
            accentColor="#3b82f6"
          />
          <KpiCard
            label="盘点完成率"
            value="96.8%"
            sub="已盘 1,208 / 总 1,248"
            trend="3.2%"
            trendColor="#10b981"
            icon={CheckCircle2}
            accentColor="#10b981"
          />
          <KpiCard
            label="账实差异数"
            value="40"
            sub={`盘亏 ${MOCK_KPI.deficitCount} · 盘盈 ${MOCK_KPI.surplusCount}`}
            icon={AlertTriangle}
            accentColor="#ef4444"
          />
          <KpiCard
            label="盘点准确率"
            value="96.8%"
            sub="较上次 +12.5%"
            trend="12.5%"
            trendColor="#10b981"
            icon={TrendingUp}
            accentColor="#2563eb"
          />
        </div>

        {/* ── 图表行（7:5）──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 趋势折线图 */}
          <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-xl p-5 flex flex-col" style={{ minHeight: 280 }}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
              <h3 className="text-base font-semibold text-[#0f172a]">近6次盘点准确率趋势</h3>
              <div className="flex items-center gap-4 text-xs text-[#64748b]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#3b82f6] rounded-full inline-block" />
                  准确率
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#10b981] rounded-full inline-block" style={{ backgroundImage: 'repeating-linear-gradient(to right, #10b981 0, #10b981 4px, transparent 4px, transparent 7px)' }} />
                  完成率
                </span>
              </div>
            </div>
            <TrendChart />
          </div>

          {/* 差异分布圆环图 */}
          <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-xl p-5 flex flex-col" style={{ minHeight: 280 }}>
            <h3 className="text-base font-semibold text-[#0f172a] mb-4 pb-3 border-b border-[#f1f5f9]">差异分布</h3>
            <DonutChart />
          </div>
        </div>

        {/* ── 详情行（5:7）──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 部门完成率 */}
          <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-xl p-5">
            <h3 className="text-base font-semibold text-[#0f172a] mb-4 pb-3 border-b border-[#f1f5f9]">部门完成率</h3>
            <div className="space-y-4">
              {MOCK_DEPT_STATS.map((dept) => (
                <div key={dept.name}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm text-[#374151] font-medium">{dept.name}</span>
                    <span className="text-sm font-bold" style={{ color: dept.color }}>{dept.rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${dept.rate}%`, backgroundColor: dept.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 差异资产明细表格 */}
          <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-xl p-5 overflow-x-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
              <h3 className="text-base font-semibold text-[#0f172a]">
                差异资产明细
                <span className="text-sm font-normal text-[#94a3b8] ml-1.5">（前5条）</span>
              </h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  {['资产编号', '资产名称', '分类', '所属部门', '差异类型'].map((h) => (
                    <th key={h} className="px-3 py-2 text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_DISCREPANCY_ITEMS.map((item, idx) => {
                  const badge = DISCREPANCY_BADGE[item.type];
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors ${idx === MOCK_DISCREPANCY_ITEMS.length - 1 ? 'border-none' : ''}`}
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs bg-[#f1f5f9] text-[#2563eb] px-1.5 py-0.5 rounded">
                          {item.id}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-[#374151] font-medium">{item.name}</td>
                      <td className="px-3 py-2.5 text-sm text-[#64748b]">{item.category}</td>
                      <td className="px-3 py-2.5 text-sm text-[#64748b]">{item.dept}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                          {item.type}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-[#f1f5f9]">
              <button className="text-sm text-[#2563eb] hover:text-blue-700 font-medium flex items-center gap-1 transition-colors">
                查看全部 40 条差异
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── AI 智能分析卡片 ────────────────────────────────────────────────── */}
        <div
          className="rounded-xl p-6 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)' }}
        >
          {/* 装饰光晕 */}
          <div
            className="absolute -right-12 -top-12 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)' }}
          />
          <div
            className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />

          {/* 左侧内容 */}
          <div className="relative z-10 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/80 px-3 py-1 rounded-full text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                AI 智能分析
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mb-4">
              本次盘点整体表现优良，3个维度需要关注
            </h2>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5 text-sm text-white/90">
                <span className="mt-0.5 text-base">✅</span>
                <span>准确率同比提升 <strong>12.5%</strong>，研发部表现最佳，连续三个月完成率超 98%</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-yellow-200">
                <span className="mt-0.5 text-base">⚠️</span>
                <span>运营部仓库区域出现 <strong>6 次</strong>位置异常，建议实地核查并更新资产位置台账</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-white/80">
                <span className="mt-0.5 text-base">📅</span>
                <span>下次建议盘点时间：<strong>2026-06-15</strong>，共 2 个高风险资产需优先关注</span>
              </li>
            </ul>
          </div>

          {/* 右侧评分 + 按钮 */}
          <div className="relative z-10 flex flex-col items-center bg-white/10 border border-white/20 backdrop-blur-sm rounded-xl px-8 py-5 shrink-0 gap-3">
            <div className="text-6xl font-black text-white/20 leading-none select-none">A+</div>
            <div className="text-white/60 text-xs font-medium -mt-1">综合评分</div>
            <button className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white text-sm font-semibold rounded-lg transition-colors">
              生成整改建议
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
