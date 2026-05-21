/**
 * AuditFilterBar Component
 * 
 * 审计日志筛选工具栏组件，支持时间范围筛选和操作类型筛选。
 * 
 * @module AuditLogPanel/AuditFilterBar
 * @version 1.0.0
 * @license MIT
 * 
 * @example
 * ```tsx
 * <AuditFilterBar
 *   filters={{
 *     timeRange: { start: '2024-01-01', end: '2024-01-31' },
 *     operationType: 'UPDATE'
 *   }}
 *   onApply={(filters) => console.log('Applied:', filters)}
 *   onReset={() => console.log('Reset filters')}
 * />
 * ```
 * 
 * @see {@link https://spec.swarm-051.internal/docs/audit-filter-bar SWARM-051 Spec}
 */

import React, { useState, useCallback, useEffect } from 'react';

// ============================================================================
// Type Definitions
// ============================================================================

/** 时间范围类型定义 */
export interface TimeRange {
  /** 起始时间 (ISO8601 格式) */
  start: string;
  /** 结束时间 (ISO8601 格式) */
  end: string;
}

/** 操作类型枚举 */
export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE' | 'ALL';

/** 筛选器配置接口 */
export interface AuditFilters {
  /** 时间范围筛选 */
  timeRange?: TimeRange;
  /** 操作类型筛选 */
  operationType?: OperationType;
}

/** AuditFilterBar 组件 Props */
export interface AuditFilterBarProps {
  /** 当前筛选器配置 */
  filters: AuditFilters;
  /** 应用筛选器回调 */
  onApply: (filters: AuditFilters) => void;
  /** 重置筛选器回调 */
  onReset?: () => void;
  /** 是否禁用组件 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_TIME_RANGE: TimeRange = {
  start: '',
  end: '',
};

const OPERATION_TYPES: { value: OperationType; label: string }[] = [
  { value: 'ALL', label: '全部操作' },
  { value: 'CREATE', label: '创建' },
  { value: 'UPDATE', label: '更新' },
  { value: 'DELETE', label: '删除' },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 验证时间范围是否有效
 * @param start - 起始时间
 * @param end - 结束时间
 * @returns 是否有效
 */
function isValidTimeRange(start: string, end: string): boolean {
  if (!start || !end) return true;
  const startDate = new Date(start);
  const endDate = new Date(end);
  return startDate <= endDate;
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param date - Date 对象
 * @returns 格式化后的日期字符串
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * 获取今天日期字符串
 * @returns 今天日期 YYYY-MM-DD
 */
function getTodayDate(): string {
  return formatDate(new Date());
}

/**
 * 获取默认起始日期（30天前）
 * @returns 30天前的日期 YYYY-MM-DD
 */
function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return formatDate(date);
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * AuditFilterBar - 审计日志筛选工具栏组件
 * 
 * 提供时间范围筛选和操作类型筛选功能，支持快捷日期选择。
 * 
 * @param props - 组件属性
 * @returns 筛选工具栏 JSX 元素
 */
export const AuditFilterBar: React.FC<AuditFilterBarProps> = ({
  filters,
  onApply,
  onReset,
  disabled = false,
  className = '',
}) => {
  // =========================================================================
  // State Management
  // =========================================================================
  
  const [localStartDate, setLocalStartDate] = useState<string>(
    filters.timeRange?.start || getDefaultStartDate()
  );
  const [localEndDate, setLocalEndDate] = useState<string>(
    filters.timeRange?.end || getTodayDate()
  );
  const [localOperationType, setLocalOperationType] = useState<OperationType>(
    filters.operationType || 'ALL'
  );
  const [dateError, setDateError] = useState<string>('');

  // =========================================================================
  // Effects
  // =========================================================================

  /** 同步外部 filters 变化到本地状态 */
  useEffect(() => {
    if (filters.timeRange) {
      setLocalStartDate(filters.timeRange.start || getDefaultStartDate());
      setLocalEndDate(filters.timeRange.end || getTodayDate());
    }
    if (filters.operationType) {
      setLocalOperationType(filters.operationType);
    }
  }, [filters]);

  // =========================================================================
  // Event Handlers
  // =========================================================================

  /**
   * 处理起始日期变更
   * @param e - 输入事件
   */
  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalStartDate(value);
      setDateError('');
    },
    []
  );

