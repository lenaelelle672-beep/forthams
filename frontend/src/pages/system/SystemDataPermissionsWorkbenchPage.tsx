import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getDataPermissionCatalog,
  listAssignableDepts,
  updateDataPermissionDepts,
  updateDataPermissionScope,
  type AssignableDept,
  type DataPermissionCatalog,
  type RoleDataScope,
} from '../../api/dataPermissions';
import { CatalogPagination } from '../../components/ui/CatalogPagination';
import { useCatalogPage } from '../../hooks/useCatalogPage';

type SystemDataPermissionsWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type ScopeFilter = 'all' | 'ALL' | 'RESTRICTED' | 'CUSTOM';

const RESTRICTED_SCOPES = new Set(['DEPT', 'DEPT_AND_SUB', 'SELF']);
const WRITABLE_SCOPES = [
  { value: 'ALL', label: '全部数据' },
  { value: 'DEPT', label: '本部门' },
  { value: 'DEPT_AND_SUB', label: '本部门及下属' },
  { value: 'SELF', label: '仅本人' },
  { value: 'CUSTOM', label: '自定义' },
] as const;

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

function flattenDepts(nodes: AssignableDept[] | undefined, acc: Array<{ id: number; name: string }> = []) {
  for (const node of nodes ?? []) {
    const id = Number(node.id ?? node.deptId);
    const name = String(node.deptName ?? node.name ?? id);
    if (Number.isFinite(id) && id > 0) {
      acc.push({ id, name });
    }
    flattenDepts(node.children, acc);
  }
  return acc;
}

function emptyCatalog(): DataPermissionCatalog {
  return { roles: [], summary: { roleCount: 0, allScopeCount: 0, restrictedScopeCount: 0, customScopeCount: 0 }, riskTips: [], readOnlyNotice: '数据权限为只读 catalog。' };
}

