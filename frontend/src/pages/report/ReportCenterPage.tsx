/**
 * @file pages/report/ReportCenterPage.tsx
 * @description 报表中心 — 预设报表仓库
 *
 * 定位 vs AnalyticsPage：
 * - AnalyticsPage = 交互式 BI 分析（多维度组合筛选 + 可视化探索）
 * - ReportCenterPage = 预设报表仓库（固定格式报表列表 + 一键导出）
 *
 * 设计稿由 Stitch AI 生成，手动集成至 forthAMS Design System。
 * 图表使用 Recharts（审计 F08 + Debate 推荐）。
 */

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  FileBarChart,
  Download,
  RefreshCw,
  Calendar,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  Package,
  AlertTriangle,
  DollarSign,
  Activity,
} from 'lucide-react';
import { useReportSummary, useReportByCategory, useReportTrend } from '@/hooks/useReports';
import type { ApiResponse } from '@/types/common';
import type { ReportSummary, CategoryReport } from '@/api/stats';
import type { ReportTrend } from '@/hooks/useReports';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';

// ── 颜色常量 ──────────────────────────────────────────────────────────────────
const COLORS = {
  blue:    '#3b82f6',
  green:   '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  purple:  '#8b5cf6',
  cyan:    '#06b6d4',
  pink:    '#ec4899',
  slate:   '#64748b',
};

const PIE_COLORS = [COLORS.blue, COLORS.green, COLORS.amber, COLORS.red, COLORS.purple, COLORS.cyan, COLORS.pink];

export default function ReportCenterPage() {
  const [exporting, setExporting] = useState(false);

  // ── API 查询 ────────────────────────────────────────────────────────────────
  const { data: summaryRes } = useReportSummary();
  const { data: categoryRes } = useReportByCategory();
  const { data: trendRes } = useReportTrend();

  // ── 数据解析 ────────────────────────────────────────────────────────────────
  const summary = summaryRes as unknown as ReportSummary | undefined;
  const categoryData = categoryRes as unknown as CategoryReport[] | undefined ?? [];
  const trendData = trendRes as unknown as ReportTrend[] | undefined ?? [];

  // 分类柱状图数据
  const categoryBarData = useMemo(
    () => categoryData.map((c: CategoryReport) => ({
      name: c.categoryName,
      count: c.assetCount,
      value: Math.round(c.totalValue / 10000),
    })),
    [categoryData],
  );

  // 饼图数据（Top 8 分类）
  const pieData = useMemo(() => {
    const sorted = [...categoryData].sort((a, b) => b.assetCount - a.assetCount);
    return sorted.slice(0, 8).map((c: CategoryReport) => ({
      name: c.categoryName,
      value: c.assetCount,
    }));
  }, [categoryData]);

  // 趋势图数据（万元）
  const trendChartData = useMemo(
    () => trendData.map((t: ReportTrend) => ({
      month: t.month?.substring(5) ?? t.month,
      totalValue: Math.round(t.totalValue / 10000),
      netValue: Math.round(t.netValue / 10000),
    })),
    [trendData],
  );

  // ── 模拟导出处理 ────────────────────────────────────────────────────────────
  const handleExport = (format: 'pdf' | 'excel') => {
    setExporting(true);
    // 模拟导出延迟
    setTimeout(() => {
      setExporting(false);
      // 实际导出逻辑：调用后端导出 API 或前端生成
      console.log(`Exporting report as ${format}...`);
    }, 1500);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="报表中心"
        subtitle="预设报表仓库 — 一键导出资产数据报告"
        breadcrumbs={[{ label: '仪表板', href: '/dashboard' }, { label: '报表中心' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('excel')}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#16a34a] bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exporting ? '导出中...' : '导出 Excel'}
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#dc2626] bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <FileBarChart className="w-4 h-4" />
              {exporting ? '导出中...' : '导出 PDF'}
            </button>
          </div>
        }
      />

      {/* KPI 概览 */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          title="资产总量"
          value={(summary?.totalAssets ?? 0).toLocaleString()}
          subtitle="全部资产"
          icon={Package}
          iconColor={COLORS.blue}
        />
        <KpiCard
          title="在用资产"
          value={(summary?.activeAssets ?? 0).toLocaleString()}
          subtitle="当前在用"
          icon={Activity}
          iconColor={COLORS.green}
        />
        <KpiCard
          title="资产总价值"
          value={`¥${((summary?.activeAssets ?? 0) > 0 ? '---' : '0')}`}
          subtitle="原值总计"
          icon={DollarSign}
          iconColor={COLORS.amber}
        />
        <KpiCard
          title="待处理事项"
          value={String((summary?.pendingApproval ?? 0) + (summary?.recentlyRetired ?? 0))}
          subtitle={`待审批 ${summary?.pendingApproval ?? 0} · 已退役 ${summary?.recentlyRetired ?? 0}`}
          icon={AlertTriangle}
          iconColor={COLORS.purple}
        />
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-5 gap-4">
        {/* 分类统计柱状图 */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              分类资产统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryBarData} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="count" name="资产数量（台）" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-sm text-[#94a3b8]">
                暂无分类数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 分类分布饼图 */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-purple-500" />
              分类占比
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-sm text-[#94a3b8]">
                暂无分类数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 趋势图 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-500" />
            资产价值趋势（近 12 个月）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendChartData} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="totalValue" name="总价值（万元）" stroke={COLORS.blue} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="netValue" name="净值（万元）" stroke={COLORS.green} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-72 text-sm text-[#94a3b8]">
              暂无趋势数据
            </div>
          )}
        </CardContent>
      </Card>

      {/* 报表列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="w-4 h-4 text-slate-500" />
            预设报表
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#edf2f7]">
                <th className="text-left px-5 py-3 font-medium text-[#64748b]">报表名称</th>
                <th className="text-left px-5 py-3 font-medium text-[#64748b]">描述</th>
                <th className="text-left px-5 py-3 font-medium text-[#64748b]">数据源</th>
                <th className="text-right px-5 py-3 font-medium text-[#64748b]">操作</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: '资产汇总报表', desc: '全量资产数量、价值、状态分布', source: 'ReportSummary' },
                { name: '分类统计报表', desc: '按资产分类的数量和价值统计', source: 'CategoryReport' },
                { name: '月度趋势报表', desc: '近 12 个月资产价值和净值变化', source: 'TrendReport' },
                { name: '部门分布报表', desc: '各部门资产数量和价值占比', source: 'DeptDistribution' },
                { name: '状态分布报表', desc: '资产状态分布（在用/闲置/维修等）', source: 'StatusReport' },
              ].map((report, i) => (
                <tr key={i} className="border-b border-[#f8fafc] hover:bg-[#f8fafc] transition-colors">
                  <td className="px-5 py-3 font-medium text-[#0f172a]">{report.name}</td>
                  <td className="px-5 py-3 text-[#64748b]">{report.desc}</td>
                  <td className="px-5 py-3 text-[#94a3b8] text-xs">{report.source}</td>
                  <td className="px-5 py-3 text-right">
                    <button className="text-xs text-[#3b82f6] hover:text-blue-700 font-medium">
                      导出
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 底部说明 */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm leading-6 text-blue-700">
        <strong>报表中心</strong> 提供预设格式的资产数据报表，支持一键导出 Excel / PDF。
        如需交互式多维数据分析，请使用 <strong>数据分析</strong> 页面（/analytics）。
      </div>
    </div>
  );
}
