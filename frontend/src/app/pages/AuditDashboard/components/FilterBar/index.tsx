/**
 * FilterBar Component
 * 
 * Provides filter controls for the Audit Dashboard including:
 * - Date range selection
 * - Operation type multi-select
 * - Operator ID search input
 * - Query and reset actions
 * 
 * @module AuditDashboard/FilterBar
 * @requires antd
 * @requires react
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DatePicker, Select, Input, Button, Space, Typography } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { SelectProps } from 'antd';

const { RangePicker } = DatePicker;
const { Text } = Typography;

/**
 * Supported operation action types for filtering audit logs.
 * 
 * @constant ACTION_TYPES
 * @type {SelectProps['options']}
 */
const ACTION_TYPE_OPTIONS: SelectProps['options'] = [
  { label: '创建 (CREATE)', value: 'CREATE' },
  { label: '更新 (UPDATE)', value: 'UPDATE' },
  { label: '删除 (DELETE)', value: 'DELETE' },
  { label: '查询 (QUERY)', value: 'QUERY' },
  { label: '审批 (APPROVE)', value: 'APPROVE' },
  { label: '驳回 (REJECT)', value: 'REJECT' },
];

/**
 * Props interface for FilterBar component.
 * 
 * @interface FilterBarProps
 */
export interface FilterBarProps {
  /** Callback fired when query filters change */
  onFilterChange: (filters: AuditFilterState) => void;
  /** Whether filters are currently being applied (loading state) */
  loading?: boolean;
}

/**
 * Represents the current state of all filter controls.
 * 
 * @interface AuditFilterState
 */
export interface AuditFilterState {
  /** Start of date range in ISO8601 format */
  startTime: string | null;
  /** End of date range in ISO8601 format */
  endTime: string | null;
  /** Operator identifier to filter by */
  operatorId: string;
  /** Array of action types to filter by */
  actionTypes: string[];
}

/**
 * Default empty filter state.
 */
const DEFAULT_FILTER_STATE: AuditFilterState = {
  startTime: null,
  endTime: null,
  operatorId: '',
  actionTypes: [],
};

/**
 * FilterBar - Audit Dashboard Filter Controls Component
 * 
 * Provides a toolbar with date range picker, action type multi-select,
 * operator ID input with debounce, and query/reset buttons for
 * filtering audit log data on the dashboard.
 * 
 * @component
 * @example
 * ```tsx
 * <FilterBar
 *   onFilterChange={(filters) => console.log(filters)}
 *   loading={false}
 * />
 * ```
 * 
 * @param props - FilterBarProps
 * @returns React element
 */
