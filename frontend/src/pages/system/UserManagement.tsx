import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Eye,
  Filter,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  Shield,
  Briefcase,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { getDeptTree } from '@/api/base';
import { getAllRoles } from '@/api/role';
import { assignUserPosts, getAllPosts } from '@/api/post';
import type { Department } from '@/types/common';
import {
  createUser,
  deleteUser,
  getUserDetail,
  getUserList,
  resetPassword,
  updateUser,
  updateUserStatus,
  type UserDetail,
  type UserItem,
} from '@/api/user-management';

type UserForm = {
  username: string;
  password: string;
  realName: string;
  email: string;
  phone: string;
  deptId: string;
  status: number;
  remark: string;
  roleIds: Set<number>;
  postIds: Set<number>;
};

type FlatDept = Department & { level: number };

const PAGE_SIZE = 20;

const emptyForm: UserForm = {
  username: '',
  password: '123456',
  realName: '',
  email: '',
  phone: '',
  deptId: '',
  status: 1,
  remark: '',
  roleIds: new Set(),
  postIds: new Set(),
};

function flattenDepts(tree: Department[] = [], level = 0): FlatDept[] {
  return tree.flatMap((dept) => [
    { ...dept, level },
    ...flattenDepts(dept.children ?? [], level + 1),
  ]);
}

function getDeptName(dept?: Department) {
  return dept?.deptName || (dept as any)?.name || '';
}

function formatTime(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
  } catch {
    return value;
  }
}

