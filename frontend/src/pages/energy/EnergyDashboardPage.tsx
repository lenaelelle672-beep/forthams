/**
 * @file pages/energy/EnergyDashboardPage.tsx
 * @description 能耗管理仪表盘 — 接入空间×时间联动 + service 化
 *
 * 改造要点：
 * - 顶部接入 LocationCascader + TimeRangeSelector（与 /gis、/floorplans 共享 URL Query）
 * - 数据走 energyService.getDashboard（service 层收敛，去除 res.data||res 反模式）
 * - 拆出 useEnergyDashboard（数据拉取）+ useEnergyAnomalies（异常检测）
 * - 同环比走前端 useMemo 兜底：B5 后端权威化推迟到下一轮
 */
import { useMemo, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import { LineChart, PieChart, BarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { use } from 'echarts/core';
import * as echarts from 'echarts/core';

use([LineChart, PieChart, BarChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

import { PageTransition, ErrorState, EmptyState, SkeletonCard } from '@/components/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TimeRangeSelector } from '@/components/shared/TimeRangeSelector';
import { LocationCascader } from '@/components/shared/LocationCascader';
import { MetricKpiCard } from '@/components/shared/MetricKpiCard';
import { useSpatialTime } from '@/components/shared/SpatialTimeContext';
import { useEnergyDashboard } from './hooks/useEnergyDashboard';
import { useEnergyAnomalies } from './hooks/useEnergyAnomalies';
import { useEnergyCompare } from './hooks/useEnergyCompare';
import { useEnergyAnomaliesAuthority } from './hooks/useEnergyAnomaliesAuthority';
import { useEnergyRanking } from './hooks/useEnergyRanking';
import {
  Zap, Droplets, Flame, Activity, TrendingUp, TrendingDown,
  AlertTriangle, Lightbulb, BarChart3, RefreshCw,
} from 'lucide-react';
import { message } from 'antd';
import { cn } from '@/utils/cn';

type DimensionMode = 'device' | 'area';

const METER_TYPE_LABELS: Record<string, string> = {
  ELECTRICITY: '用电', WATER: '用水', GAS: '用气',
};
const METER_TYPE_COLORS: Record<string, string> = {
  ELECTRICITY: '#f59e0b', WATER: '#3b82f6', GAS: '#ef4444',
};

/* ── 节能建议模板（保留既有） ─────────────────────────────────────────────── */
const SUGGESTION_TEMPLATES: Array<{
  condition: (data: any) => boolean;
  icon: React.ElementType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}> = [
  {
    condition: (d) => (d.byType?.ELECTRICITY || 0) > (d.byType?.WATER || 0) * 2,
    icon: Lightbulb, priority: 'high',
    title: '电力消耗占比偏高',
    description: '建议排查高耗电设备运行时段，考虑峰谷电价优化或错峰运行策略',
  },
  {
    condition: (d) => {
      const vals = Object.values(d.trend || {}) as number[];
      if (vals.length < 2) return false;
      const last = vals[vals.length - 1];
      const prev = vals[vals.length - 2];
      return prev > 0 && last / prev > 1.2;
    },
    icon: TrendingUp, priority: 'high',
    title: '近期能耗增长超过 20%',
    description: '检测到最近时段能耗显著上升，建议排查设备异常或新增负载',
  },
  {
    condition: (d) => {
      const vals = Object.values(d.trend || {}) as number[];
      if (vals.length < 2) return false;
      const last = vals[vals.length - 1];
      const prev = vals[vals.length - 2];
      return prev > 0 && last / prev < 0.8;
    },
    icon: TrendingDown, priority: 'medium',
    title: '能耗持续下降趋势',
    description: '当前节能措施初见成效，建议持续监控并固化有效策略',
  },
  {
    condition: () => true,
    icon: Activity, priority: 'low',
    title: '定期巡检能耗设备',
    description: '建议每月对重点能耗设备进行能效检测，及时发现跑冒滴漏',
  },
];

const EnergyDashboardPage: React.FC = () => {
  const { query, setSpatialTime } = useSpatialTime();
  const [dimension, setDimension] = useState<DimensionMode>('device');

  // 数据拉取
  // periodType='custom' 模式下不传给后端（由 startDate/endDate 决定）
  const { data, isLoading, isError, error, refetch } = useEnergyDashboard({
    locationId: query.locationId,
    startDate: query.startDate,
    endDate: query.endDate,
    periodType:
      query.periodType && query.periodType !== 'custom'
        ? (query.periodType as 'day' | 'week' | 'month' | 'year')
        : undefined,
  });

  // 同环比 — 前端 useMemo 兜底（B5 后端权威化推迟到下一轮）
  const trendChange = useMemo<number | null>(() => {
    if (!data?.trend) return null;
    const vals = Object.values(data.trend).map((v) => Number(v));
    if (vals.length < 2) return null;
    const last = vals[vals.length - 1];
    const prev = vals[vals.length - 2];
    if (prev === 0) return null;
    return ((last - prev) / prev) * 100;
  }, [data]);

  const anomalies = useEnergyAnomalies(
    data?.trend
      ? (Object.fromEntries(
          Object.entries(data.trend).map(([k, v]) => [k, Number(v)] as const),
        ) as Record<string, number>)
      : null,
    { threshold: 1.5, limit: 5 },
  );

  const suggestions = useMemo(
    () => (data ? SUGGESTION_TEMPLATES.filter((t) => t.condition(data)) : []),
    [data],
  );

  const totalConsumption = data
    ? Object.values(data.byType || {}).reduce<number>((a, b) => a + Number(b), 0)
    : 0;
  const electricConsumption = Number(data?.byType?.ELECTRICITY || 0);
  const waterConsumption = Number(data?.byType?.WATER || 0);
  const gasConsumption = Number(data?.byType?.GAS || 0);

  const trendOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#0f172a', fontSize: 12 },
    },
    grid: { left: 56, right: 20, top: 40, bottom: 36 },
    xAxis: {
      type: 'category' as const,
      data: data ? Object.keys(data.trend || {}) : [],
      axisLabel: { fontSize: 11, color: '#64748b' },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    yAxis: {
      type: 'value' as const,
      name: '消耗量 (kWh)',
      nameTextStyle: { fontSize: 11, color: '#64748b' },
      axisLabel: { fontSize: 11, color: '#64748b' },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' as const } },
    },
    series: [
      {
        type: 'line',
        data: data ? Object.values(data.trend || {}) : [],
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#3b82f6', width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.25)' },
              { offset: 1, color: 'rgba(59,130,246,0.02)' },
            ],
          },
        },
        itemStyle: { color: '#3b82f6', borderWidth: 2, borderColor: '#fff' },
      },
    ],
  }), [data]);

  const pieOption = useMemo(() => ({
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} kWh ({d}%)' },
    legend: {
      bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8,
      data: Object.keys(METER_TYPE_LABELS).map((k) => METER_TYPE_LABELS[k]),
      textStyle: { fontSize: 12, color: '#64748b' },
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' }, scaleSize: 6 },
        data: data
          ? Object.entries(data.byType || {}).map(([key, value]) => ({
              name: METER_TYPE_LABELS[key] || key,
              value: Number(value),
              itemStyle: { color: METER_TYPE_COLORS[key] || '#6b7280' },
            }))
          : [],
      },
    ],
  }), [data]);

  const rankOption = useMemo(() => {
    const rankingData = data?.assetRanking ?? [];
    return {
      tooltip: { trigger: 'axis' as const },
      grid: { left: 80, right: 40, top: 16, bottom: 28 },
      xAxis: { type: 'value' as const, name: '消耗量 (kWh)' },
      yAxis: {
        type: 'category' as const,
        data: rankingData.map((r) => (dimension === 'device' ? `设备 #${r.assetId}` : `区域 ${r.assetId}`)),
        axisLabel: { fontSize: 11, color: '#64748b' },
      },
      series: [
        {
          type: 'bar',
          data: rankingData.map((r, i) => ({
            value: Number(r.consumption),
            itemStyle: {
              color: i < 3 ? '#ef4444' : i < 6 ? '#f59e0b' : '#3b82f6',
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: 18,
          label: { show: true, position: 'right' as const, fontSize: 11, color: '#64748b' },
        },
      ],
    };
  }, [data, dimension]);

  /* ── 错误态 ────────────────────────────────────────────────────────────── */
  if (isError) {
    return (
      <PageTransition>
        <ErrorState
          title="加载失败"
          description={error instanceof Error ? error.message : '获取能耗数据失败'}
          onRetry={() => {
            refetch();
            message.error('获取能耗数据失败');
          }}
        />
      </PageTransition>
    );
  }

  if (isLoading && !data) {
    return (
      <PageTransition>
        <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2"><SkeletonCard className="h-80" /></div>
              <SkeletonCard className="h-80" />
            </div>
            <SkeletonCard className="h-80" />
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!data && !isLoading && !isError) {
    return (
      <PageTransition>
        <EmptyState title="暂无能耗数据" description="尚未采集到能耗数据" className="py-16" />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
          {/* ── 页头 + KPI 统计栏 ───────────────────────────────────────── */}
          <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
              <div>
                <h1 className="text-xl font-bold text-slate-900">能耗管理</h1>
                <p className="mt-1 text-sm text-slate-500">能耗监控与数据分析</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                  刷新
                </button>
              </div>
            </div>

            {/* 空间 + 时间筛选 */}
            <div className="flex flex-wrap items-center gap-3 px-6 pb-4 border-t border-slate-100 pt-4">
              <LocationCascader />
              <TimeRangeSelector />
              {query.selectedAssetId != null && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  资产 #{query.selectedAssetId}
                  <button
                    type="button"
                    onClick={() => setSpatialTime({ selectedAssetId: null })}
                    className="text-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <span className="sr-only">移除</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
            </div>

            {/* KPI 统计栏 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
              <div className="flex items-center gap-3.5 px-6 py-5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">总能耗</p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums">{totalConsumption.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">kWh 综合合计</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 px-6 py-5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-sm">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">用电量</p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums">{electricConsumption.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">kWh</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 px-6 py-5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
                  <Droplets className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">用水量</p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums">{waterConsumption.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">m³</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 px-6 py-5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-600 shadow-sm">
                  <Flame className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">用气量</p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums">{gasConsumption.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">m³</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 趋势 + 类型分布 ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm lg:col-span-2">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg shadow-blue-900/5 m-3">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2.5 text-base">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-semibold text-slate-900">能耗趋势</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center h-80 text-slate-400 text-sm font-medium">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      加载中...
                    </div>
                  ) : (
                    <ReactEChartsCore echarts={echarts} option={trendOption} style={{ height: 320 }} />
                  )}
                </CardContent>
              </div>
            </Card>
            <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg shadow-blue-900/5 m-3">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2.5 text-base">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                      <BarChart3 className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="font-semibold text-slate-900">能耗类型分布</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center h-80 text-slate-400 text-sm font-medium">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      加载中...
                    </div>
                  ) : (
                    <ReactEChartsCore echarts={echarts} option={pieOption} style={{ height: 320 }} />
                  )}
                </CardContent>
              </div>
            </Card>
          </div>

          {/* ── 异常耗能告警条 ───────────────────────────────────────────── */}
          {anomalies.length > 0 && (
            <Card className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/80 to-orange-50/50 shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-amber-200/60 px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-sm font-semibold text-amber-800">异常耗能检测</h3>
                <span className="ml-1 text-[10px] font-medium text-amber-500">
                  （前端 1.5σ 兜底，B5 后端权威化待下一轮）
                </span>
              </div>
              <div className="divide-y divide-amber-200/40">
                {anomalies.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-6 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-slate-900 font-medium truncate">{item.period}</span>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="text-sm text-slate-900 font-semibold tabular-nums">{item.value} kWh</span>
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200/50 whitespace-nowrap">
                        +{((item.deviation / (item.expected || 1)) * 100).toFixed(0)}% 偏离均值
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── 排行榜 ──────────────────────────────────────────────────── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg shadow-blue-900/5 m-3">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="flex items-center gap-2.5 text-base">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                      <BarChart3 className="w-4 h-4 text-slate-600" />
                    </div>
                    <span className="font-semibold text-slate-900">能耗排名（前10）</span>
                  </CardTitle>
                  {/* Dimension toggle pills */}
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDimension('device')}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                        dimension === 'device'
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >设备维度</button>
                    <button
                      type="button"
                      onClick={() => setDimension('area')}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                        dimension === 'area'
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >区域维度</button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-80 text-slate-400 text-sm font-medium">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    加载中...
                  </div>
                ) : (
                  <ReactEChartsCore echarts={echarts} option={rankOption} style={{ height: 340 }} />
                )}
              </CardContent>
            </div>
          </Card>

          {/* ── 节能建议 ────────────────────────────────────────────────── */}
          {suggestions.length > 0 && (
            <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
              <CardHeader className="border-b border-slate-100 px-6 py-4">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="font-semibold text-slate-900">节能建议</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {suggestions.map((s, idx) => {
                    const Icon = s.icon;
                    const priorityStyle =
                      s.priority === 'high'
                        ? 'bg-red-50 border-red-200 text-red-700 ring-red-200/50'
                        : s.priority === 'medium'
                          ? 'bg-amber-50 border-amber-200 text-amber-700 ring-amber-200/50'
                          : 'bg-blue-50 border-blue-200 text-blue-700 ring-blue-200/50';
                    const priorityLabel =
                      s.priority === 'high' ? '高优先' : s.priority === 'medium' ? '中优先' : '低优先';

                    return (
                      <div key={idx} className="rounded-xl border border-slate-200/80 bg-white p-4 hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200">
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
                            <Icon className="w-4 h-4 text-slate-500" />
                          </div>
                          <span className="text-sm font-semibold text-slate-900 flex-1 min-w-0 truncate">{s.title}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed mb-3">{s.description}</p>
                        <span className={cn(
                          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                          priorityStyle,
                        )}>
                          {priorityLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default EnergyDashboardPage;
