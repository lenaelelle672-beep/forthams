import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { DataTable } from '@/components/ui/DataTable';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  getCustomFieldsetList, createCustomFieldset, updateCustomFieldset, deleteCustomFieldset,
  getFieldsetFields, assignFieldsToFieldset, getCustomFieldAll,
  type CustomFieldsetItem, type CustomFieldItem,
} from '@/api/customField';

export default function CustomFieldsetsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [keyword, setKeyword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFieldsetItem | null>(null);
  const [form, setForm] = useState({ name: '', description: '', status: 1 });
  const [selectedFieldset, setSelectedFieldset] = useState<CustomFieldsetItem | null>(null);
  const [assignedFieldIds, setAssignedFieldIds] = useState<number[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['customFieldsets', page, keyword],
    queryFn: () => getCustomFieldsetList(page, pageSize, keyword.trim() || undefined),
  });

  const { data: allFields } = useQuery({
    queryKey: ['allFields'],
    queryFn: () => getCustomFieldAll(),
  });

  const { data: fieldsetFields, refetch: refetchFieldsetFields } = useQuery({
    queryKey: ['fieldsetFields', selectedFieldset?.id],
    queryFn: () => getFieldsetFields(selectedFieldset!.id),
    enabled: !!selectedFieldset,
  });

  const createMut = useMutation({
    mutationFn: createCustomFieldset,
    onSuccess: () => { toast.success('字段集创建成功'); qc.invalidateQueries({ queryKey: ['customFieldsets'] }); closeDialog(); },
    onError: () => toast.error('字段集创建失败'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: { id: number } & Parameters<typeof updateCustomFieldset>[1]) => updateCustomFieldset(id, d),
    onSuccess: () => { toast.success('字段集更新成功'); qc.invalidateQueries({ queryKey: ['customFieldsets'] }); closeDialog(); },
    onError: () => toast.error('字段集更新失败'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCustomFieldset,
    onSuccess: () => { toast.success('字段集已删除'); qc.invalidateQueries({ queryKey: ['customFieldsets'] }); },
    onError: () => toast.error('删除失败'),
  });

  const assignMut = useMutation({
    mutationFn: ({ fieldsetId, fieldIds }: { fieldsetId: number; fieldIds: number[] }) => assignFieldsToFieldset(fieldsetId, fieldIds),
    onSuccess: () => { toast.success('字段分配成功'); refetchFieldsetFields(); setFieldDialogOpen(false); },
    onError: () => toast.error('字段分配失败'),
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', status: 1 });
    setDialogOpen(true);
  }

  function openEdit(fieldset: CustomFieldsetItem) {
    setEditing(fieldset);
    setForm({
      name: fieldset.name,
      description: fieldset.description ?? '',
      status: fieldset.status ?? 1,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error('字段集名称不能为空');
      return;
    }
    const payload = { ...form };
    if (editing) {
      updateMut.mutate({ id: editing.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function openFieldDialog(fieldset: CustomFieldsetItem) {
    setSelectedFieldset(fieldset);
    setAssignedFieldIds(fieldsetFields?.map(f => f.id) ?? []);
    setFieldDialogOpen(true);
  }

  function handleAssign() {
    if (!selectedFieldset) return;
    assignMut.mutate({ fieldsetId: selectedFieldset.id, fieldIds: assignedFieldIds });
  }

  const columns = [
    { key: 'id', title: 'ID', width: '80px' },
    { key: 'name', title: '字段集名称' },
    { key: 'description', title: '描述' },
    {
      key: 'status', title: '状态',
      render: (_: unknown, row: CustomFieldsetItem) => (
        <Badge variant={row.status === 1 ? 'default' : 'gray'}>
          {row.status === 1 ? '启用' : '停用'}
        </Badge>
      ),
    },
    {
      key: 'actions', title: '操作', width: '180px',
      render: (_: unknown, row: CustomFieldsetItem) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openFieldDialog(row)} title="分配字段">
            <Eye className="w-4 h-4" />
          </Button>
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
        <h1 className="text-xl font-semibold">自定义字段集管理</h1>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />新增字段集</Button>
      </div>

      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        <Input
          placeholder="搜索字段集名称"
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑字段集' : '新增字段集'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">名称</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">描述</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog}>取消</Button>
              <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
                {editing ? '保存' : '创建'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>分配字段 - {selectedFieldset?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="max-h-80 overflow-y-auto space-y-2">
              {allFields?.filter(f => f.status === 1).map(field => (
                <label key={field.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignedFieldIds.includes(field.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAssignedFieldIds([...assignedFieldIds, field.id]);
                      } else {
                        setAssignedFieldIds(assignedFieldIds.filter(id => id !== field.id));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{field.fieldLabel}</span>
                  <span className="text-xs text-slate-400">({field.fieldName})</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>取消</Button>
              <Button onClick={handleAssign} disabled={assignMut.isPending}>保存分配</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
