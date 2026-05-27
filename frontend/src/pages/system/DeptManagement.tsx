import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createDept, deleteDept, getDeptTree, updateDept } from '@/api/base';
import type { Department } from '@/types/common';
import { UserSearchSelect } from '@/components/ui/UserSearchSelect';

type DeptForm = {
  name: string;
  deptCode: string;
  parentId: string;
  sortOrder: string;
  leader: string;
  phone: string;
  email: string;
  status: number;
  leaderId: string;
  secretaryId: string;
  deptType: string;
  description: string;
};

const emptyForm: DeptForm = {
  name: '',
  deptCode: '',
  parentId: '',
  sortOrder: '0',
  leader: '',
  phone: '',
  email: '',
  status: 1,
  leaderId: '',
  secretaryId: '',
  deptType: '',
  description: '',
};

const DEPT_TYPE_LABELS: Record<string, string> = {
  management: '管理部门',
  technical: '技术部门',
  support: '支撑部门',
  production: '生产部门',
  other: '其他',
};

function getDeptName(dept?: Department) {
  return dept?.deptName || (dept as any)?.name || '';
}

function DeptRow({ node, depth, onOpenCreate, onOpenEdit, onDeleteClick }: {
  node: Department;
  depth: number;
  onOpenCreate: (parentId?: number) => void;
  onOpenEdit: (dept: Department, depth: number) => void;
  onDeleteClick: (dept: Department) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  return (
    <>
      <tr className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
        <td className="px-5 py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: depth * 22 }}>
            {hasChildren ? (
              <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 w-4 text-center">
                {expanded ? '▾' : '▸'}
              </button>
            ) : <span className="w-4" />}
            <Building2 className="w-4 h-4 text-[#3b82f6]" />
            <span className="font-medium text-sm text-[#0f172a]">{getDeptName(node)}</span>
          </div>
        </td>
        <td className="px-5 py-3 font-mono text-xs text-[#64748b]">{node.deptCode || '—'}</td>
        <td className="px-5 py-3 text-sm text-[#64748b]">{node.leader || '—'}</td>
        <td className="px-5 py-3 text-sm text-[#64748b]">{node.phone || '—'}</td>
        <td className="px-5 py-3 text-sm text-[#64748b]">{node.email || '—'}</td>
        <td className="px-5 py-3 text-sm text-[#64748b]">{node.leaderId ?? '—'}</td>
        <td className="px-5 py-3 text-sm text-[#64748b]">{node.secretaryId ?? '—'}</td>
        <td className="px-5 py-3 text-sm text-[#64748b]">{DEPT_TYPE_LABELS[node.deptType ?? ''] || '—'}</td>
        <td className="px-5 py-3 text-sm text-[#64748b] truncate max-w-[150px]">{node.description || '—'}</td>
        <td className="px-5 py-3 text-sm text-[#64748b]">{node.sortOrder ?? node.orderNum ?? node.sort ?? 0}</td>
        <td className="px-5 py-3">
          <span className={`rounded-full px-2 py-0.5 text-xs ${node.status === 0 ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
            {node.status === 0 ? '停用' : '正常'}
          </span>
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-3 text-xs whitespace-nowrap">
            <button className="text-[#3b82f6]" onClick={() => onOpenCreate(node.id)}>新增下级</button>
            <button className="text-[#3b82f6]" onClick={() => onOpenEdit(node, depth)}>
              <Pencil className="mr-0.5 inline h-3.5 w-3.5" />编辑
            </button>
            <button className="text-red-500" onClick={() => onDeleteClick(node)}>
              <Trash2 className="mr-0.5 inline h-3.5 w-3.5" />删除
            </button>
          </div>
        </td>
      </tr>
      {hasChildren && expanded && node.children!.map((child) => (
        <DeptRow key={child.id} node={child} depth={depth + 1} onOpenCreate={onOpenCreate} onOpenEdit={onOpenEdit} onDeleteClick={onDeleteClick} />
      ))}
    </>
  );
}

export default function DeptManagement() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingDepth, setEditingDepth] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [form, setForm] = useState<DeptForm>(emptyForm);

  const { data: deptTree = [], isLoading } = useQuery({
    queryKey: ['system', 'depts'],
    queryFn: getDeptTree,
  });

  
  const createMut = useMutation({
    mutationFn: createDept,
    onSuccess: () => {
      toast.success('部门创建成功');
      queryClient.invalidateQueries({ queryKey: ['system', 'depts'] });
      closeForm();
    },
    onError: (err: Error) => toast.error(err.message || '部门创建失败'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateDept>[1] }) =>
      updateDept(id, data),
    onSuccess: () => {
      toast.success('部门更新成功');
      queryClient.invalidateQueries({ queryKey: ['system', 'depts'] });
      closeForm();
    },
    onError: (err: Error) => toast.error(err.message || '部门更新失败'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteDept,
    onSuccess: () => {
      toast.success('部门已删除');
      queryClient.invalidateQueries({ queryKey: ['system', 'depts'] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message || '删除失败'),
  });

  function openCreate(parentId?: number) {
    setEditingDept(null);
    setEditingDepth(0);
    setForm({ ...emptyForm, parentId: parentId ? String(parentId) : '' });
    setShowForm(true);
  }

  function openEdit(dept: Department, depth: number) {
    setEditingDept(dept);
    setEditingDepth(depth);
    setForm({
      name: getDeptName(dept),
      deptCode: dept.deptCode ?? '',
      parentId: dept.parentId && dept.parentId !== 0 ? String(dept.parentId) : '',
      sortOrder: String(dept.sortOrder ?? dept.orderNum ?? dept.sort ?? 0),
      leader: dept.leader ?? '',
      phone: dept.phone ?? '',
      email: dept.email ?? '',
      status: dept.status ?? 1,
      leaderId: dept.leaderId ? String(dept.leaderId) : '',
      secretaryId: dept.secretaryId ? String(dept.secretaryId) : '',
      deptType: dept.deptType ?? '',
      description: dept.description ?? '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingDept(null);
    setEditingDepth(0);
    setForm(emptyForm);
  }

  function submitForm(event: React.FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error('部门名称不能为空');
      return;
    }
    const payload = {
      name,
      deptCode: form.deptCode.trim() || undefined,
      parentId: form.parentId ? Number(form.parentId) : 0,
      sortOrder: Number(form.sortOrder || 0),
      leader: form.leader.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      status: form.status,
      leaderId: form.leaderId ? Number(form.leaderId) : undefined,
      secretaryId: form.secretaryId ? Number(form.secretaryId) : undefined,
      deptType: form.deptType.trim() || undefined,
      description: form.description.trim() || undefined,
    };
    if (editingDept) {
      updateMut.mutate({ id: editingDept.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  // 递归扁平化树，用于 form 中的上级部门 select
  const flatDeptOptions = useMemo(() => {
    function flatten(nodes: Department[], depth: number): Array<{ id: number; name: string; level: number }> {
      const result: Array<{ id: number; name: string; level: number }> = [];
      for (const node of nodes) {
        if (!editingDept || node.id !== editingDept.id) {
          result.push({ id: node.id, name: getDeptName(node), level: depth });
        }
        if (node.children) {
          result.push(...flatten(node.children, depth + 1));
        }
      }
      return result;
    }
    return flatten(deptTree, 0);
  }, [deptTree, editingDept]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="部门管理"
        subtitle="按若依组织架构模型维护部门树、负责人、联系方式与状态"
      />

      <Card>
        <CardHeader>
          <CardTitle>部门列表</CardTitle>
          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            <Plus className="w-4 h-4" />
            新增部门
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索部门名称、编码、负责人、手机号或邮箱"
                className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[#94a3b8]">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              加载部门中...
            </div>
          ) : deptTree.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#cbd5e1] py-12 text-center text-sm text-[#64748b]">
              暂无部门数据，可点击"新增部门"创建组织架构
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e5e7eb]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs uppercase text-[#94a3b8] sticky top-0">
                  <tr>
                    <th className="px-5 py-3">部门名称</th>
                    <th className="px-5 py-3">编码</th>
                    <th className="px-5 py-3">负责人</th>
                    <th className="px-5 py-3">联系电话</th>
                    <th className="px-5 py-3">邮箱</th>
                    <th className="px-5 py-3">部门领导</th>
                    <th className="px-5 py-3">秘书</th>
                    <th className="px-5 py-3">部门类型</th>
                    <th className="px-5 py-3">备注</th>
                    <th className="px-5 py-3">排序</th>
                    <th className="px-5 py-3">状态</th>
                    <th className="px-5 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {deptTree.map((node) => (
                    <DeptRow key={node.id} node={node} depth={0} onOpenCreate={openCreate} onOpenEdit={openEdit} onDeleteClick={setDeleteTarget} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeForm} />
          <div className="relative mx-4 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-5 text-base font-semibold text-[#0f172a]">
              {editingDept ? '编辑部门' : '新增部门'}
            </h3>
            <form onSubmit={submitForm} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="部门名称 *"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <Input
                  label="部门编码"
                  value={form.deptCode}
                  onChange={(e) => setForm((p) => ({ ...p, deptCode: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#374151]">上级部门</label>
                  <select
                    value={form.parentId}
                    onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
                    className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">顶级部门</option>
                    {flatDeptOptions.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {'—'.repeat(dept.level)} {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="排序"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="负责人"
                  value={form.leader}
                  onChange={(e) => setForm((p) => ({ ...p, leader: e.target.value }))}
                />
                <Input
                  label="联系电话"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="邮箱"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#374151]">部门类型</label>
                  <select
                    value={form.deptType}
                    onChange={(e) => setForm((p) => ({ ...p, deptType: e.target.value }))}
                    className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">请选择</option>
                    <option value="management">管理部门</option>
                    <option value="technical">技术部门</option>
                    <option value="support">支撑部门</option>
                    <option value="production">生产部门</option>
                    <option value="other">其他</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <UserSearchSelect
                  label="部门领导"
                  value={form.leaderId}
                  onChange={(val) => setForm((p) => ({ ...p, leaderId: val }))}
                  placeholder="搜索用户..."
                />
                <UserSearchSelect
                  label="秘书"
                  value={form.secretaryId}
                  onChange={(val) => setForm((p) => ({ ...p, secretaryId: val }))}
                  placeholder="搜索用户..."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">状态</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: Number(e.target.value) }))}
                  className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-blue-100"
                >
                  <option value={1}>正常</option>
                  <option value={0}>停用</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#374151] block mb-1.5">备注</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-blue-100 placeholder:text-[#9ca3af]"
                  placeholder="部门描述、职责说明等"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={closeForm}>
                  取消
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={createMut.isPending || updateMut.isPending}
                >
                  {editingDept ? '保存修改' : '确认新增'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">确认删除部门</h3>
            <p className="mt-3 text-sm text-gray-500">
              确定要删除「{getDeptName(deleteTarget)}」吗？部门下存在用户时后端会拒绝删除。
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                loading={deleteMut.isPending}
                onClick={() => deleteMut.mutate(deleteTarget.id)}
              >
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
