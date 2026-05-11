/**
 * ExportConfigPanel — 资产导出配置面板组件
 *
 * 提供分类选择、状态筛选、位置选择等导出过滤条件的配置面板。
 * 纯 UI 组件，通过 onExport 回调将用户选择的过滤条件抛出。
 * 不在组件内发起任何 API 请求，所有数据通过 props 注入。
 *
 * @module components/assets/ExportConfigPanel
 * @since SWARM-043
 */

import React, { useState, useCallback } from 'react';
import { Download, Loader2, AlertTriangle } from 'lucide-react';
import type {
  AssetExportParams,
  CategoryTreeNode,
  LocationCascadeNode,
} from '../../services/assetService';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/**
 * ExportConfigPanel 组件属性
 */
export interface ExportConfigPanelProps {
  /** 分类树数据 */
  categories: CategoryTreeNode[];
  /** 位置级联数据 */
  locations: LocationCascadeNode[];
  /** 导出中状态 */
  exporting?: boolean;
  /** 执行导出回调 */
  onExport: (params: AssetExportParams) => void;
  /** 额外 CSS 类名 */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  常量                                                               */
/* ------------------------------------------------------------------ */

/**
 * 资产状态选项
 *
 * @description 预定义的状态选项列表，与后端状态枚举对齐
 */
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'IN_USE', label: '在用' },
  { value: 'IDLE', label: '闲置' },
  { value: 'MAINTENANCE', label: '维修中' },
  { value: 'SCRAPPED', label: '报废' },
];

/**
 * 递归渲染分类树为 select options
 *
 * @param nodes - 分类树节点列表
 * @param depth - 缩进深度
 * @returns React option 元素数组
 */
function renderCategoryOptions(
  nodes: CategoryTreeNode[],
  depth: number = 0,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  for (const node of nodes) {
    const prefix = '\u00A0\u00A0'.repeat(depth);
    result.push(
      <option key={node.value} value={node.value}>
        {prefix}
        {node.title}
      </option>,
    );
    if (node.children?.length) {
      result.push(...renderCategoryOptions(node.children, depth + 1));
    }
  }
  return result;
}

/**
 * 递归渲染位置级联为 select options
 *
 * @param nodes - 位置级联节点列表
 * @param depth - 缩进深度
 * @returns React option 元素数组
 */
function renderLocationOptions(
  nodes: LocationCascadeNode[],
  depth: number = 0,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  for (const node of nodes) {
    const prefix = '\u00A0\u00A0'.repeat(depth);
    result.push(
      <option key={node.value} value={node.value}>
        {prefix}
        {node.label}
      </option>,
    );
    if (node.children?.length) {
      result.push(...renderLocationOptions(node.children, depth + 1));
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  组件实现                                                           */
/* ------------------------------------------------------------------ */

/**
 * ExportConfigPanel — 资产导出配置面板
 *
 * 提供分类选择、状态多选、位置级联选择等导出过滤条件。
 * 用户点击导出按钮后，通过 onExport 回调将筛选参数传出。
 * 当无任何过滤条件时，弹出确认对话框提示用户将导出全部资产。
 *
 * @param props - 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <ExportConfigPanel
 *   categories={categoryTree}
 *   locations={locationCascade}
 *   exporting={isExporting}
 *   onExport={(params) => handleExport(params)}
 * />
 * ```
 */
export function ExportConfigPanel({
  categories,
  locations,
  exporting = false,
  onExport,
  className,
}: ExportConfigPanelProps) {
  /** 分类筛选 */
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  /** 状态筛选（多选，逗号分隔存储） */
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  /** 位置筛选 */
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  /** 确认弹窗显示 */
  const [showConfirm, setShowConfirm] = useState(false);

  /**
   * 处理状态多选变化
   *
   * @param value - 选中的状态值
   */
  const handleStatusToggle = useCallback((value: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }, []);

  /**
   * 构建导出参数
   *
   * @returns 导出查询参数对象
   */
  const buildExportParams = useCallback((): AssetExportParams => {
    const params: AssetExportParams = {};
    if (selectedCategory) {
      params.categoryId = selectedCategory;
    }
    if (selectedStatuses.length > 0) {
      params.status = selectedStatuses.join(',');
    }
    if (selectedLocation) {
      params.departmentId = selectedLocation;
    }
    return params;
  }, [selectedCategory, selectedStatuses, selectedLocation]);

  /** 是否有活跃的筛选条件 */
  const hasActiveFilters =
    !!selectedCategory || selectedStatuses.length > 0 || !!selectedLocation;

  /**
   * 处理导出按钮点击
   *
   * @description 无筛选条件时显示确认弹窗，有条件时直接导出
   */
  const handleExportClick = useCallback(() => {
    if (!hasActiveFilters) {
      setShowConfirm(true);
      return;
    }
    onExport(buildExportParams());
  }, [hasActiveFilters, onExport, buildExportParams]);

  /**
   * 确认导出全部
   */
  const handleConfirmExport = useCallback(() => {
    setShowConfirm(false);
    onExport(buildExportParams());
  }, [onExport, buildExportParams]);

  /**
   * 取消导出
   */
  const handleCancelExport = useCallback(() => {
    setShowConfirm(false);
  }, []);

  /**
   * 重置所有筛选条件
   */
  const handleReset = useCallback(() => {
    setSelectedCategory('');
    setSelectedStatuses([]);
    setSelectedLocation('');
  }, []);

  return (
    <div className={`space-y-6 ${className ?? ''}`}>
      {/* 筛选条件区域 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 分类选择 */}
        <div>
          <label
            htmlFor="export-category"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            资产分类
          </label>
          <select
            id="export-category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors"
          >
            <option value="">全部分类</option>
            {renderCategoryOptions(categories)}
          </select>
        </div>

        {/* 状态多选 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            资产状态
          </label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5
                  text-sm rounded-lg border cursor-pointer transition-colors
                  ${
                    selectedStatuses.includes(opt.value)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(opt.value)}
                  onChange={() => handleStatusToggle(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* 位置选择 */}
        <div>
          <label
            htmlFor="export-location"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            位置
          </label>
          <select
            id="export-location"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors"
          >
            <option value="">全部位置</option>
            {renderLocationOptions(locations)}
          </select>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={handleReset}
          disabled={!hasActiveFilters}
          className="text-sm text-gray-500 hover:text-gray-700
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          重置筛选条件
        </button>

        <button
          type="button"
          onClick={handleExportClick}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium
            rounded-lg bg-blue-600 text-white hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              导出中...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              导出
            </>
          )}
        </button>
      </div>

      {/* 无条件确认弹窗 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCancelExport}
            role="presentation"
          />
          <div
            className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
            role="dialog"
            aria-modal="true"
            aria-label="确认导出"
          >
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">确认导出</h3>
                <p className="mt-2 text-sm text-gray-600">
                  未设置筛选条件，将导出全部资产，是否继续？
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelExport}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300
                  bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmExport}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white
                  hover:bg-blue-700 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExportConfigPanel;
