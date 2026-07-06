/**
 * @file SmartReportPage.tsx
 * @description RFID 盘点报告页面
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

const DISCREPANCY_BADGE: Record<DiscrepancyType, { bg: string; text: string; dot: string }> = {
  '盘亏':   { bg: 'bg-red-50',    text: 'text-red-600', dot: 'bg-red-500' },
  '盘盈':   { bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-500' },
  '位置异常': { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
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
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accentColor: string;
}) {
  return (
    <div
      className="group relative bg-white/95 border border-[#e2e8f0] rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md"
      style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)' }}
    >
      {/* 顶部状态色条 */}
      <div className="h-1" style={{ backgroundColor: accentColor }} />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#64748b] tracking-wide">{label}</span>
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:shadow-sm"
            style={{ backgroundColor: accentColor + '15' }}
          >
            <Icon className="w-4.5 h-4.5" style={{ color: accentColor } as React.CSSProperties} />
          </span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl sm:text-4xl font-bold text-[#0f172a] tracking-tight leading-none">{value}</span>
          {trend && (
            <span
              className="mb-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: (trendColor ?? '#10b981') + '18',
                color: trendColor ?? '#10b981',
              }}
            >
              ↑ {trend}
            </span>
          )}
        </div>
        {sub && <p className="text-xs text-[#94a3b8] leading-relaxed">{sub}</p>}
      </div>
    </div>
  );
}

/** 全屏居中 loading */
function FullscreenLoader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] to-[#eef2f7] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Loader2 className="w-10 h-10 text-[#2563eb] animate-spin" />
          <div className="absolute inset-0 w-10 h-10 rounded-full bg-[#2563eb]/5 animate-pulse" />
        </div>
        <span className="text-sm font-medium text-[#64748b]">正在加载盘点报告…</span>
      </div>
    </div>
  );
}

