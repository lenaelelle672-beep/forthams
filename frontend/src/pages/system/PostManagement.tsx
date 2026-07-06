import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Briefcase, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Select, SelectItem } from '@/components/ui/Select';
import {
  getPostList,
  createPost,
  updatePost,
  deletePost,
  type PostItem,
} from '@/api/post';

type PostForm = {
  postCode: string;
  postName: string;
  sortOrder: string;
  status: number;
  remark: string;
};

const emptyForm: PostForm = {
  postCode: '',
  postName: '',
  sortOrder: '0',
  status: 1,
  remark: '',
};

function PostFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: PostItem | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PostForm>(emptyForm);

  React.useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          postCode: editing.postCode,
          postName: editing.postName,
          sortOrder: String(editing.sortOrder ?? 0),
          status: editing.status ?? 1,
          remark: editing.remark ?? '',
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [editing, open]);

  const createMut = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      toast.success('岗位创建成功');
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || '岗位创建失败'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updatePost>[1] }) =>
      updatePost(id, data),
    onSuccess: () => {
      toast.success('岗位更新成功');
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || '岗位更新失败'),
  });

  const handleSubmit = () => {
    const postCode = form.postCode.trim();
    const postName = form.postName.trim();
    if (!postCode || !postName) {
      toast.error('岗位编码和岗位名称不能为空');
      return;
    }
    const payload = {
      postCode,
      postName,
      sortOrder: Number(form.sortOrder || 0),
      status: form.status,
      remark: form.remark.trim() || undefined,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editing ? '编辑岗位' : '新增岗位'}>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="岗位编码 *"
              value={form.postCode}
              onChange={(e) => setForm({ ...form, postCode: e.target.value })}
              placeholder="如：CEO、CTO"
            />
            <Input
              label="岗位名称 *"
              value={form.postName}
              onChange={(e) => setForm({ ...form, postName: e.target.value })}
              placeholder="如：董事长、首席执行官"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="排序"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              placeholder="数字越小越靠前"
            />
            <Select
              label="状态"
              value={String(form.status)}
              onValueChange={(v) => setForm({ ...form, status: Number(v) })}
            >
              <SelectItem value="1">正常</SelectItem>
              <SelectItem value="0">停用</SelectItem>
            </Select>
          </div>
          <Input
            label="备注"
            value={form.remark}
            onChange={(e) => setForm({ ...form, remark: e.target.value })}
            placeholder="岗位描述（可选）"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <DialogClose asChild>
            <Button variant="secondary">取消</Button>
          </DialogClose>
          <Button variant="primary" onClick={handleSubmit} loading={createMut.isPending || updateMut.isPending}>
            {editing ? '保存修改' : '确认新增'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PostManagement() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PostItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PostItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['posts', page, keyword],
    queryFn: () => getPostList(page, pageSize, keyword.trim() || undefined),
  });

  const deleteMut = useMutation({
    mutationFn: deletePost,
    onSuccess: () => {
      toast.success('岗位已删除');
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || '删除失败'),
  });

  const records = data?.records ?? [];
  const totalPosts = data?.total ?? 0;
  const activePosts = records.filter((item) => Number(item.status) === 1).length;
  const inactivePosts = records.length - activePosts;

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (item: PostItem) => {
    setEditing(item);
    setFormOpen(true);
  };

  const handleDelete = (item: PostItem) => {
    setDeleteTarget(item);
  };

  const columns: Column<PostItem>[] = [
    { key: 'id', title: 'ID', width: 60 },
    {
      key: 'postCode',
      title: '岗位编码',
      render: (v) => (
        <span className="rounded-md bg-slate-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">
          {String(v)}
        </span>
      ),
    },
    {
      key: 'postName',
      title: '岗位名称',
      render: (v) => (
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="font-medium text-slate-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: 'sortOrder',
      title: '排序',
      width: 80,
      render: (v) => <span className="text-sm text-slate-500">{String(v ?? 0)}</span>,
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (v) => {
        const active = Number(v) === 1;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
            active
              ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
              : 'border-slate-200 bg-slate-50 text-slate-500'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-400'}`} />
            {active ? '正常' : '停用'}
          </span>
        );
      },
    },
    {
      key: 'remark',
      title: '备注',
      render: (v) => <span className="text-sm text-slate-400">{String(v || '—')}</span>,
    },
    {
      key: 'createTime',
      title: '创建时间',
      render: (v) => <span className="text-xs text-slate-400">{String(v || '—')}</span>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      render: (_, row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleEdit(row)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
            title="编辑"
          >
            <Pencil className="h-3.5 w-3.5" />编辑
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:text-red-500"
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  /* ── Stat bar definitions ── */
  const statCards = [
    { label: '岗位总量', value: totalPosts, icon: Briefcase, gradient: 'from-blue-600 to-cyan-500' },
    { label: '正常', value: activePosts, icon: CheckCircle, gradient: 'from-emerald-500 to-teal-400' },
    { label: '停用', value: inactivePosts, icon: XCircle, gradient: 'from-slate-400 to-slate-500' },
  ];

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ── Compact header with stat bar ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">岗位管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                <Briefcase className="h-3 w-3" />
                岗位
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="md" onClick={handleNew}>
                <Plus className="w-4 h-4" />
                新增岗位
              </Button>
            </div>
          </div>

          {/* stat bar */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3 px-5 py-3">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stat.gradient} shadow-sm`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">{stat.label}</p>
                    <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Main content card ── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Toolbar */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  <Search className="h-3.5 w-3.5" />
                  岗位列表
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  岗位信息维护
                </h2>
              </div>
            </div>

            {/* Search */}
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setPage(1);
                  }}
                  placeholder="搜索岗位编码、名称或备注"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              {keyword && (
                <button
                  className="text-xs font-bold text-blue-600 hover:underline"
                  onClick={() => { setKeyword(''); setPage(1); }}
                >
                  清除搜索
                </button>
              )}
            </div>
          </div>

          {/* Result summary bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
            <span className="text-xs text-slate-500">
              共 <span className="font-bold text-slate-700">{totalPosts}</span> 条岗位
              {' · '}本页 <span className="font-bold text-slate-700">{records.length}</span> 条
            </span>
            {keyword && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                搜索: {keyword}
              </span>
            )}
          </div>

          {/* DataTable */}
          <div className="p-4 sm:p-5">
            <DataTable
              columns={columns}
              data={records}
              loading={isLoading}
              pagination={{
                page,
                pageSize,
                total: totalPosts,
                onChange: (p) => setPage(p),
              }}
              emptyText="暂无岗位数据，点击「新增岗位」创建"
            />
          </div>
        </Card>
      </div>

      <PostFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteTarget != null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent title="确认删除岗位">
          <div className="p-6">
            <p className="text-sm text-slate-600">
              确定要删除岗位「<strong className="text-slate-900">{deleteTarget?.postName}</strong>」（{deleteTarget?.postCode}）吗？该岗位下存在关联用户时将拒绝删除。
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <DialogClose asChild>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>取消</Button>
            </DialogClose>
            <Button
              variant="destructive"
              loading={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
