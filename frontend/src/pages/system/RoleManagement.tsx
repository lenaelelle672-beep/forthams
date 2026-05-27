/**
 * @file pages/system/RoleManagement.tsx
 * @description 角色管理独立页面 — CRUD + 菜单权限树 + 部门数据权限选择器 + data_scope 配置
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { Select, SelectItem } from '@/components/ui/Select';
import {
  getRoleList,
  createRole,
  updateRole,
  deleteRole,
  assignRoleMenus,
  assignRoleDepts,
  type RoleItem,
  type RoleCreatePayload,
  type RoleUpdatePayload,
} from '@/api/role';
import { getMenuTree, type MenuItem } from '@/api/menu';
import { getDeptList } from '@/api/base';

/** 数据权限范围选项 */
const DATA_SCOPE_OPTIONS: Record<number, string> = {
  1: '全部数据',
  2: '自定义部门',
  3: '本部门数据',
  4: '本部门及以下',
  5: '仅本人',
};

// ─── 角色表单弹窗 ───────────────────────────────────────────────────────────
function RoleFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: RoleItem | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RoleCreatePayload>({
    roleName: '',
    roleCode: '',
    description: '',
    dataScope: 1,
  });

  React.useEffect(() => {
    if (editing) {
      setForm({
        roleName: editing.roleName,
        roleCode: editing.roleCode,
        description: editing.description || '',
        dataScope: editing.dataScope ?? 1,
      });
    } else {
      setForm({ roleName: '', roleCode: '', description: '', dataScope: 1 });
    }
  }, [editing, open]);

  const createMut = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      toast.success('角色已创建');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (data: RoleUpdatePayload) => updateRole(editing!.id, data),
    onSuccess: () => {
      toast.success('角色已更新');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.roleName.trim() || !form.roleCode.trim()) {
      toast.error('请填写角色名称和编码');
      return;
    }
    if (editing) {
      updateMut.mutate({
        roleName: form.roleName,
        roleCode: form.roleCode,
        description: form.description,
        dataScope: form.dataScope,
      });
    } else {
      createMut.mutate(form);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editing ? '编辑角色' : '新增角色'}>
        <div className="space-y-4 py-4">
          <Input label="角色名称" value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })} placeholder="请输入角色名称" />
          <Input label="角色编码" value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value })} placeholder="如：ADMIN" />
          <Input label="描述" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="角色描述（可选）" />
          <Select
            label="数据权限范围"
            value={String(form.dataScope ?? 1)}
            onValueChange={(v) => setForm({ ...form, dataScope: Number(v) })}
          >
            <SelectItem value="1">全部数据</SelectItem>
            <SelectItem value="2">自定义部门</SelectItem>
            <SelectItem value="3">本部门数据</SelectItem>
            <SelectItem value="4">本部门及以下</SelectItem>
            <SelectItem value="5">仅本人</SelectItem>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <DialogClose asChild><Button variant="secondary">取消</Button></DialogClose>
          <Button onClick={handleSubmit} loading={createMut.isPending || updateMut.isPending}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 菜单权限分配弹窗 ───────────────────────────────────────────────────────
