import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getDeptTree, listDepts, type DeptListNode, type DeptTreeNode } from '../../api/depts';

type SystemDeptOrgWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type StatusFilter = 'all' | 'enabled' | 'disabled';

function nodeName(node: DeptListNode | DeptTreeNode) {
  const listNode = node as DeptListNode;
  return listNode.dept_name ?? listNode.deptName ?? node.name ?? '-';
}

function nodeCode(node: DeptListNode) {
  return node.dept_code ?? node.deptCode ?? '-';
}

function nodeParentId(node: DeptListNode | DeptTreeNode) {
  const listNode = node as DeptListNode;
  return listNode.parent_id ?? node.parentId ?? null;
}

function nodeSort(node: DeptListNode | DeptTreeNode) {
  const listNode = node as DeptListNode;
  return listNode.sort_order ?? listNode.sortOrder ?? node.orderNum ?? null;
}

function statusValue(status: string | number | null | undefined) {
  return String(status ?? '').trim();
}

function statusLabel(status: string | number | null | undefined) {
  const value = statusValue(status);
  if (value === '0' || value === '1' || value === '正常') {
    return '正常';
  }
  if (value === '2' || value === '停用') {
    return '停用';
  }
  return '未知';
}

function matchesStatus(status: string | number | null | undefined, filter: StatusFilter) {
  const value = statusValue(status);
  if (filter === 'enabled') {
    return value === '0' || value === '1' || value === '正常';
  }
  if (filter === 'disabled') {
    return value === '2' || value === '停用';
  }
  return true;
}

function flattenDeptList(nodes: DeptListNode[]): DeptListNode[] {
  return nodes.flatMap((node) => [node, ...flattenDeptList(node.children ?? [])]);
}

function rootTreeNodes(nodes: DeptTreeNode[]) {
  return nodes.filter((node) => {
    const parentId = nodeParentId(node);
    return parentId == null || Number(parentId) === 0;
  });
}

export default function SystemDeptOrgWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemDeptOrgWorkbenchPageProps) {
  const [deptNodes, setDeptNodes] = useState<DeptListNode[]>([]);
  const [treeNodes, setTreeNodes] = useState<DeptTreeNode[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadDepts = async (keyword: string) => {
    setLoading(true);
    setError(null);
    try {
      const [nextDepts, nextTree] = await Promise.all([listDepts({ keyword }), getDeptTree()]);
      setDeptNodes(nextDepts);
      setTreeNodes(nextTree);
    } catch {
      setDeptNodes([]);
      setTreeNodes([]);
      setError('部门组织加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadDepts('');
  }, [canView]);

  const flatDepts = useMemo(() => flattenDeptList(deptNodes), [deptNodes]);
  const visibleDepts = useMemo(
    () => flatDepts.filter((dept) => matchesStatus(dept.status, statusFilter)),
    [flatDepts, statusFilter],
  );
  const rootNodes = useMemo(() => rootTreeNodes(treeNodes), [treeNodes]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const keyword = keywordInput.trim();
    setActiveKeyword(keyword);
    void loadDepts(keyword);
  };

  const handleReload = () => {
    void loadDepts(activeKeyword);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问部门组织，请确认 system:dept:query 权限。
        </div>
      </section>
    );
  }

  const emptyMessage = flatDepts.length === 0 ? '暂无部门组织数据。' : '没有符合条件的部门。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">部门组织</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示 /depts/list 与 /depts/tree 返回的组织部门，搜索调用列表接口，状态筛选在前端结果内完成。</p>
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
        <label className="sr-only" htmlFor="dept-org-keyword">部门关键词</label>
        <input
          id="dept-org-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按名称或编码搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="dept-org-status-filter">状态筛选</label>
        <select
          id="dept-org-status-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="all">全部状态</option>
          <option value="enabled">正常</option>
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
      {loading ? <div className="text-sm text-slate-500">部门组织加载中...</div> : null}
      {!loading && !error && visibleDepts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">部门列表</h4>
            <span className="text-xs text-slate-500">显示 {visibleDepts.length} / {flatDepts.length} 条</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-3">名称</th>
                  <th className="py-2 pr-3">编码</th>
                  <th className="py-2 pr-3">父级 ID</th>
                  <th className="py-2 pr-3">排序</th>
                  <th className="py-2 pr-3">负责人</th>
                  <th className="py-2 pr-3">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleDepts.map((dept) => (
                  <tr key={dept.id}>
                    <td className="py-2 pr-3 font-medium text-slate-800">{nodeName(dept)}</td>
                    <td className="py-2 pr-3 text-slate-600">{nodeCode(dept)}</td>
                    <td className="py-2 pr-3 text-slate-500">{nodeParentId(dept) ?? '根部门'}</td>
                    <td className="py-2 pr-3 text-slate-500">{nodeSort(dept) ?? '-'}</td>
                    <td className="py-2 pr-3 text-slate-500">{dept.leader ?? '-'}</td>
                    <td className="py-2 pr-3 text-slate-500">{statusLabel(dept.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-3 font-semibold">根部门摘要</h4>
          {rootNodes.length > 0 ? (
            <ul className="space-y-2 text-sm text-slate-600">
              {rootNodes.map((dept) => (
                <li key={dept.id} className="rounded-xl bg-white px-3 py-2">
                  <span className="font-medium text-slate-800">{nodeName(dept)}</span>
                  <span className="ml-2 text-xs text-slate-500">ID {dept.id}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">暂无根部门。</p>
          )}
        </div>
      </div>
    </section>
  );
}
