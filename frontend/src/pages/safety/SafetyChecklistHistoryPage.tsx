/**
 * @file pages/safety/SafetyChecklistHistoryPage.tsx
 * @description 安全检查历史记录页面 — Design System 重构版
 *
 * 功能：检查执行记录列表、查看详情弹窗（含结果明细）
 * API: safetyApi (listExecutions, getResults)
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { safetyApi } from '../../api/safety';
import {
  Eye, ClipboardList, PlayCircle, CheckCircle2, XCircle, Clock, Loader2,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/Dialog';
import { PageTransition } from '@/components/ui';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const RESULT_BADGE: Record<string, { label: string; className: string; dot: string }> = {
  PASS:        { label: '通过',       className: 'ring-green-200 border-green-200 text-green-700',     dot: 'bg-green-500' },
  FAIL:        { label: '不通过',     className: 'ring-red-200 border-red-200 text-red-700',           dot: 'bg-red-500' },
  CONDITIONAL: { label: '附条件通过', className: 'ring-orange-200 border-orange-200 text-orange-700',  dot: 'bg-orange-500' },
};

const STATUS_BADGE: Record<string, { label: string; className: string; dot: string }> = {
  IN_PROGRESS: { label: '进行中', className: 'ring-blue-200 border-blue-200 text-blue-700', dot: 'bg-blue-500' },
  COMPLETED:   { label: '已完成', className: 'ring-green-200 border-green-200 text-green-700', dot: 'bg-green-500' },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL',         label: '全部' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'COMPLETED',   label: '已完成' },
] as const;

const ITEM_TYPE_LABELS: Record<string, string> = {
  PASS_FAIL: '通过/不通过',
  READING:   '读数',
  PHOTO:     '拍照',
  TEXT:      '文本',
};

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_BADGE[status] || { label: status, className: 'ring-gray-200 border-gray-200 text-gray-600', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${info.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}

function ResultBadge({ result }: { result: string }) {
  const info = RESULT_BADGE[result] || { label: result, className: 'ring-gray-200 border-gray-200 text-gray-600', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${info.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}

// ─── 详情 Dialog ─────────────────────────────────────────────────────────────

interface DetailDialogProps {
  open: boolean;
  execution: any;
  results: any[];
  loading: boolean;
  onClose: () => void;
}

function DetailDialog({ open, execution, results, loading, onClose }: DetailDialogProps) {
  const resultColumns: Column<any>[] = [
    { key: 'itemId', title: '检查项ID', width: 100 },
    {
      key: 'result',
      title: '结果',
      width: 130,
      render: (v) => {
        const r = v as string;
        if (!r) return <span className="text-slate-400">-</span>;
        return <ResultBadge result={r} />;
      },
    },
    {
      key: 'reading',
      title: '读数',
      width: 100,
      render: (v) => <span>{(v as any) ?? '-'}</span>,
    },
    { key: 'note', title: '备注' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>执行详情 #{execution?.id}</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-5">
          {execution && (
            <>
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div>
                  <p className="text-xs font-medium text-slate-400">模板ID</p>
                  <p className="text-sm font-semibold text-slate-700">{execution.templateId}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">资产ID</p>
                  <p className="text-sm font-semibold text-slate-700">{execution.assetId}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">执行人ID</p>
                  <p className="text-sm font-semibold text-slate-700">{execution.executorId}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">执行日期</p>
                  <p className="text-sm font-semibold text-slate-700">{execution.executeDate}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">状态</p>
                  <StatusBadge status={execution.status} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">总体结果</p>
                  {execution.overallResult
                    ? <ResultBadge result={execution.overallResult} />
                    : <span className="text-sm text-slate-400">-</span>}
                </div>
              </div>

              {/* 检查结果明细 */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">检查结果明细</h4>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <DataTable
                    columns={resultColumns}
                    data={results}
                    rowKey="id"
                    compact
                  />
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

