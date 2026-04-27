/**
 * AuditDashboardPage — 审计日志仪表板页面容器
 *
 * 三层信息架构：趋势总览 → 分布画像 → 明细下钻
 *
 * G-1: OperationTrendChart  — 操作趋势折线图（日/周/月粒度可切换）
 * G-2: TypeDistributionBar  — 操作类型分布柱状图
 * G-3: TopOperatorsChart    — 操作人排行 TOP10 横向条形图
 * G-4: AuditLogTable        — 可分页可筛选审计日志明细表格
 * G-5: GlobalDateRangeFilter— 全局时间范围联动筛选器
 * G-6: AuditDashboardPage   — 仪表板页面容器与布局骨架
 *
 * [SWARM-P1-005-FE] Phase 1 — Iteration 1
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Row,
  Col,
  Card,
  Table,
  Select,
  DatePicker,
  Space,
  Spin,
  message,
  Button,
  Typography,
  Empty,
  Tag,
  Radio,
  Result,
} from 'antd';
import {
  FilterOutlined,
  ReloadOutlined,
  CalendarOutlined,
  BarChartOutlined,
  LineChartOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/* ==========================================================================
   Types
   ========================================================================== */

/** Single audit log entry returned by the backend */
interface AuditLog {
  id: string;
  timestamp: string;
  operator: string;
  actionType: string;
  module: string;
  description: string;
  ipAddress: string;
  status: 'success' | 'failure';
}

/** One data-point on the trend line chart */
interface TrendDataPoint {
  date: string;
  count: number;
}

/** Backend response for trend data */
interface TrendResponse {
  granularity: string;
  dataPoints: TrendDataPoint[];
}

/** One bar entry in the type-distribution chart */
interface TypeDistributionItem {
  type: string;
  count: number;
}

/** Backend response for type distribution */
interface TypeDistributionResponse {
  categories: TypeDistributionItem[];
}

/** One bar entry in the top-operators chart */
interface OperatorRankItem {
  name: string;
  count: number;
}

/** Backend response for top operators */
interface TopOperatorsResponse {
  operators: OperatorRankItem[];
}

/** Generic paginated response from the backend */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

/** Granularity options for the trend chart */
type Granularity = 'day' | 'week' | 'month';

/* ==========================================================================
   API Service Layer
   In production this lives in  services/audit-log-service.ts  and uses the
   unified Axios instance from  services/http.ts.
   ========================================================================== */

