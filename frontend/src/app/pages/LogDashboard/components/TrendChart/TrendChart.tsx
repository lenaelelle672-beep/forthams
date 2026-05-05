/**
 * TrendChart - 日志趋势图表组件
 * 
 * 功能说明：
 * - 展示日志量时间序列折线图，支持日/周/月粒度
 * - 从 `/api/v1/logs/trends` 获取聚合数据
 * - 支持筛选条件联动，自动刷新数据
 * 
 * 使用方式：
 * ```tsx
 * <TrendChart
 *   granularity="day"
 *   filters={filters}
 *   height={400}
 *   onDataPointClick={(point) => console.log(point)}
 * />
 * ```
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from 'recharts';
import { Spin, Alert, Empty, DatePicker, Select, Button } from 'antd';
import dayjs, { Dayjs } from 'dayjs';

// ============================================================
// 类型定义
// ============================================================

export interface TrendDataPoint {
  /** 时间戳 (ISO 8601 格式) */
  timestamp: string;
  /** 日志数量 */
  count: number;
  /** 操作类型拆分 (可选) */
  breakdown?: Record<string, number>;
}

export interface TrendChartProps {
  /** 粒度: day | week | month */
  granularity?: 'day' | 'week' | 'month';
  /** 筛选条件 */
  filters?: TrendFilters;
  /** 图表高度 */
  height?: number;
  /** 点击数据点回调 */
  onDataPointClick?: (point: TrendDataPoint) => void;
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 外部传入的数据 */
  data?: TrendDataPoint[];
  /** 自定义样式类名 */
  className?: string;
}

export interface TrendFilters {
  /** 开始时间 */
  start_time?: string;
  /** 结束时间 */
  end_time?: string;
  /** 操作类型: CREATE | UPDATE | DELETE | READ */
  action?: string;
  /** 状态: SUCCESS | FAILURE */
  status?: string;
  /** 操作者 ID */
  operator_id?: string;
  /** 是否显示 breakdown */
  breakdown?: boolean;
}

// ============================================================
// 常量定义
// ============================================================

const GRANULARITY_OPTIONS = [
  { label: '按天', value: 'day' },
  { label: '按周', value: 'week' },
  { label: '按月', value: 'month' },
] as const;

const CHART_COLORS = {
  primary: '#1890ff',
  secondary: '#52c41a',
  tertiary: '#faad14',
  grid: '#e8e8e8',
  text: '#666666',
};

const DATE_FORMAT_MAP: Record<string, string> = {
  day: 'MM-DD',
  week: 'MM-DD',
  month: 'YYYY-MM',
};

// ============================================================
// API 客户端
// ============================================================

interface TrendApiResponse {
  data_points: TrendDataPoint[];
  granularity: string;
  total: number;
}

interface ApiError {
  code: string;
  message: string;
}

/**
 * 获取趋势数据
 * 
 * @param granularity - 时间粒度
 * @param filters - 筛选条件
 * @returns 趋势数据数组
 */
async function fetchTrendData(
  granularity: string,
  filters: TrendFilters
): Promise<TrendDataPoint[]> {
  // 构造查询参数
  const params = new URLSearchParams({
    granularity,
    start_time: filters.start_time || dayjs().subtract(30, 'day').toISOString(),
    end_time: filters.end_time || dayjs().toISOString(),
  });

  // 可选参数
  if (filters.action) {
    params.append('action', filters.action);
  }
  if (filters.status) {
    params.append('status', filters.status);
  }
  if (filters.operator_id) {
    params.append('operator_id', filters.operator_id);
  }
  if (filters.breakdown) {
    params.append('breakdown', 'action');
  }

  const apiUrl = `/api/v1/logs/trends?${params.toString()}`;

  // 发起请求
  // 注意: 实际项目中应使用配置好的 axios 实例，这里简化为 fetch
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // 实际项目中应从 auth context 获取 token
      'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
    },
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.message || '获取趋势数据失败');
  }

  const data: TrendApiResponse = await response.json();
  return data.data_points;
}

// ============================================================
// 子组件
// ============================================================

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    payload: TrendDataPoint;
  }>;
  label?: string;
}

/**
 * 自定义图表提示组件
 */
