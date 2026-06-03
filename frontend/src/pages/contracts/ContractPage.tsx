/**
 * @file pages/contracts/ContractPage.tsx
 * @description 合同管理页面 — Design System v2
 *
 * 功能：合同列表展示、搜索过滤、到期预警、新增/编辑/删除操作
 * API: 全部通过 @/api/contract 真实 API
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Pencil, Trash2, RefreshCw, FileText, CheckCircle, AlertTriangle, Calendar, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectItem } from '@/components/ui/Select';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { ErrorState, EmptyState } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/Dialog';
import {
  getContracts, getExpiringContracts, createContract, updateContract, deleteContract,
  type Contract,
} from '@/api/contract';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const CONTRACT_TYPES = ['MAINTENANCE', 'PURCHASE', 'LEASE', 'SERVICE'];
const CONTRACT_TYPE_LABELS: Record<string, string> = {
  MAINTENANCE: '维保合同',
  PURCHASE: '采购合同',
  LEASE: '租赁合同',
  SERVICE: '服务合同',
};
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '生效中',
  DRAFT: '草稿',
  EXPIRED: '已到期',
  CANCELLED: '已取消',
};
const CURRENCY_OPTIONS = ['CNY', 'USD'];

const EMPTY_FORM: Omit<Contract, 'id'> = {
  contractName: '',
  contractNo: '',
  contractType: '',
  status: '',
  amount: undefined,
  currency: 'CNY',
  startDate: '',
  endDate: '',
  remark: '',
};

// ─── Status badge helpers ────────────────────────────────────────────────────

const STATUS_DOT_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  DRAFT: 'bg-slate-400',
  EXPIRED: 'bg-red-500',
  CANCELLED: 'bg-slate-400',
};
const STATUS_BADGE_CLASSES: Record<string, string> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-600 ring-slate-500/20',
  EXPIRED: 'border-red-200 bg-red-50 text-red-700 ring-red-600/20',
  CANCELLED: 'border-slate-200 bg-slate-50 text-slate-600 ring-slate-500/20',
};
const TYPE_BADGE_CLASSES: Record<string, string> = {
  MAINTENANCE: 'border-blue-200 bg-blue-50 text-blue-700 ring-blue-600/20',
  PURCHASE: 'border-slate-200 bg-slate-50 text-slate-700 ring-slate-500/20',
  LEASE: 'border-purple-200 bg-purple-50 text-purple-700 ring-purple-600/20',
  SERVICE: 'border-gray-200 bg-gray-50 text-gray-600 ring-gray-500/20',
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const badgeCls = STATUS_BADGE_CLASSES[status] ?? STATUS_BADGE_CLASSES.DRAFT;
  const dotCls = STATUS_DOT_CLASSES[status] ?? STATUS_DOT_CLASSES.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeCls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      {label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const label = CONTRACT_TYPE_LABELS[type] ?? type;
  const badgeCls = TYPE_BADGE_CLASSES[type] ?? TYPE_BADGE_CLASSES.SERVICE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeCls}`}>
      {label}
    </span>
  );
}

// ─── 辅助函数 ────────────────────────────────────────────────────────────────

/** 根据到期日期返回到期预警标签 */
function getExpiryLabel(endDate?: string): { text: string; className: string } | null {
  if (!endDate) return null;
  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: '已过期', className: 'text-gray-400' };
  if (diffDays <= 30) return { text: '即将到期', className: 'text-red-600 font-medium' };
  if (diffDays <= 60) return { text: '即将到期', className: 'text-orange-500 font-medium' };
  return null;
}

