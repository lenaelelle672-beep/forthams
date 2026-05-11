/**
 * ImportValidationErrorList — 导入校验错误列表组件
 *
 * 展示文件解析阶段返回的行级校验错误，支持分页浏览。
 * 接收 ImportParseError[] 数据，渲染为紧凑的错误行列表。
 *
 * @module components/assets/ImportValidationErrorList
 * @since SWARM-043
 */

import React, { useState, useMemo, useCallback } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImportParseError } from '../../services/assetService';

/* ------------------------------------------------------------------ */
/*  Props 类型                                                         */
/* ------------------------------------------------------------------ */

/**
 * ImportValidationErrorList 组件属性
 */
export interface ImportValidationErrorListProps {
  /** 校验错误列表 */
  errors: ImportParseError[];
  /** 额外 CSS 类名 */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  常量                                                               */
/* ------------------------------------------------------------------ */

/** 每页显示条数 */
const PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/*  组件实现                                                           */
/* ------------------------------------------------------------------ */

/**
 * ImportValidationErrorList — 导入校验错误列表组件
 *
 * 渲染导入文件解析阶段的行级校验错误，支持前端分页浏览。
 * 每条错误显示行号、字段名、错误信息。
 *
 * @param props - 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <ImportValidationErrorList errors={parseResponse.errors} />
 * ```
 */
export function ImportValidationErrorList({
  errors,
  className,
}: ImportValidationErrorListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  /** 总页数 */
  const totalPages = Math.max(1, Math.ceil(errors.length / PAGE_SIZE));

  /** 当前页数据 */
  const pageData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return errors.slice(start, start + PAGE_SIZE);
  }, [errors, currentPage]);

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

  /** 无错误时的空状态 */
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {/* 标题 */}
      <div className="flex items-center gap-2 text-red-700">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium">
          校验错误（{errors.length} 条）
        </span>
      </div>

      {/* 错误列表 */}
      <div className="overflow-x-auto rounded-lg border border-red-200">
        <table className="min-w-full divide-y divide-red-100">
          <thead className="bg-red-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-red-600 uppercase tracking-wider">
                行号
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-red-600 uppercase tracking-wider">
                字段
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-red-600 uppercase tracking-wider">
                错误信息
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-red-50">
            {pageData.map((err, idx) => (
              <tr
                key={`${err.rowNumber}-${err.field}-${idx}`}
                className="hover:bg-red-50/50 transition-colors"
                data-testid="validation-error-row"
              >
                <td className="px-4 py-2 text-sm text-gray-900 font-mono">
                  {err.rowNumber}
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 font-mono">
                  {err.field}
                </td>
                <td className="px-4 py-2 text-sm text-red-600">
                  {err.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            共 {errors.length} 条错误，第 {currentPage}/{totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange('prev')}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm
                rounded border border-gray-300 bg-white hover:bg-gray-50
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              上一页
            </button>
            <button
              type="button"
              onClick={() => handlePageChange('next')}
              disabled={currentPage >= totalPages}
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

export default ImportValidationErrorList;
