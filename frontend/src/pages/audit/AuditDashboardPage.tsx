import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Download,
  CalendarDays,
  ChevronDown,
  ListFilter,
  Bell,
  HelpCircle,
  ClipboardList,
  RefreshCw,
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/utils/cn';
import { getAuditLogs, getAuditStats } from '@/api/audit';
import type { AuditLog } from '@/api/audit';

const DISTRIBUTION_COLORS = ['#3b82f6', '#64748b', '#475569', '#93c5fd', '#f59e0b', '#10b981'];

const OPERATION_TYPE_LABELS: Record<string, string> = {
  LOGIN: '登录',
  INSERT: '新增',
  UPDATE: '更新',
  DELETE: '删除',
  EXPORT: '导出',
  IMPORT: '导入',
  QUERY: '查询',
};

const STATUS_CONFIG = {
  success: { text: '成功', dotColor: 'bg-emerald-500', textColor: 'text-emerald-700', borderColor: 'border-emerald-200', bgColor: 'bg-emerald-50' },
  warning: { text: '警告', dotColor: 'bg-amber-500', textColor: 'text-amber-700', borderColor: 'border-amber-200', bgColor: 'bg-amber-50' },
  error: { text: '失败', dotColor: 'bg-red-500', textColor: 'text-red-700', borderColor: 'border-red-200', bgColor: 'bg-red-50' },
} as const;

/** 根据操作类型关键词返回对应颜色方案 */
function getTypeColor(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes('export') || lower.includes('导出') || lower.includes('fail') || lower.includes('失败') || lower.includes('delete') || lower.includes('删除')) {
    return { typeColor: '#dc2626', typeBg: '#fef2f2', typeBorder: '#fecaca' };
  }
  if (lower.includes('login') || lower.includes('登录')) {
    return { typeColor: '#475569', typeBg: '#f1f5f9', typeBorder: '#e2e8f0' };
  }
  return { typeColor: '#2563eb', typeBg: '#eff6ff', typeBorder: '#bfdbfe' };
}

/** 将操作类型枚举值转换为中文标签 */
function formatOperationType(type: string) {
  return OPERATION_TYPE_LABELS[type] ?? type;
}

/** 根据日志的操作类型和描述判断风险等级 */
function getLogStatus(log: AuditLog): 'success' | 'warning' | 'error' {
  // Map based on operationType keywords indicating failures/warnings
  const type = (log.operationType ?? '').toLowerCase();
  const desc = (log.description ?? '').toLowerCase();
  if (
    type.includes('fail') || type.includes('失败') ||
    type.includes('error') || type.includes('错误') ||
    type.includes('delete') || type.includes('删除') ||
    desc.includes('失败') || desc.includes('error')
  ) {
    return 'error';
  }
  if (
    type.includes('warn') || type.includes('警告') ||
    type.includes('export') || type.includes('导出') ||
    desc.includes('警告')
  ) {
    return 'warning';
  }
  return 'success';
}

/** 将 ISO 时间字符串格式化为中文本地化显示 */
function formatTime(iso: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).replace(/\//g, '-');
  } catch {
    return iso;
  }
}

/** 从操作人姓名中提取首字母缩写 */
function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const PAGE_SIZE = 8;

