/**
 * @file SmartReportPage.tsx
 * @description RFID 盘点智能报告页面
 *
 * 由 Stitch 设计稿转换（Project: 2014907722451863252, Screen: fc51ef74f0854b369d3b6a74b2ba8dfd）
 * 设计稿预览：frontend/src/pages/inventory/smart-report/stitch-design.html
 *
 * 路由：/inventory/smart-report/:taskId
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  Package,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  getInventoryTaskDetail,
  getTaskSummary,
  getTaskAssets,
} from '@/api/inventory';
import type {
  InventoryTask,
  InventorySummary,
  InventoryAsset,
} from '@/types/inventory';

// ─── 类型与常量 ──────────────────────────────────────────────────────────────

type DiscrepancyType = '盘亏' | '盘盈' | '位置异常';

const DISCREPANCY_BADGE: Record<DiscrepancyType, { bg: string; text: string }> = {
  '盘亏':   { bg: 'bg-red-50',    text: 'text-red-600' },
  '盘盈':   { bg: 'bg-green-50',  text: 'text-green-700' },
  '位置异常': { bg: 'bg-orange-50', text: 'text-orange-600' },
};

/** 将 ActualStatus 映射为展示用的差异类型 */
function toDiscrepancyType(status: string): DiscrepancyType | null {
  switch (status) {
    case 'deficit': return '盘亏';
    case 'surplus': return '盘盈';
    case 'damaged':
    case 'other': return '位置异常';
    default: return null;
  }
}

/** 数字千分位格式化 */
function fmtNum(n: number): string {
  return n.toLocaleString('zh-CN');
}

/** 百分比格式化，保留一位小数 */
function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

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

/** 全屏居中 loading */
function FullscreenLoader() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-[#2563eb] animate-spin" />
        <span className="text-sm text-[#64748b]">正在加载智能报告…</span>
      </div>
    </div>
  );
}

/** 全屏错误态 */
function FullscreenError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 max-w-md text-center">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-[#64748b]">{message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-[#2563eb] text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          重试
        </button>
      </div>
    </div>
  );
}

/** 缺少 taskId 时的空态 */
function MissingTaskId() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-[#94a3b8]" />
        <p className="text-sm text-[#64748b]">未指定盘点任务 ID</p>
        <button
          onClick={() => navigate('/inventory')}
          className="px-4 py-2 bg-[#2563eb] text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          返回盘点列表
        </button>
      </div>
    </div>
  );
}

// ─── 主页面 ─────────────────────────────────────────────────────────────────

