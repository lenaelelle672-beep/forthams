import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import { GaugeChart, PieChart, BarChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { use } from 'echarts/core';
import * as echarts from 'echarts/core';

use([GaugeChart, PieChart, BarChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);
import { PageTransition, ErrorState, EmptyState, SkeletonCard } from '@/components/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { toast } from 'sonner';
import http from '@/utils/http';
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Package,
  ScanSearch,
  RefreshCw,
} from 'lucide-react';

/* ── 类型定义 ─────────────────────────────────────────────────────────────── */
interface ScanRecord {
  id: number;
  scanDate: string;
  totalLicenses: number;
  compliantCount: number;
  overusedCount: number;
  underusedCount: number;
  expiredCount: number;
  complianceRate: number;
  status: string;
  createdAt: string;
}

interface DetailItem {
  id: number;
  scanId: number;
  licenseId: number;
  softwareName: string;
  licenseType: string;
  totalSeats: number;
  usedSeats: number;
  complianceStatus: string;
  riskLevel: string;
  recommendation: string;
  expiryDate?: string;
}

interface DashboardData {
  hasData: boolean;
  complianceRate: number;
  totalLicenses: number;
  compliantCount: number;
  overusedCount: number;
  underusedCount: number;
  expiredCount: number;
  highRiskItems: DetailItem[];
  byLicenseType: Record<string, number>;
  upcomingExpiry?: DetailItem[];
  scanId: number;
  scanDate: string;
}

interface HistoryData {
  records: ScanRecord[];
  total: number;
  current: number;
  size: number;
}

/* ── 状态映射 ─────────────────────────────────────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  COMPLIANT:  { label: '合规',   dot: 'bg-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  OVERUSED:   { label: '超用',   dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  UNDERUSED:  { label: '闲置',   dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  EXPIRED:    { label: '已过期', dot: 'bg-slate-400',   bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200' },
};

const RISK_MAP: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  HIGH:   { label: '高风险', dot: 'bg-red-400',    bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  MEDIUM: { label: '中风险', dot: 'bg-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  LOW:    { label: '低风险', dot: 'bg-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};

const LICENSE_TYPE_LABELS: Record<string, string> = {
  VOLUME:     '批量许可',
  OEM:        'OEM 许可',
  RETAIL:     '零售许可',
  SUBSCRIPTION: '订阅许可',
  ENTERPRISE: '企业许可',
  OPEN:       '开源许可',
  FREE:       '免费许可',
};

const LICENSE_TYPE_COLORS: string[] = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#6b7280',
];

/* ── 工具函数 ─────────────────────────────────────────────────────────────── */
function usageRate(used: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((used / total) * 100);
}

function complianceColor(rate: number): string {
  if (rate >= 90) return '#22c55e';
  if (rate >= 70) return '#f59e0b';
  return '#ef4444';
}

function expiryDays(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/* ── 页面组件 ─────────────────────────────────────────────────────────────── */
const SamDashboardPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  // 详情弹窗
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ── 数据加载 ──────────────────────────────────────────────────────────── */
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await http.get('/sam/dashboard');
      setDashboard(res.data || res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取合规数据失败');
      toast.error('获取合规数据失败');
    }
    setLoading(false);
  }, []);

  const fetchHistory = useCallback(async (page = 1, size = 10) => {
    try {
      const res: any = await http.get('/sam/history', { params: { page, pageSize: size } });
      setHistory(res.data || res);
    } catch {
      // 静默
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchHistory();
  }, [fetchDashboard, fetchHistory]);

  /* ── 触发扫描 ──────────────────────────────────────────────────────────── */
  const handleScan = async () => {
    if (!confirm('确认执行合规扫描？扫描将遍历所有许可证并检查使用情况，期间可能短暂增加数据库负载。')) return;
    setScanning(true);
    try {
      await http.post('/sam/scan');
      toast.success('合规扫描完成');
      await fetchDashboard();
      await fetchHistory();
    } catch (e: any) {
      toast.error(typeof e === 'string' ? e : '扫描执行失败');
    }
    setScanning(false);
  };

  /* ── 查看扫描详情 ──────────────────────────────────────────────────────── */
  const handleViewDetails = async (scanId: number) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const res: any = await http.get(`/sam/${scanId}/details`);
      const data = res.data || res;
      setDetailItems(data.details || []);
    } catch {
      toast.error('获取扫描详情失败');
      setDetailItems([]);
    }
    setDetailLoading(false);
  };

  /* ── 合规率仪表盘图 ────────────────────────────────────────────────── */
  const gaugeOption = useMemo(() => ({
    tooltip: { formatter: '{b}: {c}%' },
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        center: ['50%', '55%'],
        radius: '80%',
        min: 0,
        max: 100,
        splitNumber: 5,
        progress: { show: true, width: 18 },
        axisLine: {
          lineStyle: {
            width: 18,
            color: [
              [0.4, '#ef4444'],
              [0.7, '#f59e0b'],
              [1, '#22c55e'],
            ],
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { itemStyle: { color: 'inherit' } },
        detail: {
          fontSize: 28,
          fontWeight: 'bold',
          formatter: '{value}%',
          offsetCenter: [0, '60%'],
          color: complianceColor(dashboard?.complianceRate ?? 0),
        },
        title: {
          offsetCenter: [0, '40%'],
          fontSize: 14,
          color: '#6b7280',
        },
        data: [{ value: dashboard?.complianceRate ?? 0, name: '合规率' }],
      },
    ],
  }), [dashboard?.complianceRate]);

  /* ── 许可类型分布饼图 ────────────────────────────────────────────────── */
  const pieOption = useMemo(() => {
    const byType = dashboard?.byLicenseType ?? {};
    const entries = Object.entries(byType);
    return {
      tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
      legend: {
        bottom: 0,
        type: 'scroll' as const,
        textStyle: { fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['35%', '60%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: false,
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: 'bold' },
          },
          data: entries.map(([key, value], idx) => ({
            name: LICENSE_TYPE_LABELS[key] || key,
            value,
            itemStyle: { color: LICENSE_TYPE_COLORS[idx % LICENSE_TYPE_COLORS.length] },
          })),
        },
      ],
    };
  }, [dashboard?.byLicenseType]);

  /* ── 席位使用率条形图 ────────────────────────────────────────────────── */
  const usageBarOption = useMemo(() => {
    const items = dashboard?.highRiskItems ?? [];
    if (items.length === 0) {
      return null;
    }
    const top = items.slice(0, 8);
    return {
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `${p.name}<br/>使用率: ${p.value}%`;
        },
      },
      grid: { left: 100, right: 30, top: 10, bottom: 20 },
      xAxis: {
        type: 'value' as const,
        max: 100,
        axisLabel: { formatter: '{value}%', fontSize: 11 },
      },
      yAxis: {
        type: 'category' as const,
        data: top.map(i => i.softwareName.length > 10 ? i.softwareName.slice(0, 10) + '\u2026' : i.softwareName),
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          data: top.map(i => {
            const rate = usageRate(i.usedSeats, i.totalSeats);
            return {
              value: rate,
              itemStyle: {
                color: rate > 100 ? '#ef4444' : rate > 85 ? '#f59e0b' : '#3b82f6',
                borderRadius: [0, 4, 4, 0],
              },
            };
          }),
          barWidth: 14,
        },
      ],
    };
  }, [dashboard?.highRiskItems]);

  /* ── 历史表格列 ────────────────────────────────────────────────────────── */
  const historyColumns: Column<ScanRecord>[] = [
    { key: 'id', title: '扫描ID', width: 80 },
    {
      key: 'scanDate', title: '扫描时间',
      render: (v) => v ? new Date(String(v)).toLocaleString() : '-',
    },
    { key: 'totalLicenses', title: '总许可', width: 80 },
    { key: 'compliantCount', title: '合规', width: 70 },
    { key: 'overusedCount', title: '超用', width: 70 },
    { key: 'underusedCount', title: '闲置', width: 70 },
    { key: 'expiredCount', title: '过期', width: 70 },
    {
      key: 'complianceRate', title: '合规率', width: 90,
      render: (v) => {
        const numV = Number(v);
        const color = numV >= 90 ? 'text-emerald-600' : numV >= 70 ? 'text-amber-600' : 'text-red-600';
        return <span className={`font-semibold ${color}`}>{v != null ? `${numV}%` : '-'}</span>;
      },
    },
    {
      key: 'action', title: '操作', width: 100,
      render: (_v, row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleViewDetails(row.id); }}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          查看详情
        </button>
      ),
    },
  ];

  /* ── 详情弹窗列 ──────────────────────────────────────────────────────── */
  const detailColumns: Column<DetailItem>[] = [
    { key: 'softwareName', title: '软件名称', width: 140 },
    { key: 'licenseType', title: '许可类型', width: 100 },
    { key: 'totalSeats', title: '总席位', width: 70 },
    { key: 'usedSeats', title: '已用席位', width: 80 },
    {
      key: 'usedSeats', title: '使用率', width: 100,
      render: (_v, row) => {
        const rate = usageRate(row.usedSeats, row.totalSeats);
        const color = rate > 100 ? 'text-red-600' : rate > 85 ? 'text-amber-600' : 'text-blue-600';
        const barColor = rate > 100 ? '#ef4444' : rate > 85 ? '#f59e0b' : '#3b82f6';
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: barColor }}
              />
            </div>
            <span className={`text-xs font-medium min-w-[32px] ${color}`}>
              {rate}%
            </span>
          </div>
        );
      },
    },
    {
      key: 'complianceStatus', title: '合规状态', width: 90,
      render: (v) => {
        const info = STATUS_MAP[String(v)];
        if (info) {
          return (
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${info.bg} ${info.text} ${info.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
              {info.label}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {String(v)}
          </span>
        );
      },
    },
    {
      key: 'riskLevel', title: '风险等级', width: 80,
      render: (v) => {
        const info = RISK_MAP[String(v)];
        if (info) {
          return (
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${info.bg} ${info.text} ${info.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
              {info.label}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {String(v)}
          </span>
        );
      },
    },
    {
      key: 'expiryDate', title: '到期', width: 90,
      render: (v) => {
        const days = expiryDays(v as string | undefined);
        if (days === null) return <span className="text-slate-400">-</span>;
        if (days < 0) return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />已过期
          </span>
        );
        if (days <= 30) return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{days}天
          </span>
        );
        if (days <= 90) return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{days}天
          </span>
        );
        return <span className="text-slate-500">{days}天</span>;
      },
    },
    { key: 'recommendation', title: '建议' },
  ];

  /* ── 渲染 ──────────────────────────────────────────────────────────────── */
  const d = dashboard;
  const highRiskItems = d?.highRiskItems ?? [];
  const upcomingExpiry = d?.upcomingExpiry ?? [];

  if (error) {
    return (
      <PageTransition>
        <ErrorState title="加载失败" description={error} onRetry={fetchDashboard} />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Compact header with stat bar ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">SAM 合规管理</h1>
                <p className="text-sm text-[#64748b]">
                  软件许可合规扫描与审计仪表盘
                  {d?.scanDate && (
                    <span className="ml-2 text-slate-400">
                      | 上次扫描: {new Date(d.scanDate).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button onClick={handleScan} disabled={scanning}>
              {scanning ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  扫描中...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <ScanSearch className="w-3.5 h-3.5" />
                  触发合规扫描
                </span>
              )}
            </Button>
          </div>
          {/* Stat bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-slate-100 border-t border-slate-100">
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0f172a]">{d?.totalLicenses ?? 0}</p>
                <p className="text-xs font-medium text-slate-500">总许可数</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{d?.compliantCount ?? 0}</p>
                <p className="text-xs font-medium text-slate-500">合规</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-50 to-red-100/50">
                <AlertOctagon className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{d?.overusedCount ?? 0}</p>
                <p className="text-xs font-medium text-slate-500">超用</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{d?.underusedCount ?? 0}</p>
                <p className="text-xs font-medium text-slate-500">闲置</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50">
                <Clock className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-500">{d?.expiredCount ?? 0}</p>
                <p className="text-xs font-medium text-slate-500">已过期</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 合规率环图 + 许可类型分布 + 使用率柱图 ────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">合规率</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <SkeletonCard className="h-56" />
              ) : (
                <ReactEChartsCore echarts={echarts} option={gaugeOption} style={{ height: 260 }} />
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">许可类型分布</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <SkeletonCard className="h-56" />
              ) : !d?.byLicenseType || Object.keys(d.byLicenseType).length === 0 ? (
                <EmptyState title="暂无数据" description="执行合规扫描后显示许可类型分布" className="h-56" />
              ) : (
                <ReactEChartsCore echarts={echarts} option={pieOption} style={{ height: 260 }} />
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">席位使用率 TOP</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <SkeletonCard className="h-56" />
              ) : !usageBarOption ? (
                <EmptyState title="暂无数据" description="执行合规扫描后显示席位使用率" className="h-56" />
              ) : (
                <ReactEChartsCore echarts={echarts} option={usageBarOption} style={{ height: 260 }} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── 风险告警 ──────────────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-500" />
              风险告警
              {highRiskItems.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  {highRiskItems.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonCard className="h-40" />
            ) : highRiskItems.length === 0 ? (
              <EmptyState title="暂无高风险项" description="所有许可合规运行" className="h-32" />
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {highRiskItems.map((item) => {
                  const rate = usageRate(item.usedSeats, item.totalSeats);
                  const rateColor = rate > 100 ? 'text-red-600' : rate > 85 ? 'text-amber-600' : 'text-blue-600';
                  const barColor = rate > 100 ? '#ef4444' : rate > 85 ? '#f59e0b' : '#3b82f6';
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-red-50/60 rounded-xl border border-red-100"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate text-[#0f172a]">{item.softwareName}</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_MAP[item.complianceStatus]?.bg ?? 'bg-slate-50'} ${STATUS_MAP[item.complianceStatus]?.text ?? 'text-slate-600'} ${STATUS_MAP[item.complianceStatus]?.border ?? 'border-slate-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_MAP[item.complianceStatus]?.dot ?? 'bg-slate-400'}`} />
                            {STATUS_MAP[item.complianceStatus]?.label || item.complianceStatus}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${RISK_MAP[item.riskLevel]?.bg ?? 'bg-slate-50'} ${RISK_MAP[item.riskLevel]?.text ?? 'text-slate-600'} ${RISK_MAP[item.riskLevel]?.border ?? 'border-slate-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${RISK_MAP[item.riskLevel]?.dot ?? 'bg-slate-400'}`} />
                            {RISK_MAP[item.riskLevel]?.label || item.riskLevel}
                          </span>
                          <span className={`text-xs font-medium ${rateColor}`}>
                            使用率 {rate}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-slate-500">
                            席位: {item.usedSeats}/{item.totalSeats ?? '\u221e'}
                          </span>
                          <div className="flex-1 max-w-[120px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: barColor }}
                            />
                          </div>
                          {item.recommendation && (
                            <span className="text-xs text-slate-400 truncate">
                              {item.recommendation}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 到期提醒 ──────────────────────────────────────────────────── */}
        {upcomingExpiry.length > 0 && (
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                到期提醒
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {upcomingExpiry.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {upcomingExpiry.map((item) => {
                  const days = expiryDays(item.expiryDate);
                  const urgent = days !== null && days <= 30;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        urgent
                          ? 'bg-red-50/60 border-red-100'
                          : 'bg-amber-50/60 border-amber-100'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate text-[#0f172a]">{item.softwareName}</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                            urgent
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${urgent ? 'bg-red-400' : 'bg-amber-400'}`} />
                            {days !== null && days >= 0 ? `${days}天后到期` : '已过期'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {item.licenseType} \u00b7 席位 {item.usedSeats}/{item.totalSeats ?? '\u221e'}
                          {item.expiryDate && ` \u00b7 到期日 ${new Date(item.expiryDate).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 扫描历史 ──────────────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">扫描历史</CardTitle>
          </CardHeader>
          <DataTable<ScanRecord>
            columns={historyColumns}
            data={history?.records ?? []}
            loading={loading}
            pagination={{
              page: history?.current ?? 1,
              pageSize: history?.size ?? 10,
              total: history?.total ?? 0,
              onChange: (p, ps) => fetchHistory(p, ps),
            }}
            emptyText="暂无扫描历史"
          />
        </Card>

        {/* ── 扫描详情弹窗 ──────────────────────────────────────────────── */}
        <Dialog open={detailModalOpen} onOpenChange={(isOpen) => { if (!isOpen) setDetailModalOpen(false); }}>
          <DialogContent className="max-w-[1000px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>扫描详情</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-4">
              <DataTable<DetailItem>
                columns={detailColumns}
                data={detailItems}
                loading={detailLoading}
                pagination={detailItems.length > 20 ? { page: 1, pageSize: 20, total: detailItems.length, onChange: () => {} } : undefined}
                emptyText="暂无详情"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
    </PageTransition>
  );
};

export default SamDashboardPage;