function toggleSetValue(set: Set<number>, value: number) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>('');
  const [deptId, setDeptId] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const listParams = {
    page,
    pageSize: PAGE_SIZE,
    keyword: keyword.trim() || undefined,
    status: status === '' ? undefined : Number(status),
    deptId: deptId === '' ? undefined : Number(deptId),
  };

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', 'list', listParams],
    queryFn: () => getUserList(listParams),
    placeholderData: (prev) => prev,
  });

  const { data: deptTree = [] } = useQuery({
    queryKey: ['system', 'depts'],
    queryFn: getDeptTree,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', 'all'],
    queryFn: getAllRoles,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['posts', 'all'],
    queryFn: getAllPosts,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['users', 'detail', detailUserId],
    queryFn: () => getUserDetail(detailUserId!),
    enabled: detailUserId != null,
  });

  const depts = useMemo(() => flattenDepts(deptTree), [deptTree]);
  const deptNameById = useMemo(() => {
    const map = new Map<number, string>();
    depts.forEach((dept) => map.set(dept.id, getDeptName(dept)));
    return map;
  }, [depts]);

  const users = usersData?.records ?? [];
  const total = usersData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const saveUserMut = useMutation({
    mutationFn: async () => {
      const payload = {
        realName: form.realName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        deptId: form.deptId ? Number(form.deptId) : undefined,
        status: form.status,
        remark: form.remark.trim() || undefined,
        roleIds: Array.from(form.roleIds),
      };
      if (editingUser) {
        const updated = await updateUser(editingUser.id, payload);
        await assignUserPosts(editingUser.id, Array.from(form.postIds));
        return updated;
      }
      if (!form.username.trim()) throw new Error('用户名不能为空');
      if (!form.password.trim()) throw new Error('初始密码不能为空');
      const created = await createUser({
        ...payload,
        username: form.username.trim(),
        password: form.password,
      });
      await assignUserPosts(created.id, Array.from(form.postIds));
      return created;
    },
    onSuccess: () => {
      toast.success(editingUser ? '用户更新成功' : '用户创建成功');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeForm();
    },
    onError: (err: Error) => toast.error(err.message || '保存失败'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast.success('用户已删除');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message || '删除失败'),
  });

  const resetPasswordMut = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => toast.success('密码已重置为 123456'),
    onError: (err: Error) => toast.error(err.message || '重置密码失败'),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, nextStatus }: { id: number; nextStatus: number }) => updateUserStatus(id, nextStatus),
    onSuccess: () => {
      toast.success('用户状态已更新');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => toast.error(err.message || '状态更新失败'),
  });

  function openCreate() {
    setEditingUser(null);
    setForm({ ...emptyForm, roleIds: new Set(), postIds: new Set() });
    setShowForm(true);
  }

  async function openEdit(user: UserItem) {
    setEditingUser(user);
    setShowForm(true);
    try {
      const detail = await getUserDetail(user.id);
      setFormFromDetail(detail);
    } catch {
      setForm({
        ...emptyForm,
        username: user.username,
        password: '',
        realName: user.realName ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
        deptId: user.deptId ? String(user.deptId) : '',
        status: user.status ?? 1,
        remark: user.remark ?? '',
      });
    }
  }

  function setFormFromDetail(user: UserDetail) {
    setForm({
      username: user.username,
      password: '',
      realName: user.realName ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      deptId: user.deptId ? String(user.deptId) : '',
      status: user.status ?? 1,
      remark: user.remark ?? '',
      roleIds: new Set(user.roleIds ?? []),
      postIds: new Set(user.postIds ?? []),
    });
  }

  function closeForm() {
    setShowForm(false);
    setEditingUser(null);
    setForm({ ...emptyForm, roleIds: new Set(), postIds: new Set() });
  }

  function submitForm(event: React.FormEvent) {
    event.preventDefault();
    saveUserMut.mutate();
  }

  /* ── Status counts for quick-filter pills ── */
  const activeOnPage = users.filter((u) => u.status === 1).length;
  const disabledOnPage = users.length - activeOnPage;

  /* ── Stat bar definitions ── */
  const statCards = [
    { label: '用户总量', value: total, icon: Users, gradient: 'from-blue-600 to-cyan-500' },
    { label: '角色数', value: roles.length, icon: Shield, gradient: 'from-violet-500 to-purple-400' },
    { label: '岗位数', value: posts.length, icon: Briefcase, gradient: 'from-emerald-500 to-teal-400' },
    { label: '总页数', value: totalPages, icon: RefreshCw, gradient: 'from-amber-500 to-orange-400' },
  ];

  /* ── DataTable columns ── */
  const columns: Column<UserItem>[] = [
    {
      key: 'realName',
      title: '用户',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
            {(row.realName || row.username).slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-900">{row.realName || '—'}</p>
            <p className="font-mono text-xs text-slate-500">{row.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      title: '邮箱/手机号',
      render: (_, row) => (
        <div>
          <div className="text-sm text-slate-600">{row.email || '—'}</div>
          <div className="text-xs text-slate-400">{row.phone || '—'}</div>
        </div>
      ),
    },
    {
      key: 'deptName',
      title: '部门',
      render: (_, row) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
          {row.deptName || (row.deptId ? deptNameById.get(row.deptId) || `部门#${row.deptId}` : '未分配')}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_, row) => (
        <button
          onClick={() => statusMut.mutate({ id: row.id, nextStatus: row.status === 1 ? 0 : 1 })}
          title="点击切换状态"
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset transition-colors ${
            row.status === 1
              ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${row.status === 1 ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {row.status === 1 ? '正常' : '停用'}
        </button>
      ),
    },
    {
      key: 'createTime',
      title: '创建时间',
      width: 160,
      render: (v) => <span className="text-xs text-slate-400">{formatTime(v as string)}</span>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 260,
      render: (_, row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
            onClick={() => setDetailUserId(row.id)}
          >
            <Eye className="h-3.5 w-3.5" />详情
          </button>
          <button
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
            onClick={() => openEdit(row)}
          >
            <Pencil className="h-3.5 w-3.5" />编辑
          </button>
          <span className="mx-0.5 h-4 w-px bg-slate-200" />
          <button
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-amber-600 transition hover:border-amber-200 hover:bg-amber-50"
            onClick={() => resetPasswordMut.mutate(row.id)}
          >
            <KeyRound className="h-3.5 w-3.5" />重置
          </button>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:text-red-500"
            onClick={() => setDeleteTarget(row)}
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
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
              <h1 className="text-xl font-bold text-slate-900">用户管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <Users className="h-3 w-3" />
                用户
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="md" onClick={openCreate}>
                <Plus className="w-4 h-4" />
                新增用户
              </Button>
            </div>
          </div>

          {/* stat bar */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 sm:grid-cols-4">
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  <Search className="h-3.5 w-3.5" />
                  用户列表
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  账号与权限管理
                </h2>
              </div>
            </div>

            {/* Quick filter pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setStatus(''); setPage(1); }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  status === ''
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                全部
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0 text-[10px]">
                  {total}
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setStatus('1'); setPage(1); }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  status === '1'
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${status === '1' ? 'bg-white' : 'bg-emerald-400'}`} />
                正常
                <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                  status === '1' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {activeOnPage}
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setStatus('0'); setPage(1); }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  status === '0'
                    ? 'border-red-500 bg-red-600 text-white shadow-md shadow-red-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:text-red-700'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${status === '0' ? 'bg-white' : 'bg-red-400'}`} />
                停用
                <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                  status === '0' ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600'
                }`}>
                  {disabledOnPage}
                </span>
              </button>
            </div>

            {/* Search + dept filter */}
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => { setKeyword(event.target.value); setPage(1); }}
                  placeholder="搜索用户名、姓名、邮箱或手机号"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select
                value={deptId}
                onChange={(event) => { setDeptId(event.target.value); setPage(1); }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
              >
                <option value="">全部部门</option>
                {depts.map((dept) => (
                  <option key={dept.id} value={dept.id}>{'—'.repeat(dept.level)} {getDeptName(dept)}</option>
                ))}
              </select>
              <button
                className="text-xs font-bold text-blue-600 hover:underline"
                onClick={() => { setKeyword(''); setDeptId(''); setStatus(''); setPage(1); }}
              >
                重置
              </button>
            </div>
          </div>

          {/* Result summary bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
            {(status !== '' || deptId !== '' || keyword.trim()) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Filter className="h-3 w-3" />
                筛选中
              </span>
            )}
            <span className="text-xs text-slate-500">
              共 <span className="font-bold text-slate-700">{total}</span> 条用户
              {' · '}本页 <span className="font-bold text-slate-700">{users.length}</span> 条
            </span>
            {status !== '' && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                status === '1'
                  ? 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
                  : 'border-red-200/60 bg-red-50 text-red-600'
              }`}>
                状态: {status === '1' ? '正常' : '停用'}
              </span>
            )}
            {deptId !== '' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                <Building2 className="h-3 w-3" />
                {deptNameById.get(Number(deptId)) || `部门#${deptId}`}
              </span>
            )}
            {keyword.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                搜索: {keyword.trim()}
              </span>
            )}
          </div>

          {/* DataTable */}
          <div className="p-4 sm:p-5">
            <DataTable
              columns={columns}
              data={users}
              loading={isLoading}
              rowKey="id"
              pagination={{
                page,
                pageSize: PAGE_SIZE,
                total,
                onChange: (p) => setPage(p),
              }}
              emptyText="暂无用户数据，可调整筛选或新建用户"
            />
          </div>
        </Card>
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent title={editingUser ? '编辑用户' : '新增用户'} className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={submitForm} className="space-y-5 p-6">
            <div className="grid grid-cols-2 gap-4">
              <Input label="用户名 *" value={form.username} disabled={!!editingUser} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} required />
              {!editingUser ? (
                <Input label="初始密码 *" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
              ) : (
                <Input label="账号 ID" value={String(editingUser.id)} disabled />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="真实姓名" value={form.realName} onChange={(e) => setForm((p) => ({ ...p, realName: e.target.value }))} />
              <Input label="邮箱" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="手机号" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">部门</label>
                <select value={form.deptId} onChange={(e) => setForm((p) => ({ ...p, deptId: e.target.value }))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                  <option value="">未分配</option>
                  {depts.map((dept) => (
                    <option key={dept.id} value={dept.id}>{'—'.repeat(dept.level)} {getDeptName(dept)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">状态</label>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: Number(e.target.value) }))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                  <option value={1}>正常</option>
                  <option value={0}>停用</option>
                </select>
              </div>
            </div>
            <Input label="备注" value={form.remark} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} />

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-700">角色分配</p>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {roles.map((role) => (
                    <label key={role.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <input type="checkbox" checked={form.roleIds.has(role.id)} onChange={() => setForm((p) => ({ ...p, roleIds: toggleSetValue(p.roleIds, role.id) }))} />
                      <span className="text-sm text-slate-900">{role.roleName}</span>
                      <span className="text-xs text-slate-400">{role.roleCode}</span>
                    </label>
                  ))}
                  {roles.length === 0 && <p className="text-sm text-slate-400">暂无角色</p>}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-700">岗位分配</p>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {posts.map((post) => (
                    <label key={post.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <input type="checkbox" checked={form.postIds.has(post.id)} onChange={() => setForm((p) => ({ ...p, postIds: toggleSetValue(p.postIds, post.id) }))} />
                      <span className="text-sm text-slate-900">{post.postName}</span>
                      <span className="text-xs text-slate-400">{post.postCode}</span>
                    </label>
                  ))}
                  {posts.length === 0 && <p className="text-sm text-slate-400">暂无岗位</p>}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary">取消</Button>
              </DialogClose>
              <Button type="submit" variant="primary" loading={saveUserMut.isPending}>{editingUser ? '保存修改' : '确认新增'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── User Detail Dialog ── */}
      <Dialog open={detailUserId != null} onOpenChange={(v) => { if (!v) setDetailUserId(null); }}>
        <DialogContent title="用户详情" className="max-w-2xl">
          <div className="p-6">
            {detailLoading ? (
              <div className="py-10 text-center text-sm text-slate-400">
                <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
                加载中...
              </div>
            ) : detail ? (
              <UserDetailPanel detail={detail} deptName={detail.deptName || (detail.deptId ? deptNameById.get(detail.deptId) : undefined)} />
            ) : (
              <div className="py-10 text-center text-sm text-slate-400">未找到用户详情</div>
            )}
          </div>
          <div className="flex justify-end border-t border-slate-100 px-6 py-4">
            <DialogClose asChild>
              <Button variant="secondary" onClick={() => setDetailUserId(null)}>关闭</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteTarget != null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent title="确认删除用户">
          <div className="p-6">
            <p className="text-sm text-slate-600">
              确定要删除「<strong className="text-slate-900">{deleteTarget?.realName || deleteTarget?.username}</strong>」吗？此操作不可撤销。
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <DialogClose asChild>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>取消</Button>
            </DialogClose>
            <Button variant="destructive" loading={deleteMut.isPending} onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserDetailPanel({ detail, deptName }: { detail: UserDetail; deptName?: string }) {
  const fields = [
    ['用户名', detail.username],
    ['真实姓名', detail.realName || '—'],
    ['邮箱', detail.email || '—'],
    ['手机号', detail.phone || '—'],
    ['所属部门', deptName || (detail.deptId ? `部门#${detail.deptId}` : '未分配')],
    ['状态', detail.status === 1 ? '正常' : '停用'],
    ['最后登录 IP', detail.loginIp || '—'],
    ['最后登录时间', formatTime(detail.loginDate)],
    ['创建时间', formatTime(detail.createTime)],
    ['更新时间', formatTime(detail.updateTime)],
    ['备注', detail.remark || '—'],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">角色</p>
          <div className="flex flex-wrap gap-2">
            {(detail.roles ?? []).map((role) => (
              <span key={role.id} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{role.roleName}</span>
            ))}
            {(detail.roles ?? []).length === 0 && <span className="text-sm text-slate-400">暂无角色</span>}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">岗位 ID</p>
          <div className="flex flex-wrap gap-2">
            {(detail.postIds ?? []).map((postId) => (
              <span key={postId} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">岗位#{postId}</span>
            ))}
            {(detail.postIds ?? []).length === 0 && <span className="text-sm text-slate-400">暂无岗位</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
