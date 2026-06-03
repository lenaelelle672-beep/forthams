/**
 * @file pages/depreciation/DepreciationListPage.tsx
 * @description 折旧管理页（新 Design System 版本）
 *
 * API 复用 src/app/services/depreciationApi.ts（getDepreciationSchedules, batchCalculateDepreciation）
 * UI 全部按新 Design System 重写。
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingDown,
  Search,
  RefreshCw,
  Calculator,
  Filter,
  X,
  BarChart3,
  Clock,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import {
  getDepreciationSchedules,
  batchCalculateDepreciation,
  getDepreciationMethods,
  PERIOD_REGEX,
} from '@/api/depreciation';
import type {
  DepreciationScheduleItem,
  DepreciationFilter,
  DepreciationMethod,
} from '@/api/depreciation';

// ── 终态资产状态集合（不可计算折旧）────────────────────────────────────────────

const TERMINAL_STATUSES = new Set(['RETIRED', 'SCRAPPED', 'DISPOSED', 'WRITTEN_OFF']);

function isTerminal(status?: string): boolean {
  return !!status && TERMINAL_STATUSES.has(status.toUpperCase());
}

// ── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 安全地将字符串或数字转为数值（后端返回的金额字段可能是字符串）
 */
function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * 格式化金额，保留两位小数并添加人民币符号
 * @param n 金额数值
 * @returns 格式化后的金额字符串，如 ¥12,345.00
 */
function formatAmount(n: number | string): string {
  const num = toNumber(n);
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * 计算资产原值：净值 + 累计折旧
 * @param netValue 当前净值
 * @param accumulatedDepreciation 累计折旧
 * @returns 资产原值
 */
function computeOriginalValue(netValue: number | string, accumulatedDepreciation: number | string): number {
  return toNumber(netValue) + toNumber(accumulatedDepreciation);
}

/**
 * 格式化折旧率百分比
 * @param rate 折旧率（0~1 小数）
 * @returns 百分比字符串，如 "12.34%"
 */
function formatRate(rate: number | string | undefined): string {
  if (rate === undefined || rate === null || rate === '') return '-';
  const num = toNumber(rate);
  return `${(num * 100).toFixed(2)}%`;
}

/**
 * 判断净值是否异常（负值）
 */
function isAbnormalNetValue(netValue: number | string): boolean {
  return toNumber(netValue) < 0;
}

/**
 * 判断折旧率是否异常（超过100%或为负）
 */
function isAbnormalRate(rate: number | string | undefined): boolean {
  if (rate === undefined || rate === null || rate === '') return false;
  const num = toNumber(rate);
  return num > 1 || num < 0;
}

/**
 * 判断原值是否异常（负值或零值，通常表明数据有误）
 */
function isAbnormalOriginalValue(originalValue: number): boolean {
  return originalValue <= 0;
}

function getMethodLabel(method?: string): string {
  if (!method) return '-';
  const map: Record<string, string> = {
    'STRAIGHT_LINE': '直线法',
    'straight_line': '直线法',
    'DOUBLE_DECLINING': '双倍余额递减法',
    'double_declining': '双倍余额递减法',
    'SYD': '年数总和法',
    'syd': '年数总和法',
    'UOP': '工作量法',
    'uop': '工作量法',
  };
  return map[method] ?? method;
}

function getAssetStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    IN_USE:      '在用',
    IDLE:        '闲置',
    MAINTENANCE: '维修中',
    RETIRED:     '已退役',
    SCRAPPED:    '已报废',
    DISPOSED:    '已处置',
    WRITTEN_OFF: '已核销',
  };
  return map[status ?? ''] ?? (status ?? '-');
}

// ── 状态 badge 配色 ─────────────────────────────────────────────────────────

