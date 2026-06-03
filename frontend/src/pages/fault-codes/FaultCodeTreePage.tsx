/**
 * @file pages/fault-codes/FaultCodeTreePage.tsx
 * @description 故障代码树形管理页面（三级结构：现象→原因→措施）
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { getFaultCodeTree, createFaultCode, updateFaultCode, deleteFaultCode } from '@/api/faultCode';
import type { FaultCode, CreateFaultCodeRequest, UpdateFaultCodeRequest } from '@/types/faultCode';

export default function FaultCodeTreePage() {
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<FaultCode | null>(null);
  const [editingNode, setEditingNode] = useState<FaultCode | null>(null);
  const [parentNode, setParentNode] = useState<FaultCode | null>(null);
  const [form, setForm] = useState({ code: '', faultPhenomenon: '', faultCause: '', solution: '', sortOrder: 0 });

  const { data: res, isLoading } = useQuery({
    queryKey: ['fault-codes', 'tree'],
    queryFn: () => getFaultCodeTree(),
  });

  const tree = (res as any)?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: CreateFaultCodeRequest) => createFaultCode(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fault-codes'] });
      toast.success('创建成功');
      closeDialog();
    },
    onError: (err: any) => toast.error(err?.message || '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateFaultCodeRequest }) => updateFaultCode(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fault-codes'] });
      toast.success('更新成功');
      closeDialog();
    },
    onError: (err: any) => toast.error(err?.message || '更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFaultCode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fault-codes'] });
      toast.success('删除成功');
      setDeleteConfirm(null);
    },
    onError: (err: any) => toast.error(err?.message || '删除失败'),
  });

  function openCreate(parent?: FaultCode) {
    setEditingNode(null);
    setParentNode(parent || null);
    setForm({ code: '', faultPhenomenon: '', faultCause: '', solution: '', sortOrder: 0 });
    setDialogOpen(true);
  }

  function openEdit(node: FaultCode) {
    setEditingNode(node);
    setParentNode(null);
    setForm({
      code: node.code || '',
      faultPhenomenon: node.faultPhenomenon || '',
      faultCause: node.faultCause || '',
      solution: node.solution || '',
      sortOrder: node.sortOrder || 0,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingNode(null);
    setParentNode(null);
  }

  function handleSubmit() {
    if (!form.code.trim()) {
      toast.error('请输入故障编码');
      return;
    }
    const data: CreateFaultCodeRequest = {
      code: form.code.trim(),
      faultPhenomenon: form.faultPhenomenon.trim(),
      faultCause: form.faultCause.trim(),
      solution: form.solution.trim(),
      parentId: parentNode?.id,
      sortOrder: form.sortOrder,
    };
    if (editingNode) {
      updateMutation.mutate({ id: editingNode.id, data: data as UpdateFaultCodeRequest });
    } else {
      createMutation.mutate(data);
    }
  }

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getLevelLabel(level?: number): string {
    switch (level) {
      case 1: return '故障现象';
      case 2: return '故障原因';
      case 3: return '解决措施';
      default: return '';
    }
  }

  function getLevelColor(level?: number): string {
    switch (level) {
      case 1: return 'text-blue-600 bg-blue-50 border-blue-200';
      case 2: return 'text-amber-600 bg-amber-50 border-amber-200';
      case 3: return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }

  function renderNode(node: FaultCode, depth: number = 0) {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors group"
          style={{ marginLeft: depth * 24 }}
        >
          <button
            onClick={() => hasChildren && toggleExpand(node.id)}
            className={`w-5 h-5 flex items-center justify-center ${hasChildren ? 'cursor-pointer' : 'cursor-default opacity-30'}`}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              <span className="w-4" />
            )}
          </button>
          <div className={`px-2 py-0.5 rounded text-xs font-medium border ${getLevelColor(node.level)}`}>
            {getLevelLabel(node.level)} (L{node.level})
          </div>
          <span className="font-mono text-xs text-blue-600 font-medium">{node.code}</span>
          <span className="text-sm text-gray-700">
            {node.faultPhenomenon || node.faultCause || node.solution || '-'}
          </span>
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.level && node.level < 3 && (
              <button
                onClick={() => openCreate(node)}
                className="p-1 text-gray-400 hover:text-blue-600 rounded"
                title="添加子节点"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => openEdit(node)}
              className="p-1 text-gray-400 hover:text-amber-600 rounded"
              title="编辑"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeleteConfirm(node)}
              className="p-1 text-gray-400 hover:text-red-600 rounded"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          node.children!.map(child => renderNode(child, depth + 1))
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="故障代码管理"
        description="管理三级故障编码体系（现象→原因→措施）"
        actions={
          <Button onClick={() => openCreate()} className="gap-2">
            <Plus className="w-4 h-4" />
            新增根节点
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">加载中...</div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <p className="mb-2">暂无故障代码</p>
              <p className="text-sm">点击「新增根节点」创建第一级故障现象</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tree.map((node: FaultCode) => renderNode(node))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingNode ? '编辑故障代码' : parentNode ? `添加子节点（${parentNode.code}）` : '新增故障代码'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-1">故障编码 *</label>
              <Input
                value={form.code}
                onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
                placeholder="请输入故障编码"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {parentNode?.level === 1 ? '故障原因' : parentNode?.level === 2 ? '解决措施' : '故障现象'}
              </label>
              <Input
                value={form.faultPhenomenon || form.faultCause || form.solution}
                onChange={e => {
                  const val = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    faultPhenomenon: !prev.parentId ? val : undefined,
                    faultCause: prev.parentId && prev.level !== 3 ? val : undefined,
                    solution: prev.parentId && prev.level === 3 ? val : undefined,
                  }));
                }}
                placeholder="请输入描述"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">排序号</label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={e => setForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>取消</Button>
            <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending}>
              {editingNode ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            确定要删除故障代码「{deleteConfirm?.code}」吗？有子节点的故障代码不可删除。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>取消</Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
