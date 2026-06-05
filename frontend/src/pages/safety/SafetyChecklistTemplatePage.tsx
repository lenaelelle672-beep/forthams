/**
 * @file pages/safety/SafetyChecklistTemplatePage.tsx
 * @description 安全检查表模板配置页面 — Design System 重构版
 *
 * 功能：模板列表、新增/编辑模板、管理检查项、执行检查、删除模板
 * API: safetyApi (listTemplates, createTemplate, updateTemplate, deleteTemplate, getItems, batchSaveItems)
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { safetyApi } from '../../api/safety';
import type { SafetyChecklistTemplate, SafetyChecklistItem } from '../../types/safety';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Play, FileText, CheckCircle, Archive, X,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Select, SelectItem } from '@/components/ui/Select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/Dialog';
import { PageTransition } from '@/components/ui';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const ITEM_TYPE_LABELS: Record<string, string> = {
  PASS_FAIL: '通过/不通过',
  READING:   '读数',
  PHOTO:     '拍照',
  TEXT:      '文本',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL',      label: '全部' },
  { value: 'ACTIVE',   label: '启用' },
  { value: 'DISABLED', label: '禁用' },
] as const;

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function TemplateStatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
      active
        ? 'ring-green-200 border-green-200 text-green-700'
        : 'ring-gray-200 border-gray-200 text-gray-600'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
      {active ? '启用' : '禁用'}
    </span>
  );
}

// ─── 模板编辑 Dialog ─────────────────────────────────────────────────────────

interface TemplateEditDialogProps {
  open: boolean;
  editing: boolean;
  templateName: string;
  templateStatus: string;
  categoryIds: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onTemplateNameChange: (v: string) => void;
  onTemplateStatusChange: (v: string) => void;
  onCategoryIdsChange: (v: string) => void;
}

function TemplateEditDialog({
  open, editing, templateName, templateStatus, categoryIds, submitting,
  onClose, onSubmit, onTemplateNameChange, onTemplateStatusChange, onCategoryIdsChange,
}: TemplateEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑模板' : '新增模板'}</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">
              模板名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => onTemplateNameChange(e.target.value)}
              placeholder="如：消防安全检查表"
              className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] bg-white text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                placeholder:text-[#94a3b8] transition-all"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">状态</label>
            <Select value={templateStatus} onValueChange={onTemplateStatusChange}>
              <SelectItem value="ACTIVE">启用</SelectItem>
              <SelectItem value="DISABLED">禁用</SelectItem>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">适用资产分类</label>
            <textarea
              value={categoryIds}
              onChange={(e) => onCategoryIdsChange(e.target.value)}
              rows={2}
              placeholder="JSON数组：[1,2,3] 或留空"
              className="w-full px-3 py-2 rounded-lg border border-[#e5e7eb] text-sm bg-white transition-all
                focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                placeholder:text-[#94a3b8] resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button variant="primary" onClick={onSubmit} loading={submitting}>
            {editing ? '保存修改' : '确认新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 检查项管理 Dialog ───────────────────────────────────────────────────────

interface ItemManageDialogProps {
  open: boolean;
  items: SafetyChecklistItem[];
  itemLines: string;
  addingLoading: boolean;
  onClose: () => void;
  onAdd: () => void;
  onItemLinesChange: (v: string) => void;
}

function ItemManageDialog({
  open, items, itemLines, addingLoading, onClose, onAdd, onItemLinesChange,
}: ItemManageDialogProps) {
  const itemColumns: Column<SafetyChecklistItem>[] = [
    { key: 'sortOrder', title: '排序', width: 60, align: 'center' },
    { key: 'itemName', title: '检查项名称' },
    {
      key: 'itemType',
      title: '类型',
      width: 120,
      render: (v) => (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-100">
          {ITEM_TYPE_LABELS[(v as string)] || (v as string)}
        </span>
      ),
    },
    {
      key: 'required',
      title: '必填',
      width: 70,
      align: 'center',
      render: (v) => (
        <span className={`text-sm font-medium ${(v as number) === 1 ? 'text-green-600' : 'text-slate-400'}`}>
          {(v as number) === 1 ? '是' : '否'}
        </span>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>管理检查项</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-5">
          <DataTable<SafetyChecklistItem>
            columns={itemColumns}
            data={items}
            rowKey="id"
            compact
          />
          <div className="space-y-3 border-t border-slate-100 pt-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">添加检查项（每行一个）</label>
              <textarea
                value={itemLines}
                onChange={(e) => onItemLinesChange(e.target.value)}
                rows={4}
                placeholder={"输入检查项名称，每行一个\n如：\n灭火器是否在有效期内\n安全出口是否畅通\n应急灯是否正常工作"}
                className="w-full px-3 py-2 rounded-lg border border-[#e5e7eb] text-sm bg-white transition-all
                  focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                  placeholder:text-[#94a3b8] resize-none"
              />
            </div>
            <Button variant="primary" onClick={onAdd} loading={addingLoading}>
              批量添加
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 删除确认 Dialog ─────────────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  open: boolean;
  template: SafetyChecklistTemplate | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ open, template, deleting, onClose, onConfirm }: DeleteConfirmDialogProps) {
  if (!open || !template) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-[#0f172a] mb-3">确认删除</h3>
        <p className="text-sm text-[#64748b] mb-6">
          确定要删除模板「
          <span className="font-medium text-[#0f172a]">{template.templateName}</span>
          」吗？此操作不可撤销。
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>
            取消
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm} loading={deleting}>
            确认删除
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

const SafetyChecklistTemplatePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 模板编辑弹窗状态
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SafetyChecklistTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateStatus, setTemplateStatus] = useState('ACTIVE');
  const [categoryIds, setCategoryIds] = useState('');

  // 检查项管理弹窗状态
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [itemLines, setItemLines] = useState('');

  // 删除确认弹窗状态
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<SafetyChecklistTemplate | null>(null);

  // 快速过滤
  const [statusFilter, setStatusFilter] = useState('ALL');

  // ── 查询 ──────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['safetyTemplates'],
    queryFn: () => safetyApi.listTemplates({ pageNum: 1, pageSize: 100 }),
  });

  const { data: itemsData, refetch: refetchItems } = useQuery({
    queryKey: ['safetyItems', selectedTemplateId],
    queryFn: () => safetyApi.getItems(selectedTemplateId!),
    enabled: !!selectedTemplateId,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: safetyApi.createTemplate,
    onSuccess: () => {
      toast.success('模板创建成功');
      queryClient.invalidateQueries({ queryKey: ['safetyTemplates'] });
      handleClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: number; data: SafetyChecklistTemplate }) =>
      safetyApi.updateTemplate(params.id, params.data),
    onSuccess: () => {
      toast.success('模板更新成功');
      queryClient.invalidateQueries({ queryKey: ['safetyTemplates'] });
      handleClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: safetyApi.deleteTemplate,
    onSuccess: () => {
      toast.success('模板已删除');
      queryClient.invalidateQueries({ queryKey: ['safetyTemplates'] });
      setDeleteOpen(false);
      setDeletingTemplate(null);
    },
  });

  const batchSaveMutation = useMutation({
    mutationFn: (params: { templateId: number; items: SafetyChecklistItem[] }) =>
      safetyApi.batchSaveItems(params.templateId, params.items),
    onSuccess: () => {
      toast.success('检查项已保存');
      refetchItems();
      setItemModalOpen(false);
    },
  });

  // ── 处理函数 ──────────────────────────────────────────────────────────────

  const handleOpen = (template?: SafetyChecklistTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateName(template.templateName ?? '');
      setTemplateStatus(template.status ?? 'ACTIVE');
      setCategoryIds(template.categoryIds ?? '');
    } else {
      setEditingTemplate(null);
      setTemplateName('');
      setTemplateStatus('ACTIVE');
      setCategoryIds('');
    }
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateStatus('ACTIVE');
    setCategoryIds('');
  };

  const handleSubmit = () => {
    if (!templateName.trim()) {
      toast.error('请输入模板名称');
      return;
    }
    const values = { templateName, status: templateStatus, categoryIds };
    if (editingTemplate?.id) {
      updateMutation.mutate({ id: editingTemplate.id, data: values as SafetyChecklistTemplate });
    } else {
      createMutation.mutate(values as SafetyChecklistTemplate);
    }
  };

  const handleManageItems = (templateId: number) => {
    setSelectedTemplateId(templateId);
    setItemLines('');
    setItemModalOpen(true);
  };

  const handleAddItem = () => {
    if (!selectedTemplateId) return;
    const items = (itemsData as SafetyChecklistItem[]) || [];
    const parsedItems = itemLines
      ? itemLines.split('\n').filter((l: string) => l.trim())
          .map((line: string, index: number) => ({
            templateId: selectedTemplateId,
            itemName: line.trim(),
            itemType: 'PASS_FAIL' as const,
            sortOrder: items.length + index + 1,
            required: 1,
          }))
      : [];

    const allItems = [...items, ...parsedItems];
    batchSaveMutation.mutate({ templateId: selectedTemplateId, items: allItems });
  };

  // ── 数据 ──────────────────────────────────────────────────────────────────

  const templates: SafetyChecklistTemplate[] = (data as any)?.records || (data as any)?.list || [];
  const items: SafetyChecklistItem[] = (itemsData as SafetyChecklistItem[]) || [];

  const displayTemplates = statusFilter === 'ALL'
    ? templates
    : templates.filter((t) => t.status === statusFilter);

  // ── 统计 ──────────────────────────────────────────────────────────────────

  const totalCount = templates.length;
  const activeCount = templates.filter((t) => t.status === 'ACTIVE').length;
  const disabledCount = templates.filter((t) => t.status !== 'ACTIVE').length;

  // ── DataTable 列定义 ──────────────────────────────────────────────────────

  const columns: Column<SafetyChecklistTemplate>[] = [
    { key: 'templateName', title: '模板名称', width: 240 },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (v) => <TemplateStatusBadge status={v as string} />,
    },
    {
      key: 'itemCount',
      title: '检查项',
      width: 120,
      align: 'center',
      render: (_v, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleManageItems(row.id!); }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          <Archive className="w-3.5 h-3.5" />
          管理检查项
        </button>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      align: 'center',
      render: (_v, row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleOpen(row); }}
            className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors"
            title="编辑"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/safety-checklists/execute/${row.id}?mode=start`); }}
            className="p-1.5 rounded-lg text-[#64748b] hover:bg-green-50 hover:text-green-600 transition-colors"
            title="执行"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeletingTemplate(row); setDeleteOpen(true); }}
            className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageTransition>
      <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

          {/* ── 页头 + 统计栏 ────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
            <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--surface-heading)]">
                  安全检查表模板
                </h1>
                <p className="mt-1 text-sm text-[var(--surface-muted-text)]">
                  配置检查表模板与检查项清单
                </p>
              </div>
              <Button variant="primary" onClick={() => handleOpen()}>
                <Plus className="w-4 h-4" />
                新增模板
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/60">
                  <FileText className="h-4.5 w-4.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">全部模板</p>
                  <p className="text-lg font-bold text-slate-900">{totalCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-50 to-green-100/60">
                  <CheckCircle className="h-4.5 w-4.5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">已启用</p>
                  <p className="text-lg font-bold text-green-600">{activeCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/60">
                  <Archive className="h-4.5 w-4.5 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">已禁用</p>
                  <p className="text-lg font-bold text-slate-600">{disabledCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5" />
            </div>
          </section>

          {/* ── 模板列表 ────────────────────────────────────────────────── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle>模板列表</CardTitle>
            </CardHeader>
            <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2 flex-wrap">
              {STATUS_FILTER_OPTIONS.map((opt) => {
                const active = statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="p-5">
              <DataTable<SafetyChecklistTemplate>
                columns={columns}
                data={displayTemplates}
                rowKey="id"
                loading={isLoading}
              />
            </div>
          </Card>

          {/* ── 模板编辑弹窗 ────────────────────────────────────────────── */}
          <TemplateEditDialog
            open={modalOpen}
            editing={!!editingTemplate}
            templateName={templateName}
            templateStatus={templateStatus}
            categoryIds={categoryIds}
            submitting={createMutation.isPending || updateMutation.isPending}
            onClose={handleClose}
            onSubmit={handleSubmit}
            onTemplateNameChange={setTemplateName}
            onTemplateStatusChange={setTemplateStatus}
            onCategoryIdsChange={setCategoryIds}
          />

          {/* ── 检查项管理弹窗 ──────────────────────────────────────────── */}
          <ItemManageDialog
            open={itemModalOpen}
            items={items}
            itemLines={itemLines}
            addingLoading={batchSaveMutation.isPending}
            onClose={() => setItemModalOpen(false)}
            onAdd={handleAddItem}
            onItemLinesChange={setItemLines}
          />

          {/* ── 删除确认弹窗 ────────────────────────────────────────────── */}
          <DeleteConfirmDialog
            open={deleteOpen}
            template={deletingTemplate}
            deleting={deleteMutation.isPending}
            onClose={() => { setDeleteOpen(false); setDeletingTemplate(null); }}
            onConfirm={() => {
              if (deletingTemplate?.id) deleteMutation.mutate(deletingTemplate.id);
            }}
          />
        </div>
      </div>
    </PageTransition>
  );
};

export default SafetyChecklistTemplatePage;
