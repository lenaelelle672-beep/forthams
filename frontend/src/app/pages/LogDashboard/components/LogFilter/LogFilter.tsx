/**
 * LogFilter Component
 * 
 * Filter component for the Operation Log Dashboard (SWARM-003).
 * Provides multi-dimensional filtering for audit logs including:
 * - Time range selection (presets and custom range)
 * - Operation type filtering (CREATE/UPDATE/DELETE/READ)
 * - Status filtering (SUCCESS/FAILURE)
 * - Operator filtering
 * 
 * @module LogDashboard/components/LogFilter
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { DatePicker, Select, Input, Button, Space, Tag } from 'antd';
import { FilterOutlined, ClearOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import './LogFilter.module.css';

const { RangePicker } = DatePicker;

/**
 * Operation action types for log filtering
 */
export type LogAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'ALL';

/**
 * Log status types for filtering
 */
export type LogStatus = 'SUCCESS' | 'FAILURE' | 'ALL';

/**
 * Filter state interface representing current filter values
 */
export interface LogFilterState {
  startTime: string | null;
  endTime: string | null;
  action: LogAction;
  status: LogStatus;
  operatorId: string;
  operatorName: string;
}

/**
 * Props interface for LogFilter component
 */
export interface LogFilterProps {
  /** Callback fired when filter values change */
  onChange: (filters: LogFilterState) => void;
  /** Initial filter values */
  initialValues?: Partial<LogFilterState>;
  /** Loading state indicator */
  loading?: boolean;
  /** Disable the filter controls */
  disabled?: boolean;
}

/**
 * Preset time range options
 */
const TIME_PRESETS = [
  { label: '最近 7 天', value: 7 },
  { label: '最近 30 天', value: 30 },
  { label: '最近 90 天', value: 90 },
];

/**
 * Operation type options for dropdown
 */
const ACTION_OPTIONS = [
  { label: '全部', value: 'ALL' },
  { label: '创建 (CREATE)', value: 'CREATE' },
  { label: '修改 (UPDATE)', value: 'UPDATE' },
  { label: '删除 (DELETE)', value: 'DELETE' },
  { label: '查询 (READ)', value: 'READ' },
];

/**
 * Status options for dropdown
 */