const auditApi = {
  /** GET /api/audit-logs/trends?granularity=&start=&end= */
  fetchTrends: async (
    granularity: Granularity,
    start: string,
    end: string,
    signal?: AbortSignal,
  ): Promise<TrendResponse> => {
    const unit = granularity === 'day' ? 'day' : granularity === 'week' ? 'week' : 'month';
    const count = granularity === 'day' ? 30 : 12;
    const dataPoints: TrendDataPoint[] = Array.from({ length: count }, (_, i) => ({
      date: dayjs(start).add(i, unit as dayjs.ManipulateType).format('YYYY-MM-DD'),
      count: Math.floor(Math.random() * 100) + 20,
    }));
    return { granularity, dataPoints };
  },

  /** GET /api/audit-logs/stats/by-type?start=&end= */
  fetchTypeDistribution: async (
    start: string,
    end: string,
    signal?: AbortSignal,
  ): Promise<TypeDistributionResponse> => {
    const types = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT', 'CONFIG_CHANGE'];
    return {
      categories: types.map((type) => ({ type, count: Math.floor(Math.random() * 200) + 10 })),
    };
  },

  /** GET /api/audit-logs/stats/top-operators?limit=10&start=&end= */
  fetchTopOperators: async (
    start: string,
    end: string,
    signal?: AbortSignal,
  ): Promise<TopOperatorsResponse> => {
    const names = [
      'admin',
      'sys_monitor',
      'dev_user_1',
      'security_auditor',
      'ops_manager',
      'api_service',
    ];
    return {
      operators: names
        .map((name, i) => ({ name, count: Math.floor(Math.random() * 500) + (200 - i * 30) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  },

  /** GET /api/audit-logs?page=&size=&type=&operator=&module=&start=&end= */
  fetchAuditLogs: async (
    params: {
      page: number;
      size: number;
      type?: string;
      operator?: string;
      module?: string;
      start?: string;
      end?: string;
    },
    signal?: AbortSignal,
  ): Promise<PaginatedResponse<AuditLog>> => {
    const total = 124;
    const offset = (params.page - 1) * params.size;
    const len = Math.min(params.size, Math.max(0, total - offset));
    const items: AuditLog[] = Array.from({ length: len }, (_, i) => ({
      id: `log-${offset + i + 1}`,
      timestamp: dayjs()
        .subtract(offset + i, 'hour')
        .format('YYYY-MM-DD HH:mm:ss'),
      operator: ['admin', 'sys_monitor', 'dev_user_1'][Math.floor(Math.random() * 3)],
      actionType: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN'][Math.floor(Math.random() * 4)],
      module: ['Auth', 'User Management', 'System Config', 'Data Export'][
        Math.floor(Math.random() * 4)
      ],
      description: `Performed ${
        ['create user', 'update config', 'delete record', 'login'][Math.floor(Math.random() * 4)]
      } operation`,
      ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
      status: Math.random() > 0.1 ? 'success' : 'failure',
    }));
    return { items, total, page: params.page, size: params.size };
  },
};

/* ==========================================================================
   ErrorBoundary (page-level)
   ========================================================================== */

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="页面错误"
          subTitle={this.state.error?.message ?? '未知错误'}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              重新加载
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}

/* ==========================================================================
   ChartError — shared error / empty / loading wrapper for chart cards
   ========================================================================== */

interface ChartWrapperProps {
  loading: boolean;
  error?: Error | null;
  onRetry: () => void;
  height: number;
  children: React.ReactNode;
}

const ChartWrapper: React.FC<ChartWrapperProps> = ({
  loading,
  error,
  onRetry,
  height,
  children,
}) => {
  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="加载中…" size="large" />
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ textAlign: 'center', paddingTop: height / 3 }}>
        <Result
          status="warning"
          title="加载失败"
          subTitle="数据加载失败，请重试"
          extra={
            <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
              重试
            </Button>
          }
        />
      </div>
    );
  }
  if (React.Children.count(children) === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="暂无数据" />
      </div>
    );
  }
  return <>{children}</>;
};

/* ==========================================================================
   GlobalDateRangeFilter  (G-5)
   ========================================================================== */

const PRESETS = [
  { label: '最近 7 天', days: 7 },
  { label: '最近 30 天', days: 30 },
  { label: '最近 90 天', days: 90 },
] as const;

interface GlobalDateRangeFilterProps {
  dateRange: [Dayjs, Dayjs];
  onRangeChange: (range: [Dayjs, Dayjs]) => void;
  loading?: boolean;
}

/** Top-level date range filter with quick preset buttons (7d / 30d / 90d). */
const GlobalDateRangeFilter: React.FC<GlobalDateRangeFilterProps> = ({
  dateRange,
  onRangeChange,
  loading,
}) => (
  <Card size="small" style={{ marginBottom: 24 }}>
    <Space wrap size="middle">
      <CalendarOutlined />
      <Text strong>全局时间范围</Text>
      <RangePicker
        value={dateRange}
        format="YYYY-MM-DD"
        allowClear={false}
        onChange={(dates) => {
          if (dates && dates[0] && dates[1]) {
            onRangeChange([dates[0], dates[1]]);
          }
        }}
        disabled={loading}
      />
      {PRESETS.map(({ label, days }) => (
        <Button
          key={days}
          size="small"
          type={
            dateRange[0].isSame(dayjs().subtract(days, 'day'), 'day') ? 'primary' : 'default'
          }
          onClick={() => onRangeChange([dayjs().subtract(days, 'day'), dayjs()])}
        >
          {label}
        </Button>
      ))}
    </Space>
  </Card>
);

/* ==========================================================================
   OperationTrendChart  (G-1)
   ========================================================================== */

interface OperationTrendChartProps {
  data: TrendDataPoint[];
  loading: boolean;
  error?: Error | null;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  onRetry: () => void;
}

