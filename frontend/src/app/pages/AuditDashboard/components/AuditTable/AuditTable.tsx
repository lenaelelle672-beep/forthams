/**
 * AuditTable — 审计日志数据表格组件
 *
 * 提供审计日志的分页列表展示，支持列排序、分页切换与本地时区时间渲染。
 * 遵循 SPEC 边界约束：
 *   - 单页上限 100 条，默认 50 条
 *   - 时间戳统一转换为用户本地时区展示
 *   - 操作类型由后端元数据接口动态下发，前端不硬编码
 *
 * @module AuditDashboard/components/AuditTable
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { AuditLogItem, AuditListParams, AuditSortField, SortOrder } from '../../types/audit.types';
import styles from './AuditTable.module.css';

/** 分页大小可选项，遵循 SPEC 单页上限 100 条约束 */
const PAGE_SIZE_OPTIONS: number[] = [10, 20, 50, 100];

/** 默认分页大小 */
const DEFAULT_PAGE_SIZE: number = 50;

/**
 * 将 UTC ISO 8601 时间字符串转换为用户本地时区的可读格式。
 *
 * @param utcTimeString - UTC 时间的 ISO 8601 字符串（如 "2025-01-15T08:30:00Z"）
 * @returns 本地时区格式化字符串，如 "2025-01-15 16:30:00"
 */
