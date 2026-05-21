/**
 * @file components/ui/DataTable.tsx
 * @description 企业级数据表格
 *
 * 功能：分页、排序、loading/empty 状态、行点击
 * 遵循 Design System：表头 #f8fafc，行高 40px，hover #f8fbff
 */

import * as React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { SkeletonTable } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  title: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey?: keyof T | ((row: T) => string | number);
  loading?: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: T) => void;
  emptyText?: string;
  className?: string;
  compact?: boolean;
}

export function DataTable<T extends object>({
  columns,
  data,
  rowKey = 'id' as keyof T,
  loading,
  pagination,
  onSort,
  onRowClick,
  emptyText = '暂无数据',
  className,
  compact,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (!onSort) return;
    const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDir(newDir);
    onSort(key, newDir);
  };

  const getRowKey = (row: T, index: number): string | number => {
    if (typeof rowKey === 'function') return rowKey(row);
    return (row[rowKey] as string | number) ?? index;
  };

  const rowHeight = compact ? 'h-8' : 'h-10';

  return (
    <div className={cn('w-full', className)}>
      <div className="overflow-x-auto rounded-[10px] border border-[#e5e7eb]">
        <table className="w-full border-collapse">
          {/* Header */}
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#e5e7eb]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-2.5 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap select-none',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer hover:text-[#374151]',
                  )}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.title}
                    {col.sortable && (
                      <span className="text-[#cbd5e1]">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ChevronUp className="w-3 h-3 text-[#3b82f6]" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-[#3b82f6]" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <SkeletonTable rows={5} cols={columns.length} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyText} className="py-12" />
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={getRowKey(row, index)}
                  className={cn(
                    rowHeight,
                    'border-b border-[#f1f5f9] last:border-b-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-[#f8fbff]',
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-2 text-sm text-[#374151]',
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right',
                      )}
                    >
                      {col.render
                        ? col.render((row as Record<string, unknown>)[col.key], row, index)
                        : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-[#94a3b8]">
            共 <span className="font-medium text-[#374151]">{pagination.total}</span> 条
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onChange(pagination.page - 1, pagination.pageSize)}
              disabled={pagination.page <= 1}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#e5e7eb] disabled:opacity-40 hover:bg-[#f8fafc] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {/* 页码按钮 */}
            {(() => {
              const totalPages = Math.ceil(pagination.total / pagination.pageSize);
              const pages: (number | '...')[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (pagination.page > 3) pages.push('...');
                for (
                  let i = Math.max(2, pagination.page - 1);
                  i <= Math.min(totalPages - 1, pagination.page + 1);
                  i++
                )
                  pages.push(i);
                if (pagination.page < totalPages - 2) pages.push('...');
                pages.push(totalPages);
              }
              return pages.map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-[#94a3b8]">
                    ···
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => pagination.onChange(p as number, pagination.pageSize)}
                    className={cn(
                      'h-8 min-w-[32px] px-2 rounded-lg border text-sm transition-colors',
                      pagination.page === p
                        ? 'bg-[#3b82f6] text-white border-[#3b82f6] font-medium'
                        : 'border-[#e5e7eb] hover:bg-[#f8fafc]',
                    )}
                  >
                    {p}
                  </button>
                ),
              );
            })()}
            <button
              onClick={() => pagination.onChange(pagination.page + 1, pagination.pageSize)}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#e5e7eb] disabled:opacity-40 hover:bg-[#f8fafc] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
