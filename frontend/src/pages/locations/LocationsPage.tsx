/**
 * @file pages/locations/LocationsPage.tsx
 * @description 位置管理页面 — Design System 重构版
 *
 * 功能：树形层级位置管理，支持展开/折叠、新增顶级/子级、编辑、删除
 * API: GET /api/locations/tree, POST /api/locations, PUT /api/locations/:id, DELETE /api/locations/:id
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, FolderTree, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

interface LocationNode {
  id: number;
  name: string;
  code: string;
  parentId: number | null;
  children?: LocationNode[];
}

type LocationFormData = Omit<LocationNode, 'id' | 'children'>;

// ─── Mock 数据（API 失败时兜底）─────────────────────────────────────────────

const MOCK_TREE: LocationNode[] = [
  {
    id: 1, name: '研发大楼', code: 'RD', parentId: null,
    children: [
      { id: 3, name: 'A栋', code: 'RD-A', parentId: 1, children: [] },
      { id: 4, name: 'B栋', code: 'RD-B', parentId: 1, children: [] },
    ],
  },
  {
    id: 2, name: '生产车间', code: 'MFG', parentId: null,
    children: [
      { id: 5, name: '1号线', code: 'MFG-L1', parentId: 2, children: [] },
      { id: 6, name: '2号线', code: 'MFG-L2', parentId: 2, children: [] },
    ],
  },
];

// ─── API 函数 ────────────────────────────────────────────────────────────────

async function fetchLocationTree(): Promise<LocationNode[]> {
  const res = await fetch('/api/locations/tree');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.data ?? data.records ?? []);
}

async function createLocation(body: LocationFormData): Promise<void> {
  const res = await fetch('/api/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function updateLocation(id: number, body: LocationFormData): Promise<void> {
  const res = await fetch(`/api/locations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function deleteLocation(id: number): Promise<void> {
  const res = await fetch(`/api/locations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      setName(mode === 'edit' && node ? node.name : '');
      setCode(mode === 'edit' && node ? node.code : '');
    }
  }, [open, mode, node]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), code: code.trim(), parentId: mode === 'edit' ? (node?.parentId ?? null) : parentId });
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
        <span className="flex-1 text-sm font-medium text-[#374151]">{node.name}</span>
        {node.code && (
          <span className="text-xs text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded font-mono">{node.code}</span>
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
  const [expanded, setExpanded] = useState<Set<number>>(new Set([1, 2]));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingNode, setEditingNode] = useState<LocationNode | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [parentName, setParentName] = useState('顶级');
  const [submitting, setSubmitting] = useState(false);

  // ── 数据加载 ───────────────────────────────────────────────────────────────

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLocationTree();
      setTree(data);
    } catch {
      console.warn('API 不可用，使用 Mock 数据');
      setTree(MOCK_TREE);
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
    setParentName(parent ? parent.name : '顶级');
    setDialogOpen(true);
  };

  const handleOpenEdit = (node: LocationNode) => {
    setDialogMode('edit');
    setEditingNode(node);
    setParentId(node.parentId);
    setParentName('');
    setDialogOpen(true);
  };

  const handleDelete = (node: LocationNode) => {
    if (!window.confirm(`确定要删除位置「${node.name}」吗？子位置也将一并删除。`)) return;
    deleteLocation(node.id).catch(() => {});
    setTree(prev => deleteNodeFromTree(prev, node.id));
  };

  // ── 表单提交 ──────────────────────────────────────────────────────────────

  const handleSubmit = async (data: LocationFormData) => {
    setSubmitting(true);
    try {
      if (dialogMode === 'edit' && editingNode) {
        try {
          await updateLocation(editingNode.id, data);
        } catch {
          // Mock 模式
        }
        setTree(prev => updateNodeInTree(prev, editingNode.id, { name: data.name, code: data.code }));
      } else {
        const newNode: LocationNode = { id: Date.now(), ...data, children: [] };
        try {
          await createLocation(data);
          await loadTree();
        } catch {
          // Mock 模式：本地追加
          if (data.parentId) {
            setTree(prev => addChildToTree(prev, data.parentId!, newNode));
            setExpanded(prev => new Set([...prev, data.parentId!]));
          } else {
            setTree(prev => [...prev, newNode]);
          }
        }
      }
      setDialogOpen(false);
      setEditingNode(null);
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
    </div>
  );
}