export default function SmartReportPage() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId?: string }>();

  // ── API 调用 ────────────────────────────────────────────────────────────────

  const {
    data: taskResponse,
    isLoading: taskLoading,
    isError: taskError,
    refetch: refetchTask,
  } = useQuery({
    queryKey: ['inventory', 'tasks', taskId],
    queryFn: () => getInventoryTaskDetail(taskId!),
    enabled: !!taskId,
  });

  const {
    data: summaryResponse,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['inventory', 'tasks', taskId, 'summary'],
    queryFn: () => getTaskSummary(taskId!),
    enabled: !!taskId,
  });

  const {
    data: assetsResponse,
  } = useQuery({
    queryKey: ['inventory', 'tasks', taskId, 'assets'],
    queryFn: () => getTaskAssets(taskId!, { page: 1, pageSize: 100 }),
    enabled: !!taskId,
  });

  const task: InventoryTask | undefined = taskResponse?.data;
  const summary: InventorySummary | undefined = summaryResponse?.data;
  const assets: InventoryAsset[] = assetsResponse?.data?.records ?? [];

  // ── 衍生数据 ────────────────────────────────────────────────────────────────

  const discrepancyItems = useMemo(() => {
    const items: {
      id: string;
      name: string;
      category: string;
      dept: string;
      type: DiscrepancyType;
    }[] = [];

    // 从 summary 的盘亏/盘盈明细构建
    if (summary) {
      summary.deficitItems.forEach((d) => {
        items.push({
          id: d.assetCode,
          name: d.assetName,
          category: '',
          dept: d.reason ?? '',
          type: '盘亏',
        });
      });
      summary.surplusItems.forEach((d) => {
        items.push({
          id: d.assetCode,
          name: d.assetName,
          category: '',
          dept: d.reason ?? '',
          type: '盘盈',
        });
      });
    }

    // 如果 summary 无明细但 assets 有异常状态，从 assets 补充
    if (items.length === 0) {
      assets.forEach((a) => {
        if (a.actualStatus && a.actualStatus !== 'normal') {
          const discType = toDiscrepancyType(a.actualStatus);
          if (discType) {
            items.push({
              id: a.assetCode,
              name: a.assetName,
              category: a.categoryName ?? '',
              dept: a.locationPath ?? '',
              type: discType,
            });
          }
        }
      });
    }

    return items.slice(0, 5);
  }, [summary, assets]);

  const totalDiscrepancyCount = useMemo(() => {
    if (summary) {
      return summary.surplusCount + summary.deficitCount;
    }
    if (task) {
      return task.surplusAssets + task.deficitAssets;
    }
    return 0;
  }, [summary, task]);

  const kpiValues = useMemo(() => {
    if (!task) return null;
    const total = task.totalAssets;
    const counted = task.countedAssets;
    const completionRate = total > 0 ? (counted / total) * 100 : 0;
    const accuracyRate = total > 0 ? ((total - totalDiscrepancyCount) / total) * 100 : 0;
    return { total, counted, completionRate, accuracyRate };
  }, [task, totalDiscrepancyCount]);

  // ── Loading / Error 态 ──────────────────────────────────────────────────────

  if (!taskId) return <MissingTaskId />;

  if (taskLoading || summaryLoading) return <FullscreenLoader />;

  if (taskError || summaryError || !task) {
    return (
      <FullscreenError
        message="加载报告数据失败，请稍后重试"
        onRetry={() => {
          refetchTask();
          refetchSummary();
        }}
      />
    );
  }

  // ── 页面标题行数据 ──────────────────────────────────────────────────────────

  const statusLabel =
    task.status === 'completed' || task.status === 'submitted'
      ? '✓ 已完成'
      : task.status === 'in_progress'
        ? '进行中'
        : '草稿';

  const statusColor =
    task.status === 'completed' || task.status === 'submitted'
      ? 'text-[#10b981]'
      : task.status === 'in_progress'
        ? 'text-[#f59e0b]'
        : 'text-[#64748b]';

  // ── Render ──────────────────────────────────────────────────────────────────

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
                {task.taskName}
              </span>
            </div>
            <p className="text-sm text-[#64748b]">
              任务：{task.taskName} ·{' '}
              <span className={`${statusColor} font-medium`}>{statusLabel}</span>
              {' '}· {new Date(task.createdAt).toLocaleDateString('zh-CN')}
              <span className="ml-2 text-[#94a3b8] font-mono text-xs">#{taskId}</span>
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shrink-0">
            <Download className="w-4 h-4" />
            导出报告
          </button>
        </div>

        {/* ── KPI 卡片行 ─────────────────────────────────────────────────── */}
        {kpiValues && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="总资产数"
              value={fmtNum(kpiValues.total)}
              sub="本次盘点范围"
              icon={Package}
              accentColor="#3b82f6"
            />
            <KpiCard
              label="盘点完成率"
              value={fmtPct(kpiValues.completionRate)}
              sub={`已盘 ${fmtNum(kpiValues.counted)} / 总 ${fmtNum(kpiValues.total)}`}
              icon={CheckCircle2}
              accentColor="#10b981"
            />
            <KpiCard
              label="账实差异数"
              value={fmtNum(totalDiscrepancyCount)}
              sub={`盘亏 ${task.deficitAssets} · 盘盈 ${task.surplusAssets}`}
              icon={AlertTriangle}
              accentColor="#ef4444"
            />
            <KpiCard
              label="盘点准确率"
              value={fmtPct(kpiValues.accuracyRate)}
              sub={`差异数 ${totalDiscrepancyCount}`}
              icon={TrendingUp}
              accentColor="#2563eb"
            />
          </div>
        )}

        {/* ── 图表行（7:5）──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 趋势折线图 — 展示当前任务进度 */}
          <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-xl p-5 flex flex-col" style={{ minHeight: 280 }}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
              <h3 className="text-base font-semibold text-[#0f172a]">盘点进度概览</h3>
              <div className="flex items-center gap-4 text-xs text-[#64748b]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#3b82f6] rounded-full inline-block" />
                  已盘数量
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#10b981] rounded-full inline-block" style={{ backgroundImage: 'repeating-linear-gradient(to right, #10b981 0, #10b981 4px, transparent 4px, transparent 7px)' }} />
                  差异数量
                </span>
              </div>
            </div>
            <ProgressChart task={task} />
          </div>

          {/* 差异分布圆环图 */}
          <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-xl p-5 flex flex-col" style={{ minHeight: 280 }}>
            <h3 className="text-base font-semibold text-[#0f172a] mb-4 pb-3 border-b border-[#f1f5f9]">差异分布</h3>
            <DonutChart
              normalCount={task.countedAssets - totalDiscrepancyCount}
              deficitCount={task.deficitAssets}
              surplusCount={task.surplusAssets}
              totalCount={task.countedAssets}
              totalDiscrepancy={totalDiscrepancyCount}
            />
          </div>
        </div>

        {/* ── 详情行（5:7）──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 资产状态概览 */}
          <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-xl p-5">
            <h3 className="text-base font-semibold text-[#0f172a] mb-4 pb-3 border-b border-[#f1f5f9]">资产状态概览</h3>
            <AssetStatusBars task={task} />
          </div>

          {/* 差异资产明细表格 */}
          <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-xl p-5 overflow-x-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
              <h3 className="text-base font-semibold text-[#0f172a]">
                差异资产明细
                <span className="text-sm font-normal text-[#94a3b8] ml-1.5">
                  （前{discrepancyItems.length}条）
                </span>
              </h3>
            </div>
            {discrepancyItems.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-sm text-[#94a3b8]">
                暂无差异资产
              </div>
            ) : (
              <>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc]">
                      {['资产编号', '资产名称', '分类', '位置/部门', '差异类型'].map((h) => (
                        <th key={h} className="px-3 py-2 text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {discrepancyItems.map((item, idx) => {
                      const badge = DISCREPANCY_BADGE[item.type];
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors ${idx === discrepancyItems.length - 1 ? 'border-none' : ''}`}
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
                    查看全部 {totalDiscrepancyCount} 条差异
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
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
              {totalDiscrepancyCount === 0
                ? '本次盘点账实完全一致，无差异'
                : `本次盘点发现 ${totalDiscrepancyCount} 处差异，需要关注`}
            </h2>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5 text-sm text-white/90">
                <span className="mt-0.5 text-base">✅</span>
                <span>
                  盘点范围 <strong>{fmtNum(task.totalAssets)}</strong> 项资产，
                  已确认 <strong>{fmtNum(task.countedAssets)}</strong> 项，
                  完成率 <strong>{fmtPct(task.progress)}</strong>
                </span>
              </li>
              {totalDiscrepancyCount > 0 && (
                <li className="flex items-start gap-2.5 text-sm text-yellow-200">
                  <span className="mt-0.5 text-base">⚠️</span>
                  <span>
                    共发现差异 <strong>{totalDiscrepancyCount}</strong> 处：
                    盘亏 <strong>{task.deficitAssets}</strong> 项，盘盈 <strong>{task.surplusAssets}</strong> 项
                  </span>
                </li>
              )}
              <li className="flex items-start gap-2.5 text-sm text-white/80">
                <span className="mt-0.5 text-base">📅</span>
                <span>
                  盘点任务创建于 <strong>{new Date(task.createdAt).toLocaleDateString('zh-CN')}</strong>
                  {task.updatedAt && (
                    <>，最后更新 <strong>{new Date(task.updatedAt).toLocaleDateString('zh-CN')}</strong></>
                  )}
                </span>
              </li>
            </ul>
          </div>

          {/* 右侧评分 + 按钮 */}
          <div className="relative z-10 flex flex-col items-center bg-white/10 border border-white/20 backdrop-blur-sm rounded-xl px-8 py-5 shrink-0 gap-3">
            <div className="text-6xl font-black text-white/20 leading-none select-none">
              {kpiValues
                ? kpiValues.accuracyRate >= 98
                  ? 'A+'
                  : kpiValues.accuracyRate >= 95
                    ? 'A'
                    : kpiValues.accuracyRate >= 90
                      ? 'B+'
                      : 'B'
                : '-'}
            </div>
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

// ─── 内部子组件（接收 API 数据作为 props）─────────────────────────────────────

/** 进度概览柱状条形图（纯 SVG），展示已盘/未盘/差异 */
function ProgressChart({ task }: { task: InventoryTask }) {
  const W = 400;
  const H = 160;
  const PAD = { top: 16, right: 12, bottom: 24, left: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const total = task.totalAssets || 1;
  const counted = task.countedAssets;
  const uncounted = task.uncountedAssets;
  const discrepancy = task.surplusAssets + task.deficitAssets;

  // Bar positions for 3 metrics
  const barWidth = 40;
  const gap = (chartW - 3 * barWidth) / 4;

  const metrics = [
    { label: '已盘', value: counted, pct: (counted / total) * 100, color: '#3b82f6' },
    { label: '未盘', value: uncounted, pct: (uncounted / total) * 100, color: '#94a3b8' },
    { label: '差异', value: discrepancy, pct: (discrepancy / total) * 100, color: '#f59e0b' },
  ];

  const maxPct = Math.max(...metrics.map((m) => m.pct), 1);

  return (
    <div className="flex-1 relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {metrics.map((m, i) => {
          const x = PAD.left + gap + i * (barWidth + gap);
          const barH = (m.pct / maxPct) * chartH;
          const y = PAD.top + chartH - barH;
          return (
            <g key={m.label}>
              <rect x={x} y={y} width={barWidth} height={barH} fill={m.color} rx={4} opacity={0.85} />
              <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#0f172a" fontFamily="Inter, sans-serif">
                {fmtNum(m.value)}
              </text>
              <text x={x + barWidth / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="Inter, sans-serif">
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** 差异分布圆环图（CSS conic-gradient） */
function DonutChart({
  normalCount,
  deficitCount,
  surplusCount,
  totalCount,
  totalDiscrepancy,
}: {
  normalCount: number;
  deficitCount: number;
  surplusCount: number;
  totalCount: number;
  totalDiscrepancy: number;
}) {
  const safeTotal = totalCount || 1;
  const normalPct = (normalCount / safeTotal) * 100;
  const deficitPct = (deficitCount / safeTotal) * 100;
  const surplusPct = (surplusCount / safeTotal) * 100;

  const normalDeg = (normalCount / safeTotal) * 360;
  const deficitDeg = (deficitCount / safeTotal) * 360;
  const surplusDeg = (surplusCount / safeTotal) * 360;

  const segments = [
    { label: '正常', value: fmtNum(normalCount), pct: fmtPct(normalPct), color: '#10b981', deg: normalDeg },
    { label: '盘亏', value: fmtNum(deficitCount), pct: fmtPct(deficitPct), color: '#ef4444', deg: deficitDeg },
    { label: '盘盈', value: fmtNum(surplusCount), pct: fmtPct(surplusPct), color: '#f59e0b', deg: surplusDeg },
  ];

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
        <div className="absolute inset-0 m-5 rounded-full bg-white flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#0f172a]">{totalDiscrepancy}</span>
          <span className="text-xs text-[#94a3b8]">差异</span>
        </div>
      </div>
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

/** 资产状态概览（水平进度条） */
function AssetStatusBars({ task }: { task: InventoryTask }) {
  const total = task.totalAssets || 1;
  const bars = [
    { label: '已确认', count: task.countedAssets, color: '#10b981' },
    { label: '未盘点', count: task.uncountedAssets, color: '#94a3b8' },
    { label: '盘盈', count: task.surplusAssets, color: '#f59e0b' },
    { label: '盘亏', count: task.deficitAssets, color: '#ef4444' },
  ];

  return (
    <div className="space-y-4">
      {bars.map((bar) => {
        const rate = (bar.count / total) * 100;
        return (
          <div key={bar.label}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm text-[#374151] font-medium">{bar.label}</span>
              <span className="text-sm font-bold" style={{ color: bar.color }}>
                {fmtNum(bar.count)} ({fmtPct(rate)})
              </span>
            </div>
            <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${rate}%`, backgroundColor: bar.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
