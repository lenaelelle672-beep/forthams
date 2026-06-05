/**
 * @file pages/fault-codes/FaultCodePage.tsx
 * @description 故障代码树形管理页面
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Edit, Trash2, ChevronRight, ChevronDown,
  AlertTriangle, Link2, Wrench, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { getFaultCodeTree, createFaultCode, updateFaultCode, deleteFaultCode } from '@/api/faultCode';
import type { FaultCode, CreateFaultCodeRequest, UpdateFaultCodeRequest } from '@/types/faultCode';

/* ── Level configuration ────────────────────────────────────────────────────── */

const LEVEL_CONFIG: Record<number, {
  label: string;
  dot: string;
  text: string;
  bg: string;
  border: string;
  gradient: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  1: {
    label: '故障现象', dot: 'bg-blue-400', text: 'text-blue-600', bg: 'bg-blue-50',
    border: 'border-blue-200', gradient: 'from-blue-600 to-cyan-500', icon: AlertTriangle,
  },
  2: {
    label: '故障原因', dot: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50',
    border: 'border-amber-200', gradient: 'from-amber-500 to-orange-400', icon: Link2,
  },
  3: {
    label: '解决措施', dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50',
    border: 'border-emerald-200', gradient: 'from-emerald-500 to-teal-400', icon: Wrench,
  },
};

function countByLevel(nodes: FaultCode[], level: number): number {
  let count = 0;
  for (const n of nodes) {
    if (n.level === level) count++;
    if (n.children) count += countByLevel(n.children, level);
  }
  return count;
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function FaultCodePage() {
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

  /* ── Mutations (unchanged) ────────────────────────────────────────────── */

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

  /* ── Handlers (unchanged logic) ───────────────────────────────────────── */

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

  /* ── Derived data ─────────────────────────────────────────────────────── */

  const totalCount = useMemo(() => {
    let count = 0;
    const walk = (nodes: FaultCode[]) => {
      for (const n of nodes) {
        count++;
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    return count;
  }, [tree]);

  const statCards = [
    { label: '节点总数', value: totalCount, unit: '项', icon: Layers, gradient: 'from-blue-600 to-cyan-500' },
    { label: '故障现象', value: countByLevel(tree, 1), unit: '项', icon: LEVEL_CONFIG[1].icon, gradient: LEVEL_CONFIG[1].gradient },
    { label: '故障原因', value: countByLevel(tree, 2), unit: '项', icon: LEVEL_CONFIG[2].icon, gradient: LEVEL_CONFIG[2].gradient },
    { label: '解决措施', value: countByLevel(tree, 3), unit: '项', icon: LEVEL_CONFIG[3].icon, gradient: LEVEL_CONFIG[3].gradient },
  ];

  /* ── Tree node renderer ───────────────────────────────────────────────── */

  function renderNode(node: FaultCode, depth: number = 0) {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const cfg = LEVEL_CONFIG[node.level ?? 0];
    const levelLabel = cfg?.label ?? '';
    const levelCfg = cfg ?? { dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2.5 py-2.5 px-3 hover:bg-slate-50/80 rounded-xl transition-colors group"
          style={{ marginLeft: depth * 24 }}
        >
          <button
            onClick={() => hasChildren && toggleExpand(node.id)}
            className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${hasChildren ? 'cursor-pointer hover:bg-slate-200/60' : 'cursor-default opacity-30'}`}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <span className="w-3.5" />
            )}
          </button>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${levelCfg.bg} ${levelCfg.border} ${levelCfg.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${levelCfg.dot}`} />
            {levelLabel} (L{node.level})
          </span>
          <span className="font-mono text-xs font-semibold text-blue-600">{node.code}</span>
          <span className="text-sm text-slate-600 truncate">
            {node.faultPhenomenon || node.faultCause || node.solution || '-'}
          </span>
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.level && node.level < 3 && (
              <button
                onClick={() => openCreate(node)}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
                title="添加子节点"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => openEdit(node)}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-500 transition hover:border-amber-200 hover:text-amber-600"
              title="编辑"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeleteConfirm(node)}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-500 transition hover:border-red-200 hover:text-red-600"
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

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* Header with stat bar */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">故障代码管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <AlertTriangle className="h-3 w-3" />
                故障树
              </span>
            </div>
            <Button variant="primary" size="md" onClick={() => openCreate()}>
              <Plus className="w-4 h-4" />
              新增根节点
            </Button>
          </div>

          {/* Stat bar */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 sm:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3 px-5 py-3">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stat.gradient} shadow-sm`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">{stat.label}</p>
                    <p className="text-lg font-bold text-slate-900">
                      {stat.value}
                      <span className="ml-0.5 text-xs font-medium text-slate-400">{stat.unit}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Main content card */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Toolbar */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
              <Layers className="h-3.5 w-3.5" />
              故障代码
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              三级故障编码体系
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">现象 → 原因 → 措施</p>
          </div>

          {/* Tree content */}
          <div className="p-4 sm:p-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
                  加载中...
                </span>
              </div>
            ) : tree.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <AlertTriangle className="h-7 w-7 text-slate-400" />
                </div>
                <h3 className="text-base font-medium text-slate-700 mb-1">暂无故障代码</h3>
                <p className="text-sm text-slate-400 mb-4">点击「新增根节点」创建第一级故障现象</p>
                <Button variant="outline" size="md" onClick={() => openCreate()}>
                  <Plus className="w-4 h-4" />
                  新增根节点
                </Button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {tree.map((node: FaultCode) => renderNode(node))}
              </div>
            )}
          </div>
        </Card>

        {/* Create / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingNode ? '编辑故障代码' : parentNode ? `添加子节点（${parentNode.code}）` : '新增故障代码'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 px-6 py-4">
              <Input
                label="故障编码 *"
                value={form.code}
                onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
                placeholder="请输入故障编码"
              />
              <Input
                label={parentNode?.level === 1 ? '故障原因' : parentNode?.level === 2 ? '解决措施' : '故障现象'}
                value={form.faultPhenomenon || form.faultCause || form.solution}
                onChange={e => {
                  const val = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    faultPhenomenon: prev.parentId ? undefined : val,
                    faultCause: prev.parentId ? val : undefined,
                    solution: prev.parentId ? val : undefined,
                  }));
                }}
                placeholder="请输入描述"
              />
              <Input
                label="排序号"
                type="number"
                value={form.sortOrder}
                onChange={e => setForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>取消</Button>
              <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending}>
                {editingNode ? '保存' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-4">
              <p className="text-sm text-slate-600">
                确定要删除故障代码「{deleteConfirm?.code}」吗？此操作不可撤销。
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>取消</Button>
              <Button
                variant="destructive"
                loading={deleteMutation.isPending}
                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              >
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