function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const dataPoint = payload[0].payload;
  const formattedDate = dayjs(dataPoint.timestamp).format('YYYY-MM-DD HH:mm');

  return (
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        padding: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, color: '#333' }}>
        {formattedDate}
      </p>
      <p style={{ margin: '8px 0 0', color: CHART_COLORS.primary }}>
        日志数量: <strong>{payload[0].value}</strong>
      </p>
      {dataPoint.breakdown && (
        <div style={{ marginTop: '8px', borderTop: '1px solid #e8e8e8', paddingTop: '8px' }}>
          {Object.entries(dataPoint.breakdown).map(([action, count]) => (
            <p key={action} style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>
              {action}: {count}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 加载骨架屏
 */
function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fafafa',
        borderRadius: '8px',
      }}
    >
      <Spin size="large" tip="加载趋势数据..." />
    </div>
  );
}

/**
 * 空数据状态
 */
function EmptyState({ message }: { message?: string }) {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={message || '暂无趋势数据'}
      style={{
        height: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
}

/**
 * 错误状态
 */
function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <Alert
      message="加载失败"
      description={error}
      type="error"
      showIcon
      action={
        onRetry ? (
          <Button size="small" onClick={onRetry}>
            重试
          </Button>
        ) : undefined
      }
    />
  );
}

// ============================================================
// 主组件
// ============================================================

/**
 * TrendChart - 日志趋势图表组件
 * 
 * @description
 * 展示系统操作日志的时间趋势变化，支持日/周/月三种时间粒度。
 * 可通过筛选条件控制数据范围，点击数据点可查看详细数据。
 * 
 * @example
 * ```tsx
 * // 基础用法
 * <TrendChart granularity="day" />
 * 
 * // 带筛选条件
 * <TrendChart
 *   granularity="week"
 *   filters={{ action: 'DELETE', status: 'SUCCESS' }}
 *   height={500}
 *   onDataPointClick={(point) => {
 *     console.log('点击:', point);
 *   }}
 * />
 * ```
 */
const TrendChart: React.FC<TrendChartProps> = ({
  granularity = 'day',
  filters = {},
  height = 400,
  onDataPointClick,
  loading: externalLoading,
  data: externalData,
  className,
}) => {
  // ---- 状态定义 ----
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGranularity, setSelectedGranularity] = useState(granularity);
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // ---- 计算属性 ----
  const isLoading = externalLoading ?? internalLoading;
  const displayData = externalData ?? data;

  // ---- 数据获取 ----
  const loadData = useCallback(async () => {
    if (!externalData) {
      setInternalLoading(true);
      setError(null);

      try {
        const result = await fetchTrendData(selectedGranularity, filters);
        setData(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        setError(errorMessage);
      } finally {
        setInternalLoading(false);
      }
    }
  }, [selectedGranularity, filters, externalData]);

  // 初始加载 & 筛选条件变化时重新加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 粒度变化时重新加载
  useEffect(() => {
    setSelectedGranularity(granularity);
  }, [granularity]);

  // ---- 事件处理 ----
  
  /**
   * 处理粒度变更
   */
  const handleGranularityChange = (value: string) => {
    setSelectedGranularity(value as 'day' | 'week' | 'month');
  };

  /**
   * 处理数据点点击
   */
  const handlePointClick = (data: unknown) => {
    if (onDataPointClick && data) {
      onDataPointClick(data as TrendDataPoint);
    }
  };

  /**
   * 处理鼠标按下 - 开始区域选择
   */
  const handleMouseDown = (e: { activeLabel?: string }) => {
    if (e && e.activeLabel) {
      setRefAreaLeft(e.activeLabel);
      setIsSelecting(true);
    }
  };

  /**
   * 处理鼠标移动 - 绘制选中区域
   */
  const handleMouseMove = (e: { activeLabel?: string }) => {
    if (isSelecting && e && e.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  };

  /**
   * 处理鼠标释放 - 完成区域选择
   */
  const handleMouseUp = () => {
    if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
      // 可以触发筛选更新或其他操作
      console.log(`选中区间: ${refAreaLeft} ~ ${refAreaRight}`);
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setIsSelecting(false);
  };

  // ---- 数据转换 ----
  const chartData = displayData.map((point) => ({
    ...point,
    date: dayjs(point.timestamp).format(DATE_FORMAT_MAP[selectedGranularity]),
    fullDate: dayjs(point.timestamp).format('YYYY-MM-DD HH:mm'),
  }));

  // ---- 渲染逻辑 ----
  
  // 加载状态
  if (isLoading) {
    return <ChartSkeleton height={height} />;
  }

  // 错误状态
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={loadData}
      />
    );
  }

  // 空数据状态
  if (!chartData.length) {
    return <EmptyState />;
  }

  // ---- 渲染图表 ----
  return (
    <div className={className} data-testid="trend-chart-container">
      {/* 控制栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          padding: '0 8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#666', fontSize: '14px' }}>时间粒度:</span>
          <Select
            value={selectedGranularity}
            onChange={handleGranularityChange}
            options={GRANULARITY_OPTIONS.map((opt) => ({
              label: opt.label,
              value: opt.value,
            }))}
            style={{ width: 120 }}
            disabled={isLoading}
          />
        </div>
        <div style={{ color: '#999', fontSize: '12px' }}>
          共 {displayData.length} 个数据点
        </div>
      </div>

      {/* 图表容器 */}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={(data) => {
            if (data && data.activePayload) {
              handlePointClick(data.activePayload[0]?.payload);
            }
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.grid}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
            tickLine={{ stroke: CHART_COLORS.grid }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
            tickLine={{ stroke: CHART_COLORS.grid }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            width={60}
            allowDecimals={false}
            label={{
              value: '日志数量',
              angle: -90,
              position: 'insideLeft',
              style: { fill: CHART_COLORS.text, fontSize: 12 },
            }}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{
              stroke: CHART_COLORS.primary,
              strokeWidth: 1,
              strokeDasharray: '4 4',
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => <span style={{ color: CHART_COLORS.text }}>{value}</span>}
          />
          
          {/* 主线条: 总日志量 */}
          <Line
            type="monotone"
            dataKey="count"
            name="日志总数"
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={{
              r: 4,
              fill: CHART_COLORS.primary,
              stroke: '#fff',
              strokeWidth: 2,
            }}
            activeDot={{
              r: 6,
              fill: CHART_COLORS.primary,
              stroke: '#fff',
              strokeWidth: 2,
            }}
            animationDuration={500}
            animationEasing="ease-out"
          />

          {/* 区域选择指示器 */}
          {refAreaLeft && refAreaRight && (
            <ReferenceArea
              x1={refAreaLeft}
              x2={refAreaRight}
              strokeOpacity={0.3}
              fill={CHART_COLORS.primary}
              fillOpacity={0.1}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* 提示信息 */}
      <div
        style={{
          textAlign: 'center',
          color: '#999',
          fontSize: '12px',
          marginTop: '8px',
        }}
      >
        点击数据点查看详情 | 拖拽可选择时间范围
      </div>
    </div>
  );
};

// ============================================================
// 导出
// ============================================================

export default TrendChart;

export { TrendChart };
export type {
  TrendChartProps,
  TrendDataPoint,
  TrendFilters,
  TrendApiResponse,
};