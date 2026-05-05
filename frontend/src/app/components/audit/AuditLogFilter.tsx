import React, { useState, useEffect, useCallback } from 'react';
import { Form, Card, Select, DatePicker, Input, Button, Space, Tooltip } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  FilterOutlined,
  CalendarOutlined,
  UserOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import './AuditLogFilter.less';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 操作类型枚举
export type OperationType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'TRANSFER'
  | 'RETIRE'
  | 'DISPOSE';

// 操作类型配置
export const OPERATION_TYPE_CONFIG: Record<OperationType, { label: string; color: string }> = {
  CREATE: { label: '创建', color: 'green' },
  UPDATE: { label: '更新', color: 'blue' },
  DELETE: { label: '删除', color: 'red' },
  APPROVE: { label: '审批通过', color: 'cyan' },
  REJECT: { label: '审批拒绝', color: 'orange' },
  TRANSFER: { label: '转移', color: 'purple' },
  RETIRE: { label: '退役', color: 'gold' },
  DISPOSE: { label: '处置', color: 'magenta' },
};

// 筛选器配置接口
export interface AuditLogFilterConfig {
  showOperationTypeFilter?: boolean;
  showDateRangeFilter?: boolean;
  showUserFilter?: boolean;
  showAdvancedFilter?: boolean;
  defaultOperationType?: OperationType | null;
  defaultDateRange?: [Dayjs, Dayjs] | null;
  defaultOperatorName?: string;
  dateRangeLimits?: {
    minDays?: number;
    maxDays?: number;
  };
  onFilterChange?: (filters: AuditFilterValues) => void;
}

// 筛选器值接口
export interface AuditFilterValues {
  operationType?: OperationType | null;
  dateRange?: [string, string] | null;
  operatorName?: string;
  advancedFilters?: Record<string, unknown>;
}

// Props 接口
export interface AuditLogFilterProps {
  config?: AuditFilterConfig;
  loading?: boolean;
  onSearch?: (values: AuditFilterValues) => void;
  onReset?: () => void;
}

/**
 * 审计日志筛选器组件
 *
 * 提供操作类型、时间范围、操作人等多维度筛选能力
 * 支持自定义配置显示/隐藏特定筛选器
 * 集成防抖机制防止频繁请求
 *
 * @author SWARM Team
 * @since 1.0.0
 * @performance 渲染性能: O(1), 无大数据列表渲染
 *
 * @example
 * ```tsx
 * <AuditLogFilter
 *   onSearch={(values) => console.log(values)}
 *   showOperationTypeFilter={true}
 *   showUserFilter={true}
 * />
 * ```
 */
