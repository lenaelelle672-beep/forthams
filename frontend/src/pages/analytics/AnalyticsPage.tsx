/**
 * @file pages/analytics/AnalyticsPage.tsx
 * @description 数据分析页 — 多维数据可视化与洞察
 *
 * 功能：
 * - 4个 KPI 概览卡片
 * - 资产增长趋势（面积图）
 * - 资产分类分布（饼图）
 * - 部门资产价值排行（横向柱图）
 * - 月度处置统计（柱状图）
 * - 关键指标汇总表格
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Package, DollarSign, Activity, BarChart3,
  Calendar, Filter,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getDashboardStats, getAssetValueTrends } from '@/api/asset';
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

// ── 模拟数据（API 不可用时使用）─────────────────────────────────────────────────
const MOCK_TREND = [
  { month: '2025-06', count: 2450, value: 980 },
  { month: '2025-07', count: 2510, value: 1005 },
  { month: '2025-08', count: 2580, value: 1030 },
  { month: '2025-09', count: 2650, value: 1060 },
  { month: '2025-10', count: 2700, value: 1080 },
  { month: '2025-11', count: 2680, value: 1070 },
  { month: '2025-12', count: 2740, value: 1095 },
  { month: '2026-01', count: 2780, value: 1110 },
  { month: '2026-02', count: 2770, value: 1105 },
  { month: '2026-03', count: 2820, value: 1130 },
  { month: '2026-04', count: 2850, value: 1145 },
  { month: '2026-05', count: 2847, value: 1268 },
];

const MOCK_CATEGORY = [
  { name: '电子设备', value: 856 },
  { name: '机械设备', value: 623 },
  { name: '办公家具', value: 412 },
  { name: '运输工具', value: 298 },
  { name: '仪器仪表', value: 234 },
  { name: '其他', value: 424 },
];

const MOCK_DEPT = [
  { name: '信息技术部', value: 4320 },
  { name: '生产制造部', value: 3680 },
  { name: '研发中心',   value: 2950 },
  { name: '行政管理部', value: 2180 },
  { name: '市场销售部', value: 1560 },
  { name: '财务部',     value: 1200 },
  { name: '人力资源部', value: 790 },
];

const MOCK_DISPOSAL_MONTHLY = [
  { month: '12月', transfer: 12, clearance: 5, scrap: 8,  compensation: 2 },
  { month: '1月',  transfer: 15, clearance: 3, scrap: 6,  compensation: 4 },
  { month: '2月',  transfer: 8,  clearance: 7, scrap: 10, compensation: 1 },
  { month: '3月',  transfer: 20, clearance: 4, scrap: 5,  compensation: 3 },
  { month: '4月',  transfer: 18, clearance: 6, scrap: 7,  compensation: 2 },
  { month: '5月',  transfer: 14, clearance: 8, scrap: 9,  compensation: 5 },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('12');

  // 仪表板统计
  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60 * 5,
  });

  // 资产价值趋势
  const { data: trendsRes } = useQuery({
    queryKey: ['dashboard', 'trends', Number(period) * 30],
    queryFn: () => getAssetValueTrends(Number(period) * 30),
    staleTime: 1000 * 60 * 15,
  });

  const stats = (statsRes as any)?.data;
  const trends = (trendsRes as any)?.data ?? [];

  // 趋势图数据
  const trendData = trends.length > 0
    ? trends.slice(-Number(period)).map((t: any) => ({
        month:  t.date?.substring(0, 7) ?? '',
        count:  t.count ?? 0,
        value:  Math.round((t.totalValue ?? 0) / 10000),
      }))
    : MOCK_TREND.slice(-Number(period));

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
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              title="资产总数"
              value={(stats?.totalAssets ?? 2847).toLocaleString() + ' 台'}
              trend={{ value: '月均增长 +2.1%', direction: 'up' }}
              icon={Package}
              iconColor={COLORS.blue}
            />
            <KpiCard
              title="资产总价值"
              value={'¥' + ((stats?.totalValue ?? 12680000) / 10000).toFixed(0) + ' 万'}
              subtitle="净值 ¥924 万"
              icon={DollarSign}
              iconColor={COLORS.green}
            />
            <KpiCard
              title="月度活跃率"
              value="87.6%"
              trend={{ value: '较上月 +1.2%', direction: 'up' }}
              icon={Activity}
              iconColor={COLORS.amber}
            />
            <KpiCard
              title="处置完成率"
              value="92.3%"
              subtitle="本月 24/26 项"
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
              资产增长趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
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
                  name="价值（万元）"
                  stroke={COLORS.blue}
                  strokeWidth={2}
                  fill="url(#colorValue)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="count"
                  name="数量（台）"
                  stroke={COLORS.green}
                  strokeWidth={2}
                  fill="url(#colorCount)"
                />
              </AreaChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={MOCK_CATEGORY}
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {MOCK_CATEGORY.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
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
              部门资产价值排行（万元）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={MOCK_DEPT}
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
                <Bar dataKey="value" fill={COLORS.blue} radius={[0, 4, 4, 0]} name="资产价值（万元）" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 月度处置统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              月度处置统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={MOCK_DISPOSAL_MONTHLY} margin={{ top: 0, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="transfer"     name="转移" stackId="a" fill={COLORS.blue}   />
                <Bar dataKey="clearance"    name="清退" stackId="a" fill={COLORS.green}  />
                <Bar dataKey="scrap"        name="报废" stackId="a" fill={COLORS.amber}  />
                <Bar dataKey="compensation" name="赔偿" stackId="a" fill={COLORS.purple} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 底部说明 */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm leading-6 text-blue-700">
        数据分析模块当前基于 Dashboard 统计 API 与模拟数据。接入完整分析 API 后可进一步扩展数据维度与实时刷新能力。
      </div>
    </div>
  );
}
