/**
 * @file pages/locations/LocationsPage.tsx
 * @description 位置管理页面 — Design System v2
 *
 * 功能：树形层级位置管理，支持展开/折叠、新增顶级/子级、编辑、删除
 * API: getLocationTree / createLocation / updateLocation / deleteLocation (from @/api/base)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, FolderTree, RefreshCw, MapPin, Layers, Search, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/Dialog';
import {
  getLocationTree,
  createLocation as apiCreateLocation,
  updateLocation as apiUpdateLocation,
  deleteLocation as apiDeleteLocation,
} from '@/api/base';
import type { Location } from '@/types/common';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

type LocationNode = Location;

interface LocationFormData {
  name: string;
  locationCode?: string;
  parentId?: number | null;
}

// ─── 工具：在树中更新节点 ────────────────────────────────────────────────────

function updateNodeInTree(tree: LocationNode[], id: number, data: Partial<LocationNode>): LocationNode[] {
  return tree.map(node => {
    if (node.id === id) return { ...node, ...data };
    if (node.children?.length) return { ...node, children: updateNodeInTree(node.children, id, data) };
    return node;
  });
}

function deleteNodeFromTree(tree: LocationNode[], id: number): LocationNode[] {
  return tree
    .filter(node => node.id !== id)
    .map(node => node.children?.length ? { ...node, children: deleteNodeFromTree(node.children, id) } : node);
}

function addChildToTree(tree: LocationNode[], parentId: number, newNode: LocationNode): LocationNode[] {
  return tree.map(node => {
    if (node.id === parentId) {
      return { ...node, children: [...(node.children ?? []), newNode] };
    }
    if (node.children?.length) return { ...node, children: addChildToTree(node.children, parentId, newNode) };
    return node;
  });
}

// ─── Stats helpers ───────────────────────────────────────────────────────────

function countAll(nodes: LocationNode[]): number {
  let count = 0;
  for (const n of nodes) {
    count += 1;
    if (n.children) count += countAll(n.children);
  }
  return count;
}

// ─── Location Form Dialog ────────────────────────────────────────────────────

interface LocationFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  node: LocationNode | null;
  parentId: number | null;
  parentName: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: LocationFormData) => void;
}

function LocationFormDialog({ open, mode, node, parentId, parentName, submitting, onClose, onSubmit }: LocationFormDialogProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (open) {
      setName(mode === 'edit' && node ? node.name : '');
      setCode(mode === 'edit' && node ? (node.locationCode ?? '') : '');
    }
  }, [open, mode, node]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      locationCode: code.trim() || undefined,
      parentId: mode === 'edit' ? (node?.parentId ?? null) : parentId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={mode === 'create' ? '新增位置' : '编辑位置'}>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增位置' : '编辑位置'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? parentName
                ? `在「${parentName}」下添加子位置`
                : '创建一个新的顶级位置'
              : '修改位置名称和编码'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <Input
            label="位置名称 *"
            placeholder="如 A栋3层"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <Input
            label="位置编码"
            placeholder="如 RD-A-3F"
            value={code}
            onChange={e => setCode(e.target.value)}
          />
        </form>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button type="submit" variant="primary" onClick={handleSubmit} loading={submitting}>
            {mode === 'create' ? '确认新增' : '保存修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ───────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  open: boolean;
  node: LocationNode | null;
  onConfirm: () => void;
  onClose: () => void;
}

function DeleteConfirmDialog({ open, node, onConfirm, onClose }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open && !!node} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="确认删除位置">
        <DialogHeader>
          <DialogTitle>确认删除位置</DialogTitle>
          <DialogDescription>此操作不可撤销，子位置也将一并删除。</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4">
          <p className="text-sm text-[#64748b]">
            确定要删除位置「<span className="font-medium text-[#0f172a]">{node?.name}</span>」吗？子位置也将一并删除。
          </p>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button variant="destructive" onClick={onConfirm}>确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 树节点组件 ──────────────────────────────────────────────────────────────

interface TreeNodeRowProps {
  node: LocationNode;
  depth: number;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  onAddChild: (node: LocationNode) => void;
  onEdit: (node: LocationNode) => void;
  onDelete: (node: LocationNode) => void;
}

function TreeNodeRow({ node, depth, expanded, onToggle, onAddChild, onEdit, onDelete }: TreeNodeRowProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expanded.has(node.id);

  return (
    <>
      <div
        className="flex items-center gap-2 px-4 py-2.5 hover:bg-[#f8fafc] rounded-lg group transition-colors"
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        {/* 展开/折叠 */}
        <button
          onClick={() => onToggle(node.id)}
          className={`flex-shrink-0 w-5 h-5 flex items-center justify-center text-[#94a3b8] rounded transition-colors ${hasChildren ? 'hover:text-[#3b82f6]' : 'cursor-default opacity-0'}`}
        >
          {hasChildren && (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
        </button>

        {/* 图标 */}
        <FolderTree className="w-4 h-4 text-[#3b82f6] flex-shrink-0" />

        {/* 名称 + 编码 */}
        <span className="flex-1 text-sm font-medium text-[#374151]">{node.name}</span>
        {node.locationCode && (
          <span className="text-xs text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded font-mono">{node.locationCode}</span>
        )}

        {/* 操作按钮（悬浮显示） */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
          <button
            onClick={() => onAddChild(node)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
            title="新增子级"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onEdit(node)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
            title="编辑"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(node)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 子节点（展开时渲染） */}
      {hasChildren && isExpanded && node.children!.map(child => (
        <TreeNodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingNode, setEditingNode] = useState<LocationNode | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [parentName, setParentName] = useState('顶级');
  const [deleteTarget, setDeleteTarget] = useState<LocationNode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [treeSearch, setTreeSearch] = useState('');

  const filteredTree = useMemo(() => {
    if (!treeSearch.trim()) return tree;
    const term = treeSearch.toLowerCase();
    const filterNodes = (nodes: LocationNode[]): LocationNode[] => {
      return nodes.reduce<LocationNode[]>((acc, node) => {
        const nameMatch = node.name.toLowerCase().includes(term);
        const codeMatch = node.locationCode?.toLowerCase().includes(term);
        const filteredChildren = node.children ? filterNodes(node.children) : [];
        if (nameMatch || codeMatch || filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children });
        }
        return acc;
      }, []);
    };
    return filterNodes(tree);
  }, [tree, treeSearch]);

  // ── 数据加载 ───────────────────────────────────────────────────────────────

  const { data: tree = [], isLoading: loading } = useQuery<LocationNode[]>({
    queryKey: ['location-tree'],
    queryFn: async () => {
      const res = await getLocationTree();
      const data = res ?? [];
      return Array.isArray(data) ? data : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalLocations = useMemo(() => countAll(tree), [tree]);
  const rootCount = tree.length;

  const refreshTree = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['location-tree'] });
  }, [queryClient]);

  // ── 展开/折叠 ─────────────────────────────────────────────────────────────

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const ids = new Set<number>();
    const collect = (nodes: LocationNode[]) => nodes.forEach(n => { ids.add(n.id); if (n.children) collect(n.children); });
    collect(tree);
    setExpanded(ids);
  };

  const collapseAll = () => setExpanded(new Set());

  // ── 弹窗控制 ──────────────────────────────────────────────────────────────

  const handleOpenCreate = (parent: LocationNode | null = null) => {
    setDialogMode('create');
    setEditingNode(null);
    setParentId(parent?.id ?? null);
    setParentName(parent ? parent.name : '顶级');
    setDialogOpen(true);
  };

  const handleOpenEdit = (node: LocationNode) => {
    setDialogMode('edit');
    setEditingNode(node);
    setParentId(node.parentId ?? null);
    setParentName('');
    setDialogOpen(true);
  };

  const handleDelete = async (node: LocationNode) => {
    setDeleteTarget(node);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDeleteLocation(deleteTarget.id);
      toast.success(`位置「${deleteTarget.name}」已删除`);
      refreshTree();
    } catch (err) {
      toast.error('删除位置失败，请稍后重试');
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── 表单提交 ──────────────────────────────────────────────────────────────

  const handleSubmit = async (data: LocationFormData) => {
    setSubmitting(true);
    try {
      if (dialogMode === 'edit' && editingNode) {
        await apiUpdateLocation(editingNode.id, data);
        toast.success('位置更新成功');
      } else {
        await apiCreateLocation(data);
        toast.success('位置创建成功');
      }
      refreshTree();
      setDialogOpen(false);
      setEditingNode(null);
    } catch (err) {
      toast.error(dialogMode === 'edit' ? '更新位置失败，请稍后重试' : '创建位置失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Compact header with stat bar ───────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">位置管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <MapPin className="h-3 w-3" />
                基础数据
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={collapseAll} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">全部折叠</button>
              <button onClick={expandAll} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">全部展开</button>
              <Button variant="primary" onClick={() => handleOpenCreate(null)}>
                <Plus className="w-4 h-4" />
                新增顶级位置
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-sm">
                <MapPin className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">总位置数</p>
                <p className="text-lg font-bold text-slate-900">{totalLocations}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 shadow-sm">
                <Layers className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">顶级位置</p>
                <p className="text-lg font-bold text-slate-900">{rootCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-400 shadow-sm">
                <Building2 className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">有编码</p>
                <p className="text-lg font-bold text-slate-900">{useMemo(() => { const count = (nodes: LocationNode[]): number => nodes.reduce((n, nd) => n + (nd.locationCode ? 1 : 0) + (nd.children ? count(nd.children) : 0), 0); return count(tree); }, [tree])}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-400 shadow-sm">
                <FolderTree className="h-3.5 w-3.5 text-white" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-slate-400">最大深度</p>
                <p className="text-lg font-bold text-slate-900">{useMemo(() => { const depth = (nodes: LocationNode[]): number => nodes.length === 0 ? 0 : 1 + Math.max(...nodes.map(n => n.children ? depth(n.children) : 0)); return depth(tree); }, [tree])}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Main content Card ─────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索位置名称或编码..."
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 placeholder:text-slate-400"
                />
              </div>
              {treeSearch && (
                <span className="text-xs text-slate-500">
                  匹配 <span className="font-bold text-slate-700">{filteredTree.length}</span> 个顶级节点
                </span>
              )}
            </div>
          </div>
          <div className="p-2">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-[#94a3b8] text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                加载中...
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#94a3b8]">
                <FolderTree className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">{treeSearch ? `未找到包含"${treeSearch}"的位置` : '暂无位置数据'}</p>
                {!treeSearch && (
                  <Button variant="primary" size="sm" className="mt-4" onClick={() => handleOpenCreate(null)}>
                    <Plus className="w-4 h-4" />
                    新增顶级位置
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-1">
                {filteredTree.map(node => (
                  <TreeNodeRow
                    key={node.id}
                    node={node}
                    depth={0}
                    expanded={expanded}
                    onToggle={toggleExpand}
                    onAddChild={handleOpenCreate}
                    onEdit={handleOpenEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 表单弹窗 */}
        <LocationFormDialog
          open={dialogOpen}
          mode={dialogMode}
          node={editingNode}
          parentId={parentId}
          parentName={parentName}
          submitting={submitting}
          onClose={() => { setDialogOpen(false); setEditingNode(null); }}
          onSubmit={handleSubmit}
        />

        {/* 删除确认弹窗 */}
        <DeleteConfirmDialog
          open={!!deleteTarget}
          node={deleteTarget}
          onConfirm={executeDelete}
          onClose={() => setDeleteTarget(null)}
        />
      </div>
    </div>
  );
}
