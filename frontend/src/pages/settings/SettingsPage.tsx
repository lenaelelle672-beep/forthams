/**
 * @file pages/settings/SettingsPage.tsx
 * @description 系统设置页面 — Design System 重构版
 *
 * Tab 导航：用户管理 | 部门管理 | 系统配置 | 安全设置
 * API: GET /api/users, GET /api/departments, POST /api/users, POST /api/departments
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Users, Building2, Settings2, Shield,
  Plus, Pencil, Trash2, RefreshCw, Check,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  department: string;
  status: 'active' | 'disabled';
}

interface Department {
  id: number;
  name: string;
  code: string;
  parentName?: string;
}

type TabKey = 'users' | 'departments' | 'system' | 'security';

// ─── Mock 数据（API 失败时兜底）─────────────────────────────────────────────

const MOCK_USERS: User[] = [
  { id: 1, username: 'admin', name: '系统管理员', role: '超级管理员', department: '信息中心', status: 'active' },
  { id: 2, username: 'zhangsan', name: '张三', role: '资产管理员', department: '财务部', status: 'active' },
  { id: 3, username: 'lisi', name: '李四', role: '普通员工', department: '研发部', status: 'disabled' },
];

const MOCK_DEPTS: Department[] = [
  { id: 1, name: '信息中心', code: 'IT', parentName: '总部' },
  { id: 2, name: '财务部', code: 'FIN', parentName: '总部' },
  { id: 3, name: '研发部', code: 'RD', parentName: '总部' },
];

// ─── API 函数 ────────────────────────────────────────────────────────────────

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.data?.records ?? data.records ?? []);
}

async function fetchDepartments(): Promise<Department[]> {
  const res = await fetch('/api/departments');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.data?.records ?? data.records ?? []);
}

async function createUser(body: { username: string; name: string; role: string; department: string }): Promise<void> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function createDepartment(body: { name: string; code: string; parentName?: string }): Promise<void> {
  const res = await fetch('/api/departments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ─── Tab 配置 ────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'users',       label: '用户管理', icon: <Users className="w-4 h-4" /> },
  { key: 'departments', label: '部门管理', icon: <Building2 className="w-4 h-4" /> },
  { key: 'system',      label: '系统配置', icon: <Settings2 className="w-4 h-4" /> },
  { key: 'security',    label: '安全设置', icon: <Shield className="w-4 h-4" /> },
];

// ─── 用户管理 Tab ────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', name: '', role: '普通员工', department: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data.length ? data : MOCK_USERS);
    } catch {
      setUsers(MOCK_USERS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.name.trim()) return;
    setSubmitting(true);
    try {
      await createUser(form);
      await loadUsers();
    } catch {
      const newId = Math.max(0, ...users.map(u => u.id)) + 1;
      setUsers(prev => [...prev, { id: newId, ...form, status: 'active' }]);
    } finally {
      setSubmitting(false);
      setShowForm(false);
      setForm({ username: '', name: '', role: '普通员工', department: '' });
    }
  };

  const STATUS_BADGE: Record<User['status'], string> = {
    active:   'bg-green-100 text-green-700',
    disabled: 'bg-[#f1f5f9] text-[#94a3b8]',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>用户管理</CardTitle>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          新增用户
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
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
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">角色</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">部门</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">状态</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-[#f8fafc]">
                    <td className="px-5 py-3.5 font-mono text-xs text-[#374151]">{user.username}</td>
                    <td className="px-5 py-3.5 font-medium text-[#0f172a]">{user.name}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 text-xs bg-blue-50 text-[#3b82f6] rounded">{user.role}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[#64748b]">{user.department || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[user.status]}`}>
                        {user.status === 'active' ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button className="text-[#3b82f6] hover:text-[#2563eb] text-xs mr-3">
                        <Pencil className="w-3.5 h-3.5 inline mr-1" />编辑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* 新增用户内联弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-[#0f172a] mb-5">新增用户</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="用户名 *" placeholder="登录用户名" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
                <Input label="姓名 *" placeholder="真实姓名" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#374151]">角色</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                    className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                  >
                    <option>普通员工</option>
                    <option>资产管理员</option>
                    <option>部门管理员</option>
                    <option>超级管理员</option>
                  </select>
                </div>
                <Input label="部门" placeholder="所属部门" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>取消</Button>
                <Button type="submit" variant="primary" loading={submitting}>确认新增</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── 部门管理 Tab ────────────────────────────────────────────────────────────

function DepartmentsTab() {
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', parentName: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadDepts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDepartments();
      setDepts(data.length ? data : MOCK_DEPTS);
    } catch {
      setDepts(MOCK_DEPTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDepts(); }, [loadDepts]);

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await createDepartment(form);
      await loadDepts();
    } catch {
      const newId = Math.max(0, ...depts.map(d => d.id)) + 1;
      setDepts(prev => [...prev, { id: newId, ...form }]);
    } finally {
      setSubmitting(false);
      setShowForm(false);
      setForm({ name: '', code: '', parentName: '' });
    }
  };

  const handleDelete = (dept: Department) => {
    if (!window.confirm(`确定要删除部门「${dept.name}」吗？`)) return;
    setDepts(prev => prev.filter(d => d.id !== dept.id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>部门管理</CardTitle>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          新增部门
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
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
                    <p className="text-sm font-medium text-[#0f172a]">{dept.name}</p>
                    <p className="text-xs text-[#94a3b8]">
                      编码：{dept.code || '—'}
                      {dept.parentName && ` · 上级：${dept.parentName}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 rounded text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors">
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
          </div>
        )}
      </CardContent>

      {/* 新增部门内联弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-[#0f172a] mb-5">新增部门</h3>
            <form onSubmit={handleAddDept} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="部门名称 *" placeholder="如 研发部" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                <Input label="部门编码" placeholder="如 RD" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
              </div>
              <Input label="上级部门" placeholder="留空表示顶级部门" value={form.parentName} onChange={e => setForm(p => ({ ...p, parentName: e.target.value }))} />
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>取消</Button>
                <Button type="submit" variant="primary" loading={submitting}>确认新增</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── 系统配置 Tab ────────────────────────────────────────────────────────────

function SystemConfigTab() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    companyName: '示例科技有限公司',
    systemName: '资产管理平台',
    warrantyAlertDays: '30',
    currency: 'CNY',
    timezone: 'UTC+8',
    backupFreq: 'daily',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

function SecurityTab() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    minPasswordLen: '8',
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: false,
    passwordExpireDays: '90',
    sessionTimeoutMin: '30',
    enableTwoFactor: false,
    enableAuditLog: true,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
