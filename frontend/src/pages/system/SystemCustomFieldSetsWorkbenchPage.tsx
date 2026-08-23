import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getCustomFieldsetAll,
  getCustomFieldsetDetail,
  getCustomFieldsetList,
  getCustomFieldsetMeta,
  getFieldsetByCategory,
  getFieldsetFields,
  previewCustomFieldsets,
  type CustomFieldItem,
  type CustomFieldsetItem,
  type CustomFieldsetMeta,
  type CustomFieldsetPreviewResponse,
} from '../../api/customField';
import type { PageData } from '../../types/common';

type SystemCustomFieldSetsWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const boundaryCopy = '只读字段集目录 + 无持久化字段分配/分类绑定预览；不提供字段集新增、编辑、删除，不保存字段分配或分类绑定，不影响资产模型、资产字段值或运行时表单 schema。';
const endpointCopy = '真实调用 /system/custom-fieldsets、/system/custom-fieldsets/all、/system/custom-fieldsets/{id}、/system/custom-fieldsets/{id}/fields、/system/custom-fieldsets/by-category/{categoryId}、/system/custom-fieldsets/meta 与 /system/custom-fieldsets/preview。';
const coverageCopy = '仅代表 system-custom-field-sets 的第 30 个真实模块候选；基础资料组未全组完成，未覆盖全部 44 项，也不是 Workbench V3 全量完成。';

const emptyPage: PageData<CustomFieldsetItem> = { records: [], total: 0, size: 20, current: 1, pages: 0 };

