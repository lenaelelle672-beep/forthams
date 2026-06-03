import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectionApi } from '../../api/inspection';
import type { Inspection } from '../../types/inspection';
import { useNavigate } from 'react-router';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Select, SelectItem } from '@/components/ui/Select';
import { message } from 'antd';
import {
  Plus, Search, RotateCcw, Trash2, Download, Loader2, RefreshCw,
  ClipboardList, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

/* ---------- constants ---------- */

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  ANNUAL: '年度检验',
  PERIODIC: '定期检验',
  SPECIAL: '专项检验',
};

const RESULT_BADGE: Record<string, { label: string; dot: string; border: string; bg: string; text: string }> = {
  PASS: {
    label: '通过',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  FAIL: {
    label: '不通过',
    dot: 'bg-red-500',
    border: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-700',
  },
  CONDITIONAL: {
    label: '附条件通过',
    dot: 'bg-amber-500',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
};

const DEFAULT_BADGE = {
  label: '',
  dot: 'bg-slate-400',
  border: 'border-slate-200',
  bg: 'bg-slate-50',
  text: 'text-slate-600',
};

/* ---------- component ---------- */

const InspectionListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [params, setParams] = useState({
    keyword: '',
    inspectionType: undefined as string | undefined,
    result: undefined as string | undefined,
    startDate: undefined as string | undefined,
    endDate: undefined as string | undefined,
    pageNum: 1,
    pageSize: 10,
  });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['inspections', params],
    queryFn: () => inspectionApi.list(params),
  });

  const records: Inspection[] = data?.records || data?.list || [];

  /* ---- debounced search (300ms) ---- */

  useEffect(() => {
    const timer = setTimeout(() => {
      setParams((prev) => {
        if (prev.keyword === searchInput) return prev;
        return { ...prev, keyword: searchInput, pageNum: 1 };
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  /* ---- stats ---- */

  const stats = useMemo(() => {
    const s = { total: records.length, pass: 0, fail: 0, conditional: 0, overdue: 0 };
    records.forEach((r) => {
      if (r.result === 'PASS') s.pass++;
      else if (r.result === 'FAIL') s.fail++;
      else if (r.result === 'CONDITIONAL') s.conditional++;
      if (r.nextInspectionDate && dayjs(r.nextInspectionDate).diff(dayjs(), 'day') < 0) s.overdue++;
    });
    return s;
  }, [records]);

  /* ---- mutations ---- */

  const deleteMutation = useMutation({
    mutationFn: inspectionApi.delete,
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => inspectionApi.delete(id))),
    onSuccess: () => {
      message.success(`成功删除 ${selectedRowKeys.length} 条记录`);
      setSelectedRowKeys([]);
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });

  /* ---- handlers ---- */

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的记录');
      return;
    }
    if (window.confirm(`确定要删除选中的 ${selectedRowKeys.length} 条检验记录吗？`)) {
      batchDeleteMutation.mutate(selectedRowKeys as number[]);
    }
  };

  const handleBatchExport = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要导出的记录');
      return;
    }

    const selectedRecords = records.filter((record: Inspection) =>
      selectedRowKeys.includes(record.id!),
    );

    // 准备导出数据
    const exportData = selectedRecords.map((record: Inspection) => ({
      '检验编号': record.inspectionNo,
      '资产ID': record.assetId,
      '检验类型':
        { ANNUAL: '年度检验', PERIODIC: '定期检验', SPECIAL: '专项检验' }[record.inspectionType] ||
        record.inspectionType,
      '检验日期': record.inspectionDate,
      '下次检验日期': record.nextInspectionDate,
      '检验机构': record.inspectionAgency,
      '检验人': record.inspector,
      '检验结果':
        { PASS: '通过', FAIL: '不通过', CONDITIONAL: '附条件通过' }[record.result] || record.result,
      '备注': record.findings || '',
    }));

    // 创建工作表
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '检验记录');

    // 生成文件名
    const fileName = `检验记录_${dayjs().format('YYYY-MM-DD_HHmmss')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    message.success(`成功导出 ${selectedRowKeys.length} 条记录`);
  };

  const handleCsvExport = () => {
    if (records.length === 0) {
      toast.error('没有可导出的记录');
      return;
    }

    const headers = [
      '检验编号', '资产ID', '检验类型', '检验日期',
      '下次检验日期', '检验机构', '检验人', '检验结果', '备注',
    ];
    const typeMap: Record<string, string> = { ANNUAL: '年度检验', PERIODIC: '定期检验', SPECIAL: '专项检验' };
    const resultMap: Record<string, string> = { PASS: '通过', FAIL: '不通过', CONDITIONAL: '附条件通过' };
    const escape = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;

    const rows = records.map((r: Inspection) =>
      [
        r.inspectionNo, r.assetId, typeMap[r.inspectionType] || r.inspectionType,
        r.inspectionDate, r.nextInspectionDate || '', r.inspectionAgency,
        r.inspector, resultMap[r.result] || r.result, r.findings || '',
      ].map(escape).join(','),
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `检验记录_${dayjs().format('YYYY-MM-DD_HHmmss')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`成功导出 ${records.length} 条 CSV 记录`);
  };

  const handleSearch = () => {
    setParams((prev) => ({ ...prev, keyword: searchInput, pageNum: 1 }));
  };

  const handleReset = () => {
    setSearchInput('');
    setParams({
      keyword: '',
      inspectionType: undefined,
      result: undefined,
      startDate: undefined,
      endDate: undefined,
      pageNum: 1,
      pageSize: 10,
    });
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setParams({ ...params, [field]: value || undefined });
  };

  const handleDelete = (id: number) => {
    if (window.confirm('确定要删除这条检验记录吗？')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allKeys = records.map((r) => r.id!).filter(Boolean);
      setSelectedRowKeys((prev) => {
        const set = new Set([...prev, ...allKeys]);
        return Array.from(set);
      });
    } else {
      const pageIds = new Set(records.map((r) => r.id!));
      setSelectedRowKeys((prev) => prev.filter((k) => !pageIds.has(k as number)));
    }
  };

  const handleRowSelect = (id: number) => {
    setSelectedRowKeys((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id],
    );
  };

  /* ---- quick filter pills (inspection type) ---- */

  const typePills = [
    { key: '', label: '全部类型' },
    { key: 'ANNUAL', label: '年度检验' },
    { key: 'PERIODIC', label: '定期检验' },
    { key: 'SPECIAL', label: '专项检验' },
  ];

  const resultPills = [
    { key: '', label: '全部结果' },
    { key: 'PASS', label: '通过' },
    { key: 'FAIL', label: '不通过' },
    { key: 'CONDITIONAL', label: '附条件通过' },
  ];

  /* ---- columns ---- */

  const allPageSelected =
    records.length > 0 && records.every((r) => selectedRowKeys.includes(r.id!));
  const somePageSelected =
    records.some((r) => selectedRowKeys.includes(r.id!)) && !allPageSelected;

  const columns: Column<Inspection>[] = [
    {
      key: '_select',
      title: '',
      width: 40,
      align: 'center',
      render: (_v, row) => (
        <input
          type="checkbox"
          checked={selectedRowKeys.includes(row.id!)}
          onChange={() => handleRowSelect(row.id!)}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      ),
    },
    { key: 'inspectionNo', title: '检验编号', width: 160 },
    { key: 'assetId', title: '资产ID', width: 100 },
    {
      key: 'inspectionType',
      title: '检验类型',
      width: 120,
      render: (val) => (
        <span className="text-sm">
          {INSPECTION_TYPE_LABELS[val as string] || (val as string)}
        </span>
      ),
    },
    { key: 'inspectionDate', title: '检验日期', width: 120 },
    {
      key: 'nextInspectionDate',
      title: '下次检验',
      width: 180,
      render: (val) => {
        const date = val as string;
        if (!date) return <span className="text-slate-400">-</span>;
        const daysLeft = dayjs(date).diff(dayjs(), 'day');
        if (daysLeft < 0)
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              已过期 {Math.abs(daysLeft)} 天
            </span>
          );
        if (daysLeft <= 30)
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {date}（{daysLeft} 天后）
            </span>
          );
        return <span className="text-sm">{date}</span>;
      },
    },
    { key: 'inspectionAgency', title: '检验机构', width: 160 },
    {
      key: 'result',
      title: '结果',
      width: 130,
      render: (val) => {
        const badge = RESULT_BADGE[val as string] || { ...DEFAULT_BADGE, label: val as string };
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.border} ${badge.bg} ${badge.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        );
      },
    },
    {
      key: '_actions',
      title: '操作',
      width: 180,
      align: 'right',
      render: (_v, row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/inspections/${row.id}`)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
          >
            详情
          </button>
          <button
            onClick={() => navigate(`/inspections/${row.id}/edit`)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => handleDelete(row.id!)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            删除
          </button>
        </div>
      ),
    },
  ];

  /* ---- stat items ---- */

  const statItems = [
    {
      label: '总检验数',
      value: data?.total ?? 0,
      gradient: 'from-blue-500 to-blue-600',
      Icon: ClipboardList,
    },
    {
      label: '通过',
      value: stats.pass,
      gradient: 'from-emerald-500 to-emerald-600',
      Icon: CheckCircle2,
    },
    {
      label: '不通过',
      value: stats.fail,
      gradient: 'from-red-500 to-red-600',
      Icon: XCircle,
    },
    {
      label: '已过期',
      value: stats.overdue,
      gradient: 'from-amber-500 to-amber-600',
      Icon: AlertTriangle,
    },
  ];

  /* ---- render ---- */

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ── Header + Stat Bar ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] shadow-sm">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                <span>INSPECTION MANAGEMENT</span>
              </div>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">检验/年检管理</h2>
              <p className="mt-0.5 text-sm text-slate-500">管理设备检验记录与年检计划</p>
            </div>
            <div className="flex items-center gap-2">
              {isFetching && !isLoading && (
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-cyan-50 border border-cyan-200 px-2.5 text-[11px] font-semibold text-cyan-700">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  刷新中
                </span>
              )}
              <button
                onClick={handleBatchDelete}
                disabled={selectedRowKeys.length === 0 || batchDeleteMutation.isPending}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                批量删除 ({selectedRowKeys.length})
              </button>
              <button
                onClick={handleBatchExport}
                disabled={selectedRowKeys.length === 0}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                批量导出 ({selectedRowKeys.length})
              </button>
              <button
                onClick={() => navigate('/inspections/new')}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                新增检验
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            {statItems.map(({ label, value, gradient, Icon }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-3.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}
                >
                  <Icon className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <p className="text-lg font-bold text-slate-800">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Main Content Card ── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search (debounced) */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="检验编号/检验机构/检验人"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Result select */}
              <Select
                value={params.result || ''}
                onValueChange={(v) =>
                  setParams({ ...params, result: v || undefined, pageNum: 1 })
                }
                placeholder="检验结果"
                className="w-[130px]"
              >
                <SelectItem value="">全部结果</SelectItem>
                <SelectItem value="PASS">通过</SelectItem>
                <SelectItem value="FAIL">不通过</SelectItem>
                <SelectItem value="CONDITIONAL">附条件通过</SelectItem>
              </Select>

              {/* Date range */}
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={params.startDate || ''}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <span className="text-xs text-slate-400">至</span>
                <input
                  type="date"
                  value={params.endDate || ''}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Action buttons */}
              <button
                onClick={handleCsvExport}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                导出 CSV
              </button>
              <button
                onClick={handleReset}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置
              </button>
            </div>

            {/* Quick filter pills - inspection type */}
            <div className="flex flex-wrap items-center gap-2">
              {typePills.map((pill) => (
                <button
                  key={pill.key}
                  onClick={() =>
                    setParams({
                      ...params,
                      inspectionType: pill.key || undefined,
                      pageNum: 1,
                    })
                  }
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    (params.inspectionType || '') === pill.key
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
              <span className="h-4 w-px bg-slate-200 mx-1" />
              {resultPills.map((pill) => (
                <button
                  key={pill.key}
                  onClick={() =>
                    setParams({
                      ...params,
                      result: pill.key || undefined,
                      pageNum: 1,
                    })
                  }
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    (params.result || '') === pill.key
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Select all bar */}
          {records.length > 0 && (
            <div className="flex items-center gap-3 border-b border-slate-50 bg-slate-50/50 px-5 py-2">
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = somePageSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                全选当前页
              </label>
              {selectedRowKeys.length > 0 && (
                <span className="text-xs font-medium text-blue-600">
                  已选 {selectedRowKeys.length} 项
                </span>
              )}
            </div>
          )}

          {/* DataTable */}
          <div className="p-5">
            <DataTable<Inspection>
              columns={columns}
              data={records}
              rowKey="id"
              loading={isLoading}
              pagination={{
                page: params.pageNum,
                pageSize: params.pageSize,
                total: data?.total || 0,
                onChange: (page, pageSize) => setParams({ ...params, pageNum: page, pageSize }),
              }}
              onRowClick={(row) => navigate(`/inspections/${row.id}`)}
              emptyText="暂无检验记录"
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default InspectionListPage;
