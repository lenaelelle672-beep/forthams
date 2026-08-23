import { FormEvent, useEffect, useMemo, useState } from 'react';
import { mailTemplateApi } from '../../api/mailTemplate';
import type {
  MailTemplate,
  MailTemplateMeta,
  MailTemplatePreviewResponse,
  PageResponse,
} from '../../types/mailTemplate';

type SystemMailTemplatesWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const boundaryCopy = '仅邮件模板 catalog + 无持久化 safe preview；不发送邮件、不配置 SMTP/邮件网关、不处理邮件日志/重试/导出、不接入流程邮件。';
const endpointCopy = '真实调用 /mail-templates/list、/mail-templates/{id}、/mail-templates/code/{code}、/mail-templates/meta 与 /mail-templates/preview。';
const previewPolicyCopy = 'preview 只返回 HTML escaped 结果、missingVariables、rejectedVariables、usedVariables 与 nonPersistent=true。敏感变量名（password/token/secret/apiKey/clientSecret/privateKey/authorization/cookie/credential/accessKey/refreshToken）会被拒绝。';

const emptyPage: PageResponse<MailTemplate> = { records: [], total: 0, size: 20, current: 1, pages: 0 };

function parsePreviewVariables(input: string): Record<string, string> {
  return input.split('\n').reduce<Record<string, string>>((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return acc;
    }
    const separatorIndex = trimmed.indexOf('=');
    const key = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex).trim() : trimmed;
    const value = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1).trim() : '';
    if (key) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export default function SystemMailTemplatesWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemMailTemplatesWorkbenchPageProps) {
  const [keywordInput, setKeywordInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [contentTypeInput, setContentTypeInput] = useState('');
  const [activeFilters, setActiveFilters] = useState<{ page: number; pageSize: number; keyword?: string; category?: string; contentType?: string }>({ page: 1, pageSize: 20 });
  const [page, setPage] = useState<PageResponse<MailTemplate>>(emptyPage);
  const [selectedTemplate, setSelectedTemplate] = useState<MailTemplate | null>(null);
  const [codeLookup, setCodeLookup] = useState('');
  const [meta, setMeta] = useState<MailTemplateMeta | null>(null);
  const [previewInput, setPreviewInput] = useState('assetName=办公电脑-01\noperatorName=系统管理员\ntoken=仅用于拒绝演示');
  const [previewResult, setPreviewResult] = useState<MailTemplatePreviewResponse | null>(null);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let ignored = false;
    setLoading(true);
    setError(null);

    Promise.all([
      mailTemplateApi.list(activeFilters),
      mailTemplateApi.meta(),
    ])
      .then(async ([listResult, metaResult]) => {
        if (ignored) {
          return;
        }
        setPage(listResult);
        setMeta(metaResult);
        const first = listResult.records[0];
        if (!first) {
          setSelectedTemplate(null);
          setPreviewResult(null);
          return;
        }
        setCodeLookup(first.templateCode);
        const [detail, codeDetail] = await Promise.all([
          mailTemplateApi.getById(first.id),
          mailTemplateApi.getByCode(first.templateCode),
        ]);
        if (!ignored) {
          setSelectedTemplate(detail ?? codeDetail);
        }
      })
      .catch(() => {
        if (!ignored) {
          setPage(emptyPage);
          setSelectedTemplate(null);
          setError('邮件模板 catalog 加载失败，错误详情已脱敏');
        }
      })
      .finally(() => {
        if (!ignored) {
          setLoading(false);
        }
      });

    return () => {
      ignored = true;
    };
  }, [activeFilters, canView]);

  const categoryOptions = useMemo(() => meta?.categories ?? [], [meta]);
  const contentTypeOptions = useMemo(() => meta?.contentTypes ?? [], [meta]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveFilters({
      page: 1,
      pageSize: 20,
      keyword: keywordInput.trim() || undefined,
      category: categoryInput || undefined,
      contentType: contentTypeInput || undefined,
    });
  };

  const openTemplate = async (template: MailTemplate) => {
    try {
      setError(null);
      setSelectedTemplate(await mailTemplateApi.getById(template.id));
      setCodeLookup(template.templateCode);
      setPreviewResult(null);
    } catch {
      setError('邮件模板详情加载失败，错误详情已脱敏');
    }
  };

  const loadByCode = async () => {
    const code = codeLookup.trim();
    if (!code) {
      return;
    }
    try {
      setError(null);
      setSelectedTemplate(await mailTemplateApi.getByCode(code));
      setPreviewResult(null);
    } catch {
      setError('按编码查询邮件模板失败，错误详情已脱敏');
    }
  };

  const runPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setError(null);
      setPreviewResult(await mailTemplateApi.preview({
        templateId: selectedTemplate?.id,
        templateCode: selectedTemplate ? undefined : codeLookup.trim() || undefined,
        subjectTemplate: selectedTemplate?.subjectTemplate,
        contentTemplate: selectedTemplate?.contentTemplate,
        variables: parsePreviewVariables(previewInput),
      }));
    } catch {
      setError('安全预览失败，错误详情已脱敏');
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-mail-templates="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问邮件模板 catalog，请确认 system:mail-template:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-mail-templates="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">邮件模板</h3>
          <h3 className="mt-1 text-sm font-medium text-slate-500">{endpointCopy}</h3>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">catalog / tenant-scoped / safe preview</span>
      </div>

      <div role="note" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{boundaryCopy}</p>
        <p>{previewPolicyCopy}</p>
        <p>不代表邮件子系统完成，不代表消息与通知全组完成，不代表 Workbench V3 全量完成。</p>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]" onSubmit={applyFilters}>
        <label className="sr-only" htmlFor="mail-template-keyword">邮件模板关键词</label>
        <input
          id="mail-template-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按编码、名称或正文搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="mail-template-category">邮件模板分类</label>
        <select id="mail-template-category" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)}>
          <option value="">全部分类</option>
          {categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <label className="sr-only" htmlFor="mail-template-content-type">邮件模板内容类型</label>
        <select id="mail-template-content-type" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={contentTypeInput} onChange={(event) => setContentTypeInput(event.target.value)}>
          <option value="">全部类型</option>
          {contentTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button type="submit" disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:bg-slate-300">查询</button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">邮件模板加载中...</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="邮件模板列表">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">模板 catalog</h4>
            <span className="text-xs text-slate-500">显示 {page.records.length} / {page.total} 条，只读展示</span>
          </div>
          {page.records.length === 0 && !loading ? <h3 className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-medium text-slate-500">暂无邮件模板。</h3> : null}
          <div className="space-y-2">
            {page.records.map((template) => (
              <button key={template.id} type="button" className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50" onClick={() => openTemplate(template)}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{template.templateName}</span>
                  <span className="text-xs text-slate-500">{template.templateCode}</span>
                </span>
                <span className="mt-1 block text-slate-600">分类：{template.category ?? '未分类'} · 类型：{template.contentType ?? 'HTML'}</span>
                <span className="mt-1 block text-xs text-slate-500">变量：{template.variables || '未声明'}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-label="邮件模板详情与预览">
          <h4 className="font-semibold">详情与 safe preview</h4>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="mail-template-code">按编码查询</label>
            <input
              id="mail-template-code"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={codeLookup}
              onChange={(event) => setCodeLookup(event.target.value)}
              placeholder="templateCode"
            />
            <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" onClick={loadByCode}>按编码加载</button>
          </div>
          {selectedTemplate ? (
            <div className="space-y-2 text-sm text-slate-600">
              <p>编码：{selectedTemplate.templateCode}</p>
              <p>名称：{selectedTemplate.templateName}</p>
              <p>主题模板：{selectedTemplate.subjectTemplate}</p>
              <p>正文模板：{selectedTemplate.contentTemplate}</p>
            </div>
          ) : <h3 className="text-sm font-medium text-slate-500">请选择一个模板查看详情。</h3>}

          <form className="space-y-3" onSubmit={runPreview}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="mail-template-preview-variables">预览变量（key=value，每行一组）</label>
            <textarea
              id="mail-template-preview-variables"
              className="h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={previewInput}
              onChange={(event) => setPreviewInput(event.target.value)}
            />
            <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white">生成无持久化预览</button>
          </form>

          {previewResult ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" aria-label="邮件模板预览结果">
              <p className="font-medium">预览主题：{previewResult.renderedSubject}</p>
              <p>预览正文：{previewResult.renderedContent}</p>
              <p>missingVariables：{previewResult.missingVariables.join('、') || '无'}</p>
              <p>rejectedVariables：{previewResult.rejectedVariables.map((item) => `${item.name}:${item.reason}`).join('、') || '无'}</p>
              <p>usedVariables：{previewResult.usedVariables.join('、') || '无'}</p>
              <p>nonPersistent={String(previewResult.nonPersistent)}</p>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
        元数据边界：{meta?.readonlyBoundary ?? boundaryCopy}；nonGoals：{meta?.nonGoals?.join('、') ?? '不发送、不配置 SMTP/邮件网关、不处理日志'}。
      </div>
    </section>
  );
}