  /**
   * 处理结束日期变更
   * @param e - 输入事件
   */
  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalEndDate(value);
      setDateError('');
    },
    []
  );

  /**
   * 处理操作类型变更
   * @param e - 选择事件
   */
  const handleOperationTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setLocalOperationType(e.target.value as OperationType);
    },
    []
  );

  /**
   * 处理快捷日期选择
   * @param days - 天数
   */
  const handleQuickSelect = useCallback((days: number) => {
    const end = getTodayDate();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const start = formatDate(startDate);
    
    setLocalStartDate(start);
    setLocalEndDate(end);
    setDateError('');
  }, []);

  /**
   * 处理应用筛选
   */
  const handleApply = useCallback(() => {
    // 验证时间范围
    if (!isValidTimeRange(localStartDate, localEndDate)) {
      setDateError('结束时间必须晚于或等于开始时间');
      return;
    }

    const appliedFilters: AuditFilters = {
      timeRange: {
        start: localStartDate,
        end: localEndDate,
      },
      operationType: localOperationType,
    };

    onApply(appliedFilters);
  }, [localStartDate, localEndDate, localOperationType, onApply]);

  /**
   * 处理重置筛选
   */
  const handleReset = useCallback(() => {
    const defaultStart = getDefaultStartDate();
    const defaultEnd = getTodayDate();
    
    setLocalStartDate(defaultStart);
    setLocalEndDate(defaultEnd);
    setLocalOperationType('ALL');
    setDateError('');

    if (onReset) {
      onReset();
    }
  }, [onReset]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div 
      className={`audit-filter-bar ${className}`}
      role="search"
      aria-label="审计日志筛选"
    >
      <div className="filter-bar-container">
        {/* 时间范围筛选区域 */}
        <div className="filter-group time-range-group">
          <label className="filter-label" htmlFor="start-date-input">
            <span className="label-text">开始日期</span>
          </label>
          <div className="date-input-wrapper">
            <input
              id="start-date-input"
              data-testid="start-date-input"
              type="date"
              className={`date-input ${dateError ? 'date-input-error' : ''}`}
              value={localStartDate}
              onChange={handleStartDateChange}
              disabled={disabled}
              max={localEndDate || undefined}
              aria-describedby={dateError ? 'date-error-message' : undefined}
            />
          </div>
          
          <span className="date-separator">至</span>
          
          <label className="filter-label" htmlFor="end-date-input">
            <span className="label-text">结束日期</span>
          </label>
          <div className="date-input-wrapper">
            <input
              id="end-date-input"
              data-testid="end-date-input"
              type="date"
              className={`date-input ${dateError ? 'date-input-error' : ''}`}
              value={localEndDate}
              onChange={handleEndDateChange}
              disabled={disabled}
              min={localStartDate || undefined}
              aria-describedby={dateError ? 'date-error-message' : undefined}
            />
          </div>
          
          {/* 日期错误提示 */}
          {dateError && (
            <span 
              id="date-error-message" 
              className="error-message"
              role="alert"
            >
              {dateError}
            </span>
          )}
        </div>

        {/* 快捷日期选择 */}
        <div className="quick-select-group">
          <span className="quick-select-label">快捷选择:</span>
          <button
            type="button"
            className="quick-select-btn"
            onClick={() => handleQuickSelect(7)}
            disabled={disabled}
            aria-label="最近7天"
          >
            近7天
          </button>
          <button
            type="button"
            className="quick-select-btn"
            onClick={() => handleQuickSelect(30)}
            disabled={disabled}
            aria-label="近30天"
          >
            近30天
          </button>
          <button
            type="button"
            className="quick-select-btn"
            onClick={() => handleQuickSelect(90)}
            disabled={disabled}
            aria-label="近90天"
          >
            近90天
          </button>
        </div>

        {/* 操作类型筛选 */}
        <div className="filter-group operation-type-group">
          <label className="filter-label" htmlFor="operation-type-select">
            <span className="label-text">操作类型</span>
          </label>
          <select
            id="operation-type-select"
            data-testid="operation-type-select"
            className="operation-select"
            value={localOperationType}
            onChange={handleOperationTypeChange}
            disabled={disabled}
          >
            {OPERATION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* 操作按钮区域 */}
        <div className="action-buttons">
          <button
            type="button"
            data-testid="apply-filter-btn"
            className="apply-btn"
            onClick={handleApply}
            disabled={disabled || !!dateError}
            aria-label="应用筛选"
          >
            <svg
              className="btn-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            应用筛选
          </button>
          
          <button
            type="button"
            data-testid="reset-filter-btn"
            className="reset-btn"
            onClick={handleReset}
            disabled={disabled}
            aria-label="重置筛选"
          >
            <svg
              className="btn-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            重置
          </button>
        </div>
      </div>

      {/* 内联样式 */}
      <style>{`
        .audit-filter-bar {
          width: 100%;
          padding: 16px 20px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .filter-bar-container {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          gap: 16px;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .filter-label {
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .label-text {
          display: block;
        }

        .time-range-group {
          flex-direction: row;
          align-items: center;
          flex-wrap: wrap;
        }

        .date-input-wrapper {
          position: relative;
        }

        .date-input {
          height: 40px;
          padding: 0 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          color: #1e293b;
          background-color: #1e293b;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .date-input:hover:not(:disabled) {
          border-color: #94a3b8;
        }

        .date-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .date-input:disabled {
          background-color: #f1f5f9;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .date-input-error {
          border-color: #ef4444;
          background-color: #fef2f2;
        }

        .date-input-error:focus {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
        }

        .date-separator {
          display: flex;
          align-items: center;
          padding: 0 8px;
          color: #94a3b8;
          font-size: 14px;
        }

        .error-message {
          width: 100%;
          font-size: 12px;
          color: #ef4444;
          margin-top: 4px;
        }

        .quick-select-group {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
        }

        .quick-select-label {
          font-size: 13px;
          color: #64748b;
          white-space: nowrap;
        }

        .quick-select-btn {
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background-color: #1e293b;
          font-size: 13px;
          font-family: inherit;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .quick-select-btn:hover:not(:disabled) {
          background-color: #f1f5f9;
          border-color: #cbd5e1;
        }

        .quick-select-btn:active:not(:disabled) {
          background-color: #1e293b;
        }

        .quick-select-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .operation-type-group {
          min-width: 140px;
        }

        .operation-select {
          height: 40px;
          padding: 0 32px 0 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          color: #1e293b;
          background-color: #1e293b;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-size: 16px;
          appearance: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .operation-select:hover:not(:disabled) {
          border-color: #94a3b8;
        }

        .operation-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .operation-select:disabled {
          background-color: #f1f5f9;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }

        .apply-btn,
        .reset-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 40px;
          padding: 0 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .apply-btn {
          background-color: #3b82f6;
          color: #e2e8f0;
          border: none;
        }

        .apply-btn:hover:not(:disabled) {
          background-color: #2563eb;
        }

        .apply-btn:active:not(:disabled) {
          background-color: #1d4ed8;
        }

        .apply-btn:disabled {
          background-color: #93c5fd;
          cursor: not-allowed;
        }

        .reset-btn {
          background-color: #1e293b;
          color: #475569;
          border: 1px solid #d1d5db;
        }

        .reset-btn:hover:not(:disabled) {
          background-color: #f8fafc;
          border-color: #94a3b8;
        }

        .reset-btn:active:not(:disabled) {
          background-color: #f1f5f9;
        }

        .reset-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-icon {
          width: 16px;
          height: 16px;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .audit-filter-bar {
            padding: 12px 16px;
          }

          .filter-bar-container {
            flex-direction: column;
            align-items: stretch;
          }

          .time-range-group {
            flex-direction: column;
            align-items: flex-start;
          }

          .date-separator {
            padding: 4px 0;
          }

          .quick-select-group {
            padding: 8px 0;
            flex-wrap: wrap;
          }

          .action-buttons {
            margin-left: 0;
            width: 100%;
          }

          .apply-btn,
          .reset-btn {
            flex: 1;
            justify-content: center;
          }
        }

        /* Dark Mode Support */
        @media (prefers-color-scheme: dark) {
          .audit-filter-bar {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border-color: #334155;
          }

          .filter-label {
            color: #94a3b8;
          }

          .date-input,
          .operation-select {
            background-color: #1e293b;
            border-color: #475569;
            color: #f1f5f9;
          }

          .date-input:hover:not(:disabled),
          .operation-select:hover:not(:disabled) {
            border-color: #64748b;
          }

          .quick-select-btn {
            background-color: #1e293b;
            border-color: #475569;
            color: #e2e8f0;
          }

          .quick-select-btn:hover:not(:disabled) {
            background-color: #334155;
            border-color: #64748b;
          }

          .reset-btn {
            background-color: #1e293b;
            border-color: #475569;
            color: #e2e8f0;
          }

          .reset-btn:hover:not(:disabled) {
            background-color: #334155;
          }

          .date-separator {
            color: #64748b;
          }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// Default Export
// ============================================================================

export default AuditFilterBar;