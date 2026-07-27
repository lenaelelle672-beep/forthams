import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  listTenants,
  getTenantMeta,
  type TenantRecord,
  type TenantMeta,
  type TenantQuery,
} from '../../api/tenant';

type SystemTenantManagementWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type StatusFilter = 'all' | 'ACTIVE' | 'SUSPENDED';

const PLAN_LABEL: Record<string, string> = {
  STANDARD: '标准版',
  PROFESSIONAL: '专业版',
  ENTERPRISE: '企业版',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '正常',
  SUSPENDED: '已停用',
};

function statusBadgeClass(status: string | null | undefined) {
  return status === 'SUSPENDED'
    ? 'bg-red-50 text-red-700'
    : 'bg-emerald-50 text-emerald-700';
}

function matchesStatus(status: string | null | undefined, filter: StatusFilter) {
  if (filter === 'all') return true;
  return String(status ?? '').toUpperCase() === filter;
}

function matchesKeyword(tenant: TenantRecord, keyword: string) {
  if (!keyword) return true;
  const normalized = keyword.toLowerCase();
  return [tenant.id, tenant.name, tenant.contactName ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function emptyMeta(): TenantMeta {
  return { plans: [], statuses: [], readOnlyNotice: '租户管理为只读 catalog。' };
}

export default function SystemTenantManagementWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemTenantManagementWorkbenchPageProps) {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [meta, setMeta] = useState<TenantMeta>(emptyMeta);
  const [total, setTotal] = useState(0);
  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadTenants = async (query: TenantQuery = {}, nextPage: number = page) => {
    setLoading(true);
    setError(null);
    try {
      const [data, nextMeta] = await Promise.all([
        listTenants({ page: nextPage, pageSize, ...query }),
        getTenantMeta(),
      ]);
      setTenants(data?.records ?? []);
      setTotal(data?.total ?? 0);
      setMeta(nextMeta ?? emptyMeta());
      setPage(nextPage);
    } catch {
      setTenants([]);
      setTotal(0);
      setMeta(emptyMeta());
      setError('租户管理只读 catalog 加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let ignored = false;
    setLoading(true);
    setError(null);

    Promise.all([
      listTenants({ page, pageSize }),
      getTenantMeta(),
    ])
      .then(([data, nextMeta]) => {
        if (ignored) {
          return;
        }
        setTenants(data?.records ?? []);
        setTotal(data?.total ?? 0);
        setMeta(nextMeta ?? emptyMeta());
      })
      .catch(() => {
        if (!ignored) {
          setTenants([]);
          setTotal(0);
          setMeta(emptyMeta());
          setError('租户管理只读 catalog 加载失败，敏感细节已脱敏');
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
  }, [canView, page, pageSize]);

  const visibleTenants = useMemo(
    () => tenants.filter((t) => matchesStatus(t.status, statusFilter) && matchesKeyword(t, activeKeyword)),
    [tenants, statusFilter, activeKeyword],
  );

  const activeCount = useMemo(() => tenants.filter((t) => t.status !== 'SUSPENDED').length, [tenants]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextKeyword = keywordInput.trim();
    setActiveKeyword(nextKeyword);
    void loadTenants(nextKeyword ? { keyword: nextKeyword } : {}, 1);
  };

  const handleReload = () => {
    void loadTenants(activeKeyword ? { keyword: activeKeyword } : {}, 1);
  };

  const handlePrevPage = () => {
    if (page <= 1 || loading) return;
    void loadTenants(activeKeyword ? { keyword: activeKeyword } : {}, page - 1);
  };

  const handleNextPage = () => {
    if (page >= totalPages || loading) return;
    void loadTenants(activeKeyword ? { keyword: activeKeyword } : {}, page + 1);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问租户管理，请确认 system:tenant:query 权限或 ROLE_SUPER_ADMIN。
        </div>
      </section>
    );
  }

  const emptyMessage = tenants.length === 0 ? '暂无租户数据。' : '没有符合条件的租户。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">租户管理</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示 /tenants 与 /tenants/meta 返回的租户主数据、套餐与状态。</p>
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

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        只读边界：本页仅展示租户主数据；新建、编辑、停用、启用等写操作不在 V3 只读 catalog 范围内。
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">租户总数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">正常租户</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">当前过滤结果</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{visibleTenants.length}</p>
        </div>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="tenant-keyword">租户关键词</label>
        <input
          id="tenant-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按租户标识、名称或联系人搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="tenant-status-filter">状态筛选</label>
        <select
          id="tenant-status-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="all">全部状态</option>
          <option value="ACTIVE">正常</option>
          <option value="SUSPENDED">已停用</option>
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
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">租户管理加载中...</div> : null}
      {!loading && !error && visibleTenants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">租户列表</h4>
          <span className="text-xs text-slate-500">显示 {visibleTenants.length} / {tenants.length} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">租户标识</th>
                <th scope="col" className="py-2 pr-3">名称</th>
                <th scope="col" className="py-2 pr-3">套餐</th>
                <th scope="col" className="py-2 pr-3">用户上限</th>
                <th scope="col" className="py-2 pr-3">资产上限</th>
                <th scope="col" className="py-2 pr-3">联系人</th>
                <th scope="col" className="py-2 pr-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{tenant.id}</td>
                  <td className="py-2 pr-3 text-slate-600">{tenant.name}</td>
                  <td className="py-2 pr-3 text-slate-500">{PLAN_LABEL[tenant.plan] ?? tenant.plan}</td>
                  <td className="py-2 pr-3 text-slate-500">{tenant.maxUsers ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{tenant.maxAssets ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{tenant.contactName ?? '-'}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(tenant.status)}`}>
                      {STATUS_LABEL[String(tenant.status ?? '').toUpperCase()] ?? tenant.status ?? '未知'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-sm text-slate-600">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            disabled={page <= 1 || loading}
            onClick={handlePrevPage}
          >
            上一页
          </button>
          <span>第 {page} / {totalPages} 页</span>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            disabled={page >= totalPages || loading}
            onClick={handleNextPage}
          >
            下一页
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="text-xs text-slate-500">只读提示</p>
        <p className="mt-1">{meta.readOnlyNotice}</p>
      </div>
    </section>
  );
}
