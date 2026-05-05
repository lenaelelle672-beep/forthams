/**
 * 审计日志筛选组件
 * 
 * 提供操作类型、时间范围、操作人三种筛选条件
 * 支持与 AuditService 集成，实现审计日志的精准过滤
 * 
 * @module AuditLogModule
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Form, Select, DatePicker, Input, Button, Space, Card } from 'antd';
import { FilterOutlined, SearchOutlined, ClearOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

import type { AuditLogOperationType } from '../../../types/audit.types';

const { RangePicker } = DatePicker;

/**
 * 筛选条件接口
 */
export interface AuditFilterValues {
  /** 操作类型筛选 */
  operationType?: AuditLogOperationType;
  /** 时间范围筛选 */
  dateRange?: [Dayjs, Dayjs];
  /** 操作人筛选 */
  operator?: string;
}

/**
 * 审计日志筛选组件属性
 */
export interface AuditFilterProps {
  /** 初始筛选值 */
  initialValues?: AuditFilterValues;
  /** 筛选确认回调 */
  onFilter: (values: AuditFilterValues) => void;
  /** 重置回调 */
  onReset?: () => void;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 操作类型选项配置
 */
const OPERATION_OPTIONS: Array<{
  value: AuditLogOperationType;
  label: string;
  color: string;
}> = [
  { value: 'CREATE', label: '创建', color: 'green' },
  { value: 'UPDATE', label: '更新', color: 'blue' },
  { value: 'DELETE', label: '删除', color: 'red' },
  { value: 'VIEW', label: '查看', color: 'default' },
  { value: 'EXPORT', label: '导出', color: 'purple' },
];

/**
 * 最大时间范围天数限制
 */
const MAX_RANGE_DAYS = 90;

/**
 * 审计日志筛选组件
 * 
 * 功能特性:
 * - 操作类型多选筛选
 * - 时间范围筛选（最大90天）
 * - 操作人模糊搜索
 * - 筛选条件持久化支持
 * 
 * @example
 * ```tsx
 * <AuditFilter
 *   onFilter={(values) => console.log('Filter:', values)}
 *   onReset={() => console.log('Reset')}
 * />
 * ```
 */
const AuditFilter: React.FC<AuditFilterProps> = ({
  initialValues,
  onFilter,
  onReset,
  loading = false,
  disabled = false,
  className,
}) => {
  const [form] = Form.useForm<AuditFilterValues>();
  const [activeFilters, setActiveFilters] = useState<number>(0);

  /**
   * 计算当前激活的筛选条件数量
   */
  const calculateActiveFilters = useCallback((values: AuditFilterValues): number => {
    let count = 0;
    if (values.operationType) count++;
    if (values.dateRange && values.dateRange.length === 2) count++;
    if (values.operator?.trim()) count++;
    return count;
  }, []);

  /**
   * 验证时间范围是否超过最大天数限制
   */
  const validateDateRange = useCallback((_: unknown, value: [Dayjs, Dayjs] | null): Promise<void> => {
    if (!value || value.length !== 2) {
      return Promise.resolve();
    }
    
    const [start, end] = value;
    const daysDiff = end.diff(start, 'day');
    
    if (daysDiff > MAX_RANGE_DAYS) {
      return Promise.reject(
        new Error(`时间范围不能超过 ${MAX_RANGE_DAYS} 天`)
      );
    }
    
    if (start.isAfter(end)) {
      return Promise.reject(new Error('结束时间必须晚于开始时间'));
    }
    
    return Promise.resolve();
  }, []);

  /**
   * 处理筛选提交
   */
  const handleFinish = useCallback((values: AuditFilterValues) => {
    const activeCount = calculateActiveFilters(values);
    setActiveFilters(activeCount);
    
    // 规范化筛选参数
    const normalizedValues: AuditFilterValues = {
      operationType: values.operationType,
      dateRange: values.dateRange,
      operator: values.operator?.trim() || undefined,
    };
    
    onFilter(normalizedValues);
  }, [calculateActiveFilters, onFilter]);

  /**
   * 处理重置操作
   */
  const handleReset = useCallback(() => {
    form.resetFields();
    setActiveFilters(0);
    onReset?.();
  }, [form, onReset]);

  /**
   * 禁用未来日期
   */
  const disabledDate = useCallback((current: Dayjs): boolean => {
    return current && current.isAfter(dayjs().endOf('day'));
  }, []);

  /**
   * 快速日期选择选项
   */
  const presetRanges = useMemo(() => ({
    '今天': [dayjs().startOf('day'), dayjs().endOf('day')],
    '最近7天': [dayjs().subtract(7, 'day'), dayjs()],
    '最近30天': [dayjs().subtract(30, 'day'), dayjs()],
    '最近90天': [dayjs().subtract(90, 'day'), dayjs()],
  }), []);

  /**
   * 筛选标签样式
   */
  const filterTagStyle = useMemo(() => ({
    backgroundColor: '#f6ffed',
    borderColor: '#52c41a',
    color: '#52c41a',
  }), []);

  return (
    <Card 
      className={className}
      size="small"
      title={
        <Space>
          <FilterOutlined />
          <span>审计日志筛选</span>
          {activeFilters > 0 && (
            <span style={filterTagStyle}>
              {activeFilters} 个筛选条件
            </span>
          )}
        </Space>
      }
    >
      <Form
        form={form}
        layout="inline"
        initialValues={initialValues}
        onFinish={handleFinish}
        size="middle"
        disabled={disabled || loading}
      >
        <Form.Item
          name="operationType"
          label="操作类型"
          style={{ marginBottom: 12 }}
        >
          <Select
            placeholder="选择操作类型"
            allowClear
            style={{ width: 160 }}
            options={OPERATION_OPTIONS.map(opt => ({
              value: opt.value,
              label: (
                <Space>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: opt.color === 'default' ? '#d9d9d9' : opt.color,
                      display: 'inline-block',
                    }}
                  />
                  {opt.label}
                </Space>
              ),
            }))}
          />
        </Form.Item>

        <Form.Item
          name="dateRange"
          label="时间范围"
          rules={[{ validator: validateDateRange }]}
          style={{ marginBottom: 12 }}
        >
          <RangePicker
            disabledDate={disabledDate}
            presets={presetRanges}
            format="YYYY-MM-DD"
            style={{ width: 280 }}
            placeholder={['开始日期', '结束日期']}
          />
        </Form.Item>

        <Form.Item
          name="operator"
          label="操作人"
          style={{ marginBottom: 12 }}
        >
          <Input
            placeholder="输入操作人姓名"
            allowClear
            style={{ width: 180 }}
            prefix={<span style={{ color: '#bfbfbf' }}>@</span>}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SearchOutlined />}
              loading={loading}
            >
              搜索
            </Button>
            <Button
              icon={<ClearOutlined />}
              onClick={handleReset}
              disabled={loading}
            >
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default AuditFilter;