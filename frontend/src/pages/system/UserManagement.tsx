import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="用户管理" subtitle="按若依用户模型维护账号、部门、岗位、角色、邮箱与状态" />

      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4" />新增用户
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_180px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                value={keyword}
                onChange={(event) => { setKeyword(event.target.value); setPage(1); }}
                placeholder="搜索用户名、姓名、邮箱或手机号"
                className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <select
              value={deptId}
              onChange={(event) => { setDeptId(event.target.value); setPage(1); }}
              className="h-10 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-blue-100"
            >
              <option value="">全部部门</option>
              {depts.map((dept) => (
                <option key={dept.id} value={dept.id}>{'—'.repeat(dept.level)} {getDeptName(dept)}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1); }}
              className="h-10 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-blue-100"
            >
              <option value="">全部状态</option>
              <option value="1">正常</option>
              <option value="0">停用</option>
            </select>
            <Button variant="secondary" onClick={() => { setKeyword(''); setDeptId(''); setStatus(''); setPage(1); }}>
              重置筛选
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[#94a3b8]">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />加载用户中...
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#cbd5e1] py-12 text-center text-sm text-[#64748b]">
              暂无用户数据，可调整筛选或新建用户
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e5e7eb]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs uppercase text-[#94a3b8]">
                  <tr>
                    <th className="px-5 py-3">用户</th>
                    <th className="px-5 py-3">邮箱/手机号</th>
                    <th className="px-5 py-3">部门</th>
                    <th className="px-5 py-3">状态</th>
                    <th className="px-5 py-3">创建时间</th>
                    <th className="px-5 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-[#f8fafc]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-[#2563eb]">
                            {(user.realName || user.username).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-[#0f172a]">{user.realName || '—'}</p>
                            <p className="font-mono text-xs text-[#64748b]">{user.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[#64748b]">
                        <div>{user.email || '—'}</div>
                        <div className="text-xs text-[#94a3b8]">{user.phone || '—'}</div>
                      </td>
                      <td className="px-5 py-3.5 text-[#64748b]">
                        <Building2 className="mr-1 inline h-3.5 w-3.5 text-[#94a3b8]" />
                        {user.deptName || (user.deptId ? deptNameById.get(user.deptId) || `部门#${user.deptId}` : '未分配')}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => statusMut.mutate({ id: user.id, nextStatus: user.status === 1 ? 0 : 1 })}
                          className={`rounded-full px-2 py-0.5 text-xs ${user.status === 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {user.status === 1 ? '正常' : '停用'}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#94a3b8]">{formatTime(user.createTime)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <button className="text-[#3b82f6] hover:text-[#2563eb]" onClick={() => setDetailUserId(user.id)}>
                            <Eye className="mr-1 inline h-3.5 w-3.5" />详情
                          </button>
                          <button className="text-[#3b82f6] hover:text-[#2563eb]" onClick={() => openEdit(user)}>
                            <Pencil className="mr-1 inline h-3.5 w-3.5" />编辑
                          </button>
                          <button className="text-amber-600 hover:text-amber-700" onClick={() => resetPasswordMut.mutate(user.id)}>
                            <KeyRound className="mr-1 inline h-3.5 w-3.5" />重置密码
                          </button>
                          <button className="text-red-500 hover:text-red-700" onClick={() => setDeleteTarget(user)}>
                            <Trash2 className="mr-1 inline h-3.5 w-3.5" />删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-xs text-[#64748b]">
            <span>共 {total} 项，当前第 {page} / {totalPages} 页</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeForm} />
          <div className="relative mx-4 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-5 text-base font-semibold text-[#0f172a]">{editingUser ? '编辑用户' : '新增用户'}</h3>
            <form onSubmit={submitForm} className="space-y-5">
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
                  <label className="text-sm font-medium text-[#374151]">部门</label>
                  <select value={form.deptId} onChange={(e) => setForm((p) => ({ ...p, deptId: e.target.value }))} className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-blue-100">
                    <option value="">未分配</option>
                    {depts.map((dept) => (
                      <option key={dept.id} value={dept.id}>{'—'.repeat(dept.level)} {getDeptName(dept)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#374151]">状态</label>
                  <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: Number(e.target.value) }))} className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-blue-100">
                    <option value={1}>正常</option>
                    <option value={0}>停用</option>
                  </select>
                </div>
              </div>
              <Input label="备注" value={form.remark} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} />

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#e5e7eb] p-4">
                  <p className="mb-3 text-sm font-semibold text-[#374151]">角色分配</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {roles.map((role) => (
                      <label key={role.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#f8fafc]">
                        <input type="checkbox" checked={form.roleIds.has(role.id)} onChange={() => setForm((p) => ({ ...p, roleIds: toggleSetValue(p.roleIds, role.id) }))} />
                        <span className="text-sm text-[#0f172a]">{role.roleName}</span>
                        <span className="text-xs text-[#94a3b8]">{role.roleCode}</span>
                      </label>
                    ))}
                    {roles.length === 0 && <p className="text-sm text-[#94a3b8]">暂无角色</p>}
                  </div>
                </div>
                <div className="rounded-xl border border-[#e5e7eb] p-4">
                  <p className="mb-3 text-sm font-semibold text-[#374151]">岗位分配</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {posts.map((post) => (
                      <label key={post.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#f8fafc]">
                        <input type="checkbox" checked={form.postIds.has(post.id)} onChange={() => setForm((p) => ({ ...p, postIds: toggleSetValue(p.postIds, post.id) }))} />
                        <span className="text-sm text-[#0f172a]">{post.postName}</span>
                        <span className="text-xs text-[#94a3b8]">{post.postCode}</span>
                      </label>
                    ))}
                    {posts.length === 0 && <p className="text-sm text-[#94a3b8]">暂无岗位</p>}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={closeForm}>取消</Button>
                <Button type="submit" variant="primary" loading={saveUserMut.isPending}>{editingUser ? '保存修改' : '确认新增'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailUserId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailUserId(null)} />
          <div className="relative mx-4 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#0f172a]">用户详情</h3>
            {detailLoading ? (
              <div className="py-10 text-center text-sm text-[#94a3b8]">加载中...</div>
            ) : detail ? (
              <UserDetailPanel detail={detail} deptName={detail.deptName || (detail.deptId ? deptNameById.get(detail.deptId) : undefined)} />
            ) : (
              <div className="py-10 text-center text-sm text-[#94a3b8]">未找到用户详情</div>
            )}
            <div className="mt-6 flex justify-end">
              <Button variant="secondary" onClick={() => setDetailUserId(null)}>关闭</Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">确认删除用户</h3>
            <p className="mt-3 text-sm text-gray-500">确定要删除「{deleteTarget.realName || deleteTarget.username}」吗？此操作不可撤销。</p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>取消</Button>
              <Button variant="destructive" size="sm" loading={deleteMut.isPending} onClick={() => deleteMut.mutate(deleteTarget.id)}>确认删除</Button>
            </div>
          </div>
        </div>
      )}
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
    <div className="mt-5 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-[#f8fafc] p-3">
            <p className="text-xs text-[#94a3b8]">{label}</p>
            <p className="mt-1 text-sm font-medium text-[#0f172a]">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#e5e7eb] p-4">
          <p className="mb-2 text-sm font-semibold text-[#374151]">角色</p>
          <div className="flex flex-wrap gap-2">
            {(detail.roles ?? []).map((role) => (
              <span key={role.id} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-[#2563eb]">{role.roleName}</span>
            ))}
            {(detail.roles ?? []).length === 0 && <span className="text-sm text-[#94a3b8]">暂无角色</span>}
          </div>
        </div>
        <div className="rounded-xl border border-[#e5e7eb] p-4">
          <p className="mb-2 text-sm font-semibold text-[#374151]">岗位 ID</p>
          <div className="flex flex-wrap gap-2">
            {(detail.postIds ?? []).map((postId) => (
              <span key={postId} className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">岗位#{postId}</span>
            ))}
            {(detail.postIds ?? []).length === 0 && <span className="text-sm text-[#94a3b8]">暂无岗位</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
