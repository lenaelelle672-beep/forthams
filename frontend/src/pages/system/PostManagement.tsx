import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/DataTable';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getPostList, createPost, updatePost, deletePost,
  type PostItem,
} from '@/api/post';

export default function PostManagement() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [keyword, setKeyword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PostItem | null>(null);
  const [form, setForm] = useState({ postCode: '', postName: '', sortOrder: 0, status: 1, remark: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['posts', page, keyword],
    queryFn: () => getPostList(page, pageSize, keyword.trim() || undefined),
  });

  const createMut = useMutation({
    mutationFn: createPost,
    onSuccess: () => { toast.success('岗位创建成功'); qc.invalidateQueries({ queryKey: ['posts'] }); closeDialog(); },
    onError: () => toast.error('岗位创建失败'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Parameters<typeof updatePost>[1]) => updatePost(id, data),
    onSuccess: () => { toast.success('岗位更新成功'); qc.invalidateQueries({ queryKey: ['posts'] }); closeDialog(); },
    onError: () => toast.error('岗位更新失败'),
  });

  const deleteMut = useMutation({
    mutationFn: deletePost,
    onSuccess: () => { toast.success('岗位已删除'); qc.invalidateQueries({ queryKey: ['posts'] }); },
    onError: () => toast.error('删除失败'),
  });

  function openCreate() {
    setEditingPost(null);
    setForm({ postCode: '', postName: '', sortOrder: 0, status: 1, remark: '' });
    setDialogOpen(true);
  }

  function openEdit(post: PostItem) {
    setEditingPost(post);
    setForm({
      postCode: post.postCode,
      postName: post.postName,
      sortOrder: post.sortOrder ?? 0,
      status: post.status ?? 1,
      remark: post.remark ?? '',
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingPost(null);
  }

  function handleSave() {
    if (!form.postCode.trim() || !form.postName.trim()) {
      toast.error('岗位编码和岗位名称不能为空');
      return;
    }
    const payload = { ...form };
    if (editingPost) {
      updateMut.mutate({ id: editingPost.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const columns = [
    { key: 'id', title: 'ID', width: '80px' },
    { key: 'postCode', title: '岗位编码' },
    { key: 'postName', title: '岗位名称' },
    {
      key: 'sortOrder', title: '排序',
      render: (_: unknown, row: PostItem) => row.sortOrder ?? 0,
    },
    {
      key: 'status', title: '状态',
      render: (_: unknown, row: PostItem) => (
        <Badge variant={row.status === 1 ? 'default' : 'secondary'}>
          {row.status === 1 ? '启用' : '停用'}
        </Badge>
      ),
    },
    {
      key: 'actions', title: '操作',
      render: (_: unknown, row: PostItem) => (
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
        <h1 className="text-xl font-semibold">岗位管理</h1>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />新增岗位</Button>
      </div>

      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        <Input
          placeholder="搜索岗位编码/名称"
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
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPost ? '编辑岗位' : '新增岗位'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">岗位编码</label>
              <Input value={form.postCode} onChange={(e) => setForm({ ...form, postCode: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">岗位名称</label>
              <Input value={form.postName} onChange={(e) => setForm({ ...form, postName: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">排序</label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-sm font-medium">状态</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: Number(e.target.value) })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={1}>正常</option>
                <option value={0}>停用</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">备注</label>
              <Input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog}>取消</Button>
              <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
                {editingPost ? '保存' : '创建'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