function MenuAssignDialog({
  open,
  onOpenChange,
  roleId,
  roleName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roleId: number;
  roleName: string;
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: menuTree } = useQuery({
    queryKey: ['menus', 'tree'],
    queryFn: getMenuTree,
    enabled: open,
  });

  const assignMut = useMutation({
    mutationFn: (menuIds: number[]) => assignRoleMenus(roleId, menuIds),
    onSuccess: () => {
      toast.success('菜单权限已分配');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleId = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const renderMenuTree = (items: MenuItem[], depth = 0): React.ReactNode => {
    return items.map((item) => (
      <div key={item.id}>
        <label
          className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded px-2"
          style={{ paddingLeft: 12 + depth * 20 }}
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(item.id)}
            onChange={() => toggleId(item.id)}
            className="rounded border-gray-300"
          />
          <span className="text-sm">{item.menuName}</span>
          {item.perms && <span className="text-xs text-gray-400">({item.perms})</span>}
        </label>
        {item.children && renderMenuTree(item.children, depth + 1)}
      </div>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`分配菜单权限 — ${roleName}`}>
        <div className="max-h-[400px] overflow-y-auto py-2">
          {menuTree ? renderMenuTree(menuTree) : <div className="text-sm text-gray-400">加载中...</div>}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <DialogClose asChild><Button variant="secondary">取消</Button></DialogClose>
          <Button onClick={() => assignMut.mutate(selectedIds)} loading={assignMut.isPending}>保存分配</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 部门数据权限分配弹窗 ─────────────────────────────────────────────────────
function DeptAssignDialog({
  open,
  onOpenChange,
  roleId,
  roleName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roleId: number;
  roleName: string;
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deptList, setDeptList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      getDeptList()
        .then((data) => {
          setDeptList(Array.isArray(data) ? data : []);
        })
        .catch(() => setDeptList([]))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const assignMut = useMutation({
    mutationFn: (deptIds: number[]) => assignRoleDepts(roleId, deptIds),
    onSuccess: () => {
      toast.success('部门数据权限已分配');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleId = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`分配部门数据权限 — ${roleName}`}>
        <div className="max-h-[400px] overflow-y-auto py-2">
          {loading ? (
            <div className="text-sm text-gray-400">加载中...</div>
          ) : deptList.length > 0 ? (
            deptList.map((dept: any) => (
              <label
                key={dept.id}
                className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded px-2"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(dept.id)}
                  onChange={() => toggleId(dept.id)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{dept.deptName || dept.name || `部门#${dept.id}`}</span>
              </label>
            ))
          ) : (
            <div className="text-sm text-gray-400">暂无部门数据</div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <DialogClose asChild><Button variant="secondary">取消</Button></DialogClose>
          <Button onClick={() => assignMut.mutate(selectedIds)} loading={assignMut.isPending}>保存分配</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export default function RoleManagement() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [menuAssignOpen, setMenuAssignOpen] = useState(false);
  const [deptAssignOpen, setDeptAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<RoleItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['roles', 'list', page],
    queryFn: () => getRoleList(page, pageSize),
  });

  const deleteMut = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      toast.success('角色已删除');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDelete = (id: number) => {
    if (!confirm('确认删除该角色？关联的用户角色关系将同时失效。')) return;
    deleteMut.mutate(id);
  };

  const handleEdit = (item: RoleItem) => {
    setEditing(item);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleMenuAssign = (item: RoleItem) => {
    setAssignTarget(item);
    setMenuAssignOpen(true);
  };

  const handleDeptAssign = (item: RoleItem) => {
    setAssignTarget(item);
    setDeptAssignOpen(true);
  };

  const columns: Column<RoleItem>[] = [
    { key: 'id', title: 'ID', width: 60 },
    { key: 'roleName', title: '角色名称' },
    { key: 'roleCode', title: '角色编码' },
    {
      key: 'dataScope',
      title: '数据权限',
      render: (v) => (
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
          {DATA_SCOPE_OPTIONS[Number(v) as keyof typeof DATA_SCOPE_OPTIONS] || '未设置'}
        </span>
      ),
    },
    { key: 'description', title: '描述', render: (v) => <span className="text-gray-400">{String(v || '—')}</span> },
    {
      key: 'actions',
      title: '操作',
      width: 280,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => handleEdit(row)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded" title="编辑">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(row.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="删除">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => handleMenuAssign(row)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded" title="分配菜单权限">
            菜单权限
          </button>
          <button onClick={() => handleDeptAssign(row)} className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded" title="分配部门数据权限">
            数据权限
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="角色管理" subtitle="管理角色、分配菜单权限和部门数据权限" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>角色列表</CardTitle>
            <Button size="sm" onClick={handleNew}>
              <Plus className="w-4 h-4 mr-1" />
              新增角色
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.records || []}
            loading={isLoading}
            pagination={{
              page,
              pageSize,
              total: data?.total || 0,
              onChange: (p) => setPage(p),
            }}
          />
        </CardContent>
      </Card>

      <RoleFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      {assignTarget && (
        <>
          <MenuAssignDialog
            open={menuAssignOpen}
            onOpenChange={setMenuAssignOpen}
            roleId={assignTarget.id}
            roleName={assignTarget.roleName}
          />
          <DeptAssignDialog
            open={deptAssignOpen}
            onOpenChange={setDeptAssignOpen}
            roleId={assignTarget.id}
            roleName={assignTarget.roleName}
          />
        </>
      )}
    </div>
  );
}
