/**
 * @file pages/licenses/SoftwareLicensePage.tsx
 * @description 软件许可证管理页面 — Design System v2
 *
 * 功能：许可证列表展示、搜索过滤、新增/编辑/删除/分配操作
 * API: 全部通过 @/api/license 真实 API
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Pencil, Trash2, User, KeyRound, AlertTriangle, ShieldCheck, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectItem } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Progress } from '@/components/ui/Progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/Dialog';
import {
  getLicenses, getLicenseSummary, getExpiringLicenses, createLicense, updateLicense, deleteLicense, assignLicense,
  type SoftwareLicense,
} from '@/api/license';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<string, string> = { ACTIVE: '有效', EXPIRED: '已到期', SUSPENDED: '暂停' };

const STATUS_DOT_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  EXPIRED: 'bg-red-500',
  SUSPENDED: 'bg-amber-500',
};
const STATUS_BADGE_CLASSES: Record<string, string> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  EXPIRED: 'border-red-200 bg-red-50 text-red-700 ring-red-600/20',
  SUSPENDED: 'border-amber-200 bg-amber-50 text-amber-700 ring-amber-600/20',
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const badgeCls = STATUS_BADGE_CLASSES[status] ?? STATUS_BADGE_CLASSES.ACTIVE;
  const dotCls = STATUS_DOT_CLASSES[status] ?? STATUS_DOT_CLASSES.ACTIVE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeCls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      {label}
    </span>
  );
}

// ─── Seats progress cell ─────────────────────────────────────────────────────

function SeatsCell({ usedSeats, totalSeats }: { usedSeats?: number; totalSeats?: number }) {
  const used = usedSeats ?? 0;
  const total = totalSeats ?? 1;
  const pct = Math.round((used / total) * 100);
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="w-28">
      <div className="text-xs text-slate-500 mb-1">{used}/{total}</div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── License Form Dialog ─────────────────────────────────────────────────────

const LICENSE_TYPES = [
  { value: 'SINGLE_USER', label: '单用户' },
  { value: 'VOLUME', label: '批量' },
  { value: 'CONCURRENT', label: '并发' },
  { value: 'SUBSCRIPTION', label: '订阅' },
];

const EMPTY_LICENSE_FORM: Partial<SoftwareLicense> = {
  licenseName: '',
  manufacturer: '',
  softwareType: '',
  version: '',
  licenseType: undefined,
  totalSeats: undefined,
  purchaseDate: '',
  expiryDate: '',
  purchasePrice: undefined,
  purchaseOrderNo: '',
  remark: '',
};

interface LicenseFormDialogProps {
  open: boolean;
  license: SoftwareLicense | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<SoftwareLicense>) => void;
}

function LicenseFormDialog({ open, license, submitting, onClose, onSubmit }: LicenseFormDialogProps) {
  const [form, setForm] = useState<Partial<SoftwareLicense>>(EMPTY_LICENSE_FORM);

  React.useEffect(() => {
    if (open) {
      if (license) {
        setForm({ ...license });
      } else {
        setForm(EMPTY_LICENSE_FORM);
      }
    }
  }, [open, license]);

  const handleChange = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.licenseName?.trim()) return;
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={license ? '编辑许可证' : '新增许可证'}>
        <DialogHeader>
          <DialogTitle>{license ? '编辑许可证' : '新增许可证'}</DialogTitle>
          <DialogDescription>
            {license ? '修改许可证信息并保存' : '填写以下信息以创建新许可证'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="软件名称 *"
              placeholder="请输入软件名称"
              value={form.licenseName ?? ''}
              onChange={(e) => handleChange('licenseName', e.target.value)}
              required
            />
            <Input
              label="厂商"
              placeholder="请输入厂商"
              value={form.manufacturer ?? ''}
              onChange={(e) => handleChange('manufacturer', e.target.value)}
            />
            <Input
              label="软件类型"
              placeholder="请输入软件类型"
              value={form.softwareType ?? ''}
              onChange={(e) => handleChange('softwareType', e.target.value)}
            />
            <Input
              label="版本"
              placeholder="请输入版本"
              value={form.version ?? ''}
              onChange={(e) => handleChange('version', e.target.value)}
            />
            <Select
              label="授权类型"
              value={form.licenseType ?? ''}
              onValueChange={(v) => handleChange('licenseType', v)}
            >
              {LICENSE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </Select>
            <Input
              label="总席位数"
              type="number"
              placeholder="请输入总席位数"
              value={form.totalSeats ?? ''}
              onChange={(e) => handleChange('totalSeats', e.target.value ? Number(e.target.value) : undefined)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">购买日期</label>
              <input
                type="date"
                value={form.purchaseDate ?? ''}
                onChange={(e) => handleChange('purchaseDate', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white transition-all
                  focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] [color-scheme:light]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">到期日期</label>
              <input
                type="date"
                value={form.expiryDate ?? ''}
                onChange={(e) => handleChange('expiryDate', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white transition-all
                  focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] [color-scheme:light]"
              />
            </div>
            <Input
              label="购买价格"
              type="number"
              placeholder="0.00"
              value={form.purchasePrice ?? ''}
              onChange={(e) => handleChange('purchasePrice', e.target.value ? Number(e.target.value) : undefined)}
              prefix="¥"
            />
            <Input
              label="采购单号"
              placeholder="请输入采购单号"
              value={form.purchaseOrderNo ?? ''}
              onChange={(e) => handleChange('purchaseOrderNo', e.target.value)}
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
            {license ? '保存修改' : '确认新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Dialog ───────────────────────────────────────────────────────────

interface AssignDialogProps {
  open: boolean;
  licenseId: number | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (licenseId: number, data: { assetId?: number; userId?: number; notes?: string }) => void;
}

function AssignDialog({ open, licenseId, submitting, onClose, onSubmit }: AssignDialogProps) {
  const [assetId, setAssetId] = useState('');
  const [userId, setUserId] = useState('');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (open) {
      setAssetId('');
      setUserId('');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (licenseId) {
      onSubmit(licenseId, {
        assetId: assetId ? Number(assetId) : undefined,
        userId: userId ? Number(userId) : undefined,
        notes: notes || undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="分配席位">
        <DialogHeader>
          <DialogTitle>分配席位</DialogTitle>
          <DialogDescription>将许可证席位分配给指定资产或用户</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <Input
            label="资产ID"
            type="number"
            placeholder="请输入资产ID"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          />
          <Input
            label="用户ID"
            type="number"
            placeholder="请输入用户ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">备注</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="请输入备注"
              className="w-full px-3 py-2 rounded-lg border border-[#e5e7eb] text-sm bg-white transition-all
                focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                placeholder:text-[#94a3b8] resize-none"
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>取消</Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>确认分配</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ───────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  open: boolean;
  license: SoftwareLicense | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ open, license, deleting, onClose, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open && !!license} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="确认删除">
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>此操作不可撤销，请确认操作。</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4">
          <p className="text-sm text-[#64748b]">
            确定要删除许可证「
            <span className="font-medium text-[#0f172a]">{license?.licenseName}</span>」吗？
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

export default function SoftwareLicensePage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState<SoftwareLicense | null>(null);
  const [assignLicenseId, setAssignLicenseId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLicense, setDeletingLicense] = useState<SoftwareLicense | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['licenses', { keyword, statusFilter, page }],
    queryFn: () => getLicenses({ keyword, status: statusFilter, page, pageSize: PAGE_SIZE }),
  });

  const { data: summary } = useQuery({ queryKey: ['licenses-summary'], queryFn: getLicenseSummary });
  const { data: expiring } = useQuery({ queryKey: ['licenses-expiring'], queryFn: () => getExpiringLicenses(30) });

  const createMutation = useMutation({
    mutationFn: createLicense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      toast.success('创建成功');
      setModalVisible(false);
      setEditRecord(null);
    },
    onError: (e: any) => toast.error(e?.message || '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }: { id: number; data: SoftwareLicense }) => updateLicense(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      toast.success('更新成功');
      setModalVisible(false);
      setEditRecord(null);
    },
    onError: (e: any) => toast.error(e?.message || '更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLicense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      toast.success('删除成功');
      setDeleteDialogOpen(false);
      setDeletingLicense(null);
    },
    onError: (e: any) => toast.error(e?.message || '删除失败'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, data: payload }: { id: number; data: any }) => assignLicense(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      toast.success('分配成功');
      setAssignModalVisible(false);
      setAssignLicenseId(null);
    },
    onError: (e: any) => toast.error(e?.message || '分配失败'),
  });

  const handleSubmit = (formData: Partial<SoftwareLicense>) => {
    if (editRecord?.id) updateMutation.mutate({ id: editRecord.id, data: formData as SoftwareLicense });
    else createMutation.mutate(formData as SoftwareLicense);
  };

  const handleOpenCreate = () => {
    setEditRecord(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (r: SoftwareLicense) => {
    setEditRecord(r);
    setModalVisible(true);
  };

  const handleOpenAssign = (r: SoftwareLicense) => {
    setAssignLicenseId(r.id!);
    setAssignModalVisible(true);
  };

  const handleOpenDelete = (r: SoftwareLicense) => {
    setDeletingLicense(r);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingLicense?.id) deleteMutation.mutate(deletingLicense.id);
  };

  const summaryData = summary as any;
  const records: SoftwareLicense[] = (data as any)?.records ?? [];
  const total = (data as any)?.total ?? 0;
  const expiringCount = (expiring as any[])?.length ?? 0;

  const submitting = createMutation.isPending || updateMutation.isPending;

  // ── DataTable columns ─────────────────────────────────────────────────────

  const columns: Column<SoftwareLicense>[] = [
    { key: 'licenseName', title: '软件名称', width: 180 },
    { key: 'softwareType', title: '类型', width: 120 },
    { key: 'manufacturer', title: '厂商', width: 140 },
    { key: 'version', title: '版本', width: 100 },
    {
      key: 'usedSeats',
      title: '席位使用',
      width: 140,
      render: (_v, row) => <SeatsCell usedSeats={row.usedSeats} totalSeats={row.totalSeats} />,
    },
    { key: 'expiryDate', title: '到期日期', width: 120 },
    {
      key: 'status',
      title: '状态',
      width: 120,
      align: 'center',
      render: (v) => <StatusBadge status={v as string} />,
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      align: 'center',
      render: (_v, row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenAssign(row); }}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
            title="分配"
          >
            <User className="w-3.5 h-3.5" />
            分配
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenEdit(row); }}
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
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-[#0f172a]">软件许可证管理</h1>
              <p className="mt-0.5 text-sm text-[#64748b]">许可证席位跟踪与到期管理</p>
            </div>
            <Button variant="primary" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              新增许可证
            </Button>
          </div>
          {/* stat bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            <div className="flex items-center gap-3 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-blue-100">
                <KeyRound className="h-4.5 w-4.5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">总许可证</p>
                <p className="text-lg font-bold text-slate-900">{summaryData?.total ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">有效许可证</p>
                <p className="text-lg font-bold text-slate-900">{summaryData?.active ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-50 to-amber-100">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">即将到期(30天)</p>
                <p className="text-lg font-bold text-slate-900">{summaryData?.expiringSoon ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-50 to-red-100">
                <Clock className="h-4.5 w-4.5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">到期预警</p>
                <p className="text-lg font-bold text-slate-900">{expiringCount}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Main content Card ─────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="搜索软件名称/厂商"
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                onKeyDown={(e) => { if (e.key === 'Enter') setPage(1); }}
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-[#e5e7eb] bg-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                  placeholder:text-[#94a3b8]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 mr-1">状态：</span>
              <button
                onClick={() => { setStatusFilter(undefined); setPage(1); }}
                className={`${filterPillBase} ${!statusFilter ? filterPillActive : filterPillInactive}`}
              >
                全部
              </button>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => { setStatusFilter(statusFilter === k ? undefined : k); setPage(1); }}
                  className={`${filterPillBase} ${statusFilter === k ? filterPillActive : filterPillInactive}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* DataTable */}
          <div className="px-6 py-4">
            <DataTable<SoftwareLicense>
              columns={columns}
              data={records}
              rowKey="id"
              loading={isLoading}
              pagination={{
                page,
                pageSize: PAGE_SIZE,
                total,
                onChange: (p) => setPage(p),
              }}
            />
          </div>
        </section>

        {/* 新增/编辑弹窗 */}
        <LicenseFormDialog
          open={modalVisible}
          license={editRecord}
          submitting={submitting}
          onClose={() => { setModalVisible(false); setEditRecord(null); }}
          onSubmit={handleSubmit}
        />

        {/* 分配弹窗 */}
        <AssignDialog
          open={assignModalVisible}
          licenseId={assignLicenseId}
          submitting={assignMutation.isPending}
          onClose={() => { setAssignModalVisible(false); setAssignLicenseId(null); }}
          onSubmit={(id, data) => assignMutation.mutate({ id, data })}
        />

        {/* 删除确认弹窗 */}
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          license={deletingLicense}
          deleting={deleteMutation.isPending}
          onClose={() => { setDeleteDialogOpen(false); setDeletingLicense(null); }}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    </div>
  );
}
