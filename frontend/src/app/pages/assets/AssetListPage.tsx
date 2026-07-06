/**
 * AssetListPage — 资产列表页面（真实 API 集成）
 *
 * SWARM-049: 展示资产列表，支持搜索过滤、分页、新建/编辑/删除操作。
 * 通过 useAssetList hook 与真实后端 API 对接。
 *
 * SWARM-066: Refactored to use extracted AssetSearchBar and AssetStatusBadge
 * components for reuse across the application.
 *
 * @module pages/assets/AssetListPage
 * @since SWARM-049
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Eye,
  Upload,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAssetList, useAssetMutation } from '../../hooks/useAssets';
import type { AssetListQueryParams } from '../../services/assetService';
import type { ExportQueryParams } from '../../services/importExportApi';
import { AssetSearchBar } from './components/AssetSearchBar';
import { AssetStatusBadge } from './components/AssetStatusBadge';
import AssetImportDialog from './AssetImportDialog';
import AssetExportDialog from './AssetExportDialog';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** 默认分页大小 */
const DEFAULT_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetListPage — 资产列表页面
 *
 * 提供资产列表的展示、搜索过滤、新建/编辑/查看详情/删除功能。
 * 通过 useAssetList hook 与后端 API 进行真实对接。
 * 使用 AssetSearchBar 和 AssetStatusBadge 提取组件实现复用。
 *
 * @returns React 组件
 */
export default function AssetListPage() {
  const navigate = useNavigate();

  // -- 列表 hook ----------------------------------------------------------
  const { assets, total, loading, error, fetchAssets, refresh } = useAssetList();

  // -- 删除 mutation hook -------------------------------------------------
  const { remove, loading: deleting } = useAssetMutation();

  // -- 本地筛选状态 -------------------------------------------------------
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);

  // -- 导入/导出弹窗状态 -------------------------------------------------
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  /** 总页数 */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /**
   * 导出弹窗使用的筛选条件（稳定引用）
   *
   * @description 1:1 复用当前列表页的筛选状态，禁止在导出弹窗中二次要求用户填写
   */
  const exportFilters: ExportQueryParams = useMemo(() => {
    const filters: ExportQueryParams = { page, pageSize };
    if (keyword) filters.keyword = keyword;
    if (statusFilter) filters.status = statusFilter;
    return filters;
  }, [page, pageSize, keyword, statusFilter]);

  /**
   * 加载资产列表
   */
  const loadData = useCallback(() => {
    const params: AssetListQueryParams = { page, pageSize };
    if (keyword) params.keyword = keyword;
    if (statusFilter) params.status = statusFilter;
    fetchAssets(params);
  }, [page, pageSize, keyword, statusFilter, fetchAssets]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * 处理搜索提交 — 重置分页到第一页
   */
  const handleSearch = useCallback(() => {
    setPage(1);
  }, []);

  /**
   * 处理状态过滤变更
   *
   * @param value - 新状态值
   */
  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  /**
   * 处理分页翻页
   *
   * @param newPage - 目标页码
   */
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  /**
   * 跳转至新建资产页面
   */
  const handleCreate = useCallback(() => {
    navigate('/assets/new');
  }, [navigate]);

  /**
   * 跳转至查看资产详情
   *
   * @param id - 资产 ID
   */
  const handleView = useCallback((id: number | string) => {
    navigate(`/assets/${id}`);
  }, [navigate]);

  /**
   * 跳转至编辑资产页面
   *
   * @param id - 资产 ID
   */
  const handleEdit = useCallback((id: number | string) => {
    navigate(`/assets/${id}/edit`);
  }, [navigate]);

  /**
   * 处理删除资产
   *
   * @param id - 资产 ID
   */
  const handleDelete = useCallback(async (id: number | string) => {
    if (!window.confirm('确认删除该资产？此操作不可恢复。')) return;

    const success = await remove(id);
    if (success) {
      toast.success('资产删除成功');
      refresh();
    }
  }, [remove, refresh]);

  // ---- Render ------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 py-8" data-testid="asset-list-page">
      {/* 页面标题 + 操作按钮 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">资产列表</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportDialogOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg border border-gray-200 bg-white text-gray-700
              hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="btn-import-assets"
          >
            <Upload className="w-4 h-4" />
            批量导入
          </button>
          <button
            type="button"
            onClick={() => setExportDialogOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg border border-gray-200 bg-white text-gray-700
              hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="btn-export-assets"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg bg-blue-600 text-white hover:bg-blue-700
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="btn-create-asset"
          >
            <Plus className="w-4 h-4" />
            新建资产
          </button>
        </div>
      </div>

      {/* 搜索和过滤 — 使用提取的 AssetSearchBar 组件 */}
      <AssetSearchBar
        keyword={keyword}
        onKeywordChange={setKeyword}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        onSearch={handleSearch}
        onRefresh={refresh}
        loading={loading}
      />

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
          data-testid="error-message"
        >
          {error}
        </div>
      )}

      {/* 资产列表表格 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-[#1e3a5f]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                资产编号
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                资产名称
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                分类
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                位置
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                部门
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                购置日期
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                购置价格
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#1e3a5f]">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  加载中...
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  暂无数据
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                    {asset.assetNo ?? asset.assetCode ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {asset.assetName ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {asset.categoryName ?? (asset.categoryId != null ? String(asset.categoryId) : '-')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {asset.location ?? asset.locationName ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {asset.departmentName ?? (asset.deptId != null ? String(asset.deptId) : '-')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {asset.purchaseDate ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">
                    {(asset.originalValue ?? asset.purchasePrice) != null
                      ? `¥${(asset.originalValue ?? asset.purchasePrice)!.toLocaleString()}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <AssetStatusBadge status={asset.status} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleView(asset.id)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="查看详情"
                        data-testid={`btn-view-${asset.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(asset.id)}
                        className="text-gray-500 hover:text-gray-800 transition-colors"
                        title="编辑"
                        data-testid={`btn-edit-${asset.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(asset.id)}
                        disabled={deleting}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                        title="删除"
                        data-testid={`btn-delete-${asset.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {total > 0 && (
        <div className="mt-4 flex items-center justify-between" data-testid="pagination">
          <p className="text-sm text-gray-500">
            共 {total} 条记录，第 {page}/{totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm
                rounded border border-gray-200 bg-white hover:bg-gray-50
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="btn-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
              上一页
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm
                rounded border border-gray-200 bg-white hover:bg-gray-50
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="btn-next-page"
            >
              下一页
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 批量导入弹窗 */}
      <AssetImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImportSuccess={() => {
          setPage(1);
          refresh();
        }}
      />

      {/* 导出弹窗 */}
      <AssetExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        currentFilters={exportFilters}
      />
    </div>
  );
}
