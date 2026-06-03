/**
 * @file pages/purchase-order/PurchaseOrderPage.tsx
 * @description 采购订单管理页面
 *
 * 功能：采购订单列表、KPI统计、新增/编辑/删除、状态流转、详情查看
 * API: @/api/purchaseOrder
 */

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, RefreshCw, ShoppingCart, Clock, CheckCircle2,
  Trash2, SendHorizontal, XCircle, PackageCheck, Eye, FileEdit,
} from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Select, SelectItem } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import {
  getPurchaseOrderList,
  getPurchaseOrderDetail,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  getPurchaseOrderStats,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type CreatePurchaseOrderRequest,
  type PurchaseOrderListQuery,
  type PurchaseOrderStats,
} from '@/api/purchaseOrder';
import { getVendorList } from '@/api/vendor';
import type { Vendor } from '@/types/common';

const PAGE_SIZE = 10;

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  DRAFT:     { label: '草稿',     dot: 'bg-slate-400',  bg: 'bg-slate-50',   text: 'text-slate-600',  border: 'border-slate-200' },
  PENDING:   { label: '待审批',   dot: 'bg-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
  APPROVED:  { label: '已审批',   dot: 'bg-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  PARTIAL:   { label: '部分收货', dot: 'bg-violet-400', bg: 'bg-violet-50',  text: 'text-violet-700', border: 'border-violet-200' },
  RECEIVED:  { label: '已收货',   dot: 'bg-cyan-400',   bg: 'bg-cyan-50',    text: 'text-cyan-700',   border: 'border-cyan-200' },
  CANCELLED: { label: '已取消',   dot: 'bg-red-400',    bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200' },
};

function StatusTag({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.text} ${cfg.border} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

const PAGE_KEYS = {
  list: (params: PurchaseOrderListQuery) => ['purchaseOrders', 'list', params] as const,
  detail: (id: number) => ['purchaseOrders', 'detail', id] as const,
  stats: () => ['purchaseOrders', 'stats'] as const,
};

// ── 空采购明细项 ──

function emptyItem(): PurchaseOrderItem {
  return { assetName: '', quantity: 1, unitPrice: 0 };
}

// ── 新增/编辑弹窗 ──

interface OrderFormDialogProps {
  open: boolean;
  order: PurchaseOrder | null;
  submitting: boolean;
  vendors: Vendor[];
  onClose: () => void;
  onSubmit: (data: CreatePurchaseOrderRequest) => void;
}

function OrderFormDialog({ open, order, submitting, vendors, onClose, onSubmit }: OrderFormDialogProps) {
  const [form, setForm] = useState<CreatePurchaseOrderRequest>({
    orderNo: '',
    orderName: '',
    vendorId: 0,
    orderDate: dayjs().format('YYYY-MM-DD'),
    expectedDate: '',
    remark: '',
    items: [emptyItem()],
  });

  React.useEffect(() => {
    if (open) {
      if (order) {
        setForm({
          orderNo: order.orderNo,
          orderName: order.orderName ?? '',
          vendorId: order.vendorId ?? 0,
          orderDate: order.orderDate ?? dayjs().format('YYYY-MM-DD'),
          expectedDate: order.expectedDate ?? '',
          remark: order.remark ?? '',
          items: [emptyItem()],
        });
      } else {
        setForm({
          orderNo: '',
          orderName: '',
          vendorId: 0,
          orderDate: dayjs().format('YYYY-MM-DD'),
          expectedDate: '',
          remark: '',
          items: [emptyItem()],
        });
      }
    }
  }, [open, order]);

  const updateField = (field: keyof CreatePurchaseOrderRequest, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: unknown) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      const qty = field === 'quantity' ? Number(value) : Number(items[index].quantity);
      const price = field === 'unitPrice' ? Number(value) : Number(items[index].unitPrice);
      items[index].amount = qty * price;
    }
    setForm(prev => ({ ...prev, items }));
  };

  const addItem = () => {
    setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }));
  };

  const removeItem = (index: number) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.orderNo.trim() || !form.orderName.trim() || !form.vendorId) return;
    const total = form.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
    onSubmit({ ...form, totalAmount: total });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? '编辑采购订单' : '新增采购订单'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label="采购单号 *" placeholder="如 PO-2024-001"
              value={form.orderNo}
              onChange={e => updateField('orderNo', e.target.value)} required />
            <Input label="采购名称 *" placeholder="请输入采购名称"
              value={form.orderName}
              onChange={e => updateField('orderName', e.target.value)} required />
            <Select label="供应商 *" value={String(form.vendorId)}
              onValueChange={v => updateField('vendorId', Number(v))}>
              {vendors.map(v => (
                <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="采购日期" type="date"
              value={form.orderDate ?? ''}
              onChange={e => updateField('orderDate', e.target.value)} />
            <Input label="预计到货" type="date"
              value={form.expectedDate ?? ''}
              onChange={e => updateField('expectedDate', e.target.value)} />
          </div>
          <Input label="备注" placeholder="请输入备注"
            value={form.remark ?? ''}
            onChange={e => updateField('remark', e.target.value)} />

          {/* 采购明细 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#374151]">采购明细</span>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-3.5 h-3.5" /> 添加行
              </Button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#64748b]">资产名称 *</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#64748b]">规格型号</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-[#64748b] w-20">数量</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-[#64748b] w-28">单价</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-[#64748b] w-28">金额</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-[#64748b] w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-1.5">
                        <input type="text" value={item.assetName}
                          onChange={e => updateItem(i, 'assetName', e.target.value)}
                          className="w-full h-8 px-2 rounded-lg border border-slate-200 text-sm
                            focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                          placeholder="资产名称" required />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="text" value={item.specification ?? ''}
                          onChange={e => updateItem(i, 'specification', e.target.value)}
                          className="w-full h-8 px-2 rounded-lg border border-slate-200 text-sm
                            focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                          placeholder="规格型号" />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" min={1} value={item.quantity}
                          onChange={e => updateItem(i, 'quantity', Number(e.target.value))}
                          className="w-full h-8 px-2 rounded-lg border border-slate-200 text-sm text-center
                            focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500" />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" min={0} step="0.01" value={item.unitPrice}
                          onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))}
                          className="w-full h-8 px-2 rounded-lg border border-slate-200 text-sm text-right
                            focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500" />
                      </td>
                      <td className="px-3 py-1.5 text-right text-sm text-[#374151]">
                        {(item.amount ?? ((item.quantity || 0) * (item.unitPrice || 0))).toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button type="button" onClick={() => removeItem(i)}
                          disabled={form.items.length <= 1}
                          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>取消</Button>
          <Button type="button" variant="primary" loading={submitting} onClick={() => {
            /* Trigger form submit via hidden button */
            const formEl = document.querySelector('form');
            if (formEl) formEl.requestSubmit();
          }}>
            {order ? '保存修改' : '确认新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 采购单详情抽屉 ──

interface OrderDetailSheetProps {
  open: boolean;
  orderId: number | null;
  onClose: () => void;
}

function OrderDetailSheet({ open, orderId, onClose }: OrderDetailSheetProps) {
  const { data: result, isLoading } = useQuery({
    queryKey: PAGE_KEYS.detail(orderId ?? 0),
    queryFn: async () => {
      const res = await getPurchaseOrderDetail(orderId!);
      return res.data as { order: PurchaseOrder; items: PurchaseOrderItem[] };
    },
    enabled: open && orderId !== null,
  });

  if (!open) return null;

  const order = result?.order;
  const items = result?.items ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full shadow-xl overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-[#0f172a]">采购订单详情</h3>
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-[#64748b] hover:bg-slate-100 transition-colors">&#x2715;</button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />加载中...
            </div>
          ) : order ? (
            <div className="space-y-5">
              <div className="flex items-start gap-4 pb-5 border-b border-slate-100">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <ShoppingCart className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-[#0f172a]">{order.orderName}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{order.orderNo}</p>
                  <div className="mt-2">
                    <StatusTag status={order.status} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400">供应商</p>
                  <p className="text-[#0f172a] font-medium">{order.vendorName ?? `ID: ${order.vendorId}`}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">总金额</p>
                  <p className="text-[#0f172a] font-medium">&yen;{(order.totalAmount ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">采购日期</p>
                  <p className="text-[#0f172a]">{order.orderDate ?? '\u2014'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">预计到货</p>
                  <p className="text-[#0f172a]">{order.expectedDate ?? '\u2014'}</p>
                </div>
              </div>

              {order.remark && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">备注</p>
                  <p className="text-sm text-[#0f172a]">{order.remark}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-[#0f172a] mb-3">采购明细</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-[#64748b]">资产名称</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-[#64748b]">规格</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-[#64748b]">数量</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-[#64748b]">单价</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-[#64748b]">金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400 text-sm">暂无明细</td></tr>
                      ) : items.map((item, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-3 py-2 text-[#374151]">{item.assetName}</td>
                          <td className="px-3 py-2 text-[#64748b]">{item.specification || '\u2014'}</td>
                          <td className="px-3 py-2 text-center text-[#374151]">{item.quantity}</td>
                          <td className="px-3 py-2 text-right text-[#374151]">&yen;{(item.unitPrice ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-[#374151] font-medium">&yen;{(item.amount ?? 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                创建时间：{order.createdAt ? dayjs(order.createdAt).format('YYYY-MM-DD HH:mm') : '\u2014'}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">暂无数据</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 删除确认弹窗 ──

interface DeleteConfirmDialogProps {
  open: boolean;
  order: PurchaseOrder | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ open, order, deleting, onClose, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open && !!order} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">
          <p className="text-sm text-[#64748b]">
            确定要删除采购单「<span className="font-medium text-[#0f172a]">{order?.orderName}</span>」吗？此操作不可撤销。
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>取消</Button>
          <Button type="button" variant="primary" onClick={onConfirm} loading={deleting}>确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 主页面 ──

export default function PurchaseOrderPage() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState<PurchaseOrder | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);

  const queryParams: PurchaseOrderListQuery = {
    keyword: searchTerm.trim() || undefined,
    status: statusFilter || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  // ── 查询 ──

  const { data: listData, isLoading, isFetching } = useQuery({
    queryKey: PAGE_KEYS.list(queryParams),
    queryFn: async () => {
      const res = await getPurchaseOrderList(queryParams);
      return res.data;
    },
  });

  const { data: statsData } = useQuery({
    queryKey: PAGE_KEYS.stats(),
    queryFn: async () => {
      const res = await getPurchaseOrderStats();
      return res.data as PurchaseOrderStats;
    },
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', 'list', { page: 1, pageSize: 999 }],
    queryFn: async () => {
      const res = await getVendorList({ page: 1, pageSize: 999 });
      return res;
    },
  });

  const orders: PurchaseOrder[] = listData?.records ?? [];
  const total = listData?.total ?? 0;
  const totalPages = listData?.pages ?? Math.ceil(total / PAGE_SIZE);
  const vendors: Vendor[] = vendorsData?.records ?? [];
  const stats = statsData ?? { totalOrders: 0, pendingApproval: 0, approved: 0, received: 0 };

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: (data: CreatePurchaseOrderRequest) => createPurchaseOrder(data),
    onSuccess: () => {
      toast.success('采购单新增成功');
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
      qc.invalidateQueries({ queryKey: PAGE_KEYS.stats() });
      setDialogOpen(false);
      setEditingOrder(null);
    },
    onError: () => toast.error('新增采购单失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreatePurchaseOrderRequest> }) =>
      updatePurchaseOrder(id, data),
    onSuccess: () => {
      toast.success('采购单更新成功');
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setDialogOpen(false);
      setEditingOrder(null);
    },
    onError: () => toast.error('更新采购单失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePurchaseOrder(id),
    onSuccess: () => {
      toast.success('采购单删除成功');
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
      qc.invalidateQueries({ queryKey: PAGE_KEYS.stats() });
      setDeleteDialogOpen(false);
      setDeletingOrder(null);
    },
    onError: () => toast.error('删除采购单失败'),
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => submitPurchaseOrder(id),
    onSuccess: () => {
      toast.success('采购单已提交审批');
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
      qc.invalidateQueries({ queryKey: PAGE_KEYS.stats() });
    },
    onError: () => toast.error('提交失败'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => approvePurchaseOrder(id),
    onSuccess: () => {
      toast.success('采购单已审批通过');
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
      qc.invalidateQueries({ queryKey: PAGE_KEYS.stats() });
    },
    onError: () => toast.error('审批失败'),
  });

  const receiveMutation = useMutation({
    mutationFn: (id: number) => receivePurchaseOrder(id),
    onSuccess: () => {
      toast.success('采购单已收货');
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
      qc.invalidateQueries({ queryKey: PAGE_KEYS.stats() });
    },
    onError: () => toast.error('收货失败'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelPurchaseOrder(id),
    onSuccess: () => {
      toast.success('采购单已取消');
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
      qc.invalidateQueries({ queryKey: PAGE_KEYS.stats() });
    },
    onError: () => toast.error('取消失败'),
  });

  // ── 搜索防抖 ──

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchTerm(value);
      setPage(1);
    }, 300);
  }, []);

  // ── 表单提交 ──

  const handleSubmit = (data: CreatePurchaseOrderRequest) => {
    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (deletingOrder) deleteMutation.mutate(deletingOrder.id);
  };

  const submitting = createMutation.isPending || updateMutation.isPending;

  // ── Columns ──

  const columns: Column<PurchaseOrder>[] = [
    { key: 'orderNo', title: '采购单号', width: 150 },
    { key: 'orderName', title: '采购名称' },
    {
      key: 'vendorName', title: '供应商', width: 140,
      render: (_v, row) => row.vendorName ?? `#${row.vendorId}`,
    },
    {
      key: 'totalAmount', title: '金额', width: 120, align: 'right',
      render: (v) => `\u00a5${(Number(v) ?? 0).toLocaleString()}`,
    },
    {
      key: 'orderDate', title: '采购日期', width: 110,
      render: (v) => v ? dayjs(String(v)).format('YYYY-MM-DD') : '\u2014',
    },
    {
      key: 'status', title: '状态', width: 100,
      render: (v) => <StatusTag status={String(v)} />,
    },
    {
      key: 'action', title: '操作', width: 240,
      render: (_v, row) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setDetailOrderId(row.id); setDetailOpen(true); }}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors" title="查看">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setEditingOrder(row); setDialogOpen(true); }}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors" title="编辑">
            <FileEdit className="w-3.5 h-3.5" />
          </button>
          {row.status === 'DRAFT' && (
            <button onClick={(e) => { e.stopPropagation(); submitMutation.mutate(row.id); }}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-amber-200 bg-white px-2 text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors" title="提交审批">
              <SendHorizontal className="w-3.5 h-3.5" />
            </button>
          )}
          {row.status === 'PENDING' && (
            <button onClick={(e) => { e.stopPropagation(); approveMutation.mutate(row.id); }}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors" title="审批通过">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}
          {row.status === 'APPROVED' && (
            <button onClick={(e) => { e.stopPropagation(); receiveMutation.mutate(row.id); }}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-cyan-200 bg-white px-2 text-xs font-medium text-cyan-600 hover:bg-cyan-50 transition-colors" title="收货">
              <PackageCheck className="w-3.5 h-3.5" />
            </button>
          )}
          {(row.status === 'DRAFT' || row.status === 'PENDING' || row.status === 'APPROVED') && (
            <button onClick={(e) => { e.stopPropagation(); cancelMutation.mutate(row.id); }}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-red-200 bg-white px-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors" title="取消">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {row.status === 'DRAFT' && (
            <button onClick={(e) => { e.stopPropagation(); setDeletingOrder(row); setDeleteDialogOpen(true); }}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-red-200 bg-white px-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors" title="删除">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Compact header with stat bar ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">采购订单管理</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                    <ShoppingCart className="h-3 w-3" />
                    采购
                  </span>
                </div>
                <p className="text-sm text-[#64748b]">采购订单创建、审批与收货全流程管理</p>
              </div>
            </div>
            <Button variant="primary" onClick={() => { setEditingOrder(null); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />新增采购单
            </Button>
          </div>
          {/* Stat bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-sm">
                <ShoppingCart className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">总采购单</p>
                <p className="text-lg font-bold text-slate-900">{stats.totalOrders}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-400 shadow-sm">
                <Clock className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">待审批</p>
                <p className="text-lg font-bold text-slate-900">{stats.pendingApproval}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">已审批</p>
                <p className="text-lg font-bold text-slate-900">{stats.approved}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-400 shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">已完成</p>
                <p className="text-lg font-bold text-slate-900">{stats.received}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Main content ── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Toolbar */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="搜索采购单号、名称..."
                value={searchInput}
                onChange={e => handleSearchChange(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-slate-200 bg-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 placeholder:text-slate-400" />
            </div>
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: ['purchaseOrders'] })}
              disabled={isFetching}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>

          {/* Quick filter pills */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-2.5 flex-wrap">
            <button
              type="button"
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === ''
                  ? 'border-blue-500 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
              onClick={() => { setStatusFilter(''); setPage(1); }}
            >
              全部状态
            </button>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <button
                key={k}
                type="button"
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === k
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
                onClick={() => { setStatusFilter(k); setPage(1); }}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* DataTable */}
          <DataTable<PurchaseOrder>
            columns={columns}
            data={orders}
            loading={isLoading}
            pagination={{ page, pageSize: PAGE_SIZE, total, onChange: (p) => setPage(p) }}
            onRowClick={(row) => { setDetailOrderId(row.id); setDetailOpen(true); }}
          />
        </Card>

        {/* 新增/编辑弹窗 */}
        <OrderFormDialog
          open={dialogOpen}
          order={editingOrder}
          submitting={submitting}
          vendors={vendors}
          onClose={() => { setDialogOpen(false); setEditingOrder(null); }}
          onSubmit={handleSubmit}
        />

        {/* 删除确认 */}
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          order={deletingOrder}
          deleting={deleteMutation.isPending}
          onClose={() => { setDeleteDialogOpen(false); setDeletingOrder(null); }}
          onConfirm={handleDelete}
        />

        {/* 详情抽屉 */}
        <OrderDetailSheet
          open={detailOpen}
          orderId={detailOrderId}
          onClose={() => { setDetailOpen(false); setDetailOrderId(null); }}
        />
      </div>
    </div>
  );
}