const STATUS_BADGE_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  IN_USE:      { label: '在用',   dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  IDLE:        { label: '闲置',   dot: 'bg-blue-400',    text: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  MAINTENANCE: { label: '维修中', dot: 'bg-amber-400',   text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  RETIRED:     { label: '已退役', dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200' },
  SCRAPPED:    { label: '已报废', dot: 'bg-red-400',     text: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
  DISPOSED:    { label: '已处置', dot: 'bg-orange-400',  text: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  WRITTEN_OFF: { label: '已核销', dot: 'bg-gray-400',    text: 'text-gray-500',    bg: 'bg-gray-50',    border: 'border-gray-200' },
};

// ── 折旧方法快速筛选 pill 配色 ──────────────────────────────────────────────

const METHOD_PILL_CONFIG: Record<string, { label: string; dot: string }> = {
  STRAIGHT_LINE:    { label: '直线法',         dot: 'bg-blue-400' },
  DOUBLE_DECLINING: { label: '双倍余额递减法', dot: 'bg-violet-400' },
  SYD:              { label: '年数总和法',     dot: 'bg-cyan-400' },
  UOP:              { label: '工作量法',       dot: 'bg-teal-400' },
};

// ── Stat card definitions ───────────────────────────────────────────────────

interface StatCardDef {
  label: string;
  value: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

export default function DepreciationListPage() {
  const queryClient = useQueryClient();

  // 筛选状态
  const [assetNoFilter, setAssetNoFilter] = useState('');
  const [periodFilter,  setPeriodFilter]  = useState('');
  const [methodFilter,  setMethodFilter]  = useState('');
  const [periodError,   setPeriodError]   = useState<string | null>(null);

  // 折旧方法列表
  const { data: methods = [] } = useQuery({
    queryKey: ['depreciation-methods'],
    queryFn: getDepreciationMethods,
    staleTime: 1000 * 60 * 10,
  });

  // 分页
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 选择 & 批量
  const [selectedIds,   setSelectedIds]   = useState<number[]>([]);
  const [batchLoading,  setBatchLoading]  = useState(false);
  const [batchConfirm,  setBatchConfirm]  = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── useQuery 数据加载 ──────────────────────────────────────────────────────

  const { data: queryResult, isLoading: loading, isFetching } = useQuery({
    queryKey: ['depreciation-schedules', page, assetNoFilter, periodFilter, methodFilter],
    queryFn: async () => {
      const filters: DepreciationFilter = { page, pageSize };
      if (assetNoFilter) filters.assetNo = assetNoFilter;
      if (periodFilter)  filters.period  = periodFilter;
      if (methodFilter)  filters.method  = methodFilter;
      const res = await getDepreciationSchedules(filters);
      const seenIds = new Set<number>();
      const deduped = res.data.filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });
      return { data: deduped, total: res.total || 0, page: res.page || page };
    },
    staleTime: 1000 * 30,
  });

  const dataSource = queryResult?.data ?? [];
  const total = queryResult?.total ?? 0;

  // ── 防抖筛选 ─────────────────────────────────────────────────────────────

  const handleSearch = useCallback(() => {
    if (periodFilter && !PERIOD_REGEX.test(periodFilter)) {
      setPeriodError('期间格式不正确，请使用 YYYY-MM 格式（如 2024-01）');
      return;
    }
    setPeriodError(null);
    setSelectedIds([]);
    setPage(1);
  }, [periodFilter]);

  const handleReset = useCallback(() => {
    setAssetNoFilter('');
    setPeriodFilter('');
    setMethodFilter('');
    setPeriodError(null);
    setSelectedIds([]);
    setPage(1);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  // ── 行选择 ───────────────────────────────────────────────────────────────

  const isAllSelected = dataSource.length > 0 && selectedIds.length === dataSource.length;

  const toggleAll = () => {
    setSelectedIds(isAllSelected ? [] : dataSource.map(r => r.id));
  };

  const toggleRow = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ── 批量计算 ─────────────────────────────────────────────────────────────

  const handleBatchCalculate = useCallback(async () => {
    if (selectedIds.length === 0) return;

    const terminalRows = dataSource.filter(r => selectedIds.includes(r.id) && isTerminal(r.assetStatus));
    if (terminalRows.length > 0) {
      const nos = terminalRows.map(r => r.assetNo).join(', ');
      setError(`以下资产已报废/退役，不可计算折旧: ${nos}`);
      setBatchConfirm(false);
      return;
    }

    setBatchLoading(true);
    setError(null);
    try {
      const assetIds = Array.from(new Set(
        dataSource.filter(r => selectedIds.includes(r.id)).map(r => r.assetId)
      ));
      await batchCalculateDepreciation({ assetIds });
      setSelectedIds([]);
      setBatchConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['depreciation-schedules'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量计算失败');
      setBatchConfirm(false);
    } finally {
      setBatchLoading(false);
    }
  }, [selectedIds, dataSource, queryClient]);

  // ── 统计 ─────────────────────────────────────────────────────────────────

  const totalDepreciation = dataSource.reduce((sum, r) => sum + toNumber(r.depreciationAmount), 0);
  const pendingCount      = dataSource.filter(r => !isTerminal(r.assetStatus)).length;
  const completedCount    = dataSource.filter(r => isTerminal(r.assetStatus)).length;
  const straightCount     = dataSource.filter(r => r.depreciationMethod === 'STRAIGHT_LINE' || r.depreciationMethod === 'straight_line').length;
  const doubleCount       = dataSource.filter(r => r.depreciationMethod === 'DOUBLE_DECLINING' || r.depreciationMethod === 'double_declining').length;
  const sydCount          = dataSource.filter(r => r.depreciationMethod === 'SYD' || r.depreciationMethod === 'syd').length;
  const uopCount          = dataSource.filter(r => r.depreciationMethod === 'UOP' || r.depreciationMethod === 'uop').length;

  // ── Stat cards ───────────────────────────────────────────────────────────

  const statCards: StatCardDef[] = useMemo(() => [
    {
      label: '本月折旧总额',
      value: formatAmount(totalDepreciation),
      unit: '',
      icon: BarChart3,
      gradient: 'from-blue-600 to-cyan-500',
    },
    {
      label: '待计算资产',
      value: `${pendingCount}`,
      unit: '项',
      icon: Clock,
      gradient: 'from-amber-500 to-orange-400',
    },
    {
      label: '已完成',
      value: `${completedCount}`,
      unit: '项',
      icon: CheckCircle2,
      gradient: 'from-emerald-500 to-teal-400',
    },
    {
      label: `${methods.length} 种方法可用`,
      value: `直线${straightCount} / 双倍${doubleCount}`,
      unit: `/ SYD${sydCount} / UOP${uopCount}`,
      icon: Layers,
      gradient: 'from-violet-500 to-purple-400',
    },
  ], [totalDepreciation, pendingCount, completedCount, straightCount, doubleCount, sydCount, uopCount, methods.length]);

  // ── Quick-filter pill handler ────────────────────────────────────────────

  const handleMethodPill = useCallback((code: string) => {
    setMethodFilter(prev => prev === code ? '' : code);
    setPage(1);
  }, []);

  // ── Active filter chips ──────────────────────────────────────────────────

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clearFn: () => void }[] = [];
    if (assetNoFilter) chips.push({ key: 'assetNo', label: `编号: ${assetNoFilter}`, clearFn: () => { setAssetNoFilter(''); setPage(1); } });
    if (periodFilter)  chips.push({ key: 'period',  label: `期间: ${periodFilter}`,  clearFn: () => { setPeriodFilter(''); setPage(1); } });
    if (methodFilter) {
      const mLabel = getMethodLabel(methodFilter);
      chips.push({ key: 'method', label: `方法: ${mLabel}`, clearFn: () => { setMethodFilter(''); setPage(1); } });
    }
    return chips;
  }, [assetNoFilter, periodFilter, methodFilter]);

  // ── DataTable columns ────────────────────────────────────────────────────

  const columns: Column<DepreciationScheduleItem>[] = useMemo(() => [
    {
      key: '_select',
      title: '',
      width: 44,
      render: (_v, row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => toggleRow(row.id)}
          disabled={isTerminal(row.assetStatus)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
        />
      ),
    },
    {
      key: 'assetNo',
      title: '资产编号',
      width: 130,
      render: (v) => (
        <span className="font-mono text-xs font-semibold text-blue-600">#{String(v)}</span>
      ),
    },
    {
      key: 'assetName',
      title: '资产名称',
      render: (_v, row) => (
        <div className="min-w-[160px]">
          <span className="text-sm font-semibold text-slate-900">{row.assetName}</span>
          <div className="mt-0.5 text-xs text-slate-400">{row.period}</div>
        </div>
      ),
    },
    {
      key: 'depreciationMethod',
      title: '折旧方法',
      width: 130,
      render: (v) => {
        const method = String(v ?? '');
        const pillCfg = METHOD_PILL_CONFIG[method] ?? METHOD_PILL_CONFIG[method.toLowerCase()];
        if (!pillCfg) return <span className="text-xs text-slate-400">{getMethodLabel(method) || '-'}</span>;
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-slate-100">
            <span className={`h-1.5 w-1.5 rounded-full ${pillCfg.dot}`} />
            {pillCfg.label}
          </span>
        );
      },
    },
    {
      key: '_originalValue',
      title: '原值',
      width: 120,
      align: 'right',
      render: (_v, row) => {
        const ov = computeOriginalValue(row.netValue, row.accumulatedDepreciation);
        return isAbnormalOriginalValue(ov) ? (
          <span className="font-mono text-xs text-red-500">
            {formatAmount(ov)}
            <span className="ml-1 text-[10px] text-red-400" title="原值异常：非正值">!</span>
          </span>
        ) : (
          <span className="font-mono text-xs text-slate-500">{formatAmount(ov)}</span>
        );
      },
    },
    {
      key: 'depreciationAmount',
      title: '当期折旧',
      width: 120,
      align: 'right',
      render: (v) => (
        <span className="font-mono text-xs font-semibold text-blue-700">{formatAmount(v as number)}</span>
      ),
    },
    {
      key: 'accumulatedDepreciation',
      title: '累计折旧',
      width: 120,
      align: 'right',
      render: (v) => (
        <span className="font-mono text-xs text-slate-600">{formatAmount(v as number)}</span>
      ),
    },
    {
      key: 'netValue',
      title: '净值',
      width: 120,
      align: 'right',
      render: (v) => {
        const abnormal = isAbnormalNetValue(v as number);
        return (
          <span className={`font-mono text-xs font-semibold ${abnormal ? 'text-red-600' : 'text-slate-900'}`}>
            {formatAmount(v as number)}
            {abnormal && <span className="ml-1 text-[10px] text-red-500" title="净值异常：负值">!</span>}
          </span>
        );
      },
    },
    {
      key: 'depreciationRate',
      title: '折旧率',
      width: 90,
      align: 'right',
      render: (v) => {
        const abnormal = isAbnormalRate(v as number | undefined);
        return (
          <span className={`font-mono text-xs ${abnormal ? 'font-bold text-red-600' : 'text-slate-700'}`}>
            {formatRate(v as number | undefined)}
            {abnormal && <span className="ml-1 text-[10px] text-red-500" title="折旧率异常：超出0~100%范围">!</span>}
          </span>
        );
      },
    },
    {
      key: 'assetStatus',
      title: '状态',
      width: 100,
      render: (v) => {
        const statusStr = String(v ?? '');
        const cfg = STATUS_BADGE_CONFIG[statusStr];
        if (!cfg) return <span className="text-xs text-slate-400">{getAssetStatusLabel(statusStr)}</span>;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        );
      },
    },
  ], [selectedIds]);

  // ── Footer summary row ──────────────────────────────────────────────────

  const summaryOriginal = dataSource.reduce((s, r) => s + computeOriginalValue(r.netValue, r.accumulatedDepreciation), 0);
  const summaryDepreciation = totalDepreciation;
  const summaryAccumulated = dataSource.reduce((s, r) => s + toNumber(r.accumulatedDepreciation), 0);
  const summaryNet = dataSource.reduce((s, r) => s + toNumber(r.netValue), 0);

  // ── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Header + stat bar ──────────────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">折旧管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <TrendingDown className="h-3 w-3" />
                折旧
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['depreciation-schedules'] })}
              >
                <RefreshCw className="w-4 h-4" />
                刷新
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={selectedIds.length === 0 || batchLoading}
                onClick={() => setBatchConfirm(true)}
              >
                <Calculator className="w-4 h-4" />
                {batchLoading ? '计算中...' : '批量计算折旧'}
                {selectedIds.length > 0 && (
                  <span className="ml-1 rounded-full bg-white/20 px-2 py-0 text-[11px] font-bold">{selectedIds.length}</span>
                )}
              </Button>
            </div>
          </div>

          {/* Stat bar */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 sm:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3 px-5 py-3">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stat.gradient} shadow-sm`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">{stat.label}</p>
                    <p className="text-lg font-bold text-slate-900">
                      {stat.value}
                      {stat.unit && <span className="ml-0.5 text-xs font-medium text-slate-400">{stat.unit}</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Main content card ──────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">

          {/* Toolbar */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  <Search className="h-3.5 w-3.5" />
                  折旧计划
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  资产折旧计划管理
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isFetching && !loading && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    刷新中
                  </span>
                )}
              </div>
            </div>

            {/* Search inputs row */}
            <div className="mb-3 flex flex-wrap items-end gap-3">
              {/* Asset No */}
              <div className="relative w-52">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索资产编号..."
                  value={assetNoFilter}
                  onChange={e => setAssetNoFilter(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Period */}
              <div className="flex flex-col gap-0.5">
                <input
                  type="month"
                  placeholder="YYYY-MM"
                  value={periodFilter}
                  onChange={e => { setPeriodFilter(e.target.value); if (periodError) setPeriodError(null); }}
                  onKeyDown={handleKeyDown}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                {periodError && <p className="text-[11px] text-red-500">{periodError}</p>}
              </div>

              <Button variant="primary" size="sm" onClick={handleSearch}>
                <Search className="w-3.5 h-3.5" />
                查询
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RefreshCw className="w-3.5 h-3.5" />
                重置
              </Button>
            </div>

            {/* Quick filter pills — depreciation methods */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setMethodFilter(''); setPage(1); }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  !methodFilter
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                全部方法
                <span className={`ml-1 rounded-full px-1.5 py-0 text-[10px] ${
                  !methodFilter ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {dataSource.length}
                </span>
              </button>
              {Object.entries(METHOD_PILL_CONFIG).map(([code, cfg]) => {
                const active = methodFilter === code;
                const count =
                  code === 'STRAIGHT_LINE' ? straightCount :
                  code === 'DOUBLE_DECLINING' ? doubleCount :
                  code === 'SYD' ? sydCount :
                  code === 'UOP' ? uopCount : 0;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleMethodPill(code)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                    <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Result summary bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
            {activeFilterChips.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Filter className="h-3 w-3" />
                {activeFilterChips.length} 项筛选
              </span>
            )}
            <span className="text-xs text-slate-500">
              共 <span className="font-bold text-slate-700">{total}</span> 条记录
              {' · '}本页 <span className="font-bold text-slate-700">{dataSource.length}</span> 条
            </span>
            {selectedIds.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                已选 {selectedIds.length} 条
              </span>
            )}
            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFilterChips.map((chip) => (
                  <span key={chip.key} className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                    {chip.label}
                    <button type="button" className="rounded-full p-0.5 text-blue-400 hover:bg-blue-200 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); chip.clearFn(); }}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {error}
              <button type="button" className="ml-auto rounded-full p-0.5 text-red-400 hover:bg-red-200 hover:text-red-700" onClick={() => setError(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Select-all bar above table */}
          {!loading && dataSource.length > 0 && (
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-500">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                全选当页
              </label>
            </div>
          )}

          {/* DataTable */}
          <div className="p-4 sm:p-5">
            <DataTable
              columns={columns}
              data={dataSource}
              loading={loading}
              rowKey="id"
              pagination={{
                page,
                pageSize,
                total,
                onChange: (p) => setPage(p),
              }}
              emptyText="暂无折旧计划数据"
            />
          </div>

          {/* Summary footer */}
          {!loading && dataSource.length > 0 && (
            <div className="grid grid-cols-4 divide-x divide-slate-100 border-t border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-3">
              <div className="px-3">
                <p className="text-[11px] font-medium text-slate-400">原值合计</p>
                <p className="font-mono text-sm font-semibold text-slate-600">{formatAmount(summaryOriginal)}</p>
              </div>
              <div className="px-3">
                <p className="text-[11px] font-medium text-slate-400">当期折旧合计</p>
                <p className="font-mono text-sm font-semibold text-blue-700">{formatAmount(summaryDepreciation)}</p>
              </div>
              <div className="px-3">
                <p className="text-[11px] font-medium text-slate-400">累计折旧合计</p>
                <p className="font-mono text-sm font-semibold text-slate-600">{formatAmount(summaryAccumulated)}</p>
              </div>
              <div className="px-3">
                <p className="text-[11px] font-medium text-slate-400">净值合计</p>
                <p className="font-mono text-sm font-semibold text-slate-900">{formatAmount(summaryNet)}</p>
              </div>
            </div>
          )}
        </Card>

        {/* ── Batch confirm dialog ───────────────────────────────────────── */}
        {batchConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-sm rounded-2xl bg-white shadow-xl">
              <div className="px-6 py-5">
                <h3 className="text-base font-semibold text-slate-900">确认批量计算折旧</h3>
                <p className="mt-2 text-sm text-slate-600">
                  将对已选择的{' '}
                  <span className="font-semibold text-blue-600">{selectedIds.length}</span>{' '}
                  条记录执行折旧计算，此操作不可撤销。确认继续？
                </p>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <Button variant="outline" size="sm" onClick={() => setBatchConfirm(false)} disabled={batchLoading}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleBatchCalculate}
                  disabled={batchLoading}
                >
                  {batchLoading ? '计算中...' : '确认计算'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