/** Line chart showing operation trends with day/week/month granularity toggle. */
const OperationTrendChart: React.FC<OperationTrendChartProps> = ({
  data,
  loading,
  error,
  granularity,
  onGranularityChange,
  onRetry,
}) => {
  const option = useMemo(
    () => ({
      tooltip: { trigger: 'axis' as const },
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: 'category' as const,
        data: data.map((d) => d.date),
        axisLine: { lineStyle: { color: '#ccc' } },
        axisLabel: { rotate: data.length > 15 ? 30 : 0 },
      },
      yAxis: {
        type: 'value' as const,
        splitLine: { lineStyle: { type: 'dashed' as const } },
        name: '操作次数',
      },
      series: [
        {
          name: '操作量',
          type: 'line',
          smooth: true,
          data: data.map((d) => d.count),
          itemStyle: { color: '#1677ff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(22, 119, 255, 0.3)' },
              { offset: 1, color: 'rgba(22, 119, 255, 0)' },
            ]),
          },
          lineStyle: { width: 2 },
          symbolSize: 4,
        },
      ],
    }),
    [data],
  );

  return (
    <Card
      title={
        <>
          <LineChartOutlined /> 操作趋势
        </>
      }
      size="small"
      extra={
        <Radio.Group
          value={granularity}
          onChange={(e) => onGranularityChange(e.target.value)}
          size="small"
          data-testid="granularity-radio"
        >
          <Radio.Button value="day">日</Radio.Button>
          <Radio.Button value="week">周</Radio.Button>
          <Radio.Button value="month">月</Radio.Button>
        </Radio.Group>
      }
      style={{ marginBottom: 24 }}
    >
      <div data-testid="trend-chart" style={{ height: 320 }}>
        <ChartWrapper loading={loading} error={error} onRetry={onRetry} height={320}>
          <ReactECharts
            option={option}
            style={{ height: '100%' }}
            notMerge
            lazyUpdate
            echarts={echarts}
          />
        </ChartWrapper>
      </div>
    </Card>
  );
};

/* ==========================================================================
   TypeDistributionBar  (G-2)
   ========================================================================== */

const BAR_COLORS = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'];

interface TypeDistributionBarProps {
  data: TypeDistributionItem[];
  loading: boolean;
  error?: Error | null;
  onRetry: () => void;
}

/** Vertical bar chart showing operation type distribution. */
const TypeDistributionBar: React.FC<TypeDistributionBarProps> = ({
  data,
  loading,
  error,
  onRetry,
}) => {
  const option = useMemo(
    () => ({
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
      grid: { left: 120, right: 40, top: 10, bottom: 20 },
      xAxis: { type: 'value' as const, splitLine: { show: false } },
      yAxis: {
        type: 'category' as const,
        data: data.map((d) => d.type),
        axisTick: { show: false },
      },
      series: [
        {
          name: '操作次数',
          type: 'bar',
          data: data.map((d, i) => ({
            value: d.count,
            itemStyle: { color: BAR_COLORS[i % BAR_COLORS.length] },
          })),
          label: { show: true, position: 'right' as const },
          barMaxWidth: 24,
        },
      ],
    }),
    [data],
  );

  return (
    <Card
      title={
        <>
          <BarChartOutlined /> 操作类型分布
        </>
      }
      size="small"
      style={{ height: '100%' }}
    >
      <div data-testid="type-distribution-chart" style={{ height: 280 }}>
        <ChartWrapper loading={loading} error={error} onRetry={onRetry} height={280}>
          <ReactECharts
            option={option}
            style={{ height: '100%' }}
            notMerge
            lazyUpdate
            echarts={echarts}
          />
        </ChartWrapper>
      </div>
    </Card>
  );
};

/* ==========================================================================
   TopOperatorsChart  (G-3)
   ========================================================================== */

interface TopOperatorsChartProps {
  data: OperatorRankItem[];
  loading: boolean;
  error?: Error | null;
  onRetry: () => void;
}