const FilterBar: React.FC<FilterBarProps> = ({
  onFilterChange,
  loading = false,
}) => {
  /**
   * Current filter state managed locally.
   * 
   * @state filterState
   */
  const [filterState, setFilterState] = useState<AuditFilterState>(DEFAULT_FILTER_STATE);
  
  /**
   * Debounced operator ID to prevent excessive filter updates.
   * 
   * @state debouncedOperatorId
   */
  const [debouncedOperatorId, setDebouncedOperatorId] = useState<string>('');
  
  /**
   * Timer reference for cleanup.
   * 
   * @ref debounceTimerRef
   */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Sync debounced operator ID to parent when it changes.
   * Triggers filter change callback after debounce delay.
   * 
   * @effect
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOperatorId(filterState.operatorId);
    }, 300);

    return () => clearTimeout(timer);
  }, [filterState.operatorId]);

  /**
   * Notify parent component when debounced values stabilize.
   * 
   * @effect
   */
  useEffect(() => {
    onFilterChange({
      ...filterState,
      operatorId: debouncedOperatorId,
    });
  }, [debouncedOperatorId, filterState.startTime, filterState.endTime, filterState.actionTypes]);

  /**
   * Handle date range change from RangePicker.
   * Converts Dayjs objects to ISO8601 strings.
   * 
   * @param dates - Array of Dayjs objects [start, end] or null
   */
  const handleDateRangeChange = useCallback(
    (dates: [Dayjs | null, Dayjs | null] | null) => {
      if (dates && dates[0] && dates[1]) {
        setFilterState((prev) => ({
          ...prev,
          startTime: dates[0]!.startOf('day').toISOString(),
          endTime: dates[1]!.endOf('day').toISOString(),
        }));
      } else {
        setFilterState((prev) => ({
          ...prev,
          startTime: null,
          endTime: null,
        }));
      }
    },
    []
  );

  /**
   * Handle action type multi-select change.
   * 
   * @param values - Array of selected action type values
   */
  const handleActionTypeChange = useCallback((values: string[]) => {
    setFilterState((prev) => ({
      ...prev,
      actionTypes: values,
    }));
  }, []);

  /**
   * Handle operator ID input change.
   * 
   * @param e - React.ChangeEvent from input
   */
  const handleOperatorIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilterState((prev) => ({
        ...prev,
        operatorId: e.target.value.trim(),
      }));
    },
    []
  );

  /**
   * Handle query button click.
   * Immediately triggers filter change callback.
   */
  const handleQuery = useCallback(() => {
    onFilterChange({
      ...filterState,
      operatorId: debouncedOperatorId,
    });
  }, [filterState, debouncedOperatorId, onFilterChange]);

  /**
   * Handle reset button click.
   * Clears all filters and resets to default state.
   */
  const handleReset = useCallback(() => {
    setFilterState(DEFAULT_FILTER_STATE);
    setDebouncedOperatorId('');
    onFilterChange(DEFAULT_FILTER_STATE);
  }, [onFilterChange]);

  /**
   * Determine if query button should be disabled.
   * Disabled when loading or when no filters are applied.
   */
  const isQueryDisabled = loading;

  /**
   * Determine if reset button should be disabled.
   * Disabled when already at default state.
   */
  const isResetDisabled = loading ||
    (filterState.startTime === null &&
      filterState.endTime === null &&
      filterState.operatorId === '' &&
      filterState.actionTypes.length === 0);

  return (
    <div
      className="audit-filter-bar"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        padding: '16px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        marginBottom: '16px',
      }}
      data-testid="audit-filter-bar"
      role="search"
      aria-label="审计日志筛选器"
    >
      {/* Date Range Section */}
      <Space direction="vertical" size={4}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          操作时间
        </Text>
        <RangePicker
          value={
            filterState.startTime && filterState.endTime
              ? [dayjs(filterState.startTime), dayjs(filterState.endTime)]
              : null
          }
          onChange={handleDateRangeChange}
          allowClear
          placeholder={['开始日期', '结束日期']}
          disabled={loading}
          style={{ width: 260 }}
          data-testid="filter-date-range"
        />
      </Space>

      {/* Action Type Multi-Select */}
      <Space direction="vertical" size={4}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          操作类型
        </Text>
        <Select
          mode="multiple"
          allowClear
          placeholder="选择操作类型"
          options={ACTION_TYPE_OPTIONS}
          value={filterState.actionTypes}
          onChange={handleActionTypeChange}
          disabled={loading}
          style={{ minWidth: 180, width: 180 }}
          maxTagCount="responsive"
          data-testid="filter-action-type"
        />
      </Space>

      {/* Operator ID Input */}
      <Space direction="vertical" size={4}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          操作者 ID
        </Text>
        <Input
          placeholder="输入操作者 ID"
          value={filterState.operatorId}
          onChange={handleOperatorIdChange}
          disabled={loading}
          allowClear
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          style={{ width: 160 }}
          data-testid="filter-operator-id"
        />
      </Space>

      {/* Action Buttons */}
      <Space style={{ marginTop: 20 }}>
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={handleQuery}
          disabled={isQueryDisabled}
          loading={loading}
          data-testid="filter-query-btn"
        >
          查询
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleReset}
          disabled={isResetDisabled}
          data-testid="filter-reset-btn"
        >
          重置
        </Button>
      </Space>
    </div>
  );
};

FilterBar.displayName = 'FilterBar';

export default FilterBar;