/** 全屏错误态 */
function FullscreenError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] to-[#eef2f7] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 max-w-md text-center bg-white rounded-2xl px-8 py-10 shadow-sm border border-[#e2e8f0]">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-sm text-[#64748b]">{message}</p>
        <button
          onClick={onRetry}
          className="px-5 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:shadow-md active:scale-[0.98]"
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
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] to-[#eef2f7] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center bg-white rounded-2xl px-8 py-10 shadow-sm border border-[#e2e8f0]">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-[#94a3b8]" />
        </div>
        <p className="text-sm font-medium text-[#64748b]">未指定盘点任务 ID</p>
        <button
          onClick={() => navigate('/inventory')}
          className="px-5 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:shadow-md active:scale-[0.98]"
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

  const task: InventoryTask | undefined = taskResponse?.task
    ? {
        taskId: String(taskResponse.task.id),
        taskName: taskResponse.task.taskName,
        scopeType: 'all',
        scopeIds: [],
        status: (taskResponse.task.status?.toLowerCase() ?? 'draft') as InventoryTask['status'],
        progress: taskResponse.task.totalCount
          ? Math.round(((taskResponse.task.matchedCount ?? 0) / taskResponse.task.totalCount) * 1000) / 10
          : 0,
        totalAssets: taskResponse.task.totalCount ?? 0,
        countedAssets: taskResponse.task.matchedCount ?? 0,
        uncountedAssets: Math.max((taskResponse.task.totalCount ?? 0) - (taskResponse.task.matchedCount ?? 0), 0),
        surplusAssets: summaryResponse?.surplusCount ?? 0,
        deficitAssets: summaryResponse?.deficitCount ?? 0,
        createdAt: taskResponse.task.createTime ?? new Date().toISOString(),
        updatedAt: taskResponse.task.updateTime ?? taskResponse.task.createTime ?? new Date().toISOString(),
      }
    : undefined;
  const summary: InventorySummary | undefined = summaryResponse;
  const assets: InventoryAsset[] = assetsResponse?.records ?? [];

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
      ? '已完成'
      : task.status === 'in_progress'
        ? '进行中'
        : '草稿';

  const statusConfig = {
    label: statusLabel,
    bg: task.status === 'completed' || task.status === 'submitted'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : task.status === 'in_progress'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200',
    dot: task.status === 'completed' || task.status === 'submitted'
      ? 'bg-emerald-500'
      : task.status === 'in_progress'
        ? 'bg-amber-500'
        : 'bg-slate-400',
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-white to-[#f1f5f9]">
      {/* ── 顶部 Header ───────────────────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-md border-b border-[#e2e8f0] px-4 sm:px-6 h-14 flex items-center gap-3 sticky top-0 z-20">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-xl hover:bg-[#f1f5f9] text-[#64748b] transition-all duration-200 hover:scale-105 active:scale-95"
          aria-label="返回"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <nav className="flex items-center gap-1.5 text-sm text-[#94a3b8]">
          <span
            className="hover:text-[#2563eb] cursor-pointer transition-colors font-medium"
            onClick={() => navigate('/inventory')}
          >
            RFID 盘点
          </span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-[#0f172a] font-semibold">盘点报告</span>
        </nav>
      </div>

      {/* ── 主内容区 ────────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-[1400px] mx-auto">

        {/* 页面标题行 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight">
                盘点报告
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                {statusConfig.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#64748b]">
              <span className="font-medium text-[#334155]">{task.taskName}</span>
              <span className="hidden sm:inline text-[#cbd5e1]">·</span>
              <span>{new Date(task.createdAt).toLocaleDateString('zh-CN')}</span>
              <span className="hidden sm:inline text-[#cbd5e1]">·</span>
              <span className="font-mono text-xs text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded-md">#{taskId}</span>
            </div>
          </div>
          <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:shadow-md active:scale-[0.98] shrink-0">
            <Download className="w-4 h-4" />
            导出报告
          </button>
        </div>

        {/* ── KPI 卡片行 ─────────────────────────────────────────────────── */}
        {kpiValues && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* 趋势折线图 — 展示当前任务进度 */}
          <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 flex flex-col transition-shadow duration-200 hover:shadow-sm" style={{ minHeight: 280 }}>
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
          <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 flex flex-col transition-shadow duration-200 hover:shadow-sm" style={{ minHeight: 280 }}>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* 资产状态概览 */}
          <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 transition-shadow duration-200 hover:shadow-sm">
            <h3 className="text-base font-semibold text-[#0f172a] mb-4 pb-3 border-b border-[#f1f5f9]">资产状态概览</h3>
            <AssetStatusBars task={task} />
          </div>

          {/* 差异资产明细表格 */}
          <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 overflow-x-auto transition-shadow duration-200 hover:shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
              <h3 className="text-base font-semibold text-[#0f172a]">
                差异资产明细
                <span className="text-sm font-normal text-[#94a3b8] ml-1.5">
                  （前{discrepancyItems.length}条）
                </span>
              </h3>
            </div>
            {discrepancyItems.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-[#94a3b8]">
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-[#10b981]/60" />
                  <span>暂无差异资产，盘点结果正常</span>
                </div>
              </div>
            ) : (
              <>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      {['资产编号', '资产名称', '分类', '位置/部门', '差异类型'].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-3 text-xs font-semibold text-[#94a3b8] uppercase tracking-wider border-b-2 border-[#f1f5f9]"
                        >
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
                          className="group border-b border-[#f1f5f9] last:border-none transition-all duration-200 hover:bg-[#f8fafc] hover:shadow-sm"
                        >
                          <td className="px-3 py-3">
                            <span className="font-mono text-xs bg-[#f1f5f9] text-[#2563eb] px-2 py-1 rounded-md font-semibold group-hover:bg-blue-50 transition-colors">
                              {item.id}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-[#374151] font-medium">{item.name}</td>
                          <td className="px-3 py-3 text-sm text-[#64748b]">{item.category || '—'}</td>
                          <td className="px-3 py-3 text-sm text-[#64748b]">{item.dept || '—'}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {item.type}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
                  <button className="inline-flex items-center gap-1.5 text-sm text-[#2563eb] hover:text-blue-700 font-semibold transition-all duration-200 hover:gap-2 group">
                    查看全部 {totalDiscrepancyCount} 条差异
                    <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── 盘点结论卡片 ──────────────────────────────────────────────────────── */}
        <div className="rounded-2xl p-6 sm:p-8 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 sm:gap-8 bg-white/95 border border-[#dbeafe] shadow-sm">
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full pointer-events-none bg-blue-50" />
          <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full pointer-events-none bg-emerald-50" />

          {/* 左侧内容 */}
          <div className="relative z-10 flex-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-[#2563eb] px-3 py-1.5 rounded-full text-xs font-semibold">
                盘点结论
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] mb-5 leading-snug">
              {totalDiscrepancyCount === 0
                ? '本次盘点账实完全一致，无差异'
                : `本次盘点发现 ${totalDiscrepancyCount} 处差异，需要关注`}
            </h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-[#475569]">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0">✓</span>
                <span>
                  盘点范围 <strong className="text-[#0f172a]">{fmtNum(task.totalAssets)}</strong> 项资产，
                  已确认 <strong className="text-[#0f172a]">{fmtNum(task.countedAssets)}</strong> 项，
                  完成率 <strong className="text-[#0f172a]">{fmtPct(task.progress)}</strong>
                </span>
              </li>
              {totalDiscrepancyCount > 0 && (
                <li className="flex items-start gap-3 text-sm text-amber-700">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs shrink-0">!</span>
                  <span>
                    共发现差异 <strong className="text-[#0f172a]">{totalDiscrepancyCount}</strong> 处：
                    盘亏 <strong className="text-[#0f172a]">{task.deficitAssets}</strong> 项，盘盈 <strong className="text-[#0f172a]">{task.surplusAssets}</strong> 项
                  </span>
                </li>
              )}
              <li className="flex items-start gap-3 text-sm text-[#64748b]">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center text-xs shrink-0">📅</span>
                <span>
                  盘点任务创建于 <strong className="text-[#334155]">{new Date(task.createdAt).toLocaleDateString('zh-CN')}</strong>
                  {task.updatedAt && (
                    <>，最后更新 <strong className="text-[#334155]">{new Date(task.updatedAt).toLocaleDateString('zh-CN')}</strong></>
                  )}
                </span>
              </li>
            </ul>
          </div>

          {/* 右侧评分 + 按钮 */}
          <div className="relative z-10 flex flex-col items-center bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl px-8 sm:px-10 py-6 shrink-0 gap-3 min-w-[160px] shadow-sm">
            <div className="text-5xl sm:text-6xl font-black text-[#2563eb]/25 leading-none select-none">
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
            <div className="text-[#64748b] text-xs font-semibold tracking-wide -mt-1">准确率参考</div>
            <button className="w-full px-5 py-2.5 bg-white hover:bg-blue-50 border border-[#bfdbfe] text-[#2563eb] text-sm font-semibold rounded-xl transition-all duration-200 hover:shadow-md active:scale-[0.98]">
              查看处理建议
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── 内部子组件（接收 API 数据作为 props，样式增强版）────────────────────────

/** 进度概览柱状条形图 */
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

  const barWidth = 40;
  const gap = (chartW - 3 * barWidth) / 4;

  const metrics = [
    { label: '已盘', value: counted, pct: (counted / total) * 100, gradientId: 'barGrad1' },
    { label: '未盘', value: uncounted, pct: (uncounted / total) * 100, gradientId: 'barGrad2' },
    { label: '差异', value: discrepancy, pct: (discrepancy / total) * 100, gradientId: 'barGrad3' },
  ];

  const maxPct = Math.max(...metrics.map((m) => m.pct), 1);

  return (
    <div className="flex-1 relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="barGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="barGrad3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        {metrics.map((m, i) => {
          const x = PAD.left + gap + i * (barWidth + gap);
          const barH = (m.pct / maxPct) * chartH;
          const y = PAD.top + chartH - barH;
          return (
            <g key={m.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                fill={`url(#${m.gradientId})`}
                rx={6}
                opacity={0.9}
              />
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#0f172a"
                fontFamily="Inter, sans-serif"
                fontWeight="600"
              >
                {fmtNum(m.value)}
              </text>
              <text
                x={x + barWidth / 2}
                y={H - 4}
                textAnchor="middle"
                fontSize="9"
                fill="#94a3b8"
                fontFamily="Inter, sans-serif"
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** 差异分布圆环图 */
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
      <div className="relative w-36 h-36 sm:w-40 sm:h-40">
        <div
          className="w-full h-full rounded-full transition-transform duration-500 hover:scale-[1.02]"
          style={{ background: conic }}
        />
        <div className="absolute inset-0 m-5 sm:m-5.5 rounded-full bg-white flex flex-col items-center justify-center">
          <span className="text-3xl sm:text-4xl font-bold text-[#0f172a] tracking-tight">{totalDiscrepancy}</span>
          <span className="text-xs text-[#94a3b8] font-medium">差异</span>
        </div>
      </div>
      <div className="space-y-2.5 w-full px-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[#64748b] font-medium">{s.label}</span>
            </div>
            <div className="flex gap-2 text-[#0f172a] font-mono">
              <span className="font-semibold">{s.value}</span>
              <span className="text-[#94a3b8]">{s.pct}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 资产状态概览 */
function AssetStatusBars({ task }: { task: InventoryTask }) {
  const total = task.totalAssets || 1;
  const bars = [
    { label: '已确认', count: task.countedAssets, from: '#34d399', to: '#10b981' },
    { label: '未盘点', count: task.uncountedAssets, from: '#cbd5e1', to: '#94a3b8' },
    { label: '盘盈', count: task.surplusAssets, from: '#fbbf24', to: '#f59e0b' },
    { label: '盘亏', count: task.deficitAssets, from: '#f87171', to: '#ef4444' },
  ];

  return (
    <div className="space-y-5">
      {bars.map((bar) => {
        const rate = (bar.count / total) * 100;
        return (
          <div key={bar.label}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm text-[#374151] font-medium">{bar.label}</span>
              <span className="text-sm font-bold font-mono" style={{ color: bar.to }}>
                {fmtNum(bar.count)}
                <span className="text-[#94a3b8] font-normal ml-1">({fmtPct(rate)})</span>
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#f1f5f9] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${rate}%`,
                  background: `linear-gradient(90deg, ${bar.from}, ${bar.to})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
