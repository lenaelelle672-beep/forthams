/**
 * @file pages/vendors/VendorsPage.tsx
 * @description 供应商管理页面 — Design System v2
 *
 * 功能：供应商列表展示、搜索过滤、新增/编辑/删除操作、详情查看
 * 增强：供应商状态 badge、联系方式密度优化、筛选反馈标签、卡片底部操作区
 * API: 全部通过 @/api/vendor 真实 API，无 Mock 数据
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Pencil, Trash2, RefreshCw, Building2, Phone, Mail, User,
  X, Eye, MapPin, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/Dialog';
import {
  getVendorList,
  getVendorDetail,
  createVendor,
  updateVendor,
  deleteVendor,
  type VendorListQuery,
  type CreateVendorRequest,
} from '@/api/vendor';
import type { PaginatedResponse, Vendor } from '@/types/common';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const emptyVendorPage = (params: VendorListQuery): PaginatedResponse<Vendor> => ({
  records: [],
  total: 0,
  size: params.pageSize ?? PAGE_SIZE,
  current: params.page ?? 1,
  pages: 0,
});

const EMPTY_FORM: CreateVendorRequest = {
  name: '',
  vendorCode: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
};

// ─── 供应商状态配置 ──────────────────────────────────────────────────────────

const VENDOR_STATUS_CONFIG: Record<number, { label: string; variant: 'success' | 'gray' }> = {
  1: { label: '合作中', variant: 'success' },
  0: { label: '已停用', variant: 'gray' },
};

function getVendorStatusConfig(status?: number) {
  if (status === undefined || status === null) {
    return { label: '未知', variant: 'gray' as const };
  }
  return VENDOR_STATUS_CONFIG[status] ?? { label: '已停用', variant: 'gray' as const };
}

// ─── Status badge for stat bar ───────────────────────────────────────────────

function StatusBadge({ status }: { status?: number }) {
  const cfg = getVendorStatusConfig(status);
  const isActive = status === 1;
  const badgeCls = isActive
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-600/20'
    : 'border-slate-200 bg-slate-50 text-slate-600 ring-slate-500/20';
  const dotCls = isActive ? 'bg-emerald-500' : 'bg-slate-400';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeCls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      {cfg.label}
    </span>
  );
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

const VENDOR_KEYS = {
  list: (params: VendorListQuery) => ['vendors', 'list', params] as const,
  detail: (id: number) => ['vendors', 'detail', id] as const,
};

// ─── Vendor Form Dialog ──────────────────────────────────────────────────────

interface VendorFormDialogProps {
  open: boolean;
  vendor: Vendor | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateVendorRequest) => void;
}

function VendorFormDialog({ open, vendor, submitting, onClose, onSubmit }: VendorFormDialogProps) {
  const [form, setForm] = useState<CreateVendorRequest>(EMPTY_FORM);

  React.useEffect(() => {
    if (open) {
      setForm(
        vendor
          ? {
              name: vendor.name ?? '',
              vendorCode: vendor.vendorCode ?? '',
              contactPerson: vendor.contactPerson ?? '',
              contactPhone: vendor.contactPhone ?? '',
              contactEmail: vendor.contactEmail ?? '',
              address: vendor.address ?? '',
            }
          : EMPTY_FORM,
      );
    }
  }, [open, vendor]);

  const handleChange = (field: keyof CreateVendorRequest, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={vendor ? '编辑供应商' : '新增供应商'}>
        <DialogHeader>
          <DialogTitle>{vendor ? '编辑供应商' : '新增供应商'}</DialogTitle>
          <DialogDescription>
            {vendor ? '修改供应商信息并保存' : '填写以下信息以创建新供应商'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="供应商名称 *"
              placeholder="请输入供应商名称"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              required
            />
            <Input
              label="供应商编码"
              placeholder="如 V001"
              value={form.vendorCode ?? ''}
              onChange={e => handleChange('vendorCode', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="联系人"
              placeholder="请输入联系人姓名"
              value={form.contactPerson ?? ''}
              onChange={e => handleChange('contactPerson', e.target.value)}
            />
            <Input
              label="联系电话"
              placeholder="请输入联系电话"
              value={form.contactPhone ?? ''}
              onChange={e => handleChange('contactPhone', e.target.value)}
            />
          </div>
          <Input
            label="邮箱"
            type="email"
            placeholder="请输入邮箱地址"
            value={form.contactEmail ?? ''}
            onChange={e => handleChange('contactEmail', e.target.value)}
          />
          <Input
            label="地址"
            placeholder="请输入地址"
            value={form.address ?? ''}
            onChange={e => handleChange('address', e.target.value)}
          />
        </form>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button type="submit" variant="primary" onClick={handleSubmit} loading={submitting}>
            {vendor ? '保存修改' : '确认新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ───────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  open: boolean;
  vendor: Vendor | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ open, vendor, deleting, onClose, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open && !!vendor} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="确认删除">
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>此操作不可撤销，请确认操作。</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4">
          <p className="text-sm text-[#64748b]">
            确定要删除供应商「<span className="font-medium text-[#0f172a]">{vendor?.name}</span>」吗？此操作不可撤销。
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

// ─── Detail Sheet (as Dialog) ────────────────────────────────────────────────

interface VendorDetailSheetProps {
  open: boolean;
  vendorId: number | null;
  onClose: () => void;
}

function VendorDetailSheet({ open, vendorId, onClose }: VendorDetailSheetProps) {
  const { data: vendor, isLoading } = useQuery({
    queryKey: VENDOR_KEYS.detail(vendorId ?? 0),
    queryFn: async () => {
      const res = await getVendorDetail(vendorId!);
      return res.data as Vendor;
    },
    enabled: open && vendorId !== null,
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const statusCfg = getVendorStatusConfig(vendor?.status);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="供应商详情" className="max-w-md">
        <DialogHeader>
          <DialogTitle>供应商详情</DialogTitle>
          <DialogDescription>查看供应商完整信息</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-[#94a3b8] text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : vendor ? (
            <div className="space-y-5">
              {/* 头部：名称 + 编码 + 状态 */}
              <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-7 h-7 text-[#3b82f6]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-[#0f172a] truncate">{vendor.name}</p>
                    <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                  </div>
                  <p className="text-sm text-[#94a3b8] mt-0.5">{vendor.vendorCode || '—'}</p>
                </div>
              </div>

              {/* 联系信息 */}
              <div className="space-y-4">
                {vendor.contactPerson && (
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-[#64748b] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[#94a3b8]">联系人</p>
                      <p className="text-sm text-[#0f172a]">{vendor.contactPerson}</p>
                    </div>
                  </div>
                )}
                {vendor.contactPhone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-[#64748b] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[#94a3b8]">联系电话</p>
                      <p className="text-sm text-[#0f172a]">{vendor.contactPhone}</p>
                    </div>
                  </div>
                )}
                {vendor.contactEmail && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-[#64748b] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[#94a3b8]">邮箱</p>
                      <p className="text-sm text-[#0f172a] break-all">{vendor.contactEmail}</p>
                    </div>
                  </div>
                )}
                {vendor.address && (
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-[#64748b] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[#94a3b8]">地址</p>
                      <p className="text-sm text-[#0f172a]">{vendor.address}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 创建时间 */}
              {vendor.createTime && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>创建于 {formatDate(vendor.createTime)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-16 text-[#94a3b8] text-sm">
              暂无数据
            </div>
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

export default function VendorsPage() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailVendorId, setDetailVendorId] = useState<number | null>(null);

  // ── 查询参数 ─────────────────────────────────────────────────────────────

  const queryParams: VendorListQuery = {
    keyword: searchTerm.trim() || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  // ── 查询供应商列表 ───────────────────────────────────────────────────────

  const {
    data: listData,
    isLoading,
    isFetching,
    isError,
  } = useQuery({
    queryKey: VENDOR_KEYS.list(queryParams),
    queryFn: async () => {
      const res = await getVendorList(queryParams);
      return res.data ?? emptyVendorPage(queryParams);
    },
  });

  const vendors: Vendor[] = listData?.records ?? [];
  const total = listData?.total ?? 0;
  const totalPages = listData?.pages ?? Math.ceil(total / PAGE_SIZE);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activeCount = useMemo(() => vendors.filter((v) => v.status === 1).length, [vendors]);
  const inactiveCount = useMemo(() => vendors.filter((v) => v.status !== 1).length, [vendors]);

  // ── 新增供应商 ───────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: CreateVendorRequest) => createVendor(data),
    onSuccess: () => {
      toast.success('供应商新增成功');
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setDialogOpen(false);
      setEditingVendor(null);
    },
    onError: () => {
      toast.error('新增供应商失败，请稍后重试');
    },
  });

  // ── 编辑供应商 ───────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateVendorRequest> }) =>
      updateVendor(id, data),
    onSuccess: () => {
      toast.success('供应商更新成功');
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setDialogOpen(false);
      setEditingVendor(null);
    },
    onError: () => {
      toast.error('更新供应商失败，请稍后重试');
    },
  });

  // ── 删除供应商 ───────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteVendor(id),
    onSuccess: () => {
      toast.success('供应商删除成功');
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setDeleteDialogOpen(false);
      setDeletingVendor(null);
    },
    onError: () => {
      toast.error('删除供应商失败，请稍后重试');
    },
  });

  // ── 搜索防抖 ──────────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchTerm(value);
      setPage(1);
    }, 300);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchTerm('');
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // ── 表单提交 ──────────────────────────────────────────────────────────────

  const handleSubmit = (data: CreateVendorRequest) => {
    if (!data.name.trim()) return;
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // ── 删除 ──────────────────────────────────────────────────────────────────

  const handleDelete = () => {
    if (deletingVendor) {
      deleteMutation.mutate(deletingVendor.id);
    }
  };

  // ── 打开弹窗 ──────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditingVendor(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setDialogOpen(true);
  };

  const handleOpenDelete = (vendor: Vendor) => {
    setDeletingVendor(vendor);
    setDeleteDialogOpen(true);
  };

  const handleOpenDetail = (vendorId: number) => {
    setDetailVendorId(vendorId);
    setDetailOpen(true);
  };

  // ── 分页 ──────────────────────────────────────────────────────────────────

  const handlePrevPage = () => {
    setPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setPage(prev => Math.min(totalPages, prev + 1));
  };

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  const submitting = createMutation.isPending || updateMutation.isPending;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Compact header with stat bar ───────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">供应商管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <Building2 className="h-3 w-3" />
                基础数据
              </span>
            </div>
            <Button variant="primary" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              新增供应商
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-sm">
                <Building2 className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">全部供应商</p>
                <p className="text-lg font-bold text-slate-900">{total}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 shadow-sm">
                <CheckCircle className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">合作中</p>
                <p className="text-lg font-bold text-slate-900">{activeCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-400 shadow-sm">
                <XCircle className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">已停用</p>
                <p className="text-lg font-bold text-slate-900">{inactiveCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-400 shadow-sm">
                <User className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">有联系人</p>
                <p className="text-lg font-bold text-slate-900">{vendors.filter((v) => v.contactPerson).length}</p>
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
                placeholder="搜索供应商名称、编码、联系人..."
                value={searchInput}
                onChange={e => handleSearchChange(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-[#e5e7eb] bg-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                  placeholder:text-[#94a3b8]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ['vendors'] })}
                disabled={isFetching}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>
          </div>

          {/* Filter feedback + content */}
          <div className="px-6 py-4">
            {isError && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                供应商接口暂不可用，当前显示空列表。请稍后刷新。
              </div>
            )}

            {/* Search feedback pill */}
            {searchTerm.trim() && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-[#64748b]">筛选条件：</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-xs text-[#3b82f6] font-medium border border-blue-200">
                  <Search className="w-3 h-3" />
                  关键词：{searchTerm.trim()}
                  <button
                    onClick={handleClearSearch}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-blue-100 transition-colors"
                    title="清除搜索"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
                <span className="text-xs text-[#94a3b8]">
                  找到 {total} 条结果
                </span>
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-20 text-[#94a3b8] text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                加载中...
              </div>
            )}

            {/* Vendor cards grid */}
            {!isLoading && (
              <>
                {vendors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-[#94a3b8]">
                    <Building2 className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">
                      {searchTerm ? `未找到包含"${searchTerm}"的供应商` : '暂无供应商数据'}
                    </p>
                    {!searchTerm && (
                      <Button variant="primary" size="sm" className="mt-4" onClick={handleOpenCreate}>
                        <Plus className="w-4 h-4" />
                        新增供应商
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {vendors.map(vendor => {
                        const statusCfg = getVendorStatusConfig(vendor.status);
                        return (
                          <Card
                            key={vendor.id}
                            className="hover:shadow-md transition-shadow cursor-pointer group"
                            onClick={() => handleOpenDetail(vendor.id)}
                          >
                            <CardContent className="p-5">
                              {/* Card header */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center flex-shrink-0">
                                    <Building2 className="w-5 h-5 text-[#3b82f6]" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-[#0f172a] text-sm leading-tight truncate">
                                        {vendor.name}
                                      </p>
                                      <StatusBadge status={vendor.status} />
                                    </div>
                                    <p className="text-xs text-[#94a3b8] mt-0.5">
                                      {vendor.vendorCode || '—'}
                                    </p>
                                  </div>
                                </div>
                                {/* Action buttons */}
                                <div
                                  className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => handleOpenDetail(vendor.id)}
                                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                    title="查看详情"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEdit(vendor)}
                                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                                    title="编辑"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenDelete(vendor)}
                                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                                    title="删除"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Contact info */}
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[#64748b]">
                                {vendor.contactPerson && (
                                  <div className="flex items-center gap-1.5 truncate">
                                    <User className="w-3.5 h-3.5 flex-shrink-0 text-[#94a3b8]" />
                                    <span className="truncate">{vendor.contactPerson}</span>
                                  </div>
                                )}
                                {vendor.contactPhone && (
                                  <div className="flex items-center gap-1.5 truncate">
                                    <Phone className="w-3.5 h-3.5 flex-shrink-0 text-[#94a3b8]" />
                                    <span className="truncate">{vendor.contactPhone}</span>
                                  </div>
                                )}
                                {vendor.contactEmail && (
                                  <div className="flex items-center gap-1.5 truncate col-span-2 sm:col-span-1">
                                    <Mail className="w-3.5 h-3.5 flex-shrink-0 text-[#94a3b8]" />
                                    <span className="truncate">{vendor.contactEmail}</span>
                                  </div>
                                )}
                                {vendor.address && (
                                  <div className="flex items-center gap-1.5 truncate col-span-2 sm:col-span-1">
                                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-[#94a3b8]" />
                                    <span className="truncate">{vendor.address}</span>
                                  </div>
                                )}
                              </div>

                              {/* Footer */}
                              {vendor.createTime && (
                                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-[#94a3b8]">
                                  <Clock className="w-3 h-3" />
                                  <span>创建于 {formatDate(vendor.createTime)}</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                        <p className="text-xs text-[#94a3b8]">
                          共 {total} 条记录，第 {page}/{totalPages} 页
                          {searchTerm ? `（搜索：「${searchTerm}」）` : ''}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handlePrevPage}
                            disabled={page <= 1}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            上一页
                          </button>
                          <span className="text-sm text-[#64748b] px-2">
                            {page} / {totalPages}
                          </span>
                          <button
                            onClick={handleNextPage}
                            disabled={page >= totalPages}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            下一页
                          </button>
                        </div>
                      </div>
                    )}

                    {totalPages <= 1 && (
                      <p className="mt-4 text-xs text-[#94a3b8]">
                        共 {total} 条记录{searchTerm ? `（搜索：「${searchTerm}」）` : ''}
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </section>

        {/* 新增/编辑弹窗 */}
        <VendorFormDialog
          open={dialogOpen}
          vendor={editingVendor}
          submitting={submitting}
          onClose={() => {
            setDialogOpen(false);
            setEditingVendor(null);
          }}
          onSubmit={handleSubmit}
        />

        {/* 删除确认弹窗 */}
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          vendor={deletingVendor}
          deleting={deleteMutation.isPending}
          onClose={() => {
            setDeleteDialogOpen(false);
            setDeletingVendor(null);
          }}
          onConfirm={handleDelete}
        />

        {/* 详情弹窗 */}
        <VendorDetailSheet
          open={detailOpen}
          vendorId={detailVendorId}
          onClose={() => {
            setDetailOpen(false);
            setDetailVendorId(null);
          }}
        />
      </div>
    </div>
  );
}
