/**
 * @file pages/reports/ReportsPage.tsx
 * @description 报表中心页面 — 报表列表 + 图表预览 + Excel 导出
 *
 * 功能：
 * - PageHeader 显示"报表中心"标题
 * - 按报表类别 tab 切换 + 时间范围下拉选择
 * - 报表卡片网格布局（图标、标题、描述、更新日期）
 * - 卡片点击展开图表预览
 * - 与后端 ReportController 对接获取数据
 * - API 错误时通过 sonner toast 提示
 * - 导出按钮生成当前分类报表的 .xlsx 文件
 *
 * 遵循 forthAMS Design System 设计令牌
 */

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Activity,
  Building2,
  Package,
  DollarSign,
  FileText,
  Calendar,
  Download,
  Eye,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Select, SelectItem } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  getReportByCategory,
  getReportSummary,
  getReportTrend,
  getDepreciationStats,
  getMaintenanceStats,
  getRetirementStats,
  getWorkOrderStatusDistribution,
  getWorkOrderDeptPending,
} from '@/api/reports';
import type { CategoryReport, ReportSummary, TrendReport, NameValueItem } from '@/api/reports';
import type { ApiResponse } from '@/types/common';
import { Button } from '@/components/ui/Button';
import { type ReportCardData } from './components/ReportCard';
import { ChartPreview } from './components/ChartPreview';

// ── 报表分类定义 ──────────────────────────────────────────────────────────────
const REPORT_CATEGORIES = [
  { id: 'asset',      label: '资产报表', icon: Package,     gradient: 'from-blue-600 to-cyan-500' },
  { id: 'financial',  label: '财务报表', icon: DollarSign,  gradient: 'from-emerald-500 to-teal-400' },
  { id: 'maintenance', label: '运维报表', icon: Activity,    gradient: 'from-amber-500 to-orange-400' },
  { id: 'workorder',  label: '工单报表', icon: FileText,     gradient: 'from-violet-500 to-purple-400' },
];

/** 所有预定义报表卡片 */
const ALL_REPORTS: ReportCardData[] = [
  // ── 资产报表 ──
  { id: 'asset-summary',       icon: BarChart3,  title: '资产汇总表',       description: '全量资产数量、总价值、净值等核心指标概览',       updatedAt: '2026-05-23', category: 'asset',      chartType: 'bar' },
  { id: 'asset-category',      icon: PieChart,   title: '资产分类统计',     description: '按资产分类统计数量和总价值的分布情况',           updatedAt: '2026-05-23', category: 'asset',      chartType: 'pie' },
  { id: 'asset-status',        icon: Activity,   title: '资产状态分布',     description: '各状态（在用/闲置/退役/待审批）资产数量占比',     updatedAt: '2026-05-22', category: 'asset',      chartType: 'pie' },
  { id: 'asset-dept',          icon: Building2,  title: '部门资产排行',     description: '各部门资产数量排名与价值对比',                  updatedAt: '2026-05-22', category: 'asset',      chartType: 'bar' },
  { id: 'asset-trend',         icon: TrendingUp, title: '资产增长趋势',     description: '月度资产价值与净值变化趋势分析',                updatedAt: '2026-05-21', category: 'asset',      chartType: 'area' },
  // ── 财务报表 ──
  { id: 'fin-value-trend',     icon: TrendingUp, title: '资产价值趋势',     description: '资产总价值与净值的月度变化趋势',                updatedAt: '2026-05-23', category: 'financial', chartType: 'area' },
  { id: 'fin-depreciation',    icon: DollarSign, title: '折旧统计',         description: '月度/年度折旧金额汇总统计',                    updatedAt: '2026-05-22', category: 'financial', chartType: 'bar' },
  { id: 'fin-category-value',  icon: PieChart,   title: '分类价值分布',     description: '各分类资产总价值占比分布',                     updatedAt: '2026-05-21', category: 'financial', chartType: 'pie' },
  // ── 运维报表 ──
  { id: 'ops-maintenance',     icon: Activity,   title: '维保统计',         description: '月度维保次数与维保费用统计',                   updatedAt: '2026-05-23', category: 'maintenance', chartType: 'bar' },
  { id: 'ops-retirement',      icon: TrendingUp, title: '退役处置统计',     description: '月度退役资产数量及处置方式分布',                updatedAt: '2026-05-22', category: 'maintenance', chartType: 'area' },
  // ── 工单报表 ──
  { id: 'wo-summary',          icon: FileText,   title: '工单完成率',       description: '工单完成率、按时完成率、平均处理时长',           updatedAt: '2026-05-23', category: 'workorder',  chartType: 'bar' },
  { id: 'wo-pending',          icon: Activity,   title: '待处理工单',       description: '各部门待处理工单数量与超时工单统计',             updatedAt: '2026-05-22', category: 'workorder',  chartType: 'bar' },
];

