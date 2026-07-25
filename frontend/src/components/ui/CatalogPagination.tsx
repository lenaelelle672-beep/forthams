/**
 * V3 catalog 只读列表通用分页组件。
 * 统一 7+ 个 catalog 页面的分页 UI，消除重复 JSX。
 */

type CatalogPaginationProps = {
  page: number;
  totalPages: number;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function CatalogPagination({ page, totalPages, loading, onPrev, onNext }: CatalogPaginationProps) {
  return (
    <div className="flex items-center justify-center gap-4 py-3">
      <button
        type="button"
        className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        disabled={page <= 1 || loading}
        onClick={onPrev}
      >
        上一页
      </button>
      <span className="text-sm text-slate-500">
        第 {page} / {totalPages} 页
      </span>
      <button
        type="button"
        className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        disabled={page >= totalPages || loading}
        onClick={onNext}
      >
        下一页
      </button>
    </div>
  );
}