function formatUtcToLocal(utcTimeString: string): string {
  try {
    const date = new Date(utcTimeString);
    if (isNaN(date.getTime())) {
      return utcTimeString;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return utcTimeString;
  }
}

/**
 * 获取排序方向指示符。
 *
 * @param field - 当前排序列字段
 * @param activeField - 激活的排序字段
 * @param order - 排序方向
 * @returns 排序指示符字符串
 */
function getSortIndicator(field: AuditSortField, activeField: AuditSortField | null, order: SortOrder): string {
  if (field !== activeField) {
    return '⇅';
  }
  return order === 'asc' ? '↑' : '↓';
}

/** AuditTable 组件属性接口 */
export interface AuditTableProps {
  /** 审计日志数据列表 */
  items: AuditLogItem[];
  /** 数据总条数 */
  total: number;
  /** 当前是否正在加载 */
  loading: boolean;
  /** 错误信息，为 null 时表示无错误 */
  error: string | null;
  /** 当前筛选/分页参数 */
  params: AuditListParams;
  /** 参数变更回调，用于触发数据刷新 */
  onParamsChange: (params: AuditListParams) => void;
}

/**
 * AuditTable 组件
 *
 * 渲染审计日志分页表格，支持：
 * - 列头点击排序（操作时间、操作类型、操作人）
 * - 分页大小切换与页码导航
 * - 加载态骨架屏、空数据占位、错误提示
 * - 时间戳本地时区展示
 *
 * @param props - AuditTableProps
 * @returns React 元素
 */
export const AuditTable: React.FC<AuditTableProps> = ({
  items,
  total,
  loading,
  error,
  params,
  onParamsChange,
}) => {
  /** 当前排序字段 */
  const [sortField, setSortField] = useState<AuditSortField | null>(null);
  /** 当前排序方向 */
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  /** 总页数 */
  const totalPages = useMemo(() => {
    const size = params.size ?? DEFAULT_PAGE_SIZE;
    return Math.max(1, Math.ceil(total / size));
  }, [total, params.size]);

  /** 当前页码（从 1 开始） */
  const currentPage = useMemo(() => {
    const size = params.size ?? DEFAULT_PAGE_SIZE;
    return Math.min(Math.max(1, (params.page ?? 1)), totalPages);
  }, [params.page, params.size, totalPages]);

  /**
   * 处理列头排序点击。
   * 同一字段切换升降序，不同字段默认降序。
   *
   * @param field - 被点击的排序字段
   */
  const handleSort = useCallback(
    (field: AuditSortField) => {
      let newOrder: SortOrder;
      if (sortField === field) {
        newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        newOrder = 'desc';
      }
      setSortField(field);
      setSortOrder(newOrder);
      onParamsChange({
        ...params,
        sort_field: field,
        sort_order: newOrder,
        page: 1,
      });
    },
    [sortField, sortOrder, params, onParamsChange],
  );

  /**
   * 处理分页大小变更。
   * 切换大小时重置到第一页。
   *
   * @param newSize - 新的分页大小
   */
  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      onParamsChange({
        ...params,
        size: newSize,
        page: 1,
      });
    },
    [params, onParamsChange],
  );

  /**
   * 处理页码变更。
   *
   * @param newPage - 目标页码（从 1 开始）
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      const clampedPage = Math.min(Math.max(1, newPage), totalPages);
      onParamsChange({
        ...params,
        page: clampedPage,
      });
    },
    [params, totalPages, onParamsChange],
  );

  /**
   * 生成分页页码按钮列表。
   * 最多显示 7 个页码，中间用省略号连接。
   *
   * @returns 页码数组，-1 表示省略号
   */
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push(-1); // 省略号
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push(-1); // 省略号
      }
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  /** 当前分页大小 */
  const pageSize = params.size ?? DEFAULT_PAGE_SIZE;

  // ─── 渲染：错误状态 ───
  if (error) {
    return (
      <div className={styles.container} data-testid="audit-table-error">
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorMessage}>{error}</p>
          <button
            className={styles.retryButton}
            onClick={() => onParamsChange({ ...params })}
            type="button"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // ─── 渲染：加载态骨架屏 ───
  if (loading) {
    return (
      <div className={styles.container} data-testid="audit-table-loading">
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>操作时间</th>
                <th className={styles.th}>操作类型</th>
                <th className={styles.th}>操作人</th>
                <th className={styles.th}>操作描述</th>
                <th className={styles.th}>IP 地址</th>
                <th className={styles.th}>操作结果</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className={styles.skeletonRow}>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── 渲染：空数据 ───
  if (!items || items.length === 0) {
    return (
      <div className={styles.container} data-testid="audit-table-empty">
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📋</span>
          <p className={styles.emptyMessage}>暂无审计日志数据</p>
          <p className={styles.emptyHint}>请调整筛选条件后重试</p>
        </div>
      </div>
    );
  }

  // ─── 渲染：正常数据表格 ───
  return (
    <div className={styles.container} data-testid="audit-table">
      {/* 表格区域 */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th
                className={`${styles.th} ${styles.sortable}`}
                onClick={() => handleSort('created_at')}
                data-testid="sort-created_at"
              >
                操作时间
                <span className={styles.sortIndicator}>
                  {getSortIndicator('created_at', sortField, sortOrder)}
                </span>
              </th>
              <th
                className={`${styles.th} ${styles.sortable}`}
                onClick={() => handleSort('action_type')}
                data-testid="sort-action_type"
              >
                操作类型
                <span className={styles.sortIndicator}>
                  {getSortIndicator('action_type', sortField, sortOrder)}
                </span>
              </th>
              <th
                className={`${styles.th} ${styles.sortable}`}
                onClick={() => handleSort('operator_id')}
                data-testid="sort-operator_id"
              >
                操作人
                <span className={styles.sortIndicator}>
                  {getSortIndicator('operator_id', sortField, sortOrder)}
                </span>
              </th>
              <th className={styles.th}>操作描述</th>
              <th className={styles.th}>IP 地址</th>
              <th className={styles.th}>操作结果</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={styles.row} data-testid="audit-table-row">
                <td className={styles.td} data-testid="cell-created_at">
                  <time dateTime={item.created_at} title={item.created_at}>
                    {formatUtcToLocal(item.created_at)}
                  </time>
                </td>
                <td className={styles.td} data-testid="cell-action_type">
                  <span className={styles.actionBadge} data-action-type={item.action_type}>
                    {item.action_type}
                  </span>
                </td>
                <td className={styles.td} data-testid="cell-operator">
                  <span className={styles.operatorName}>{item.operator_name || item.operator_id}</span>
                </td>
                <td className={styles.td} data-testid="cell-description">
                  <span className={styles.descriptionText} title={item.description}>
                    {item.description}
                  </span>
                </td>
                <td className={styles.td} data-testid="cell-ip">
                  <code className={styles.ipAddress}>{item.ip_address || '-'}</code>
                </td>
                <td className={styles.td} data-testid="cell-result">
                  <span
                    className={`${styles.resultBadge} ${
                      item.result === 'SUCCESS' ? styles.resultSuccess : styles.resultFailure
                    }`}
                  >
                    {item.result === 'SUCCESS' ? '成功' : '失败'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页控制区 */}
      <div className={styles.pagination} data-testid="audit-table-pagination">
        {/* 左侧：分页大小选择 */}
        <div className={styles.pageSizeControl}>
          <label className={styles.pageSizeLabel} htmlFor="audit-page-size">
            每页
          </label>
          <select
            id="audit-page-size"
            className={styles.pageSizeSelect}
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            data-testid="page-size-select"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} 条
              </option>
            ))}
          </select>
        </div>

        {/* 中间：页码导航 */}
        <div className={styles.pageNav}>
          <button
            className={styles.pageButton}
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(1)}
            type="button"
            aria-label="首页"
            data-testid="page-first"
          >
            «
          </button>
          <button
            className={styles.pageButton}
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
            type="button"
            aria-label="上一页"
            data-testid="page-prev"
          >
            ‹
          </button>
          {pageNumbers.map((page, idx) =>
            page === -1 ? (
              <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
                …
              </span>
            ) : (
              <button
                key={page}
                className={`${styles.pageButton} ${page === currentPage ? styles.pageButtonActive : ''}`}
                onClick={() => handlePageChange(page)}
                type="button"
                aria-label={`第 ${page} 页`}
                aria-current={page === currentPage ? 'page' : undefined}
                data-testid={`page-${page}`}
              >
                {page}
              </button>
            ),
          )}
          <button
            className={styles.pageButton}
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            type="button"
            aria-label="下一页"
            data-testid="page-next"
          >
            ›
          </button>
          <button
            className={styles.pageButton}
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(totalPages)}
            type="button"
            aria-label="末页"
            data-testid="page-last"
          >
            »
          </button>
        </div>

        {/* 右侧：数据统计 */}
        <div className={styles.pageInfo} data-testid="page-info">
          共 <strong>{total}</strong> 条，第 {currentPage}/{totalPages} 页
        </div>
      </div>
    </div>
  );
};

AuditTable.displayName = 'AuditTable';

export default AuditTable;