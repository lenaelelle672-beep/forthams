import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getCustomFieldAll,
  getCustomFieldDetail,
  getCustomFieldList,
  getCustomFieldMeta,
  previewCustomFields,
  type CustomFieldItem,
  type CustomFieldMeta,
  type CustomFieldPreviewResponse,
} from '../../api/customField';
import type { PageData } from '../../types/common';

type SystemCustomFieldsWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const boundaryCopy = '只读自定义字段定义目录 + 无持久化校验预览；不提供字段定义 CRUD runtime，不完成字段集、分类绑定、资产字段值链路、运行时表单 schema、加密值存储或 secret handling。';
const endpointCopy = '真实调用 /system/custom-fields、/system/custom-fields/all、/system/custom-fields/{id}、/system/custom-fields/meta 与 /system/custom-fields/preview。';
const previewCopy = 'preview 仅按当前租户字段定义校验 required/type/options/regex，返回 valid、missing、rejected、errors、usedFields、tenantScoped、noPersistence 与 runtimeEffect=false；加密字段只展示安全标记，不回显样例原文。';

const emptyPage: PageData<CustomFieldItem> = { records: [], total: 0, size: 20, current: 1, pages: 0 };

function parsePreviewValues(input: string): Record<string, string> {
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

function optionsCount(fieldOptions?: string) {
  if (!fieldOptions) {
    return 0;
  }
  try {
    const parsed = JSON.parse(fieldOptions) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.length;
    }
  } catch {
    return fieldOptions.split(',').filter(Boolean).length;
  }
  return fieldOptions.split(',').filter(Boolean).length;
}

