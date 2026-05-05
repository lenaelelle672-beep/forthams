/**
 * OperationLogDashboard FilterControls Component
 * @module pages/OperationLogDashboard/components/FilterControls
 * @description 操作日志仪表板筛选控件组件
 * 
 * 功能说明:
 * - 提供用户、时间范围、操作类型三重筛选能力
 * - 支持筛选条件重置
 * - 异常操作高亮标记逻辑
 * 
 * @author SWARM-003 Implementation Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { DatePicker, Select, Button, Space, Tag } from 'antd';
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

import { useAuditData } from '../../AuditDashboard/hooks/useAuditData';
import type { AuditLog, OperationType } from '../../types/audit.types';

const { RangePicker } = DatePicker;

/** 高风险操作类型枚举 */
const HIGH_RISK_OPERATIONS: OperationType[] = [
  'DELETE',
  'DROP',
  'GRANT',
  'REVOKE',
  'TRUNCATE',
  'MODIFY_PERMISSION',
  'BULK_EXPORT',
];

/** 操作类型选项配置 */
const OPERATION_TYPE_OPTIONS = [
  { label: '全部类型', value: 'ALL' },
  { label: '创建 (CREATE)', value: 'CREATE' },
  { label: '更新 (UPDATE)', value: 'UPDATE' },
  { label: '删除 (DELETE)', value: 'DELETE' },
  { label: '查询 (READ)', value: 'READ' },
  { label: '导出 (EXPORT)', value: 'EXPORT' },
  { label: '授权 (GRANT)', value: 'GRANT' },
  { label: '回收 (REVOKE)', value: 'REVOKE' },
  { label: '批量操作 (BULK)', value: 'BULK' },
];

/** 用户列表选项（模拟数据，实际应从 API 获取） */
const USER_OPTIONS = [
  { label: '全部用户', value: 'ALL' },
  { label: '管理员 (admin)', value: 'admin' },
  { label: '运维人员 (operator)', value: 'operator' },
  { label: '审计员 (auditor)', value: 'auditor' },
  { label: '普通用户 (user)', value: 'user' },
];

/** 筛选器状态接口 */
export interface FilterState {
  userId: string;
  operationType: string;
  dateRange: [Dayjs | null, Dayjs | null] | null;
}

