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
  FileBarChart,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { getAuditLogs, getAuditStats } from '@/api/audit';
import type { AuditLog } from '@/api/audit';

const DISTRIBUTION_COLORS = ['#004191', '#535f74', '#36455a', '#adc6ff', '#d97706', '#16a34a'];

const STATUS_CONFIG = {
  success: { text: '成功', color: '#16a34a' },
  warning: { text: '警告', color: '#d97706' },
  error: { text: '失败', color: '#ba1a1a' },
} as const;

function getTypeColor(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes('export') || lower.includes('导出') || lower.includes('fail') || lower.includes('失败') || lower.includes('delete') || lower.includes('删除')) {
    return { typeColor: '#ba1a1a', typeBg: '#ffdad6' };
  }
  if (lower.includes('login') || lower.includes('登录')) {
    return { typeColor: '#535f74', typeBg: '#d7e3fc' };
  }
  return { typeColor: '#004191', typeBg: '#d8e2ff' };
}

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

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startTime = sevenDaysAgo.toISOString();
  const endTime = now.toISOString();

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['audit-stats', startTime, endTime],
    queryFn: () => getAuditStats({ startTime, endTime }),
    staleTime: 30_000,
  });

  const stats = statsRes?.data;
  const totalCount = stats?.totalCount ?? 0;
  const trendData = stats?.trendData ?? [];
  const typeDistribution = stats?.typeDistribution ?? {};
  const topOperators = stats?.topOperators ?? [];

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
        startTime,
        endTime,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const records: AuditLog[] = logsRes?.data?.records ?? [];
  const totalLogs: number = logsRes?.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE));

  const activeUserCount = useMemo(() => {
    const uniqueOperators = new Set(records.map((r) => r.operatorId).filter(Boolean));
    return uniqueOperators.size;
  }, [records]);

  const kpiCards = [
    { label: '总操作数', value: totalCount.toLocaleString(), icon: ClipboardList, bg: '#d8e2ff', color: '#004191' },
    { label: '趋势数据点', value: trendData.length, icon: RefreshCw, bg: '#d7e3fc', color: '#535f74' },
    { label: '活跃用户', value: activeUserCount || topOperators.length, icon: Users, bg: '#d3e4fe', color: '#36455a' },
    { label: '操作类型', value: Object.keys(typeDistribution).length, icon: FileBarChart, bg: '#ffdad6', color: '#ba1a1a', borderError: true },
  ];

  const trendPath = useMemo(() => {
    if (trendData.length === 0) return '';
    const maxCount = Math.max(...trendData.map((p) => p.count), 1);
    const w = 800;
    const h = 200;
    const points = trendData.map((p, i) => ({
      x: (i / Math.max(trendData.length - 1, 1)) * w,
      y: h - (p.count / maxCount) * (h * 0.8) - h * 0.1,
    }));
    return `M${points.map((p) => `${p.x},${p.y}`).join(' L')}`;
  }, [trendData]);

  const trendAreaPath = useMemo(() => {
    if (trendData.length === 0) return '';
    return `${trendPath} L800,200 L0,200 Z`;
  }, [trendPath, trendData.length]);

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
    <div className="min-h-screen bg-[#f9f9ff]">
      <PageHeader
        title="审计日志"
        breadcrumbs={[{ label: '数据分析' }, { label: '审计日志' }]}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#f1f3ff] px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-sm">
              <CalendarDays className="w-4 h-4 text-[#424753]" />
              <span>最近7天</span>
              <ChevronDown className="w-4 h-4 text-[#424753]" />
            </div>
            <div className="relative flex items-center bg-[#f1f3ff] px-3 py-1.5 rounded-lg border border-[#e5e7eb] w-64">
              <Search className="w-4 h-4 text-[#424753] mr-2" />
              <input
                className="bg-transparent border-none focus:ring-0 text-sm w-full p-0 h-auto placeholder:text-[#727784]"
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
                log.operationType || '',
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
            }}>
              <Download className="w-4 h-4" />
              导出
            </Button>
            <Bell className="w-8 h-8 p-1.5 text-[#424753] hover:bg-[#f1f3ff] rounded-full cursor-pointer transition-colors" />
            <HelpCircle className="w-8 h-8 p-1.5 text-[#424753] hover:bg-[#f1f3ff] rounded-full cursor-pointer transition-colors" />
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-6">
          {kpiCards.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className={`bg-white border p-3 rounded-xl flex items-center gap-4 shadow-sm ${
                  kpi.borderError ? 'border-[#ba1a1a]' : 'border-[#e5e7eb]'
                }`}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: kpi.bg, color: kpi.color }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: kpi.borderError ? '#ba1a1a' : '#424753' }}>
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-bold" style={{ color: kpi.borderError ? '#ba1a1a' : '#161c27' }}>
                    {statsLoading ? '...' : kpi.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <Card className="col-span-2 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-semibold text-[#161c27]">操作趋势（近7天）</h3>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#004191]" />
                <span className="text-xs text-[#424753]">系统日志</span>
              </div>
            </div>
            <div className="h-64 relative flex items-end justify-between gap-4 px-4">
              {statsLoading ? (
                <div className="flex items-center justify-center w-full h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-[#004191]" />
                </div>
              ) : trendData.length === 0 ? (
                <div className="flex items-center justify-center w-full h-full text-sm text-[#64748b]">暂无趋势数据</div>
              ) : (
                <>
                  <svg className="absolute inset-0 w-full h-full p-4" preserveAspectRatio="none" viewBox="0 0 800 200">
                    <path d={trendPath} fill="none" stroke="#004191" strokeLinecap="round" strokeWidth="3" />
                    <path d={trendAreaPath} fill="url(#auditGrad)" opacity="0.1" />
                    <defs>
                      <linearGradient id="auditGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                        <stop offset="0%" stopColor="#004191" stopOpacity="1" />
                        <stop offset="100%" stopColor="#004191" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute bottom-0 left-0 w-full flex justify-between px-8 text-[10px] font-semibold uppercase tracking-wider text-[#424753]">
                    {trendData.map((p) => (
                      <span key={p.date}>{new Date(p.date).toLocaleDateString('zh-CN', { weekday: 'short' })}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-base font-semibold text-[#161c27] mb-6">操作类型分布</h3>
            <div className="flex flex-col items-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" fill="transparent" r="16" stroke="#e9edfe" strokeWidth="4" />
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
                  <span className="text-xl font-bold">{totalCount.toLocaleString()}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#424753]">总计</span>
                </div>
              </div>
              <div className="w-full mt-6 space-y-2">
                {distEntries.map((d, i) => (
                  <div key={d.label} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] }} />
                      <span className="text-xs">{d.label}</span>
                    </div>
                    <span className="text-xs font-semibold">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex justify-between items-center">
            <h3 className="text-base font-semibold text-[#161c27]">最近操作</h3>
            <div className="flex items-center gap-4">
              <div className="flex rounded-lg border border-[#e5e7eb] overflow-hidden">
                <button
                  className={`px-3 py-1.5 text-xs font-semibold border-r border-[#e5e7eb] transition-colors ${
                    activeFilter === 'all' ? 'bg-[#f1f3ff] text-[#004191]' : 'bg-white text-[#424753] hover:bg-[#f1f3ff]'
                  }`}
                  onClick={() => setActiveFilter('all')}
                >
                  全部日志
                </button>
                <button
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    activeFilter === 'alerts' ? 'bg-[#f1f3ff] text-[#004191] font-semibold' : 'bg-white text-[#424753] hover:bg-[#f1f3ff]'
                  }`}
                  onClick={() => setActiveFilter('alerts')}
                >
                  告警
                </button>
              </div>
              <button className={`flex items-center gap-1 text-xs hover:text-[#004191] ${filterOpen ? 'text-[#004191] font-semibold' : 'text-[#424753]'}`} onClick={() => setFilterOpen((v) => !v)}>
                <ListFilter className="w-4 h-4" />
                筛选
              </button>
            </div>
          </div>

          {filterOpen && (
            <div className="px-6 py-3 border-b border-[#e5e7eb] bg-[#f9f9ff] flex items-center gap-4 text-sm">
              <span className="text-xs text-[#424753] font-semibold">操作类型：</span>
              {Object.keys(typeDistribution).slice(0, 5).map((t) => (
                <button key={t} className="px-2 py-0.5 rounded bg-[#d8e2ff] text-[#004191] text-xs hover:bg-[#004191] hover:text-white transition-colors">
                  {t}
                </button>
              ))}
              {Object.keys(typeDistribution).length === 0 && (
                <span className="text-xs text-[#64748b]">暂无筛选项</span>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f1f3ff]/50 text-[10px] font-semibold uppercase tracking-wider text-[#424753]">
                  <th className="px-6 py-4">时间</th>
                  <th className="px-6 py-4">操作人</th>
                  <th className="px-6 py-4">操作类型</th>
                  <th className="px-6 py-4">描述</th>
                  <th className="px-6 py-4">IP地址</th>
                  <th className="px-6 py-4">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {logsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-[#004191] inline-block" />
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-[#64748b]">暂无审计日志</td>
                  </tr>
                ) : (
                  records.map((log) => {
                    const st = STATUS_CONFIG[getLogStatus(log)];
                    const tc = getTypeColor(log.operationType);
                    return (
                      <tr key={log.id} className="hover:bg-[#f1f3ff] transition-colors">
                        <td className="px-6 py-4 text-sm text-[#161c27] whitespace-nowrap">{formatTime(log.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#d4e0f9] flex items-center justify-center text-[#0f1c2e] text-[10px] font-bold">
                              {getInitials(log.operatorName)}
                            </div>
                            <span className="text-sm font-semibold text-[#161c27]">{log.operatorName || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{ backgroundColor: tc.typeBg, color: tc.typeColor, border: `1px solid ${tc.typeColor}33` }}
                          >
                            {log.operationType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#424753]">
                          {log.description || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-[#424753]">{log.ipAddress || '-'}</td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: st.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.color }} />
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

          <div className="px-6 py-4 border-t border-[#e5e7eb] flex justify-between items-center bg-[#f1f3ff]/30">
            <p className="text-xs text-[#424753]">
              显示 {totalLogs === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} 到 {Math.min(page * PAGE_SIZE, totalLogs)} 项，共 {totalLogs} 项
            </p>
            <div className="flex items-center gap-2">
              <button
                className="p-1 hover:bg-[#dee2f2] rounded transition-colors disabled:opacity-30"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = startPage + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold ${
                      page === p ? 'bg-[#004191] text-white' : 'hover:bg-[#dee2f2]'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="p-1 hover:bg-[#dee2f2] rounded transition-colors disabled:opacity-30"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
