/**
 * AuditLogPanel Component
 * 
 * 资产详情页面审计日志展示模块
 * 负责展示资产关联的所有审计轨迹，支持筛选、分页和详情查看
 * 
 * @module AssetDetailView/AuditLogPanel
 * @requires react
 * @requires antd
 * @requires useAuditLogs hook
 * @requires audit.types
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Table,
  Card,
  Tag,
  Button,
  Space,
  DatePicker,
  Select,
  Input,
  Drawer,
  Descriptions,
  Timeline,
  Spin,
  Empty,
  message,
  Typography,
  Badge
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FilterOutlined,
  ReloadOutlined,
  EyeOutlined,
  HistoryOutlined,
  SyncOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuditLogs } from '../../../hooks/useAuditLogs';
import type {
  AuditLogEntry,
  AuditLogResponse,
  FieldChange,
  OperationType,
  AuditFilterParams
} from '../../../types/audit.types';

import './AuditLogPanel.css';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

/**
 * 操作类型颜色映射
 */
const OPERATION_COLORS: Record<OperationType, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  VIEW: 'default',
  EXPORT: 'purple'
};

/**
 * 操作类型文本映射
 */
const OPERATION_TEXT: Record<OperationType, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
  VIEW: '查看',
  EXPORT: '导出'
};

export interface AuditLogPanelProps {
  /** 资产 ID */
  assetId: string;
  /** 自定义类名 */
  className?: string;
  /** 是否显示筛选器 */
  showFilters?: boolean;
  /** 默认每页条数 */
  defaultPageSize?: number;
  /** 只读模式（隐藏操作列） */
  readOnly?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 外部传入的审计日志数据 */
  externalData?: AuditLogEntry[];
  /** 外部筛选参数 */
  externalFilters?: Partial<AuditFilterParams>;
  /** 数据变更回调 */
  onDataChange?: (data: AuditLogEntry[]) => void;
  /** 行点击回调 */
  onRowClick?: (record: AuditLogEntry) => void;
}

/**
 * AuditLogPanel 组件状态接口
 */
interface AuditLogPanelState {
  /** 当前页码 */
  currentPage: number;
  /** 每页条数 */
  pageSize: number;
  /** 操作类型筛选 */
  operationType: OperationType | undefined;
  /** 操作人筛选 */
  operator: string;
  /** 时间范围筛选 */
  dateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  /** 详情抽屉是否可见 */
  detailDrawerVisible: boolean;
  /** 当前查看详情的日志条目 */
  selectedLog: AuditLogEntry | null;
}

/**
 * 初始状态
 */
const initialState: AuditLogPanelState = {
  currentPage: 1,
  pageSize: 20,
  operationType: undefined,
  operator: '',
  dateRange: null,
  detailDrawerVisible: false,
  selectedLog: null
};

/**
 * AuditLogPanel 组件
 * 
 * 功能特性：
 * - 审计日志分页展示
 * - 操作类型、操作人、时间范围筛选
 * - @Auditable 注解字段变更高亮显示
 * - 审计详情抽屉展示
 * - 实时刷新功能
 * 
 * @param props - AuditLogPanelProps
 * @returns React 组件
 * 
 * @example
 * ```tsx
 * <AuditLogPanel
 *   assetId="asset-123"
 *   showFilters={true}
 *   defaultPageSize={20}
 *   onRowClick={(log) => console.log('Clicked:', log)}
 * />
 * ```
 */
