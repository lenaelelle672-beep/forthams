import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getRolePermissionCatalog,
  type RolePermissionCatalog,
  type RolePermissionCatalogPermission,
} from '../../api/rolePermissions';

type SystemMenuPermissionsWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type StatusFilter = 'all' | 'enabled' | 'disabled';

type MenuPermissionGroup = {
  groupKey: string;
  groupLabel: string;
  permissions: RolePermissionCatalogPermission[];
  enabledCount: number;
  disabledCount: number;
  boundRoleCodes: string[];
};

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
  riskTips: ['当前后端未提供 sys_menu/菜单分配接口，本页仅展示现有权限编码库存与绑定覆盖。'],
  readonlyNotice: '本页不支持菜单分配、编辑或删除，仅作为菜单权限只读目录。',
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

function domainLabel(permissionCode: string) {
  const [domain] = permissionCode.split(':');
  return domain || '未分类';
}

function buildRoleCodesByPermission(catalog: RolePermissionCatalog) {
  const roleCodesByPermission = new Map<number, string[]>();
  for (const role of catalog.roles) {
    for (const permission of role.permissions) {
      const roleCodes = roleCodesByPermission.get(permission.permissionId) ?? [];
      roleCodes.push(role.roleCode);
      roleCodesByPermission.set(permission.permissionId, roleCodes);
    }
  }
  return roleCodesByPermission;
}

function buildMenuPermissionGroups(catalog: RolePermissionCatalog, statusFilter: StatusFilter, keyword: string) {
  const normalizedKeyword = keyword.toLowerCase();
  const roleCodesByPermission = buildRoleCodesByPermission(catalog);
  const groupMap = new Map<string, MenuPermissionGroup>();

  for (const permission of catalog.permissions) {
    const roleCodes = roleCodesByPermission.get(permission.permissionId) ?? [];
    const groupKey = domainLabel(permission.permissionCode);
    const searchableText = [
      groupKey,
      permission.permissionName,
      permission.permissionCode,
      permission.description ?? '',
      roleCodes.join(' '),
    ].join(' ').toLowerCase();

    if (!matchesStatus(permission.status, statusFilter) || (normalizedKeyword && !searchableText.includes(normalizedKeyword))) {
      continue;
    }

    const group = groupMap.get(groupKey) ?? {
      groupKey,
      groupLabel: `${groupKey} 权限域`,
      permissions: [],
      enabledCount: 0,
      disabledCount: 0,
      boundRoleCodes: [],
    };
    group.permissions.push(permission);
    if (permission.status === 1) {
      group.enabledCount += 1;
    }
    if (permission.status === 0) {
      group.disabledCount += 1;
    }
    group.boundRoleCodes = Array.from(new Set([...group.boundRoleCodes, ...roleCodes])).sort();
    groupMap.set(groupKey, group);
  }

  return Array.from(groupMap.values()).sort((a, b) => a.groupKey.localeCompare(b.groupKey));
}

export default function SystemMenuPermissionsWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemMenuPermissionsWorkbenchPageProps) {
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
      setError('菜单权限目录加载失败，敏感细节已脱敏');
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

  const visibleGroups = useMemo(
    () => buildMenuPermissionGroups(catalog, statusFilter, activeKeyword),
    [catalog, statusFilter, activeKeyword],
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
          无权限访问菜单权限，请确认 system:role-permission:query 权限。
        </div>
      </section>
    );
  }

  const emptyMessage = catalog.permissions.length === 0 ? '暂无菜单权限编码目录。' : '没有符合条件的菜单权限。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-menu-permissions="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">菜单权限</h3>
          <h3 className="mt-1 text-sm font-medium text-slate-500">只读展示 /system/role-permissions/catalog 的权限编码库存，按权限域聚合为菜单权限覆盖视图。</h3>
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
        <p className="font-medium">{emptyCatalog.readonlyNotice}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {emptyCatalog.riskTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
          {(catalog.riskTips.length > 0 ? catalog.riskTips : []).map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">权限域数量</h3>
          <p className="mt-1 text-2xl font-semibold">{visibleGroups.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">权限编码库存</h3>
          <p className="mt-1 text-2xl font-semibold">{catalog.summary.permissionInventoryCount} 项</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">已绑定权限</h3>
          <p className="mt-1 text-2xl font-semibold">{catalog.summary.boundPermissionCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">未绑定权限</p>
          <p className="mt-1 text-2xl font-semibold">{catalog.summary.unboundPermissionCount}</p>
        </div>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="menu-permission-keyword">菜单权限关键词</label>
        <input
          id="menu-permission-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按权限域、权限编码或角色编码搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="menu-permission-status-filter">状态筛选</label>
        <select
          id="menu-permission-status-filter"
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
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">菜单权限目录加载中...</div> : null}
      {!loading && !error && visibleGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="space-y-4">
        {visibleGroups.map((group) => (
          <section key={group.groupKey} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold">{group.groupLabel}</h4>
                <p className="mt-1 text-sm text-slate-500">{group.permissions.length} 个权限编码，启用 {group.enabledCount} 个，停用 {group.disabledCount} 个。</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>覆盖角色</p>
                <p className="mt-1 font-medium text-slate-700">{group.boundRoleCodes.length > 0 ? group.boundRoleCodes.join('、') : '暂无绑定'}</p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 pr-3">权限编码</th>
                    <th scope="col" className="py-2 pr-3">权限名称</th>
                    <th scope="col" className="py-2 pr-3">状态</th>
                    <th scope="col" className="py-2 pr-3">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.permissions.map((permission) => (
                    <tr key={permission.permissionId}>
                      <td className="py-2 pr-3 font-medium text-slate-800">{permission.permissionCode}</td>
                      <td className="py-2 pr-3 text-slate-600">{permission.permissionName}</td>
                      <td className="py-2 pr-3 text-slate-500">{statusLabel(permission.status)}</td>
                      <td className="py-2 pr-3 text-slate-500">{permission.description || '无'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
