import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { DataTable } from '@/components/ui/DataTable';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  getCustomFieldList, createCustomField, updateCustomField, deleteCustomField,
  FIELD_TYPES,
  type CustomFieldItem,
} from '@/api/customField';

const typeBadgeMap: Record<string, string> = {
  TEXT: 'bg-slate-100 text-slate-700',
  NUMBER: 'bg-blue-100 text-blue-700',
  DATE: 'bg-green-100 text-green-700',
  DROPDOWN: 'bg-purple-100 text-purple-700',
  BOOLEAN: 'bg-amber-100 text-amber-700',
  URL: 'bg-cyan-100 text-cyan-700',
  EMAIL: 'bg-pink-100 text-pink-700',
  REGEX: 'bg-red-100 text-red-700',
};

export default function CustomFieldsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [keyword, setKeyword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFieldItem | null>(null);
  const [form, setForm] = useState({
    fieldName: '', fieldLabel: '', fieldType: 'TEXT', fieldOptions: '',
    validationPattern: '', fieldOrder: 0, required: 0, encrypted: 0, status: 1,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['customFields', page, keyword],
    queryFn: () => getCustomFieldList(page, pageSize, keyword.trim() || undefined),
  });

  const createMut = useMutation({
    mutationFn: createCustomField,
    onSuccess: () => { toast.success('字段创建成功'); qc.invalidateQueries({ queryKey: ['customFields'] }); closeDialog(); },
    onError: () => toast.error('字段创建失败'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: { id: number } & Parameters<typeof updateCustomField>[1]) => updateCustomField(id, d),
    onSuccess: () => { toast.success('字段更新成功'); qc.invalidateQueries({ queryKey: ['customFields'] }); closeDialog(); },
    onError: () => toast.error('字段更新失败'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () => { toast.success('字段已删除'); qc.invalidateQueries({ queryKey: ['customFields'] }); },
    onError: () => toast.error('删除失败'),
  });

  function openCreate() {
    setEditing(null);
    setForm({ fieldName: '', fieldLabel: '', fieldType: 'TEXT', fieldOptions: '', validationPattern: '', fieldOrder: 0, required: 0, encrypted: 0, status: 1 });
    setDialogOpen(true);
  }

  function openEdit(field: CustomFieldItem) {
    setEditing(field);
    setForm({
      fieldName: field.fieldName,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      fieldOptions: field.fieldOptions ?? '',
      validationPattern: field.validationPattern ?? '',
      fieldOrder: field.fieldOrder ?? 0,
      required: field.required ?? 0,
      encrypted: field.encrypted ?? 0,
      status: field.status ?? 1,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  function handleSave() {
    if (!form.fieldName.trim() || !form.fieldLabel.trim()) {
      toast.error('字段名和显示名不能为空');
      return;
    }
    if (form.fieldType === 'DROPDOWN' && !form.fieldOptions.trim()) {
      toast.error('下拉类型需要填写选项（JSON 数组）');
      return;
    }
    const payload = { ...form };
    if (editing) {
      updateMut.mutate({ id: editing.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const columns = [
    { key: 'id', title: 'ID', width: '80px' },
    { key: 'fieldName', title: '字段名' },
    { key: 'fieldLabel', title: '显示名' },
    {
      key: 'fieldType', title: '类型',
      render: (_: unknown, row: CustomFieldItem) => (
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${typeBadgeMap[row.fieldType] ?? 'bg-slate-100 text-slate-700'}`}>
          {FIELD_TYPES.find(t => t.value === row.fieldType)?.label ?? row.fieldType}
        </span>
      ),
    },
    {
      key: 'required', title: '必填',
      render: (_: unknown, row: CustomFieldItem) => row.required === 1 ? '是' : '否',
    },
    {
      key: 'status', title: '状态',
      render: (_: unknown, row: CustomFieldItem) => (
        <Badge variant={row.status === 1 ? 'default' : 'gray'}>
          {row.status === 1 ? '启用' : '停用'}
        </Badge>
      ),
    },
    {
      key: 'actions', title: '操作',
      render: (_: unknown, row: CustomFieldItem) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(row.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">自定义字段管理</h1>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />新增字段</Button>
      </div>

      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        <Input
          placeholder="搜索字段名/显示名"
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={data?.records ?? []}
          loading={isLoading}
          pagination={{
            page,
            pageSize,
            total: data?.total ?? 0,
            onChange: (p, _ps) => setPage(p),
          }}
        />
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑字段' : '新增字段'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">字段名</label>
                <Input value={form.fieldName} onChange={(e) => setForm({ ...form, fieldName: e.target.value })} placeholder="英文标识" />
              </div>
              <div>
                <label className="text-sm font-medium">显示名</label>
                <Input value={form.fieldLabel} onChange={(e) => setForm({ ...form, fieldLabel: e.target.value })} placeholder="中文显示名" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">字段类型</label>
              <select
                value={form.fieldType}
                onChange={(e) => setForm({ ...form, fieldType: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {form.fieldType === 'DROPDOWN' && (
              <div>
                <label className="text-sm font-medium">选项（JSON 数组）</label>
                <Input value={form.fieldOptions} onChange={(e) => setForm({ ...form, fieldOptions: e.target.value })} placeholder='["选项1","选项2"]' />
              </div>
            )}
            {form.fieldType === 'REGEX' && (
              <div>
                <label className="text-sm font-medium">正则表达式</label>
                <Input value={form.validationPattern} onChange={(e) => setForm({ ...form, validationPattern: e.target.value })} placeholder="^[A-Z].*" />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">排序</label>
                <Input type="number" value={form.fieldOrder} onChange={(e) => setForm({ ...form, fieldOrder: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">必填</label>
                <select
                  value={form.required}
                  onChange={(e) => setForm({ ...form, required: Number(e.target.value) })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value={0}>否</option>
                  <option value={1}>是</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">状态</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: Number(e.target.value) })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value={1}>启用</option>
                  <option value={0}>停用</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog}>取消</Button>
              <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
                {editing ? '保存' : '创建'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
