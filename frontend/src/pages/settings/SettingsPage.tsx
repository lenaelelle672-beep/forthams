/**
 * @file pages/settings/SettingsPage.tsx
 * @description 系统设置页面 — 全量对接真实 API
 *
 * Tab 导航：用户管理 | 部门管理 | 系统配置 | 安全设置
 * API: @/api/base (getUserList, createUser, updateUser, deleteUser, resetPassword,
 *                getDeptTree, createDept, updateDept, deleteDept)
 * Pattern: useQuery + useMutation + invalidateQueries
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Users, Building2, Settings2, Shield,
  Plus, Pencil, Trash2, RefreshCw, Check, KeyRound,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  getUserList,
  createUser as createUserApi,
  updateUser as updateUserApi,
  deleteUser as deleteUserApi,
  resetPassword as resetPasswordApi,
  getDeptTree,
  createDept as createDeptApi,
  updateDept as updateDeptApi,
  deleteDept as deleteDeptApi,
  type UserItem,
} from '@/api/base';
import type { Department } from '@/types/common';
import {
  getSystemConfig,
  saveSystemConfig as saveSystemConfigApi,
  getSecurityConfig,
  saveSecurityConfig as saveSecurityConfigApi,
} from '@/api/systemConfig';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

type TabKey = 'users' | 'departments' | 'system' | 'security';

// ─── Query Keys ─────────────────────────────────────────────────────────────

const QUERY_KEYS = {
  users: ['settings', 'users'] as const,
  depts: ['settings', 'depts'] as const,
};

// ─── Tab 配置 ────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'users',       label: '用户管理', icon: <Users className="w-4 h-4" /> },
  { key: 'departments', label: '部门管理', icon: <Building2 className="w-4 h-4" /> },
  { key: 'system',      label: '系统配置', icon: <Settings2 className="w-4 h-4" /> },
  { key: 'security',    label: '安全设置', icon: <Shield className="w-4 h-4" /> },
];

// ─── 用户管理 Tab ────────────────────────────────────────────────────────────

function UsersTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'resetPwd'; user: UserItem } | null>(null);
  const [form, setForm] = useState({
    username: '',
    realName: '',
    phone: '',
    email: '',
    deptName: '',
    password: '',
  });

  // ── Query: fetch user list ──────────────────────────────────────────────
  const { data: usersData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.users,
    queryFn: async () => {
      const res = await getUserList({ page: 1, pageSize: 100 });
      return res?.records ?? [];
    },
  });

  const users = usersData ?? [];

  // ── Mutation: create user ───────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: Parameters<typeof createUserApi>[0]) => createUserApi(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.users });
      toast.success('用户创建成功');
      closeForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? '创建失败');
    },
  });

  // ── Mutation: update user ───────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateUserApi>[1] }) =>
      updateUserApi(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.users });
      toast.success('用户更新成功');
      closeForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? '更新失败');
    },
  });

  // ── Mutation: delete user ───────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteUserApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.users });
      toast.success('用户已删除');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? '删除失败');
    },
  });

  // ── Mutation: reset password ────────────────────────────────────────────
  const resetPwdMut = useMutation({
    mutationFn: (id: number) => resetPasswordApi(id),
    onSuccess: () => {
      toast.success('密码已重置为默认密码');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? '重置密码失败');
    },
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setForm({ username: '', realName: '', phone: '', email: '', deptName: '', password: '' });
  };

  const openCreateForm = () => {
    setEditingUser(null);
    setForm({ username: '', realName: '', phone: '', email: '', deptName: '', password: '' });
    setShowForm(true);
  };

  const openEditForm = (user: UserItem) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      realName: user.realName ?? '',
      phone: user.phone ?? '',
      email: user.email ?? '',
      deptName: user.deptName ?? '',
      password: '',
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim()) return;
    if (editingUser) {
      updateMut.mutate({
        id: editingUser.id,
        data: {
          username: form.username,
          realName: form.realName,
          phone: form.phone,
          email: form.email,
          deptName: form.deptName,
        },
      });
    } else {
      if (!form.username.trim() || !form.password.trim()) {
        toast.error('用户名和密码为必填项');
        return;
      }
      createMut.mutate({
        username: form.username,
        realName: form.realName,
        phone: form.phone,
        email: form.email,
        deptName: form.deptName,
        password: form.password,
      });
    }
  };

  const handleDelete = (user: UserItem) => {
    setConfirmAction({ type: 'delete', user });
  };

  const handleResetPwd = (user: UserItem) => {
    setConfirmAction({ type: 'resetPwd', user });
  };

  const executeConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'delete') deleteMut.mutate(confirmAction.user.id);
    else resetPwdMut.mutate(confirmAction.user.id);
    setConfirmAction(null);
  };

  const STATUS_BADGE: Record<number, string> = {
    1: 'bg-green-100 text-green-700',
    0: 'bg-[#f1f5f9] text-[#94a3b8]',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>用户管理</CardTitle>
        <Button variant="primary" size="sm" onClick={openCreateForm}>
          <Plus className="w-4 h-4" />
          新增用户
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#94a3b8] text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> 加载中...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">用户名</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">姓名</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">部门</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">状态</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-[#f8fafc]">
                    <td className="px-5 py-3.5 font-mono text-xs text-[#374151]">{user.username}</td>
                    <td className="px-5 py-3.5 font-medium text-[#0f172a]">{user.realName || '—'}</td>
                    <td className="px-5 py-3.5 text-[#64748b]">{user.deptName || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[user.status] ?? STATUS_BADGE[0]}`}>
                        {user.status === 1 ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => openEditForm(user)} className="text-[#3b82f6] hover:text-[#2563eb] text-xs mr-3">
                        <Pencil className="w-3.5 h-3.5 inline mr-1" />编辑
                      </button>
                      <button onClick={() => handleResetPwd(user)} className="text-amber-600 hover:text-amber-700 text-xs mr-3">
                        <KeyRound className="w-3.5 h-3.5 inline mr-1" />重置密码
                      </button>
                      <button onClick={() => handleDelete(user)} className="text-red-500 hover:text-red-700 text-xs">
                        <Trash2 className="w-3.5 h-3.5 inline mr-1" />删除
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-[#94a3b8] text-sm">暂无用户数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* 新增/编辑用户弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeForm} />
          <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-[#0f172a] mb-5">
              {editingUser ? '编辑用户' : '新增用户'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="用户名 *" placeholder="登录用户名" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
                <Input label="姓名" placeholder="真实姓名" value={form.realName} onChange={e => setForm(p => ({ ...p, realName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="手机号" placeholder="手机号" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                <Input label="邮箱" placeholder="邮箱" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <Input label="部门" placeholder="所属部门" value={form.deptName} onChange={e => setForm(p => ({ ...p, deptName: e.target.value }))} />
              {!editingUser && (
                <Input label="初始密码 *" type="password" placeholder="登录密码" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={closeForm}>取消</Button>
                <Button type="submit" variant="primary" loading={createMut.isPending || updateMut.isPending}>
                  {editingUser ? '确认修改' : '确认新增'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              {confirmAction.type === 'delete' ? '确认删除用户' : '确认重置密码'}
            </h3>
            <p className="text-sm text-gray-500">
              {confirmAction.type === 'delete'
                ? `确定要删除用户「${confirmAction.user.realName || confirmAction.user.username}」吗？此操作不可撤销。`
                : `确定要重置「${confirmAction.user.realName || confirmAction.user.username}」的密码吗？`}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>取消</Button>
              <Button variant={confirmAction.type === 'delete' ? 'destructive' : 'primary'} size="sm" onClick={executeConfirm}>
                确认
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── 部门管理 Tab ────────────────────────────────────────────────────────────

/** 将树形部门展开为平铺列表（用于展示） */
function flattenDepts(tree: Department[]): Department[] {
  const result: Department[] = [];
  const walk = (nodes: Department[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(tree);
  return result;
}

function DepartmentsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', deptCode: '', parentId: '' });
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  // ── Query: fetch dept tree ──────────────────────────────────────────────
  const { data: deptTree, isLoading } = useQuery({
    queryKey: QUERY_KEYS.depts,
    queryFn: async () => {
      const res = await getDeptTree();
      return res ?? [];
    },
  });

  const depts = deptTree ? flattenDepts(deptTree) : [];

  // ── Mutation: create dept ───────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: Parameters<typeof createDeptApi>[0]) => createDeptApi(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.depts });
      toast.success('部门创建成功');
      closeForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? '创建失败');
    },
  });

  // ── Mutation: update dept ───────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateDeptApi>[1] }) =>
      updateDeptApi(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.depts });
      toast.success('部门更新成功');
      closeForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? '更新失败');
    },
  });

  // ── Mutation: delete dept ───────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteDeptApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.depts });
      toast.success('部门已删除');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? '删除失败');
    },
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingDept(null);
    setForm({ name: '', deptCode: '', parentId: '' });
  };

  const openCreateForm = () => {
    setEditingDept(null);
    setForm({ name: '', deptCode: '', parentId: '' });
    setShowForm(true);
  };

  const openEditForm = (dept: Department) => {
    setEditingDept(dept);
    setForm({
      name: dept.deptName ?? '',
      deptCode: '',
      parentId: dept.parentId != null ? String(dept.parentId) : '',
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editingDept) {
      updateMut.mutate({
        id: editingDept.id,
        data: {
          name: form.name,
          deptCode: form.deptCode || undefined,
          parentId: form.parentId ? Number(form.parentId) : undefined,
        },
      });
    } else {
      createMut.mutate({
        name: form.name,
        deptCode: form.deptCode || undefined,
        parentId: form.parentId ? Number(form.parentId) : undefined,
      });
    }
  };

  const handleDelete = (dept: Department) => {
    setDeleteTarget(dept);
  };

  const executeDeleteDept = () => {
    if (!deleteTarget) return;
    deleteMut.mutate(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>部门管理</CardTitle>
        <Button variant="primary" size="sm" onClick={openCreateForm}>
          <Plus className="w-4 h-4" />
          新增部门
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#94a3b8] text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> 加载中...
          </div>
        ) : (
          <div className="space-y-3">
            {depts.map(dept => (
              <div key={dept.id} className="flex items-center justify-between p-4 border border-[#e5e7eb] rounded-lg hover:border-[#3b82f6] transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-[#3b82f6]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0f172a]">{dept.deptName}</p>
                    <p className="text-xs text-[#94a3b8]">
                      ID: {dept.id}
                      {dept.parentId != null && ` · 上级 ID：${dept.parentId}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditForm(dept)} className="p-1.5 rounded text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dept)}
                    className="p-1.5 rounded text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {depts.length === 0 && (
              <div className="py-10 text-center text-[#94a3b8] text-sm">暂无部门数据</div>
            )}
          </div>
        )}
      </CardContent>

      {/* 新增/编辑部门弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeForm} />
          <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-[#0f172a] mb-5">
              {editingDept ? '编辑部门' : '新增部门'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="部门名称 *" placeholder="如 研发部" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              <Input label="部门编码" placeholder="如 RD" value={form.deptCode} onChange={e => setForm(p => ({ ...p, deptCode: e.target.value }))} />
              <Input label="上级部门 ID" placeholder="留空表示顶级部门" value={form.parentId} onChange={e => setForm(p => ({ ...p, parentId: e.target.value }))} />
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={closeForm}>取消</Button>
                <Button type="submit" variant="primary" loading={createMut.isPending || updateMut.isPending}>
                  {editingDept ? '确认修改' : '确认新增'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">确认删除部门</h3>
            <p className="text-sm text-gray-500">
              确定要删除部门「{deleteTarget.deptName}」吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>取消</Button>
              <Button variant="destructive" size="sm" onClick={executeDeleteDept}>确认删除</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── 系统配置 Tab ────────────────────────────────────────────────────────────

const SYSTEM_CONFIG_DEFAULTS = {
  companyName: '示例科技有限公司',
  systemName: '资产管理平台',
  warrantyAlertDays: '30',
  currency: 'CNY',
  timezone: 'UTC+8',
  backupFreq: 'daily',
};

function SystemConfigTab() {
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const { data: remoteConfig, isLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: async () => {
      const res = await getSystemConfig();
      return res.data ?? {};
    },
  });

  const [form, setForm] = useState(() => ({ ...SYSTEM_CONFIG_DEFAULTS }));

  // Sync remote data into form when loaded
  React.useEffect(() => {
    if (remoteConfig && Object.keys(remoteConfig).length > 0) {
      setForm(prev => ({ ...prev, ...remoteConfig }));
    }
  }, [remoteConfig]);

  const saveMut = useMutation({
    mutationFn: (data: Record<string, string>) => saveSystemConfigApi(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      setSaved(true);
      toast.success('配置已保存');
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? '保存失败');
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMut.mutate(form);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>系统配置</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5 max-w-xl">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="公司名称"
              value={form.companyName}
              onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))}
            />
            <Input
              label="系统名称"
              value={form.systemName}
              onChange={e => setForm(p => ({ ...p, systemName: e.target.value }))}
            />
          </div>
          <Input
            label="维保预警天数"
            type="number"
            hint="资产维保到期前 N 天发出预警通知"
            value={form.warrantyAlertDays}
            onChange={e => setForm(p => ({ ...p, warrantyAlertDays: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">默认货币</label>
              <select
                value={form.currency}
                onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
              >
                <option value="CNY">人民币 (CNY)</option>
                <option value="USD">美元 (USD)</option>
                <option value="EUR">欧元 (EUR)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">时区</label>
              <select
                value={form.timezone}
                onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}
                className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
              >
                <option value="UTC+8">北京时间 (UTC+8)</option>
                <option value="UTC+9">东京时间 (UTC+9)</option>
                <option value="UTC+0">伦敦时间 (UTC+0)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">数据备份频率</label>
            <select
              value={form.backupFreq}
              onChange={e => setForm(p => ({ ...p, backupFreq: e.target.value }))}
              className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
            >
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" variant="primary">
              {saved ? <><Check className="w-4 h-4" /> 已保存</> : '保存配置'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── 安全设置 Tab ────────────────────────────────────────────────────────────

const SECURITY_CONFIG_DEFAULTS = {
  minPasswordLen: '8',
  requireUppercase: true,
  requireNumber: true,
  requireSpecial: false,
  passwordExpireDays: '90',
  sessionTimeoutMin: '30',
  enableTwoFactor: false,
  enableAuditLog: true,
};

function SecurityTab() {
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const { data: remoteConfig, isLoading } = useQuery({
    queryKey: ['security-config'],
    queryFn: async () => {
      const res = await getSecurityConfig();
      return res.data ?? {};
    },
  });

  const [form, setForm] = useState(() => ({ ...SECURITY_CONFIG_DEFAULTS }));

  // Sync remote data into form when loaded
  React.useEffect(() => {
    if (remoteConfig && Object.keys(remoteConfig).length > 0) {
      setForm(prev => ({ ...prev, ...remoteConfig }));
    }
  }, [remoteConfig]);

  const saveMut = useMutation({
    mutationFn: (data: Record<string, string>) => saveSecurityConfigApi(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-config'] });
      setSaved(true);
      toast.success('安全设置已保存');
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? '保存失败');
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Convert boolean to string for API
    const payload: Record<string, string> = {};
    for (const [key, value] of Object.entries(form)) {
      payload[key] = typeof value === 'boolean' ? String(value) : String(value);
    }
    saveMut.mutate(payload);
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-[#3b82f6]' : 'bg-[#e5e7eb]'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>安全设置</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6 max-w-xl">
          {/* 密码策略 */}
          <div>
            <p className="text-sm font-semibold text-[#374151] mb-3">密码策略</p>
            <div className="space-y-3 pl-1">
              <Input
                label="密码最小长度"
                type="number"
                value={form.minPasswordLen}
                onChange={e => setForm(p => ({ ...p, minPasswordLen: e.target.value }))}
              />
              <div className="grid grid-cols-1 gap-2">
                {[
                  { label: '要求大写字母', key: 'requireUppercase' as const },
                  { label: '要求数字',   key: 'requireNumber' as const },
                  { label: '要求特殊字符', key: 'requireSpecial' as const },
                ].map(({ label, key }) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-[#f8fafc] rounded-lg">
                    <span className="text-sm text-[#374151]">{label}</span>
                    <Toggle checked={form[key]} onChange={v => setForm(p => ({ ...p, [key]: v }))} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 会话设置 */}
          <div>
            <p className="text-sm font-semibold text-[#374151] mb-3">会话设置</p>
            <div className="space-y-3 pl-1">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="密码有效期（天）"
                  type="number"
                  value={form.passwordExpireDays}
                  onChange={e => setForm(p => ({ ...p, passwordExpireDays: e.target.value }))}
                />
                <Input
                  label="会话超时（分钟）"
                  type="number"
                  value={form.sessionTimeoutMin}
                  onChange={e => setForm(p => ({ ...p, sessionTimeoutMin: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* 高级安全 */}
          <div>
            <p className="text-sm font-semibold text-[#374151] mb-3">高级安全</p>
            <div className="space-y-2 pl-1">
              {[
                { label: '启用双因素认证', desc: '登录时需要验证码', key: 'enableTwoFactor' as const },
                { label: '记录操作日志', desc: '记录所有用户操作以供审计', key: 'enableAuditLog' as const },
              ].map(({ label, desc, key }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-[#f8fafc] rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-[#374151]">{label}</p>
                    <p className="text-xs text-[#94a3b8]">{desc}</p>
                  </div>
                  <Toggle checked={form[key]} onChange={v => setForm(p => ({ ...p, [key]: v }))} />
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" variant="primary">
            {saved ? <><Check className="w-4 h-4" /> 已保存</> : '保存安全设置'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const validTabs: TabKey[] = ['users', 'departments', 'system', 'security'];
  const activeTab: TabKey = (tab && validTabs.includes(tab as TabKey)) ? tab as TabKey : 'users';

  const handleTabChange = (key: TabKey) => {
    navigate(`/settings/${key}`, { replace: true });
  };

  return (
    <div className="p-6 bg-[#f8fafc] min-h-full">
      <PageHeader
        title="系统设置"
        subtitle="用户、部门、权限与系统参数配置"
      />

      {/* Tab 导航 */}
      <div className="flex items-center gap-1 mb-6 border-b border-[#e5e7eb]">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-[#3b82f6] text-[#3b82f6]'
                : 'border-transparent text-[#64748b] hover:text-[#374151] hover:border-[#e5e7eb]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      {activeTab === 'users'       && <UsersTab />}
      {activeTab === 'departments' && <DepartmentsTab />}
      {activeTab === 'system'      && <SystemConfigTab />}
      {activeTab === 'security'    && <SecurityTab />}
    </div>
  );
}
