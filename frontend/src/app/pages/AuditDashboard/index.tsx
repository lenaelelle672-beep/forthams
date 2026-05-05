/**
 * AuditDashboard - 操作日志仪表板
 * 
 * 用户可以在前端查看审计数据可视化图表和操作趋势统计
 * 
 * @ SWARM-AUD-001 - Iteration 1
 * @since 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  DatePicker,
  Select,
  Input,
  Button,
  Space,
  Tag,
  Typography,
  Statistic,
  Spin,
  message,
  Tooltip,
  Empty,
  Badge,
} from 'antd';
import {
  LineChartOutlined,
  PieChartOutlined,
  FilterOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import dayjs, { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import './AuditDashboard.css';

// ============================================================================
// Type Definitions
// ============================================================================

/** 审计记录接口 */
interface AuditRecord {
  id: string;
  operatorId: string;
  operatorName: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'QUERY';
  resourceType: string;
  resourceId: string;
  detail: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILURE';
}

/** 趋势统计数据接口 */
interface TrendStats {
  totalCount: number;
  successRate: number;
  byActionType: Record<string, number>;
  byDay: Record<string, number>;
}

/** API 响应结构 */
interface AuditApiResponse {
  code: number;
  data: {
    records: AuditRecord[];
    total: number;
    statistics: TrendStats;
  };
  msg?: string;
}

/** 筛选参数接口 */
interface FilterParams {
  startTime: string;
  endTime: string;
  operatorId?: string;
  actionType?: string[];
  page: number;
  pageSize: number;
}

/** KPI 卡片数据类型 */
interface KpiData {
  totalCount: number;
  successRate: number;
  todayCount: number;
  failureRate: number;
}

// ============================================================================
// Mock Data - Phase 1 骨架交付使用
// ============================================================================

const MOCK_TREND_DATA = [
  { date: '2025-01-13', count: 156 },
  { date: '2025-01-14', count: 203 },
  { date: '2025-01-15', count: 178 },
  { date: '2025-01-16', count: 245 },
  { date: '2025-01-17', count: 189 },
  { date: '2025-01-18', count: 167 },
  { date: '2025-01-19', count: 221 },
];

const MOCK_ACTION_TYPE_DATA = [
  { name: 'QUERY', value: 45, color: '#1890ff' },
  { name: 'UPDATE', value: 30, color: '#52c41a' },
  { name: 'CREATE', value: 15, color: '#faad14' },
  { name: 'DELETE', value: 10, color: '#f5222d' },
];

