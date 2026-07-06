/**
 * @file components/ui/DataTable.tsx
 * @description 企业级数据表格
 *
 * 功能：分页、排序、loading/empty 状态、行点击
 * AI 去味：行 hover 微渐变高亮、斑马纹改为微渐变交替、列头字重差异化
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
      <div data-slot="data-table" className="overflow-x-auto rounded-[var(--surface-radius)] border border-[var(--surface-border)] bg-[color:var(--surface-card-raised)] shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 ring-white/70">
        <table className="w-full border-collapse">
          {/* Header */}
          <thead>
            <tr className="border-b border-[#e5e7eb] bg-gradient-to-r from-[#fbfdff] to-[#f3f7fb]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'select-none whitespace-nowrap px-4 py-3 text-left text-xs uppercase tracking-[0.08em]',
                    /* 列头字重差异化：sortable 列更粗表示可交互 */
                    col.sortable ? 'font-extrabold text-[#374151]' : 'font-semibold text-[#64748b]',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer hover:text-[#1d4ed8]',
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
                            <ChevronUp className="w-3 h-3 text-[#1d4ed8]" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-[#1d4ed8]" />
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
                    'border-b border-[#f1f5f9] last:border-b-0',
                    /* 斑马纹：每两行渐变交替，代替纯色斑马纹 */
                    index % 2 === 1 ? 'bg-gradient-to-r from-transparent via-[var(--surface-muted)]/40 to-transparent' : '',
                    /* 行 hover：微渐变高亮 + 左侧指示条，替代纯背景色 */
                    'transition-colors duration-150 ease-out',
                    onRowClick && 'cursor-pointer hover:bg-[var(--surface-hover)] hover:shadow-[inset_3px_0_0_rgba(29,78,216,0.22)]',
                    'motion-reduce:transition-none',
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-2.5 text-sm leading-6 text-[#374151]',
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
        <div className="mt-4 flex items-center justify-between rounded-[var(--surface-radius)] border border-[var(--surface-border)] bg-white/80 px-3 py-2 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <span className="text-[#94a3b8]">
            共 <span className="font-medium text-[#374151]">{pagination.total}</span> 条
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onChange(pagination.page - 1, pagination.pageSize)}
              disabled={pagination.page <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dbe5f0] bg-white transition-colors hover:bg-[#f8fbff] disabled:opacity-40 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
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
                      'h-8 min-w-[32px] rounded-lg border px-2 text-sm font-medium shadow-[var(--shadow-control)] transition-colors focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
                      pagination.page === p
                        ? 'bg-[#1d4ed8] text-white border-[#1d4ed8] font-medium shadow-blue-500/20'
                        : 'border-[var(--surface-border)] bg-white hover:bg-[var(--surface-hover)]',
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
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dbe5f0] bg-white transition-colors hover:bg-[#f8fbff] disabled:opacity-40 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
