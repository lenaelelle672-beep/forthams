/**
 * @file pages/mail/MailTemplateFormPage.tsx
 * @description 邮件模板新建/编辑表单页
 *
 * 使用 React Hook Form + Zod 校验
 * 编辑模式回填已有数据
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { mailTemplateApi } from '@/api/mailTemplate';
import type { MailTemplate, CreateMailTemplateRequest, UpdateMailTemplateRequest } from '@/types/mailTemplate';
import { TEMPLATE_CATEGORIES } from '@/types/mailTemplate';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';

// ── Zod schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  templateCode: z.string().min(1, '模板编码不能为空').max(64, '编码最长64位')
    .regex(/^[A-Za-z0-9_]+$/, '编码仅允许字母、数字和下划线'),
  templateName: z.string().min(1, '模板名称不能为空').max(128, '名称最长128位'),
  category: z.string().optional(),
  subjectTemplate: z.string().min(1, '邮件主题不能为空').max(256, '主题最长256位'),
  contentTemplate: z.string().min(1, '邮件内容不能为空'),
  contentType: z.string(),
  variables: z.string().optional(),
  status: z.number().int().min(0).max(1),
});

type FormValues = z.infer<typeof schema>;

export default function MailTemplateFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id && id !== 'new';
  const templateId = isEdit ? Number(id) : null;

  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['mail-template', templateId],
    queryFn: () => mailTemplateApi.getById(templateId!),
    enabled: isEdit,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateMailTemplateRequest) => mailTemplateApi.create(data),
    onSuccess: () => {
      toast.success('模板创建成功');
      qc.invalidateQueries({ queryKey: ['mail-templates'] });
      navigate('/mail/templates');
    },
    onError: (err: Error) => toast.error(err.message || '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateMailTemplateRequest) => mailTemplateApi.update(templateId!, data),
    onSuccess: () => {
      toast.success('模板更新成功');
      qc.invalidateQueries({ queryKey: ['mail-templates'] });
      navigate('/mail/templates');
    },
    onError: (err: Error) => toast.error(err.message || '更新失败'),
  });

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      contentType: 'text/html',
      status: 1,
    },
  });

  const template = detailRes as unknown as MailTemplate | undefined;

  // 编辑模式回填
  useEffect(() => {
    if (isEdit && template) {
      reset({
        templateCode: template.templateCode,
        templateName: template.templateName,
        category: template.category ?? '',
        subjectTemplate: template.subjectTemplate,
        contentTemplate: template.contentTemplate,
        contentType: template.contentType ?? 'text/html',
        variables: template.variables ?? '',
        status: template.status ?? 1,
      });
    }
  }, [isEdit, template, reset]);

  const onSubmit = (values: FormValues) => {
    if (isEdit) {
      const { templateCode, ...updates } = values;
      updateMutation.mutate(updates);
    } else {
      createMutation.mutate(values as CreateMailTemplateRequest);
    }
  };

  const isLoadingDetail = isEdit && !template && detailLoading;
  const contentValue = watch('contentTemplate');

  return (
    <div className="p-6">
      <PageHeader
        title={isEdit ? '编辑邮件模板' : '新建邮件模板'}
        breadcrumbs={[
          { label: '系统设置' },
          { label: '邮件模板', href: '/mail/templates' },
          { label: isEdit ? '编辑' : '新建' },
        ]}
        actions={
          <Button variant="secondary" onClick={() => navigate('/mail/templates')}>
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 基本信息 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>模板配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {isEdit && (
                <Input
                  label="模板编码"
                  value={template?.templateCode ?? ''}
                  disabled
                  hint="编码不可修改"
                />
              )}
              {!isEdit && (
                <Input
                  label="模板编码"
                  placeholder="如 RETIRE_NOTICE"
                  error={errors.templateCode?.message}
                  {...register('templateCode')}
                  hint="唯一标识，仅允许字母、数字和下划线"
                />
              )}

              <Input
                label="模板名称"
                placeholder="如「报废申请通知」"
                error={errors.templateName?.message}
                {...register('templateName')}
              />

              <Input
                label="邮件主题（支持 ${变量名} 替换）"
                placeholder="如 【资产管理】通知 - ${assetCode}"
                error={errors.subjectTemplate?.message}
                {...register('subjectTemplate')}
              />

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  邮件正文（HTML / Thymeleaf 模板）
                </label>
                <textarea
                  className="w-full h-64 px-3 py-2 text-sm font-mono rounded-lg border border-[#e5e7eb] bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-y"
                  placeholder={'<!DOCTYPE html><html>...\n可使用 ${变量名} 作为占位符'}
                  {...register('contentTemplate')}
                />
                {errors.contentTemplate && (
                  <p className="text-xs text-red-500 mt-1">{errors.contentTemplate.message}</p>
                )}
                {contentValue && (
                  <details className="mt-2">
                    <summary className="text-xs text-[#94a3b8] cursor-pointer hover:text-[#64748b]">
                      预览（{contentValue.length} 字符）
                    </summary>
                    <div className="mt-1 p-3 bg-[#f8fafc] rounded-lg border border-[#e5e7eb] text-xs text-[#475569] max-h-40 overflow-auto whitespace-pre-wrap">
                      {contentValue.slice(0, 500)}
                      {contentValue.length > 500 && '\n...（内容过长，仅显示前500字符）'}
                    </div>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 侧边栏 - 配置选项 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>分类与状态</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">
                    模板分类
                  </label>
                  <select
                    className="w-full h-9 px-3 rounded-lg border border-[#e5e7eb] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                    {...register('category')}
                  >
                    <option value="">通用</option>
                    {Object.entries(TEMPLATE_CATEGORIES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">
                    内容类型
                  </label>
                  <input type="hidden" {...register('contentType')} />
                  <div className="text-sm text-[#64748b] bg-[#f8fafc] px-3 py-2 rounded-lg border border-[#e5e7eb]">
                    text/html
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-[#e5e7eb] text-[#3b82f6] focus:ring-[#3b82f6]"
                      checked={watch('status') === 1}
                      onChange={(e) => {
                        const newVal = e.target.checked ? 1 : 0;
                        reset({ ...watch(), status: newVal });
                      }}
                    />
                    <span className="text-sm font-medium text-[#374151]">启用</span>
                  </label>
                  <p className="text-xs text-[#94a3b8] mt-1">停用的模板在发送邮件时将被跳过</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>变量定义</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">
                    变量列表（JSON 格式）
                  </label>
                  <textarea
                    className="w-full h-24 px-3 py-2 text-sm font-mono rounded-lg border border-[#e5e7eb] bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none"
                    placeholder='["applicantName","assetCode","assetName"]'
                    {...register('variables')}
                  />
                  <p className="text-xs text-[#94a3b8] mt-1">
                    定义模板中使用的变量列表，用于接口文档说明
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isEdit ? '保存修改' : '创建模板'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/mail/templates')}>
                取消
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