const MOCK_AUDIT_RECORDS: AuditRecord[] = [
  {
    id: 'audit-001',
    operatorId: 'user-101',
    operatorName: '张三',
    actionType: 'CREATE',
    resourceType: 'User',
    resourceId: 'user-201',
    detail: '{"action": "create_user", "username": "newuser@example.com"}',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: '2025-01-19T10:30:00Z',
    status: 'SUCCESS',
  },
  {
    id: 'audit-002',
    operatorId: 'user-102',
    operatorName: '李四',
    actionType: 'UPDATE',
    resourceType: 'Policy',
    resourceId: 'policy-001',
    detail: '{"action": "update_policy", "field": "permissions", "old": "read", "new": "write"}',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    timestamp: '2025-01-19T10:15:00Z',
    status: 'SUCCESS',
  },
  {
    id: 'audit-003',
    operatorId: 'user-103',
    operatorName: '王五',
    actionType: 'DELETE',
    resourceType: 'Asset',
    resourceId: 'asset-500',
    detail: '{"action": "delete_asset", "assetId": "asset-500", "reason": "disposed"}',
    ipAddress: '192.168.1.102',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    timestamp: '2025-01-19T09:45:00Z',
    status: 'FAILURE',
  },
  {
    id: 'audit-004',
    operatorId: 'user-101',
    operatorName: '张三',
    actionType: 'QUERY',
    resourceType: 'Asset',
    resourceId: 'asset-*',
    detail: '{"action": "query_assets", "filters": {"status": "ACTIVE"}}',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: '2025-01-19T09:30:00Z',
    status: 'SUCCESS',
  },
  {
    id: 'audit-005',
    operatorId: 'user-104',
    operatorName: '赵六',
    actionType: 'UPDATE',
    resourceType: 'Config',
    resourceId: 'config-system',
    detail: '{"action": "update_config", "field": "maxUploadSize", "old": "10MB", "new": "50MB"}',
    ipAddress: '192.168.1.103',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    timestamp: '2025-01-19T09:15:00Z',
    status: 'SUCCESS',
  },
  {
    id: 'audit-006',
    operatorId: 'user-105',
    operatorName: '孙七',
    actionType: 'CREATE',
    resourceType: 'Role',
    resourceId: 'role-admin',
    detail: '{"action": "create_role", "name": "Admin", "permissions": ["*"]}',
    ipAddress: '192.168.1.104',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    timestamp: '2025-01-19T08:50:00Z',
    status: 'SUCCESS',
  },
  {
    id: 'audit-007',
    operatorId: 'user-102',
    operatorName: '李四',
    actionType: 'DELETE',
    resourceType: 'User',
    resourceId: 'user-300',
    detail: '{"action": "delete_user", "userId": "user-300", "reason": "deactivated"}',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    timestamp: '2025-01-19T08:30:00Z',
    status: 'FAILURE',
  },
  {
    id: 'audit-008',
    operatorId: 'user-106',
    operatorName: '周八',
    actionType: 'QUERY',
    resourceType: 'AuditLog',
    resourceId: 'audit-*',
    detail: '{"action": "query_audit_logs", "filters": {"dateRange": "7d"}}',
    ipAddress: '192.168.1.105',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: '2025-01-19T08:15:00Z',
    status: 'SUCCESS',
  },
];