/** Horizontal bar chart showing TOP-10 operators by operation count. */
const TopOperatorsChart: React.FC<TopOperatorsChartProps> = ({
  data,
  loading,
  error,
  onRetry,
}) => {
  /* Sort descending so the longest bar is at the top */
  const sorted = useMemo(() => [...data].sort((a, b) => b.count - a.count), [data]);

  const option = useMemo(
    () => ({
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
      grid: { left: 120, right: 40, top: 10, bottom: 20 },
      xAxis: { type: 'value' as const },
      yAxis: {
        type: 'category' as const,
        data: sorted.map((d) => d.name),
        axisTick: { show: false },
      },
      series: [
        {
          name: '操作次数',
          type: 'bar',
          data: sorted.map((d) => ({
            value: d.count,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#722ed1' },
                { offset: 1, color: '#b37feb' },
              ]),
            },
          })),
          label: { show: true, position: 'right' as const },
          barMaxWidth: 20,
        },
      ],
    }),
    [sorted],
  );

  return (
    <Card
      title={
        <>
          <TeamOutlined /> 操作人排行 TOP10
        </>
      }
      size="small"
      style={{ height: '100%' }}
    >
      <div data-testid="top-operators-chart" style={{ height: 280 }}>
        <ChartWrapper loading={loading} error={error} onRetry={onRetry} height={280}>
          <ReactECharts
            option={option}
            style={{ height: '100%' }}
            notMerge
            lazyUpdate
            echarts={echarts}
          />
        </ChartWrapper>
      </div>
    </Card>
  );
};

/* ==========================================================================
   AuditLogTable  (G-4)
   ========================================================================== */

/** Colour map for operation type tags */
const ACTION_TYPE_COLORS: Record<string, string> = {
  CREATE: 'blue',
  UPDATE: 'orange',
  DELETE: 'red',
  LOGIN: 'green',
  EXPORT: 'purple',
  CONFIG_CHANGE: 'cyan',
};

/** Available operation type options (in production, fetched from API) */
const TYPE_OPTIONS = [
  { label: 'CREATE', value: 'CREATE' },
  { label: 'UPDATE', value: 'UPDATE' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'LOGIN', value: 'LOGIN' },
  { label: 'EXPORT', value: 'EXPORT' },
  { label: 'CONFIG_CHANGE', value: 'CONFIG_CHANGE' },
];

/** Available operator options (in production, fetched from API) */
const OPERATOR_OPTIONS = [
  { label: 'admin', value: 'admin' },
  { label: 'sys_monitor', value: 'sys_monitor' },
  { label: 'dev_user_1', value: 'dev_user_1' },
  { label: 'security_auditor', value: 'security_auditor' },
  { label: 'ops_manager', value: 'ops_manager' },
  { label: 'api_service', value: 'api_service' },
];

/** Available module options (in production, fetched from API) */
const MODULE_OPTIONS = [
  { label: 'Auth', value: 'Auth' },
  { label: 'User Management', value: 'User Management' },
  { label: 'System Config', value: 'System Config' },
  { label: 'Data Export', value: 'Data Export' },
];

interface TableFilters {
  type?: string;
  operator?: string;
  module?: string;
  dateRange?: [Dayjs, Dayjs];
}

interface AuditLogTableProps {
  data: AuditLog[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  filters: TableFilters;
  onFiltersChange: (filters: TableFilters) => void;
  onResetFilters: () => void;
}

/** Paginated & filterable audit log detail table. */
const AuditLogTable: React.FC<AuditLogTableProps> = ({
  data,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  filters,
  onFiltersChange,
  onResetFilters,
}) => {
  /* Column definitions — order matches ATB-05 step 02 */
  const columns: ColumnsType<AuditLog> = [
    {
      title: '操作时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 130,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '操作类型',
      dataIndex: 'actionType',
      key: 'actionType',
      width: 130,
      render: (type: string) => (
        <Tag color={ACTION_TYPE_COLORS[type] ?? 'default'}>{type}</Tag>
      ),
    },
    {
      title: '模块名',
      dataIndex: 'module',
      key: 'module',
      width: 150,
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '操作描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'IP 地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
    },
    {
      title: '操作结果',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) =>
        status === 'success' ? (
          <Tag color="success">成功</Tag>
        ) : (
          <Tag color="error">失败</Tag>
        ),
    },
  ];

  const paginationConfig: TablePaginationConfig | false =
    total > 0
      ? {
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (t) => `共 ${t} 条`,
          onChange: onPageChange,
        }
      : false; /* Hide pagination when results are empty (ATB-07 step 07) */

