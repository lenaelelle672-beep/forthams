/**
 * @file pages/system/RoleManagement.tsx
 * @description 角色管理独立页面 — CRUD + 菜单权限树 + 部门数据权限选择器 + data_scope 配置
 * 权限树支持层级可扫描、选中状态可辨，勾选仍保持原有单节点语义
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Shield,
  ShieldCheck,
  FolderOpen,
  Folder,
  FileText,
  KeyRound,
  Building2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
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

/** 数据权限范围对应的颜色样式 */
const DATA_SCOPE_STYLES: Record<number, { bg: string; border: string; text: string; dot: string }> = {
  1: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', dot: 'bg-indigo-400' },
  2: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', dot: 'bg-amber-400' },
  3: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', dot: 'bg-emerald-400' },
  4: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', dot: 'bg-cyan-400' },
  5: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', dot: 'bg-slate-400' },
};

// ─── 工具函数：权限树级联 ──────────────────────────────────────────────────

/** 收集节点及其所有后代 id */
function collectAllIds(items: MenuItem[]): number[] {
  const ids: number[] = [];
  for (const item of items) {
    ids.push(item.id);
    if (item.children?.length) {
      ids.push(...collectAllIds(item.children));
    }
  }
  return ids;
}

type TreeCheckState = boolean | 'indeterminate';

/** 判断一个节点是否被选中，父节点根据子节点状态显示半选 */
function isChecked(item: MenuItem, selectedIds: Set<number>): TreeCheckState {
  if (selectedIds.has(item.id)) {
    return true;
  }

  const hasSelectedChild = item.children?.some((child) => {
    const childState = isChecked(child, selectedIds);
    return childState === true || childState === 'indeterminate';
  });

  return hasSelectedChild ? 'indeterminate' : false;
}

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

  /** 提交角色表单 */
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
        <div className="space-y-4 p-6">
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
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <DialogClose asChild><Button variant="secondary">取消</Button></DialogClose>
          <Button onClick={handleSubmit} loading={createMut.isPending || updateMut.isPending}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 树节点组件 ───────────────────────────────────────────────────────────────