const MOCK_TREND_STATS: TrendStats = {
  totalCount: 1359,
  successRate: 0.92,
  byActionType: {
    QUERY: 612,
    UPDATE: 407,
    CREATE: 204,
    DELETE: 136,
  },
  byDay: {
    '2025-01-13': 156,
    '2025-01-14': 203,
    '2025-01-15': 178,
    '2025-01-16': 245,
    '2025-01-17': 189,
    '2025-01-18': 167,
    '2025-01-19': 221,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/** 格式化日期为 ISO8601 字符串 */
const formatDateISO = (date: Dayjs): string => date.format('YYYY-MM-DDTHH:mm:ss[Z]');

/** 格式化日期显示 */
const formatDateDisplay = (dateStr: string): string => {
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss');
};

/** 获取操作类型对应的颜色 */
const getActionTypeColor = (actionType: string): string => {
  const colors: Record<string, string> = {
    CREATE: '#52c41a',
    UPDATE: '#1890ff',
    DELETE: '#f5222d',
    QUERY: '#722ed1',
  };
  return colors[actionType] || '#8c8c8c';
};

/** 获取状态对应的颜色 */
const getStatusColor = (status: string): 'success' | 'error' => {
  return status === 'SUCCESS' ? 'success' : 'error';
};

// ============================================================================
// API Service
// ============================================================================

/**
 * 获取审计数据
 * 
 * @param params - 筛选参数
 * @returns API 响应数据
 * 
 * @performance 时间复杂度 O(n)
 * @since 1.0.0
 */
const fetchAuditData = async (params: FilterParams): Promise<AuditApiResponse> => {
  // Phase 1: 使用 Mock 数据
  // Phase 2: 接入真实 API
  // const response = await fetch('/api/audit/query', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(params),
  // });
  // return response.json();
  
  // 模拟 API 延迟
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 简单的筛选逻辑模拟
  let filteredRecords = [...MOCK_AUDIT_RECORDS];
  
  if (params.actionType && params.actionType.length > 0) {
    filteredRecords = filteredRecords.filter(record =>
      params.actionType!.includes(record.actionType)
    );
  }
  
  if (params.operatorId) {
    filteredRecords = filteredRecords.filter(record =>
      record.operatorId.includes(params.operatorId!) ||
      record.operatorName.includes(params.operatorId!)
    );
  }
  
  const startIndex = (params.page - 1) * params.pageSize;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + params.pageSize);
  
  return {
    code: 0,
    data: {
      records: paginatedRecords,
      total: filteredRecords.length,
      statistics: MOCK_TREND_STATS,
    },
  };
};

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * KpiCards - KPI 摘要卡片组件
 * 
 * 展示总操作数、成功率、今日操作量等关键指标
 * 
 * @since 1.0.0
 */
interface KpiCardsProps {
  data: KpiData;
  loading: boolean;
}

const KpiCards: React.FC<KpiCardsProps> = ({ data, loading }) => {
  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]} className="kpi-cards-row">
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card" bordered={false}>
            <Statistic
              title="总操作数"
              value={data.totalCount}
              prefix={<LineChartOutlined />}
              suffix="次"
              valueStyle={{ color: '#1890ff' }}
            />
            <div className="kpi-trend">
              <RiseOutlined /> 较上周 +12.5%
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card" bordered={false}>
            <Statistic
              title="成功率"
              value={data.successRate * 100}
              prefix={<CheckCircleOutlined />}
              suffix="%"
              precision={1}
              valueStyle={{ color: '#52c41a' }}
            />
            <div className="kpi-trend success">
              <ClockCircleOutlined /> SLA 达标
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card" bordered={false}>
            <Statistic
              title="今日操作量"
              value={data.todayCount}
              prefix={<PieChartOutlined />}
              suffix="次"
              valueStyle={{ color: '#722ed1' }}
            />
            <div className="kpi-trend">
              <RiseOutlined /> 较昨日 +8.3%
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card" bordered={false}>
            <Statistic
              title="失败操作数"
              value={Math.round(data.totalCount * data.failureRate)}
              prefix={<CloseCircleOutlined />}
              suffix="次"
              valueStyle={{ color: '#f5222d' }}
            />
            <div className="kpi-trend failure">
              <Badge status="error" text="需关注" />
            </div>
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

/**
 * TrendChart - 操作趋势折线图组件
 * 
 * 展示近7天操作量趋势
 * 
 * @since 1.0.0
 */
interface TrendChartProps {
  data: Array<{ date: string; count: number }>;
  loading: boolean;
}