export default function AuditDashboardPage() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'alerts'>('all');
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  const { startTime, endTime } = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return { startTime: start.toISOString(), endTime: end.toISOString() };
  }, []);

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['audit-stats', startTime, endTime],
    queryFn: () => getAuditStats({ startTime, endTime }),
    staleTime: 30_000,
  });

  const stats = statsRes;
  const totalCount = stats?.totalCount ?? 0;
  const rawTrendData = stats?.trendData ?? [];
  const trendData = useMemo(() => {
    const byDate = new Map(rawTrendData.map((p) => [p.date.slice(0, 10), p.count]));
    const end = new Date(endTime);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(end);
      day.setDate(end.getDate() - (6 - index));
      const key = day.toISOString().slice(0, 10);
      return { date: key, count: byDate.get(key) ?? 0 };
    });
  }, [rawTrendData, endTime]);
  const typeDistribution = stats?.typeDistribution ?? {};
  const rawTopOperators = stats?.topOperators ?? [];
  const topOperators = useMemo(() => {
    const merged = new Map<string, number>();
    rawTopOperators.forEach((item) => {
      const name = item.operatorName || '未知用户';
      merged.set(name, (merged.get(name) ?? 0) + item.count);
    });
    return Array.from(merged, ([operatorName, count]) => ({ operatorName, count }))
      .sort((a, b) => b.count - a.count);
  }, [rawTopOperators]);

  const distEntries = useMemo(() => {
    const entries = Object.entries(typeDistribution);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (total === 0) return [];
    return entries.map(([label, count]) => ({
      label,
      pct: Math.round((count / total) * 100),
      count,
    }));
  }, [typeDistribution]);

  const { data: logsRes, isLoading: logsLoading } = useQuery({
    queryKey: ['audit-logs', search, activeFilter, page, startTime, endTime],
    queryFn: () =>
      getAuditLogs({
        page,
        pageSize: PAGE_SIZE,
        keyword: search || undefined,
        startTime,
        endTime,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const allRecords: AuditLog[] = logsRes?.records ?? [];
  const records = activeFilter === 'alerts'
    ? allRecords.filter((log) => getLogStatus(log) !== 'success')
    : allRecords;
  const totalLogs: number = logsRes?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE));

  const activeUserCount = useMemo(() => {
    const uniqueOperators = new Set(records.map((r) => r.operatorId).filter(Boolean));
    return uniqueOperators.size;
  }, [records]);

  const todayCount = trendData[trendData.length - 1]?.count ?? 0;

  /** 计算当前视图中风险事件（警告+失败）的数量 */
  const riskAlertCount = useMemo(() => {
    return allRecords.filter((r) => getLogStatus(r) !== 'success').length;
  }, [allRecords]);

  /** 计算趋势数据的日均值，用于判定高风险日 */
  const trendAvg = useMemo(() => {
    if (trendData.length === 0) return 0;
    return trendData.reduce((s, p) => s + p.count, 0) / trendData.length;
  }, [trendData]);

  const kpiCards = [
    { label: '总操作数', value: totalCount.toLocaleString(), icon: ClipboardList, gradient: 'from-blue-500 to-blue-600' },
    { label: '今日操作', value: todayCount.toLocaleString(), icon: RefreshCw, gradient: 'from-slate-500 to-slate-600' },
    { label: '活跃用户', value: activeUserCount || topOperators.length, icon: Users, gradient: 'from-indigo-500 to-indigo-600' },
    { label: '风险事件', value: riskAlertCount, icon: AlertTriangle, gradient: 'from-red-500 to-red-600', isAlert: true },
  ];

  /** 趋势图最大值，复用于点坐标和阈值线计算 */
  const trendMaxCount = useMemo(() => Math.max(...trendData.map((p) => p.count), 1), [trendData]);

  const trendPoints = useMemo(() => {
    if (trendData.length === 0) return [];
    const w = 800;
    const h = 200;
    return trendData.map((p, i) => ({
      x: (i / Math.max(trendData.length - 1, 1)) * w,
      y: h - (p.count / trendMaxCount) * (h * 0.8) - h * 0.1,
      count: p.count,
      /** 当日操作量超过均值1.5倍则标记为高风险 */
      isHighRisk: p.count > trendAvg * 1.5,
    }));
  }, [trendData, trendMaxCount, trendAvg]);

  /** 风险阈值线在 SVG 坐标系中的 Y 位置 */
  const riskThresholdY = useMemo(() => {
    if (trendAvg <= 0) return null;
    const threshold = trendAvg * 1.5;
    return 200 - (threshold / trendMaxCount) * 160 - 20;
  }, [trendAvg, trendMaxCount]);

  const trendPath = useMemo(() => {
    if (trendPoints.length === 0) return '';
    return `M${trendPoints.map((p) => `${p.x},${p.y}`).join(' L')}`;
  }, [trendPoints]);

  const trendAreaPath = useMemo(() => {
    if (trendPoints.length === 0) return '';
    return `${trendPath} L800,200 L0,200 Z`;
  }, [trendPath, trendPoints.length]);

  const svgCircle = 2 * Math.PI * 16;
  const distCumulative = useMemo(() => {
    let cum = 0;
    return distEntries.map((d) => {
      const start = cum;
      cum += d.pct;
      return { ...d, offset: start };
    });
  }, [distEntries]);

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ─── 页头 + KPI 统计栏 ─── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900">审计日志</h1>
              <p className="mt-1 text-sm text-slate-500">按最近 7 天汇总操作趋势、风险事件和操作人分布</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-600">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium">最近7天</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
              <div className="relative flex h-9 min-w-[200px] items-center rounded-lg border border-slate-200 bg-white px-3 shadow-sm transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 sm:w-56">
                <Search className="w-4 h-4 text-slate-400 mr-2" />
                <input
                  className="bg-transparent border-none focus:ring-0 text-sm w-full p-0 h-auto placeholder:text-slate-400"
                  placeholder="搜索操作记录..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="primary" size="md" onClick={() => {
                // Export logs as CSV
                const headers = ['时间', '操作人', '操作类型', '描述', 'IP地址'];
                const rows = records.map((log) => [
                  formatTime(log.createdAt),
                  log.operatorName || '',
                  formatOperationType(log.operationType || ''),
                  log.description || '',
                  log.ipAddress || '',
                ]);
                const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `审计日志_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }} className="rounded-lg">
                <Download className="w-4 h-4" />
                导出
              </Button>
              <Bell className="hidden w-8 h-8 p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors sm:block" />
              <HelpCircle className="hidden w-8 h-8 p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors sm:block" />
            </div>
          </div>

          {/* KPI 统计栏 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            {kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="flex items-center gap-3.5 px-6 py-5">
                  <div className={cn(
                    'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm',
                    kpi.gradient,
                  )}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                    <p className={cn(
                      'text-lg font-bold tabular-nums',
                      kpi.isAlert && Number(kpi.value) > 0 ? 'text-red-600' : 'text-slate-900',
                    )}>{kpi.value}</p>
                    <p className="text-xs text-slate-400">最近7天</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── 风险概览横幅：当存在风险事件时显示 ─── */}
        {riskAlertCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 px-5 py-4 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <span className="text-sm font-semibold text-red-700">
              检测到 {riskAlertCount} 条风险事件
            </span>
            <span className="text-xs text-slate-500">— 请关注异常操作记录，建议及时审查</span>
            <button
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => setActiveFilter('alerts')}
            >
              查看详情
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ─── 图谱区域：趋势图 + 类型分布 ─── */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm xl:col-span-2 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-semibold text-slate-900">操作趋势（近7天）</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600" />
                  <span className="text-xs text-slate-500 font-medium">系统日志</span>
                </div>
                {riskThresholdY !== null && (
                  <div className="flex items-center gap-2">
                    <span className="w-6 border-t-2 border-dashed border-red-400" />
                    <span className="text-xs text-red-500 font-medium">风险阈值</span>
                  </div>
                )}
              </div>
            </div>
            <div className="relative flex h-64 items-end justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-b from-white to-blue-50/30 px-4">
              {statsLoading ? (
                <div className="flex items-center justify-center w-full h-full">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                </div>
              ) : trendData.length === 0 ? (
                <div className="flex items-center justify-center w-full h-full text-sm text-slate-400 font-medium">暂无趋势数据</div>
              ) : (
                <>
                  <svg className="absolute inset-0 w-full h-full p-4" preserveAspectRatio="none" viewBox="0 0 800 200">
                    <path d={trendPath} fill="none" stroke="#2563eb" strokeLinecap="round" strokeWidth="3" />
                    <path d={trendAreaPath} fill="url(#auditGrad)" opacity="0.12" />
                    {/* 风险阈值参考线 */}
                    {riskThresholdY !== null && (
                      <line
                        x1="0"
                        y1={riskThresholdY}
                        x2="800"
                        y2={riskThresholdY}
                        stroke="#ef4444"
                        strokeWidth="1.5"
                        strokeDasharray="8 4"
                        opacity="0.5"
                      />
                    )}
                    {trendPoints.map((point, index) => (
                      <circle
                        key={`${trendData[index]?.date}-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={point.count > 0 ? (point.isHighRisk ? 8 : 6) : 3}
                        fill={point.isHighRisk ? '#ef4444' : point.count > 0 ? '#2563eb' : '#cbd5e1'}
                        stroke={point.isHighRisk ? '#fecaca' : '#ffffff'}
                        strokeWidth={point.isHighRisk ? 3 : 2}
                      />
                    ))}
                    <defs>
                      <linearGradient id="auditGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="1" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute bottom-0 left-0 w-full flex justify-between px-8 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {trendData.map((p) => (
                      <span key={p.date} className="text-center">
                        <span className="block">{new Date(p.date).toLocaleDateString('zh-CN', { weekday: 'short' })}</span>
                        <span className="block text-[9px] text-slate-400 font-normal">{p.date.slice(5)}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-6">操作类型分布</h3>
            <div className="flex flex-col items-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" fill="transparent" r="16" stroke="#e2e8f0" strokeWidth="4" />
                  {distCumulative.map((d, i) => (
                    <circle
                      key={d.label}
                      cx="18"
                      cy="18"
                      fill="transparent"
                      r="16"
                      stroke={DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]}
                      strokeDasharray={`${d.pct} 100`}
                      strokeDashoffset={`${-d.offset}`}
                      strokeWidth="4"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-slate-900">{totalCount.toLocaleString()}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">总计</span>
                </div>
              </div>
              <div className="w-full mt-6 space-y-2.5">
                {distEntries.map((d, i) => (
                  <div key={d.label} className="flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] }} />
                      <span className="text-xs font-medium text-slate-600">{formatOperationType(d.label)}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 tabular-nums">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ─── 日志记录区域 ─── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/50 px-6 py-4">
            <h3 className="text-base font-semibold text-slate-900">最近操作</h3>
            <div className="flex items-center gap-3">
              {/* Quick filter pills */}
              <div className="flex gap-1.5">
                <button
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                    activeFilter === 'all'
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                  )}
                  onClick={() => setActiveFilter('all')}
                >
                  全部日志
                </button>
                <button
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                    activeFilter === 'alerts'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                  )}
                  onClick={() => setActiveFilter('alerts')}
                >
                  告警
                </button>
              </div>
              <button
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                  filterOpen
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                )}
                onClick={() => setFilterOpen((v) => !v)}
              >
                <ListFilter className="w-3.5 h-3.5" />
                筛选
              </button>
            </div>
          </div>

          {filterOpen && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-6 py-3">
              <span className="text-xs text-slate-500 font-semibold mr-1">操作类型：</span>
              {Object.keys(typeDistribution).slice(0, 5).map((t) => (
                <button
                  key={t}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  {formatOperationType(t)}
                </button>
              ))}
              {Object.keys(typeDistribution).length === 0 && (
                <span className="text-xs text-slate-400">暂无筛选项</span>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">时间</th>
                  <th className="px-6 py-4">操作人</th>
                  <th className="px-6 py-4">操作类型</th>
                  <th className="px-6 py-4">描述</th>
                  <th className="px-6 py-4">IP地址</th>
                  <th className="px-6 py-4">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500 inline-block" />
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400 font-medium">暂无审计日志</td>
                  </tr>
                ) : (
                  records.map((log) => {
                    const logStatus = getLogStatus(log);
                    const st = STATUS_CONFIG[logStatus];
                    const tc = getTypeColor(log.operationType);
                    /** 根据风险等级设置行样式 */
                    const rowBorderClass =
                      logStatus === 'error' ? 'border-l-[3px] border-l-red-400' :
                      logStatus === 'warning' ? 'border-l-[3px] border-l-amber-400' :
                      'border-l-[3px] border-l-transparent';
                    const rowBgClass =
                      logStatus === 'error' ? 'bg-red-50/30' :
                      logStatus === 'warning' ? 'bg-amber-50/30' :
                      '';
                    return (
                      <tr key={log.id} className={cn('hover:bg-slate-50/50 transition-colors', rowBorderClass, rowBgClass)}>
                        <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{formatTime(log.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold',
                              logStatus === 'error' ? 'bg-red-100 text-red-700' :
                              logStatus === 'warning' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700',
                            )}>
                              {getInitials(log.operatorName)}
                            </div>
                            <span className="text-sm font-semibold text-slate-900">{log.operatorName || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
                            style={{ backgroundColor: tc.typeBg, color: tc.typeColor, borderColor: tc.typeBorder }}
                          >
                            {formatOperationType(log.operationType)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {log.description || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-slate-500">{log.ipAddress || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                            st.bgColor, st.textColor, st.borderColor,
                          )}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', st.dotColor)} />
                            {st.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/30">
            <p className="text-xs text-slate-500 font-medium">
              显示 {totalLogs === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} 到 {Math.min(page * PAGE_SIZE, totalLogs)} 项，共 {totalLogs} 项
            </p>
            <div className="flex items-center gap-1.5">
              <button
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = startPage + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      'w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors',
                      page === p
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
