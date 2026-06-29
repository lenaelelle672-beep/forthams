/**
 * @file pages/settings/MailTemplateTab.tsx
 * @description 邮件模板发布工作台 Tab
 *
 * 功能：模板列表（分页）、新增/编辑/删除、按分类/关键字筛选
 * Pattern: useQuery + useMutation + invalidateQueries
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  Lock,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Workflow,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mailTemplateApi } from '@/api/mailTemplate';
import type { MailTemplate, CreateMailTemplateRequest, UpdateMailTemplateRequest, PageResponse } from '@/types/mailTemplate';
import { TEMPLATE_CATEGORIES } from '@/types/mailTemplate';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const EMPTY_FORM: CreateMailTemplateRequest = {
  templateCode: '',
  templateName: '',
  category: 'general',
  subjectTemplate: '',
  contentTemplate: '',
  contentType: 'text/html',
  status: 1,
};

// ─── Query Keys ──────────────────────────────────────────────────────────────

const QUERY_KEYS = {
  templates: (params: object) => ['mail-templates', params] as const,
};

function getCategoryLabel(category?: string) {
  if (!category) return TEMPLATE_CATEGORIES.general;
  return TEMPLATE_CATEGORIES[category] || category;
}

function getTemplateVariables(template: MailTemplate | null) {
  if (!template) return [];

  const fromDefinition = (() => {
    const raw = template.variables?.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim()).filter(Boolean);
      }
      if (parsed && typeof parsed === 'object') {
        return Object.keys(parsed);
      }
    } catch {
      return raw
        .split(/[,\n，]/)
        .map(item => item.replace(/["'\[\]]/g, '').trim())
        .filter(Boolean);
    }
    return [];
  })();

  const fromTemplate = Array.from(
    `${template.subjectTemplate || ''}\n${template.contentTemplate || ''}`.matchAll(/\$\{([A-Za-z0-9_.-]+)\}/g),
    match => match[1],
  );

  return Array.from(new Set([...fromDefinition, ...fromTemplate])).filter(Boolean);
}

function stripHtml(content: string) {
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTemplateGate(template: MailTemplate | null) {
  if (!template) {
    return {
      label: '未选择模板',
      detail: '请选择左侧模板查看发布状态',
      tone: 'muted',
      icon: Eye,
    };
  }
  if (template.status !== 1) {
    return {
      label: '发布阻断',
      detail: '模板已停用，业务通知不会使用该版本',
      tone: 'danger',
      icon: XCircle,
    };
  }
  if (!template.subjectTemplate?.trim() || !template.contentTemplate?.trim()) {
    return {
      label: '内容缺失',
      detail: '主题和正文必须完整后才能稳定发布',
      tone: 'danger',
      icon: AlertTriangle,
    };
  }
  if (template.isBuiltin === 1) {
    return {
      label: '内置模板',
      detail: '可编辑内容，删除受保护',
      tone: 'warning',
      icon: Lock,
    };
  }
  return {
    label: '可发布',
    detail: '当前模板结构完整，可进入业务发送链路',
    tone: 'ready',
    icon: CheckCircle2,
  };
}

function getGateClasses(tone: string) {
  const classes: Record<string, string> = {
    ready: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-700',
    muted: 'border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]',
  };
  return classes[tone] || classes.muted;
}

// ─── 弹窗：新增/编辑模板 ─────────────────────────────────────────────────────

interface FormDialogProps {
  open: boolean;
  template: MailTemplate | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateMailTemplateRequest | UpdateMailTemplateRequest) => void;
}

function TemplateFormDialog({ open, template, submitting, onClose, onSubmit }: FormDialogProps) {
  const [form, setForm] = useState<CreateMailTemplateRequest>({ ...EMPTY_FORM });

  React.useEffect(() => {
    if (open) {
      if (template) {
        setForm({
          templateCode: template.templateCode,
          templateName: template.templateName,
          category: template.category || 'general',
          subjectTemplate: template.subjectTemplate,
          contentTemplate: template.contentTemplate,
          contentType: template.contentType || 'text/html',
          variables: template.variables || '',
          status: template.status,
        });
      } else {
        setForm({ ...EMPTY_FORM });
      }
    }
  }, [open, template]);

  if (!open) return null;

  const set = (field: keyof CreateMailTemplateRequest, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.templateCode.trim() || !form.templateName.trim() ||
        !form.subjectTemplate.trim() || !form.contentTemplate.trim()) {
      toast.error('模板编码、名称、主题和内容为必填项');
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-[#0f172a] mb-5">
          {template ? '编辑邮件模板' : '新增邮件模板'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="模板编码 *"
              placeholder="如 retirement_submitted"
              value={form.templateCode}
              onChange={e => set('templateCode', e.target.value)}
              disabled={!!template}
              required
            />
            <Input
              label="模板名称 *"
              placeholder="如 报废申请提交通知"
              value={form.templateName}
              onChange={e => set('templateName', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">分类</label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
              >
                {Object.entries(TEMPLATE_CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">状态</label>
              <select
                value={form.status}
                onChange={e => set('status', Number(e.target.value))}
                className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
              >
                <option value={1}>启用</option>
                <option value={0}>停用</option>
              </select>
            </div>
          </div>

          <Input
            label="邮件主题模板 *"
            placeholder="如 【资产管理】新的报废申请 - ${assetCode}"
            value={form.subjectTemplate}
            onChange={e => set('subjectTemplate', e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#374151]">
              邮件内容模板（HTML） * <span className="text-xs text-[#94a3b8]">支持 {'${变量名}'} 占位符</span>
            </label>
            <textarea
              value={form.contentTemplate}
              onChange={e => set('contentTemplate', e.target.value)}
              rows={10}
              placeholder="<html><body>...</body></html>"
              className="px-3 py-2 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none font-mono"
              required
            />
          </div>

          <Input
            label="变量定义 JSON"
            placeholder='如 ["assetCode","assetName"]'
            value={form.variables || ''}
            onChange={e => set('variables', e.target.value)}
          />

          {template?.isBuiltin === 1 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              内置模板受保护：可以调整展示文案与变量说明，但删除入口会被锁定。保存前请确认业务代码仍能提供这些变量。
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {template ? '保存修改' : '确认新增'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 删除确认弹窗 ────────────────────────────────────────────────────────────

function DeleteConfirmDialog({
  open, template, deleting, onClose, onConfirm,
}: {
  open: boolean;
  template: MailTemplate | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !template) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-[#0f172a] mb-3">确认删除</h3>
        <p className="text-sm text-[#64748b] mb-6">
          确定要删除邮件模板「<span className="font-medium text-[#0f172a]">{template.templateName}</span>」
          （{template.templateCode}）吗？此操作不可撤销。
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

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export default function MailTemplateTab() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MailTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<MailTemplate | null>(null);

  // ── 查询参数 ─────────────────────────────────────────────────────────────
  const queryParams = { page, pageSize: PAGE_SIZE, category: category || undefined, keyword: keyword || undefined };

  // ── 查询 ─────────────────────────────────────────────────────────────────
  const { data, isLoading, isFetching } = useQuery({
    queryKey: QUERY_KEYS.templates(queryParams),
    queryFn: async () => {
      const res = await mailTemplateApi.list(queryParams);
      return res as unknown as PageResponse<MailTemplate>;
    },
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  React.useEffect(() => {
    if (records.length === 0) {
      if (selectedTemplateId !== null) setSelectedTemplateId(null);
      return;
    }
    if (!records.some(record => record.id === selectedTemplateId)) {
      setSelectedTemplateId(records[0].id);
    }
  }, [records, selectedTemplateId]);

  const selectedTemplate = records.find(record => record.id === selectedTemplateId) || records[0] || null;
  const selectedVariables = getTemplateVariables(selectedTemplate);
  const selectedGate = getTemplateGate(selectedTemplate);
  const SelectedGateIcon = selectedGate.icon;

  const enabledRecords = records.filter(record => record.status === 1);
  const builtinCount = records.filter(record => record.isBuiltin === 1).length;
  const incompleteCount = records.filter(record => !record.subjectTemplate?.trim() || !record.contentTemplate?.trim()).length;
  const categoryCount = new Set(records.map(record => record.category || 'general')).size;
  const hasActiveFilters = Boolean(keyword || category);
  const categoryLabel = category ? getCategoryLabel(category) : '';
  const emptyStateText = hasActiveFilters
    ? `当前搜索${keyword ? `「${keyword}」` : ''}${categoryLabel ? `、分类「${categoryLabel}」` : ''}下没有邮件模板。`
    : '暂无邮件模板，请先新增模板并完成变量检查。';
  const previewText = selectedTemplate
    ? stripHtml(selectedTemplate.contentTemplate || '') || selectedTemplate.contentTemplate || '暂无正文内容'
    : '选择模板后展示正文预览';
  const riskNotes = selectedTemplate
    ? [
        selectedTemplate.isBuiltin === 1 ? '内置模板删除受保护，适合承载核心业务通知。' : '自定义模板可删除，删除前请确认没有业务流程引用。',
        selectedTemplate.status === 1 ? '启用状态会参与业务发送链路。' : '停用状态不会进入发送链路。',
        selectedVariables.length > 0 ? '变量需由业务上下文完整传入，缺失会影响邮件可读性。' : '未发现变量，占位符风险较低。',
      ]
    : ['请选择模板查看风险说明。'];

  // ── 创建 ─────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: CreateMailTemplateRequest) => mailTemplateApi.create(data),
    onSuccess: () => {
      toast.success('邮件模板创建成功');
      qc.invalidateQueries({ queryKey: ['mail-templates'] });
      setDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: (err: any) => toast.error(err?.message || '创建失败'),
  });

  // ── 更新 ─────────────────────────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateMailTemplateRequest }) => mailTemplateApi.update(id, data),
    onSuccess: () => {
      toast.success('邮件模板更新成功');
      qc.invalidateQueries({ queryKey: ['mail-templates'] });
      setDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: (err: any) => toast.error(err?.message || '更新失败'),
  });

  // ── 删除 ─────────────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (id: number) => mailTemplateApi.delete(id),
    onSuccess: () => {
      toast.success('邮件模板已删除');
      qc.invalidateQueries({ queryKey: ['mail-templates'] });
      setDeleteDialogOpen(false);
      setDeletingTemplate(null);
    },
    onError: (err: any) => toast.error(err?.message || '删除失败'),
  });

  // ── 事件处理 ──────────────────────────────────────────────────────────────

  const handleSearch = () => {
    setKeyword(searchInput);
    setPage(1);
  };

  const handleSubmit = (data: CreateMailTemplateRequest | UpdateMailTemplateRequest) => {
    if (editingTemplate) {
      updateMut.mutate({ id: editingTemplate.id, data: data as UpdateMailTemplateRequest });
    } else {
      createMut.mutate(data as CreateMailTemplateRequest);
    }
  };

  const handleDelete = () => {
    if (deletingTemplate) deleteMut.mutate(deletingTemplate.id);
  };

  const submitting = createMut.isPending || updateMut.isPending;

  const STATUS_BADGE: Record<number, string> = {
    1: 'bg-green-100 text-green-700',
    0: 'bg-[#f1f5f9] text-[#94a3b8]',
  };

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader className="flex-wrap items-start bg-[linear-gradient(120deg,#ffffff_0%,#f8fafc_52%,#eef6ff_100%)]">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#2563eb]" />
            邮件模板发布工作台
          </CardTitle>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 font-medium text-[#1d4ed8]">模板版本预检</span>
            <span className="rounded-full bg-[#f0fdf4] px-2 py-0.5 font-medium text-[#15803d]">变量门禁</span>
            <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 font-medium text-[#c2410c]">内置保护</span>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setEditingTemplate(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4" />
          新增模板
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-l-4 border-[#2563eb] bg-[#f8fbff] px-4 py-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <div className="text-xs font-semibold uppercase text-[#1d4ed8]">后端契约</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <code className="rounded-md border border-[#bfdbfe] bg-white px-2 py-1 font-mono text-[#1e3a8a]">
                  GET /mail-templates/list
                </code>
                <code className="rounded-md border border-[#bfdbfe] bg-white px-2 py-1 font-mono text-[#1e3a8a]">
                  POST /mail-templates
                </code>
                <code className="rounded-md border border-[#bfdbfe] bg-white px-2 py-1 font-mono text-[#1e3a8a]">
                  PUT /mail-templates/:id
                </code>
              </div>
            </div>
            <div className="text-sm leading-6 text-[#475569]">
              当前页只重排发布运维体验，不改变查询参数、Query key、创建、更新、删除和后端字段契约。
              内置模板保护始终生效：删除入口只对非内置模板开放。
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: '匹配模板', value: total, hint: '后端分页总数', icon: FileText, tone: 'text-[#2563eb]' },
            { label: '启用版本', value: enabledRecords.length, hint: '当前页可发送', icon: CheckCircle2, tone: 'text-emerald-600' },
            { label: '内置保护', value: builtinCount, hint: '禁止删除', icon: Lock, tone: 'text-amber-600' },
            { label: '待补齐', value: incompleteCount, hint: '主题或正文缺失', icon: AlertTriangle, tone: 'text-red-600' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#64748b]">{item.label}</span>
                  <Icon className={`h-4 w-4 ${item.tone}`} />
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-[#0f172a]">{item.value}</div>
                <div className="mt-1 text-xs text-[#94a3b8]">{item.hint}</div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="font-medium text-[#0f172a]">发布健康摘要</span>
            <span className="text-[#64748b]">本页 <b className="text-[#0f172a]">{records.length}</b></span>
            <span className="text-[#64748b]">分类覆盖 <b className="text-[#0f172a]">{categoryCount}</b></span>
            <span className="text-[#64748b]">停用 <b className="text-slate-500">{records.length - enabledRecords.length}</b></span>
            <span className="min-w-0 break-words text-[#64748b]">
              当前选择 <b className="text-[#0f172a]">{selectedTemplate?.templateName || '未选择'}</b>
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-[#64748b]">
            发布前重点检查变量、状态和内置保护。列表行可点击选中并在右侧预览主题、正文、变量和风险说明。
          </p>
        </div>

        {/* 搜索/过滤栏 */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#e2e8f0] bg-white px-3 py-3">
          <div className="relative min-w-[220px] flex-1">
            <input
              type="text"
              placeholder="搜索模板名称/编码..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full h-9 rounded-lg border border-[#e5e7eb] bg-white pl-3 pr-4 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
                placeholder:text-[#94a3b8]"
            />
          </div>
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="h-9 px-3 rounded-lg border border-[#e5e7eb] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] text-[#374151]"
          >
            <option value="">全部分类</option>
            {Object.entries(TEMPLATE_CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <Button variant="outline" size="md" onClick={handleSearch}>搜索</Button>
          <Button variant="outline" size="md" onClick={() => qc.invalidateQueries({ queryKey: ['mail-templates'] })} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {/* 加载状态 */}
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-[#94a3b8] text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            加载中...
          </div>
        )}

        {/* 表格 */}
        {!isLoading && (
          <>
            {records.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] py-12 text-center text-sm text-[#64748b]">
                {emptyStateText}
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.9fr)_minmax(360px,1.25fr)_minmax(240px,0.75fr)] lg:grid-cols-[minmax(300px,0.95fr)_minmax(360px,1.15fr)]">
                <div className="min-w-0 rounded-lg border border-[#e2e8f0] bg-white">
                  <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#0f172a]">模板列表</div>
                      <div className="mt-0.5 text-xs text-[#94a3b8]">点击任意行查看发布预览</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#1d4ed8]">
                      {page}/{totalPages}
                    </span>
                  </div>
                  <div className="max-h-[620px] overflow-y-auto">
                    <div className="divide-y divide-[#f1f5f9]">
                      {records.map(t => {
                        const variables = getTemplateVariables(t);
                        const gate = getTemplateGate(t);
                        const GateIcon = gate.icon;
                        const selected = selectedTemplate?.id === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTemplateId(t.id)}
                            className={`block w-full px-4 py-3 text-left transition-colors ${selected ? 'bg-[#eff6ff]' : 'hover:bg-[#f8fafc]'}`}
                          >
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[#0f172a]">{t.templateName}</div>
                                <div className="mt-1 truncate font-mono text-xs text-[#64748b]">{t.templateCode}</div>
                              </div>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[t.status] ?? STATUS_BADGE[0]}`}>
                                {t.status === 1 ? '启用' : '停用'}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                              <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[#475569]">
                                {getCategoryLabel(t.category)}
                              </span>
                              <span className="rounded-full bg-[#f8fafc] px-2 py-0.5 text-[#64748b]">
                                {variables.length} 变量
                              </span>
                              {t.isBuiltin === 1 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                                  <Lock className="h-3 w-3" />
                                  内置
                                </span>
                              )}
                            </div>
                            <div className={`mt-3 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs ${getGateClasses(gate.tone)}`}>
                              <GateIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{gate.label}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 rounded-lg border border-[#e2e8f0] bg-white">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#0f172a]">
                        <Eye className="h-4 w-4 text-[#2563eb]" />
                        选中模板预览
                      </div>
                      <div className="mt-1 break-all font-mono text-xs text-[#94a3b8]">
                        {selectedTemplate?.templateCode || 'no-template-selected'}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => selectedTemplate && (setEditingTemplate(selectedTemplate), setDialogOpen(true))}
                        className="p-1.5 rounded text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors"
                        title="编辑"
                        disabled={!selectedTemplate}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {selectedTemplate?.isBuiltin !== 1 && (
                        <button
                          onClick={() => selectedTemplate && (setDeletingTemplate(selectedTemplate), setDeleteDialogOpen(true))}
                          className="p-1.5 rounded text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="删除"
                          disabled={!selectedTemplate}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div className={`rounded-lg border px-3 py-3 ${getGateClasses(selectedGate.tone)}`}>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <SelectedGateIcon className="h-4 w-4 shrink-0" />
                        {selectedGate.label}
                      </div>
                      <div className="mt-1 text-xs leading-5">{selectedGate.detail}</div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase text-[#64748b]">邮件主题</div>
                      <div className="mt-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm font-medium leading-6 text-[#0f172a]">
                        {selectedTemplate?.subjectTemplate || '暂无主题模板'}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold uppercase text-[#64748b]">正文预览</div>
                        <span className="text-xs text-[#94a3b8]">{selectedTemplate?.contentType || 'text/html'}</span>
                      </div>
                      <div className="mt-2 max-h-[260px] min-h-[180px] overflow-auto rounded-lg border border-[#e2e8f0] bg-white p-3 text-sm leading-6 text-[#334155]">
                        <pre className="whitespace-pre-wrap break-words font-sans">{previewText}</pre>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase text-[#64748b]">变量清单</div>
                      <div className="mt-2 flex max-h-[108px] flex-wrap gap-2 overflow-auto rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                        {selectedVariables.length > 0 ? (
                          selectedVariables.map(variable => (
                            <code key={variable} className="rounded-md border border-[#cbd5e1] bg-white px-2 py-1 text-xs text-[#334155]">
                              {'${' + variable + '}'}
                            </code>
                          ))
                        ) : (
                          <span className="text-xs text-[#94a3b8]">未检测到变量占位符</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 space-y-4 lg:col-span-2 xl:col-span-1">
                  <div className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0f172a]">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      发布门禁
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      {[
                        { label: '状态启用', passed: selectedTemplate?.status === 1 },
                        { label: '主题完整', passed: Boolean(selectedTemplate?.subjectTemplate?.trim()) },
                        { label: '正文完整', passed: Boolean(selectedTemplate?.contentTemplate?.trim()) },
                        { label: '变量可追踪', passed: selectedVariables.length > 0 },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between gap-3 rounded-md bg-[#f8fafc] px-3 py-2">
                          <span className="min-w-0 text-[#475569]">{item.label}</span>
                          <span className={`shrink-0 text-xs font-medium ${item.passed ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {item.passed ? '通过' : '待确认'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0f172a]">
                      <Workflow className="h-4 w-4 text-[#2563eb]" />
                      发布风险说明
                    </div>
                    <div className="mt-3 space-y-2">
                      {riskNotes.map(note => (
                        <div key={note} className="rounded-md bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#64748b]">
                          {note}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                    <div className="flex items-center gap-2 font-semibold">
                      <Lock className="h-4 w-4" />
                      内置模板保护
                    </div>
                    <p className="mt-2">
                      内置模板隐藏删除操作，避免破坏核心通知链路。若需调整，优先编辑主题、正文与变量说明，并在业务流程中确认变量供给。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 分页 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
              <p className="text-xs text-[#94a3b8]">共 {total} 条记录，第 {page}/{totalPages} 页</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>上一页</Button>
                <span className="text-sm text-[#64748b] px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一页</Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* 新增/编辑弹窗 */}
      <TemplateFormDialog
        open={dialogOpen}
        template={editingTemplate}
        submitting={submitting}
        onClose={() => { setDialogOpen(false); setEditingTemplate(null); }}
        onSubmit={handleSubmit}
      />

      {/* 删除确认弹窗 */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        template={deletingTemplate}
        deleting={deleteMut.isPending}
        onClose={() => { setDeleteDialogOpen(false); setDeletingTemplate(null); }}
        onConfirm={handleDelete}
      />
    </Card>
  );
}
