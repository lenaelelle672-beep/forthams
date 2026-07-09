import { FormEvent, useEffect, useMemo, useState } from 'react';
import { systemPostApi } from '../../api/systemPosts';
import type { SystemPost, SystemPostMeta, SystemPostPage, SystemPostPreviewResponse } from '../../api/systemPosts';

type SystemPostManagementWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const boundaryCopy = 'metadata-only post catalog + dry-run preview；readOnly=true、tenantScoped=true、noPersistence=true、noAssignment=true、noPermissionEffect=true。';
const endpointCopy = '真实调用 /system/posts、/system/posts/all、/system/posts/{id}、/system/posts/meta 与 /system/posts/preview。';
const coverageCopy = '仅代表 system-post-management 已接入真组件；不代表组织权限组、岗位权限 runtime、用户岗位分配或 Workbench V3 全量完成。';

const emptyPage: SystemPostPage = {
  records: [],
  total: 0,
  page: 1,
  pageSize: 20,
  pages: 0,
  tenantScoped: true,
  readOnly: true,
  readonlyBoundary: boundaryCopy,
};

function display(value: string | number | boolean | undefined | null) {
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

export default function SystemPostManagementWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemPostManagementWorkbenchPageProps) {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [activeFilters, setActiveFilters] = useState<{ page: number; pageSize: number; keyword?: string; status?: string }>({ page: 1, pageSize: 20 });
  const [page, setPage] = useState<SystemPostPage>(emptyPage);
  const [selectedPost, setSelectedPost] = useState<SystemPost | null>(null);
  const [meta, setMeta] = useState<SystemPostMeta | null>(null);
  const [previewResult, setPreviewResult] = useState<SystemPostPreviewResponse | null>(null);
  const [previewPostCode, setPreviewPostCode] = useState('POST-ENGINEER');
  const [previewPostName, setPreviewPostName] = useState('工程师');
  const [previewSortOrder, setPreviewSortOrder] = useState('10');
  const [previewStatus, setPreviewStatus] = useState('ENABLED');
  const [previewRemark, setPreviewRemark] = useState('metadata-only');
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
      systemPostApi.list(activeFilters),
      systemPostApi.all(activeFilters),
      systemPostApi.meta(),
    ])
      .then(async ([listResult, _allResult, metaResult]) => {
        if (ignored) {
          return;
        }
        setPage(listResult);
        setMeta(metaResult);
        const first = listResult.records[0];
        if (!first) {
          setSelectedPost(null);
          return;
        }
        const detail = await systemPostApi.getById(first.id);
        if (!ignored) {
          setSelectedPost(detail);
          setPreviewPostCode(detail.postCode || 'POST-ENGINEER');
          setPreviewPostName(detail.postName || '工程师');
          setPreviewSortOrder(String(detail.sortOrder ?? 10));
          setPreviewStatus(detail.status || 'ENABLED');
          setPreviewRemark(detail.remark || 'metadata-only');
        }
      })
      .catch(() => {
        if (!ignored) {
          setPage(emptyPage);
          setSelectedPost(null);
          setPreviewResult(null);
          setError('岗位只读目录加载失败，错误详情已脱敏');
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

  const statusOptions = useMemo(() => meta?.statuses ?? [], [meta]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveFilters({
      page: 1,
      pageSize: 20,
      keyword: keyword.trim() || undefined,
      status: status || undefined,
    });
  };

  const openPost = async (post: SystemPost) => {
    try {
      setError(null);
      const detail = await systemPostApi.getById(post.id);
      setSelectedPost(detail);
      setPreviewResult(null);
      setPreviewPostCode(detail.postCode || 'POST-ENGINEER');
      setPreviewPostName(detail.postName || '工程师');
      setPreviewSortOrder(String(detail.sortOrder ?? 10));
      setPreviewStatus(detail.status || 'ENABLED');
      setPreviewRemark(detail.remark || 'metadata-only');
    } catch {
      setError('岗位 metadata 详情读取失败，错误详情已脱敏');
    }
  };

  const runPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sortOrder = Number(previewSortOrder);
    try {
      setError(null);
      setPreviewResult(await systemPostApi.preview({
        postCode: previewPostCode,
        postName: previewPostName,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
        status: previewStatus,
        remark: previewRemark,
      }));
    } catch {
      setError('岗位 dry-run preview 失败，错误详情已脱敏');
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-post-management="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问岗位 metadata-only catalog，请确认 system:post:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-post-management="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">岗位管理</h3>
          <p className="mt-1 text-sm text-slate-500">{endpointCopy}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">read-only / no-assignment / no-permission-effect</span>
      </div>

      <div role="note" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{boundaryCopy}</p>
        <p>preview 仅返回 previewAccepted、duplicateRisk、referenceImpact、acceptedFields、rejectedInputs、tenantScoped、noPersistence、noAssignment、noPermissionEffect、runtimeEffect=false、cacheRefreshed=false 与 readonlyBoundary。</p>
        <p>{coverageCopy}</p>
      </div>

      <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={applyFilters}>
        <label className="sr-only" htmlFor="system-post-keyword">岗位关键词</label>
        <input
          id="system-post-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按编码或名称筛选"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <label className="sr-only" htmlFor="system-post-status">岗位状态</label>
        <select id="system-post-status" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">全部状态</option>
          {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button type="submit" disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:bg-slate-300">只读刷新</button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-500">岗位 metadata-only catalog 加载中...</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="岗位只读列表">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">岗位 catalog</h4>
            <span className="text-xs text-slate-500">显示 {page.records.length} / {page.total} 条，只读展示</span>
          </div>
          {page.records.length === 0 && !loading ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无可展示的岗位元数据；这不代表组织权限组完成。</div> : null}
          <div className="space-y-2">
            {page.records.map((post) => (
              <button key={post.id} type="button" className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50" onClick={() => openPost(post)}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{post.postName}</span>
                  <span className="text-xs text-slate-500">{post.status} · sortOrder={display(post.sortOrder)}</span>
                </span>
                <span className="mt-1 block text-slate-600">{post.postCode} · remark={display(post.remark)}</span>
                <span className="mt-1 block text-xs text-slate-500">tenantScoped={display(post.tenantScoped ?? true)} · readOnly={display(post.readOnly ?? true)}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-label="岗位 metadata 详情与预览">
          <h4 className="font-semibold">metadata 详情与 dry-run preview</h4>
          {selectedPost ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600" aria-label="岗位 metadata 详情">
              <p>岗位：{selectedPost.postName}（{selectedPost.postCode}）</p>
              <p>status={display(selectedPost.status)} · sortOrder={display(selectedPost.sortOrder)}</p>
              <p>remark={display(selectedPost.remark)}</p>
              <p>tenantScoped={display(selectedPost.tenantScoped ?? true)} · readOnly={display(selectedPost.readOnly ?? true)}</p>
            </div>
          ) : <p className="text-sm text-slate-500">请选择一条岗位元数据查看详情。</p>}

          <form className="space-y-3" onSubmit={runPreview}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="system-post-preview-code">postCode</label>
            <input id="system-post-preview-code" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={previewPostCode} onChange={(event) => setPreviewPostCode(event.target.value)} />
            <label className="block text-sm font-medium text-slate-700" htmlFor="system-post-preview-name">postName</label>
            <input id="system-post-preview-name" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={previewPostName} onChange={(event) => setPreviewPostName(event.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="system-post-preview-sort">sortOrder</label>
                <input id="system-post-preview-sort" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={previewSortOrder} onChange={(event) => setPreviewSortOrder(event.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="system-post-preview-status">status</label>
                <select id="system-post-preview-status" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={previewStatus} onChange={(event) => setPreviewStatus(event.target.value)}>
                  {(statusOptions.length === 0 ? [{ value: 'ENABLED', label: '启用' }, { value: 'DISABLED', label: '停用' }] : statusOptions).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            </div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="system-post-preview-remark">remark</label>
            <input id="system-post-preview-remark" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={previewRemark} onChange={(event) => setPreviewRemark(event.target.value)} />
            <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white">运行 dry-run preview</button>
          </form>

          {previewResult ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" aria-label="岗位预览结果">
              <p className="font-medium">previewAccepted={String(previewResult.previewAccepted)} · duplicateRisk={String(previewResult.duplicateRisk)}</p>
              <p>referenceImpact={previewResult.referenceImpact} · acceptedFields={previewResult.acceptedFields.join('、') || '无'} · rejectedInputs={previewResult.rejectedInputs.map((item) => item.field).join('、') || '无'}</p>
              <p>tenantScoped={String(previewResult.tenantScoped)} · noPersistence={String(previewResult.noPersistence)} · noAssignment={String(previewResult.noAssignment)} · noPermissionEffect={String(previewResult.noPermissionEffect)} · runtimeEffect={String(previewResult.runtimeEffect)} · cacheRefreshed={String(previewResult.cacheRefreshed)}</p>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
        元数据边界：{meta?.readonlyBoundary ?? boundaryCopy}；nonGoals：{meta?.nonGoals?.join('、') ?? '不分配用户、不改变权限、不代表组织权限组完成'}。
      </div>
    </section>
  );
}
