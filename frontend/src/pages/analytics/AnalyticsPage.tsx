/**
 * @file pages/analytics/AnalyticsPage.tsx
 * @description 数据分析页 — 多维数据可视化与洞察
 *
 * 功能：
 * - 4个 KPI 概览卡片（从 getDashboardStats + getReportSummary 获取）
 * - 资产增长趋势（面积图，从 getAssetValueTrends 获取）
 * - 资产分类分布（饼图，从 getReportByCategory / getDashboardStats.categoryDistribution 获取）
 * - 部门资产价值排行（横向柱图，从 getDeptDistribution 获取）
 * - 月度处置统计（柱状图，从 getReportSummary 获取退役数据）
 * - 日期范围筛选器绑定查询参数
 *
 * 布局改进 (FD-20260530-23)：
 * - 响应式图表网格，小屏单列、大屏多列稳定布局
 * - 每个图表独立处理 加载/错误/空 三种状态，不伪造数据
 * - 筛选器标注"数据范围"标签，图表标题附加说明性副标题
 *
 * 数据源：所有图表绑定真实 API，无 MOCK 残留。
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Package, DollarSign, Activity, BarChart3,
  Calendar, AlertCircle, Loader2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  getDashboardStats,
  getAssetValueTrends,
  getDeptDistribution,
  getMaintenanceStats,
} from '@/api/asset';
import { getReportByCategory, getReportSummary, type ReportSummary, type CategoryReport } from '@/api/stats';
import type { ApiResponse } from '@/types/common';
import type { DashboardStats, AssetValueTrend, DeptAssetDistribution } from '@/types/asset';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Select, SelectItem } from '@/components/ui/Select';

// ── 颜色常量 ──────────────────────────────────────────────────────────────────
const COLORS = {
  blue:    '#3b82f6',
  green:   '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  purple:  '#8b5cf6',
  cyan:    '#06b6d4',
  pink:    '#ec4899',
  gray:    '#64748b',
};

const PIE_COLORS = [COLORS.blue, COLORS.green, COLORS.amber, COLORS.red, COLORS.purple, COLORS.cyan, COLORS.pink, COLORS.gray];

// ── 图表状态组件 ──────────────────────────────────────────────────────────────

/** 图表空状态占位 */
function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-60 text-slate-400">
      <BarChart3 className="w-10 h-10 mb-3 text-slate-200" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

/** 图表加载状态 */
function ChartLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-60 text-slate-400">
      <Loader2 className="w-7 h-7 mb-3 animate-spin text-blue-500" />
      <span className="text-sm font-medium">加载中…</span>
    </div>
  );
}