/** 渲染到期日期列（含预警标签） */
function EndDateCell({ endDate }: { endDate?: string }) {
  if (!endDate) return <span>—</span>;
  const label = getExpiryLabel(endDate);
  if (!label) return <span>{endDate}</span>;

  const bgClass = label.className.includes('red')
    ? 'bg-red-50 text-red-600'
    : label.className.includes('orange')
      ? 'bg-orange-50 text-orange-600'
      : 'bg-gray-50 text-gray-400';

  return (
    <span className={label.className}>
      {endDate}
      <span className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs ${bgClass}`}>
        {label.text}
      </span>
    </span>
  );
}

// ─── 时间轴视图组件 ──────────────────────────────────────────────────────────

const DOT_COLORS: Record<string, string> = {
  ACTIVE: 'ring-[#10b981] bg-[#10b981]',
  EXPIRED: 'ring-[#ef4444] bg-[#ef4444]',
  DRAFT: 'ring-[#94a3b8] bg-[#94a3b8]',
  CANCELLED: 'ring-[#94a3b8] bg-[#94a3b8]',
};

function ContractTimeline({ contracts }: { contracts: Contract[] }) {
  const sorted = [...contracts]
    .filter((c) => c.endDate)
    .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime());

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="暂无时间线数据"
        description="当前没有可用于时间轴视图的合同数据"
        className="py-12"
      />
    );
  }

  return (
    <div className="relative space-y-6">
      {/* 左侧竖线 */}
      <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-[#e5e7eb]" />

      {sorted.map((contract) => {
        const dotColor = DOT_COLORS[contract.status] ?? 'ring-[#94a3b8] bg-[#94a3b8]';
        const expiryLabel = getExpiryLabel(contract.endDate);
        const amount = contract.amount ? `¥${contract.amount.toLocaleString()}` : null;

        return (
          <div key={contract.id} className="relative flex items-start">
            {/* 圆点 */}
            <div
              className={`absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-white ring-2 ${dotColor} z-10`}
            />

            {/* 内容区域 */}
            <div className="ml-6 flex-1">
              {/* 时间标签 */}
              <div className="text-xs font-medium text-[#64748b] mb-2">{contract.endDate}</div>

              {/* 内容卡片 */}
              <div className="bg-white rounded-lg border border-[#e5e7eb] p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[#0f172a] truncate">{contract.contractName}</div>
                    {contract.contractNo && (
                      <div className="text-xs text-[#94a3b8] font-mono mt-0.5">{contract.contractNo}</div>
                    )}
                  </div>
                  {expiryLabel && (
                    <span className={`text-xs font-medium flex-shrink-0 ml-2 ${expiryLabel.className}`}>
                      {expiryLabel.text}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <TypeBadge type={contract.contractType} />
                  <StatusBadge status={contract.status} />
                </div>

                {amount && (
                  <div className="text-sm text-[#374151] mb-1">{amount}</div>
                )}

                {(contract.startDate || contract.endDate) && (
                  <div className="text-xs text-[#94a3b8] flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{contract.startDate ?? '—'} → {contract.endDate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 表单弹窗 ────────────────────────────────────────────────────────────────

interface ContractFormDialogProps {
  open: boolean;
  contract: Contract | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: Contract) => void;
}

function ContractFormDialog({ open, contract, submitting, onClose, onSubmit }: ContractFormDialogProps) {
  const [form, setForm] = useState<Omit<Contract, 'id'>>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      if (contract) {
        setForm({
          contractName: contract.contractName ?? '',
          contractNo: contract.contractNo ?? '',
          contractType: contract.contractType ?? '',
          status: contract.status ?? '',
          amount: contract.amount,
          currency: contract.currency ?? 'CNY',
          startDate: contract.startDate ?? '',
          endDate: contract.endDate ?? '',
          remark: contract.remark ?? '',
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
    }
  }, [open, contract]);

  const handleChange = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.contractName?.trim()) newErrors.contractName = '请输入合同名称';
    if (!form.contractType) newErrors.contractType = '请选择合同类型';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit(form as Contract);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={contract ? '编辑合同' : '新增合同'}>
        <DialogHeader>
          <DialogTitle>{contract ? '编辑合同' : '新增合同'}</DialogTitle>
          <DialogDescription>
            {contract ? '修改合同信息并保存' : '填写以下信息以创建新合同'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="合同名称 *"
              placeholder="请输入合同名称"
              value={form.contractName ?? ''}
              onChange={(e) => handleChange('contractName', e.target.value)}
              error={errors.contractName}
              required
            />
            <Input
              label="合同编号"
              placeholder="如 C001"
              value={form.contractNo ?? ''}
              onChange={(e) => handleChange('contractNo', e.target.value)}
            />
            <Select
              label="合同类型 *"
              value={form.contractType}
              onValueChange={(v) => handleChange('contractType', v)}
              error={errors.contractType}
            >
              {CONTRACT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CONTRACT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </Select>
            <Select label="状态" value={form.status} onValueChange={(v) => handleChange('status', v)}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </Select>
            <Input
              label="金额"
              type="number"
              placeholder="0.00"
              value={form.amount ?? ''}
              onChange={(e) => handleChange('amount', e.target.value ? Number(e.target.value) : undefined)}
              prefix="¥"
            />
            <Select
              label="货币"
              value={form.currency ?? 'CNY'}
              onValueChange={(v) => handleChange('currency', v)}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </Select>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">开始日期</label>
              <input
                type="date"
                value={form.startDate ?? ''}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white transition-all
                  focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                  [color-scheme:light]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">到期日期</label>
              <input
                type="date"
                value={form.endDate ?? ''}
                onChange={(e) => handleChange('endDate', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white transition-all
                  focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                  [color-scheme:light]"
              />
            </div>
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
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button type="submit" variant="primary" loading={submitting} onClick={handleSubmit}>
            {contract ? '保存修改' : '确认新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 删除确认弹窗 ────────────────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  open: boolean;
  contract: Contract | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ open, contract, deleting, onClose, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open && !!contract} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="确认删除">
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>此操作不可撤销，请确认操作。</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4">
          <p className="text-sm text-[#64748b]">
            确定要删除合同「
            <span className="font-medium text-[#0f172a]">{contract?.contractName}</span>」吗？此操作不可撤销。
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>
            取消
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} loading={deleting}>
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

export default function ContractPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState<Contract | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContract, setDeletingContract] = useState<Contract | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // ── 查询 ──────────────────────────────────────────────────────────────────

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['contracts', { keyword, typeFilter, statusFilter, page }],
    queryFn: () => getContracts({ keyword, contractType: typeFilter, status: statusFilter, page, pageSize: PAGE_SIZE }),
  });

  const { data: expiringData } = useQuery({
    queryKey: ['contracts-expiring'],
    queryFn: () => getExpiringContracts(30),
  });

  const contracts: Contract[] = (data as any)?.records ?? [];
  const total = (data as any)?.total ?? 0;
  const expiringList: Contract[] = (expiringData ?? []) as Contract[];

  // ── 统计 ──────────────────────────────────────────────────────────────────

  const activeCount = contracts.filter((c) => c.status === 'ACTIVE').length;
  const thisMonthExpiringCount = expiringList.filter((c) => {
    if (!c.endDate) return false;
    const end = new Date(c.endDate);
    const now = new Date();
    return end.getFullYear() === now.getFullYear() && end.getMonth() === now.getMonth();
  }).length;

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: createContract,
    onSuccess: () => {
      toast.success('合同创建成功');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setModalVisible(false);
      setEditRecord(null);
    },
    onError: (e: any) => toast.error(e?.message || '创建合同失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }: { id: number; data: Contract }) => updateContract(id, payload),
    onSuccess: () => {
      toast.success('合同更新成功');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setModalVisible(false);
      setEditRecord(null);
    },
    onError: (e: any) => toast.error(e?.message || '更新合同失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContract,
    onSuccess: () => {
      toast.success('合同删除成功');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setDeleteDialogOpen(false);
      setDeletingContract(null);
    },
    onError: (e: any) => toast.error(e?.message || '删除合同失败'),
  });

  // ── 处理函数 ──────────────────────────────────────────────────────────────

  const handleSubmit = (formData: Contract) => {
    if (editRecord?.id) {
      updateMutation.mutate({ id: editRecord.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (r: Contract) => {
    setEditRecord(r);
    setModalVisible(true);
  };

  const handleOpenCreate = () => {
    setEditRecord(null);
    setModalVisible(true);
  };

  const handleOpenDelete = (r: Contract) => {
    setDeletingContract(r);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingContract?.id) {
      deleteMutation.mutate(deletingContract.id);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    queryClient.invalidateQueries({ queryKey: ['contracts-expiring'] });
  };

  // ── DataTable 列定义 ──────────────────────────────────────────────────────

  const columns: Column<Contract>[] = [
    { key: 'contractNo', title: '合同编号', width: 140 },
    { key: 'contractName', title: '合同名称', width: 200 },
    {
      key: 'contractType',
      title: '类型',
      width: 120,
      render: (v) => <TypeBadge type={v as string} />,
    },
    {
      key: 'amount',
      title: '金额',
      width: 120,
      align: 'right',
      render: (v) => {
        const amount = v as number | undefined;
        return amount ? `¥${amount.toLocaleString()}` : '-';
      },
    },
    { key: 'startDate', title: '开始日期', width: 120 },
    {
      key: 'endDate',
      title: '到期日期',
      width: 180,
      render: (v) => <EndDateCell endDate={v as string | undefined} />,
    },
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
      width: 100,
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

  const submitting = createMutation.isPending || updateMutation.isPending;

  // ── Quick filter pill helper ──────────────────────────────────────────────

  const filterPillBase = 'rounded-full border px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors';
  const filterPillActive = 'border-blue-500 bg-blue-600 text-white';
  const filterPillInactive = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50';

  return (
    <ErrorBoundary>
      <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

          {/* ── Compact header with stat bar ───────────────────────────────── */}
          <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
            <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg font-semibold text-[#0f172a]">合同管理</h1>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600 ring-1 ring-inset ring-blue-100">
                    合同
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-[#64748b]">合同信息维护与到期预警</p>
              </div>
              <Button variant="primary" onClick={handleOpenCreate}>
                <Plus className="w-4 h-4" />
                新增合同
              </Button>
            </div>
            {/* stat bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
              <div className="flex items-center gap-3 px-6 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500">
                  <FileText className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">全部合同</p>
                  <p className="text-lg font-bold text-slate-900">{total}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400">
                  <CheckCircle className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">生效中</p>
                  <p className="text-lg font-bold text-slate-900">{activeCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-400">
                  <AlertTriangle className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">本月到期</p>
                  <p className="text-lg font-bold text-slate-900">{thisMonthExpiringCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-400">
                  <Clock className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">30天内到期</p>
                  <p className="text-lg font-bold text-slate-900">{expiringList.length}</p>
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
                  placeholder="搜索合同名称/编号"
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                  className="w-full h-9 pl-9 pr-4 rounded-lg border border-[#e5e7eb] bg-white text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                    placeholder:text-[#94a3b8]"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setTypeFilter(undefined); setPage(1); }}
                  className={`${filterPillBase} ${!typeFilter ? filterPillActive : filterPillInactive}`}
                >
                  全部类型
                </button>
                {CONTRACT_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTypeFilter(typeFilter === t ? undefined : t); setPage(1); }}
                    className={`${filterPillBase} ${typeFilter === t ? filterPillActive : filterPillInactive}`}
                  >
                    {CONTRACT_TYPE_LABELS[t]}
                  </button>
                ))}
                <button
                  onClick={handleRefresh}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors ml-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  刷新
                </button>
              </div>
            </div>

            {/* Quick status filter pills */}
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-2.5">
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

            {/* Tab 切换 + Table */}
            <div className="px-6 py-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">全部合同</TabsTrigger>
                  <TabsTrigger value="expiring">
                    即将到期 ({expiringList.length})
                  </TabsTrigger>
                  <TabsTrigger value="timeline">
                    时间轴视图
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all">
                  {isError ? (
                    <ErrorState
                      title="加载失败"
                      description={(error as any)?.message || '获取合同列表失败'}
                      onRetry={() => queryClient.invalidateQueries({ queryKey: ['contracts'] })}
                    />
                  ) : (
                    <DataTable<Contract>
                      columns={columns}
                      data={contracts}
                      rowKey="id"
                      loading={isLoading}
                      pagination={{
                        page,
                        pageSize: PAGE_SIZE,
                        total,
                        onChange: (p) => setPage(p),
                      }}
                    />
                  )}
                </TabsContent>

                <TabsContent value="expiring">
                  {expiringList.length === 0 ? (
                    <EmptyState
                      title="暂无即将到期合同"
                      description="当前没有在30天内到期的合同"
                      className="py-12"
                    />
                  ) : (
                    <div className="space-y-4">
                      <Alert variant="warning" title="到期预警">
                        以下 <strong>{expiringList.length}</strong> 份合同将在 30 天内到期，请及时处理续约或更新事宜。
                      </Alert>
                      <div className="space-y-3 mb-4">
                        {expiringList.slice(0, 3).map(contract => {
                          const days = Math.ceil((new Date(contract.endDate!).getTime() - Date.now()) / (1000*60*60*24));
                          const urgency = days <= 7 ? 'bg-red-500' : days <= 15 ? 'bg-orange-500' : 'bg-yellow-500';
                          return (
                            <div key={contract.id} className="flex items-center gap-3 bg-white rounded-lg border border-[#e5e7eb] p-3">
                              <div className={`w-1 h-8 rounded-full ${urgency}`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-[#0f172a] truncate">{contract.contractName}</div>
                                <div className="text-xs text-[#64748b]">{contract.contractNo} · {CONTRACT_TYPE_LABELS[contract.contractType] ?? contract.contractType}</div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg font-bold text-red-600">{days}</div>
                                <div className="text-xs text-[#94a3b8]">天后到期</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <DataTable<Contract>
                        columns={columns}
                        data={expiringList}
                        rowKey="id"
                        pagination={{
                          page: 1,
                          pageSize: 10,
                          total: expiringList.length,
                          onChange: () => {},
                        }}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="timeline">
                  <ContractTimeline contracts={contracts} />
                </TabsContent>
              </Tabs>
            </div>
          </section>

          {/* 新增/编辑弹窗 */}
          <ContractFormDialog
            open={modalVisible}
            contract={editRecord}
            submitting={submitting}
            onClose={() => { setModalVisible(false); setEditRecord(null); }}
            onSubmit={handleSubmit}
          />

          {/* 删除确认弹窗 */}
          <DeleteConfirmDialog
            open={deleteDialogOpen}
            contract={deletingContract}
            deleting={deleteMutation.isPending}
            onClose={() => { setDeleteDialogOpen(false); setDeletingContract(null); }}
            onConfirm={handleDeleteConfirm}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
