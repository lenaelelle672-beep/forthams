import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, Package, Layers, Factory, Braces, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getAssetModels, createAssetModel, updateAssetModel, deleteAssetModel, type AssetModel } from '@/api/assetModel';
import http from '@/utils/http';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Select, SelectItem } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';

interface CategoryOption { id: number; categoryName: string; }
interface ManufacturerOption { id: number; name: string; }
interface FieldsetOption { id: number; name: string; }

interface FormState {
  name: string;
  modelNo: string;
  categoryId: string;
  manufacturerId: string;
  fieldsetId: string;
  specifications: string;
  description: string;
  remark: string;
  status: string;
}

const EMPTY_FORM: FormState = {
  name: '', modelNo: '', categoryId: '', manufacturerId: '',
  fieldsetId: '', specifications: '', description: '', remark: '', status: '0',
};

export default function AssetModelPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<AssetModel | null>(null);
  const [specsView, setSpecsView] = useState<Record<string, unknown> | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['categoryOptions'],
    queryFn: () => http.get<CategoryOption[]>('/categories/all'),
  });
  const manufacturersQuery = useQuery({
    queryKey: ['manufacturerOptions'],
    queryFn: () => http.get<ManufacturerOption[]>('/manufacturers/options'),
  });
  const fieldsetsQuery = useQuery({
    queryKey: ['fieldsetOptions'],
    queryFn: () => http.get<FieldsetOption[]>('/system/custom-fieldsets/all'),
  });
  const { data, isLoading } = useQuery({
    queryKey: ['assetModels', { keyword, categoryFilter, manufacturerFilter, page, pageSize }],
    queryFn: () => getAssetModels({
      keyword, categoryId: categoryFilter ? Number(categoryFilter) : undefined,
      manufacturerId: manufacturerFilter ? Number(manufacturerFilter) : undefined, page, pageSize,
    }),
  });

  const records: AssetModel[] = (data as any)?.records ?? [];
  const total = (data as any)?.total ?? 0;
  const categories = (categoriesQuery.data as any) ?? [];
  const manufacturers = (manufacturersQuery.data as any) ?? [];
  const fieldsets = (fieldsetsQuery.data as any) ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assetModels'] });

  const createMutation = useMutation({
    mutationFn: createAssetModel,
    onSuccess: () => { invalidate(); toast.success('创建成功'); setFormOpen(false); },
    onError: (e: any) => toast.error(e?.message || '创建失败'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: number; data: AssetModel }) => updateAssetModel(id, d),
    onSuccess: () => { invalidate(); toast.success('更新成功'); setFormOpen(false); },
    onError: (e: any) => toast.error(e?.message || '更新失败'),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteAssetModel,
    onSuccess: () => { invalidate(); toast.success('删除成功'); setDeleteTarget(null); },
    onError: (e: any) => toast.error(e?.message || '删除失败'),
  });

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (r: AssetModel) => {
    setEditId(r.id!);
    let specs = r.specifications ?? '';
    if (specs && typeof specs === 'object') specs = JSON.stringify(specs, null, 2);
    setForm({
      name: r.name ?? '', modelNo: r.modelNo ?? '',
      categoryId: r.categoryId ? String(r.categoryId) : '',
      manufacturerId: r.manufacturerId ? String(r.manufacturerId) : '',
      fieldsetId: r.fieldsetId ? String(r.fieldsetId) : '',
      specifications: specs, description: r.description ?? '',
      remark: r.remark ?? '', status: String(r.status ?? 0),
    });
    setFormOpen(true);
  };
  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('请输入模型名称'); return; }
    if (!form.categoryId) { toast.error('请选择分类'); return; }
    if (form.specifications) {
      try { JSON.parse(form.specifications); } catch { toast.error('规格参数不是合法的 JSON 格式'); return; }
    }
    const payload: AssetModel = {
      name: form.name, modelNo: form.modelNo || undefined,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      manufacturerId: form.manufacturerId ? Number(form.manufacturerId) : undefined,
      fieldsetId: form.fieldsetId ? Number(form.fieldsetId) : undefined,
      specifications: form.specifications || undefined,
      description: form.description || undefined,
      remark: form.remark || undefined, status: Number(form.status),
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload });
    else createMutation.mutate(payload);
  };
  const formatJson = () => {
    if (!form.specifications) return;
    try { setForm(f => ({ ...f, specifications: JSON.stringify(JSON.parse(f.specifications), null, 2) })); }
    catch { toast.error('JSON 格式无效'); }
  };

  const openSpecs = (row: AssetModel) => {
    if (!row.specifications) { toast.info('该模型没有规格参数'); return; }
    try {
      const parsed = typeof row.specifications === 'string' ? JSON.parse(row.specifications) : row.specifications;
      setSpecsView(parsed);
    } catch { toast.error('规格参数 JSON 解析失败'); }
  };

  const catName = (id: number) => categories.find((c: CategoryOption) => c.id === id)?.categoryName ?? '-';
  const mfgName = (id: number) => manufacturers.find((m: ManufacturerOption) => m.id === id)?.name ?? '-';
  const fsName = (id: number) => fieldsets.find((f: FieldsetOption) => f.id === id)?.name ?? '-';

  const columns: Column<AssetModel>[] = [
    {
      key: 'name', title: '模型名称',
      render: (_, row) => (
        <span className="font-medium text-[#0f172a]">{row.name}</span>
      ),
    },
    { key: 'modelNo', title: '型号', render: (v) => <span className="text-[#64748b]">{String(v ?? '-')}</span> },
    {
      key: 'categoryId', title: '分类',
      render: (v) => (
        <span className="inline-flex items-center gap-1 text-[#374151]">
          <Layers className="w-3.5 h-3.5 text-[#94a3b8]" />{catName(v as number)}
        </span>
      ),
    },
    {
      key: 'manufacturerId', title: '制造商',
      render: (v) => (
        <span className="inline-flex items-center gap-1 text-[#374151]">
          <Factory className="w-3.5 h-3.5 text-[#94a3b8]" />{mfgName(v as number)}
        </span>
      ),
    },
    {
      key: 'status', title: '状态',
      render: (v) => (
        <Badge variant={(v as number) === 0 ? 'success' : 'gray'}>
          {(v as number) === 0 ? '正常' : '停用'}
        </Badge>
      ),
    },
    {
      key: 'fieldsetId', title: '字段集',
      render: (v) => <span className="text-[#64748b]">{v ? fsName(v as number) : '-'}</span>,
    },
    {
      key: 'description', title: '描述', width: 160,
      render: (v) => (
        <span className="truncate block max-w-[140px] text-[#64748b]" title={String(v ?? '')}>
          {String(v ?? '-')}
        </span>
      ),
    },
    {
      key: 'id', title: '操作', width: 150, align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="text-[#64748b] hover:text-blue-600"
            onClick={() => openSpecs(row)} title="查看规格">
            <FileText className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <Pencil className="w-3.5 h-3.5" />编辑
          </Button>
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setDeleteTarget(row)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const activeCount = records.filter(r => r.status === 0).length;
  const inactiveCount = records.filter(r => r.status === 1).length;
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* Header */}
        <div className="rounded-2xl border border-[var(--surface-border)] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#0f172a]">资产模型管理</h1>
                <p className="mt-0.5 text-sm text-[#64748b]">管理资产品类的标准模板与规格定义</p>
              </div>
            </div>
            <Button onClick={openAdd}><Plus className="w-4 h-4" />新增模型</Button>
          </div>
          <div className="mt-4 flex items-center gap-6 border-t border-[#f1f5f9] pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#0f172a]">{total}</p>
              <p className="text-xs text-[#94a3b8]">全部模型</p>
            </div>
            <div className="h-8 w-px bg-[#e5e7eb]" />
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              <p className="text-xs text-[#94a3b8]">正常</p>
            </div>
            <div className="h-8 w-px bg-[#e5e7eb]" />
            <div className="text-center">
              <p className="text-2xl font-bold text-[#94a3b8]">{inactiveCount}</p>
              <p className="text-xs text-[#94a3b8]">停用</p>
            </div>
          </div>
        </div>

        {/* Filters + Table */}
        <Card className="overflow-hidden">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-end gap-3">
              <Input
                placeholder="搜索名称 / 型号" value={keyword} className="w-56"
                onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                prefix={<Search className="w-4 h-4" />}
              />
              <Select
                value={categoryFilter || 'all'}
                onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(1); }}
                placeholder="选择分类" className="w-44"
              >
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map((c: CategoryOption) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.categoryName}</SelectItem>
                ))}
              </Select>
              <Select
                value={manufacturerFilter || 'all'}
                onValueChange={(v) => { setManufacturerFilter(v === 'all' ? '' : v); setPage(1); }}
                placeholder="选择制造商" className="w-44"
              >
                <SelectItem value="all">全部制造商</SelectItem>
                {manufacturers.map((m: ManufacturerOption) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                ))}
              </Select>
            </div>
            <DataTable<AssetModel>
              columns={columns} data={records} loading={isLoading}
              pagination={{ page, pageSize, total, onChange: (p) => setPage(p) }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-[600px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? '编辑资产模型' : '新增资产模型'}</DialogTitle>
            <DialogDescription>{editId ? '修改资产模型的属性与规格参数' : '定义一个新的资产模型模板'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <Input label="模型名称 *" placeholder="如：Dell Latitude 5540" value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="型号" placeholder="产品型号" value={form.modelNo}
              onChange={(e) => setForm(f => ({ ...f, modelNo: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <Select label="分类 *" value={form.categoryId}
                onValueChange={(v) => setForm(f => ({ ...f, categoryId: v }))} placeholder="选择分类">
                {categories.map((c: CategoryOption) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.categoryName}</SelectItem>
                ))}
              </Select>
              <Select label="制造商" value={form.manufacturerId}
                onValueChange={(v) => setForm(f => ({ ...f, manufacturerId: v }))} placeholder="选择制造商">
                {manufacturers.map((m: ManufacturerOption) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="自定义字段集" value={form.fieldsetId}
                onValueChange={(v) => setForm(f => ({ ...f, fieldsetId: v }))} placeholder="选择字段集">
                {fieldsets.map((f: FieldsetOption) => (
                  <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                ))}
              </Select>
              <Select label="状态" value={form.status}
                onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectItem value="0">正常</SelectItem>
                <SelectItem value="1">停用</SelectItem>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#374151]">规格参数 (JSON)</label>
                <button type="button" onClick={formatJson}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                  <Braces className="w-3 h-3" />格式化
                </button>
              </div>
              <textarea
                className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 font-mono text-sm transition-all placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                rows={4} value={form.specifications}
                placeholder='{"cpu": "Intel i7", "memory": "32GB"}'
                onChange={(e) => setForm(f => ({ ...f, specifications: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">描述</label>
              <textarea
                className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm transition-all placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                rows={2} value={form.description} placeholder="模型描述"
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">备注</label>
              <textarea
                className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm transition-all placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                rows={2} value={form.remark} placeholder="内部备注"
                onChange={(e) => setForm(f => ({ ...f, remark: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} loading={saving}>{editId ? '保存修改' : '创建模型'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除模型 &ldquo;{deleteTarget?.name}&rdquo; 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" loading={deleteMutation.isPending}
              onClick={() => deleteTarget?.id && deleteMutation.mutate(deleteTarget.id)}>
              <Trash2 className="w-4 h-4" />删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Specs Preview Dialog */}
      <Dialog open={!!specsView} onOpenChange={(open) => { if (!open) setSpecsView(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-4 h-4" />规格参数详情</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <pre className="max-h-[60vh] overflow-auto rounded-lg bg-[#f8fafc] p-4 text-sm font-mono text-[#374151] leading-relaxed">
              {JSON.stringify(specsView, null, 2)}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpecsView(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