/** 权限树单个节点的复选框，带选中/半选/禁用三种视觉状态 */
function TreeNodeCheckbox({
  checked,
  disabled,
}: {
  checked: boolean | 'indeterminate';
  disabled?: boolean;
}) {
  const baseClass =
    'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors';

  if (disabled) {
    return (
      <span className={`${baseClass} border-gray-200 bg-gray-50 cursor-not-allowed`}>
        <span className="block w-2 h-0.5 rounded bg-gray-300" />
      </span>
    );
  }

  if (checked === true) {
    return (
      <span className={`${baseClass} border-blue-500 bg-blue-500 text-white`}>
        <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (checked === 'indeterminate') {
    return (
      <span className={`${baseClass} border-blue-500 bg-blue-500 text-white`}>
        <span className="block w-2 h-0.5 rounded bg-white" />
      </span>
    );
  }

  return <span className={`${baseClass} border-gray-300 bg-white hover:border-blue-400`} />;
}

/** 递归渲染单个权限树节点 */
function TreeNode({
  item,
  selectedIds,
  onToggle,
  expandedIds,
  onToggleExpand,
  depth,
  disabled,
}: {
  item: MenuItem;
  selectedIds: Set<number>;
  onToggle: (item: MenuItem) => void;
  expandedIds: Set<number>;
  onToggleExpand: (id: number) => void;
  depth: number;
  disabled?: boolean;
}) {
  const hasChildren = !!(item.children && item.children.length > 0);
  const isExpanded = expandedIds.has(item.id);
  const checkState = isChecked(item, selectedIds);

  return (
    <div>
      {/* 树行 */}
      <div
        className={`flex items-center gap-1 py-1.5 pr-3 rounded-md transition-colors group ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:bg-blue-50/60'
        }`}
        style={{ paddingLeft: 8 + depth * 24 }}
        onClick={() => {
          if (disabled) return;
          onToggle(item);
        }}
      >
        {/* 展开/折叠图标 */}
        {hasChildren ? (
          <button
            className="p-0.5 rounded hover:bg-gray-200/60 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
            tabIndex={-1}
            aria-label={isExpanded ? '折叠' : '展开'}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-[22px] flex-shrink-0" />
        )}

        {/* 层级引导线 (左侧竖线) */}
        {depth > 0 && (
          <span
            className="absolute top-0 bottom-0 border-l border-gray-200"
            style={{ left: 8 + (depth - 1) * 24 + 11 }}
          />
        )}

        {/* 复选框 */}
        <TreeNodeCheckbox checked={checkState} disabled={disabled} />

        {/* 图标 */}
        <span className="flex-shrink-0">
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-500" />
            ) : (
              <Folder className="w-4 h-4 text-amber-400" />
            )
          ) : (
            <FileText className="w-4 h-4 text-gray-400" />
          )}
        </span>

        {/* 名称 */}
        <span className={`text-sm font-medium ${checkState === true ? 'text-gray-900' : checkState === 'indeterminate' ? 'text-gray-700' : 'text-gray-500'}`}>
          {item.menuName}
        </span>

        {/* 权限标识 */}
        {item.perms && (
          <span className="text-[11px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded ml-1">
            {item.perms}
          </span>
        )}
      </div>

      {/* 子节点 */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {item.children!.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
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
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data: menuTree, isLoading: menuLoading } = useQuery({
    queryKey: ['menus', 'tree'],
    queryFn: getMenuTree,
    enabled: open,
  });

  /** 弹窗打开时默认展开所有一级节点，不重置已勾选内容 */
  React.useEffect(() => {
    if (open && menuTree) {
      setExpandedIds(new Set(menuTree.map((m) => m.id)));
    }
  }, [open, menuTree]);

  const assignMut = useMutation({
    mutationFn: (menuIds: number[]) => assignRoleMenus(roleId, menuIds),
    onSuccess: () => {
      toast.success('菜单权限已分配');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** 切换节点的勾选状态，保持原有单节点勾选语义 */
  const handleToggle = useCallback((item: MenuItem) => {
    setSelectedIds((prev) =>
      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
    );
  }, []);

  /** 切换节点展开/折叠 */
  const handleToggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);


  /** 统计选中节点数量 */
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;
  const totalCount = menuTree ? collectAllIds(menuTree).length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`分配菜单权限 — ${roleName}`} className="max-w-xl">
        <div className="p-6">
          {/* 工具栏 */}
          <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-slate-600">
                已选 <span className="font-semibold text-blue-600">{selectedCount}</span> / {totalCount} 项
              </span>
            </div>
          </div>

          {/* 权限树 */}
          <div className="max-h-[420px] overflow-y-auto py-1">
            {menuLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                <span className="animate-spin mr-2 h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                加载中...
              </div>
            ) : menuTree && menuTree.length > 0 ? (
              menuTree.map((item) => (
                <TreeNode
                  key={item.id}
                  item={item}
                  selectedIds={selectedSet}
                  onToggle={handleToggle}
                  expandedIds={expandedIds}
                  onToggleExpand={handleToggleExpand}
                  depth={0}
                />
              ))
            ) : (
              <div className="text-sm text-slate-400 text-center py-8">暂无菜单数据</div>
            )}
          </div>
        </div>

        {/* 保存操作区 */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <span className="text-xs text-slate-400">
            {selectedCount > 0 ? (
              <span className="text-blue-600">已选择 {selectedCount} 项权限</span>
            ) : (
              '未选择任何权限'
            )}
          </span>
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button variant="secondary">取消</Button>
            </DialogClose>
            <Button
              onClick={() => assignMut.mutate(selectedIds)}
              loading={assignMut.isPending}
            >
              <ShieldCheck className="w-4 h-4 mr-1" />
              保存分配 ({selectedCount})
            </Button>
          </div>
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

  /** 切换部门选中状态，保持原有单个部门独立勾选语义 */
  const toggleId = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);


  const selectedCount = selectedIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`分配部门数据权限 — ${roleName}`} className="max-w-xl">
        <div className="p-6">
          {/* 工具栏 */}
          <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2">
            <span className="text-sm text-slate-600">
              已选 <span className="font-semibold text-emerald-600">{selectedCount}</span> / {deptList.length} 个部门
            </span>
          </div>

          {/* 部门列表 */}
          <div className="max-h-[420px] overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                <span className="animate-spin mr-2 h-4 w-4 border-2 border-emerald-400 border-t-transparent rounded-full" />
                加载中...
              </div>
            ) : deptList.length > 0 ? (
              deptList.map((dept: any) => {
                const isSelected = selectedIds.includes(dept.id);
                return (
                  <label
                    key={dept.id}
                    className={`flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/80 border border-emerald-200'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-sm ${isSelected ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                      {dept.deptName || dept.name || `部门#${dept.id}`}
                    </span>
                  </label>
                );
              })
            ) : (
              <div className="text-sm text-slate-400 text-center py-8">暂无部门数据</div>
            )}
          </div>
        </div>

        {/* 保存操作区 */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <span className="text-xs text-slate-400">
            {selectedCount > 0 ? (
              <span className="text-emerald-600">已选择 {selectedCount} 个部门</span>
            ) : (
              '未选择任何部门'
            )}
          </span>
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button variant="secondary">取消</Button>
            </DialogClose>
            <Button
              onClick={() => assignMut.mutate(selectedIds)}
              loading={assignMut.isPending}
            >
              保存分配 ({selectedCount})
            </Button>
          </div>
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

  /** 删除角色确认 */
  const handleDelete = (id: number) => {
    if (!confirm('确认删除该角色？关联的用户角色关系将同时失效。')) return;
    deleteMut.mutate(id);
  };

  /** 打开编辑弹窗 */
  const handleEdit = (item: RoleItem) => {
    setEditing(item);
    setFormOpen(true);
  };

  /** 打开新增弹窗 */
  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  /** 打开菜单权限分配 */
  const handleMenuAssign = (item: RoleItem) => {
    setAssignTarget(item);
    setMenuAssignOpen(true);
  };

  /** 打开部门数据权限分配 */
  const handleDeptAssign = (item: RoleItem) => {
    setAssignTarget(item);
    setDeptAssignOpen(true);
  };

  const records = data?.records || [];
  const totalRoles = data?.total || 0;

  const columns: Column<RoleItem>[] = [
    { key: 'id', title: 'ID', width: 60 },
    {
      key: 'roleName',
      title: '角色名称',
      render: (v) => (
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="font-medium text-slate-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: 'roleCode',
      title: '角色编码',
      render: (v) => (
        <span className="rounded-md bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-600">
          {String(v)}
        </span>
      ),
    },
    {
      key: 'dataScope',
      title: '数据权限',
      render: (v) => {
        const scope = Number(v) as keyof typeof DATA_SCOPE_OPTIONS;
        const label = DATA_SCOPE_OPTIONS[scope] || '未设置';
        const style = DATA_SCOPE_STYLES[scope] || DATA_SCOPE_STYLES[5];
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.bg} ${style.border} ${style.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {label}
          </span>
        );
      },
    },
    {
      key: 'description',
      title: '描述',
      render: (v) => <span className="text-sm text-slate-400">{String(v || '—')}</span>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 300,
      render: (_, row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => handleEdit(row)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
            title="编辑"
          >
            <Pencil className="h-3.5 w-3.5" />编辑
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:text-red-500"
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <span className="mx-0.5 h-4 w-px bg-slate-200" />
          <button
            onClick={() => handleMenuAssign(row)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
            title="分配菜单权限"
          >
            <KeyRound className="h-3.5 w-3.5" />菜单权限
          </button>
          <button
            onClick={() => handleDeptAssign(row)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50"
            title="分配部门数据权限"
          >
            <Building2 className="h-3.5 w-3.5" />数据权限
          </button>
        </div>
      ),
    },
  ];

  /* ── Stat bar definitions ── */
  const statCards = [
    { label: '角色总数', value: totalRoles, icon: Shield, gradient: 'from-blue-600 to-cyan-500' },
    { label: '当前页', value: records.length, icon: KeyRound, gradient: 'from-violet-500 to-purple-400' },
    { label: '总页数', value: Math.max(1, Math.ceil(totalRoles / pageSize)), icon: Building2, gradient: 'from-emerald-500 to-teal-400' },
  ];

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ── Compact header with stat bar ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">角色管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-violet-700">
                <Shield className="h-3 w-3" />
                RBAC
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="md" onClick={handleNew}>
                <Plus className="w-4 h-4" />
                新增角色
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
                  <Shield className="h-3.5 w-3.5" />
                  角色列表
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  角色与权限管理
                </h2>
              </div>
            </div>
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
                total: totalRoles,
                onChange: (p) => setPage(p),
              }}
              emptyText="暂无角色数据，点击「新增角色」创建"
            />
          </div>
        </Card>
      </div>

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