/** FilterControls 组件 Props 接口 */
export interface FilterControlsProps {
  /** 筛选变化回调 */
  onFilterChange?: (filters: FilterState) => void;
  /** 是否显示重置按钮 */
  showReset?: boolean;
  /** 是否禁用筛选器 */
  disabled?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 操作日志仪表板筛选控件组件
 * @description 提供用户、时间范围、操作类型三重筛选能力
 * 
 * @param props - FilterControlsProps
 * @returns React.ReactElement
 * 
 * @example
 * ```tsx
 * <FilterControls
 *   onFilterChange={(filters) => console.log(filters)}
 *   showReset={true}
 *   disabled={false}
 * />
 * ```
 */
export const FilterControls: React.FC<FilterControlsProps> = ({
  onFilterChange,
  showReset = true,
  disabled = false,
  className = '',
}) => {
  // 筛选状态管理
  const [filters, setFilters] = useState<FilterState>({
    userId: 'ALL',
    operationType: 'ALL',
    dateRange: null,
  });

  /**
   * 触发筛选变化事件
   * @param newFilters - 新的筛选状态
   */
  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  }, [onFilterChange]);

  /**
   * 处理用户筛选变化
   * @param value - 选中的用户ID
   */
  const handleUserChange = useCallback((value: string) => {
    handleFilterChange({ ...filters, userId: value });
  }, [filters, handleFilterChange]);

  /**
   * 处理操作类型筛选变化
   * @param value - 选中的操作类型
   */
  const handleOperationTypeChange = useCallback((value: string) => {
    handleFilterChange({ ...filters, operationType: value });
  }, [filters, handleFilterChange]);

  /**
   * 处理时间范围筛选变化
   * @param dates - 选中的日期范围
   */
  const handleDateRangeChange = useCallback((
    dates: [Dayjs | null, Dayjs | null] | null
  ) => {
    handleFilterChange({ ...filters, dateRange: dates });
  }, [filters, handleFilterChange]);

  /**
   * 重置所有筛选条件
   */
  const handleReset = useCallback(() => {
    const defaultFilters: FilterState = {
      userId: 'ALL',
      operationType: 'ALL',
      dateRange: null,
    };
    setFilters(defaultFilters);
    onFilterChange?.(defaultFilters);
  }, [onFilterChange]);

  /**
   * 判断是否为高风险操作
   * @param operationType - 操作类型
   * @returns boolean
   */
  const isHighRiskOperation = useCallback((operationType: string): boolean => {
    return HIGH_RISK_OPERATIONS.includes(operationType as OperationType);
  }, []);

  /**
   * 获取高风险操作标签颜色
   * @param operationType - 操作类型
   * @returns string 标签颜色
   */
  const getRiskTagColor = useCallback((operationType: string): string => {
    if (isHighRiskOperation(operationType)) {
      return 'red';
    }
    return 'default';
  }, [isHighRiskOperation]);

  return (
    <div className={`filter-controls ${className}`} data-testid="filter-controls">
      <Space wrap size="middle" style={{ width: '100%' }}>
        {/* 用户筛选 */}
        <div className="filter-item filter-user" data-testid="filter-user">
          <span className="filter-label">用户:</span>
          <Select
            value={filters.userId}
            onChange={handleUserChange}
            options={USER_OPTIONS}
            style={{ width: 160 }}
            disabled={disabled}
            placeholder="选择用户"
            allowClear
          />
        </div>

        {/* 操作类型筛选 */}
        <div className="filter-item filter-operation-type" data-testid="filter-operation-type">
          <span className="filter-label">操作类型:</span>
          <Select
            value={filters.operationType}
            onChange={handleOperationTypeChange}
            options={OPERATION_TYPE_OPTIONS}
            style={{ width: 160 }}
            disabled={disabled}
            placeholder="选择类型"
            allowClear
          />
        </div>

        {/* 时间范围筛选 */}
        <div className="filter-item filter-date-range" data-testid="filter-date-range">
          <span className="filter-label">时间范围:</span>
          <RangePicker
            value={filters.dateRange}
            onChange={handleDateRangeChange}
            disabled={disabled}
            placeholder={['开始日期', '结束日期']}
            allowClear
            presets={[
              { label: '最近7天', value: [dayjs().subtract(7, 'day'), dayjs()] },
              { label: '最近30天', value: [dayjs().subtract(30, 'day'), dayjs()] },
              { label: '最近90天', value: [dayjs().subtract(90, 'day'), dayjs()] },
            ]}
          />
        </div>

        {/* 重置按钮 */}
        {showReset && (
          <div className="filter-actions">
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
              disabled={disabled}
              data-testid="filter-reset-btn"
            >
              重置
            </Button>
          </div>
        )}
      </Space>

      {/* 高风险操作说明标签 */}
      <div className="risk-indicator" data-testid="risk-indicator">
        <Space size="small">
          <Tag color="red" icon={<FilterOutlined />}>
            高风险操作: {HIGH_RISK_OPERATIONS.join(', ')}
          </Tag>
        </Space>
      </div>
    </div>
  );
};

/**
 * 根据筛选条件过滤日志数据
 * @param logs - 原始日志数组
 * @param filters - 筛选条件
 * @returns 过滤后的日志数组
 */
export const filterAuditLogs = (
  logs: AuditLog[],
  filters: FilterState
): AuditLog[] => {
  return logs.filter((log) => {
    // 用户筛选
    if (filters.userId !== 'ALL' && log.user !== filters.userId) {
      return false;
    }

    // 操作类型筛选
    if (filters.operationType !== 'ALL' && log.operationType !== filters.operationType) {
      return false;
    }

    // 时间范围筛选
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      const logTime = dayjs(log.timestamp);
      const startTime = filters.dateRange[0];
      const endTime = filters.dateRange[1];
      
      if (!logTime.isAfter(startTime) || !logTime.isBefore(endTime.add(1, 'day'))) {
        return false;
      }
    }

    return true;
  });
};

/**
 * 判断日志是否为异常操作
 * @param log - 审计日志
 * @returns boolean
 */
export const isAnomalyOperation = (log: AuditLog): boolean => {
  return HIGH_RISK_OPERATIONS.includes(log.operationType as OperationType);
};

/**
 * 获取异常操作高亮样式类名
 * @param log - 审计日志
 * @returns string CSS class name
 */
export const getAnomalyHighlightClass = (log: AuditLog): string => {
  if (isAnomalyOperation(log)) {
    return 'anomaly-highlight';
  }
  return '';
};

export default FilterControls;