/**
 * LogDashboard - 操作日志仪表板
 * 
 * SWARM-003 操作日志仪表板 - 前端构建审计日志可视化面板
 * 提供趋势图表展示和筛选功能，让用户直观查看和分析系统操作日志
 * 
 * @version 1.0.0
 * @date 2024-01-15
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';
import { DatePicker, Select, Input, Button, Table, Tag, Space, Card, Typography, Empty, Spin } from 'antd';
import { SearchOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

import { useLogDashboard } from './hooks/useLogDashboard';
import { useLogTrends } from './hooks/useLogTrends';
import type { LogEntry, LogFilters, TrendDataPoint } from './types/log.types';
import './LogDashboard.module.css';

/** 操作类型枚举 */
type ActionType = 'ALL' | 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';

/** 日志状态枚举 */
type LogStatus = 'ALL' | 'SUCCESS' | 'FAILURE';

/** 时间粒度枚举 */
type Granularity = 'day' | 'week' | 'month';

const { Title, Text } = Typography;

/**
 * LogDashboard 组件
 * 
 * 主要功能：
 * - 趋势图表展示日志时间分布
 * - 多维筛选器（日志类型、状态、操作者、时间范围）
 * - 日志列表展示与分页
 */
export const LogDashboard: React.FC = () => {
  // ============================================================================
  // State 管理
  // ============================================================================
  
  const [filters, setFilters] = useState<LogFilters>({
    startTime: dayjs().subtract(30, 'day'),
    endTime: dayjs(),
    action: 'ALL',
    status: 'ALL',
    operatorId: undefined,
    keyword: undefined,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
  });

  // ============================================================================
  // 数据获取 - 使用 hooks
  // ============================================================================
  
  const {
    logs,
    total,
    loading: logsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useLogDashboard(filters, pagination);

  const {
    trends,
    granularity,
    setGranularity,
    loading: trendsLoading,
    refetch: refetchTrends,
  } = useLogTrends({
    startTime: filters.startTime,
    endTime: filters.endTime,
    granularity: 'day' as Granularity,
  });

  // ============================================================================
  // 事件处理函数
  // ============================================================================

  /**
   * 处理筛选条件变更
   */
  const handleFilterChange = useCallback(<K extends keyof LogFilters>(
    key: K,
    value: LogFilters[K]
  ) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
    // 重置分页到第一页
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  /**
   * 处理时间范围变更
   */
  const handleDateRangeChange = useCallback((dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      // 校验时间跨度不超过 90 天
      const daysDiff = dates[1].diff(dates[0], 'day');
      if (daysDiff > 90) {
        // 可选：添加警告提示
        console.warn('时间跨度不能超过 90 天');
        return;
      }
      setFilters(prev => ({
        ...prev,
        startTime: dates[0],
        endTime: dates[1],
      }));
    }
  }, []);

  /**
   * 处理预设时间范围选择
   */
  const handlePresetRange = useCallback((days: number) => {
    const end = dayjs();
    const start = dayjs().subtract(days, 'day');
    setFilters(prev => ({
      ...prev,
      startTime: start,
      endTime: end,
    }));
  }, []);

  /**
   * 处理搜索操作
   */
  const handleSearch = useCallback(() => {
    refetchLogs();
    refetchTrends();
  }, [refetchLogs, refetchTrends]);

  /**
   * 处理重置筛选条件
   */
  const handleReset = useCallback(() => {
    setFilters({
      startTime: dayjs().subtract(30, 'day'),
      endTime: dayjs(),
      action: 'ALL',
      status: 'ALL',
      operatorId: undefined,
      keyword: undefined,
    });
    setPagination({ page: 1, pageSize: 20 });
  }, []);

  /**
   * 处理分页变更
   */
  const handlePageChange = useCallback((page: number, pageSize: number) => {
    setPagination({ page, pageSize });
  }, []);

  /**
   * 处理粒度切换
   */
  const handleGranularityChange = useCallback((value: Granularity) => {
    setGranularity(value);
  }, [setGranularity]);

  // ============================================================================
  // 表格列配置
  // ============================================================================

  const tableColumns = useMemo(() => [
    {
      title: '时间戳',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: string) => (
        <Text type="secondary">
          {dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      ),
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: ActionType) => {
        const colorMap: Record<ActionType, string> = {
          'CREATE': 'green',
          'UPDATE': 'blue',
          'DELETE': 'red',
          'READ': 'default',
          'ALL': 'default',
        };
        return (
          <Tag color={colorMap[action] || 'default'}>
            {action}
          </Tag>
        );
      },
    },
    {
      title: '操作者',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 120,
      render: (name: string, record: LogEntry) => (
        <Space direction="vertical" size={0}>
          <Text>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ID: {record.operatorId}
          </Text>
        </Space>
      ),
    },
    {
      title: '资源类型',
      dataIndex: 'resourceType',
      key: 'resourceType',
      width: 120,
    },
    {
      title: '操作描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: LogStatus) => {
        const isSuccess = status === 'SUCCESS';
        return (
          <Tag color={isSuccess ? 'success' : 'error'}>
            {status === 'SUCCESS' ? '成功' : '失败'}
          </Tag>
        );
      },
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
      render: (ip: string) => (
        <Text type="secondary" style={{ fontFamily: 'monospace' }}>
          {ip}
        </Text>
      ),
    },
  ], []);

  // ============================================================================
  // 渲染组件
  // ============================================================================

  const renderTrendChart = () => {
    if (trendsLoading) {
      return (
        <div className="chart-loading">
          <Spin tip="加载趋势数据中..." />
        </div>
      );
    }

    if (!trends || trends.length === 0) {
      return (
        <Empty 
          description="暂无趋势数据" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart 
          data={trends}
          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={(value: string) => dayjs(value).format('MM-DD')}
            stroke="#666"
          />
          <YAxis 
            stroke="#666"
            tickFormatter={(value: number) => value.toLocaleString()}
          />
          <Tooltip 
            labelFormatter={(value: string) => dayjs(value).format('YYYY-MM-DD HH:mm')}
            formatter={(value: number) => [`${value} 条`, '日志数量']}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="count" 
            name="日志数量"
            stroke="#1890ff" 
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderFilterBar = () => (
    <Card className="filter-card" size="small">
      <Space wrap size="middle">
        {/* 时间范围选择器 */}
        <div className="filter-item">
          <Text type="secondary" style={{ marginRight: 8 }}>时间范围:</Text>
          <DatePicker.RangePicker
            value={[filters.startTime, filters.endTime]}
            onChange={handleDateRangeChange}
            format="YYYY-MM-DD"
            allowClear={false}
            style={{ width: 260 }}
          />
        </div>

        {/* 预设时间范围 */}
        <div className="filter-item">
          <Button.Group size="small">
            <Button onClick={() => handlePresetRange(7)}>最近 7 天</Button>
            <Button onClick={() => handlePresetRange(30)}>最近 30 天</Button>
            <Button onClick={() => handlePresetRange(90)}>最近 90 天</Button>
          </Button.Group>
        </div>

        {/* 操作类型筛选 */}
        <div className="filter-item">
          <Text type="secondary" style={{ marginRight: 8 }}>操作类型:</Text>
          <Select
            value={filters.action}
            onChange={(value) => handleFilterChange('action', value)}
            style={{ width: 120 }}
          >
            <Select.Option value="ALL">全部</Select.Option>
            <Select.Option value="CREATE">创建</Select.Option>
            <Select.Option value="UPDATE">修改</Select.Option>
            <Select.Option value="DELETE">删除</Select.Option>
            <Select.Option value="READ">查询</Select.Option>
          </Select>
        </div>

        {/* 状态筛选 */}
        <div className="filter-item">
          <Text type="secondary" style={{ marginRight: 8 }}>状态:</Text>
          <Select
            value={filters.status}
            onChange={(value) => handleFilterChange('status', value)}
            style={{ width: 100 }}
          >
            <Select.Option value="ALL">全部</Select.Option>
            <Select.Option value="SUCCESS">成功</Select.Option>
            <Select.Option value="FAILURE">失败</Select.Option>
          </Select>
        </div>

        {/* 操作者筛选 */}
        <div className="filter-item">
          <Text type="secondary" style={{ marginRight: 8 }}>操作者:</Text>
          <Input
            placeholder="输入操作者ID"
            value={filters.operatorId || ''}
            onChange={(e) => handleFilterChange('operatorId', e.target.value || undefined)}
            style={{ width: 140 }}
            allowClear
          />
        </div>

        {/* 关键词搜索 */}
        <div className="filter-item">
          <Input
            placeholder="搜索操作描述"
            prefix={<SearchOutlined />}
            value={filters.keyword || ''}
            onChange={(e) => handleFilterChange('keyword', e.target.value || undefined)}
            style={{ width: 180 }}
            allowClear
          />
        </div>

        {/* 操作按钮 */}
        <div className="filter-item">
          <Space>
            <Button 
              type="primary" 
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={logsLoading}
            >
              查询
            </Button>
            <Button 
              icon={<ReloadOutlined />}
              onClick={handleReset}
            >
              重置
            </Button>
          </Space>
        </div>
      </Space>
    </Card>
  );

  const renderTrendSection = () => (
    <Card 
      title={
        <Space>
          <FilterOutlined />
          <span>日志趋势</span>
          <Select
            value={granularity}
            onChange={handleGranularityChange}
            size="small"
            style={{ width: 100, marginLeft: 16 }}
          >
            <Select.Option value="day">按天</Select.Option>
            <Select.Option value="week">按周</Select.Option>
            <Select.Option value="month">按月</Select.Option>
          </Select>
        </Space>
      }
      extra={
        <Button 
          icon={<ReloadOutlined />} 
          onClick={refetchTrends}
          loading={trendsLoading}
          size="small"
        >
          刷新
        </Button>
      }
    >
      {renderTrendChart()}
    </Card>
  );

  const renderLogTable = () => (
    <Card 
      title={
        <Space>
          <span>日志列表</span>
          <Text type="secondary">
            (共 {total.toLocaleString()} 条记录)
          </Text>
        </Space>
      }
      extra={
        <Button 
          icon={<ReloadOutlined />} 
          onClick={refetchLogs}
          loading={logsLoading}
          size="small"
        >
          刷新
        </Button>
      }
    >
      {logsError && (
        <div className="error-banner">
          <Text type="danger">
            加载失败: {logsError.message || '未知错误'}
          </Text>
          <Button 
            type="link" 
            onClick={refetchLogs}
            size="small"
          >
            重试
          </Button>
        </div>
      )}
      
      <Table
        columns={tableColumns}
        dataSource={logs}
        rowKey="id"
        loading={logsLoading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (total, range) => 
            `显示 ${range[0]}-${range[1]} 条，共 ${total.toLocaleString()} 条`,
          onChange: handlePageChange,
        }}
        scroll={{ x: 1200, y: 400 }}
        size="middle"
      />
    </Card>
  );

  // ============================================================================
  // 主渲染
  // ============================================================================

  return (
    <div className="log-dashboard-container">
      <div className="dashboard-header">
        <Title level={4}>操作日志仪表板</Title>
        <Text type="secondary">
          直观查看和分析系统操作日志，识别异常行为和操作趋势
        </Text>
      </div>

      {/* 筛选器区域 */}
      {renderFilterBar()}

      {/* 趋势图表区域 */}
      <div className="trend-section">
        {renderTrendSection()}
      </div>

      {/* 日志列表区域 */}
      <div className="log-list-section">
        {renderLogTable()}
      </div>
    </div>
  );
};

export default LogDashboard;