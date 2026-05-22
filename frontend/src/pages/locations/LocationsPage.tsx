/**
 * @file pages/locations/LocationsPage.tsx
 * @description 位置管理页面 — Design System 重构版
 *
 * 功能：树形层级位置管理，支持展开/折叠、新增顶级/子级、编辑、删除
 * API: getLocationTree / createLocation / updateLocation / deleteLocation (from @/api/base)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, FolderTree, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  locationName: string;
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

// ─── 内联表单弹窗 ────────────────────────────────────────────────────────────

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
      setName(mode === 'edit' && node ? node.locationName : '');
      setCode(mode === 'edit' && node ? (node.locationCode ?? '') : '');
    }
  }, [open, mode, node]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      locationName: name.trim(),
      locationCode: code.trim() || undefined,
      parentId: mode === 'edit' ? (node?.parentId ?? null) : parentId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-[#0f172a] mb-1">
          {mode === 'create' ? '新增位置' : '编辑位置'}
        </h3>
        {parentName && (
          <p className="text-xs text-[#94a3b8] mb-5">
            父级位置：{parentName}
          </p>
        )}
        {!parentName && <div className="mb-5" />}
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {mode === 'create' ? '确认新增' : '保存修改'}
            </Button>
          </div>
        </form>
      </div>
    </div>
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
        <span className="flex-1 text-sm font-medium text-[#374151]">{node.locationName}</span>
        {node.locationCode && (
          <span className="text-xs text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded font-mono">{node.locationCode}</span>
        )}

        {/* 操作按钮（悬浮显示） */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
          <button
            onClick={() => onAddChild(node)}
            className="p-1.5 rounded text-[#64748b] hover:bg-blue-50 hover:text-[#3b82f6] transition-colors"
            title="新增子级"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onEdit(node)}
            className="p-1.5 rounded text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors"
            title="编辑"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(node)}
            className="p-1.5 rounded text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
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
  const [tree, setTree] = useState<LocationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingNode, setEditingNode] = useState<LocationNode | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [parentName, setParentName] = useState('顶级');
  const [deleteTarget, setDeleteTarget] = useState<LocationNode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── 数据加载 ───────────────────────────────────────────────────────────────

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLocationTree();
      const data = res.data?.data ?? res.data ?? [];
      setTree(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('加载位置树失败，请稍后重试');
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

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
    setParentName(parent ? parent.locationName : '顶级');
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
      setTree(prev => deleteNodeFromTree(prev, deleteTarget.id));
      toast.success(`位置「${deleteTarget.locationName}」已删除`);
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
        await loadTree();
      } else {
        await apiCreateLocation(data);
        toast.success('位置创建成功');
        await loadTree();
      }
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
    <div className="p-6 bg-[#f8fafc] min-h-full">
      <PageHeader
        title="位置管理"
        subtitle="资产存放位置的层级管理"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" onClick={collapseAll}>
              全部折叠
            </Button>
            <Button variant="outline" size="md" onClick={expandAll}>
              全部展开
            </Button>
            <Button variant="primary" onClick={() => handleOpenCreate(null)}>
              <Plus className="w-4 h-4" />
              新增顶级位置
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-2">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#94a3b8] text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#94a3b8]">
              <FolderTree className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">暂无位置数据</p>
              <Button variant="primary" size="sm" className="mt-4" onClick={() => handleOpenCreate(null)}>
                <Plus className="w-4 h-4" />
                新增顶级位置
              </Button>
            </div>
          ) : (
            <div className="py-1">
              {tree.map(node => (
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
        </CardContent>
      </Card>

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

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">确认删除位置</h3>
            <p className="text-sm text-gray-500">
              确定要删除位置「{deleteTarget.locationName}」吗？子位置也将一并删除。
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>取消</Button>
              <Button variant="destructive" size="sm" onClick={executeDelete}>确认删除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
