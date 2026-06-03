/**
 * @file pages/mail/MailTemplateListPage.tsx
 * @description 邮件模板管理列表页
 *
 * 功能：模板列表展示、分类筛选、关键词搜索、新建/编辑/删除
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { mailTemplateApi } from '@/api/mailTemplate';
import type { MailTemplate } from '@/types/mailTemplate';
import { TEMPLATE_CATEGORIES } from '@/types/mailTemplate';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';

const CATEGORY_OPTIONS = [
  { key: '', label: '全部分类' },
  ...Object.entries(TEMPLATE_CATEGORIES).map(([key, label]) => ({ key, label })),
];

export default function MailTemplateListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['mail-templates', page, pageSize, category, keyword],
    queryFn: () => mailTemplateApi.list({ page, pageSize, category, keyword }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => mailTemplateApi.delete(id),
    onSuccess: () => {
      toast.success('模板已删除');
      qc.invalidateQueries({ queryKey: ['mail-templates'] });
    },
    onError: () => toast.error('删除失败'),
  });

  const handleDelete = useCallback((id: number, name: string) => {
    if (window.confirm(`确定删除模板「${name}」？此操作不可恢复。`)) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation]);

  const handleSearch = useCallback(() => {
    setKeyword(searchInput);
    setPage(1);
  }, [searchInput]);

  const columns: Column<MailTemplate>[] = [
    {
      key: 'templateCode',
      title: '模板编码',
      width: 140,
    },
    {
      key: 'templateName',
      title: '模板名称',
      render: (_value: unknown, row: MailTemplate) => (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#94a3b8]" />
          <span className="font-medium text-[#0f172a]">{row.templateName}</span>
        </div>
      ),
    },
    {
      key: 'category',
      title: '分类',
      width: 100,
      render: (_value: unknown, row: MailTemplate) => {
        const label = TEMPLATE_CATEGORIES[row.category ?? ''] ?? row.category ?? '通用';
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f1f5f9] text-[#475569]">
            {label}
          </span>
        );
      },
    },
    {
      key: 'subjectTemplate',
      title: '邮件主题',
      render: (_value: unknown, row: MailTemplate) => (
        <span className="text-sm text-[#64748b] truncate max-w-[240px] inline-block align-middle">
          {row.subjectTemplate}
        </span>
      ),
    },
    {
      key: 'isBuiltin',
      title: '类型',
      width: 72,
      render: (_value: unknown, row: MailTemplate) => (
        row.isBuiltin === 1
          ? <span className="text-xs text-[#3b82f6]">内置</span>
          : <span className="text-xs text-[#64748b]">自定义</span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 72,
      render: (_value: unknown, row: MailTemplate) => (
        row.status === 1
          ? <span className="inline-flex items-center gap-1 text-xs text-[#16a34a]"><span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />启用</span>
          : <span className="inline-flex items-center gap-1 text-xs text-[#94a3b8]"><span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8]" />停用</span>
      ),
    },
    {
      key: 'createTime',
      title: '创建时间',
      width: 160,
      render: (_value: unknown, row: MailTemplate) =>
        row.createTime ? new Date(row.createTime).toLocaleString('zh-CN') : '-',
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_value: unknown, row: MailTemplate) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/mail/templates/${row.id}/edit`)}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(row.id, row.templateName)}
            disabled={row.isBuiltin === 1}
            className="text-[#ef4444] hover:text-[#dc2626]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const records = (data as unknown as { records?: MailTemplate[] })?.records ?? [];
  const total = (data as unknown as { total?: number })?.total ?? 0;

  return (
    <div className="p-6">
      <PageHeader
        title="邮件模板"
        subtitle="管理系统邮件模板，支持 Thymeleaf 变量渲染"
        breadcrumbs={[{ label: '系统设置' }, { label: '邮件模板' }]}
        actions={
          <Button variant="primary" onClick={() => navigate('/mail/templates/new')}>
            <Plus className="w-4 h-4" />
            新建模板
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-4">
          {/* 筛选栏 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { setCategory(opt.key); setPage(1); }}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    category === opt.key
                      ? 'bg-[#3b82f6] text-white'
                      : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <Input
                placeholder="搜索模板名称/编码..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-60"
                suffix={
                  <button onClick={handleSearch} className="p-0.5">
                    <Search className="w-4 h-4 text-[#94a3b8]" />
                  </button>
                }
              />
            </div>
          </div>

          <DataTable<MailTemplate>
            columns={columns}
            data={records}
            rowKey="id"
            loading={isLoading}
            pagination={{
              page,
              pageSize,
              total,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            }}
            emptyText="暂无邮件模板数据"
          />
        </CardContent>
      </Card>
    </div>
  );
}