export default function SystemCustomFieldsWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemCustomFieldsWorkbenchPageProps) {
  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState<string | undefined>();
  const [page, setPage] = useState<PageData<CustomFieldItem>>(emptyPage);
  const [allFields, setAllFields] = useState<CustomFieldItem[]>([]);
  const [selectedField, setSelectedField] = useState<CustomFieldItem | null>(null);
  const [meta, setMeta] = useState<CustomFieldMeta | null>(null);
  const [previewInput, setPreviewInput] = useState('warranty_expiry=2026-12-31\ncriticality=高\nasset_owner=张三');
  const [previewResult, setPreviewResult] = useState<CustomFieldPreviewResponse | null>(null);
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
      getCustomFieldList(1, 20, activeKeyword),
      getCustomFieldAll(),
      getCustomFieldMeta(),
    ])
      .then(async ([listResult, allResult, metaResult]) => {
        if (ignored) {
          return;
        }
        setPage(listResult);
        setAllFields(allResult);
        setMeta(metaResult);
        const first = listResult.records[0] ?? allResult[0];
        if (!first) {
          setSelectedField(null);
          setPreviewResult(null);
          return;
        }
        const detail = await getCustomFieldDetail(first.id);
        if (!ignored) {
          setSelectedField(detail);
        }
      })
      .catch(() => {
        if (!ignored) {
          setPage(emptyPage);
          setAllFields([]);
          setSelectedField(null);
          setPreviewResult(null);
          setError('自定义字段定义目录加载失败，错误详情已脱敏');
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
  }, [activeKeyword, canView]);

  const fieldTypeOptions = useMemo(() => meta?.fieldTypes ?? [], [meta]);

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveKeyword(keywordInput.trim() || undefined);
  };

  const openField = async (field: CustomFieldItem) => {
    try {
      setError(null);
      setSelectedField(await getCustomFieldDetail(field.id));
      setPreviewResult(null);
    } catch {
      setError('字段详情加载失败，错误详情已脱敏');
    }
  };

  const runPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setError(null);
      setPreviewResult(await previewCustomFields({ values: parsePreviewValues(previewInput) }));
    } catch {
      setError('无持久化校验预览失败，错误详情已脱敏');
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-custom-fields="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问自定义字段定义目录，请确认 system:custom-field:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-custom-fields="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">自定义字段</h3>
          <p className="mt-1 text-sm text-slate-500">{endpointCopy}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">definition catalog / tenant-scoped / no-persistence preview</span>
      </div>

      <div role="note" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{boundaryCopy}</p>
        <p>{previewCopy}</p>
        <p>不代表字段集完成，不代表资产字段值读写链路完成，不代表基础资料组完成，不代表 Workbench V3 全量完成。</p>
      </div>

      <form className="flex flex-wrap gap-3" onSubmit={applySearch}>
        <label className="sr-only" htmlFor="custom-field-keyword">自定义字段关键词</label>
        <input
          id="custom-field-keyword"
          className="min-w-[260px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按字段名或字段标签搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <button type="submit" disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:bg-slate-300">查询只读目录</button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">自定义字段定义加载中...</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="自定义字段定义列表">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">字段定义 catalog</h4>
            <span className="text-xs text-slate-500">分页 {page.records.length} / {page.total} 条；全集 {allFields.length} 条，只读展示</span>
          </div>
          {page.records.length === 0 && !loading ? <h3 className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-medium text-slate-500">暂无自定义字段定义。</h3> : null}
          <div className="space-y-2">
            {page.records.map((field) => (
              <button key={field.id} type="button" className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50" onClick={() => openField(field)}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{field.fieldLabel}</span>
                  <span className="text-xs text-slate-500">{field.fieldName}</span>
                </span>
                <span className="mt-1 block text-slate-600">类型：{field.fieldType} · 必填：{field.required === 1 ? '是' : '否'} · 加密标记：{field.encrypted === 1 ? '是' : '否'}</span>
                <span className="mt-1 block text-xs text-slate-500">options 数量：{optionsCount(field.fieldOptions)} · regex：{field.validationPattern || '未配置'}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-label="字段详情与校验预览">
          <h4 className="font-semibold">详情与 no-persistence preview</h4>
          {selectedField ? (
            <div className="space-y-2 text-sm text-slate-600">
              <p>字段名：{selectedField.fieldName}</p>
              <p>字段标签：{selectedField.fieldLabel}</p>
              <p>字段类型：{selectedField.fieldType}</p>
              <p>选项原文：{selectedField.fieldOptions || '未配置'}</p>
              <p>正则摘要：{selectedField.validationPattern || '未配置'}</p>
              <p>加密字段：{selectedField.encrypted === 1 ? '仅展示标记，不回显样例原文' : '否'}</p>
            </div>
          ) : <h3 className="text-sm font-medium text-slate-500">请选择一个字段定义查看详情。</h3>}

          <form className="space-y-3" onSubmit={runPreview}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="custom-field-preview-values">预览样例（fieldName=value，每行一组）</label>
            <textarea
              id="custom-field-preview-values"
              className="h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={previewInput}
              onChange={(event) => setPreviewInput(event.target.value)}
            />
            <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white">运行无持久化校验预览</button>
          </form>

          {previewResult ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" aria-label="自定义字段预览结果">
              <p className="font-medium">valid={String(previewResult.valid)}</p>
              <p>missing：{previewResult.missing.map((item) => `${item.fieldLabel}:${item.reason}`).join('、') || '无'}</p>
              <p>rejected：{previewResult.rejected.map((item) => `${item.fieldLabel}:${item.reason}`).join('、') || '无'}</p>
              <p>errors：{previewResult.errors.join('、') || '无'}</p>
              <p>usedFields：{previewResult.usedFields.map((item) => `${item.fieldLabel}/${item.fieldType}${item.encrypted ? '/encrypted' : ''}`).join('、') || '无'}</p>
              <p>tenantScoped={String(previewResult.tenantScoped)} · noPersistence={String(previewResult.noPersistence)} · runtimeEffect={String(previewResult.runtimeEffect)}</p>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
        元数据边界：{meta?.readonlyBoundary ?? boundaryCopy}；字段类型：{fieldTypeOptions.map((item) => item.label).join('、') || '未加载'}；nonGoals：{meta?.nonGoals?.join('、') ?? '不完成字段集、不写资产字段值、不接入运行时 schema'}。
      </div>
    </section>
  );
}
