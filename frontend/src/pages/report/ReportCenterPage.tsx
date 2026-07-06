/**
 * @file pages/report/ReportCenterPage.tsx
 * @description 报表中心入口 — 预设报表仓库导航
 *
 * 定位 vs ReportsPage：
 * - ReportCenterPage = 报表中心入口（KPI 概览 + 分类卡片导航）
 * - ReportsPage = 报表详情页（图表预览 + Excel 导出）
 *
 * 设计原则：
 * - 入口卡片、筛选/分类、状态/最近生成信息层次清楚
 * - 与 ReportsPage 保持一致的设计语言但不重复堆砌图表
 * - 响应式无溢出
 *
 * 技术栈: React 18 + TypeScript + Vite + Tailwind + lucide
 */

import { useState, useMemo } from 'react';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Activity,
  Building2,
  Package,
  DollarSign,
  FileText,
  Calendar,
  Download,
  Eye,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useReportSummary, useReportByCategory, useReportTrend } from '@/hooks/useReports';
import type { ReportSummary, CategoryReport } from '@/api/stats';
import type { ReportTrend } from '@/hooks/useReports';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { cn } from '@/utils/cn';

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

// ── 报表分类定义 ──────────────────────────────────────────────────────────────
const REPORT_CATEGORIES = [
  { id: 'asset',       label: '资产报表',   icon: Package,    color: COLORS.blue },
  { id: 'financial',   label: '财务报表',   icon: DollarSign, color: COLORS.green },
  { id: 'maintenance', label: '运维报表',   icon: Activity,   color: COLORS.amber },
  { id: 'workorder',   label: '工单报表',   icon: FileText,   color: COLORS.purple },
];

// ── 报表条目状态 ──────────────────────────────────────────────────────────────
type ReportStatus = 'ready' | 'stale' | 'pending';

interface ReportEntry {
  id: string;
  icon: typeof BarChart3;
  title: string;
  description: string;
  category: string;
  status: ReportStatus;
  updatedAt: string;
  href: string;
}

/** 全部预设报表 */
const ALL_REPORTS: ReportEntry[] = [
  // ── 资产报表 ──
  { id: 'asset-summary',   icon: BarChart3,    title: '资产汇总表',       description: '全量资产数量、总价值、净值等核心指标概览',     category: 'asset',       status: 'ready',  updatedAt: '2026-05-23', href: '/reports?category=asset&report=asset-summary' },
  { id: 'asset-category',  icon: PieChartIcon, title: '资产分类统计',     description: '按资产分类统计数量和总价值的分布情况',         category: 'asset',       status: 'ready',  updatedAt: '2026-05-23', href: '/reports?category=asset&report=asset-category' },
  { id: 'asset-status',    icon: Activity,     title: '资产状态分布',     description: '各状态（在用/闲置/退役/待审批）资产数量占比',   category: 'asset',       status: 'ready',  updatedAt: '2026-05-22', href: '/reports?category=asset&report=asset-status' },
  { id: 'asset-dept',      icon: Building2,    title: '部门资产排行',     description: '各部门资产数量排名与价值对比',                category: 'asset',       status: 'stale',  updatedAt: '2026-05-20', href: '/reports?category=asset&report=asset-dept' },
  { id: 'asset-trend',     icon: TrendingUp,   title: '资产增长趋势',     description: '月度资产价值与净值变化趋势分析',              category: 'asset',       status: 'ready',  updatedAt: '2026-05-21', href: '/reports?category=asset&report=asset-trend' },
  // ── 财务报表 ──
  { id: 'fin-value-trend', icon: TrendingUp,   title: '资产价值趋势',     description: '资产总价值与净值的月度变化趋势',              category: 'financial',   status: 'ready',  updatedAt: '2026-05-23', href: '/reports?category=financial&report=fin-value-trend' },
  { id: 'fin-depreciation',icon: DollarSign,   title: '折旧统计',         description: '月度/年度折旧金额汇总统计',                  category: 'financial',   status: 'stale',  updatedAt: '2026-05-19', href: '/reports?category=financial&report=fin-depreciation' },
  { id: 'fin-category-val',icon: PieChartIcon, title: '分类价值分布',     description: '各分类资产总价值占比分布',                   category: 'financial',   status: 'ready',  updatedAt: '2026-05-21', href: '/reports?category=financial&report=fin-category-value' },
  // ── 运维报表 ──
  { id: 'ops-maintenance', icon: Activity,     title: '维保统计',         description: '月度维保次数与维保费用统计',                 category: 'maintenance', status: 'ready',  updatedAt: '2026-05-23', href: '/reports?category=maintenance&report=ops-maintenance' },
  { id: 'ops-retirement',  icon: TrendingUp,   title: '退役处置统计',     description: '月度退役资产数量及处置方式分布',              category: 'maintenance', status: 'pending',updatedAt: '2026-05-22', href: '/reports?category=maintenance&report=ops-retirement' },
  // ── 工单报表 ──
  { id: 'wo-summary',      icon: FileText,     title: '工单完成率',       description: '工单完成率、按时完成率、平均处理时长',         category: 'workorder',   status: 'ready',  updatedAt: '2026-05-23', href: '/reports?category=workorder&report=wo-summary' },
  { id: 'wo-pending',      icon: Activity,     title: '待处理工单',       description: '各部门待处理工单数量与超时工单统计',           category: 'workorder',   status: 'ready',  updatedAt: '2026-05-22', href: '/reports?category=workorder&report=wo-pending' },
];

// ── 状态映射 ──────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<ReportStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  ready:   { label: '已就绪', color: 'text-[#16a34a]', bg: 'bg-green-50',     icon: CheckCircle2 },
  stale:   { label: '待更新', color: 'text-[#d97706]', bg: 'bg-amber-50',     icon: Clock },
  pending: { label: '生成中', color: 'text-[#3b82f6]', bg: 'bg-blue-50',      icon: Activity },
};

export default function ReportCenterPage() {
  const [activeCategory, setActiveCategory] = useState('asset');

  // ── API 查询 ────────────────────────────────────────────────────────────────
  const { data: summaryRes } = useReportSummary();
  const { data: categoryRes } = useReportByCategory();
  const { data: trendRes } = useReportTrend();

  // ── 数据解析 ────────────────────────────────────────────────────────────────
  const summary = summaryRes as unknown as ReportSummary | undefined;
  const categoryData = categoryRes as unknown as CategoryReport[] | undefined ?? [];
  const trendData = trendRes as unknown as ReportTrend[] | undefined ?? [];

  // ── 分类统计摘要 ────────────────────────────────────────────────────────────
  const categoryCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of REPORT_CATEGORIES) {
      map[cat.id] = ALL_REPORTS.filter((r) => r.category === cat.id).length;
    }
    return map;
  }, []);

  // ── 最近趋势摘要 ────────────────────────────────────────────────────────────
  const latestTrend = useMemo(() => {
    if (trendData.length === 0) return null;
    const sorted = [...trendData].sort((a, b) => a.month.localeCompare(b.month));
    return sorted[sorted.length - 1];
  }, [trendData]);

  // ── 导出全部分类概览（模拟） ─────────────────────────────────────────────────
  const handleExport = () => {
    console.log('Exporting report center overview...');
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="报表中心"
        subtitle="预设报表仓库 — 快速导航与数据概览"
        breadcrumbs={[{ label: '仪表板', href: '/dashboard' }, { label: '报表中心' }]}
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/reports"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#3b82f6] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Eye className="w-4 h-4" />
              打开报表中心
            </a>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#16a34a] bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出概览
            </button>
          </div>
        }
      />

      {/* KPI 概览 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* 分类 Tabs + 报表卡片 */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            预设报表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="mb-4">
              {REPORT_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const count = categoryCountMap[cat.id];
                return (
                  <TabsTrigger key={cat.id} value={cat.id} className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {cat.label}
                    <span className="ml-1 rounded-full bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-medium text-[#64748b]">
                      {count}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {REPORT_CATEGORIES.map((cat) => {
              const reports = ALL_REPORTS.filter((r) => r.category === cat.id);
              return (
                <TabsContent key={cat.id} value={cat.id}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {reports.map((report) => {
                      const Icon = report.icon;
                      const statusInfo = STATUS_MAP[report.status];
                      const StatusIcon = statusInfo.icon;
                      const catDef = REPORT_CATEGORIES.find((c) => c.id === report.category);

                      return (
                        <a
                          key={report.id}
                          href={report.href}
                          className={cn(
                            'group relative flex flex-col rounded-xl border bg-white p-5 transition-all duration-200',
                            'hover:shadow-lg hover:-translate-y-0.5',
                            'border-[#e2e8f0] hover:border-[#cbd5e1]',
                          )}
                        >
                          {/* ── 顶部：分类标签 + 状态 ── */}
                          <div className="flex items-center justify-between mb-3">
                            {catDef && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-[11px] font-medium text-[#3b82f6]">
                                <catDef.icon className="w-3 h-3" />
                                {catDef.label}
                              </span>
                            )}
                            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', statusInfo.bg, statusInfo.color)}>
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.label}
                            </span>
                          </div>

                          {/* ── 中部：图标 + 标题 + 描述 ── */}
                          <div className="flex items-start gap-3 mb-4 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-[#eff6ff] flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                              <Icon className="w-5 h-5 text-[#3b82f6]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-[#0f172a] truncate leading-snug">
                                {report.title}
                              </h3>
                              <p className="text-xs text-[#64748b] mt-1 line-clamp-2 leading-relaxed">
                                {report.description}
                              </p>
                            </div>
                          </div>

                          {/* ── 底部：更新时间 + 查看链接 ── */}
                          <div className="flex items-center justify-between pt-3 border-t border-[#f1f5f9]">
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#94a3b8]">
                              <Calendar className="w-3 h-3" />
                              {report.updatedAt}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[#3b82f6] group-hover:gap-1.5 transition-all">
                              查看报表
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* 数据趋势提示 */}
      {latestTrend && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-cyan-500" />
                最近月度数据
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-4">
                <div>
                  <p className="text-xs text-[#94a3b8]">月份</p>
                  <p className="text-lg font-semibold text-[#0f172a]">{latestTrend.month}</p>
                </div>
                <div>
                  <p className="text-xs text-[#94a3b8]">总价值（万元）</p>
                  <p className="text-lg font-semibold text-[#0f172a]">
                    {Math.round(latestTrend.totalValue / 10000).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#94a3b8]">净值（万元）</p>
                  <p className="text-lg font-semibold text-[#0f172a]">
                    {Math.round(latestTrend.netValue / 10000).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <PieChartIcon className="w-4 h-4 text-purple-500" />
                分类概览（Top 5）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...categoryData]
                  .sort((a, b) => b.assetCount - a.assetCount)
                  .slice(0, 5)
                  .map((c, i) => {
                    const maxCount = Math.max(...categoryData.map((x) => x.assetCount), 1);
                    const pct = Math.round((c.assetCount / maxCount) * 100);
                    return (
                      <div key={c.categoryName} className="flex items-center gap-3">
                        <span className="text-xs text-[#64748b] w-20 truncate">{c.categoryName}</span>
                        <div className="flex-1 h-2 rounded-full bg-[#f1f5f9] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#3b82f6] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-[#0f172a] w-10 text-right">{c.assetCount}</span>
                      </div>
                    );
                  })}
                {categoryData.length === 0 && (
                  <p className="text-xs text-[#94a3b8] text-center py-4">暂无分类数据</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 底部说明 */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm leading-6 text-blue-700">
        <strong>报表中心</strong> 提供预设格式的资产数据报表快速导航，支持按分类筛选。
        点击「查看报表」可进入详细图表预览与数据导出页面。
      </div>
    </div>
  );
}
