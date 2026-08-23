import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  listUserManagement,
  type UserManagementPage,
  type UserManagementRecord,
} from '../../api/userManagement';

type SystemUserManagementWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type StatusFilter = 'all' | 'enabled' | 'disabled';

const emptyUserPage: UserManagementPage = {
  records: [],
  total: 0,
  size: 50,
  current: 1,
  pages: 0,
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

export default function SystemUserManagementWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemUserManagementWorkbenchPageProps) {
  const [page, setPage] = useState<UserManagementPage>(emptyUserPage);
  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async (keyword: string) => {
    setLoading(true);
    setError(null);
    try {
      const nextPage = await listUserManagement({ page: 1, pageSize: 50, keyword });
      setPage(nextPage);
    } catch {
      setPage(emptyUserPage);
      setError('用户列表加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadUsers('');
  }, [canView]);

  const visibleUsers = useMemo(
    () => page.records.filter((user: UserManagementRecord) => matchesStatus(user.status, statusFilter)),
    [page.records, statusFilter],
  );

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const keyword = keywordInput.trim();
    setActiveKeyword(keyword);
    void loadUsers(keyword);
  };

  const handleReload = () => {
    void loadUsers(activeKeyword);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问用户管理，请确认 system:user:query 权限。
        </div>
      </section>
    );
  }

  const emptyMessage = page.records.length === 0 ? '暂无用户数据。' : '没有符合条件的用户。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">用户管理</h3>
          <h3 className="mt-1 text-sm font-medium text-slate-500">只读展示 /user-management/list 返回的用户，搜索调用后端 keyword，状态筛选在前端结果内完成。</h3>
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

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="user-management-keyword">用户关键词</label>
        <input
          id="user-management-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按账号、姓名、电话搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="user-management-status-filter">状态筛选</label>
        <select
          id="user-management-status-filter"
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
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">用户列表加载中...</div> : null}
      {!loading && !error && visibleUsers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">用户列表</h4>
          <span className="text-xs text-slate-500">显示 {visibleUsers.length} / {page.records.length} 条，后端总数 {page.total}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">账号</th>
                <th scope="col" className="py-2 pr-3">姓名</th>
                <th scope="col" className="py-2 pr-3">电话</th>
                <th scope="col" className="py-2 pr-3">邮箱</th>
                <th scope="col" className="py-2 pr-3">部门 ID</th>
                <th scope="col" className="py-2 pr-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{user.username}</td>
                  <td className="py-2 pr-3 text-slate-600">{user.realName ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{user.phone ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{user.email ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{user.deptId ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{statusLabel(user.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
