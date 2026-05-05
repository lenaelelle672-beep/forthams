/**
 * AuditFilter Component - 审计日志筛选器
 * 
 * 提供审计日志的筛选功能，支持按操作类型、时间范围和操作人进行筛选。
 * 
 * @module AuditFilter
 * @group Audit Components
 * @requires antd
 * @requires dayjs
 * 
 * @example
 * ```tsx
 * // 基础用法
 * <AuditFilter
 *   onFilterChange={(filters) => console.log(filters)}
 * />
 * 
 * // 带初始值
 * <AuditFilter
 *   initialValues={{
 *     operationType: 'UPDATE',
 *     startTime: '2024-01-01T00:00:00Z',
 *     endTime: '2024-12-31T23:59:59Z',
 *     operator: 'zhang.san'
 *   }}
 *   onFilterChange={handleFilterChange}
 *   loading={isLoading}
 * />
 * ```
 */

import React, { useCallback, useState } from 'react';
import { Form, Select, DatePicker, Input, Button, Space, Tag } from 'antd';
import { SearchOutlined, ClearOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { AuditOperationType } from '../../types/audit.types';

/**
 * 操作类型枚举值映射
 * 用于筛选器的下拉选项展示
 */
const OPERATION_TYPE_OPTIONS: { value: AuditOperationType; label: string; color: string }[] = [
  { value: 'CREATE', label: '创建', color: 'green' },
  { value: 'UPDATE', label: '更新', color: 'blue' },
  { value: 'DELETE', label: '删除', color: 'red' },
  { value: 'VIEW', label: '查看', color: 'cyan' },
  { value: 'EXPORT', label: '导出', color: 'purple' }
];

/**
 * 筛选器配置接口
 * 定义审计日志筛选的各项参数
 */
export interface AuditFilterConfig {
  /** 操作类型筛选 - 支持 CREATE, UPDATE, DELETE, VIEW, EXPORT */
  operationType?: AuditOperationType;
  /** 筛选起始时间 - ISO 8601 格式 */
  startTime?: string;
  /** 筛选结束时间 - ISO 8601 格式 */
  endTime?: string;
  /** 操作人名称筛选 */
  operator?: string;
}

/**
 * AuditFilter 组件属性接口
 */
export interface AuditFilterProps {
  /** 初始筛选值 */
  initialValues?: AuditFilterConfig;
  /** 筛选条件变更回调 */
  onFilterChange?: (filters: AuditFilterConfig) => void;
  /** 加载状态 - 禁用交互并显示加载指示 */
  loading?: boolean;
  /** 禁用状态 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 紧凑模式布局 */
  compact?: boolean;
}

/**
 * AuditFilter - 审计日志筛选器组件
 * 
 * 提供审计日志的筛选功能：
 * - 操作类型筛选（创建、更新、删除、查看、导出）
 * - 时间范围筛选（支持最大 90 天区间）
 * - 操作人名称筛选
 * 
 * @param props - 组件属性
 * @returns 筛选器 React 组件
 */
export const AuditFilter: React.FC<AuditFilterProps> = ({
  initialValues,
  onFilterChange,
  loading = false,
  disabled = false,
  className = '',
  compact = false
}) => {
  // 使用 Form 管理表单状态
  const [form] = Form.useForm();
  
  // 本地筛选状态
  const [localFilters, setLocalFilters] = useState<AuditFilterConfig>(initialValues || {});
  
  // 活跃筛选标签计数
  const [activeFilterCount, setActiveFilterCount] = useState<number>(0);

  /**
   * 处理表单值变更
   * 
   * @param changedValues - 变更的值对象
   */
  const handleValuesChange = useCallback((changedValues: Partial<AuditFilterConfig>) => {
    const newFilters = { ...localFilters, ...changedValues };
    setLocalFilters(newFilters);
    
    // 计算活跃筛选数量
    const count = Object.values(newFilters).filter(v => v !== undefined && v !== '').length;
    setActiveFilterCount(count);
    
    // 触发外部回调
    onFilterChange?.(newFilters);
  }, [localFilters, onFilterChange]);

  /**
   * 处理时间范围变更
   * 将 Dayjs 对象转换为 ISO 8601 格式字符串
   * 
   * @param dates - 日期范围数组 [开始日期, 结束日期]
   */
  const handleDateRangeChange = useCallback(
    (dates: [Dayjs | null, Dayjs | null] | null) => {
      const newFilters: AuditFilterConfig = {
        ...localFilters,
        startTime: dates?.[0]?.toISOString(),
        endTime: dates?.[1]?.toISOString()
      };
      
      setLocalFilters(newFilters);
      
      // 计算活跃筛选数量
      const count = Object.values(newFilters).filter(v => v !== undefined && v !== '').length;
      setActiveFilterCount(count);
      
      onFilterChange?.(newFilters);
    },
    [localFilters, onFilterChange]
  );

  /**
   * 清除所有筛选条件
   * 重置表单为空状态
   */
  const handleClearFilters = useCallback(() => {
    form.resetFields();
    setLocalFilters({});
    setActiveFilterCount(0);
    onFilterChange?.({});
  }, [form, onFilterChange]);

  /**
   * 禁用日期选择器中的未来日期和超过 90 天的日期
   * 
   * @param current - 当前日期
   * @returns 是否禁用
   */
  const disabledDate = (current: Dayjs): boolean => {
    const today = dayjs();
    const maxDate = today.add(90, 'day');
    const minDate = today.subtract(90, 'day');
    
    return !current || current > maxDate || current < minDate;
  };

  // 紧凑模式样式
  const compactStyle: React.CSSProperties = compact ? {
    marginBottom: 0
  } : {};

  // 筛选器容器样式
  const filterContainerStyle: React.CSSProperties = compact ? {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  } : {};

  return (
    <div 
      className={`audit-filter ${className}`}
      data-testid="audit-filter-container"
      style={compactStyle}
    >
      <Form
        form={form}
        layout={compact ? 'inline' : 'vertical'}
        initialValues={initialValues}
        onValuesChange={handleValuesChange}
        disabled={disabled || loading}
        style={{ width: '100%' }}
      >
        {compact ? (
          // 紧凑模式布局
          <div style={filterContainerStyle}>
            {/* 筛选图标 + 活跃筛选数量 */}
            <FilterOutlined style={{ color: activeFilterCount > 0 ? '#1890ff' : '#999' }} />
            {activeFilterCount > 0 && (
              <Tag color="blue">{activeFilterCount}</Tag>
            )}
            
            {/* 操作类型筛选 */}
            <Form.Item name="operationType" noStyle>
              <Select
                data-testid="operation-filter"
                placeholder="操作类型"
                allowClear
                style={{ width: 120 }}
                options={OPERATION_TYPE_OPTIONS.map(opt => ({
                  value: opt.value,
                  label: opt.label
                }))}
              />
            </Form.Item>

            {/* 时间范围筛选 */}
            <Form.Item name="dateRange" noStyle>
              <DatePicker.RangePicker
                data-testid="date-range-picker"
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                disabledDate={disabledDate}
                onChange={handleDateRangeChange as any}
                style={{ width: 260 }}
                placeholder={['开始时间', '结束时间']}
              />
            </Form.Item>

            {/* 操作人筛选 */}
            <Form.Item name="operator" noStyle>
              <Input
                data-testid="operator-input"
                placeholder="操作人"
                style={{ width: 120 }}
                allowClear
              />
            </Form.Item>

            {/* 搜索按钮 */}
            <Button
              data-testid="search-button"
              type="primary"
              icon={<SearchOutlined />}
              loading={loading}
              size="small"
            >
              搜索
            </Button>

            {/* 清除按钮 */}
            <Button
              data-testid="clear-button"
              icon={<ClearOutlined />}
              onClick={handleClearFilters}
              disabled={loading || activeFilterCount === 0}
              size="small"
            >
              清除
            </Button>
          </div>
        ) : (
          // 标准模式布局
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* 筛选条件行 */}
            <Space wrap size="middle">
              {/* 操作类型筛选 */}
              <Form.Item 
                name="operationType" 
                label="操作类型"
                style={{ marginBottom: 0 }}
              >
                <Select
                  data-testid="operation-filter"
                  placeholder="请选择操作类型"
                  allowClear
                  style={{ width: 160 }}
                  options={OPERATION_TYPE_OPTIONS.map(opt => ({
                    value: opt.value,
                    label: (
                      <span>
                        <Tag color={opt.color} style={{ marginRight: 8 }}>
                          {opt.label}
                        </Tag>
                        {opt.value}
                      </span>
                    )
                  }))}
                />
              </Form.Item>

              {/* 时间范围筛选 */}
              <Form.Item 
                name="dateRange" 
                label="时间范围"
                style={{ marginBottom: 0 }}
              >
                <DatePicker.RangePicker
                  data-testid="date-range-picker"
                  showTime={{ format: 'HH:mm:ss' }}
                  format="YYYY-MM-DD HH:mm:ss"
                  disabledDate={disabledDate}
                  onChange={handleDateRangeChange as any}
                  style={{ width: 340 }}
                  placeholder={['开始时间', '结束时间']}
                />
              </Form.Item>

              {/* 操作人筛选 */}
              <Form.Item 
                name="operator" 
                label="操作人"
                style={{ marginBottom: 0 }}
              >
                <Input
                  data-testid="operator-input"
                  placeholder="请输入操作人名称"
                  style={{ width: 160 }}
                  allowClear
                  prefix={<span style={{ color: '#999' }}>@</span>}
                />
              </Form.Item>
            </Space>

            {/* 操作按钮行 */}
            <Space size="middle">
              <Button
                data-testid="search-button"
                type="primary"
                icon={<SearchOutlined />}
                loading={loading}
              >
                筛选
              </Button>
              
              <Button
                data-testid="clear-button"
                icon={<ClearOutlined />}
                onClick={handleClearFilters}
                disabled={loading}
              >
                重置
              </Button>
              
              {/* 活跃筛选提示 */}
              {activeFilterCount > 0 && (
                <Tag color="blue">
                  已应用 {activeFilterCount} 个筛选条件
                </Tag>
              )}
            </Space>
          </Space>
        )}
      </Form>
    </div>
  );
};

