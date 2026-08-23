import { FormEvent, useEffect, useMemo, useState } from 'react';
import { notificationTemplateApi } from '../../api/notificationTemplate';
import type {
  NotificationTemplate,
  NotificationTemplateMeta,
  NotificationTemplatePreviewResponse,
  PageResponse,
} from '../../types/notificationTemplate';

type SystemNotificationTemplatesWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const boundaryCopy = '仅通知模板 catalog + 无持久化 safe preview；不发送通知、不配置渠道、不修改偏好、不控制流程通知开关、不接入邮件网关。';
const endpointCopy = '真实调用 /notification-templates/list、/notification-templates/{id}、/notification-templates/code/{code}、/notification-templates/meta 与 /notification-templates/preview。';
const previewPolicyCopy = 'preview 只返回 HTML escaped 结果、missingVariables、rejectedVariables、usedVariables 与 nonPersistent=true。敏感变量名（password/token/secret/apiKey/clientSecret/privateKey/authorization/cookie/credential/accessKey/refreshToken）会被拒绝。';

const emptyPage: PageResponse<NotificationTemplate> = { records: [], total: 0, size: 20, current: 1, pages: 0 };

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

export default function SystemNotificationTemplatesWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemNotificationTemplatesWorkbenchPageProps) {
  const [keywordInput, setKeywordInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [channelInput, setChannelInput] = useState('');
  const [activeFilters, setActiveFilters] = useState<{ page: number; pageSize: number; keyword?: string; category?: string; channelType?: string }>({ page: 1, pageSize: 20 });
  const [page, setPage] = useState<PageResponse<NotificationTemplate>>(emptyPage);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [codeLookup, setCodeLookup] = useState('');
  const [meta, setMeta] = useState<NotificationTemplateMeta | null>(null);
  const [previewInput, setPreviewInput] = useState('assetName=办公电脑-01\noperatorName=系统管理员\ntoken=仅用于拒绝演示');
  const [previewResult, setPreviewResult] = useState<NotificationTemplatePreviewResponse | null>(null);
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
      notificationTemplateApi.list(activeFilters),
      notificationTemplateApi.meta(),
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
          notificationTemplateApi.getById(first.id),
          notificationTemplateApi.getByCode(first.templateCode),
        ]);
        if (!ignored) {
          setSelectedTemplate(detail ?? codeDetail);
        }
      })
      .catch(() => {
        if (!ignored) {
          setPage(emptyPage);
          setSelectedTemplate(null);
          setError('通知模板 catalog 加载失败，错误详情已脱敏');
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
  const channelOptions = useMemo(() => meta?.channelTypes ?? [], [meta]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveFilters({
      page: 1,
      pageSize: 20,
      keyword: keywordInput.trim() || undefined,
      category: categoryInput || undefined,
      channelType: channelInput || undefined,
    });
  };

  const openTemplate = async (template: NotificationTemplate) => {
    try {
      setError(null);
      setSelectedTemplate(await notificationTemplateApi.getById(template.id));
      setCodeLookup(template.templateCode);
      setPreviewResult(null);
    } catch {
      setError('通知模板详情加载失败，错误详情已脱敏');
    }
  };

  const loadByCode = async () => {
    const code = codeLookup.trim();
    if (!code) {
      return;
    }
    try {
      setError(null);
      setSelectedTemplate(await notificationTemplateApi.getByCode(code));
      setPreviewResult(null);
    } catch {
      setError('按编码查询通知模板失败，错误详情已脱敏');
    }
  };

  const runPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setError(null);
      setPreviewResult(await notificationTemplateApi.preview({
        templateId: selectedTemplate?.id,
        templateCode: selectedTemplate ? undefined : codeLookup.trim() || undefined,
        titleTemplate: selectedTemplate?.titleTemplate,
        contentTemplate: selectedTemplate?.contentTemplate,
        variables: parsePreviewVariables(previewInput),
      }));
    } catch {
      setError('安全预览失败，错误详情已脱敏');
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-notification-templates="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问通知模板 catalog，请确认 system:notification-template:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-notification-templates="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">通知模板</h3>
          <p className="mt-1 text-sm text-slate-500">{endpointCopy}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">catalog / tenant-scoped / safe preview</span>
      </div>

      <div role="note" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{boundaryCopy}</p>
        <p>{previewPolicyCopy}</p>
        <p>不代表消息与通知全组完成，不代表 Workbench V3 全量完成。</p>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]" onSubmit={applyFilters}>
        <label className="sr-only" htmlFor="notification-template-keyword">通知模板关键词</label>
        <input
          id="notification-template-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按编码、名称或正文搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="notification-template-category">通知模板分类</label>
        <select id="notification-template-category" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)}>
          <option value="">全部分类</option>
          {categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <label className="sr-only" htmlFor="notification-template-channel">通知模板渠道</label>
        <select id="notification-template-channel" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={channelInput} onChange={(event) => setChannelInput(event.target.value)}>
          <option value="">全部渠道</option>
          {channelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button type="submit" disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:bg-slate-300">查询</button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">通知模板加载中...</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="通知模板列表">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">模板 catalog</h4>
            <span className="text-xs text-slate-500">显示 {page.records.length} / {page.total} 条，只读展示</span>
          </div>
          {page.records.length === 0 && !loading ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无通知模板。</div> : null}
          <div className="space-y-2">
            {page.records.map((template) => (
              <button key={template.id} type="button" className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50" onClick={() => openTemplate(template)}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{template.templateName}</span>
                  <span className="text-xs text-slate-500">{template.templateCode}</span>
                </span>
                <span className="mt-1 block text-slate-600">分类：{template.category ?? '未分类'} · 渠道：{template.channelType}</span>
                <span className="mt-1 block text-xs text-slate-500">变量：{template.variables || '未声明'}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-label="通知模板详情与预览">
          <h4 className="font-semibold">详情与 safe preview</h4>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="notification-template-code">按编码查询</label>
            <input
              id="notification-template-code"
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
              <p>标题模板：{selectedTemplate.titleTemplate}</p>
              <p>正文模板：{selectedTemplate.contentTemplate}</p>
            </div>
          ) : <h3 className="text-sm font-medium text-slate-500">请选择一个模板查看详情。</h3>}

          <form className="space-y-3" onSubmit={runPreview}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="notification-template-preview-variables">预览变量（key=value，每行一组）</label>
            <textarea
              id="notification-template-preview-variables"
              className="h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={previewInput}
              onChange={(event) => setPreviewInput(event.target.value)}
            />
            <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white">生成无持久化预览</button>
          </form>

          {previewResult ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" aria-label="通知模板预览结果">
              <p className="font-medium">预览标题：{previewResult.renderedTitle}</p>
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
        元数据边界：{meta?.readonlyBoundary ?? boundaryCopy}；nonGoals：{meta?.nonGoals?.join('、') ?? '不发送、不配置渠道、不保存偏好'}。
      </div>
    </section>
  );
}
