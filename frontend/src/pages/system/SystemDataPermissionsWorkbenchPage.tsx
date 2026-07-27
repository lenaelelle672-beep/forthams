import { useEffect, useMemo, useState } from 'react';
import {
  getDataPermissionCatalog,
  type DataPermissionCatalog,
  type RoleDataScope,
} from '../../api/dataPermissions';

type SystemDataPermissionsWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type ScopeFilter = 'all' | 'ALL' | 'RESTRICTED' | 'CUSTOM';

const RESTRICTED_SCOPES = new Set(['DEPT', 'DEPT_AND_SUB', 'SELF']);

function scopeBadgeClass(scope: string | null | undefined) {
  const value = String(scope ?? '').toUpperCase();
  if (value === 'ALL') return 'bg-red-50 text-red-700';
  if (value === 'CUSTOM') return 'bg-amber-50 text-amber-700';
  if (RESTRICTED_SCOPES.has(value)) return 'bg-emerald-50 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

function matchesScope(role: RoleDataScope, filter: ScopeFilter) {
  if (filter === 'all') return true;
  const scope = String(role.dataScope ?? '').toUpperCase();
  if (filter === 'ALL') return scope === 'ALL';
  if (filter === 'CUSTOM') return scope === 'CUSTOM';
  if (filter === 'RESTRICTED') return RESTRICTED_SCOPES.has(scope);
  return true;
}

function matchesKeyword(role: RoleDataScope, keyword: string) {
  if (!keyword) return true;
  const normalized = keyword.toLowerCase();
  return [role.roleName, role.roleCode].join(' ').toLowerCase().includes(normalized);
}

function emptyCatalog(): DataPermissionCatalog {
  return { roles: [], summary: { roleCount: 0, allScopeCount: 0, restrictedScopeCount: 0, customScopeCount: 0 }, riskTips: [], readOnlyNotice: '数据权限为只读 catalog。' };
}

export default function SystemDataPermissionsWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemDataPermissionsWorkbenchPageProps) {
  const [catalog, setCatalog] = useState<DataPermissionCatalog>(emptyCatalog);
  const [keyword, setKeyword] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getDataPermissionCatalog();
      setCatalog(next ?? emptyCatalog());
    } catch {
      setCatalog(emptyCatalog());
      setError('数据权限只读 catalog 加载失败，敏感细节已脱敏');
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

    getDataPermissionCatalog()
      .then((next) => {
        if (ignored) {
          return;
        }
        setCatalog(next ?? emptyCatalog());
      })
      .catch(() => {
        if (!ignored) {
          setCatalog(emptyCatalog());
          setError('数据权限只读 catalog 加载失败，敏感细节已脱敏');
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
  }, [canView]);

  const visibleRoles = useMemo(
    () => catalog.roles.filter((r) => matchesScope(r, scopeFilter) && matchesKeyword(r, keyword)),
    [catalog.roles, scopeFilter, keyword],
  );

  // 筛选条件变化时回到第一页
  useEffect(() => {
    setPage(1);
  }, [keyword, scopeFilter, catalog.roles]);

  const totalPages = Math.max(1, Math.ceil(visibleRoles.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRoles = useMemo(
    () => visibleRoles.slice((safePage - 1) * pageSize, safePage * pageSize),
    [visibleRoles, safePage, pageSize],
  );

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问数据权限，请确认 system:role-permission:query 权限。
        </div>
      </section>
    );
  }

  const emptyMessage = catalog.roles.length === 0 ? '暂无角色数据范围。' : '没有符合条件的角色数据范围。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">数据权限</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示 /system/data-permissions/catalog 返回的角色数据范围与风险提示。</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
          type="button"
          onClick={loadCatalog}
        >
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        只读边界：本页仅展示角色数据范围；修改 dataScope 与配置 CUSTOM 规则不在 V3 只读边界内，需后续权限专项处理。数据权限只收紧，CUSTOM 跳过投影。
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">角色总数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{catalog.summary.roleCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">全部数据（ALL）</p>
          <p className="mt-2 text-2xl font-semibold text-red-600">{catalog.summary.allScopeCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">已收紧范围</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{catalog.summary.restrictedScopeCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">自定义（CUSTOM）</p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{catalog.summary.customScopeCount}</p>
        </div>
      </div>

      {(catalog.riskTips ?? []).length > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">风险提示</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {catalog.riskTips.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
        </div>
      ) : null}

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]" onSubmit={(e) => { e.preventDefault(); }}>
        <label className="sr-only" htmlFor="data-permissions-keyword">角色关键词</label>
        <input
          id="data-permissions-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按角色名称或编码搜索"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <label className="sr-only" htmlFor="data-permissions-scope-filter">数据范围筛选</label>
        <select
          id="data-permissions-scope-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={scopeFilter}
          onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)}
        >
          <option value="all">全部范围</option>
          <option value="ALL">全部数据</option>
          <option value="RESTRICTED">已收紧</option>
          <option value="CUSTOM">自定义</option>
        </select>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">数据权限加载中...</div> : null}
      {!loading && !error && visibleRoles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">角色数据范围</h4>
          <span className="text-xs text-slate-500">显示 {visibleRoles.length} / {catalog.roles.length} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">角色编码</th>
                <th scope="col" className="py-2 pr-3">角色名称</th>
                <th scope="col" className="py-2 pr-3">数据范围</th>
                <th scope="col" className="py-2 pr-3">风险说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedRoles.map((role) => (
                <tr key={role.roleId}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{role.roleCode}</td>
                  <td className="py-2 pr-3 text-slate-600">{role.roleName}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${scopeBadgeClass(role.dataScope)}`}>
                      {role.dataScopeLabel}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{role.riskNote || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-sm text-slate-600">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <span>第 {safePage} / {totalPages} 页</span>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="text-xs text-slate-500">只读提示</p>
        <p className="mt-1">{catalog.readOnlyNotice}</p>
      </div>
    </section>
  );
}
