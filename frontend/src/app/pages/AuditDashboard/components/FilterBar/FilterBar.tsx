import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAuditMeta } from '../../services/auditApi';
import type { AuditFilterValues, ActionTypeOption } from '../../types/audit.types';
import styles from './FilterBar.module.css';

/**
 * FilterBar 组件属性接口
 * @property onFilterChange - 筛选条件变更时的回调函数，接收格式化后的筛选参数
 * @property loading - 是否处于加载状态，用于禁用查询按钮
 */
export interface FilterBarProps {
  onFilterChange: (filters: AuditFilterValues) => void;
  loading?: boolean;
}

/** 单次查询允许的最大时间跨度（天） */
const MAX_TIME_SPAN_DAYS = 90;

/** 默认查询时间范围：最近 7 天 */
const DEFAULT_RANGE_DAYS = 7;

/**
 * 将本地 Date 对象转换为 UTC ISO 8601 字符串
 * @param date 本地时间 Date 对象
 * @returns UTC 格式的 ISO 8601 字符串
 */
function toUTCISOString(date: Date): string {
  return date.toISOString();
}

/**
 * 计算两个日期之间的天数差
 * @param start 开始日期
 * @param end 结束日期
 * @returns 天数差（绝对值）
 */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.abs(end.getTime() - start.getTime()) / msPerDay;
}

/**
 * 格式化日期为 input[type="datetime-local"] 所需的字符串格式
 * @param date 日期对象
 * @returns 格式化后的字符串 (YYYY-MM-DDTHH:mm)
 */
function formatToLocalDateTimeInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * FilterBar - 审计日志仪表板筛选器组件
 *
 * 提供多维筛选能力：时间范围、操作类型（动态枚举）、操作人。
 * 时间范围约束：单次查询跨度不得超过 90 天。
 * 操作类型枚举由后端 `/api/v1/audit-log/meta` 接口动态下发，前端禁止硬编码。
 * 提交时将本地时间转换为 UTC ISO 8601 格式传递给 API。
 *
 * @param props - FilterBarProps
 * @returns FilterBar 组件
 */
