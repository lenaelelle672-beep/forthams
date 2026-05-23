/**
 * @file pages/maintenance/MaintenancePage.tsx
 * @description 维保管理独立页面
 *
 * 功能：维保记录列表（分页+搜索）、即将到期预警、新增/编辑/删除
 * API: maintenanceService.list/create/update/delete/getUpcoming
 * Pattern: useQuery + useMutation + invalidateQueries + zod safeParse
 */

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  Plus, Search, Pencil, Trash2, RefreshCw, AlertTriangle, Wrench, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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

type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

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

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-[#0f172a] mb-5">
          {record ? '编辑维保记录' : '新增维保记录'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {record ? '保存修改' : '确认新增'}
            </Button>
          </div>
        </form>
      </div>
    </div>
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
  if (!open || !record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-[#0f172a] mb-3">确认删除</h3>
        <p className="text-sm text-[#64748b] mb-6">
          确定要删除该维保记录吗？（资产 ID: <span className="font-medium text-[#0f172a]">{record.assetId}</span>，{record.maintenanceDate}）此操作不可撤销。
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>
            取消
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm} loading={deleting}>
            确认删除
          </Button>
        </div>
      </div>
    </div>
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
    <Card className="mb-5 border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="w-4 h-4" />
          即将到期提醒（30天内，共 {upcoming.length} 条）
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {upcoming.slice(0, 5).map(item => (
            <div key={item.id} className="flex items-center gap-3 text-sm text-amber-800">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>资产 {item.assetId}</span>
              <span className="text-amber-600">·</span>
              <span>{MAINTENANCE_TYPE_LABELS[item.maintenanceType] ?? item.maintenanceType}</span>
              <span className="text-amber-600">·</span>
              <span>下次维保：{item.nextMaintenanceDate ?? '—'}</span>
            </div>
          ))}
          {upcoming.length > 5 && (
            <p className="text-xs text-amber-600 mt-1">... 等 {upcoming.length - 5} 条更多</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const qc = useQueryClient();

  // 搜索与分页
  const [searchInput, setSearchInput] = useState('');
  const [filterAssetId, setFilterAssetId] = useState('');
  const [filterType, setFilterType] = useState('');
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

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 bg-[#f8fafc] min-h-full">
      <PageHeader
        title="维保管理"
        subtitle="设备与资产维护保养记录管理"
        actions={
          <Button variant="primary" onClick={() => { setEditingRecord(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4" />
            新增维保
          </Button>
        }
      />

      {/* 即将到期预警 */}
      <UpcomingAlert />

      {/* 搜索/过滤栏 */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="按资产ID搜索..."
            value={searchInput}
            onChange={e => handleAssetIdChange(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-[#e5e7eb] bg-white text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
              placeholder:text-[#94a3b8]"
          />
        </div>
        <select
          value={filterType}
          onChange={e => handleTypeChange(e.target.value)}
          className="h-9 px-3 rounded-lg border border-[#e5e7eb] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] text-[#374151]"
        >
          <option value="">全部类型</option>
          <option value="preventive">预防性维保</option>
          <option value="corrective">纠正性维保</option>
          <option value="emergency">紧急维保</option>
          <option value="routine">例行维保</option>
        </select>
        <Button
          variant="outline"
          size="md"
          onClick={() => qc.invalidateQueries({ queryKey: ['maintenance'] })}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-[#94a3b8] text-sm">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          加载中...
        </div>
      )}

      {/* 记录列表 */}
      {!isLoading && (
        <>
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#94a3b8]">
              <Wrench className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">暂无维保记录</p>
              <Button variant="primary" size="sm" className="mt-4" onClick={() => { setEditingRecord(null); setDialogOpen(true); }}>
                <Plus className="w-4 h-4" />
                新增维保记录
              </Button>
            </div>
          ) : (
            <>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                          <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">资产ID</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">维保类型</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">维保日期</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">执行人</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">费用</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">下次维保</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f5f9]">
                        {records.map(record => (
                          <tr key={record.id} className="hover:bg-[#f8fafc]">
                            <td className="px-5 py-3.5 font-mono text-xs text-[#374151]">{record.assetId}</td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${MAINTENANCE_TYPE_COLORS[record.maintenanceType] ?? 'bg-[#f1f5f9] text-[#64748b]'}`}>
                                {MAINTENANCE_TYPE_LABELS[record.maintenanceType] ?? record.maintenanceType}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-[#374151]">{record.maintenanceDate}</td>
                            <td className="px-5 py-3.5 text-[#64748b]">{record.executor ?? '—'}</td>
                            <td className="px-5 py-3.5 text-[#64748b]">
                              {record.cost != null ? `¥${record.cost.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-5 py-3.5 text-[#64748b]">{record.nextMaintenanceDate ?? '—'}</td>
                            <td className="px-5 py-3.5">
                              <button
                                onClick={() => { setEditingRecord(record); setDialogOpen(true); }}
                                className="p-1.5 rounded text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors mr-1"
                                title="编辑"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { setDeletingRecord(record); setDeleteDialogOpen(true); }}
                                className="p-1.5 rounded text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="删除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* 分页 */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-[#94a3b8]">共 {total} 条记录，第 {page}/{totalPages} 页</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>上一页</Button>
                  <span className="text-sm text-[#64748b] px-2">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一页</Button>
                </div>
              </div>
            </>
          )}
        </>
      )}

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
