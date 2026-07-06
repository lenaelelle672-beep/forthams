/**
 * ImportResultTable 组件
 *
 * 展示导入解析结果的分页表格组件。
 * 接收 ImportDetailItem[] 数据，实现前端分页（每页 50 条），
 * 支持成功/失败行的差异化样式映射。
 *
 * 硬性约束：
 * - 单次渲染最大行数 500 条，超出强制分页
 * - 每页 50 条
 * - 失败行必须包含 rowIndex 与 errorMessage
 *
 * @module components/import/ImportResultTable
 * @since SWARM-019
 */

import React, { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

/**
 * 导入结果明细条目
 *
 * @description 描述单条导入行的解析/校验结果
 */
export interface ImportDetailItem {
  /** 原始 Excel 行号（从 1 开始） */
  rowIndex: number;
  /** 该行是否校验通过 */
  success: boolean;
  /** 错误信息（失败行必须包含） */
  errorMessage?: string;
  /** 资产名称（解析字段） */
  assetName?: string;
  /** 资产编号（解析字段） */
  assetCode?: string;
  /** 分类（解析字段） */
  category?: string;
  /** 状态（解析字段） */
  status?: string;
  /** 位置（解析字段） */
  location?: string;
  /** 购置日期（解析字段） */
  purchaseDate?: string;
  /** 原值（解析字段） */
  originalValue?: number;
}

/** 每页显示条数 */
const PAGE_SIZE = 50;
/** 最大渲染行数 */
const MAX_ROWS = 500;

/**
 * ImportResultTable 组件属性
 *
 * @description 传入导入明细数据和可选配置
 */
export interface ImportResultTableProps {
  /** 导入明细数据列表 */
  details: ImportDetailItem[];
  /** 成功总数 */
  successCount: number;
  /** 失败总数 */
  failCount: number;
  /** 导入状态 */
  status: 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED';
  /** 额外的 CSS 类名 */
  className?: string;
}

/**
 * 获取状态徽标配置
 *
 * @param status - 导入状态
 * @param successCount - 成功条数
 * @param failCount - 失败条数
 * @returns 状态徽标文本与样式
 */
function getStatusBadge(
  status: ImportResultTableProps['status'],
  successCount: number,
  failCount: number,
): { text: string; variant: 'success' | 'warning' | 'error' } {
  switch (status) {
    case 'COMPLETED':
      return { text: `全部成功 (${successCount})`, variant: 'success' };
    case 'PARTIAL_SUCCESS':
      return { text: `部分成功 (成功 ${successCount}, 失败 ${failCount})`, variant: 'warning' };
    case 'FAILED':
      return { text: `全部失败 (${failCount})`, variant: 'error' };
    default:
      return { text: '未知状态', variant: 'error' };
  }
}

/**
 * 获取状态徽标的 CSS 类名
 *
 * @param variant - 徽标变体类型
 * @returns CSS 类名字符串
 */
function getBadgeClasses(variant: 'success' | 'warning' | 'error'): string {
  const base = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium';
  switch (variant) {
    case 'success':
      return `${base} bg-green-100 text-green-800`;
    case 'warning':
      return `${base} bg-yellow-100 text-yellow-800`;
    case 'error':
      return `${base} bg-red-100 text-red-800`;
  }
}

/**
 * 获取状态徽标的图标
 *
 * @param variant - 徽标变体类型
 * @returns React 节点
 */
function getStatusIcon(variant: 'success' | 'warning' | 'error'): React.ReactNode {
  switch (variant) {
    case 'success':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4" />;
    case 'error':
      return <XCircle className="w-4 h-4" />;
  }
}

/**
 * ImportResultTable — 导入结果分页表格组件
 *
 * 渲染导入明细数据，支持前端分页和成功/失败行差异化样式。
 * 超过 500 条数据时强制截断，失败行显示 rowIndex 和 errorMessage。
 *
 * @param props - 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <ImportResultTable
 *   details={importDetails}
 *   successCount={3}
 *   failCount={1}
 *   status="PARTIAL_SUCCESS"
 * />
 * ```
 */
export function ImportResultTable({
  details,
  successCount,
  failCount,
  status,
  className,
}: ImportResultTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  /** 强制截断至 MAX_ROWS */
  const truncatedDetails = useMemo(
    () => details.slice(0, MAX_ROWS),
    [details],
  );

  /** 过滤出失败行 */
  const failedDetails = useMemo(
    () => truncatedDetails.filter((d) => !d.success),
    [truncatedDetails],
  );

  /** 总页数 */
  const totalPages = Math.max(1, Math.ceil(failedDetails.length / PAGE_SIZE));

  /** 当前页数据 */
  const pageData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return failedDetails.slice(start, start + PAGE_SIZE);
  }, [failedDetails, currentPage]);

  /** 状态徽标 */
  const badge = getStatusBadge(status, successCount, failCount);

  /**
   * 翻页处理
   *
   * @param direction - 翻页方向
   */
  const handlePageChange = useCallback(
    (direction: 'prev' | 'next') => {
      setCurrentPage((prev) => {
        if (direction === 'prev') return Math.max(1, prev - 1);
        return Math.min(totalPages, prev + 1);
      });
    },
    [totalPages],
  );

  /**
   * 跳转到指定页
   *
   * @param page - 目标页码
   */
  const handleGoToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    },
    [totalPages],
  );

  // 如果没有失败行，只显示状态徽标
  if (failedDetails.length === 0) {
    return (
      <div className={`space-y-3 ${className ?? ''}`}>
        <div className={getBadgeClasses(badge.variant)}>
          {getStatusIcon(badge.variant)}
          <span>{badge.text}</span>
        </div>
        {status === 'COMPLETED' && (
          <p className="text-sm text-gray-400">所有数据导入成功，无错误行。</p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {/* 状态徽标 */}
      <div className={getBadgeClasses(badge.variant)}>
        {getStatusIcon(badge.variant)}
        <span>{badge.text}</span>
      </div>

      {/* 错误表格 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-[#1e3a5f]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                行号
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                资产名称
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                错误信息
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#1e3a5f]">
            {pageData.map((item) => (
              <tr
                key={item.rowIndex}
                className="hover:bg-red-50 transition-colors"
                style={{ backgroundColor: '#FFF2F0' }}
              >
                <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                  {item.rowIndex}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {item.assetName ?? '-'}
                </td>
                <td className="px-4 py-3 text-sm text-red-600">
                  {item.errorMessage ?? 'Unknown parsing error'}
                </td>
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  无错误数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            共 {failedDetails.length} 条错误，
            第 {currentPage}/{totalPages} 页
            {details.length > MAX_ROWS && `（仅显示前 ${MAX_ROWS} 条）`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange('prev')}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm
                rounded border border-gray-200 bg-white hover:bg-gray-50
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              上一页
            </button>

            {/* 页码按钮 */}
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => handleGoToPage(pageNum)}
                  className={`px-3 py-1.5 text-sm rounded border transition-colors
                    ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => handlePageChange('next')}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm
                rounded border border-gray-200 bg-white hover:bg-gray-50
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

export default ImportResultTable;
