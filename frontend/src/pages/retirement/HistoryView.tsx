/**
 * HistoryView - 资产报废历史查询页面
 * 
 * 支持按资产ID、日期范围查询报废记录，提供分页展示功能。
 * 
 * @module pages/retirement/HistoryView
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { retirementApi } from '@/api/retirementApi';
import type { RetirementRecord, RetirementQueryParams } from './types/retirement.types';

/**
 * 日期范围选择器组件
 */
interface DateRange {
  start: string;
  end: string;
}

/**
 * HistoryView 组件状态
 */
interface HistoryViewState {
  /** 记录列表 */
  records: RetirementRecord[];
  /** 总记录数 */
  totalCount: number;
  /** 当前页码 */
  currentPage: number;
  /** 每页条数 */
  pageSize: number;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 资产ID筛选 */
  assetIdFilter: string;
  /** 日期范围筛选 */
  dateRange: DateRange;
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * 初始化状态
 */
const initialState: HistoryViewState = {
  records: [],
  totalCount: 0,
  currentPage: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  loading: false,
  error: null,
  assetIdFilter: '',
  dateRange: {
    start: '',
    end: '',
  },
};

/**
 * 格式化日期为 ISO8601 格式
 * @param date - 日期对象
 * @returns 格式化后的日期字符串 YYYY-MM-DD
 */
const formatDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * HistoryView 组件 - 报废历史查询页面
 * 
 * 提供以下功能：
 * - 按资产ID精确查询
 * - 按日期范围筛选
 * - 分页浏览（默认每页20条）
 * - 记录详情查看
 */
export const HistoryView: React.FC = () => {
  const [state, setState] = useState<HistoryViewState>(initialState);

  /**
   * 构建查询参数
   * @returns RetirementQueryParams
   */
  const buildQueryParams = useCallback((): RetirementQueryParams => {
    const params: RetirementQueryParams = {
      page: state.currentPage,
      page_size: state.pageSize,
    };

    if (state.assetIdFilter.trim()) {
      params.asset_id = state.assetIdFilter.trim();
    }

    if (state.dateRange.start) {
      params.start_date = state.dateRange.start;
    }

    if (state.dateRange.end) {
      params.end_date = state.dateRange.end;
    }

    return params;
  }, [state.currentPage, state.pageSize, state.assetIdFilter, state.dateRange]);

  /**
   * 获取历史记录列表
   */
  const fetchRecords = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const params = buildQueryParams();
      const response = await retirementApi.queryRetirementHistory(params);

      setState(prev => ({
        ...prev,
        records: response.data || [],
        totalCount: response.total_count || 0,
        loading: false,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取历史记录失败';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [buildQueryParams]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  /**
   * 处理资产ID输入变化
   * @param e - React.ChangeEvent<HTMLInputElement>
   */
  const handleAssetIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState(prev => ({
      ...prev,
      assetIdFilter: e.target.value,
    }));
  };

  /**
   * 处理开始日期变化
   * @param e - React.ChangeEvent<HTMLInputElement>
   */
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        start: e.target.value,
      },
    }));
  };

  /**
   * 处理结束日期变化
   * @param e - React.ChangeEvent<HTMLInputElement>
   */
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        end: e.target.value,
      },
    }));
  };

  /**
   * 重置筛选条件
   */
  const handleReset = () => {
    setState(prev => ({
      ...prev,
      assetIdFilter: '',
      dateRange: { start: '', end: '' },
      currentPage: 1,
    }));
  };

  /**
   * 执行筛选查询
   */
  const handleSearch = () => {
    setState(prev => ({ ...prev, currentPage: 1 }));
  };

  /**
   * 处理页码变化
   * @param page - 新的页码
   */
  const handlePageChange = (page: number) => {
    setState(prev => ({ ...prev, currentPage: page }));
  };

  /**
   * 计算总页数
   */
  const totalPages = Math.ceil(state.totalCount / state.pageSize);

  /**
   * 格式化日期显示
   * @param dateString - ISO8601 日期字符串
   * @returns 格式化后的显示字符串
   */
  const formatDisplayDate = (dateString: string): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="history-view">
      <div className="history-view__header">
        <h1 className="history-view__title">报废历史查询</h1>
      </div>

      {/* 筛选区域 */}
      <div className="history-view__filters">
        <div className="filter-group">
          <label htmlFor="asset-id-filter" className="filter-label">
            资产ID
          </label>
          <input
            id="asset-id-filter"
            type="text"
            className="filter-input"
            placeholder="请输入资产ID"
            value={state.assetIdFilter}
            onChange={handleAssetIdChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="start-date" className="filter-label">
            开始日期
          </label>
          <input
            id="start-date"
            type="date"
            className="filter-input"
            value={state.dateRange.start}
            onChange={handleStartDateChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="end-date" className="filter-label">
            结束日期
          </label>
          <input
            id="end-date"
            type="date"
            className="filter-input"
            value={state.dateRange.end}
            onChange={handleEndDateChange}
          />
        </div>

        <div className="filter-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSearch}
            disabled={state.loading}
          >
            查询
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleReset}
            disabled={state.loading}
          >
            重置
          </button>
        </div>
      </div>

      {/* 结果统计 */}
      <div className="history-view__stats">
        <span className="stats-label">共找到</span>
        <span className="stats-count">{state.totalCount}</span>
        <span className="stats-label">条记录</span>
      </div>

      {/* 加载状态 */}
      {state.loading && (
        <div className="history-view__loading">
          <span className="loading-text">加载中...</span>
        </div>
      )}

      {/* 错误提示 */}
      {state.error && (
        <div className="history-view__error">
          <span className="error-text">{state.error}</span>
          <button
            type="button"
            className="btn btn--small"
            onClick={fetchRecords}
          >
            重试
          </button>
        </div>
      )}

      {/* 记录列表 */}
      {!state.loading && !state.error && (
        <div className="history-view__table-container">
          <table className="history-table">
            <thead className="history-table__header">
              <tr>
                <th>资产ID</th>
                <th>资产名称</th>
                <th>报废原因</th>
                <th>报废日期</th>
                <th>操作人</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody className="history-table__body">
              {state.records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="history-table__empty">
                    暂无报废记录
                  </td>
                </tr>
              ) : (
                state.records.map(record => (
                  <tr key={record.id} className="history-table__row">
                    <td className="history-table__cell">{record.asset_id}</td>
                    <td className="history-table__cell">{record.asset_name || '-'}</td>
                    <td className="history-table__cell history-table__cell--reason">
                      {record.reason || '-'}
                    </td>
                    <td className="history-table__cell">
                      {formatDisplayDate(record.retired_at)}
                    </td>
                    <td className="history-table__cell">{record.retired_by || '-'}</td>
                    <td className="history-table__cell">
                      <span className={`status-badge status-badge--${record.status}`}>
                        {record.status === 'retired' ? '已退役' : record.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页控制 */}
      {state.totalCount > 0 && (
        <div className="history-view__pagination">
          <button
            type="button"
            className="pagination-btn"
            disabled={state.currentPage <= 1 || state.loading}
            onClick={() => handlePageChange(state.currentPage - 1)}
          >
            上一页
          </button>

          <div className="pagination-info">
            <span className="pagination-current">第 {state.currentPage} 页</span>
            <span className="pagination-separator">/</span>
            <span className="pagination-total">共 {totalPages} 页</span>
          </div>

          <button
            type="button"
            className="pagination-btn"
            disabled={state.currentPage >= totalPages || state.loading}
            onClick={() => handlePageChange(state.currentPage + 1)}
          >
            下一页
          </button>

          <select
            className="pagination-size-select"
            value={state.pageSize}
            onChange={(e) => {
              setState(prev => ({
                ...prev,
                pageSize: Number(e.target.value),
                currentPage: 1,
              }));
            }}
            disabled={state.loading}
          >
            <option value={10}>10条/页</option>
            <option value={20}>20条/页</option>
            <option value={50}>50条/页</option>
          </select>
        </div>
      )}
    </div>
  );
};

export default HistoryView;