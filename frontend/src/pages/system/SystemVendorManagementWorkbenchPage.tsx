import { FormEvent, useEffect, useMemo, useState } from 'react';
import { listVendors, type VendorRecord } from '../../api/vendors';

type SystemVendorManagementWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type StatusFilter = 'all' | 'enabled' | 'disabled';

function normalizeText(value: unknown) {
  return String(value ?? '').toLowerCase();
}

function statusLabel(status: number | null | undefined) {
  if (status === 1) {
    return '启用';
  }
  if (status === 0) {
    return '停用';
  }
  return '未知';
}

function matchesStatus(status: number | null | undefined, filter: StatusFilter) {
  if (filter === 'enabled') {
    return status === 1;
  }
  if (filter === 'disabled') {
    return status === 0;
  }
  return true;
}

export default function SystemVendorManagementWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemVendorManagementWorkbenchPageProps) {
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadVendors = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextVendors = await listVendors();
      setVendors(nextVendors);
    } catch {
      setVendors([]);
      setError('供应商加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadVendors();
  }, [canView]);

  const filteredVendors = useMemo(() => {
    const keyword = normalizeText(activeKeyword.trim());
    return vendors.filter((vendor) => {
      const keywordMatched = keyword.length === 0 || [
        vendor.name,
        vendor.vendorCode,
        vendor.contactPerson,
        vendor.contactPhone,
        vendor.contactEmail,
        vendor.address,
      ].some((value) => normalizeText(value).includes(keyword));
      return keywordMatched && matchesStatus(vendor.status, statusFilter);
    });
  }, [activeKeyword, statusFilter, vendors]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveKeyword(keywordInput.trim());
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问供应商管理，请确认 vendor:vendor:query 权限。
        </div>
      </section>
    );
  }

  const emptyMessage = vendors.length === 0 ? '暂无供应商数据。' : '没有符合条件的供应商。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">供应商管理</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示 /vendors/list 返回的供应商，搜索与状态筛选在前端结果内完成。</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
          type="button"
          onClick={() => void loadVendors()}
        >
          重新加载
        </button>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="vendor-keyword">供应商关键词</label>
        <input
          id="vendor-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按名称、编码、联系人或地址搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="vendor-status-filter">状态筛选</label>
        <select
          id="vendor-status-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="all">全部状态</option>
          <option value="enabled">启用</option>
          <option value="disabled">停用</option>
        </select>
        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loading}
          type="submit"
        >
          搜索
        </button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">供应商加载中...</div> : null}
      {!loading && !error && filteredVendors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">供应商列表</h4>
          <span className="text-xs text-slate-500">显示 {filteredVendors.length} / {vendors.length} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">名称</th>
                <th scope="col" className="py-2 pr-3">编码</th>
                <th scope="col" className="py-2 pr-3">联系人</th>
                <th scope="col" className="py-2 pr-3">联系电话</th>
                <th scope="col" className="py-2 pr-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{vendor.name}</td>
                  <td className="py-2 pr-3 text-slate-600">{vendor.vendorCode ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{vendor.contactPerson ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{vendor.contactPhone ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{statusLabel(vendor.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
