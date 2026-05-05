import React, { useMemo, useCallback } from 'react';
import { DatePicker, Space, Card, Typography, Button } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useGlobalDateRange } from '../hooks/useGlobalDateRange';

const { Text } = Typography;

/**
 * GlobalDateRangeFilter — 全局时间范围联动筛选器
 *
 * 提供全局日期范围选择，驱动仪表板趋势图、类型分布图、TOP10 排行图联动刷新。
 * 选中值写入 Zustand store `globalDateRange`，默认覆盖最近 30 天。
 * 日期以 ISO 8601 格式存储于 store，供各 API 调用直接使用。
 *
 * 快捷预设：最近 7 天 / 最近 30 天 / 最近 90 天（对应 ATB-08 步骤 04）
 *
 * @see useGlobalDateRange — Layer 2 Hook，提供 dateRange / setDateRange / last7d / last30d / last90d
 */
export const GlobalDateRangeFilter: React.FC = () => {
  const { dateRange, setDateRange, last7d, last30d, last90d } = useGlobalDateRange();

  /** 将 store 中的 ISO 字符串转换为 Dayjs 对象，供 RangePicker 受控使用 */
  const rangePickerValue: [Dayjs, Dayjs] | null = useMemo(() => {
    if (dateRange?.start && dateRange?.end) {
      return [dayjs(dateRange.start), dayjs(dateRange.end)];
    }
    return null;
  }, [dateRange]);

  /**
   * 处理 RangePicker 手动选择变更
   * 将选中的 Dayjs 对象格式化为 ISO 8601 字符串后写入 Zustand store
   */
  const handleRangeChange = useCallback(
    (dates: [Dayjs | null, Dayjs | null] | null) => {
      if (dates && dates[0] && dates[1]) {
        setDateRange({
          start: dates[0].startOf('day').toISOString(),
          end: dates[1].endOf('day').toISOString(),
        });
      }
    },
    [setDateRange],
  );

  /** 快捷预设按钮配置 — 对应 ATB-08 步骤 04 的三个预设 */
  const presets = [
    { label: '最近 7 天', action: last7d, testId: 'preset-last-7d' },
    { label: '最近 30 天', action: last30d, testId: 'preset-last-30d' },
    { label: '最近 90 天', action: last90d, testId: 'preset-last-90d' },
  ];

  return (
    <Card
      size="small"
      style={{ marginBottom: 24 }}
      styles={{ body: { padding: '12px 24px' } }}
      data-testid="global-date-range-filter"
      role="group"
      aria-label="全局时间范围筛选"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Text strong style={{ fontSize: 15, color: 'rgba(0, 0, 0, 0.85)' }}>
          时间范围
        </Text>

        {/* 快捷预设按钮组 */}
        <Space size={4}>
          {presets.map(({ label, action, testId }) => (
            <Button
              key={label}
              type="link"
              size="small"
              onClick={action}
              data-testid={testId}
              aria-label={`设置时间范围为${label}`}
              style={{ padding: '0 8px', fontSize: 13 }}
            >
              {label}
            </Button>
          ))}
        </Space>

        {/* 分隔线 */}
        <div
          style={{
            width: 1,
            height: 24,
            backgroundColor: '#f0f0f0',
            flexShrink: 0,
          }}
          aria-hidden="true"
        />

        {/* 主日期范围选择器 */}
        <DatePicker.RangePicker
          value={rangePickerValue}
          onChange={handleRangeChange}
          format="YYYY-MM-DD"
          style={{ width: 280 }}
          allowClear={false}
          placeholder={['开始日期', '结束日期']}
          aria-label="选择自定义日期范围"
        />

        {/* 当前生效范围文字展示 */}
        <Text type="secondary" style={{ fontSize: 13 }} aria-live="polite">
          {dateRange?.start && dateRange?.end
            ? `${dayjs(dateRange.start).format('YYYY-MM-DD')} 至 ${dayjs(dateRange.end).format('YYYY-MM-DD')}`
            : '未选择范围'}
        </Text>
      </div>
    </Card>
  );
};

export default GlobalDateRangeFilter;