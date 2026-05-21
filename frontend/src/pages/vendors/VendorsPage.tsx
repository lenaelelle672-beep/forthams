/**
 * @file pages/vendors/VendorsPage.tsx
 * @description 供应商管理页面 — Design System 重构版
 *
 * 功能：供应商列表展示、搜索过滤、新增/编辑/删除操作
 * API: GET /api/vendors/list, POST /api/vendors, PUT /api/vendors/:id, DELETE /api/vendors/:id
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw, Building2, Phone, Mail, User } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

interface Vendor {
  id: number;
  name: string;
  vendorCode: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
}

type VendorFormData = Omit<Vendor, 'id'>;

// ─── Mock 数据（API 失败时兜底）─────────────────────────────────────────────

const MOCK_VENDORS: Vendor[] = [
  { id: 1, name: '华为技术有限公司', vendorCode: 'V001', contactPerson: '张伟', contactPhone: '13800138001', contactEmail: 'zhangwei@huawei.com' },
  { id: 2, name: '联想集团有限公司', vendorCode: 'V002', contactPerson: '李磊', contactPhone: '13800138002', contactEmail: 'lilei@lenovo.com' },
  { id: 3, name: '小米科技有限责任公司', vendorCode: 'V003', contactPerson: '王芳', contactPhone: '13800138003', contactEmail: 'wangfang@xiaomi.com' },
  { id: 4, name: '中兴通讯股份有限公司', vendorCode: 'V004', contactPerson: '刘洋', contactPhone: '13800138004', contactEmail: 'liuyang@zte.com' },
];

const EMPTY_FORM: VendorFormData = {
  name: '',
  vendorCode: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
};

// ─── API 函数 ────────────────────────────────────────────────────────────────

async function fetchVendors(): Promise<Vendor[]> {
  const res = await fetch('/api/vendors/list');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.data ?? data.records ?? []);
}

async function createVendor(body: VendorFormData): Promise<void> {
  const res = await fetch('/api/vendors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function updateVendor(id: number, body: VendorFormData): Promise<void> {
  const res = await fetch(`/api/vendors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function deleteVendor(id: number): Promise<void> {
  const res = await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ─── 内联表单弹窗 ────────────────────────────────────────────────────────────

interface VendorFormDialogProps {
  open: boolean;
  vendor: Vendor | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: VendorFormData) => void;
}

function VendorFormDialog({ open, vendor, submitting, onClose, onSubmit }: VendorFormDialogProps) {
  const [form, setForm] = useState<VendorFormData>(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm(vendor ? { name: vendor.name, vendorCode: vendor.vendorCode, contactPerson: vendor.contactPerson, contactPhone: vendor.contactPhone, contactEmail: vendor.contactEmail } : EMPTY_FORM);
    }
  }, [open, vendor]);

  if (!open) return null;

  const handleChange = (field: keyof VendorFormData, value: string) => {
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
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              required
            />
            <Input
              label="供应商编码"
              placeholder="如 V001"
              value={form.vendorCode}
              onChange={e => handleChange('vendorCode', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="联系人"
              placeholder="请输入联系人姓名"
              value={form.contactPerson}
              onChange={e => handleChange('contactPerson', e.target.value)}
            />
            <Input
              label="联系电话"
              placeholder="请输入联系电话"
              value={form.contactPhone}
              onChange={e => handleChange('contactPhone', e.target.value)}
            />
          </div>
          <Input
            label="邮箱"
            type="email"
            placeholder="请输入邮箱地址"
            value={form.contactEmail}
            onChange={e => handleChange('contactEmail', e.target.value)}
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

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── 数据加载 ───────────────────────────────────────────────────────────────

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchVendors();
      setVendors(data);
    } catch {
      console.warn('API 不可用，使用 Mock 数据');
      setVendors(MOCK_VENDORS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  // ── 搜索防抖 ──────────────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchTerm(value), 300);
  };

  const filtered = searchTerm.trim()
    ? vendors.filter(v => {
        const kw = searchTerm.toLowerCase();
        return (
          v.name?.toLowerCase().includes(kw) ||
          v.vendorCode?.toLowerCase().includes(kw) ||
          v.contactPerson?.toLowerCase().includes(kw) ||
          v.contactPhone?.includes(kw)
        );
      })
    : vendors;

  // ── 表单提交 ──────────────────────────────────────────────────────────────

  const handleSubmit = async (data: VendorFormData) => {
    if (!data.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingVendor) {
        try {
          await updateVendor(editingVendor.id, data);
        } catch {
          // Mock 模式：直接更新本地状态
          setVendors(prev => prev.map(v => v.id === editingVendor.id ? { ...v, ...data } : v));
        }
      } else {
        try {
          await createVendor(data);
          await loadVendors();
        } catch {
          // Mock 模式：追加到本地状态
          const newId = Math.max(0, ...vendors.map(v => v.id)) + 1;
          setVendors(prev => [...prev, { id: newId, ...data }]);
        }
      }
      if (editingVendor) {
        setVendors(prev => prev.map(v => v.id === editingVendor.id ? { ...v, ...data } : v));
      }
      setDialogOpen(false);
      setEditingVendor(null);
    } finally {
      setSubmitting(false);
    }
  };

  // ── 删除 ──────────────────────────────────────────────────────────────────

  const handleDelete = async (vendor: Vendor) => {
    if (!window.confirm(`确定要删除供应商「${vendor.name}」吗？此操作不可撤销。`)) return;
    try {
      await deleteVendor(vendor.id);
    } catch {
      // Mock 模式：仅本地删除
    }
    setVendors(prev => prev.filter(v => v.id !== vendor.id));
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

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

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
        <Button variant="outline" size="md" onClick={loadVendors} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-[#94a3b8] text-sm">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          加载中...
        </div>
      )}

      {/* 供应商列表 */}
      {!loading && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#94a3b8]">
              <Building2 className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">{searchTerm ? `未找到包含"${searchTerm}"的供应商` : '暂无供应商数据'}</p>
              {!searchTerm && (
                <Button variant="primary" size="sm" className="mt-4" onClick={handleOpenCreate}>
                  <Plus className="w-4 h-4" />
                  新增供应商
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(vendor => (
                <Card key={vendor.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-[#3b82f6]" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#0f172a] text-sm leading-tight">{vendor.name}</p>
                          <p className="text-xs text-[#94a3b8] mt-0.5">{vendor.vendorCode || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleOpenEdit(vendor)}
                          className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors"
                          title="编辑"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(vendor)}
                          className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs text-[#64748b]">
                      {vendor.contactPerson && (
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{vendor.contactPerson}</span>
                        </div>
                      )}
                      {vendor.contactPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{vendor.contactPhone}</span>
                        </div>
                      )}
                      {vendor.contactEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{vendor.contactEmail}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {filtered.length > 0 && (
            <p className="mt-4 text-xs text-[#94a3b8]">
              共 {filtered.length} 条记录{searchTerm ? `（搜索：「${searchTerm}」）` : ''}
            </p>
          )}
        </>
      )}

      {/* 新增/编辑弹窗 */}
      <VendorFormDialog
        open={dialogOpen}
        vendor={editingVendor}
        submitting={submitting}
        onClose={() => { setDialogOpen(false); setEditingVendor(null); }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
