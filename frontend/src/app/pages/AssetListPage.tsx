/**
 * AssetListPage — 资产列表页面
 *
 * 展示资产列表，支持搜索过滤、条件导出和跳转至批量导入页面。
 * 导出功能必须携带当前页面所有的 Query Params（包括搜索词、
 * 过滤条件、分页状态对应的范围）作为 API 请求参数，由后端生成文件流，
 * 前端只负责触发浏览器下载。
 *
 * @module pages/AssetListPage
 * @since SWARM-019
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Upload,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../utils/api';
import { AssetExportButton } from '../components/asset/AssetExportButton';
import { AssetBatchImportDialog } from '../components/asset/AssetBatchImportDialog';
import type { AssetExportParams } from '../hooks/useAssetImportExport';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/**
 * 资产列表查询参数
 *
 * @description 资产列表查询和导出共享的参数结构
 */
export interface AssetListQueryParams {
  /** 搜索关键词 */
  keyword?: string;
  /** 资产状态过滤 */
  status?: string;
  /** 分类 ID 过滤 */
  categoryId?: string;
  /** 部门 ID 过滤 */
  departmentId?: string;
  /** 页码（从 1 开始） */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
}

/**
 * 资产记录接口
 *
 * @description 资产列表中的单条记录
 */
interface AssetRecord {
  id: number;
  assetCode?: string;
  assetName?: string;
  categoryName?: string;
  locationName?: string;
  departmentName?: string;
  status?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  [key: string]: unknown;
}

/**
 * 分页结果接口
 *
 * @description 后端返回的分页数据结构
 */
interface PagedResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

/**
 * 资产状态映射配置
 */
const STATUS_MAP: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVE: { label: '在用', className: 'bg-green-100 text-green-800' },
  IDLE: { label: '闲置', className: 'bg-yellow-100 text-yellow-800' },
  MAINTENANCE: { label: '维保中', className: 'bg-blue-100 text-blue-800' },
  SCRAPPED: { label: '已报废', className: 'bg-red-100 text-red-800' },
};

/** 默认分页大小 */
const DEFAULT_PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * AssetListPage — 资产列表页面
 *
 * 提供资产列表的展示、搜索过滤、条件导出功能。
 * 导出按钮携带当前所有过滤条件调用后端 API，由后端生成文件流下载。
 * 包含跳转至批量导入页面的入口按钮。
 *
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <Route path="/assets" element={<AssetListPage />} />
 * ```
 */
export default function AssetListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  /** 列表加载状态 */
  const [loading, setLoading] = useState(false);

  /** 批量导入对话框状态 */
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /** 资产列表数据 */
  const [assets, setAssets] = useState<AssetRecord[]>([]);

  /** 总记录数 */
  const [total, setTotal] = useState(0);

  /**
   * 从 URL Search Params 同步的过滤状态
   */
  const keyword = searchParams.get('keyword') ?? '';
  const status = searchParams.get('status') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10);

  /** 总页数 */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /**
   * 获取资产列表
   *
   * @description 从 URL params 读取过滤条件，调用后端 API 获取分页数据
   */
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (status) params.status = status;

      const response = await apiClient.get<PagedResult<AssetRecord>>(
        '/assets/list',
        { params },
      );
      // apiClient 直接返回 response.data (ApiResponse.data)，但此处直接用 axios 实例
      const data = response.data;
      // 处理 apiClient 的包装和直接 axios 两种情况
      const paged = (data as any)?.data ?? data;
      setAssets(paged?.records ?? []);
      setTotal(paged?.total ?? 0);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '获取资产列表失败';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, status]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  /**
   * 构建当前导出参数
   *
   * @description 携带当前页面所有的 Query Params 作为导出 API 请求参数
   */
  const exportParams: AssetExportParams = useMemo(() => {
    const params: AssetExportParams = {};
    if (keyword) params.keyword = keyword;
    if (status) params.status = status;
    // 将所有 URL search params 传递给导出 API
    searchParams.forEach((value, key) => {
      if (value) {
        params[key] = value;
      }
    });
    return params;
  }, [keyword, status, searchParams]);

  /**
   * 处理搜索
   *
   * @param newKeyword - 搜索关键词
   */
  const handleSearch = useCallback(
    (newKeyword: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (newKeyword) {
          next.set('keyword', newKeyword);
        } else {
          next.delete('keyword');
        }
        next.set('page', '1');
        return next;
      });
    },
    [setSearchParams],
  );

  /**
   * 处理状态过滤
   *
   * @param newStatus - 状态值
   */
  const handleStatusFilter = useCallback(
    (newStatus: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (newStatus) {
          next.set('status', newStatus);
        } else {
          next.delete('status');
        }
        next.set('page', '1');
        return next;
      });
    },
    [setSearchParams],
  );

  /**
   * 处理分页翻页
   *
   * @param newPage - 目标页码
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(newPage));
        return next;
      });
    },
    [setSearchParams],
  );

  /**
   * 渲染状态徽标
   *
   * @param assetStatus - 资产状态值
   * @returns React 节点
   */
  const renderStatusBadge = (assetStatus: string | undefined) => {
    const config = STATUS_MAP[assetStatus ?? ''] ?? {
      label: assetStatus ?? '-',
      className: 'bg-gray-100 text-gray-800',
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
      >
        {config.label}
      </span>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 + 操作按钮 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">资产列表</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setImportDialogOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg border border-gray-300 bg-white text-gray-700
              hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            批量导入
          </button>
          <AssetExportButton params={exportParams} />
        </div>
      </div>

      {/* 批量导入对话框 */}
      <AssetBatchImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onSuccess={() => {
          fetchAssets();
        }}
      />

      {/* 搜索和过滤 */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* 搜索框 */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索资产编号或名称..."
            value={keyword}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-300
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors"
          />
        </div>

        {/* 状态过滤 */}
        <select
          value={status}
          onChange={(e) => handleStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300
            bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部状态</option>
          <option value="ACTIVE">在用</option>
          <option value="IDLE">闲置</option>
          <option value="MAINTENANCE">维保中</option>
          <option value="SCRAPPED">已报废</option>
        </select>

        {/* 刷新 */}
        <button
          type="button"
          onClick={fetchAssets}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm
            rounded-lg border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 资产列表表格 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                资产编号
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                资产名称
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                分类
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                位置
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                部门
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                购置日期
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                购置价格
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  加载中...
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  暂无数据
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                    {asset.assetCode ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {asset.assetName ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {asset.categoryName ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {asset.locationName ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {asset.departmentName ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {asset.purchaseDate ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">
                    {asset.purchasePrice != null
                      ? `¥${asset.purchasePrice.toLocaleString()}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {renderStatusBadge(asset.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {total > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            共 {total} 条记录，第 {page}/{totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm
                rounded border border-gray-300 bg-white hover:bg-gray-50
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              上一页
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm
                rounded border border-gray-300 bg-white hover:bg-gray-50
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              下一页
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
