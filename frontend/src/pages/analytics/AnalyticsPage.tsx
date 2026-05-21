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
 * 数据源：所有图表绑定真实 API，无 MOCK 残留。
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Package, DollarSign, Activity, BarChart3,
  Calendar,
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
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectItem } from '@/components/ui/Select';
import { SkeletonCard } from '@/components/ui/Skeleton';

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

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('12');

  // ── API 查询 ────────────────────────────────────────────────────────────────

  /** 仪表板核心统计 */
  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60 * 5,
  });

  /** 资产价值趋势（根据 period 计算天数） */
  const { data: trendsRes } = useQuery({
    queryKey: ['dashboard', 'trends', Number(period) * 30],
    queryFn: () => getAssetValueTrends(Number(period) * 30),
    staleTime: 1000 * 60 * 15,
  });

  /** 部门资产分布 */
  const { data: deptRes } = useQuery({
    queryKey: ['dashboard', 'dept-distribution'],
    queryFn: getDeptDistribution,
    staleTime: 1000 * 60 * 15,
  });

  /** 维保统计 */
  const { data: maintenanceRes } = useQuery({
    queryKey: ['dashboard', 'maintenance-stats'],
    queryFn: getMaintenanceStats,
    staleTime: 1000 * 60 * 15,
  });

  /** 分类统计（ReportController） */
  const { data: categoryRes } = useQuery({
    queryKey: ['reports', 'by-category'],
    queryFn: getReportByCategory,
    staleTime: 1000 * 60 * 15,
  });

  /** 汇总统计（ReportController） */
  const { data: summaryRes } = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: getReportSummary,
    staleTime: 1000 * 60 * 15,
  });

  // ── 数据提取与格式化 ────────────────────────────────────────────────────────

  const stats = (statsRes as ApiResponse<DashboardStats> | undefined)?.data;
  const summary = (summaryRes as ApiResponse<ReportSummary> | undefined)?.data;
  const trends = (trendsRes as ApiResponse<AssetValueTrend[]> | undefined)?.data ?? [];
  const deptData = (deptRes as ApiResponse<DeptAssetDistribution[]> | undefined)?.data ?? [];
  const categoryData = (categoryRes as ApiResponse<CategoryReport[]> | undefined)?.data ?? [];
  const maintenanceData = (maintenanceRes as ApiResponse<Record<string, unknown>> | undefined)?.data;

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

  /** 部门排行数据：映射为万元 */
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

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="数据分析"
        subtitle="多维度资产数据洞察与趋势分析"
        breadcrumbs={[{ label: '仪表板', href: '/dashboard' }, { label: '数据分析' }]}
        actions={
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#94a3b8]" />
            <Select
              value={period}
              onValueChange={setPeriod}
            >
              <SelectItem value="6">近 6 个月</SelectItem>
              <SelectItem value="12">近 12 个月</SelectItem>
            </Select>
          </div>
        }
      />

      {/* KPI 概览 */}
      <div className="grid grid-cols-4 gap-4">
        {allLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              title="资产总数"
              value={(stats?.totalAssets ?? 0).toLocaleString() + ' 台'}
              trend={{ value: `在用 ${(stats?.inUseAssets ?? 0).toLocaleString()} 台`, direction: 'up' }}
              icon={Package}
              iconColor={COLORS.blue}
            />
            <KpiCard
              title="资产总价值"
              value={'¥' + ((stats?.totalValue ?? 0) / 10000).toFixed(0) + ' 万'}
              subtitle={`净值 ¥${((stats?.netValue ?? 0) / 10000).toFixed(0)} 万`}
              icon={DollarSign}
              iconColor={COLORS.green}
            />
            <KpiCard
              title="月度维保次数"
              value={String(maintenanceData?.monthlyMaintenanceCount ?? 0)}
              subtitle={`总计 ${maintenanceData?.totalMaintenanceCount ?? 0} 次`}
              icon={Activity}
              iconColor={COLORS.amber}
            />
            <KpiCard
              title="待审批"
              value={String(stats?.pendingApprovals ?? 0)}
              subtitle={`退役 ${summary?.recentlyRetired ?? 0} 项`}
              icon={TrendingUp}
              iconColor={COLORS.purple}
            />
          </>
        )}
      </div>

      {/* 图表行 1：趋势 + 分类分布 */}
      <div className="grid grid-cols-5 gap-4">
        {/* 资产增长趋势 */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              资产价值趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trendChartData} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.15} />
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
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="value"
                    name="总价值（万元）"
                    stroke={COLORS.blue}
                    strokeWidth={2}
                    fill="url(#colorValue)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="net"
                    name="净值（万元）"
                    stroke={COLORS.green}
                    strokeWidth={2}
                    fill="url(#colorNet)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">
                暂无趋势数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 分类分布 */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              资产分类分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {pieChartData.map((_: Record<string, unknown>, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">
                暂无分类数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 图表行 2：部门排行 + 处置统计 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 部门资产价值排行 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              部门资产数量排行
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deptChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
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
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" fill={COLORS.blue} radius={[0, 4, 4, 0]} name="资产数量（台）" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">
                暂无部门数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 资产状态统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              资产状态统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            {disposalData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={disposalData} margin={{ top: 0, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="count" fill={COLORS.blue} name="数量" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">
                暂无统计数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 底部说明 */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm leading-6 text-blue-700">
        数据分析模块已对接 Dashboard Stats、Trends、Dept Distribution、Maintenance Stats、Report Summary 及 Category Report API。日期筛选器控制趋势图的时间范围。
      </div>
    </div>
  );
}
