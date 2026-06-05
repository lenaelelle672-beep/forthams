/**
 * @file pages/settings/MailTemplateTab.tsx
 * @description 邮件模板管理 Tab
 *
 * 功能：模板列表（分页）、新增/编辑/删除、按分类/关键字筛选
 * Pattern: useQuery + useMutation + invalidateQueries
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
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
          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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
      <CardHeader>
        <CardTitle>邮件模板管理</CardTitle>
        <Button variant="primary" size="sm" onClick={() => { setEditingTemplate(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4" />
          新增模板
        </Button>
      </CardHeader>
      <CardContent>
        {/* 搜索/过滤栏 */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <input
              type="text"
              placeholder="搜索模板名称/编码..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full h-9 pl-3 pr-4 rounded-lg border border-[#e5e7eb] bg-white text-sm
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
              <div className="py-12 text-center text-[#94a3b8] text-sm">暂无邮件模板</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">编码</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">名称</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">分类</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">状态</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">内置</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {records.map(t => (
                      <tr key={t.id} className="hover:bg-[#f8fafc]">
                        <td className="px-4 py-3 font-mono text-xs text-[#374151]">{t.templateCode}</td>
                        <td className="px-4 py-3 font-medium text-[#0f172a]">{t.templateName}</td>
                        <td className="px-4 py-3 text-[#64748b]">{TEMPLATE_CATEGORIES[t.category || 'general'] || t.category}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[t.status] ?? STATUS_BADGE[0]}`}>
                            {t.status === 1 ? '启用' : '停用'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#64748b]">{t.isBuiltin === 1 ? '是' : '—'}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setEditingTemplate(t); setDialogOpen(true); }}
                            className="p-1.5 rounded text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors mr-1"
                            title="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {t.isBuiltin !== 1 && (
                            <button
                              onClick={() => { setDeletingTemplate(t); setDeleteDialogOpen(true); }}
                              className="p-1.5 rounded text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 分页 */}
            <div className="flex items-center justify-between mt-4">
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