const SafetyChecklistHistoryPage: React.FC = () => {
  const [params, setParams] = useState({ pageNum: 1, pageSize: 10 });
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<any>(null);
  const [detailResults, setDetailResults] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['safetyExecutions', params],
    queryFn: () => safetyApi.listExecutions(params),
  });

  const handleViewDetail = async (record: any) => {
    setSelectedExecution(record);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const results = await safetyApi.getResults(record.id);
      setDetailResults((results as any[]) || []);
    } catch (e) {
      setDetailResults([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const executions = (data as any)?.records || (data as any)?.list || [];
  const total = (data as any)?.total || 0;

  // ── 统计 ──────────────────────────────────────────────────────────────────

  const completedCount = executions.filter((e: any) => e.status === 'COMPLETED').length;
  const passCount = executions.filter((e: any) => e.overallResult === 'PASS').length;
  const failCount = executions.filter((e: any) => e.overallResult === 'FAIL').length;

  // ── 客户端过滤（配合服务端分页）────────────────────────────────────────────

  const displayExecutions = statusFilter === 'ALL'
    ? executions
    : executions.filter((e: any) => e.status === statusFilter);

  // ── DataTable 列定义 ──────────────────────────────────────────────────────

  const columns: Column<any>[] = [
    { key: 'id', title: '执行ID', width: 80 },
    { key: 'templateId', title: '模板ID', width: 80 },
    { key: 'assetId', title: '资产ID', width: 80 },
    { key: 'executorId', title: '执行人ID', width: 90 },
    { key: 'executeDate', title: '执行日期', width: 120 },
    {
      key: 'status',
      title: '状态',
      width: 110,
      render: (v) => <StatusBadge status={v as string} />,
    },
    {
      key: 'overallResult',
      title: '总体结果',
      width: 130,
      render: (v) => {
        const r = v as string;
        if (!r) return <span className="text-slate-400">-</span>;
        return <ResultBadge result={r} />;
      },
    },
    {
      key: 'actions',
      title: '操作',
      width: 90,
      align: 'center',
      render: (_v, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleViewDetail(row); }}
          className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors"
          title="查看详情"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <PageTransition>
      <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

          {/* ── 页头 + 统计栏 ────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
            <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--surface-heading)]">
                  安全检查历史
                </h1>
                <p className="mt-1 text-sm text-[var(--surface-muted-text)]">
                  查看安全检查执行记录与结果明细
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/60">
                  <ClipboardList className="h-4.5 w-4.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">全部执行</p>
                  <p className="text-lg font-bold text-slate-900">{total}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-50 to-green-100/60">
                  <CheckCircle2 className="h-4.5 w-4.5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">已完成</p>
                  <p className="text-lg font-bold text-slate-900">{completedCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60">
                  <PlayCircle className="h-4.5 w-4.5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">通过</p>
                  <p className="text-lg font-bold text-emerald-600">{passCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-50 to-red-100/60">
                  <XCircle className="h-4.5 w-4.5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">不通过</p>
                  <p className="text-lg font-bold text-red-600">{failCount}</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 执行记录列表 ────────────────────────────────────────────── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle>执行记录</CardTitle>
            </CardHeader>
            <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2 flex-wrap">
              {STATUS_FILTER_OPTIONS.map((opt) => {
                const active = statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setStatusFilter(opt.value); setParams((p) => ({ ...p, pageNum: 1 })); }}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="p-5">
              <DataTable<any>
                columns={columns}
                data={displayExecutions}
                rowKey="id"
                loading={isLoading}
                pagination={{
                  page: params.pageNum,
                  pageSize: params.pageSize,
                  total,
                  onChange: (page, pageSize) => setParams({ pageNum: page, pageSize }),
                }}
              />
            </div>
          </Card>

          {/* ── 详情弹窗 ────────────────────────────────────────────────── */}
          <DetailDialog
            open={detailOpen}
            execution={selectedExecution}
            results={detailResults}
            loading={detailLoading}
            onClose={() => setDetailOpen(false)}
          />
        </div>
      </div>
    </PageTransition>
  );
};

export default SafetyChecklistHistoryPage;
