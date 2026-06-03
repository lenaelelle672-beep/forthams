import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  ChevronUp,
  Network,
  Phone,
  Mail,
  Hash,
  FileText,
  UserCircle,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import { createDept, deleteDept, getDeptTree, updateDept } from '@/api/base';
import type { Department } from '@/types/common';
import { UserSearchSelect } from '@/components/ui/UserSearchSelect';

// ── Types ──────────────────────────────────────────────────────────────────────

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

/** Count total descendants of a department node */
function countDescendants(node: Department): number {
  if (!node.children || node.children.length === 0) return 0;
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

// ── Tree node component ────────────────────────────────────────────────────────

function DeptTreeNode({
  node,
  depth,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
}: {
  node: Department;
  depth: number;
  selectedId: number | null;
  expandedIds: Set<number>;
  onSelect: (dept: Department) => void;
  onToggle: (id: number) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const isDisabled = node.status === 0;

  return (
    <div
      className={`
        relative
        ${depth > 0 ? 'border-l-2 border-slate-100 ml-3' : ''}
      `}
    >
      <button
        type="button"
        onClick={() => {
          onSelect(node);
          if (hasChildren) onToggle(node.id);
        }}
        className={`
          group flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition-all duration-150
          ${isSelected
            ? 'bg-blue-50 text-blue-700 font-semibold ring-1 ring-inset ring-blue-200 shadow-sm'
            : 'text-slate-700 hover:bg-slate-50'
          }
          ${isDisabled ? 'opacity-50' : ''}
        `}
      >
        {/* expand toggle */}
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 transition-transform" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 transition-transform" />
            )
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
          )}
        </span>

        {/* icon */}
        <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`} />

        {/* label */}
        <span className="truncate flex-1">{getDeptName(node)}</span>

        {/* child count badge */}
        {hasChildren && (
          <span className={`
            text-[10px] rounded-full px-1.5 py-px shrink-0 font-medium tabular-nums
            ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}
          `}>
            {node.children!.length}
          </span>
        )}

        {/* status indicator */}
        {isDisabled && (
          <span className="text-[10px] text-red-500 bg-red-50 rounded px-1 py-px shrink-0 font-medium">
            停用
          </span>
        )}
      </button>

      {/* children */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {node.children!.map((child) => (
            <DeptTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DeptManagement() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
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
      if (selectedDept && deleteTarget?.id === selectedDept.id) {
        setSelectedDept(null);
      }
    },
    onError: (err: Error) => toast.error(err.message || '删除失败'),
  });

  // ── Expand/collapse all nodes initially ──
  const allNodeIds = useMemo(() => {
    const ids = new Set<number>();
    function collect(nodes: Department[]) {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          ids.add(n.id);
          collect(n.children);
        }
      }
    }
    collect(deptTree);
    return ids;
  }, [deptTree]);

  // Initialize expanded state when data loads
  const [initialized, setInitialized] = useState(false);
  if (deptTree.length > 0 && !initialized) {
    setExpandedIds(allNodeIds);
    setInitialized(true);
  }

  // ── Search filter: recursively filter tree by keyword ──
  const filteredTree = useMemo(() => {
    if (!keyword.trim()) return deptTree;
    const kw = keyword.trim().toLowerCase();

    function matchNode(node: Department): boolean {
      const name = getDeptName(node).toLowerCase();
      const code = (node.deptCode ?? '').toLowerCase();
      const leader = (node.leader ?? '').toLowerCase();
      const phone = (node.phone ?? '').toLowerCase();
      const email = (node.email ?? '').toLowerCase();
      return name.includes(kw) || code.includes(kw) || leader.includes(kw) || phone.includes(kw) || email.includes(kw);
    }

    function filterNodes(nodes: Department[]): Department[] {
      const result: Department[] = [];
      for (const node of nodes) {
        const childMatch = node.children ? filterNodes(node.children) : [];
        if (matchNode(node) || childMatch.length > 0) {
          result.push({ ...node, children: childMatch.length > 0 ? childMatch : node.children });
        }
      }
      return result;
    }

    return filterNodes(deptTree);
  }, [deptTree, keyword]);

  // ── Handlers ──
  const handleSelect = useCallback((dept: Department) => {
    setSelectedDept(dept);
  }, []);

  const handleToggle = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function handleExpandAll() {
    setExpandedIds(allNodeIds);
  }

  function handleCollapseAll() {
    setExpandedIds(new Set());
  }

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

  // Flat dept options for parent selector
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

  // Count all depts for summary
  const totalDeptCount = useMemo(() => {
    function count(nodes: Department[]): number {
      return nodes.reduce((sum, n) => sum + 1 + (n.children ? count(n.children) : 0), 0);
    }
    return count(deptTree);
  }, [deptTree]);

  // Find parent name for selected dept
  const selectedParentName = useMemo(() => {
    if (!selectedDept) return null;
    const parentId = selectedDept.parentId;
    if (!parentId || parentId === 0) return null;
    function findName(nodes: Department[]): string | null {
      for (const n of nodes) {
        if (n.id === parentId) return getDeptName(n);
        if (n.children) {
          const found = findName(n.children);
          if (found) return found;
        }
      }
      return null;
    }
    return findName(deptTree);
  }, [deptTree, selectedDept]);

  // Count active/dept stats
  const activeDeptCount = useMemo(() => {
    function count(nodes: Department[]): number {
      return nodes.reduce((sum, n) => sum + (n.status !== 0 ? 1 : 0) + (n.children ? count(n.children) : 0), 0);
    }
    return count(deptTree);
  }, [deptTree]);

  const topLevelCount = deptTree.length;

  /* ── Stat bar definitions ── */
  const statCards = [
    { label: '部门总数', value: totalDeptCount, icon: Building2, gradient: 'from-blue-600 to-cyan-500' },
    { label: '正常部门', value: activeDeptCount, icon: Users, gradient: 'from-emerald-500 to-teal-400' },
    { label: '顶级部门', value: topLevelCount, icon: Network, gradient: 'from-violet-500 to-purple-400' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ── Compact header with stat bar ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">部门管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-cyan-700">
                <Building2 className="h-3 w-3" />
                组织架构
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="md" onClick={() => openCreate()}>
                <Plus className="w-4 h-4" />
                新增部门
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

        {/* ── Left-right layout: Tree + Detail ── */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left: Department tree ── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm lg:w-[320px] xl:w-[360px] shrink-0">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="w-4 h-4 text-blue-500" />
                组织架构
              </CardTitle>
              <Button variant="primary" size="sm" onClick={() => openCreate()}>
                <Plus className="w-3.5 h-3.5" />
                新增
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索部门名称、编码、负责人..."
                  className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                />
              </div>

              {/* Summary + Expand/Collapse controls */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Users className="w-3 h-3" />
                  <span>共 <strong className="text-slate-600">{totalDeptCount}</strong> 个部门</span>
                </div>
                {deptTree.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="text-[10px] text-blue-500 hover:text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
                      onClick={handleExpandAll}
                      title="展开全部"
                    >
                      全部展开
                    </button>
                    <span className="text-slate-300 text-[10px]">|</span>
                    <button
                      type="button"
                      className="text-[10px] text-blue-500 hover:text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
                      onClick={handleCollapseAll}
                      title="收起全部"
                    >
                      全部收起
                    </button>
                  </div>
                )}
              </div>

              {/* Tree */}
              <div className="max-h-[calc(100vh-340px)] overflow-y-auto space-y-0.5 pr-1">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-xs text-slate-400">
                    <RefreshCw className="mb-2 h-5 w-5 animate-spin text-slate-300" />
                    <span>加载部门数据...</span>
                  </div>
                ) : filteredTree.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center bg-slate-50/50">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                      <Building2 className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                      {keyword ? '未找到匹配的部门' : '暂无部门数据'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {keyword ? '请尝试更换关键词' : '点击下方按钮创建第一个部门'}
                    </p>
                    {!keyword && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-4"
                        onClick={() => openCreate()}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        新增部门
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredTree.map((node) => (
                    <DeptTreeNode
                      key={node.id}
                      node={node}
                      depth={0}
                      selectedId={selectedDept?.id ?? null}
                      expandedIds={expandedIds}
                      onSelect={handleSelect}
                      onToggle={handleToggle}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Right: Detail panel ── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm flex-1 min-w-0">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">部门详情</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {selectedDept ? (
                <div className="space-y-6">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`
                        flex h-11 w-11 items-center justify-center rounded-xl shadow-sm
                        ${selectedDept.status === 0 ? 'bg-red-50' : 'bg-blue-50'}
                      `}>
                        <Building2 className={`h-5 w-5 ${selectedDept.status === 0 ? 'text-red-400' : 'text-blue-500'}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {getDeptName(selectedDept)}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">
                            编码: {selectedDept.deptCode || '—'}
                          </span>
                          {selectedParentName && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-xs text-slate-400">
                                上级: {selectedParentName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                      selectedDept.status === 0
                        ? 'border-red-200 bg-red-50 text-red-600'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedDept.status === 0 ? 'bg-red-400' : 'bg-emerald-400'}`} />
                      {selectedDept.status === 0 ? '停用' : '正常'}
                    </span>
                  </div>

                  {/* Info sections */}
                  <div className="space-y-5">
                    {/* Basic info */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Network className="w-3.5 h-3.5" />
                        基本信息
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3 bg-slate-50/50 rounded-lg p-4">
                        <DetailField icon={<Hash className="w-3.5 h-3.5 text-slate-400" />} label="部门编码" value={selectedDept.deptCode} />
                        <DetailField icon={<Network className="w-3.5 h-3.5 text-slate-400" />} label="部门类型" value={DEPT_TYPE_LABELS[selectedDept.deptType ?? '']} />
                        <DetailField icon={<Hash className="w-3.5 h-3.5 text-slate-400" />} label="排序" value={String(selectedDept.sortOrder ?? selectedDept.orderNum ?? selectedDept.sort ?? 0)} />
                        {selectedDept.children && selectedDept.children.length > 0 && (
                          <DetailField icon={<Users className="w-3.5 h-3.5 text-slate-400" />} label="下级部门" value={`${selectedDept.children.length} 个（共 ${countDescendants(selectedDept)} 个子孙）`} />
                        )}
                      </div>
                    </div>

                    {/* Contact info */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <UserCircle className="w-3.5 h-3.5" />
                        负责人/联系方式
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3 bg-slate-50/50 rounded-lg p-4">
                        <DetailField icon={<UserCircle className="w-3.5 h-3.5 text-slate-400" />} label="负责人" value={selectedDept.leader} />
                        <DetailField icon={<Phone className="w-3.5 h-3.5 text-slate-400" />} label="联系电话" value={selectedDept.phone} />
                        <DetailField icon={<Mail className="w-3.5 h-3.5 text-slate-400" />} label="邮箱" value={selectedDept.email} />
                      </div>
                    </div>

                    {/* Description */}
                    {selectedDept.description && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          备注
                        </h4>
                        <div className="bg-slate-50/50 rounded-lg p-4">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedDept.description}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100">
                    <button
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
                      onClick={() => openCreate(selectedDept.id)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      新增下级部门
                    </button>
                    <button
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
                      onClick={() => {
                        const d = findDepth(deptTree, selectedDept.id);
                        openEdit(selectedDept, d);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      编辑部门
                    </button>
                    <button
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      onClick={() => setDeleteTarget(selectedDept)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除部门
                    </button>
                  </div>
                </div>
              ) : (
                /* Empty detail state */
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
                    <Building2 className="h-8 w-8 text-slate-200" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">请选择一个部门查看详情</p>
                  <p className="text-xs text-slate-400 mt-1">点击左侧组织架构树中的节点即可查看</p>
                  <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
                    <ChevronRight className="w-3 h-3" />
                    <span>支持展开/收起子级</span>
                    <span className="text-slate-300">·</span>
                    <Search className="w-3 h-3" />
                    <span>支持搜索过滤</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent title={editingDept ? '编辑部门' : '新增部门'} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={submitForm} className="space-y-4 p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">上级部门</label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="邮箱"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">部门类型</label>
                <select
                  value={form.deptType}
                  onChange={(e) => setForm((p) => ({ ...p, deptType: e.target.value }))}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className="text-sm font-medium text-slate-700">状态</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: Number(e.target.value) }))}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value={1}>正常</option>
                <option value={0}>停用</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">备注</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400"
                placeholder="部门描述、职责说明等"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary" onClick={closeForm}>取消</Button>
              </DialogClose>
              <Button
                type="submit"
                variant="primary"
                loading={createMut.isPending || updateMut.isPending}
              >
                {editingDept ? '保存修改' : '确认新增'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteTarget != null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent title="确认删除部门">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600">
                  确定要删除「<strong className="text-slate-900">{deleteTarget && getDeptName(deleteTarget)}</strong>」吗？
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  部门下存在用户或子部门时，后端会拒绝删除操作。
                </p>
              </div>
            </div>
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function DetailField({ label, value, icon }: { label: string; value?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        <dt className="text-[11px] text-slate-400 mb-0.5 font-medium">{label}</dt>
        <dd className="text-sm text-slate-700 truncate">{value || '—'}</dd>
      </div>
    </div>
  );
}

/** Find the depth of a department node in the tree */
function findDepth(nodes: Department[], targetId: number, currentDepth = 0): number {
  for (const node of nodes) {
    if (node.id === targetId) return currentDepth;
    if (node.children) {
      const d = findDepth(node.children, targetId, currentDepth + 1);
      if (d >= 0) return d;
    }
  }
  return -1;
}
