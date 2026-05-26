/**
 * @file pages/category/CategoryManagerPage.tsx
 * @description 资产分类管理页面 — 树形分类展示 + CRUD
 *
 * 功能：
 * - 左侧分类树（/categories/tree）
 * - 右侧选中分类详情
 * - 新增根分类 / 子分类
 * - 编辑分类名称和编码
 * - 删除分类（含子分类检测）
 *
 * 对接 API：
 * - GET /categories/tree — 分类树
 * - POST /categories — 新增分类
 * - PUT /categories/{id} — 更新分类
 * - DELETE /categories/{id} — 删除分类
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit3,
  Trash2,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { getCategoryTree, createCategory, updateCategory, deleteCategory } from '@/api/asset';
import type { AssetCategory } from '@/types/asset';
import type { ApiResponse } from '@/types/common';

// ── 递归树节点组件 ──────────────────────────────────────────────────────────
function TreeNode({
  node,
  selectedId,
  onSelect,
  onAddChild,
  onEdit,
  onDelete,
  depth = 0,
}: {
  node: AssetCategory;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAddChild: (parentId: number) => void;
  onEdit: (node: AssetCategory) => void;
  onDelete: (node: AssetCategory) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer transition-colors group ${
          isSelected
            ? 'bg-blue-50 text-blue-700'
            : 'text-[#374151] hover:bg-[#f8fafc]'
        }`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* 展开/折叠 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="w-4 h-4 flex items-center justify-center text-[#94a3b8] hover:text-[#64748b] flex-shrink-0"
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </button>

        {/* 文件夹图标 */}
        {hasChildren && expanded ? (
          <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
        )}

        {/* 名称 */}
        <span className="text-sm font-medium truncate flex-1">{node.categoryName}</span>

        {/* 操作按钮 */}
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
            className="w-6 h-6 flex items-center justify-center text-[#94a3b8] hover:text-blue-600 hover:bg-blue-50 rounded"
            title="添加子分类"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(node);
            }}
            className="w-6 h-6 flex items-center justify-center text-[#94a3b8] hover:text-amber-600 hover:bg-amber-50 rounded"
            title="编辑"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node);
            }}
            className="w-6 h-6 flex items-center justify-center text-[#94a3b8] hover:text-red-600 hover:bg-red-50 rounded"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 子节点 */}
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 主页面 ──────────────────────────────────────────────────────────────────
export default function CategoryManagerPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // ── Dialog states ─────────────────────────────────────────────────────────
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: 'create' | 'edit' | 'delete';
    title: string;
    parentId?: number | null;
    node?: AssetCategory | null;
  }>({ open: false, mode: 'create', title: '' });

  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formError, setFormError] = useState('');

  // ── API: 分类树 ────────────────────────────────────────────────────────────
  const {
    data: treeRes,
    isLoading: treeLoading,
    error: treeError,
  } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: getCategoryTree,
    staleTime: 1000 * 60,
  });

  const treeData = treeRes as unknown as AssetCategory[] | undefined ?? [];

  // ── 找到当前选中的节点 ────────────────────────────────────────────────────
  function findNode(nodes: AssetCategory[], id: number): AssetCategory | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = findNode(n.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  const selectedNode = selectedId ? findNode(treeData, selectedId) : null;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: { categoryName: string; categoryCode: string; parentId?: number | null }) =>
      createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { categoryName: string; categoryCode: string } }) =>
      updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] });
      if (selectedId === dialogState.node?.id) setSelectedId(null);
      closeDialog();
    },
    onError: (err: Error) => {
      setFormError(err?.message || '删除失败，请检查是否存在子分类或关联资产');
    },
  });

  // ── Dialog handlers ───────────────────────────────────────────────────────
  const openCreateDialog = useCallback((parentId?: number | null) => {
    setDialogState({
      open: true,
      mode: 'create',
      title: parentId ? '添加子分类' : '添加根分类',
      parentId: parentId ?? null,
      node: null,
    });
    setFormName('');
    setFormCode('');
    setFormError('');
  }, []);

  const openEditDialog = useCallback((node: AssetCategory) => {
    setDialogState({
      open: true,
      mode: 'edit',
      title: '编辑分类',
      node,
    });
    setFormName(node.categoryName);
    setFormCode(node.categoryCode || '');
    setFormError('');
  }, []);

  const openDeleteDialog = useCallback((node: AssetCategory) => {
    setDialogState({
      open: true,
      mode: 'delete',
      title: '删除分类',
      node,
    });
    setFormError('');
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, open: false }));
    setFormName('');
    setFormCode('');
    setFormError('');
  }, []);

  const handleSubmit = () => {
    setFormError('');

    if (dialogState.mode === 'create') {
      if (!formName.trim()) {
        setFormError('分类名称不能为空');
        return;
      }
      if (!formCode.trim()) {
        setFormError('分类编码不能为空');
        return;
      }
      createMutation.mutate({
        categoryName: formName.trim(),
        categoryCode: formCode.trim(),
        parentId: dialogState.parentId,
      });
    } else if (dialogState.mode === 'edit' && dialogState.node) {
      if (!formName.trim()) {
        setFormError('分类名称不能为空');
        return;
      }
      if (!formCode.trim()) {
        setFormError('分类编码不能为空');
        return;
      }
      updateMutation.mutate({
        id: dialogState.node.id,
        data: {
          categoryName: formName.trim(),
          categoryCode: formCode.trim(),
        },
      });
    } else if (dialogState.mode === 'delete' && dialogState.node) {
      deleteMutation.mutate(dialogState.node.id);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="资产分类管理"
        subtitle="管理资产分类层级结构"
        breadcrumbs={[{ label: '仪表板', href: '/dashboard' }, { label: '资产分类' }]}
        actions={
          <Button size="sm" onClick={() => openCreateDialog(null)}>
            <Plus className="w-4 h-4" />
            添加根分类
          </Button>
        }
      />

      <div className="flex gap-6">
        {/* ── 左侧：分类树 ─────────────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-xl border border-[#e5e7eb] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e5e7eb]">
              <h3 className="text-sm font-semibold text-[#0f172a]">分类结构</h3>
            </div>
            <div className="p-2 max-h-[600px] overflow-y-auto">
              {treeLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[#94a3b8] animate-spin" />
                </div>
              ) : treeError ? (
                <EmptyState title="加载失败" description="无法加载分类数据" />
              ) : treeData.length === 0 ? (
                <EmptyState
                  title="暂无分类"
                  description="点击上方按钮添加根分类"
                  action={
                    <Button size="sm" onClick={() => openCreateDialog(null)}>
                      添加分类
                    </Button>
                  }
                />
              ) : (
                treeData.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onAddChild={(parentId) => {
                      const parent = findNode(treeData, parentId);
                      openCreateDialog(parentId);
                    }}
                    onEdit={openEditDialog}
                    onDelete={openDeleteDialog}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── 右侧：分类详情 ──────────────────────────────────────────────── */}
        <div className="flex-1">
          {selectedNode ? (
            <div className="bg-white rounded-xl border border-[#e5e7eb] p-6 space-y-4">
              <h3 className="text-lg font-semibold text-[#0f172a]">{selectedNode.categoryName}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[#94a3b8]">分类编码</span>
                  <p className="text-[#374151] font-medium">{selectedNode.categoryCode || '-'}</p>
                </div>
                <div>
                  <span className="text-[#94a3b8]">ID</span>
                  <p className="text-[#374151] font-medium">{selectedNode.id}</p>
                </div>
                <div>
                  <span className="text-[#94a3b8]">父分类 ID</span>
                  <p className="text-[#374151] font-medium">
                    {selectedNode.parentId ? selectedNode.parentId.toString() : '根分类'}
                  </p>
                </div>
                <div>
                  <span className="text-[#94a3b8]">子分类数</span>
                  <p className="text-[#374151] font-medium">
                    {selectedNode.children?.length ?? 0}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openEditDialog(selectedNode)}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  编辑
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openCreateDialog(selectedNode.id)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  添加子分类
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => openDeleteDialog(selectedNode)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#e5e7eb] p-6">
              <EmptyState
                title="选择分类"
                description="请在左侧树中选择一个分类查看详情，或点击上方按钮添加新分类"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── 新增/编辑 Dialog ──────────────────────────────────────────────── */}
      <Dialog open={dialogState.open && dialogState.mode !== 'delete'} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent title={dialogState.title}>
          <DialogHeader>
            <DialogTitle>{dialogState.title}</DialogTitle>
            <DialogDescription>
              {dialogState.mode === 'create'
                ? dialogState.parentId
                  ? '为选中分类添加子分类'
                  : '创建一个新的根分类'
                : '修改分类的名称和编码'}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4">
            <Input
              label="分类名称"
              placeholder="请输入分类名称"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              error={formError && formError.includes('名称') ? formError : undefined}
            />
            <Input
              label="分类编码"
              placeholder="请输入分类编码"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              error={formError && formError.includes('编码') ? formError : undefined}
            />
            {formError && !formError.includes('名称') && !formError.includes('编码') && (
              <p className="text-xs text-red-500">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={closeDialog} disabled={isMutating}>
              取消
            </Button>
            <Button onClick={handleSubmit} loading={isMutating}>
              {dialogState.mode === 'create' ? '创建' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 删除确认 Dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={dialogState.open && dialogState.mode === 'delete'}
        onOpenChange={(v) => !v && closeDialog()}
      >
        <DialogContent title="确认删除">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              此操作不可撤销，请确认是否删除分类 &quot;{dialogState.node?.categoryName}&quot;
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4">
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">注意</p>
                <p>删除分类前，请确保该分类下没有子分类和关联资产。若有子分类，需先删除子分类。</p>
              </div>
            </div>
            {formError && (
              <p className="text-xs text-red-500 mt-2">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={closeDialog} disabled={isMutating}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleSubmit} loading={deleteMutation.isPending}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