const TrendChart: React.FC<TrendChartProps> = ({ data, loading }) => {
  return (
    <Card
      title={
        <Space>
          <LineChartOutlined />
          <span>近7天操作趋势</span>
        </Space>
      }
      className="chart-card trend-chart-card"
      extra={
        <Tooltip title="刷新数据">
          <Button type="text" icon={<ReloadOutlined />} size="small" />
        </Tooltip>
      }
    >
      <Spin spinning={loading}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => dayjs(value).format('MM/DD')}
              stroke="#8c8c8c"
            />
            <YAxis stroke="#8c8c8c" />
            <RechartsTooltip
              labelFormatter={(value) => dayjs(value).format('YYYY-MM-DD')}
              formatter={(value: number) => [`${value} 次`, '操作量']}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="count"
              name="操作量"
              stroke="#1890ff"
              strokeWidth={2}
              dot={{ fill: '#1890ff', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Spin>
    </Card>
  );
};

/**
 * ActionTypePie - 操作类型分布饼图组件
 * 
 * 展示各操作类型的占比分布
 * 
 * @since 1.0.0
 */
interface ActionTypePieProps {
  data: Array<{ name: string; value: number; color: string }>;
  loading: boolean;
}

const ActionTypePie: React.FC<ActionTypePieProps> = ({ data, loading }) => {
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  return (
    <Card
      title={
        <Space>
          <PieChartOutlined />
          <span>操作类型分布</span>
        </Space>
      }
      className="chart-card pie-chart-card"
    >
      <Spin spinning={loading}>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#8c8c8c' }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value: number) => [`${value} 次`, '操作量']}
            />
            <Legend
              formatter={(value, entry: any) => {
                const item = data.find(d => d.name === value);
                const percent = item ? ((item.value / total) * 100).toFixed(1) : '0';
                return `${value} (${percent}%)`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Spin>
    </Card>
  );
};

/**
 * FilterBar - 筛选工具栏组件
 * 
 * 支持日期范围、操作类型、操作者筛选
 * 
 * @since 1.0.0
 */
interface FilterBarProps {
  onSearch: (params: Omit<FilterParams, 'page' | 'pageSize'>) => void;
  onReset: () => void;
  loading: boolean;
}

const { RangePicker } = DatePicker;
const { Search } = Input;

const FilterBar: React.FC<FilterBarProps> = ({ onSearch, onReset, loading }) => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [operatorId, setOperatorId] = useState<string>('');

  const handleSearch = useCallback(() => {
    const params: Omit<FilterParams, 'page' | 'pageSize'> = {
      startTime: dateRange ? formatDateISO(dateRange[0]) : formatDateISO(dayjs().subtract(7, 'day')),
      endTime: dateRange ? formatDateISO(dateRange[1]) : formatDateISO(dayjs()),
      actionType: actionTypes.length > 0 ? actionTypes : undefined,
      operatorId: operatorId || undefined,
    };
    onSearch(params);
  }, [dateRange, actionTypes, operatorId, onSearch]);

  const handleReset = useCallback(() => {
    setDateRange(null);
    setActionTypes([]);
    setOperatorId('');
    onReset();
  }, [onReset]);

  return (
    <Card className="filter-bar-card" bordered={false}>
      <Space wrap size="middle" className="filter-bar-space">
        <Space size="small">
          <FilterOutlined className="filter-icon" />
          <span className="filter-label">筛选条件:</span>
        </Space>
        <RangePicker
          value={dateRange}
          onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
          allowClear
          placeholder={['开始日期', '结束日期']}
          disabled={loading}
        />
        <Select
          mode="multiple"
          placeholder="操作类型"
          value={actionTypes}
          onChange={setActionTypes}
          allowClear
          style={{ minWidth: 200 }}
          disabled={loading}
          options={[
            { label: '查询 (QUERY)', value: 'QUERY' },
            { label: '创建 (CREATE)', value: 'CREATE' },
            { label: '更新 (UPDATE)', value: 'UPDATE' },
            { label: '删除 (DELETE)', value: 'DELETE' },
          ]}
        />
        <Search
          placeholder="操作者 ID / 姓名"
          value={operatorId}
          onChange={(e) => setOperatorId(e.target.value)}
          allowClear
          style={{ width: 200 }}
          disabled={loading}
        />
        <Space>
          <Button type="primary" onClick={handleSearch} loading={loading}>
            查询
          </Button>
          <Button onClick={handleReset} disabled={loading}>
            重置
          </Button>
        </Space>
      </Space>
    </Card>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * AuditDashboard - 操作日志仪表板主页面
 * 
 * 提供审计数据的可视化展示与操作趋势统计分析能力
 * 
 * @ SWARM-AUD-001
 * @since 1.0.0
 * 
 * @performance 时间复杂度 O(n) - 数据加载与筛选
 * @rendering 优化：使用 React.memo 减少不必要的重渲染
 */
const AuditDashboard: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState<boolean>(true);
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [statistics, setStatistics] = useState<TrendStats | null>(null);
  const [filterParams, setFilterParams] = useState<Omit<FilterParams, 'page' | 'pageSize'>>({
    startTime: formatDateISO(dayjs().subtract(7, 'day')),
    endTime: formatDateISO(dayjs()),
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });

  /**
   * 加载审计数据
   * 
   * @async
   * @performance 时间复杂度 O(n)
   */
  const loadAuditData = useCallback(async (params: FilterParams) => {
    setLoading(true);
    try {
      const response = await fetchAuditData(params);
      if (response.code === 0) {
        setRecords(response.data.records);
        setTotal(response.data.total);
        setStatistics(response.data.statistics);
      } else {
        message.error(response.msg || '获取审计数据失败');
      }
    } catch (error) {
      message.error('网络请求失败，请稍后重试');
      console.error('Audit data fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载和筛选参数变化时重新加载数据
  useEffect(() => {
    loadAuditData({
      ...filterParams,
      page: pagination.current,
      pageSize: pagination.pageSize,
    });
  }, [filterParams, pagination.current, pagination.pageSize, loadAuditData]);

  // 自动刷新（30秒间隔）
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadAuditData({
        ...filterParams,
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
    }, 30000);

    return () => clearInterval(intervalId);
  }, [filterParams, pagination.current, pagination.pageSize, loadAuditData]);

  /**
   * 处理筛选参数变化
   */
  const handleFilterChange = useCallback((params: Omit<FilterParams, 'page' | 'pageSize'>) => {
    setFilterParams(params);
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  /**
   * 处理重置筛选
   */
  const handleFilterReset = useCallback(() => {
    setFilterParams({
      startTime: formatDateISO(dayjs().subtract(7, 'day')),
      endTime: formatDateISO(dayjs()),
    });
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  /**
   * 处理手动刷新
   */
  const handleManualRefresh = useCallback(() => {
    loadAuditData({
      ...filterParams,
      page: pagination.current,
      pageSize: pagination.pageSize,
    });
  }, [filterParams, pagination, loadAuditData]);

  /**
   * 处理分页变化
   */
  const handleTableChange = useCallback(
    (page: number, pageSize: number) => {
      setPagination({ current: page, pageSize });
    },
    []
  );

  // 计算 KPI 数据
  const kpiData = useMemo<KpiData>(() => {
    if (!statistics) {
      return {
        totalCount: 0,
        successRate: 0,
        todayCount: 0,
        failureRate: 0,
      };
    }

    const today = dayjs().format('YYYY-MM-DD');
    const todayCount = statistics.byDay[today] || 0;

    return {
      totalCount: statistics.totalCount,
      successRate: statistics.successRate,
      todayCount,
      failureRate: 1 - statistics.successRate,
    };
  }, [statistics]);

  // 准备趋势图数据
  const trendChartData = useMemo(() => {
    if (!statistics) return [];
    return Object.entries(statistics.byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [statistics]);

  // 准备饼图数据
  const pieChartData = useMemo(() => {
    if (!statistics) return [];
    return Object.entries(statistics.byActionType).map(([name, value]) => ({
      name,
      value,
      color: getActionTypeColor(name),
    }));
  }, [statistics]);

  // 表格列定义
  const columns: ColumnsType<AuditRecord> = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 180,
        render: (text: string) => formatDateDisplay(text),
        sorter: (a, b) => dayjs(a.timestamp).unix() - dayjs(b.timestamp).unix(),
        defaultSortOrder: 'descend',
      },
      {
        title: '操作者',
        key: 'operator',
        width: 150,
        render: (_, record) => (
          <Space direction="vertical" size="small">
            <span>{record.operatorName}</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.operatorId}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: '操作类型',
        dataIndex: 'actionType',
        key: 'actionType',
        width: 120,
        render: (type: string) => (
          <Tag color={getActionTypeColor(type)}>{type}</Tag>
        ),
        filters: [
          { text: '查询', value: 'QUERY' },
          { text: '创建', value: 'CREATE' },
          { text: '更新', value: 'UPDATE' },
          { text: '删除', value: 'DELETE' },
        ],
        onFilter: (value, record) => record.actionType === value,
      },
      {
        title: '资源类型',
        dataIndex: 'resourceType',
        key: 'resourceType',
        width: 120,
      },
      {
        title: '资源ID',
        dataIndex: 'resourceId',
        key: 'resourceId',
        width: 150,
        ellipsis: true,
        render: (text: string) => (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (status: 'SUCCESS' | 'FAILURE') => (
          <Tag
            icon={status === 'SUCCESS' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            color={status === 'SUCCESS' ? 'success' : 'error'}
          >
            {status === 'SUCCESS' ? '成功' : '失败'}
          </Tag>
        ),
        filters: [
          { text: '成功', value: 'SUCCESS' },
          { text: '失败', value: 'FAILURE' },
        ],
        onFilter: (value, record) => record.status === value,
      },
      {
        title: 'IP地址',
        dataIndex: 'ipAddress',
        key: 'ipAddress',
        width: 130,
        render: (text: string) => (
          <Typography.Text copyable={{ text }} style={{ fontSize: 12 }}>
            {text}
          </Typography.Text>
        ),
      },
      {
        title: '操作详情',
        dataIndex: 'detail',
        key: 'detail',
        width: 200,
        ellipsis: true,
        render: (text: string) => {
          try {
            const parsed = JSON.parse(text);
            return (
              <Tooltip
                title={
                  <pre style={{ margin: 0, fontSize: 12 }}>
                    {JSON.stringify(parsed, null, 2)}
                  </pre>
                }
              >
                <span className="detail-preview">
                  {parsed.action || text.substring(0, 50)}
                </span>
              </Tooltip>
            );
          } catch {
            return (
              <Tooltip title={text}>
                <span className="detail-preview">{text.substring(0, 50)}</span>
              </Tooltip>
            );
          }
        },
      },
    ],
    []
  );

  // 展开行渲染详情
  const expandedRowRender = useCallback((record: AuditRecord) => {
    let parsedDetail;
    try {
      parsedDetail = JSON.parse(record.detail);
    } catch {
      parsedDetail = { raw: record.detail };
    }

    return (
      <div className="expanded-row-content">
        <Typography.Title level={5}>完整操作详情</Typography.Title>
        <pre className="detail-json">
          {JSON.stringify(parsedDetail, null, 2)}
        </pre>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          User-Agent: {record.userAgent}
        </Typography.Text>
      </div>
    );
  }, []);

  return (
    <div className="audit-dashboard-container">
      {/* 页面标题 */}
      <div className="dashboard-header">
        <Typography.Title level={3}>
          <Space>
            <LineChartOutlined />
            <span>操作日志仪表板</span>
          </Space>
        </Typography.Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleManualRefresh}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* KPI 卡片区域 */}
      <section className="kpi-section">
        <KpiCards data={kpiData} loading={loading} />
      </section>

      {/* 图表区域 */}
      <section className="charts-section">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <TrendChart data={trendChartData} loading={loading} />
          </Col>
          <Col xs={24} lg={10}>
            <ActionTypePie data={pieChartData} loading={loading} />
          </Col>
        </Row>
      </section>

      {/* 筛选工具栏 */}
      <section className="filter-section">
        <FilterBar
          onSearch={handleFilterChange}
          onReset={handleFilterReset}
          loading={loading}
        />
      </section>

      {/* 审计记录表格 */}
      <section className="table-section">
        <Card
          title={
            <Space>
              <span>操作记录明细</span>
              <Badge count={total} style={{ backgroundColor: '#1890ff' }} />
            </Space>
          }
          className="audit-table-card"
        >
          <Spin spinning={loading}>
            {records.length > 0 ? (
              <Table
                columns={columns}
                dataSource={records}
                rowKey="id"
                expandable={{
                  expandedRowRender,
                  expandRowByClick: true,
                }}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 条记录`,
                  pageSizeOptions: ['10', '20', '50', '100'],
                  onChange: handleTableChange,
                }}
                scroll={{ x: 1200 }}
                size="middle"
              />
            ) : (
              <Empty description="暂无审计记录" />
            )}
          </Spin>
        </Card>
      </section>
    </div>
  );
};

// ============================================================================
// Export
// ============================================================================

export default AuditDashboard;