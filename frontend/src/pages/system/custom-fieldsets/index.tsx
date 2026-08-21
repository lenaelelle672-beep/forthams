import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { DataTable } from '@/components/ui/DataTable';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  getCustomFieldsetList,
  getFieldsetFields,
  type CustomFieldsetItem,
  type CustomFieldItem
} from '@/api/customField';

export default function CustomFieldsetsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [keyword, setKeyword] = useState('');
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [selectedFieldset, setSelectedFieldset] = useState<CustomFieldsetItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customFieldsets', page, keyword],
    queryFn: () => getCustomFieldsetList(page, pageSize, keyword.trim() || undefined),
  });

  const { data: fieldsetFields } = useQuery({
    queryKey: ['fieldsetFields', selectedFieldset?.id],
    queryFn: () => getFieldsetFields(selectedFieldset!.id),
    enabled: !!selectedFieldset,
  });

  function openFieldDialog(fieldset: CustomFieldsetItem) {
    setSelectedFieldset(fieldset);
    setFieldDialogOpen(true);
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
      key: 'actions', title: '操作', width: '100px',
      render: (_: unknown, row: CustomFieldsetItem) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openFieldDialog(row)} title="查看字段">
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">自定义字段集管理</h1>
      </div>

      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        <Input
          placeholder="搜索字段集名称"
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          className="max-w-xs"
          aria-label="搜索字段集"
        />
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={Array.isArray(data?.records) ? data.records : []}
          loading={isLoading}
          pagination={{
            page,
            pageSize,
            total: data?.total ?? 0,
            onChange: (p, _ps) => setPage(p),
          }}
        />
      </Card>

      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>字段集字段 - {selectedFieldset?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="max-h-80 overflow-y-auto space-y-2">
              {(!Array.isArray(fieldsetFields) || fieldsetFields.length === 0) ? (
                <p className="py-6 text-center text-sm text-slate-400">该字段集暂无字段</p>
              ) : (
                fieldsetFields.map((field: CustomFieldItem) => (
                  <div key={field.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50">
                    <span className="text-sm">{field.fieldLabel}</span>
                    <span className="text-xs text-slate-400">({field.fieldName})</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>关闭</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
