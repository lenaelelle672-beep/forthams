import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getRolePermissionCatalog,
  type RolePermissionCatalog,
  type RolePermissionCatalogRole,
} from '../../api/rolePermissions';

type SystemRolePermissionsWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type StatusFilter = 'all' | 'enabled' | 'disabled';

const emptyCatalog: RolePermissionCatalog = {
  roles: [],
  permissions: [],
  summary: {
    roleCount: 0,
    permissionInventoryCount: 0,
    rolePermissionBindingCount: 0,
    boundPermissionCount: 0,
    unboundPermissionCount: 0,
    rolesWithoutPermissionsCount: 0,
  },
  riskTips: ['本页不支持分配/编辑/删除，不代表菜单权限或数据权限闭环'],
  readonlyNotice: '本页不支持分配/编辑/删除，不代表菜单权限或数据权限闭环',
};

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

function matchesKeyword(role: RolePermissionCatalogRole, keyword: string) {
  if (!keyword) {
    return true;
  }
  const normalizedKeyword = keyword.toLowerCase();
  return [
    role.roleName,
    role.roleCode,
    role.description ?? '',
    ...role.permissions.flatMap((permission) => [permission.permissionName, permission.permissionCode, permission.description ?? '']),
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
}

export default function SystemRolePermissionsWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemRolePermissionsWorkbenchPageProps) {
  const [catalog, setCatalog] = useState<RolePermissionCatalog>(emptyCatalog);
  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextCatalog = await getRolePermissionCatalog();
      setCatalog(nextCatalog);
    } catch {
      setCatalog(emptyCatalog);
      setError('角色权限目录加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadCatalog();
  }, [canView]);

  const visibleRoles = useMemo(
    () => catalog.roles.filter((role) => matchesStatus(role.status, statusFilter) && matchesKeyword(role, activeKeyword)),
    [catalog.roles, statusFilter, activeKeyword],
  );

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveKeyword(keywordInput.trim());
  };

  const handleReload = () => {
    void loadCatalog();
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问角色权限，请确认 system:role-permission:query 权限。
        </div>
      </section>
    );
  }

  const emptyMessage = catalog.roles.length === 0 ? '暂无角色权限绑定目录。' : '没有符合条件的角色权限。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">角色权限</h3>
          <h3 className="mt-1 text-sm font-medium text-slate-500">只读展示 /system/role-permissions/catalog 返回的角色-权限绑定目录、权限库存与绑定数量。</h3>
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
        <p className="font-medium">{catalog.readonlyNotice || emptyCatalog.readonlyNotice}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {(catalog.riskTips.length > 0 ? catalog.riskTips : emptyCatalog.riskTips).map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">角色数量</h3>
          <p className="mt-1 text-2xl font-semibold">{catalog.summary.roleCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">权限库存</h3>
          <p className="mt-1 text-2xl font-semibold">{catalog.summary.permissionInventoryCount} 项</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">角色-权限绑定数量</h3>
          <p className="mt-1 text-2xl font-semibold">{catalog.summary.rolePermissionBindingCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">未绑定权限</h3>
          <p className="mt-1 text-2xl font-semibold">{catalog.summary.unboundPermissionCount}</p>
        </div>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="role-permission-keyword">角色权限关键词</label>
        <input
          id="role-permission-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按角色名称、编码或权限编码搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="role-permission-status-filter">状态筛选</label>
        <select
          id="role-permission-status-filter"
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
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">角色权限目录加载中...</div> : null}
      {!loading && !error && visibleRoles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">角色-权限绑定目录</h4>
            <span className="text-xs text-slate-500">显示 {visibleRoles.length} / {catalog.roles.length} 个角色</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th scope="col" className="py-2 pr-3">角色编码</th>
                  <th scope="col" className="py-2 pr-3">角色名称</th>
                  <th scope="col" className="py-2 pr-3">状态</th>
                  <th scope="col" className="py-2 pr-3">已绑定权限数量</th>
                  <th scope="col" className="py-2 pr-3">绑定权限</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRoles.map((role) => (
                  <tr key={role.roleId}>
                    <td className="py-2 pr-3 font-medium text-slate-800">{role.roleCode}</td>
                    <td className="py-2 pr-3 text-slate-600">{role.roleName}</td>
                    <td className="py-2 pr-3 text-slate-500">{statusLabel(role.status)}</td>
                    <td className="py-2 pr-3 text-slate-500">{role.permissionCount}</td>
                    <td className="py-2 pr-3 text-slate-500">
                      {role.permissions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.map((permission) => (
                            <span key={permission.permissionId} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                              {permission.permissionCode}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span>暂无绑定</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-3 font-semibold">权限库存与绑定数量</h4>
          <p className="text-sm text-slate-600">库存 {catalog.summary.permissionInventoryCount} 项，已绑定 {catalog.summary.boundPermissionCount} 项，绑定关系 {catalog.summary.rolePermissionBindingCount} 条。</p>
          <div className="mt-4 space-y-2">
            {catalog.permissions.map((permission) => (
              <div key={permission.permissionId} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                <p className="font-medium text-slate-800">{permission.permissionCode}</p>
                <p className="text-xs text-slate-500">{permission.permissionName}</p>
              </div>
            ))}
            {catalog.permissions.length === 0 ? <h3 className="text-sm font-medium text-slate-500">暂无权限库存。</h3> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