function parseIds(input: string) {
  return input
    .split(/[\n,，]/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function parseOptionalId(input: string) {
  const value = Number(input.trim());
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export default function SystemCustomFieldSetsWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemCustomFieldSetsWorkbenchPageProps) {
  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState<string | undefined>();
  const [page, setPage] = useState<PageData<CustomFieldsetItem>>(emptyPage);
  const [allFieldsets, setAllFieldsets] = useState<CustomFieldsetItem[]>([]);
  const [selectedFieldset, setSelectedFieldset] = useState<CustomFieldsetItem | null>(null);
  const [fieldsetFields, setFieldsetFields] = useState<CustomFieldItem[]>([]);
  const [categoryMatch, setCategoryMatch] = useState<CustomFieldsetItem | null>(null);
  const [meta, setMeta] = useState<CustomFieldsetMeta | null>(null);
  const [fieldIdsInput, setFieldIdsInput] = useState('7,8');
  const [categoryInput, setCategoryInput] = useState('12');
  const [previewResult, setPreviewResult] = useState<CustomFieldsetPreviewResponse | null>(null);
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
      getCustomFieldsetList(1, 20, activeKeyword),
      getCustomFieldsetAll(),
      getCustomFieldsetMeta(),
    ])
      .then(async ([listResult, allResult, metaResult]) => {
        if (ignored) {
          return;
        }
        setPage(listResult);
        setAllFieldsets(allResult);
        setMeta(metaResult);
        const first = listResult.records[0] ?? allResult[0];
        if (!first) {
          setSelectedFieldset(null);
          setFieldsetFields([]);
          setCategoryMatch(null);
          setPreviewResult(null);
          return;
        }
        const detail = await getCustomFieldsetDetail(first.id);
        const fields = await getFieldsetFields(first.id);
        const matchedByCategory = detail.categoryId ? await getFieldsetByCategory(detail.categoryId) : null;
        if (!ignored) {
          setSelectedFieldset(detail);
          setFieldsetFields(fields);
          setCategoryMatch(matchedByCategory);
          setCategoryInput(detail.categoryId ? String(detail.categoryId) : categoryInput);
        }
      })
      .catch(() => {
        if (!ignored) {
          setPage(emptyPage);
          setAllFieldsets([]);
          setSelectedFieldset(null);
          setFieldsetFields([]);
          setCategoryMatch(null);
          setPreviewResult(null);
          setError('字段集只读目录加载失败，错误详情已脱敏');
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

  const statusLabels = useMemo(() => meta?.statuses ?? [], [meta]);

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveKeyword(keywordInput.trim() || undefined);
  };

  const openFieldset = async (fieldset: CustomFieldsetItem) => {
    try {
      setError(null);
      const detail = await getCustomFieldsetDetail(fieldset.id);
      const fields = await getFieldsetFields(fieldset.id);
      const matchedByCategory = detail.categoryId ? await getFieldsetByCategory(detail.categoryId) : null;
      setSelectedFieldset(detail);
      setFieldsetFields(fields);
      setCategoryMatch(matchedByCategory);
      setPreviewResult(null);
      setCategoryInput(detail.categoryId ? String(detail.categoryId) : categoryInput);
    } catch {
      setError('字段集详情加载失败，错误详情已脱敏');
    }
  };

  const queryCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const categoryId = parseOptionalId(categoryInput);
    if (!categoryId) {
      setCategoryMatch(null);
      setError('请输入合法分类 ID 用于只读诊断');
      return;
    }
    try {
      setError(null);
      setCategoryMatch(await getFieldsetByCategory(categoryId));
    } catch {
      setCategoryMatch(null);
      setError('分类字段集诊断失败，错误详情已脱敏');
    }
  };

  const runPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setError(null);
      setPreviewResult(await previewCustomFieldsets({
        fieldsetId: selectedFieldset?.id,
        fieldIds: parseIds(fieldIdsInput),
        categoryId: parseOptionalId(categoryInput),
      }));
    } catch {
      setError('无持久化字段集预览失败，错误详情已脱敏');
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-custom-field-sets="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问字段集只读目录，请确认 system:custom-fieldset:query 或 read 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-custom-field-sets="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">字段集</h3>
          <p className="mt-1 text-sm text-slate-500">{endpointCopy}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">read-only / tenant-scoped / no-persistence preview</span>
      </div>

      <div role="note" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{boundaryCopy}</p>
        <p>preview 仅校验当前租户字段 ID 与字段集/分类诊断上下文，返回 valid、missingFields、rejectedFields、usedFields、wouldBindCategory、tenantScoped、noPersistence、runtimeEffect=false、readonlyBoundary 与 errors。</p>
        <p>{coverageCopy}</p>
      </div>

      <form className="flex flex-wrap gap-3" onSubmit={applySearch}>
        <label className="sr-only" htmlFor="custom-fieldset-keyword">字段集关键词</label>
        <input
          id="custom-fieldset-keyword"
          className="min-w-[260px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按字段集名称或描述搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <button type="submit" disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:bg-slate-300">查询只读字段集</button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">字段集只读目录加载中...</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="字段集只读列表">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">字段集 catalog</h4>
            <span className="text-xs text-slate-500">分页 {page.records.length} / {page.total} 条；全集 {allFieldsets.length} 条，只读展示</span>
          </div>
          {page.records.length === 0 && !loading ? <h3 className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-medium text-slate-500">暂无字段集。</h3> : null}
          <div className="space-y-2">
            {page.records.map((fieldset) => (
              <button key={fieldset.id} type="button" className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50" onClick={() => openFieldset(fieldset)}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{fieldset.name}</span>
                  <span className="text-xs text-slate-500">#{fieldset.id}</span>
                </span>
                <span className="mt-1 block text-slate-600">分类：{fieldset.categoryId ?? '未绑定'} · 字段数：{fieldset.fieldCount ?? 0} · 状态：{fieldset.status === 1 ? '启用' : '停用'}</span>
                <span className="mt-1 block text-xs text-slate-500">{fieldset.description || '无描述'}；只读，无保存动作。</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-label="字段集详情与预览">
          <h4 className="font-semibold">详情、字段与 no-persistence preview</h4>
          {selectedFieldset ? (
            <div className="space-y-2 text-sm text-slate-600">
              <p>字段集名称：{selectedFieldset.name}</p>
              <p>描述：{selectedFieldset.description || '未配置'}</p>
              <p>分类 ID：{selectedFieldset.categoryId ?? '未绑定'}</p>
              <p>只读字段：{fieldsetFields.map((field) => `${field.fieldLabel}/${field.fieldType}`).join('、') || '未配置'}</p>
            </div>
          ) : <h3 className="text-sm font-medium text-slate-500">请选择一个字段集查看详情。</h3>}

          <form className="space-y-3" onSubmit={queryCategory}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="custom-fieldset-category-id">分类 ID 只读诊断</label>
            <div className="flex gap-2">
              <input
                id="custom-fieldset-category-id"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={categoryInput}
                onChange={(event) => setCategoryInput(event.target.value)}
              />
              <button type="submit" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">查询分类字段集</button>
            </div>
          </form>
          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600" aria-label="分类字段集诊断">
            分类诊断：{categoryMatch ? `${categoryMatch.name}（字段数 ${categoryMatch.fieldCount ?? 0}）` : '无当前租户只读匹配'}。
          </div>

          <form className="space-y-3" onSubmit={runPreview}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="custom-fieldset-preview-field-ids">预览字段 ID（逗号或换行分隔）</label>
            <textarea
              id="custom-fieldset-preview-field-ids"
              className="h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={fieldIdsInput}
              onChange={(event) => setFieldIdsInput(event.target.value)}
            />
            <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white">运行无持久化字段集预览</button>
          </form>

          {previewResult ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" aria-label="字段集预览结果">
              <p className="font-medium">valid={String(previewResult.valid)} · wouldBindCategory={String(previewResult.wouldBindCategory)}</p>
              <p>missingFields：{previewResult.missingFields.map((item) => `${item.fieldLabel ?? item.fieldId}:${item.reason}`).join('、') || '无'}</p>
              <p>rejectedFields：{previewResult.rejectedFields.map((item) => `${item.fieldLabel ?? item.fieldId}:${item.reason}`).join('、') || '无'}</p>
              <p>usedFields：{previewResult.usedFields.map((item) => `${item.fieldLabel}/${item.fieldType}${item.encrypted ? '/encrypted' : ''}`).join('、') || '无'}</p>
              <p>errors：{previewResult.errors.join('、') || '无'}</p>
              <p>tenantScoped={String(previewResult.tenantScoped)} · noPersistence={String(previewResult.noPersistence)} · runtimeEffect={String(previewResult.runtimeEffect)}</p>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
        元数据边界：{meta?.readonlyBoundary ?? boundaryCopy}；状态：{statusLabels.map((item) => item.label).join('、') || '未加载'}；nonGoals：{meta?.nonGoals?.join('、') ?? '不保存字段分配、不保存分类绑定、不影响资产字段值或运行时 schema'}。
      </div>
    </section>
  );
}