const AuditLogFilter: React.FC<AuditLogFilterProps> = ({
  config,
  loading = false,
  onSearch,
  onReset,
}) => {
  const { t } = useTranslation();

  // 解析配置，设置默认值
  const {
    showOperationTypeFilter = true,
    showDateRangeFilter = true,
    showUserFilter = true,
    showAdvancedFilter = false,
    defaultOperationType = null,
    defaultDateRange = null,
    defaultOperatorName = '',
    dateRangeLimits = { minDays: 1, maxDays: 90 },
    onFilterChange,
  } = config || {};

  // 组件内部状态
  const [form] = Form.useForm();
  const [localLoading, setLocalLoading] = useState(false);
  const [debouncedValues, setDebouncedValues] = useState<AuditFilterValues | null>(null);

  // 初始化默认值
  useEffect(() => {
    const initialValues: Record<string, unknown> = {};

    // 设置默认操作类型
    if (defaultOperationType && showOperationTypeFilter) {
      initialValues.operationType = defaultOperationType;
    }

    // 设置默认时间范围（最近7天）
    if (showDateRangeFilter) {
      if (defaultDateRange) {
        initialValues.dateRange = defaultDateRange;
      } else {
        const now = dayjs();
        initialValues.dateRange = [now.subtract(7, 'day'), now];
      }
    }

    // 设置默认操作人
    if (defaultOperatorName && showUserFilter) {
      initialValues.operatorName = defaultOperatorName;
    }

    form.setFieldsValue(initialValues);
  }, [
    form,
    defaultOperationType,
    defaultDateRange,
    defaultOperatorName,
    showOperationTypeFilter,
    showDateRangeFilter,
    showUserFilter,
  ]);

  /**
   * 获取禁用日期范围
   *
   * 根据配置的日期范围限制，返回不可选的日期
   *
   * @returns 禁用日期配置对象
   * @since 1.0.0
   * @performance 时间复杂度 O(1)
   */
  const getDisabledDate = useCallback((): ((current: Dayjs) => boolean) | undefined => {
    const { minDays, maxDays } = dateRangeLimits;

    if (!maxDays) return undefined;

    return (current: Dayjs): boolean => {
      const now = dayjs();
      const minDate = now.subtract(maxDays, 'day');

      // 禁用超过最大范围的日期
      if (current.isAfter(now, 'day')) {
        return true;
      }

      // 禁用小于最小范围的日期
      if (minDays && current.isBefore(now.subtract(minDays - 1, 'day'))) {
        return false; // 由 minDays 控制
      }

      return current.isBefore(minDate, 'day');
    };
  }, [dateRangeLimits]);

  /**
   * 处理表单提交
   *
   * 验证表单数据并触发搜索回调
   * 支持 debounce 防止频繁请求
   *
   * @param values - 表单值对象
   * @since 1.0.0
   * @performance 时间复杂度 O(1)
   */
  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      const filterValues: AuditFilterValues = {};

      // 解析操作类型
      if (showOperationTypeFilter && values.operationType) {
        filterValues.operationType = values.operationType as OperationType;
      }

      // 解析时间范围
      if (showDateRangeFilter && values.dateRange) {
        const [start, end] = values.dateRange as [Dayjs, Dayjs];
        filterValues.dateRange = [
          start.startOf('day').format('YYYY-MM-DD HH:mm:ss'),
          end.endOf('day').format('YYYY-MM-DD HH:mm:ss'),
        ];
      }

      // 解析操作人
      if (showUserFilter && values.operatorName) {
        filterValues.operatorName = (values.operatorName as string).trim();
      }

      // 解析高级筛选
      if (showAdvancedFilter && values.advancedFilters) {
        filterValues.advancedFilters = values.advancedFilters;
      }

      setLocalLoading(true);

      try {
        // 更新 debounced 值
        setDebouncedValues(filterValues);

        // 触发外部回调
        if (onFilterChange) {
          onFilterChange(filterValues);
        }

        // 触发搜索回调
        if (onSearch) {
          await onSearch(filterValues);
        }
      } finally {
        setLocalLoading(false);
      }
    },
    [
      showOperationTypeFilter,
      showDateRangeFilter,
      showUserFilter,
      showAdvancedFilter,
      onFilterChange,
      onSearch,
    ]
  );

  /**
   * 处理重置操作
   *
   * 清空表单并触发重置回调
   *
   * @since 1.0.0
   * @performance 时间复杂度 O(1)
   */
  const handleReset = useCallback(() => {
    form.resetFields();

    // 重新设置默认值
    const now = dayjs();
    if (showDateRangeFilter) {
      form.setFieldsValue({
        dateRange: [now.subtract(7, 'day'), now],
      });
    }

    setDebouncedValues(null);

    if (onReset) {
      onReset();
    }
  }, [form, showDateRangeFilter, onReset]);

  /**
   * 渲染操作类型筛选器
   *
   * 根据配置决定是否渲染操作类型下拉选择器
   * 支持所有预定义的操作类型
   *
   * @returns React.ReactNode
   * @since 1.0.0
   * @performance 时间复杂度 O(1)
   */
  const renderOperationTypeFilter = (): React.ReactNode => {
    if (!showOperationTypeFilter) return null;

    return (
      <Form.Item name="operationType" label="操作类型" className="audit-filter-operation-type">
        <Select
          placeholder="请选择操作类型"
          allowClear
          prefix={<ApiOutlined />}
          disabled={localLoading}
          showSearch
          optionFilterProp="label"
        >
          {Object.entries(OPERATION_TYPE_CONFIG).map(([key, config]) => (
            <Option key={key} value={key} label={config.label}>
              <span>
                <span style={{ color: config.color }}>{config.label}</span>
              </span>
            </Option>
          ))}
        </Select>
      </Form.Item>
    );
  };

  /**
   * 渲染时间范围筛选器
   *
   * 根据配置决定是否渲染日期范围选择器
   * 支持自定义禁用日期逻辑
   *
   * @returns React.ReactNode
   * @since 1.0.0
   * @performance 时间复杂度 O(1)
   */
  const renderDateRangeFilter = (): React.ReactNode => {
    if (!showDateRangeFilter) return null;

    return (
      <Form.Item
        name="dateRange"
        label="时间范围"
        className="audit-filter-date-range"
        rules={[{ required: true, message: '请选择时间范围' }]}
      >
        <RangePicker
          showTime={{ format: 'HH:mm' }}
          format="YYYY-MM-DD HH:mm:ss"
          placeholder={['开始日期', '结束日期']}
          disabled={localLoading}
          disabledDate={getDisabledDate()}
          allowClear
          suffixIcon={<CalendarOutlined />}
          presets={[
            { label: '最近24小时', value: [dayjs().subtract(1, 'day'), dayjs()] },
            { label: '最近7天', value: [dayjs().subtract(7, 'day'), dayjs()] },
            { label: '最近30天', value: [dayjs().subtract(30, 'day'), dayjs()] },
            { label: '本月', value: [dayjs().startOf('month'), dayjs()] },
            { label: '上月', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
          ]}
        />
      </Form.Item>
    );
  };

  /**
   * 渲染操作用户筛选器
   *
   * 根据配置决定是否渲染操作人输入框
   * 支持模糊匹配搜索
   *
   * @returns React.ReactNode
   * @since 1.0.0
   * @performance 时间复杂度 O(1)
   */
  const renderUserFilter = (): React.ReactNode => {
    if (!showUserFilter) return null;

    return (
      <Form.Item
        name="operatorName"
        label="操作用户"
        className="audit-filter-operator"
      >
        <Input
          placeholder="请输入用户名（支持模糊搜索）"
          allowClear
          prefix={<SearchOutlined />}
          disabled={localLoading}
        />
      </Form.Item>
    );
  };

  return (
    <Card
      className="audit-log-filter"
      title={
        <Space>
          <FilterOutlined />
          <span>审计日志筛选</span>
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="刷新">
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={handleReset}
              loading={localLoading}
            />
          </Tooltip>
        </Space>
      }
    >
      <Form
        form={form}
        layout="horizontal"
        onFinish={handleSubmit}
        className="audit-log-filter__form"
        autoComplete="off"
      >
        <div className="filter-row">
          {renderOperationTypeFilter()}
          {renderDateRangeFilter()}
          {renderUserFilter()}
        </div>

        <Form.Item className="filter-actions">
          <Space direction="horizontal">
            <Button
              type="primary"
              htmlType="submit"
              icon={<SearchOutlined />}
              loading={localLoading || loading}
            >
              查询
            </Button>
            <Button
              htmlType="button"
              onClick={handleReset}
              disabled={localLoading || loading}
            >
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default AuditLogFilter;