/** 图表错误状态 */
function ChartErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-60 text-red-500">
      <AlertCircle className="w-7 h-7 mb-3" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('12');

  // ── API 查询 ────────────────────────────────────────────────────────────────

  /** 仪表板核心统计 */
  const { data: statsRes, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60 * 5,
  });

  /** 资产价值趋势（根据 period 计算天数） */
  const { data: trendsRes, isLoading: trendsLoading, isError: trendsError } = useQuery({
    queryKey: ['dashboard', 'trends', Number(period) * 30],
    queryFn: () => getAssetValueTrends(Number(period) * 30),
    staleTime: 1000 * 60 * 15,
  });

  /** 部门资产分布 */
  const { data: deptRes, isLoading: deptLoading, isError: deptError } = useQuery({
    queryKey: ['dashboard', 'dept-distribution'],
    queryFn: getDeptDistribution,
    staleTime: 1000 * 60 * 15,
  });

  /** 维保统计 */
  const { data: maintenanceRes, isLoading: maintenanceLoading } = useQuery({
    queryKey: ['dashboard', 'maintenance-stats'],
    queryFn: getMaintenanceStats,
    staleTime: 1000 * 60 * 15,
  });

  /** 分类统计（ReportController） */
  const { data: categoryRes, isLoading: categoryLoading, isError: categoryError } = useQuery({
    queryKey: ['reports', 'by-category'],
    queryFn: getReportByCategory,
    staleTime: 1000 * 60 * 15,
  });

  /** 汇总统计（ReportController） */
  const { data: summaryRes, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: getReportSummary,
    staleTime: 1000 * 60 * 15,
  });

  // ── 数据提取与格式化 ────────────────────────────────────────────────────────

  const stats = statsRes as unknown as DashboardStats | undefined;
  const summary = summaryRes as unknown as ReportSummary | undefined;
  const trends = trendsRes as unknown as AssetValueTrend[] | undefined ?? [];
  const deptData = deptRes as unknown as DeptAssetDistribution[] | undefined ?? [];
  const categoryData = categoryRes as unknown as CategoryReport[] | undefined ?? [];
  const maintenanceData = maintenanceRes as unknown as Record<string, unknown> | undefined;

  /** 趋势图数据：将 API 响应映射为图表格式 */
  const trendChartData = trends.length > 0
    ? trends.slice(-Number(period)).map((t: AssetValueTrend) => ({
        month:  t.date?.substring(0, 7) ?? '',
        value:  Math.round(((t.totalValue ?? 0)) / 10000),
        net:    Math.round(((t.netValue ?? 0)) / 10000),
      }))
    : [];

  /** 饼图数据：从 categoryReport（ReportController）或 categoryDistribution（DashboardStats）构建 */
  const pieChartData = categoryData.length > 0
    ? categoryData.map((c: CategoryReport) => ({
        name:  c.categoryName,
        value: c.assetCount,
      }))
    : stats?.categoryDistribution
      ? Object.entries(stats.categoryDistribution as Record<string, number>).map(([name, count]) => ({
          name,
          value: count,
        }))
      : [];

  /** 部门排行数据：映射数量 */
  const deptChartData = deptData.map((d: DeptAssetDistribution) => ({
    name:  d.deptName,
    value: d.assetCount,
  }));

  /** 处置统计：从 ReportSummary 构造汇总信息 */
  const disposalData = summary
    ? [
        { type: '退役资产', count: summary.recentlyRetired ?? 0 },
        { type: '待审批',   count: summary.pendingApproval ?? 0 },
        { type: '在用资产', count: summary.activeAssets ?? 0 },
      ]
    : [];

  // ── 加载状态 ────────────────────────────────────────────────────────────────

  const allLoading = statsLoading && !stats && !summary;

  // ── KPI 数据配置 ────────────────────────────────────────────────────────────

  const kpiItems = [
    {
      title: '资产总数',
      value: (stats?.totalAssets ?? 0).toLocaleString() + ' 台',
      subtitle: `在用 ${(stats?.inUseAssets ?? 0).toLocaleString()} 台`,
      icon: Package,
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      title: '资产总价值',
      value: '¥' + ((stats?.totalValue ?? 0) / 10000).toFixed(0) + ' 万',
      subtitle: `净值 ¥${((stats?.netValue ?? 0) / 10000).toFixed(0)} 万`,
      icon: DollarSign,
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      title: '月度维保次数',
      value: String(maintenanceData?.monthlyMaintenanceCount ?? 0),
      subtitle: `总计 ${maintenanceData?.totalMaintenanceCount ?? 0} 次`,
      icon: Activity,
      gradient: 'from-amber-500 to-amber-600',
    },
    {
      title: '待审批',
      value: String(stats?.pendingApprovals ?? 0),
      subtitle: `退役 ${summary?.recentlyRetired ?? 0} 项`,
      icon: TrendingUp,
      gradient: 'from-purple-500 to-purple-600',
    },
  ];

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ── 页头 + KPI 统计栏 ───────────────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900">数据分析</h1>
              <p className="mt-1 text-sm text-slate-500">多维度资产数据洞察与趋势分析</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500 hidden sm:inline">数据范围</span>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectItem value="6">近 6 个月</SelectItem>
                  <SelectItem value="12">近 12 个月</SelectItem>
                </Select>
              </div>
            </div>
          </div>

          {/* KPI 统计栏 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            {allLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-5">
                  <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
                  <div className="space-y-2">
                    <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                    <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))
            ) : statsError ? (
              <div className="col-span-full flex items-center justify-center gap-2 py-8 text-red-500 text-sm font-medium">
                <AlertCircle className="w-5 h-5" />
                统计数据加载失败
              </div>
            ) : (
              kpiItems.map((kpi, idx) => {
                const Icon = kpi.icon;
                return (
                  <div key={idx} className="flex items-center gap-3.5 px-6 py-5">
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${kpi.gradient} shadow-sm`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 truncate">{kpi.title}</p>
                      <p className="text-lg font-bold text-slate-900 tabular-nums">{kpi.value}</p>
                      <p className="text-xs text-slate-400 truncate">{kpi.subtitle}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ── 图表行 1：趋势 + 分类分布 ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* 资产增长趋势 */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm col-span-1 lg:col-span-3">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg shadow-blue-900/5 m-3">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-semibold text-slate-900">资产价值趋势</span>
                  <span className="text-xs font-normal text-slate-400 ml-auto">
                    {period === '6' ? '近 6 个月' : '近 12 个月'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trendsLoading ? (
                  <ChartLoadingState />
                ) : trendsError ? (
                  <ChartErrorState message="趋势数据加载失败" />
                ) : trendChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={trendChartData} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v?.substring(5) ?? v}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="value"
                        name="总价值（万元）"
                        stroke={COLORS.blue}
                        strokeWidth={2.5}
                        fill="url(#colorValue)"
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="net"
                        name="净值（万元）"
                        stroke={COLORS.green}
                        strokeWidth={2.5}
                        fill="url(#colorNet)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState message="暂无趋势数据" />
                )}
              </CardContent>
            </div>
          </Card>

          {/* 分类分布 */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm col-span-1 lg:col-span-2">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg shadow-blue-900/5 m-3">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-semibold text-slate-900">资产分类分布</span>
                  <span className="text-xs font-normal text-slate-400 ml-auto">按类别统计</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categoryLoading || (statsLoading && !stats?.categoryDistribution) ? (
                  <ChartLoadingState />
                ) : categoryError && !stats?.categoryDistribution ? (
                  <ChartErrorState message="分类数据加载失败" />
                ) : pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={85}
                        dataKey="value"
                        paddingAngle={3}
                      >
                        {pieChartData.map((_: Record<string, unknown>, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState message="暂无分类数据" />
                )}
              </CardContent>
            </div>
          </Card>
        </div>

        {/* ── 图表行 2：部门排行 + 处置统计 ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 部门资产数量排行 */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg shadow-blue-900/5 m-3">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-semibold text-slate-900">部门资产数量排行</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deptLoading ? (
                  <ChartLoadingState />
                ) : deptError ? (
                  <ChartErrorState message="部门数据加载失败" />
                ) : deptChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={deptChartData}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 80, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        width={80}
                      />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="value" fill={COLORS.blue} radius={[0, 6, 6, 0]} name="资产数量（台）" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState message="暂无部门数据" />
                )}
              </CardContent>
            </div>
          </Card>

          {/* 资产状态统计 */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg shadow-blue-900/5 m-3">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                    <Activity className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="font-semibold text-slate-900">资产状态统计</span>
                  <span className="text-xs font-normal text-slate-400 ml-auto">退役 / 审批 / 在用</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <ChartLoadingState />
                ) : summaryError ? (
                  <ChartErrorState message="汇总数据加载失败" />
                ) : disposalData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={disposalData} margin={{ top: 0, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="count" fill={COLORS.blue} name="数量" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState message="暂无统计数据" />
                )}
              </CardContent>
            </div>
          </Card>
        </div>

        {/* ── 底部说明 ────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 px-5 py-4 text-sm leading-6 text-blue-700 shadow-sm">
          <div className="flex items-start gap-2">
            <Activity className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
            <span>数据分析模块已对接 Dashboard Stats、Trends、Dept Distribution、Maintenance Stats、Report Summary 及 Category Report API。日期筛选器控制趋势图的时间范围。</span>
          </div>
        </div>
      </div>
    </div>
  );
}
