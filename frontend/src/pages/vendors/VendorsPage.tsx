/**
 * @file pages/vendors/VendorsPage.tsx
 * @description 供应商管理页面 — Design System 重构版
 *
 * 功能：供应商列表展示、搜索过滤、新增/编辑/删除操作、详情查看
 * API: 全部通过 @/api/vendor 真实 API，无 Mock 数据
 */

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Pencil, Trash2, RefreshCw, Building2, Phone, Mail, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  getVendorList,
  getVendorDetail,
  createVendor,
  updateVendor,
  deleteVendor,
  type VendorListQuery,
  type CreateVendorRequest,
} from '@/api/vendor';
import type { Vendor } from '@/types/common';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const EMPTY_FORM: CreateVendorRequest = {
  vendorName: '',
  vendorCode: '',
  contact: '',
  phone: '',
  email: '',
  address: '',
};

// ─── Query Keys ──────────────────────────────────────────────────────────────

const VENDOR_KEYS = {
  list: (params: VendorListQuery) => ['vendors', 'list', params] as const,
  detail: (id: number) => ['vendors', 'detail', id] as const,
};

// ─── 内联表单弹窗 ────────────────────────────────────────────────────────────

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
              vendorName: vendor.vendorName ?? '',
              vendorCode: vendor.vendorCode ?? '',
              contact: vendor.contact ?? '',
              phone: vendor.phone ?? '',
              email: vendor.email ?? '',
              address: vendor.address ?? '',
            }
          : EMPTY_FORM,
      );
    }
  }, [open, vendor]);

  if (!open) return null;

  const handleChange = (field: keyof CreateVendorRequest, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-lg mx-4 p-6">
        <h3 className="text-base font-semibold text-[#0f172a] mb-5">
          {vendor ? '编辑供应商' : '新增供应商'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="供应商名称 *"
              placeholder="请输入供应商名称"
              value={form.vendorName}
              onChange={e => handleChange('vendorName', e.target.value)}
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
              value={form.contact ?? ''}
              onChange={e => handleChange('contact', e.target.value)}
            />
            <Input
              label="联系电话"
              placeholder="请输入联系电话"
              value={form.phone ?? ''}
              onChange={e => handleChange('phone', e.target.value)}
            />
          </div>
          <Input
            label="邮箱"
            type="email"
            placeholder="请输入邮箱地址"
            value={form.email ?? ''}
            onChange={e => handleChange('email', e.target.value)}
          />
          <Input
            label="地址"
            placeholder="请输入地址"
            value={form.address ?? ''}
            onChange={e => handleChange('address', e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {vendor ? '保存修改' : '确认新增'}
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
  vendor: Vendor | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ open, vendor, deleting, onClose, onConfirm }: DeleteConfirmDialogProps) {
  if (!open || !vendor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-[#0f172a] mb-3">确认删除</h3>
        <p className="text-sm text-[#64748b] mb-6">
          确定要删除供应商「<span className="font-medium text-[#0f172a]">{vendor.vendorName}</span>」吗？此操作不可撤销。
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

// ─── 详情抽屉（Sheet） ──────────────────────────────────────────────────────

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-[#0f172a]">供应商详情</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
            >
              ✕
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-[#94a3b8] text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : vendor ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4 pb-5 border-b border-[#f1f5f9]">
                <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-7 h-7 text-[#3b82f6]" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-[#0f172a]">{vendor.vendorName}</p>
                  <p className="text-sm text-[#94a3b8] mt-0.5">{vendor.vendorCode || '—'}</p>
                </div>
              </div>

              <div className="space-y-4">
                {vendor.contact && (
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-[#64748b] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[#94a3b8]">联系人</p>
                      <p className="text-sm text-[#0f172a]">{vendor.contact}</p>
                    </div>
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-[#64748b] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[#94a3b8]">联系电话</p>
                      <p className="text-sm text-[#0f172a]">{vendor.phone}</p>
                    </div>
                  </div>
                )}
                {vendor.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-[#64748b] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[#94a3b8]">邮箱</p>
                      <p className="text-sm text-[#0f172a] break-all">{vendor.email}</p>
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
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 text-[#94a3b8] text-sm">
              暂无数据
            </div>
          )}
        </div>
      </div>
    </div>
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
  } = useQuery({
    queryKey: VENDOR_KEYS.list(queryParams),
    queryFn: async () => {
      const res = await getVendorList(queryParams);
      return res.data;
    },
  });

  const vendors: Vendor[] = listData?.records ?? [];
  const total = listData?.total ?? 0;
  const totalPages = listData?.pages ?? Math.ceil(total / PAGE_SIZE);

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

  // ── 表单提交 ──────────────────────────────────────────────────────────────

  const handleSubmit = (data: CreateVendorRequest) => {
    if (!data.vendorName.trim()) return;
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

  return (
    <div className="p-6 bg-[#f8fafc] min-h-full">
      <PageHeader
        title="供应商管理"
        subtitle="合作供应商信息维护"
        actions={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增供应商
          </Button>
        }
      />

      {/* 搜索栏 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
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
        <Button
          variant="outline"
          size="md"
          onClick={() => qc.invalidateQueries({ queryKey: ['vendors'] })}
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

      {/* 供应商列表 */}
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
                {vendors.map(vendor => (
                  <Card
                    key={vendor.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleOpenDetail(vendor.id)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-[#3b82f6]" />
                          </div>
                          <div>
                            <p className="font-semibold text-[#0f172a] text-sm leading-tight">
                              {vendor.vendorName}
                            </p>
                            <p className="text-xs text-[#94a3b8] mt-0.5">
                              {vendor.vendorCode || '—'}
                            </p>
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-1 flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleOpenEdit(vendor)}
                            className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors"
                            title="编辑"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(vendor)}
                            className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs text-[#64748b]">
                        {vendor.contact && (
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{vendor.contact}</span>
                          </div>
                        )}
                        {vendor.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{vendor.phone}</span>
                          </div>
                        )}
                        {vendor.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{vendor.email}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-xs text-[#94a3b8]">
                    共 {total} 条记录，第 {page}/{totalPages} 页
                    {searchTerm ? `（搜索：「${searchTerm}」）` : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={page <= 1}
                    >
                      上一页
                    </Button>
                    <span className="text-sm text-[#64748b] px-2">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={page >= totalPages}
                    >
                      下一页
                    </Button>
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

      {/* 详情抽屉 */}
      <VendorDetailSheet
        open={detailOpen}
        vendorId={detailVendorId}
        onClose={() => {
          setDetailOpen(false);
          setDetailVendorId(null);
        }}
      />
    </div>
  );
}