/**
 * 预设的常用筛选配置
 * 提供快速应用的筛选模板
 */
export const PRESET_FILTERS = {
  /** 今天 */
  today: (): AuditFilterConfig => ({
    startTime: dayjs().startOf('day').toISOString(),
    endTime: dayjs().endOf('day').toISOString()
  }),
  
  /** 本周 */
  thisWeek: (): AuditFilterConfig => ({
    startTime: dayjs().startOf('week').toISOString(),
    endTime: dayjs().endOf('week').toISOString()
  }),
  
  /** 本月 */
  thisMonth: (): AuditFilterConfig => ({
    startTime: dayjs().startOf('month').toISOString(),
    endTime: dayjs().endOf('month').toISOString()
  }),
  
  /** 最近 7 天 */
  last7Days: (): AuditFilterConfig => ({
    startTime: dayjs().subtract(7, 'day').toISOString(),
    endTime: dayjs().toISOString()
  }),
  
  /** 最近 30 天 */
  last30Days: (): AuditFilterConfig => ({
    startTime: dayjs().subtract(30, 'day').toISOString(),
    endTime: dayjs().toISOString()
  }),
  
  /** 最近 90 天（最大范围） */
  last90Days: (): AuditFilterConfig => ({
    startTime: dayjs().subtract(90, 'day').toISOString(),
    endTime: dayjs().toISOString()
  })
} as const;

export default AuditFilter;