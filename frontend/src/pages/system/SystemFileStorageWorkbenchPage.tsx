import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getFileStorageAttachmentCatalog,
  type FileStorageAttachmentCatalog,
  type FileStorageAttachmentCatalogParams,
  type FileStorageAttachmentMetadata,
} from '../../api/fileStorage';

type SystemFileStorageWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const defaultReadonlyNotice = '当前仅为 /system/file-storage/attachments/catalog 只读元数据目录，不支持上传/下载/预览/删除，不访问文件系统，不代表文件生命周期闭环。';

const emptyCatalog: FileStorageAttachmentCatalog = {
  attachments: [],
  summary: {
    totalAttachmentCount: 0,
    totalFileSize: 0,
    businessTypeCount: 0,
    fileTypeCount: 0,
    currentPageAttachmentCount: 0,
  },
  page: {
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 0,
  },
  businessTypes: [],
  fileTypes: [],
  riskTips: [defaultReadonlyNotice, '本页不包含导入/导出或执行动作，仅展示附件元数据。'],
  readonlyNotice: defaultReadonlyNotice,
};

const defaultFilters: FileStorageAttachmentCatalogParams = {
  page: 1,
  pageSize: 20,
};

function formatFileSize(value: number | null | undefined) {
  if (!value || value <= 0) {
    return '0 B';
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '未知';
  }
  return value.replace('T', ' ').slice(0, 16);
}

function matchesKeyword(attachment: FileStorageAttachmentMetadata, keyword: string) {
  if (!keyword) {
    return true;
  }
  const normalizedKeyword = keyword.toLowerCase();
  return [
    attachment.displayName,
    attachment.fileName,
    attachment.businessType,
    attachment.fileType ?? '',
    String(attachment.businessId),
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
}

export default function SystemFileStorageWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemFileStorageWorkbenchPageProps) {
  const [catalog, setCatalog] = useState<FileStorageAttachmentCatalog>(emptyCatalog);
  const [keywordInput, setKeywordInput] = useState('');
  const [businessTypeInput, setBusinessTypeInput] = useState('');
  const [fileTypeInput, setFileTypeInput] = useState('');
  const [activeFilters, setActiveFilters] = useState<FileStorageAttachmentCatalogParams>(defaultFilters);
  const [reloadToken, setReloadToken] = useState(0);
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
    getFileStorageAttachmentCatalog(activeFilters)
      .then((nextCatalog) => {
        if (!ignored) {
          setCatalog(nextCatalog);
        }
      })
      .catch(() => {
        if (!ignored) {
          setCatalog(emptyCatalog);
          setError('文件存储附件元数据加载失败，敏感细节已脱敏');
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
  }, [canView, activeFilters, reloadToken]);

  const visibleAttachments = useMemo(
    () => catalog.attachments.filter((attachment) => matchesKeyword(attachment, activeFilters.keyword ?? '')),
    [catalog.attachments, activeFilters.keyword],
  );

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveFilters({
      keyword: keywordInput.trim() || undefined,
      businessType: businessTypeInput || undefined,
      fileType: fileTypeInput || undefined,
      page: 1,
      pageSize: activeFilters.pageSize ?? 20,
    });
  };

  const handleReload = () => {
    setReloadToken((value) => value + 1);
  };

  const gotoPage = (page: number) => {
    setActiveFilters((filters) => ({
      ...filters,
      page,
    }));
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问文件存储元数据，请确认 system:file-storage:query 权限。
        </div>
      </section>
    );
  }

  const readonlyTips = catalog.riskTips.length > 0 ? catalog.riskTips : emptyCatalog.riskTips;
  const emptyMessage = catalog.attachments.length === 0 ? '暂无附件元数据。' : '没有符合条件的附件元数据。';
  const currentPage = catalog.page.page || activeFilters.page || 1;
  const totalPages = catalog.page.totalPages || 0;

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">文件存储</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示 /system/file-storage/attachments/catalog 返回的附件元数据、统计摘要与筛选结果。</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
          type="button"
          onClick={handleReload}
        >
          重新加载
        </button>
      </div>

      <div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{catalog.readonlyNotice || defaultReadonlyNotice}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {readonlyTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">附件总数</h3>
          <p className="mt-1 text-2xl font-semibold">{catalog.summary.totalAttachmentCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">总容量</h3>
          <p className="mt-1 text-2xl font-semibold">{formatFileSize(catalog.summary.totalFileSize)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">业务类型</h3>
          <p className="mt-1 text-2xl font-semibold">{catalog.summary.businessTypeCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">文件类型</h3>
          <p className="mt-1 text-2xl font-semibold">{catalog.summary.fileTypeCount}</p>
        </div>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]" onSubmit={applyFilters}>
        <label className="sr-only" htmlFor="file-storage-keyword">附件关键词</label>
        <input
          id="file-storage-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按文件名、业务类型或文件类型搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="file-storage-business-type">业务类型筛选</label>
        <select
          id="file-storage-business-type"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={businessTypeInput}
          onChange={(event) => setBusinessTypeInput(event.target.value)}
        >
          <option value="">全部业务类型</option>
          {catalog.businessTypes.map((businessType) => (
            <option key={businessType} value={businessType}>{businessType}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="file-storage-file-type">文件类型筛选</label>
        <select
          id="file-storage-file-type"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={fileTypeInput}
          onChange={(event) => setFileTypeInput(event.target.value)}
        >
          <option value="">全部文件类型</option>
          {catalog.fileTypes.map((fileType) => (
            <option key={fileType} value={fileType}>{fileType}</option>
          ))}
        </select>
        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loading}
          type="submit"
        >
          查询
        </button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">附件元数据加载中...</div> : null}
      {!loading && !error && visibleAttachments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">附件元数据目录</h4>
          <span className="text-xs text-slate-500">显示 {visibleAttachments.length} / {catalog.page.totalCount} 条元数据</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">文件名</th>
                <th scope="col" className="py-2 pr-3">业务类型</th>
                <th scope="col" className="py-2 pr-3">业务 ID</th>
                <th scope="col" className="py-2 pr-3">类型</th>
                <th scope="col" className="py-2 pr-3">大小</th>
                <th scope="col" className="py-2 pr-3">上传人</th>
                <th scope="col" className="py-2 pr-3">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleAttachments.map((attachment) => (
                <tr key={attachment.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{attachment.displayName || attachment.fileName}</td>
                  <td className="py-2 pr-3 text-slate-600">{attachment.businessType}</td>
                  <td className="py-2 pr-3 text-slate-500">{attachment.businessId}</td>
                  <td className="py-2 pr-3 text-slate-500">{attachment.fileType || '未知'}</td>
                  <td className="py-2 pr-3 text-slate-500">{formatFileSize(attachment.fileSize)}</td>
                  <td className="py-2 pr-3 text-slate-500">{attachment.uploadBy ?? '未知'}</td>
                  <td className="py-2 pr-3 text-slate-500">{formatDate(attachment.createTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>第 {currentPage} 页 / 共 {totalPages} 页</span>
          <div className="flex gap-2">
            <button
              className="rounded-xl border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              disabled={loading || currentPage <= 1}
              type="button"
              onClick={() => gotoPage(Math.max(currentPage - 1, 1))}
            >
              上一页
            </button>
            <button
              className="rounded-xl border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              disabled={loading || totalPages === 0 || currentPage >= totalPages}
              type="button"
              onClick={() => gotoPage(currentPage + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