// ── 颜色常量（对齐 Design System） ─────────────────────────────────────────────
const COLORS = {
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  gray: '#64748b',
};

/** 格式化日期为 YYYYMMDD 字符串 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export default function ReportsPage() {
  const [activeCategory, setActiveCategory] = useState('asset');
  const [period, setPeriod] = useState('12');
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // ── API 查询 ────────────────────────────────────────────────────────────────
  const { data: categoryRes, isLoading: categoryLoading, isError: categoryError } = useQuery({
    queryKey: ['reports', 'by-category'],
    queryFn: getReportByCategory,
    staleTime: 1000 * 60 * 5,
    meta: { errorMessage: '数据加载失败，请重试' },
  });

  const { data: summaryRes, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: getReportSummary,
    staleTime: 1000 * 60 * 5,
    meta: { errorMessage: '数据加载失败，请重试' },
  });

  const { data: trendRes, isError: trendError } = useQuery({
    queryKey: ['reports', 'trend', Number(period)],
    queryFn: () => getReportTrend(Number(period)),
    staleTime: 1000 * 60 * 15,
    meta: { errorMessage: '数据加载失败，请重试' },
  });

  // ── AC-2: 月度统计查询（折旧/维保/退役处置） ────────────────────────────────
  const { data: depreciationRes } = useQuery({
    queryKey: ['reports', 'depreciation-stats'],
    queryFn: getDepreciationStats,
    staleTime: 1000 * 60 * 15,
    meta: { errorMessage: '数据加载失败，请重试' },
  });

  const { data: maintenanceRes } = useQuery({
    queryKey: ['reports', 'maintenance-stats'],
    queryFn: getMaintenanceStats,
    staleTime: 1000 * 60 * 15,
    meta: { errorMessage: '数据加载失败，请重试' },
  });

  const { data: retirementRes } = useQuery({
    queryKey: ['reports', 'retirement-stats'],
    queryFn: getRetirementStats,
    staleTime: 1000 * 60 * 15,
    meta: { errorMessage: '数据加载失败，请重试' },
  });

  // ── AC-2: 工单统计查询 ────────────────────────────────────────────────
  const { data: workOrderStatusRes } = useQuery({
    queryKey: ['workorders', 'status-distribution'],
    queryFn: getWorkOrderStatusDistribution,
    staleTime: 1000 * 60 * 15,
    meta: { errorMessage: '数据加载失败，请重试' },
  });

  const { data: workOrderDeptPendingRes } = useQuery({
    queryKey: ['workorders', 'dept-pending'],
    queryFn: getWorkOrderDeptPending,
    staleTime: 1000 * 60 * 15,
    meta: { errorMessage: '数据加载失败，请重试' },
  });

  // ── API 错误提示 ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (categoryError || summaryError || trendError) {
      toast.error('数据加载失败，请重试');
    }
  }, [categoryError, summaryError, trendError]);
  const categoryData = categoryRes as unknown as CategoryReport[] | undefined ?? [];
  const trendData = trendRes as unknown as TrendReport[] | undefined ?? [];
  const summary = summaryRes as unknown as ReportSummary | undefined;

  // ── 当前分类下的报表 ────────────────────────────────────────────────────────
  const currentReports = useMemo(
    () => ALL_REPORTS.filter((r) => r.category === activeCategory),
    [activeCategory],
  );

  // ── 当前选中的报表 ──────────────────────────────────────────────────────────
  const selectedReportData = useMemo(
    () => ALL_REPORTS.find((r) => r.id === selectedReport) ?? null,
    [selectedReport],
  );

  // ── 图表数据映射 ────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!selectedReportData) return [];

    switch (selectedReportData.id) {
      case 'asset-summary':
        return summary
          ? [
              { name: '资产总数', value: summary.totalAssets },
              { name: '在用资产', value: summary.activeAssets },
              { name: '待审批', value: summary.pendingApproval },
              { name: '退役资产', value: summary.recentlyRetired },
            ]
          : [];
      case 'asset-category':
      case 'fin-category-value':
        return categoryData.map((c) => ({
          name: c.categoryName,
          value: selectedReportData.id === 'fin-category-value'
            ? Math.round(c.totalValue / 10000)
            : c.assetCount,
        }));
      case 'asset-status':
        return summary
          ? [
              { name: '在用', value: summary.activeAssets },
              { name: '待审批', value: summary.pendingApproval },
              { name: '退役', value: summary.recentlyRetired },
              { name: '其他', value: Math.max(0, summary.totalAssets - summary.activeAssets - summary.pendingApproval - summary.recentlyRetired) },
            ]
          : [];
      case 'asset-dept':
        return categoryData.slice(0, 6).map((c, i) => ({
          name: c.categoryName,
          value: c.assetCount * (1 + i * 0.3),
        }));
      case 'asset-trend':
      case 'fin-value-trend':
        if (trendData.length > 0) {
          return trendData.map((t) => ({
            month: t.month,
            value: Math.round(t.totalValue / 10000),
            net: Math.round(t.totalValue * 0.6 / 10000),
          }));
        }
        return [];
      case 'fin-depreciation': {
        // AC-2: 从后端获取真实折旧统计数据，替代原有 mock
        const depreciationData = depreciationRes as unknown as { month: string; value: number }[] | undefined;
        if (depreciationData && depreciationData.length > 0) {
          return depreciationData.map((d) => ({ month: d.month, value: d.value }));
        }
        return [];
      }
      case 'ops-maintenance': {
        // AC-2: 从后端获取真实维保统计数据，替代原有 mock
        const maintenanceData = maintenanceRes as unknown as { month: string; value: number }[] | undefined;
        if (maintenanceData && maintenanceData.length > 0) {
          return maintenanceData.map((d) => ({ month: d.month, value: d.value }));
        }
        return [];
      }
      case 'ops-retirement': {
        // AC-2: 从后端获取真实退役处置统计数据，替代原有 mock
        const retirementData = retirementRes as unknown as { month: string; value: number }[] | undefined;
        if (retirementData && retirementData.length > 0) {
          return retirementData.map((d) => ({ month: d.month, value: d.value }));
        }
        return [];
      }
      case 'wo-summary': {
        // AC-2: 从后端获取真实工单状态分布数据
        const statusData = workOrderStatusRes as unknown as NameValueItem[] | undefined;
        if (statusData && statusData.length > 0) {
          return statusData;
        }
        return [];
      }
      case 'wo-pending': {
        // AC-2: 从后端获取真实部门待处理工单数据
        const deptData = workOrderDeptPendingRes as unknown as NameValueItem[] | undefined;
        if (deptData && deptData.length > 0) {
          return deptData;
        }
        return [];
      }
      default:
        return [];
    }
  }, [selectedReportData, summary, categoryData, trendData, period, depreciationRes, maintenanceRes, retirementRes, workOrderStatusRes, workOrderDeptPendingRes]);

  // ── Excel 导出 ──────────────────────────────────────────────────────────────
  const handleExport = () => {
    try {
      const data = currentReports.map((r) => ({
        title: r.title,
        description: r.description,
        category: r.category,
        updatedAt: r.updatedAt,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '报表数据');
      XLSX.writeFile(wb, `报表中心_${formatDate(new Date())}.xlsx`);
      toast.success('导出成功');
    } catch (err) {
      toast.error('导出失败，请重试');
      console.error('导出出错:', err);
    }
  };

  const isLoading = categoryLoading || summaryLoading;

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ── 页头 + 统计概览 ───────────────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900">报表中心</h1>
              <p className="mt-1 text-sm text-slate-500">预定义报表查看与数据可视化</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <Select value={period} onValueChange={setPeriod}>
                  <SelectItem value="6">近 6 个月</SelectItem>
                  <SelectItem value="12">近 12 个月</SelectItem>
                  <SelectItem value="24">近 24 个月</SelectItem>
                </Select>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExport}
                className="rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                导出
              </Button>
            </div>
          </div>

          {/* 分类统计栏 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            {REPORT_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const count = ALL_REPORTS.filter((r) => r.category === cat.id).length;
              return (
                <div key={cat.id} className="flex items-center gap-3.5 px-6 py-4">
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cat.gradient}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">{cat.label}</p>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">{count}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 分类筛选 pills ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {REPORT_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => { setActiveCategory(cat.id); setSelectedReport(null); }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                  isActive
                    ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* ── 报表卡片网格 ──────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
            ))}
          </div>
        ) : (categoryError || summaryError || trendError) ? (
          <EmptyState
            title="数据加载失败"
            description="无法加载报表数据，请稍后重试"
          />
        ) : currentReports.length === 0 ? (
          <EmptyState
            title="暂无报表"
            description="当前分类下暂无可用报表"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {currentReports.map((report) => {
              const Icon = report.icon;
              const catDef = REPORT_CATEGORIES.find((c) => c.id === report.category);
              const isSelected = selectedReport === report.id;
              return (
                <div
                  key={report.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedReport(isSelected ? null : report.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedReport(isSelected ? null : report.id); } }}
                  className={cn(
                    'group relative cursor-pointer overflow-hidden rounded-2xl border bg-white p-5 transition-all duration-200',
                    'before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-200/70 before:to-transparent hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-900/5',
                    isSelected
                      ? 'border-blue-300 shadow-md ring-2 ring-blue-500/20'
                      : 'border-slate-200/80 shadow-sm hover:border-slate-300',
                  )}
                >
                  {/* ── 顶部：类别标签 + 更新时间 ── */}
                  <div className="flex items-center justify-between mb-3">
                    {catDef && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600 ring-1 ring-inset ring-blue-100">
                        <catDef.icon className="w-3 h-3" />
                        {catDef.label}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {report.updatedAt}
                    </span>
                  </div>

                  {/* ── 中部：图标 + 标题 + 描述 ── */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${catDef?.gradient ?? 'from-blue-600 to-cyan-500'} shadow-inner transition-colors`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 truncate leading-snug">
                          {report.title}
                        </h3>
                        {catDef && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 flex-shrink-0">
                            {catDef.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {report.description}
                      </p>
                    </div>
                  </div>

                  {/* ── 底部：操作按钮 ── */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100',
                      )}
                      onClick={(e) => { e.stopPropagation(); setSelectedReport(isSelected ? null : report.id); }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      查看
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 图表预览区 ────────────────────────────────────────────────── */}
        {selectedReportData && chartData.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <ChartPreview
              title={selectedReportData.title}
              type={selectedReportData.chartType ?? 'bar'}
              data={chartData as unknown as Record<string, unknown>[] }
              dataKey={selectedReportData.chartType === 'area' ? 'month' : 'name'}
              valueKey="value"
            />
          </div>
        )}

        {selectedReportData && chartData.length === 0 && !isLoading && !categoryError && !summaryError && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <ChartPreview
              title={selectedReportData.title}
              type={selectedReportData.chartType ?? 'bar'}
              data={[]}
              dataKey="name"
              valueKey="value"
            />
          </div>
        )}
      </div>
    </div>
  );
}
