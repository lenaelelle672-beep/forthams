/**
 * @file pages/maintenance/MaintenancePage.tsx
 * @description 维保管理独立页面
 *
 * 功能：维保记录列表（分页+搜索）、即将到期预警、新增/编辑/删除
 * API: maintenanceService.list/create/update/delete/getUpcoming
 * Pattern: useQuery + useMutation + invalidateQueries + zod safeParse
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  Plus, Search, Pencil, Trash2, RefreshCw, AlertTriangle, Wrench, Calendar,
  Clock, CheckCircle2, AlertCircle, PlayCircle, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import {
  maintenanceService,
  type MaintenanceRecord,
  type CreateMaintenancePayload,
} from '@/api/maintenance';

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const maintenanceSchema = z.object({
  assetId: z.coerce.number().positive('资产ID必须为正整数'),
  maintenanceType: z.enum(['preventive', 'corrective', 'emergency', 'routine'] as const, {
    message: '请选择维保类型',
  }),
  maintenanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式 YYYY-MM-DD'),
  content: z.string().min(5, '维保内容至少5个字符').max(500, '不超过500字符'),
  executor: z.string().max(50, '执行人不超过50字符').optional().or(z.literal('')),
  cost: z.coerce.number().nonnegative('费用不能为负').optional(),
  nextMaintenanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式 YYYY-MM-DD').optional().or(z.literal('')),
  result: z.string().max(200).optional().or(z.literal('')),
  remark: z.string().max(200).optional().or(z.literal('')),
});

// used via maintenanceSchema.safeParse inline

// ─── 常量 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  preventive: '预防性维保',
  corrective: '纠正性维保',
  emergency: '紧急维保',
  routine: '例行维保',
};

const MAINTENANCE_TYPE_COLORS: Record<string, string> = {
  preventive: 'bg-blue-100 text-blue-700',
  corrective: 'bg-amber-100 text-amber-700',
  emergency: 'bg-red-100 text-red-700',
  routine: 'bg-green-100 text-green-700',
};

const EMPTY_FORM = {
  assetId: '',
  maintenanceType: '',
  maintenanceDate: '',
  content: '',
  executor: '',
  cost: '',
  nextMaintenanceDate: '',
  result: '',
  remark: '',
};

// ─── 维保状态推断 ────────────────────────────────────────────────────────────

type MaintenanceStatus = 'planned' | 'overdue' | 'in_progress' | 'completed';

const STATUS_CONFIG: Record<MaintenanceStatus, {
  label: string;
  color: string;
  icon: React.ElementType;
  dot: string;
  text: string;
  bg: string;
  border: string;
  gradient: string;
  iconBg: string;
}> = {
  planned: {
    label: '计划中',
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    icon: Clock,
    dot: 'bg-blue-400',
    text: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    gradient: 'from-blue-600 to-cyan-500',
    iconBg: 'bg-blue-600/20 text-blue-100',
  },
  in_progress: {
    label: '执行中',
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    icon: PlayCircle,
    dot: 'bg-amber-400',
    text: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    gradient: 'from-amber-500 to-orange-400',
    iconBg: 'bg-amber-600/20 text-amber-100',
  },
  overdue: {
    label: '逾期',
    color: 'bg-red-50 text-red-600 border-red-200',
    icon: AlertCircle,
    dot: 'bg-red-400',
    text: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    gradient: 'from-red-500 to-rose-400',
    iconBg: 'bg-red-600/20 text-red-100',
  },
  completed: {
    label: '已完成',
    color: 'bg-green-50 text-green-600 border-green-200',
    icon: CheckCircle2,
    dot: 'bg-emerald-400',
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    gradient: 'from-emerald-500 to-teal-400',
    iconBg: 'bg-emerald-600/20 text-emerald-100',
  },
};

const QUICK_FILTERS: Array<{ key: MaintenanceStatus; label: string }> = [
  { key: 'planned', label: '计划中' },
  { key: 'in_progress', label: '执行中' },
  { key: 'overdue', label: '逾期' },
  { key: 'completed', label: '已完成' },
];

function computeStatus(record: MaintenanceRecord): MaintenanceStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maintenanceDate = record.maintenanceDate ? new Date(record.maintenanceDate + 'T00:00:00') : null;
  const nextDate = record.nextMaintenanceDate ? new Date(record.nextMaintenanceDate + 'T00:00:00') : null;

  // If has result filled → completed
  if (record.result && record.result.trim().length > 0) return 'completed';

  // If maintenanceDate is in the future → planned
  if (maintenanceDate && maintenanceDate > today) return 'planned';

  // If maintenanceDate is today or past, no result → check overdue
  if (nextDate && nextDate < today) return 'overdue';

  // If maintenanceDate is today or past, no result, not overdue → in_progress
  if (maintenanceDate && maintenanceDate <= today) return 'in_progress';

  // Default fallback: planned
  return 'planned';
}

function daysUntilNext(nextDate: string | null): number | null {
  if (!nextDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(nextDate + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

const MAINT_KEYS = {
  list: (params: object) => ['maintenance', 'list', params] as const,
  upcoming: () => ['maintenance', 'upcoming'] as const,
};

// ─── 内联表单弹窗 ────────────────────────────────────────────────────────────

interface MaintenanceFormDialogProps {
  open: boolean;
  record: MaintenanceRecord | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateMaintenancePayload) => void;
}

function MaintenanceFormDialog({
  open, record, submitting, onClose, onSubmit,
}: MaintenanceFormDialogProps) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setErrors({});
      if (record) {
        setForm({
          assetId: String(record.assetId ?? ''),
          maintenanceType: record.maintenanceType ?? '',
          maintenanceDate: record.maintenanceDate ?? '',
          content: record.content ?? '',
          executor: record.executor ?? '',
          cost: record.cost != null ? String(record.cost) : '',
          nextMaintenanceDate: record.nextMaintenanceDate ?? '',
          result: record.result ?? '',
          remark: record.remark ?? '',
        });
      } else {
        setForm({ ...EMPTY_FORM });
      }
    }
  }, [open, record]);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parseData = {
      ...form,
      cost: form.cost === '' ? undefined : form.cost,
      nextMaintenanceDate: form.nextMaintenanceDate === '' ? undefined : form.nextMaintenanceDate,
      result: form.result === '' ? undefined : form.result,
      remark: form.remark === '' ? undefined : form.remark,
      executor: form.executor === '' ? undefined : form.executor,
    };
    const result = maintenanceSchema.safeParse(parseData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    const payload: CreateMaintenancePayload = {
      assetId: result.data.assetId,
      maintenanceType: result.data.maintenanceType,
      maintenanceDate: result.data.maintenanceDate,
      content: result.data.content,
      executor: result.data.executor ?? undefined,
      cost: result.data.cost,
      nextMaintenanceDate: result.data.nextMaintenanceDate ?? undefined,
      result: result.data.result ?? undefined,
      remark: result.data.remark ?? undefined,
    };
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="overflow-hidden rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-blue-900">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Wrench className="h-4 w-4 text-cyan-300" />
            {record ? '编辑维保记录' : '新增维保记录'}
          </DialogTitle>
          <p className="mt-1 text-sm text-slate-300">
            {record ? '修改维保记录信息' : '填写以下信息创建新的维保记录'}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* 行1：资产ID + 维保类型 */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="资产 ID *"
              type="number"
              placeholder="请输入资产ID"
              value={form.assetId}
              onChange={e => set('assetId', e.target.value)}
              error={errors.assetId}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">维保类型 *</label>
              <select
                value={form.maintenanceType}
                onChange={e => set('maintenanceType', e.target.value)}
                className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
              >
                <option value="">请选择</option>
                <option value="preventive">预防性维保</option>
                <option value="corrective">纠正性维保</option>
                <option value="emergency">紧急维保</option>
                <option value="routine">例行维保</option>
              </select>
              {errors.maintenanceType && (
                <p className="text-xs text-red-500">{errors.maintenanceType}</p>
              )}
            </div>
          </div>

          {/* 行2：维保日期 + 下次维保日期 */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="维保日期 *"
              type="date"
              value={form.maintenanceDate}
              onChange={e => set('maintenanceDate', e.target.value)}
              error={errors.maintenanceDate}
              required
            />
            <Input
              label="下次维保日期"
              type="date"
              value={form.nextMaintenanceDate}
              onChange={e => set('nextMaintenanceDate', e.target.value)}
              error={errors.nextMaintenanceDate}
            />
          </div>

          {/* 行3：执行人 + 费用 */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="执行人"
              placeholder="请输入执行人姓名"
              value={form.executor}
              onChange={e => set('executor', e.target.value)}
              error={errors.executor}
            />
            <Input
              label="维保费用（元）"
              type="number"
              placeholder="请输入费用"
              value={form.cost}
              onChange={e => set('cost', e.target.value)}
              error={errors.cost}
            />
          </div>

          {/* 维保内容 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">维保内容 * <span className="text-xs text-[#94a3b8]">（至少5字符）</span></label>
            <textarea
              value={form.content}
              onChange={e => set('content', e.target.value)}
              rows={3}
              placeholder="请描述维保内容..."
              className="px-3 py-2 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none"
            />
            {errors.content && <p className="text-xs text-red-500">{errors.content}</p>}
          </div>

          {/* 维保结果 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">维保结果</label>
            <textarea
              value={form.result}
              onChange={e => set('result', e.target.value)}
              rows={2}
              placeholder="维保结果描述（可选）"
              className="px-3 py-2 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none"
            />
            {errors.result && <p className="text-xs text-red-500">{errors.result}</p>}
          </div>

          {/* 备注 */}
          <Input
            label="备注"
            placeholder="备注信息（可选）"
            value={form.remark}
            onChange={e => set('remark', e.target.value)}
            error={errors.remark}
          />

          <DialogFooter className="px-0 pt-2 border-t-0">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {record ? '保存修改' : '确认新增'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── 删除确认弹窗 ────────────────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  open: boolean;
  record: MaintenanceRecord | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ open, record, deleting, onClose, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open && !!record} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="overflow-hidden rounded-2xl max-w-md">
        <DialogHeader className="border-b border-slate-100 bg-gradient-to-r from-red-900 to-rose-900">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Trash2 className="h-4 w-4 text-red-300" />
            确认删除
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5">
          <p className="text-sm text-[#64748b]">
            确定要删除该维保记录吗？（资产 ID: <span className="font-medium text-[#0f172a]">{record?.assetId}</span>，{record?.maintenanceDate}）此操作不可撤销。
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>
            取消
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm} loading={deleting}>
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 即将到期预警区域 ─────────────────────────────────────────────────────────

function UpcomingAlert() {
  const { data: upcoming, isLoading } = useQuery({
    queryKey: MAINT_KEYS.upcoming(),
    queryFn: async () => {
      const res = await maintenanceService.getUpcoming(30);
      return (res as unknown as MaintenanceRecord[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !upcoming || upcoming.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50/60 shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-amber-100">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-bold text-amber-800">
          即将到期提醒（30天内，共 {upcoming.length} 条）
        </span>
      </div>
      <div className="px-5 py-3 space-y-2">
        {upcoming.slice(0, 5).map(item => (
          <div key={item.id} className="flex items-center gap-3 text-sm text-amber-800">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span>资产 {item.assetId}</span>
            <span className="text-amber-400">·</span>
            <span>{MAINTENANCE_TYPE_LABELS[item.maintenanceType] ?? item.maintenanceType}</span>
            <span className="text-amber-400">·</span>
            <span>下次维保：{item.nextMaintenanceDate ?? '—'}</span>
          </div>
        ))}
        {upcoming.length > 5 && (
          <p className="text-xs text-amber-500 mt-1">... 等 {upcoming.length - 5} 条更多</p>
        )}
      </div>
    </section>
  );
}

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const qc = useQueryClient();

  // 搜索与分页
  const [searchInput, setSearchInput] = useState('');
  const [filterAssetId, setFilterAssetId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState<MaintenanceStatus | ''>('');
  const [page, setPage] = useState(1);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 弹窗状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<MaintenanceRecord | null>(null);

  // ── 查询参数 ─────────────────────────────────────────────────────────────
  const queryParams = {
    page,
    pageSize: PAGE_SIZE,
    assetId: filterAssetId ? Number(filterAssetId) : undefined,
    maintenanceType: filterType || undefined,
  };

  // ── 查询维保列表 ─────────────────────────────────────────────────────────
  const { data: listData, isLoading, isFetching } = useQuery({
    queryKey: MAINT_KEYS.list(queryParams),
    queryFn: async () => {
      const res = await maintenanceService.list(queryParams);
      return res as any;
    },
  });

  const records: MaintenanceRecord[] = listData?.records ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── 客户端状态过滤 ─────────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    if (!filterStatus) return records;
    return records.filter(r => computeStatus(r) === filterStatus);
  }, [records, filterStatus]);

  // ── 新增 ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateMaintenancePayload) => maintenanceService.create(data),
    onSuccess: () => {
      toast.success('维保记录新增成功');
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      setDialogOpen(false);
      setEditingRecord(null);
    },
    onError: () => {
      toast.error('新增维保记录失败，请稍后重试');
    },
  });

  // ── 编辑 ─────────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateMaintenancePayload }) =>
      maintenanceService.update(id, data),
    onSuccess: () => {
      toast.success('维保记录更新成功');
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      setDialogOpen(false);
      setEditingRecord(null);
    },
    onError: () => {
      toast.error('更新维保记录失败，请稍后重试');
    },
  });

  // ── 删除 ─────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) => maintenanceService.delete(id),
    onSuccess: () => {
      toast.success('维保记录已删除');
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      setDeleteDialogOpen(false);
      setDeletingRecord(null);
    },
    onError: () => {
      toast.error('删除维保记录失败，请稍后重试');
    },
  });

  // ── 搜索防抖 ──────────────────────────────────────────────────────────────
  const handleAssetIdChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilterAssetId(value);
      setPage(1);
    }, 400);
  }, []);

  const handleTypeChange = (value: string) => {
    setFilterType(value);
    setPage(1);
  };

  // ── 表单提交 ──────────────────────────────────────────────────────────────
  const handleSubmit = (data: CreateMaintenancePayload) => {
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (deletingRecord) deleteMutation.mutate(deletingRecord.id);
  };

  const submitting = createMutation.isPending || updateMutation.isPending;

  // ── 状态摘要统计 ────────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<MaintenanceStatus, number> = { planned: 0, in_progress: 0, overdue: 0, completed: 0 };
    records.forEach(r => { counts[computeStatus(r)]++; });
    return counts;
  }, [records]);

  // ── 筛选结果摘要 ────────────────────────────────────────────────────────
  const filterSummary = useMemo(() => {
    if (!filterStatus) return null;
    const cfg = STATUS_CONFIG[filterStatus];
    return { label: cfg.label, count: filteredRecords.length, status: filterStatus };
  }, [filterStatus, filteredRecords.length]);

  // ── DataTable 列定义 ──────────────────────────────────────────────────────
  const columns: Column<MaintenanceRecord>[] = [
    {
      key: 'status',
      title: '状态',
      width: 110,
      render: (_, row) => {
        const status = computeStatus(row);
        const cfg = STATUS_CONFIG[status];
        const StatusIcon = cfg.icon;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <StatusIcon className="w-3 h-3" />
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'assetId',
      title: '资产ID',
      width: 90,
      render: (v) => (
        <span className="font-mono text-xs font-semibold text-blue-600">
          #{String(v)}
        </span>
      ),
    },
    {
      key: 'maintenanceType',
      title: '维保类型',
      width: 110,
      render: (v) => {
        const typeStr = String(v);
        return (
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${MAINTENANCE_TYPE_COLORS[typeStr] ?? 'bg-[#f1f5f9] text-[#64748b]'}`}>
            {MAINTENANCE_TYPE_LABELS[typeStr] ?? typeStr}
          </span>
        );
      },
    },
    {
      key: 'maintenanceDate',
      title: '维保日期',
      width: 120,
      render: (v) => (
        <span className="whitespace-nowrap text-xs font-medium text-slate-600">
          {String(v ?? '—')}
        </span>
      ),
    },
    {
      key: 'executor',
      title: '执行人',
      width: 100,
      render: (v) => (
        <span className="text-xs text-[#64748b]">{v ? String(v) : '—'}</span>
      ),
    },
    {
      key: 'cost',
      title: '费用',
      width: 100,
      render: (v) => (
        <span className="text-xs text-[#64748b]">
          {v != null ? `¥${Number(v).toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      key: 'nextMaintenanceDate',
      title: '下次维保',
      width: 160,
      render: (v, row) => {
        const dateStr = v ? String(v) : null;
        if (!dateStr) return <span className="text-xs text-[#64748b]">—</span>;
        const daysLeft = daysUntilNext(dateStr);
        const dateRiskColor = daysLeft !== null
          ? (daysLeft < 0 ? 'text-red-600 font-medium' : daysLeft <= 7 ? 'text-amber-600 font-medium' : 'text-[#64748b]')
          : 'text-[#64748b]';
        return (
          <span className={`text-xs ${dateRiskColor}`}>
            {dateStr}
            {daysLeft !== null && (
              <span className="ml-1 text-[11px] opacity-75">
                {daysLeft < 0 ? `(${Math.abs(daysLeft)}天前)` : daysLeft === 0 ? '(今天)' : `(${daysLeft}天后)`}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'actions',
      title: '操作',
      width: 130,
      align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setEditingRecord(row); setDialogOpen(true); }}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
            title="编辑"
          >
            <Pencil className="w-3.5 h-3.5" />
            编辑
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeletingRecord(row); setDeleteDialogOpen(true); }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:text-red-600"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ================================================================ */}
        {/* ① 紧凑头部 — 标题 + 指标条                                       */}
        {/* ================================================================ */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">维保管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                设备维护
              </span>
            </div>
            <Button variant="primary" onClick={() => { setEditingRecord(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" />
              新增维保
            </Button>
          </div>

          {/* 指标条 */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 sm:grid-cols-4">
            {(Object.keys(STATUS_CONFIG) as MaintenanceStatus[]).map(status => {
              const cfg = STATUS_CONFIG[status];
              const Icon = cfg.icon;
              const count = statusCounts[status];
              return (
                <div key={status} className="flex items-center gap-3 px-5 py-3">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${cfg.gradient} shadow-sm`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">{cfg.label}</p>
                    <p className="text-lg font-bold text-slate-900">
                      {count}
                      <span className="ml-0.5 text-xs font-medium text-slate-400">条</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================================================ */}
        {/* 即将到期预警                                                       */}
        {/* ================================================================ */}
        <UpcomingAlert />

        {/* ================================================================ */}
        {/* ② 主内容区域 — 全宽表格                                          */}
        {/* ================================================================ */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* 工具栏 */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            {/* 标题行 */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  <Search className="h-3.5 w-3.5" />
                  维保列表
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  维保记录管理
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* 搜索框 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
                  <input
                    type="text"
                    placeholder="按资产ID搜索..."
                    value={searchInput}
                    onChange={e => handleAssetIdChange(e.target.value)}
                    className="h-8 w-44 pl-9 pr-3 rounded-lg border border-[#e5e7eb] bg-white text-xs
                      focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                      placeholder:text-[#94a3b8]"
                  />
                </div>
                {/* 类型筛选 */}
                <select
                  value={filterType}
                  onChange={e => handleTypeChange(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-[#e5e7eb] bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] text-[#374151]"
                >
                  <option value="">全部类型</option>
                  <option value="preventive">预防性维保</option>
                  <option value="corrective">纠正性维保</option>
                  <option value="emergency">紧急维保</option>
                  <option value="routine">例行维保</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => qc.invalidateQueries({ queryKey: ['maintenance'] })}
                  disabled={isFetching}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => { setEditingRecord(null); setDialogOpen(true); }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增
                </Button>
              </div>
            </div>

            {/* 快速筛选按钮 */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setFilterStatus(''); setPage(1); }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  !filterStatus
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                全部
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0 text-[10px]">
                  {records.length}
                </span>
              </button>
              {QUICK_FILTERS.map(({ key, label }) => {
                const cfg = STATUS_CONFIG[key];
                const active = filterStatus === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setFilterStatus(active ? '' : key); setPage(1); }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                    {label}
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {statusCounts[key] ?? 0}
                    </span>
                  </button>
                );
              })}

              {/* 加载指示 */}
              {isFetching && !isLoading && (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  刷新中
                </span>
              )}
            </div>
          </div>

          {/* 结果摘要条 */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
            {filterSummary && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Search className="h-3 w-3" />
                筛选: {filterSummary.label}
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 text-blue-400 transition hover:bg-blue-200 hover:text-blue-700"
                  onClick={() => { setFilterStatus(''); setPage(1); }}
                  title="清除筛选"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <span className="text-xs text-slate-500">
              共 <span className="font-bold text-slate-700">{filterSummary?.count ?? records.length}</span> 条记录
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span>
                第 <span className="font-semibold text-slate-600">{page}</span>
                <span className="text-slate-300">/</span>{totalPages} 页
              </span>
            </div>
          </div>

          {/* 表格 */}
          <div className="p-4 sm:p-5">
            <DataTable
              columns={columns}
              data={filteredRecords}
              loading={isLoading}
              rowKey={(row) => row.id}
              pagination={{
                page,
                pageSize: PAGE_SIZE,
                total,
                onChange: (p) => setPage(p),
              }}
              emptyText="暂无维保记录，点击「新增」开始创建"
            />
          </div>
        </Card>
      </div>

      {/* 新增/编辑弹窗 */}
      <MaintenanceFormDialog
        open={dialogOpen}
        record={editingRecord}
        submitting={submitting}
        onClose={() => { setDialogOpen(false); setEditingRecord(null); }}
        onSubmit={handleSubmit}
      />

      {/* 删除确认弹窗 */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        record={deletingRecord}
        deleting={deleteMutation.isPending}
        onClose={() => { setDeleteDialogOpen(false); setDeletingRecord(null); }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