const FilterBar: React.FC<FilterBarProps> = ({ onFilterChange, loading = false }) => {
  /** 操作类型枚举选项，由后端动态下发 */
  const [actionTypeOptions, setActionTypeOptions] = useState<ActionTypeOption[]>([]);

  /** 操作类型枚举加载状态 */
  const [metaLoading, setMetaLoading] = useState<boolean>(true);

  /** 操作类型枚举加载错误信息 */
  const [metaError, setMetaError] = useState<string | null>(null);

  /** 筛选器表单状态 */
  const [startTime, setStartTime] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - DEFAULT_RANGE_DAYS);
    d.setHours(0, 0, 0, 0);
    return formatToLocalDateTimeInput(d);
  });
  const [endTime, setEndTime] = useState<string>(() => {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    return formatToLocalDateTimeInput(d);
  });
  const [actionType, setActionType] = useState<string>('');
  const [operatorId, setOperatorId] = useState<string>('');

  /** 表单验证错误信息 */
  const [validationError, setValidationError] = useState<string | null>(null);

  /**
   * 组件挂载时从后端获取操作类型枚举
   * 操作类型枚举由后端统一下发，前端禁止硬编码
   */
  useEffect(() => {
    let cancelled = false;

    const loadMeta = async () => {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const meta = await fetchAuditMeta();
        if (!cancelled && meta?.action_types) {
          setActionTypeOptions(meta.action_types);
        }
      } catch (err) {
        if (!cancelled) {
          setMetaError('操作类型加载失败，请刷新重试');
          setActionTypeOptions([]);
        }
      } finally {
        if (!cancelled) {
          setMetaLoading(false);
        }
      }
    };

    loadMeta();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 校验筛选条件是否合法
   * - 时间范围跨度不得超过 90 天
   * - 开始时间不得晚于结束时间
   * @returns 校验通过返回 true，否则返回 false 并设置错误信息
   */
  const validateFilters = useCallback((): boolean => {
    setValidationError(null);

    if (!startTime || !endTime) {
      setValidationError('请选择完整的时间范围');
      return false;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setValidationError('时间格式无效，请重新选择');
      return false;
    }

    if (start >= end) {
      setValidationError('开始时间必须早于结束时间');
      return false;
    }

    const span = daysBetween(start, end);
    if (span > MAX_TIME_SPAN_DAYS) {
      setValidationError(`时间跨度不得超过 ${MAX_TIME_SPAN_DAYS} 天，当前跨度约 ${Math.ceil(span)} 天`);
      return false;
    }

    return true;
  }, [startTime, endTime]);

  /**
   * 处理查询按钮点击事件
   * 校验通过后，将本地时间转换为 UTC 并回调 onFilterChange
   */
  const handleSearch = useCallback(() => {
    if (!validateFilters()) {
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    const filters: AuditFilterValues = {
      start_time: toUTCISOString(start),
      end_time: toUTCISOString(end),
      action_type: actionType || undefined,
      operator_id: operatorId.trim() || undefined,
    };

    onFilterChange(filters);
  }, [startTime, endTime, actionType, operatorId, validateFilters, onFilterChange]);

  /**
   * 处理重置按钮点击事件
   * 将所有筛选条件恢复为默认值
   */
  const handleReset = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - DEFAULT_RANGE_DAYS);
    d.setHours(0, 0, 0, 0);
    setStartTime(formatToLocalDateTimeInput(d));

    const now = new Date();
    now.setHours(23, 59, 0, 0);
    setEndTime(formatToLocalDateTimeInput(now));

    setActionType('');
    setOperatorId('');
    setValidationError(null);
  }, []);

  /** 操作类型下拉选项，包含"全部"选项 */
  const actionTypeSelectOptions = useMemo(() => {
    return [
      { value: '', label: '全部' },
      ...actionTypeOptions.map((opt) => ({
        value: opt.value,
        label: opt.label,
      })),
    ];
  }, [actionTypeOptions]);

  return (
    <div className={styles.filterBar} data-testid="audit-filter-bar">
      <div className={styles.filterRow}>
        {/* 时间范围 - 开始时间 */}
        <div className={styles.filterItem}>
          <label className={styles.filterLabel} htmlFor="audit-start-time">
            开始时间
          </label>
          <input
            id="audit-start-time"
            type="datetime-local"
            className={styles.filterInput}
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              setValidationError(null);
            }}
            data-testid="audit-filter-start-time"
            aria-label="开始时间"
          />
        </div>

        {/* 时间范围 - 结束时间 */}
        <div className={styles.filterItem}>
          <label className={styles.filterLabel} htmlFor="audit-end-time">
            结束时间
          </label>
          <input
            id="audit-end-time"
            type="datetime-local"
            className={styles.filterInput}
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              setValidationError(null);
            }}
            data-testid="audit-filter-end-time"
            aria-label="结束时间"
          />
        </div>

        {/* 操作类型下拉框 - 动态枚举 */}
        <div className={styles.filterItem}>
          <label className={styles.filterLabel} htmlFor="audit-action-type">
            操作类型
          </label>
          <select
            id="audit-action-type"
            className={styles.filterSelect}
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            disabled={metaLoading}
            data-testid="audit-filter-action-type"
            aria-label="操作类型"
          >
            {metaLoading ? (
              <option value="">加载中...</option>
            ) : metaError ? (
              <option value="">加载失败</option>
            ) : (
              actionTypeSelectOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            )}
          </select>
        </div>

        {/* 操作人输入 */}
        <div className={styles.filterItem}>
          <label className={styles.filterLabel} htmlFor="audit-operator-id">
            操作人
          </label>
          <input
            id="audit-operator-id"
            type="text"
            className={styles.filterInput}
            placeholder="输入操作人ID"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            data-testid="audit-filter-operator-id"
            aria-label="操作人ID"
          />
        </div>

        {/* 操作按钮 */}
        <div className={styles.filterActions}>
          <button
            type="button"
            className={styles.searchButton}
            onClick={handleSearch}
            disabled={loading}
            data-testid="audit-filter-search-btn"
            aria-label="查询"
          >
            {loading ? '查询中...' : '查询'}
          </button>
          <button
            type="button"
            className={styles.resetButton}
            onClick={handleReset}
            disabled={loading}
            data-testid="audit-filter-reset-btn"
            aria-label="重置"
          >
            重置
          </button>
        </div>
      </div>

      {/* 验证错误提示 */}
      {validationError && (
        <div className={styles.validationError} data-testid="audit-filter-error" role="alert">
          {validationError}
        </div>
      )}

      {/* 元数据加载错误提示 */}
      {metaError && !validationError && (
        <div className={styles.metaError} data-testid="audit-filter-meta-error" role="alert">
          {metaError}
        </div>
      )}
    </div>
  );
};

FilterBar.displayName = 'FilterBar';

export { FilterBar };
export default FilterBar;