const STATUS_OPTIONS = [
  { label: '全部', value: 'ALL' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILURE' },
];

/**
 * Default filter state
 */
const DEFAULT_FILTER_STATE: LogFilterState = {
  startTime: null,
  endTime: null,
  action: 'ALL',
  status: 'ALL',
  operatorId: '',
  operatorName: '',
};

/**
 * LogFilter Component
 * 
 * Provides filtering capabilities for the audit log dashboard:
 * - Time range selection with presets
 * - Operation type filtering
 * - Status filtering
 * - Operator search by name or ID
 * 
 * @param props - Component props
 * @returns React component
 */
const LogFilter: React.FC<LogFilterProps> = ({
  onChange,
  initialValues,
  loading = false,
  disabled = false,
}) => {
  const [filters, setFilters] = useState<LogFilterState>({
    ...DEFAULT_FILTER_STATE,
    ...initialValues,
  });

  const [expanded, setExpanded] = useState<boolean>(true);

  /**
   * Handle time range preset selection
   * @param days - Number of days from now
   */
  const handlePresetSelect = useCallback((days: number) => {
    const end = dayjs();
    const start = end.subtract(days, 'day');
    
    const newFilters: LogFilterState = {
      ...filters,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
    
    setFilters(newFilters);
    onChange(newFilters);
  }, [filters, onChange]);

  /**
   * Handle custom date range change
   * @param dates - Array of Dayjs objects [start, end]
   */
  const handleDateRangeChange = useCallback((dates: [Dayjs | null, Dayjs | null] | null) => {
    if (!dates || !dates[0] || !dates[1]) {
      const newFilters: LogFilterState = {
        ...filters,
        startTime: null,
        endTime: null,
      };
      setFilters(newFilters);
      onChange(newFilters);
      return;
    }

    const newFilters: LogFilterState = {
      ...filters,
      startTime: dates[0].toISOString(),
      endTime: dates[1].toISOString(),
    };
    
    setFilters(newFilters);
    onChange(newFilters);
  }, [filters, onChange]);

  /**
   * Handle operation type change
   * @param action - Selected action type
   */
  const handleActionChange = useCallback((action: LogAction) => {
    const newFilters: LogFilterState = {
      ...filters,
      action,
    };
    
    setFilters(newFilters);
    onChange(newFilters);
  }, [filters, onChange]);

  /**
   * Handle status change
   * @param status - Selected status
   */
  const handleStatusChange = useCallback((status: LogStatus) => {
    const newFilters: LogFilterState = {
      ...filters,
      status,
    };
    
    setFilters(newFilters);
    onChange(newFilters);
  }, [filters, onChange]);

  /**
   * Handle operator search input change
   * @param e - Change event
   */
  const handleOperatorSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const newFilters: LogFilterState = {
      ...filters,
      operatorName: value,
      operatorId: value,
    };
    
    setFilters(newFilters);
  }, [filters]);

  /**
   * Handle operator search with debounce
   */
  const handleOperatorSearchComplete = useCallback(() => {
    onChange(filters);
  }, [filters, onChange]);

  /**
   * Clear all filters to default state
   */
  const handleClear = useCallback(() => {
    setFilters(DEFAULT_FILTER_STATE);
    onChange(DEFAULT_FILTER_STATE);
  }, [onChange]);

  /**
   * Toggle expanded/collapsed state
   */
  const toggleExpanded = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  /**
   * Check if any filters are active (non-default)
   */
  const hasActiveFilters = filters.action !== 'ALL' || 
    filters.status !== 'ALL' || 
    filters.operatorName !== '' ||
    filters.startTime !== null;

  /**
   * Get active filter count for badge display
   */
  const getActiveFilterCount = (): number => {
    let count = 0;
    if (filters.action !== 'ALL') count++;
    if (filters.status !== 'ALL') count++;
    if (filters.operatorName !== '') count++;
    if (filters.startTime !== null) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="log-filter-container" data-testid="log-filter">
      <div className="log-filter-header" onClick={toggleExpanded}>
        <div className="log-filter-title">
          <FilterOutlined />
          <span>日志筛选</span>
          {activeFilterCount > 0 && (
            <Tag color="blue" className="filter-count-tag">
              {activeFilterCount} 个筛选条件
            </Tag>
          )}
        </div>
        <Button 
          type="text" 
          size="small"
          className="expand-toggle"
          icon={expanded ? '▲' : '▼'}
        >
          {expanded ? '收起' : '展开'}
        </Button>
      </div>

      {expanded && (
        <div className="log-filter-body">
          <div className="filter-section">
            <div className="filter-label">时间范围</div>
            <div className="filter-controls">
              <Space.Compact>
                {TIME_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    size="small"
                    onClick={() => handlePresetSelect(preset.value)}
                    disabled={disabled || loading}
                    type={filters.startTime && 
                      dayjs().subtract(preset.value, 'day').isSame(dayjs(filters.startTime), 'day') 
                      ? 'primary' : 'default'}
                  >
                    {preset.label}
                  </Button>
                ))}
              </Space.Compact>
              <RangePicker
                value={filters.startTime && filters.endTime 
                  ? [dayjs(filters.startTime), dayjs(filters.endTime)] 
                  : null}
                onChange={handleDateRangeChange}
                disabled={disabled || loading}
                allowClear
                format="YYYY-MM-DD"
                placeholder={['开始日期', '结束日期']}
                className="date-range-picker"
              />
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-section">
              <div className="filter-label">操作类型</div>
              <Select
                value={filters.action}
                onChange={handleActionChange}
                options={ACTION_OPTIONS}
                disabled={disabled || loading}
                style={{ width: 160 }}
                className="filter-select"
              />
            </div>

            <div className="filter-section">
              <div className="filter-label">状态</div>
              <Select
                value={filters.status}
                onChange={handleStatusChange}
                options={STATUS_OPTIONS}
                disabled={disabled || loading}
                style={{ width: 120 }}
                className="filter-select"
              />
            </div>

            <div className="filter-section">
              <div className="filter-label">操作者</div>
              <Input
                placeholder="搜索操作者"
                value={filters.operatorName}
                onChange={handleOperatorSearch}
                onPressEnter={handleOperatorSearchComplete}
                disabled={disabled || loading}
                allowClear
                style={{ width: 180 }}
                prefix={<SearchOutlined />}
              />
            </div>
          </div>

          <div className="filter-actions">
            <Space>
              <Button
                icon={<SearchOutlined />}
                type="primary"
                onClick={() => onChange(filters)}
                loading={loading}
                disabled={disabled}
              >
                查询
              </Button>
              {hasActiveFilters && (
                <Button
                  icon={<ClearOutlined />}
                  onClick={handleClear}
                  disabled={disabled || loading}
                >
                  清空
                </Button>
              )}
            </Space>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogFilter;