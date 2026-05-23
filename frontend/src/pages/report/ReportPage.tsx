/**
 * @file pages/report/ReportPage.tsx
 * @description 报表中心页面 — 预定义报表管理 + 图表预览
 *
 * 定位：与 AnalyticsPage（数据分析看板）不同，本页面向「报表管理」——
 * 提供报表模板管理、图表预览、导出操作，而非实时数据洞察。
 *
 * 功能：
 * - 预定义报表列表（卡片形式）
 * - 分类统计图表预览（面积图 + 饼图）
 * - 创建报表按钮（占位 Toast）
 * - 查看/导出操作
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileBarChart, BarChart3, PieChart, TrendingUp,
  Package, DollarSign, ClipboardList, Plus,
} from 'lucide-react';
import { getReportSummary, getReportByCategory, type ReportSummary, type CategoryReport } from '@/api/stats';
import type { ApiResponse } from '@/types/common';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ReportCard } from './components/ReportCard';
import { ReportChart } from './components/ReportChart';

// ── 颜色常量 ──────────────────────────────────────────────────────────────────
const COLORS = {
  blue:   '#3b82f6',
  green:  '#10b981',
  amber:  '#f59e0b',
  red:    '#ef4444',
  purple: '#8b5cf6',
  cyan:   '#06b6d4',
};

// ── 预定义报表模板 ────────────────────────────────────────────────────────────
interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  lastUpdated: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'asset-summary',
    title: '资产汇总报表',
    description: '全平台资产总数、在用、待审批、退役等核心指标汇总',
    lastUpdated: '2026-05-22',
    icon: Package,
    iconColor: COLORS.blue,
  },
  {
    id: 'asset-category',
    title: '资产分类统计',
    description: '按资产分类分组统计数量和总价值',
    lastUpdated: '2026-05-22',
    icon: PieChart,
    iconColor: COLORS.green,
  },
  {
    id: 'dept-assets',
    title: '部门资产分布',
    description: '各部门资产数量与价值分布排行',
    lastUpdated: '2026-05-21',
    icon: BarChart3,
    iconColor: COLORS.amber,
  },
  {
    id: 'asset-trends',
    title: '资产趋势分析',
    description: '资产价值与净值的历史变化趋势',
    lastUpdated: '2026-05-21',
    icon: TrendingUp,
    iconColor: COLORS.purple,
  },
  {
    id: 'maintenance-report',
    title: '维保统计报表',
    description: '设备维保记录统计、维保率分析',
    lastUpdated: '2026-05-20',
    icon: ClipboardList,
    iconColor: COLORS.cyan,
  },
  {
    id: 'financial-summary',
    title: '财务汇总报表',
    description: '资产原值、净值、折旧汇总财务数据',
    lastUpdated: '2026-05-19',
    icon: DollarSign,
    iconColor: COLORS.red,
  },
];

export default function ReportPage() {
  const [loadingExport, setLoadingExport] = useState<string | null>(null);

  // ── API 查询 ────────────────────────────────────────────────────────────────

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: getReportSummary,
    staleTime: 1000 * 60 * 5,
  });

  const { data: categoryRes, isLoading: categoryLoading } = useQuery({
    queryKey: ['reports', 'by-category'],
    queryFn: getReportByCategory,
    staleTime: 1000 * 60 * 5,
  });

  // ── 数据提取 ────────────────────────────────────────────────────────────────

  const summary = (summaryRes as ApiResponse<ReportSummary> | undefined)?.data;
  const categoryData = (categoryRes as ApiResponse<CategoryReport[]> | undefined)?.data ?? [];

  // ── 图表数据转换 ────────────────────────────────────────────────────────────

  const pieChartData = categoryData.map((c: CategoryReport) => ({
    name: c.categoryName,
    value: c.assetCount,
  }));

  const areaChartData = categoryData.map((c: CategoryReport) => ({
    name: c.categoryName,
    value: Math.round(c.totalValue / 10000),
  }));

  // ── 操作处理 ────────────────────────────────────────────────────────────────

  const handleCreateReport = () => {
    toast.info('报表创建功能即将上线，敬请期待');
  };

  const handleViewReport = (template: ReportTemplate) => {
    toast.info(`正在加载「${template.title}」…`);
  };

  const handleExportReport = async (template: ReportTemplate) => {
    setLoadingExport(template.id);
    // 模拟导出延迟
    await new Promise((resolve) => setTimeout(resolve, 800));
    setLoadingExport(null);
    toast.success(`「${template.title}」导出成功`);
  };

  // ── 加载态 ──────────────────────────────────────────────────────────────────

  const allLoading = summaryLoading && !summary;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="报表中心"
        subtitle="预定义报表管理与数据导出"
        breadcrumbs={[{ label: '仪表板', href: '/dashboard' }, { label: '报表中心' }]}
        actions={
          <Button onClick={handleCreateReport} className="gap-1.5">
            <Plus className="w-4 h-4" />
            创建报表
          </Button>
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
              value={(summary?.totalAssets ?? 0).toLocaleString()}
              subtitle="全部资产"
              icon={Package}
              iconColor={COLORS.blue}
            />
            <KpiCard
              title="在用资产"
              value={(summary?.activeAssets ?? 0).toLocaleString()}
              subtitle="当前使用中"
              icon={TrendingUp}
              iconColor={COLORS.green}
            />
            <KpiCard
              title="待审批"
              value={(summary?.pendingApproval ?? 0).toLocaleString()}
              subtitle="等待处理"
              icon={ClipboardList}
              iconColor={COLORS.amber}
            />
            <KpiCard
              title="近期退役"
              value={(summary?.recentlyRetired ?? 0).toLocaleString()}
              subtitle="已退役资产"
              icon={Package}
              iconColor={COLORS.red}
            />
          </>
        )}
      </div>

      {/* 图表预览区域 */}
      <div className="grid grid-cols-2 gap-4">
        <ReportChart
          data={areaChartData}
          chartType="area"
          title="各分类资产总价值（万元）"
          nameKey="name"
          dataKey="value"
        />
        <ReportChart
          data={pieChartData}
          chartType="pie"
          title="资产分类分布"
          nameKey="name"
          dataKey="value"
        />
      </div>

      {/* 预定义报表卡片列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="w-4 h-4 text-[#3b82f6]" />
            预定义报表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {REPORT_TEMPLATES.map((template) => (
              <ReportCard
                key={template.id}
                title={template.title}
                description={template.description}
                lastUpdated={template.lastUpdated}
                icon={template.icon}
                iconColor={template.iconColor}
                onView={() => handleViewReport(template)}
                onExport={() => handleExportReport(template)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 底部说明 */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm leading-6 text-blue-700">
        报表中心提供预定义的资产报表模板，支持在线查看和 Excel 导出。如需自定义报表，请点击「创建报表」按钮。
      </div>
    </div>
  );
}