export default function SystemDataPermissionsWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemDataPermissionsWorkbenchPageProps) {
  // The data-permissions catalog is a single endpoint that returns roles plus
  // summary/riskTips/readOnlyNotice. The catalog hook drives loading/error and
  // owns the roles list; pagination is client-side because the endpoint returns
  // the full role set in one shot. The non-list fields are surfaced through a
  // ref that `listFn` populates, mirrored into state for rendering.
  const catalogMetaRef = useRef<DataPermissionCatalog>(emptyCatalog());
  const [catalogMeta, setCatalogMeta] = useState<DataPermissionCatalog>(emptyCatalog());

  const [keyword, setKeyword] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [depts, setDepts] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    listAssignableDepts()
      .then((tree) => {
        if (!cancelled) setDepts(flattenDepts(tree));
      })
      .catch(() => {
        if (!cancelled) setDepts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canView]);

  const {
    records: roles,
    loading,
    error,
    page,
    setPage,
    reload,
  } = useCatalogPage<RoleDataScope>({
    listFn: async () => {
      const next = await getDataPermissionCatalog();
      const safe = next ?? emptyCatalog();
      catalogMetaRef.current = safe;
      return { records: safe.roles ?? [], total: (safe.roles ?? []).length };
    },
    canView,
  });

  // Mirror the latest catalog meta (summary / riskTips / readOnlyNotice) into
  // state whenever a fresh role set arrives from the hook.
  useEffect(() => {
    setCatalogMeta(catalogMetaRef.current);
  }, [roles]);

  const visibleRoles = useMemo(
    () => roles.filter((r) => matchesScope(r, scopeFilter) && matchesKeyword(r, keyword)),
    [roles, scopeFilter, keyword],
  );

  // Reset to the first page whenever the filter or the underlying role set
  // changes so the user never lands on an out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [keyword, scopeFilter, roles, setPage]);

  const totalPages = Math.max(1, Math.ceil(visibleRoles.length / 20));
  const safePage = Math.min(page, totalPages);
  const pagedRoles = useMemo(
    () => visibleRoles.slice((safePage - 1) * 20, safePage * 20),
    [visibleRoles, safePage],
  );

  const handlePrevPage = () => {
    setPage(Math.max(1, page - 1));
  };

  const handleNextPage = () => {
    setPage(Math.min(totalPages, page + 1));
  };

  const handleScopeChange = async (role: RoleDataScope, nextScope: string) => {
    if (nextScope === role.dataScope) return;
    setSavingRoleId(role.roleId);
    setSaveError(null);
    try {
      await updateDataPermissionScope(role.roleId, nextScope);
      reload();
    } catch {
      setSaveError('敏感细节已脱敏');
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleDeptToggle = async (role: RoleDataScope, deptId: number, checked: boolean) => {
    const current = role.customDeptIds ?? [];
    const next = checked ? [...new Set([...current, deptId])] : current.filter((id) => id !== deptId);
    setSavingRoleId(role.roleId);
    setSaveError(null);
    try {
      await updateDataPermissionDepts(role.roleId, next);
      reload();
    } catch {
      setSaveError('敏感细节已脱敏');
    } finally {
      setSavingRoleId(null);
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问数据权限，请确认 system:role-permission:query 权限。
        </div>
      </section>
    );
  }

  const emptyMessage = roles.length === 0 ? '暂无角色数据范围。' : '没有符合条件的角色数据范围。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">数据权限</h3>
          <p className="mt-1 text-sm text-slate-500">展示并收紧角色 dataScope；CUSTOM 部门规则仍未接入。</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
          type="button"
          onClick={reload}
        >
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        可调整角色数据范围，并为 CUSTOM 配置部门清单。写入需 system:role-permission:edit。查询运行时仍未按部门清单过滤。
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">角色总数</h3>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{catalogMeta.summary.roleCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">全部数据（ALL）</h3>
          <p className="mt-2 text-2xl font-semibold text-red-600">{catalogMeta.summary.allScopeCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">已收紧范围</h3>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{catalogMeta.summary.restrictedScopeCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">自定义（CUSTOM）</h3>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{catalogMeta.summary.customScopeCount}</p>
        </div>
      </div>

      {(catalogMeta.riskTips ?? []).length > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">风险提示</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {catalogMeta.riskTips.map((tip) => <li key={tip}>{tip}</li>)}
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
      {saveError ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">数据权限加载中...</div> : null}
      {!loading && !error && visibleRoles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">角色数据范围</h4>
          <span className="text-xs text-slate-500">显示 {visibleRoles.length} / {roles.length} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">角色编码</th>
                <th scope="col" className="py-2 pr-3">角色名称</th>
                <th scope="col" className="py-2 pr-3">数据范围</th>
                <th scope="col" className="py-2 pr-3">风险说明</th>
                <th scope="col" className="py-2 pr-3">自定义部门</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedRoles.map((role) => (
                <tr key={role.roleId}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{role.roleCode}</td>
                  <td className="py-2 pr-3 text-slate-600">{role.roleName}</td>
                  <td className="py-2 pr-3">
                    <label className="sr-only" htmlFor={`data-scope-${role.roleId}`}>{role.roleName}数据范围</label>
                    <select
                      id={`data-scope-${role.roleId}`}
                      aria-label={`${role.roleName}数据范围`}
                      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-400 ${scopeBadgeClass(role.dataScope)}`}
                      disabled={savingRoleId === role.roleId}
                      value={role.dataScope}
                      onChange={(event) => {
                        void handleScopeChange(role, event.target.value);
                      }}
                    >
                      {WRITABLE_SCOPES.map((scope) => (
                        <option key={scope.value} value={scope.value}>{scope.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{role.riskNote || '-'}</td>
                  <td className="py-2 pr-3 text-xs text-slate-500">
                    {role.dataScope === 'CUSTOM' ? (
                      <fieldset className="space-y-1" disabled={savingRoleId === role.roleId}>
                        <legend className="sr-only">{role.roleName}自定义部门</legend>
                        {depts.length === 0 ? <span>暂无部门可选</span> : depts.map((dept) => (
                          <label key={dept.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              aria-label={`${role.roleName}部门${dept.name}`}
                              checked={(role.customDeptIds ?? []).includes(dept.id)}
                              onChange={(event) => {
                                void handleDeptToggle(role, dept.id, event.target.checked);
                              }}
                            />
                            <span>{dept.name}</span>
                          </label>
                        ))}
                      </fieldset>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CatalogPagination
          page={safePage}
          totalPages={totalPages}
          loading={loading}
          onPrev={handlePrevPage}
          onNext={handleNextPage}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <h3 className="text-xs font-medium text-slate-500">边界提示</h3>
        <p className="mt-1">{catalogMeta.readOnlyNotice}</p>
      </div>
    </section>
  );
}
