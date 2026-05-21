/**
 * AssetListPage — 资产列表页（三栏布局重构版）
 *
 * 布局：分类树侧边栏（可拖拽）| 工具栏 + 数据表格 + 分页
 * 交互参考：企业设备管理 SaaS 截图（GLM-4V 识别结果）
 *
 * @module pages/asset/AssetListPage
 * @since SWARM-025 → 三栏重构
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Loader2, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { assetService } from '../../services/assetService';
import type { AssetRecord } from '../../services/assetService';
import type { AssetExportParams } from '../AssetBatchImportPage';
import { CategoryPanel } from '../../components/CategoryPanel';
import { AssetToolbar } from '../../components/AssetToolbar';
import { getAssetStatusMeta } from '../../constants/assetStatus';

/* ------------------------------------------------------------------ */
/*  常量 & 类型                                                        */
/* ------------------------------------------------------------------ */

export interface AssetListQueryParams {
  keyword?: string;
  status?: string;
  categoryId?: string;
  departmentId?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;

/** localStorage key：分类面板折叠状态 */
const PANEL_COLLAPSED_KEY = 'panel-assets-category-collapsed';

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

export default function AssetListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /* ── 数据状态 ── */
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);
  const [assets,    setAssets]    = useState<AssetRecord[]>([]);
  const [total,     setTotal]     = useState(0);

  /* ── 选择状态 ── */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  /* ── 视图模式 ── */
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  /* ── 分类面板折叠 ── */
  const [categoryCollapsed, setCategoryCollapsed] = useState(
    () => localStorage.getItem(PANEL_COLLAPSED_KEY) === 'true'
  );

  /* ── URL 参数同步 ── */
  const keyword    = searchParams.get('keyword')  ?? '';
  const status     = searchParams.get('status')   ?? '';
  const categoryCode = searchParams.get('categoryCode') ?? null;
  const page       = parseInt(searchParams.get('page')     ?? '1',  10);
  const pageSize   = parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /* ---------------------------------------------------------------- */
  /*  数据获取                                                         */
  /* ---------------------------------------------------------------- */

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, pageSize };
      if (keyword)      params.keyword      = keyword;
      if (status)       params.status       = status;
      if (categoryCode) params.categoryCode = categoryCode;

      const paged = await assetService.list(params);
      setAssets(paged?.records ?? []);
      setTotal(paged?.total ?? 0);
      setSelectedIds(new Set()); // 翻页/刷新清空选择
    } catch (err) {
      const msg = err instanceof Error ? err.message : '获取资产列表失败';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, status, categoryCode]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  /* ---------------------------------------------------------------- */
  /*  搜索 / 过滤 / 分页                                              */
  /* ---------------------------------------------------------------- */

  const setParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value); else next.delete(key);
        if (key !== 'page') next.set('page', '1');
        return next;
      });
    },
    [setSearchParams]
  );

  const handleCategorySelect = useCallback(
    (code: string | null) => setParam('categoryCode', code),
    [setParam]
  );

  const handleKeyword = useCallback(
    (kw: string) => setParam('keyword', kw || null),
    [setParam]
  );

  const handlePageChange = useCallback(
    (p: number) => setParam('page', String(p)),
    [setParam]
  );

  /* ---------------------------------------------------------------- */
  /*  选择                                                             */
  /* ---------------------------------------------------------------- */

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === assets.length
        ? new Set()
        : new Set(assets.map((a) => a.id))
    );
  }, [assets]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /* ---------------------------------------------------------------- */
  /*  导出                                                             */
  /* ---------------------------------------------------------------- */

  const exportParams: AssetExportParams = useMemo(() => {
    const p: AssetExportParams = {};
    searchParams.forEach((v, k) => { if (v) p[k] = v; });
    return p;
  }, [searchParams]);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const response = await assetService.export(exportParams);
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
      const disposition = response.headers?.['content-disposition'];
      let filename = `assets_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      if (typeof disposition === 'string') {
        const m = disposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)/i);
        if (m) filename = decodeURIComponent(m[1].replace(/["']/g, ''));
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }, [exportParams, exporting]);

  /* ---------------------------------------------------------------- */
  /*  面板折叠持久化                                                   */
  /* ---------------------------------------------------------------- */

  const handlePanelCollapse = useCallback((collapsed: boolean) => {
    setCategoryCollapsed(collapsed);
    localStorage.setItem(PANEL_COLLAPSED_KEY, String(collapsed));
  }, []);

  /* ---------------------------------------------------------------- */
  /*  渲染                                                             */
  /* ---------------------------------------------------------------- */

  const allSelected = assets.length > 0 && selectedIds.size === assets.length;
  const partialSelected = selectedIds.size > 0 && selectedIds.size < assets.length;

  return (
    /* 去掉外层 container padding，撑满父级 main 内容区 */
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 lg:-m-6 overflow-hidden">
      {/* 页面顶部标题行 */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">资产台账</h1>
        <span className="text-sm text-gray-400">共 {total.toLocaleString()} 条</span>
      </div>

      {/* 三栏 PanelGroup */}
      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {/* ── Panel 1：分类树 ── */}
        <Panel
          defaultSize={18}
          minSize={12}
          maxSize={30}
          collapsible
          onCollapse={() => handlePanelCollapse(true)}
          onExpand={() => handlePanelCollapse(false)}
          style={{ minWidth: 0 }}
        >
          <CategoryPanel
            selectedCode={categoryCode}
            onSelect={handleCategorySelect}
          />
        </Panel>

        {/* 拖拽分隔线 */}
        <PanelResizeHandle className="w-1 bg-blue-50 hover:bg-blue-300 transition-colors cursor-col-resize flex-shrink-0" />

        {/* ── Panel 2：工具栏 + 表格 + 分页 ── */}
        <Panel defaultSize={82} minSize={50} style={{ minWidth: 0 }}>
          <div className="flex flex-col h-full overflow-hidden">

            {/* 工具栏 */}
            <AssetToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              keyword={keyword}
              onKeywordChange={handleKeyword}
              selectedCount={selectedIds.size}
              onClearSelection={() => setSelectedIds(new Set())}
              onRefresh={fetchAssets}
              loading={loading}
              onNew={() => navigate('/assets/new')}
              onExport={handleExport}
              exporting={exporting}
              onImport={() => navigate('/assets/batch-import')}
              onDeleteSelected={() => toast.info('批量删除功能待实现')}
            />

            {/* 表格 */}
            <div className="flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-[#1e3a5f] text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {/* checkbox 全选 */}
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = partialSelected; }}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-200 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">资产编号</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">资产名称</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">分类</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">位置</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">部门</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">购置日期</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">购置价格</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">状态</th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-[#1e3a5f]">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        加载中...
                      </td>
                    </tr>
                  ) : assets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center">
                        <Inbox className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">暂无数据</p>
                        <p className="text-xs text-slate-600 mt-1">尝试调整筛选条件或新建资产</p>
                      </td>
                    </tr>
                  ) : (
                    assets.map((asset) => {
                      const isSelected = selectedIds.has(asset.id);
                      const statusMeta = getAssetStatusMeta(asset.status);
                      return (
                        <tr
                          key={asset.id}
                          onClick={() => toggleSelect(asset.id)}
                          className={[
                            'cursor-pointer transition-colors',
                            isSelected
                              ? 'bg-blue-50'
                              : 'hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <td className="w-10 px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(asset.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-gray-200 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-2.5 font-mono text-gray-900 whitespace-nowrap">
                            {asset.assetCode ?? '-'}
                          </td>
                          <td className="px-4 py-2.5 text-gray-900 font-medium">
                            {asset.assetName ?? '-'}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">{asset.categoryName ?? '-'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{asset.locationName  ?? '-'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{asset.departmentName ?? '-'}</td>
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{asset.purchaseDate ?? '-'}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-right whitespace-nowrap">
                            {asset.purchasePrice != null
                              ? `¥${asset.purchasePrice.toLocaleString()}`
                              : '-'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusMeta.badgeClass}`}>
                              {statusMeta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            <div className="flex items-center justify-between px-4 h-12 border-t border-gray-200 bg-white flex-shrink-0">
              <p className="text-sm text-gray-400">
                共 <span className="font-medium text-gray-700">{total.toLocaleString()}</span> 条，
                第 {page} / {totalPages} 页
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 h-8 px-2.5 text-sm rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一页
                </button>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 h-8 px-2.5 text-sm rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  下一页
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
