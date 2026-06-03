/**
 * @file pages/manufacturers/ManufacturerPage.tsx
 * @description 制造商管理页面 — Design System v2
 *
 * 功能：制造商列表展示、搜索过滤、新增/编辑/删除操作
 * API: 全部通过 @/api/manufacturer 真实 API
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Pencil, Trash2, Factory, CheckCircle, XCircle,
  Filter, X, Download, Loader2, RefreshCw, Globe, Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/Dialog';
import {
  getManufacturers, createManufacturer, updateManufacturer, deleteManufacturer,
  type Manufacturer,
} from '@/api/manufacturer';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

// ─── Status badge helpers ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: number }) {
  const isActive = status === 0;
  const label = isActive ? '正常' : '停用';
  const badgeCls = isActive
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-600/20'
    : 'border-slate-200 bg-slate-50 text-slate-600 ring-slate-500/20';
  const dotCls = isActive ? 'bg-emerald-500' : 'bg-slate-400';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeCls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      {label}
    </span>
  );
}

// ─── Manufacturer Form Dialog ────────────────────────────────────────────────

interface ManufacturerFormDialogProps {
  open: boolean;
  manufacturer: Manufacturer | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Manufacturer>) => void;
}

function ManufacturerFormDialog({ open, manufacturer, submitting, onClose, onSubmit }: ManufacturerFormDialogProps) {
  const [form, setForm] = useState<Partial<Manufacturer>>({});

  React.useEffect(() => {
    if (open) {
      if (manufacturer) {
        setForm({ ...manufacturer });
      } else {
        setForm({ name: '', code: '', contact: '', phone: '', email: '', website: '', country: '', address: '', remark: '' });
      }
    }
  }, [open, manufacturer]);

  const handleChange = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={manufacturer ? '编辑制造商' : '新增制造商'}>
        <DialogHeader>
          <DialogTitle>{manufacturer ? '编辑制造商' : '新增制造商'}</DialogTitle>
          <DialogDescription>
            {manufacturer ? '修改制造商信息并保存' : '填写以下信息以创建新制造商'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="名称 *"
              placeholder="请输入制造商名称"
              value={form.name ?? ''}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
            <Input
              label="编码"
              placeholder="请输入编码"
              value={form.code ?? ''}
              onChange={(e) => handleChange('code', e.target.value)}
            />
            <Input
              label="联系人"
              placeholder="请输入联系人"
              value={form.contact ?? ''}
              onChange={(e) => handleChange('contact', e.target.value)}
            />
            <Input
              label="电话"
              placeholder="请输入电话"
              value={form.phone ?? ''}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
            <Input
              label="邮箱"
              placeholder="请输入邮箱"
              value={form.email ?? ''}
              onChange={(e) => handleChange('email', e.target.value)}
            />
            <Input
              label="官网"
              placeholder="请输入官网"
              value={form.website ?? ''}
              onChange={(e) => handleChange('website', e.target.value)}
            />
            <Input
              label="国家"
              placeholder="请输入国家"
              value={form.country ?? ''}
              onChange={(e) => handleChange('country', e.target.value)}
            />
            <Input
              label="地址"
              placeholder="请输入地址"
              value={form.address ?? ''}
              onChange={(e) => handleChange('address', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">备注</label>
            <textarea
              value={form.remark ?? ''}
              onChange={(e) => handleChange('remark', e.target.value)}
              rows={2}
              placeholder="请输入备注信息"
              className="w-full px-3 py-2 rounded-lg border border-[#e5e7eb] text-sm bg-white transition-all
                focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                placeholder:text-[#94a3b8] resize-none"
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>取消</Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {manufacturer ? '保存修改' : '确认新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ───────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  open: boolean;
  manufacturer: Manufacturer | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ open, manufacturer, deleting, onClose, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open && !!manufacturer} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="确认删除">
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>此操作不可撤销，请确认操作。</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4">
          <p className="text-sm text-[#64748b]">
            确定要删除制造商「
            <span className="font-medium text-[#0f172a]">{manufacturer?.name}</span>」吗？
          </p>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>取消</Button>
          <Button variant="destructive" onClick={onConfirm} loading={deleting}>确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

export default function ManufacturerPage() {
  const queryClient = useQueryClient();
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState<Manufacturer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingManufacturer, setDeletingManufacturer] = useState<Manufacturer | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => { setKeyword(keywordInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['manufacturers', { keyword, statusFilter, page, pageSize }],
    queryFn: () => getManufacturers({ keyword, status: statusFilter, page, pageSize }),
  });

  const records: Manufacturer[] = (data as any)?.records ?? [];
  const total = (data as any)?.total ?? 0;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activeCount = useMemo(() => records.filter((r) => r.status === 0).length, [records]);
  const inactiveCount = useMemo(() => records.filter((r) => r.status === 1).length, [records]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: createManufacturer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      toast.success('创建成功');
      setModalVisible(false);
      setEditRecord(null);
    },
    onError: (e: any) => toast.error(e?.message || '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }: { id: number; data: Manufacturer }) => updateManufacturer(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      toast.success('更新成功');
      setModalVisible(false);
      setEditRecord(null);
    },
    onError: (e: any) => toast.error(e?.message || '更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteManufacturer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      toast.success('删除成功');
      setDeleteDialogOpen(false);
      setDeletingManufacturer(null);
    },
    onError: (e: any) => toast.error(e?.message || '删除失败'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAdd = () => { setEditRecord(null); setModalVisible(true); };
  const handleEdit = (r: Manufacturer) => { setEditRecord(r); setModalVisible(true); };
  const handleOpenDelete = (r: Manufacturer) => { setDeletingManufacturer(r); setDeleteDialogOpen(true); };
  const handleDeleteConfirm = () => { if (deletingManufacturer?.id) deleteMutation.mutate(deletingManufacturer.id); };

  const handleSubmit = (formData: Partial<Manufacturer>) => {
    if (editRecord?.id) updateMutation.mutate({ id: editRecord.id, data: formData as Manufacturer });
    else createMutation.mutate(formData as Manufacturer);
  };

  const submitting = createMutation.isPending || updateMutation.isPending;

  // ── DataTable columns ─────────────────────────────────────────────────────

  const columns: Column<Manufacturer>[] = [
    {
      key: 'name', title: '名称', width: 180,
      render: (v, row) => (
        <div className="min-w-[140px]">
          <span className="text-sm font-semibold text-slate-900">{String(v)}</span>
          {row.code && <div className="mt-0.5 text-xs text-slate-400 font-mono">{row.code}</div>}
        </div>
      ),
    },
    {
      key: 'contact', title: '联系人', width: 120,
      render: (v) => v ? (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{String(v).charAt(0)}</span>
          <span className="text-xs text-slate-600">{String(v)}</span>
        </div>
      ) : <span className="text-xs text-slate-400">—</span>,
    },
    {
      key: 'phone', title: '电话', width: 140,
      render: (v) => v ? (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
          <Phone className="h-3 w-3 text-slate-400" />{String(v)}
        </span>
      ) : <span className="text-xs text-slate-400">—</span>,
    },
    { key: 'country', title: '国家', width: 100,
      render: (v) => <span className="text-xs text-slate-500">{String(v || '—')}</span>,
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      align: 'center',
      render: (v) => <StatusBadge status={v as number} />,
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      align: 'center',
      render: (_v, row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
            title="编辑"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenDelete(row); }}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  // ── Quick filter pill helper ──────────────────────────────────────────────

  const filterPillBase = 'rounded-full border px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors';
  const filterPillActive = 'border-blue-500 bg-blue-600 text-white';
  const filterPillInactive = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50';

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Compact header with stat bar ───────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">制造商管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <Factory className="h-3 w-3" />
                基础数据
              </span>
            </div>
            <Button variant="primary" onClick={handleAdd}>
              <Plus className="w-4 h-4" />
              新增制造商
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-sm">
                <Factory className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">全部制造商</p>
                <p className="text-lg font-bold text-slate-900">{total}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 shadow-sm">
                <CheckCircle className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">正常</p>
                <p className="text-lg font-bold text-slate-900">{activeCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-400 shadow-sm">
                <XCircle className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">停用</p>
                <p className="text-lg font-bold text-slate-900">{inactiveCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-400 shadow-sm">
                <Globe className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">有官网</p>
                <p className="text-lg font-bold text-slate-900">{records.filter((r) => r.website).length}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Main content Card ─────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          {/* Toolbar with gradient */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  <Search className="h-3.5 w-3.5" />
                  制造商列表
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">制造商管理</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={exporting} onClick={async () => {
                  if (exporting) return; setExporting(true);
                  try {
                    const allData = await getManufacturers({ keyword: keyword || undefined, status: statusFilter, page: 1, pageSize: 99999 });
                    const allRecords = (allData as any)?.records ?? [];
                    if (allRecords.length === 0) { toast.info('暂无数据可导出'); return; }
                    const csv = [['名称','编码','联系人','电话','邮箱','国家','状态'].join(','), ...allRecords.map((r: Manufacturer) => [r.name??'', r.code??'', r.contact??'', r.phone??'', r.email??'', r.country??'', r.status===0?'正常':'停用'].join(','))].join('\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob); const link = document.createElement('a');
                    link.href = url; link.download = `manufacturers-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url);
                    toast.success(`已导出 ${allRecords.length} 条`);
                  } catch { toast.error('导出失败'); } finally { setExporting(false); }
                }}>
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {exporting ? '导出中...' : '导出'}
                </Button>
                {isFetching && !isLoading && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    刷新中
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索名称/编码..."
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">状态</span>
                <button onClick={() => { setStatusFilter(undefined); setPage(1); }}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${statusFilter === undefined ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}>
                  全部
                </button>
                <button onClick={() => { setStatusFilter(statusFilter === 0 ? undefined : 0); setPage(1); }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${statusFilter === 0 ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />正常
                  <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${statusFilter === 0 ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{activeCount}</span>
                </button>
                <button onClick={() => { setStatusFilter(statusFilter === 1 ? undefined : 1); setPage(1); }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${statusFilter === 1 ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />停用
                  <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${statusFilter === 1 ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{inactiveCount}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Result summary bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
            <span className="text-xs text-slate-500">
              共 <span className="font-bold text-slate-700">{total}</span> 条记录
              {' · '}本页 <span className="font-bold text-slate-700">{records.length}</span> 条
            </span>
            {keyword && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                "{keyword}"
                <button type="button" className="rounded-full p-0.5 text-blue-400 hover:bg-blue-200 hover:text-blue-700" onClick={() => { setKeywordInput(''); setKeyword(''); setPage(1); }}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          {/* DataTable */}
          <div className="p-4 sm:p-5">
            <DataTable<Manufacturer>
              columns={columns}
              data={records}
              rowKey="id"
              loading={isLoading}
              pagination={{
                page,
                pageSize,
                total,
                onChange: (p) => setPage(p),
              }}
              emptyText="暂无制造商数据，点击「新增制造商」添加"
            />
          </div>
        </section>

        {/* 新增/编辑弹窗 */}
        <ManufacturerFormDialog
          open={modalVisible}
          manufacturer={editRecord}
          submitting={submitting}
          onClose={() => { setModalVisible(false); setEditRecord(null); }}
          onSubmit={handleSubmit}
        />

        {/* 删除确认弹窗 */}
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          manufacturer={deletingManufacturer}
          deleting={deleteMutation.isPending}
          onClose={() => { setDeleteDialogOpen(false); setDeletingManufacturer(null); }}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    </div>
  );
}
