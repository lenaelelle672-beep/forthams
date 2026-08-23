import { FormEvent, useEffect, useState } from 'react';
import {
  getAssetCategoryTree,
  listAssetCategories,
  type AssetCategoryPage,
  type AssetCategoryTreeNode,
} from '../../api/assetCategories';

type SystemAssetCategoryWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const emptyPage: AssetCategoryPage = {
  records: [],
  total: 0,
  size: 50,
  current: 1,
  pages: 0,
};

function renderTree(nodes: AssetCategoryTreeNode[]) {
  if (nodes.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2">
      {nodes.map((node) => (
        <li key={node.id} className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-slate-800">{node.categoryName}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{node.categoryCode}</span>
          </div>
          {node.children && node.children.length > 0 ? <div className="mt-3 pl-4">{renderTree(node.children)}</div> : null}
        </li>
      ))}
    </ul>
  );
}

export default function SystemAssetCategoryWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemAssetCategoryWorkbenchPageProps) {
  const [page, setPage] = useState<AssetCategoryPage>(emptyPage);
  const [tree, setTree] = useState<AssetCategoryTreeNode[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = async (keyword: string) => {
    setLoading(true);
    setError(null);
    try {
      const [nextPage, nextTree] = await Promise.all([
        listAssetCategories({ page: 1, pageSize: 50, keyword }),
        getAssetCategoryTree(),
      ]);
      setPage(nextPage);
      setTree(nextTree);
    } catch {
      setPage(emptyPage);
      setTree([]);
      setError('资产分类加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadCategories('');
  }, [canView]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const keyword = keywordInput.trim();
    setActiveKeyword(keyword);
    void loadCategories(keyword);
  };

  const handleReload = () => {
    void loadCategories(activeKeyword);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问资产分类，请确认 asset:category:query 权限。
        </div>
      </section>
    );
  }

  const hasRecords = page.records.length > 0;
  const hasTree = tree.length > 0;

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">资产分类</h3>
          <h3 className="mt-1 text-sm font-medium text-slate-500">只读展示分类列表与分类树，搜索仅调用 /categories/list 查询能力。</h3>
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

      <form className="flex flex-wrap gap-2" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="asset-category-keyword">分类关键词</label>
        <input
          id="asset-category-keyword"
          className="min-w-64 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按名称或编码搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loading}
          type="submit"
        >
          搜索
        </button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">资产分类加载中...</div> : null}
      {!loading && !error && !hasRecords && !hasTree ? (
        <h3 className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-medium text-slate-500">暂无资产分类数据。</h3>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">分类列表</h4>
            <span className="text-xs text-slate-500">共 {page.total} 条</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th scope="col" className="py-2 pr-3">名称</th>
                  <th scope="col" className="py-2 pr-3">编码</th>
                  <th scope="col" className="py-2 pr-3">父级 ID</th>
                  <th scope="col" className="py-2 pr-3">排序</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {page.records.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3 font-medium text-slate-800">{item.categoryName}</td>
                    <td className="py-2 pr-3 text-slate-600">{item.categoryCode}</td>
                    <td className="py-2 pr-3 text-slate-500">{item.parentId ?? '根分类'}</td>
                    <td className="py-2 pr-3 text-slate-500">{item.sortOrder ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-3 font-semibold">分类树</h4>
          {hasTree ? renderTree(tree) : <h3 className="text-sm font-medium text-slate-500">暂无分类树节点。</h3>}
        </div>
      </div>
    </section>
  );
}