  return (
    <Card
      title={
        <>
          <UnorderedListOutlined /> 审计日志明细
        </>
      }
      size="small"
    >
      {/* Filter row */}
      <div style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <FilterOutlined />
          <Text strong>筛选</Text>

          {/* Local date range (independent from global) — ATB-08 step 03 */}
          <RangePicker
            value={filters.dateRange}
            format="YYYY-MM-DD"
            placeholder={['开始日期', '结束日期']}
            allowClear
            onChange={(dates) =>
              onFiltersChange({
                ...filters,
                dateRange: dates && dates[0] && dates[1] ? [dates[0], dates[1]] : undefined,
              })
            }
          />

          <Select
            value={filters.type}
            placeholder="操作类型"
            allowClear
            style={{ width: 150 }}
            data-testid="filter-type"
            onChange={(val) => onFiltersChange({ ...filters, type: val })}
            options={TYPE_OPTIONS}
          />

          <Select
            value={filters.operator}
            placeholder="操作人"
            allowClear
            showSearch
            style={{ width: 170 }}
            data-testid="filter-operator"
            onChange={(val) => onFiltersChange({ ...filters, operator: val })}
            filterOption={(input, option) =>
              (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={OPERATOR_OPTIONS}
          />

          <Select
            value={filters.module}
            placeholder="模块名"
            allowClear
            style={{ width: 170 }}
            data-testid="filter-module"
            onChange={(val) => onFiltersChange({ ...filters, module: val })}
            options={MODULE_OPTIONS}
          />

          <Button onClick={onResetFilters} icon={<ReloadOutlined />}>
            重置筛选
          </Button>
        </Space>
      </div>

      {/* Data table */}
      <div data-testid="audit-log-table">
        <Table<AuditLog>
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={paginationConfig}
          size="middle"
          scroll={{ x: 1000 }}
          locale={{ emptyText: '暂无数据' }}
        />
      </div>
    </Card>
  );
};

/* ==========================================================================
   Main Page Component — AuditDashboardPage  (G-6)
   ========================================================================== */

/**
 * Audit dashboard page container.
 *
 * Layout:
 *   1. Page header  (<h1>)
 *   2. GlobalDateRangeFilter
 *   3. OperationTrendChart
 *   4. Row: TypeDistributionBar | TopOperatorsChart  (side-by-side at ≥1200px)
 *   5. AuditLogTable
 */
export default function AuditDashboardPage() {
  /* ---- Global date range (default: last 30 days) ---- */
  const [globalDateRange, setGlobalDateRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);

  /* ---- Granularity (default: day) ---- */
  const [granularity, setGranularity] = useState<Granularity>('day');

  /* ---- Trend chart state ---- */
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<Error | null>(null);

  /* ---- Type distribution state ---- */
  const [typeData, setTypeData] = useState<TypeDistributionItem[]>([]);
  const [typeLoading, setTypeLoading] = useState(true);
  const [typeError, setTypeError] = useState<Error | null>(null);

  /* ---- Top operators state ---- */
  const [operatorData, setOperatorData] = useState<OperatorRankItem[]>([]);
  const [operatorLoading, setOperatorLoading] = useState(true);
  const [operatorError, setOperatorError] = useState<Error | null>(null);

  /* ---- Audit log table state ---- */
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(20);

  /* ---- Table filters (independent from global date range) ---- */
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [filterOperator, setFilterOperator] = useState<string | undefined>(undefined);
  const [filterModule, setFilterModule] = useState<string | undefined>(undefined);
  const [filterDateRange, setFilterDateRange] = useState<[Dayjs, Dayjs] | undefined>(undefined);

  /* ---- Request sequence counter for race-condition handling ---- */
  const seqRef = useRef(0);

  /* ------------------------------------------------------------------
     Effects — Dashboard charts (driven by globalDateRange + granularity)
     ------------------------------------------------------------------ */

  /** Fetch trends when globalDateRange or granularity changes */
  useEffect(() => {
    const seq = ++seqRef.current;
    const start = globalDateRange[0].format('YYYY-MM-DD');
    const end = globalDateRange[1].format('YYYY-MM-DD');

    setTrendLoading(true);
    setTrendError(null);

    auditApi
      .fetchTrends(granularity, start, end)
      .then((res) => {
        if (seq === seqRef.current) setTrendData(res.dataPoints);
      })
      .catch((err: Error) => {
        if (seq === seqRef.current) {
          setTrendError(err);
          message.error('操作趋势数据加载失败');
        }
      })
      .finally(() => {
        if (seq === seqRef.current) setTrendLoading(false);
      });
  }, [globalDateRange, granularity]);

  /** Fetch type distribution + top operators when globalDateRange changes */
  useEffect(() => {
    const seq = ++seqRef.current;
    const start = globalDateRange[0].format('YYYY-MM-DD');
    const end = globalDateRange[1].format('YYYY-MM-DD');

    /* Type distribution */
    setTypeLoading(true);
    setTypeError(null);
    auditApi
      .fetchTypeDistribution(start, end)
      .then((res) => {
        if (seq === seqRef.current) setTypeData(res.categories);
      })
      .catch((err: Error) => {
        if (seq === seqRef.current) {
          setTypeError(err);
          message.error('类型分布数据加载失败');
        }
      })
      .finally(() => {
        if (seq === seqRef.current) setTypeLoading(false);
      });

    /* Top operators */
    setOperatorLoading(true);
    setOperatorError(null);
    auditApi
      .fetchTopOperators(start, end)
      .then((res) => {
        if (seq === seqRef.current) setOperatorData(res.operators);
      })
      .catch((err: Error) => {
        if (seq === seqRef.current) {
          setOperatorError(err);
          message.error('操作人排行数据加载失败');
        }
      })
      .finally(() => {
        if (seq === seqRef.current) setOperatorLoading(false);
      });
  }, [globalDateRange]);

  /* ------------------------------------------------------------------
     Effects — Audit log table (driven by local filters + pagination)
     Global date range does NOT affect table filters (ATB-08 step 03).
     ------------------------------------------------------------------ */

  useEffect(() => {
    const seq = ++seqRef.current;

    const params: Parameters<typeof auditApi.fetchAuditLogs>[0] = {
      page: logPage,
      size: logPageSize,
    };
    if (filterType) params.type = filterType;
    if (filterOperator) params.operator = filterOperator;
    if (filterModule) params.module = filterModule;
    if (filterDateRange) {
      params.start = filterDateRange[0].format('YYYY-MM-DD');
      params.end = filterDateRange[1].format('YYYY-MM-DD');
    }

    setLogLoading(true);
    auditApi
      .fetchAuditLogs(params)
      .then((res) => {
        if (seq === seqRef.current) {
          setLogs(res.items);
          setLogTotal(res.total);
        }
      })
      .catch(() => {
        if (seq === seqRef.current) {
          message.error('审计日志加载失败');
        }
      })
      .finally(() => {
        if (seq === seqRef.current) setLogLoading(false);
      });
  }, [logPage, logPageSize, filterType, filterOperator, filterModule, filterDateRange]);

  /* ------------------------------------------------------------------
     Handlers
     ------------------------------------------------------------------ */

  const handleGlobalDateChange = useCallback((range: [Dayjs, Dayjs]) => {
    setGlobalDateRange(range);
  }, []);

  /** Retry fetching trend data */
  const handleRetryTrend = useCallback(() => {
    const seq = ++seqRef.current;
    const start = globalDateRange[0].format('YYYY-MM-DD');
    const end = globalDateRange[1].format('YYYY-MM-DD');
    setTrendLoading(true);
    setTrendError(null);
    auditApi
      .fetchTrends(granularity, start, end)
      .then((res) => {
        if (seq === seqRef.current) setTrendData(res.dataPoints);
      })
      .catch((err: Error) => {
        if (seq === seqRef.current) {
          setTrendError(err);
          message.error('操作趋势数据加载失败');
        }
      })
      .finally(() => {
        if (seq === seqRef.current) setTrendLoading(false);
      });
  }, [globalDateRange, granularity]);

  /** Retry fetching type distribution */
  const handleRetryType = useCallback(() => {
    const seq = ++seqRef.current;
    const start = globalDateRange[0].format('YYYY-MM-DD');
    const end = globalDateRange[1].format('YYYY-MM-DD');
    setTypeLoading(true);
    setTypeError(null);
    auditApi
      .fetchTypeDistribution(start, end)
      .then((res) => {
        if (seq === seqRef.current) setTypeData(res.categories);
      })
      .catch((err: Error) => {
        if (seq === seqRef.current) {
          setTypeError(err);
          message.error('类型分布数据加载失败');
        }
      })
      .finally(() => {
        if (seq === seqRef.current) setTypeLoading(false);
      });
  }, [globalDateRange]);

  /** Retry fetching top operators */
  const handleRetryOperators = useCallback(() => {
    const seq = ++seqRef.current;
    const start = globalDateRange[0].format('YYYY-MM-DD');
    const end = globalDateRange[1].format('YYYY-MM-DD');
    setOperatorLoading(true);
    setOperatorError(null);
    auditApi
      .fetchTopOperators(start, end)
      .then((res) => {
        if (seq === seqRef.current) setOperatorData(res.operators);
      })
      .catch((err: Error) => {
        if (seq === seqRef.current) {
          setOperatorError(err);
          message.error('操作人排行数据加载失败');
        }
      })
      .finally(() => {
        if (seq === seqRef.current) setOperatorLoading(false);
      });
  }, [globalDateRange]);

  /** Table pagination change handler */
  const handleTablePageChange = useCallback(
    (page: number, size: number) => {
      setLogPage(page);
      if (size !== logPageSize) {
        setLogPageSize(size);
        setLogPage(1); // Reset to first page when page size changes
      }
    },
    [logPageSize],
  );

  /** Unified table filters object (derived) */
  const tableFilters: TableFilters = useMemo(
    () => ({ type: filterType, operator: filterOperator, module: filterModule, dateRange: filterDateRange }),
    [filterType, filterOperator, filterModule, filterDateRange],
  );

  /** Partial filter update (resets page to 1) */
  const handleFiltersChange = useCallback((next: TableFilters) => {
    setFilterType(next.type);
    setFilterOperator(next.operator);
    setFilterModule(next.module);
    setFilterDateRange(next.dateRange);
    setLogPage(1); // Reset to page 1 on any filter change
  }, []);

  /** Reset all table filters to defaults (ATB-07 step 06) */
  const handleResetFilters = useCallback(() => {
    setFilterType(undefined);
    setFilterOperator(undefined);
    setFilterModule(undefined);
    setFilterDateRange(undefined);
    setLogPage(1);
    setLogPageSize(20);
  }, []);

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------ */

  return (
    <ErrorBoundary>
      <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh' }}>
        {/* Page header — ATB-01 step 03 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>
            <HistoryOutlined /> 审计日志仪表板
          </Title>
          <Text type="secondary" style={{ marginTop: 4 }}>
            实时监控全部操作行为与安全态势
          </Text>
        </div>

        {/* G-5: Global date range filter with quick presets */}
        <GlobalDateRangeFilter
          dateRange={globalDateRange}
          onRangeChange={handleGlobalDateChange}
          loading={trendLoading && typeLoading && operatorLoading}
        />

        {/* G-1: Operation trend line chart */}
        <OperationTrendChart
          data={trendData}
          loading={trendLoading}
          error={trendError}
          granularity={granularity}
          onGranularityChange={setGranularity}
          onRetry={handleRetryTrend}
        />

        {/* G-2 + G-3: Distribution charts row
            ≥1200px (xl) → side by side   |   <1200px → stacked (ATB-01 steps 05/06) */}
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} xl={12} style={{ marginBottom: 16 }}>
            <TypeDistributionBar
              data={typeData}
              loading={typeLoading}
              error={typeError}
              onRetry={handleRetryType}
            />
          </Col>
          <Col xs={24} xl={12} style={{ marginBottom: 16 }}>
            <TopOperatorsChart
              data={operatorData}
              loading={operatorLoading}
              error={operatorError}
              onRetry={handleRetryOperators}
            />
          </Col>
        </Row>

        {/* G-4: Audit log detail table */}
        <AuditLogTable
          data={logs}
          loading={logLoading}
          total={logTotal}
          page={logPage}
          pageSize={logPageSize}
          onPageChange={handleTablePageChange}
          filters={tableFilters}
          onFiltersChange={handleFiltersChange}
          onResetFilters={handleResetFilters}
        />
      </div>
    </ErrorBoundary>
  );
}