export const AuditLogPanel: React.FC<AuditLogPanelProps> = ({
  assetId,
  className = '',
  showFilters = true,
  defaultPageSize = 20,
  readOnly = false,
  loading: externalLoading,
  externalData,
  externalFilters,
  onDataChange,
  onRowClick
}) => {
  // 组件状态
  const [state, setState] = useState<AuditLogPanelState>({
    ...initialState,
    pageSize: defaultPageSize
  });

  // 构建筛选参数
  const filterParams: AuditFilterParams = useMemo(() => ({
    assetId,
    page: state.currentPage,
    pageSize: state.pageSize,
    operationType: state.operationType,
    operator: state.operator || undefined,
    startDate: state.dateRange?.[0]?.toISOString(),
    endDate: state.dateRange?.[1]?.toISOString(),
    ...externalFilters
  }), [assetId, state.currentPage, state.pageSize, state.operationType, state.operator, state.dateRange, externalFilters]);

  // 使用审计日志 hook
  const {
    data: auditData,
    loading: hookLoading,
    error,
    refresh
  } = useAuditLogs(filterParams, !externalData);

  // 合并加载状态
  const isLoading = externalLoading ?? hookLoading;

  // 使用外部数据或 hook 数据
  const auditLogs = externalData ?? auditData?.items ?? [];
  const pagination = auditData?.pagination;

  // 数据变更通知
  React.useEffect(() => {
    if (onDataChange && auditLogs.length > 0) {
      onDataChange(auditLogs);
    }
  }, [auditLogs, onDataChange]);

  /**
   * 更新状态
   */
  const updateState = useCallback((updates: Partial<AuditLogPanelState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * 处理分页变化
   */
  const handlePageChange = useCallback((page: number, size: number) => {
    updateState({ currentPage: page, pageSize: size });
  }, [updateState]);

  /**
   * 处理筛选变化
   */
  const handleFilterChange = useCallback((
    key: keyof AuditLogPanelState,
    value: AuditLogPanelState[typeof key]
  ) => {
    updateState({ 
      [key]: value,
      currentPage: 1 // 重置页码
    });
  }, [updateState]);

  /**
   * 重置筛选条件
   */
  const handleResetFilters = useCallback(() => {
    updateState({
      operationType: undefined,
      operator: '',
      dateRange: null,
      currentPage: 1
    });
  }, [updateState]);

  /**
   * 刷新数据
   */
  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
      message.success('审计日志已刷新');
    } catch (err) {
      message.error('刷新失败，请重试');
    }
  }, [refresh]);

  /**
   * 查看详情
   */
  const handleViewDetail = useCallback((record: AuditLogEntry) => {
    updateState({
      detailDrawerVisible: true,
      selectedLog: record
    });
  }, [updateState]);

  /**
   * 关闭详情抽屉
   */
  const handleCloseDetail = useCallback(() => {
    updateState({
      detailDrawerVisible: false,
      selectedLog: null
    });
  }, [updateState]);

  /**
   * 处理行点击
   */
  const handleRowClick = useCallback((record: AuditLogEntry) => {
    if (onRowClick) {
      onRowClick(record);
    } else {
      handleViewDetail(record);
    }
  }, [onRowClick, handleViewDetail]);

  /**
   * 渲染变更明细
   */
  const renderChanges = useCallback((changes: FieldChange[]) => {
    if (!changes || changes.length === 0) {
      return <Text type="secondary">无变更</Text>;
    }

    return (
      <div className="audit-changes-summary">
        {changes.slice(0, 3).map((change, index) => (
          <div key={index} className={`audit-change-item ${change.auditable ? 'auditable-field' : ''}`}>
            <Tag color={change.auditable ? 'orange' : 'default'} className="audit-field-tag">
              {change.field}
            </Tag>
            {change.auditable && (
              <Badge status="warning" className="auditable-badge" />
            )}
            <Text delete type="secondary" className="change-old-value">
              {change.oldValue ?? '(空)'}
            </Text>
            <Text type="secondary"> → </Text>
            <Text className="change-new-value">
              {change.newValue ?? '(空)'}
            </Text>
          </div>
        ))}
        {changes.length > 3 && (
          <Text type="secondary" className="more-changes-text">
            + 还有 {changes.length - 3} 项变更
          </Text>
        )}
      </div>
    );
  }, []);

  /**
   * 表格列定义
   */
  const columns: ColumnsType<AuditLogEntry> = useMemo(() => [
    {
      title: '操作类型',
      dataIndex: 'operation',
      key: 'operation',
      width: 100,
      filters: [
        { text: '创建', value: 'CREATE' },
        { text: '更新', value: 'UPDATE' },
        { text: '删除', value: 'DELETE' },
        { text: '查看', value: 'VIEW' },
        { text: '导出', value: 'EXPORT' }
      ],
      onFilter: (value, record) => record.operation === value,
      render: (operation: OperationType) => (
        <Tag color={OPERATION_COLORS[operation]} className="operation-tag">
          {OPERATION_TEXT[operation]}
        </Tag>
      )
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 120,
      render: (operator: string) => (
        <Text>{operator || '系统'}</Text>
      )
    },
    {
      title: '操作时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      sorter: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      defaultSortOrder: 'descend',
      render: (timestamp: string) => (
        <Text type="secondary">
          {dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      )
    },
    {
      title: '变更内容',
      dataIndex: 'changes',
      key: 'changes',
      render: (changes: FieldChange[]) => renderChanges(changes)
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        !readOnly && (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetail(record);
            }}
          >
            详情
          </Button>
        )
      )
    }
  ], [readOnly, renderChanges, handleViewDetail]);

  /**
   * 渲染筛选器
   */
  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <div className="audit-log-filters">
        <Space wrap size="middle">
          <Select
            placeholder="操作类型"
            allowClear
            value={state.operationType}
            onChange={(value) => handleFilterChange('operationType', value)}
            style={{ width: 120 }}
            data-testid="operation-filter"
          >
            <Option value="CREATE">创建</Option>
            <Option value="UPDATE">更新</Option>
            <Option value="DELETE">删除</Option>
            <Option value="VIEW">查看</Option>
            <Option value="EXPORT">导出</Option>
          </Select>

          <Input
            placeholder="操作人"
            allowClear
            value={state.operator}
            onChange={(e) => handleFilterChange('operator', e.target.value)}
            style={{ width: 150 }}
            data-testid="operator-input"
          />

          <RangePicker
            value={state.dateRange}
            onChange={(dates) => handleFilterChange('dateRange', dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            showTime={{ format: 'HH:mm:ss' }}
            format="YYYY-MM-DD HH:mm:ss"
            data-testid="date-range-picker"
          />

          <Space>
            <Button
              type="primary"
              icon={<FilterOutlined />}
              onClick={() => {/* 筛选已实时应用 */}}
              data-testid="search-button"
            >
              筛选
            </Button>
            <Button onClick={handleResetFilters}>
              重置
            </Button>
          </Space>
        </Space>
      </div>
    );
  };

  /**
   * 渲染详情抽屉内容
   */
  const renderDetailContent = () => {
    if (!state.selectedLog) return null;

    const log = state.selectedLog;

    return (
      <div className="audit-detail-content">
        <Descriptions column={1} bordered size="small" className="audit-detail-descriptions">
          <Descriptions.Item label="日志 ID">
            <Text copyable className="log-id-text">{log.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="资产 ID">
            <Text copyable>{log.assetId}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="操作类型">
            <Tag color={OPERATION_COLORS[log.operation]}>
              {OPERATION_TEXT[log.operation]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="操作人">
            {log.operator || '系统'}
          </Descriptions.Item>
          <Descriptions.Item label="操作时间">
            {dayjs(log.timestamp).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          {log.ipAddress && (
            <Descriptions.Item label="IP 地址">
              {log.ipAddress}
            </Descriptions.Item>
          )}
          {log.userAgent && (
            <Descriptions.Item label="用户代理">
              <Text type="secondary" className="user-agent-text">
                {log.userAgent}
              </Text>
            </Descriptions.Item>
          )}
        </Descriptions>

        <Title level={5} className="changes-section-title">
          <HistoryOutlined /> 变更明细
        </Title>

        {log.changes && log.changes.length > 0 ? (
          <Timeline className="audit-changes-timeline">
            {log.changes.map((change, index) => (
              <Timeline.Item
                key={index}
                color={change.auditable ? 'orange' : 'blue'}
                className={change.auditable ? 'auditable-timeline-item' : ''}
              >
                <div className="timeline-change-item">
                  <div className="timeline-field-header">
                    <Tag color={change.auditable ? 'orange' : 'default'}>
                      {change.field}
                    </Tag>
                    {change.auditable && (
                      <Badge
                        status="warning"
                        text={<Text type="warning" className="auditable-label">@Auditable</Text>}
                      />
                    )}
                  </div>
                  <div className="timeline-change-values">
                    <Text type="secondary">旧值: </Text>
                    <Text delete className="old-value">{change.oldValue ?? '(空)'}</Text>
                    <br />
                    <Text type="secondary">新值: </Text>
                    <Text className="new-value">{change.newValue ?? '(空)'}</Text>
                  </div>
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        ) : (
          <Empty description="无变更记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>
    );
  };

  return (
    <Card
      className={`audit-log-panel ${className}`}
      title={
        <Space>
          <HistoryOutlined />
          <span>审计日志</span>
          <Badge
            count={pagination?.total ?? auditLogs.length}
            style={{ backgroundColor: '#52c41a' }}
            showZero
          />
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<SyncOutlined spin={isLoading} />}
            onClick={handleRefresh}
            loading={isLoading}
          >
            刷新
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleResetFilters}
          >
            重置
          </Button>
        </Space>
      }
      data-testid="audit-log-panel"
    >
      {renderFilters()}

      {isLoading ? (
        <div className="audit-loading-container">
          <Spin size="large" tip="加载审计日志..." />
        </div>
      ) : error ? (
        <div className="audit-error-container">
          <Empty
            description={
              <Space direction="vertical">
                <Text type="danger">加载审计日志失败</Text>
                <Text type="secondary">{error.message}</Text>
              </Space>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={handleRefresh}>
              重试
            </Button>
          </Empty>
        </div>
      ) : auditLogs.length === 0 ? (
        <Empty
          description={
            <Space direction="vertical">
              <Text>暂无审计记录</Text>
              <Text type="secondary">该资产暂无操作日志</Text>
            </Space>
          }
        />
      ) : (
        <Table
          columns={columns}
          dataSource={auditLogs}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: state.currentPage,
            pageSize: state.pageSize,
            total: pagination?.total ?? auditLogs.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: handlePageChange
          }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' }
          })}
          scroll={{ x: 800 }}
          size="middle"
          className="audit-log-table"
        />
      )}

      <Drawer
        title={
          <Space>
            <EyeOutlined />
            <span>审计详情</span>
          </Space>
        }
        placement="right"
        width={500}
        open={state.detailDrawerVisible}
        onClose={handleCloseDetail}
        className="audit-detail-drawer"
      >
        {renderDetailContent()}
      </Drawer>
    </Card>
  );
};

/**
 * 简化版审计日志面板（用于内嵌场景）
 */
export const AuditLogPanelCompact: React.FC<Omit<AuditLogPanelProps, 'showFilters'>> = (props) => {
  return (
    <AuditLogPanel
      {...props}
      showFilters={false}
      readOnly={props.readOnly ?? true}
    />
  );
};

export default AuditLogPanel;