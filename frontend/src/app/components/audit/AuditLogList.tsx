/**
 * @file AuditLogList.tsx
 * @description 审计日志列表展示组件
 * 
 * 功能特性：
 * - 支持审计日志的列表展示、分页、筛选
 * - 支持查看审计日志详情
 * - 支持实时刷新审计日志
 * - 完整的 TypeScript 类型定义
 * - 响应式布局适配
 * 
 * @see ATB-2: 审计日志展示模块测试
 * @see AuditLogDetailDrawer: 审计日志详情抽屉组件
 * @see AuditLogFilter: 审计日志筛选组件
 * 
 * @package @auditable/audit-module
 * @version 1.0.0
 */

import React, { useMemo, useCallback, useState } from 'react';
import { Table, Tag, Button, Space, Typography, Tooltip, Card, Spin, Alert, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, EyeOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuditLogs } from '@/hooks/useAuditLogs';
import { AuditLogFilter, type AuditLogFilterValues } from './AuditLogFilter';
import { AuditLogDetailDrawer } from './AuditLogDetailDrawer';
import type { AuditLog, AuditLogQuery, FieldChange } from '@/types/audit.types';

import './AuditLogList.css';

const { Text, Title } = Typography;

/**
 * 审计日志操作类型的中文映射
 */
const OPERATION_TYPE_MAP: Record<string, { label: string; color: string }> = {
  CREATE: { label: '创建', color: 'green' },
  UPDATE: { label: '更新', color: 'blue' },
  DELETE: { label: '删除', color: 'red' },
  VIEW: { label: '查看', color: 'default' },
};

/**
 * 审计日志列表组件 Props 接口
 */
export interface AuditLogListProps {
  /** 资产ID，用于筛选特定资产的审计日志 */
  assetId?: string;
  /** 是否显示筛选区域 */
  showFilter?: boolean;
  /** 是否显示时间线视图切换按钮 */
  showTimelineToggle?: boolean;
  /** 时间线视图回调 */
  onTimelineToggle?: (show: boolean) => void;
  /** 是否默认显示时间线视图 */
  defaultTimelineView?: boolean;
  /** 每页显示条数 */
  pageSize?: number;
  /** 自定义类名 */
  className?: string;
  /** 最大高度，用于滚动容器 */
  maxHeight?: number | string;
  /** 实时同步开关 */
  enableRealtime?: boolean;
  /** 实时同步回调 */
  onNewLogReceived?: (log: AuditLog) => void;
}

/**
 * 审计日志列表组件状态
 */
interface AuditLogListState {
  /** 当前选中的日志详情 */
  selectedLog: AuditLog | null;
  /** 详情抽屉是否可见 */
  detailDrawerVisible: boolean;
  /** 是否显示时间线视图 */
  showTimeline: boolean;
}

/**
 * 表格行数据接口（包含原始数据和扩展信息）
 */
interface AuditLogTableRow extends AuditLog {
  /** 变更字段数量 */
  changedFieldCount: number;
  /** 是否为新日志（实时同步场景） */
  isNew?: boolean;
  /** 变更摘要 */
  changeSummary?: string;
}

/**
 * 审计日志列表组件
 * 
 * @description
 * 提供审计日志的完整列表展示功能，支持：
 * - 分页查询
 * - 多维度筛选
 * - 详情查看
 * - 实时同步（可选）
 * 
 * @example
 * ```tsx
 * // 基础用法
 * <AuditLogList assetId="asset-001" />
 * 
 * // 禁用筛选，显示时间线视图
 * <AuditLogList 
 *   assetId="asset-001"
 *   showFilter={false}
 *   defaultTimelineView={true}
 * />
 * 
 * // 启用实时同步
 * <AuditLogList
 *   assetId="asset-001"
 *   enableRealtime={true}
 *   onNewLogReceived={(log) => console.log('New log:', log)}
 * />
 * ```
 * 
 * @param props - 组件属性
 * @returns React 组件
 * 
 * @since 1.0.0
 */
export const AuditLogList: React.FC<AuditLogListProps> = ({
  assetId,
  showFilter = true,
  showTimelineToggle = false,
  onTimelineToggle,
  defaultTimelineView = false,
  pageSize = 10,
  className = '',
  maxHeight,
  enableRealtime = false,
  onNewLogReceived,
}) => {
  // 组件状态管理
  const [state, setState] = useState<AuditLogListState>({
    selectedLog: null,
    detailDrawerVisible: false,
    showTimeline: defaultTimelineView,
  });

  // 筛选条件状态
  const [filterValues, setFilterValues] = useState<AuditLogFilterValues>({
    startDate: undefined,
    endDate: undefined,
    operationType: undefined,
    operatorName: '',
  });

  // 构建查询参数
  const queryParams = useMemo<AuditLogQuery>(() => {
    return {
      assetId,
      startDate: filterValues.startDate?.format('YYYY-MM-DD'),
      endDate: filterValues.endDate?.format('YYYY-MM-DD'),
      operationType: filterValues.operationType,
      operatorName: filterValues.operatorName || undefined,
      page: 1,
      pageSize,
    };
  }, [assetId, filterValues, pageSize]);

  // 使用 React Query 获取审计日志数据
  const {
    data: auditLogsResponse,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useAuditLogs(queryParams, {
    enabled: true,
    staleTime: 30000, // 30秒缓存
    refetchInterval: enableRealtime ? 10000 : undefined, // 实时模式下10秒轮询
  });

  // 提取日志列表
  const auditLogs = useMemo<AuditLog[]>(() => {
    return auditLogsResponse?.items || [];
  }, [auditLogsResponse]);

  // 处理筛选条件变更
  const handleFilterChange = useCallback((values: AuditLogFilterValues) => {
    setFilterValues(values);
  }, []);

  // 处理筛选重置
  const handleFilterReset = useCallback(() => {
    setFilterValues({
      startDate: undefined,
      endDate: undefined,
      operationType: undefined,
      operatorName: '',
    });
  }, []);

  // 处理日志选择
  const handleLogSelect = useCallback((log: AuditLog) => {
    setState((prev) => ({
      ...prev,
      selectedLog: log,
      detailDrawerVisible: true,
    }));
  }, []);

  // 处理详情抽屉关闭
  const handleDetailDrawerClose = useCallback(() => {
    setState((prev) => ({
      ...prev,
      detailDrawerVisible: false,
    }));
  }, []);

  // 处理时间线视图切换
  const handleTimelineToggle = useCallback(() => {
    const newValue = !state.showTimeline;
    setState((prev) => ({ ...prev, showTimeline: newValue }));
    onTimelineToggle?.(newValue);
  }, [state.showTimeline, onTimelineToggle]);

  // 处理刷新
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // 转换数据为表格行数据
  const tableData = useMemo<AuditLogTableRow[]>(() => {
    return auditLogs.map((log) => {
      const changedFieldCount = log.fieldChanges?.length || 0;
      const changeSummary = generateChangeSummary(log.fieldChanges);
      return {
        ...log,
        changedFieldCount,
        changeSummary,
      };
    });
  }, [auditLogs]);

  // 表格列配置
  const columns = useMemo<ColumnsType<AuditLogTableRow>>(() => {
    return [
      {
        title: '操作时间',
        dataIndex: 'operationTime',
        key: 'operationTime',
        width: 180,
        sorter: (a, b) => {
          const timeA = dayjs(a.operationTime).valueOf();
          const timeB = dayjs(b.operationTime).valueOf();
          return timeA - timeB;
        },
        defaultSortOrder: 'descend',
        render: (time: string) => {
          const formattedTime = dayjs(time).format('YYYY-MM-DD HH:mm:ss');
          return (
            <Text className="audit-log-time">
              {formattedTime}
            </Text>
          );
        },
      },
      {
        title: '操作类型',
        dataIndex: 'operationType',
        key: 'operationType',
        width: 100,
        filters: [
          { text: '创建', value: 'CREATE' },
          { text: '更新', value: 'UPDATE' },
          { text: '删除', value: 'DELETE' },
          { text: '查看', value: 'VIEW' },
        ],
        onFilter: (value, record) => record.operationType === value,
        render: (type: keyof typeof OPERATION_TYPE_MAP) => {
          const config = OPERATION_TYPE_MAP[type] || { label: type, color: 'default' };
          return (
            <Tag color={config.color} className="audit-log-type-tag">
              {config.label}
            </Tag>
          );
        },
      },
      {
        title: '操作人',
        dataIndex: 'operatorName',
        key: 'operatorName',
        width: 120,
        ellipsis: true,
        render: (name: string) => (
          <Tooltip title={name}>
            <Text className="audit-log-operator">{name}</Text>
          </Tooltip>
        ),
      },
      {
        title: '变更摘要',
        dataIndex: 'changeSummary',
        key: 'changeSummary',
        ellipsis: true,
        render: (summary: string, record: AuditLogTableRow) => (
          <Tooltip title={summary || '无变更字段'}>
            <Text className="audit-log-summary">
              {record.changedFieldCount > 0 
                ? `${record.changedFieldCount} 个字段变更`
                : '无变更'}
            </Text>
          </Tooltip>
        ),
      },
      {
        title: '操作IP',
        dataIndex: 'operatorIp',
        key: 'operatorIp',
        width: 140,
        ellipsis: true,
        render: (ip: string) => (
          <Text className="audit-log-ip" type="secondary">
            {ip || '-'}
          </Text>
        ),
      },
      {
        title: '操作',
        key: 'action',
        width: 100,
        fixed: 'right',
        render: (_, record) => (
          <Space size="small">
            <Tooltip title="查看详情">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleLogSelect(record)}
                className="audit-log-detail-btn"
              >
                详情
              </Button>
            </Tooltip>
          </Space>
        ),
      },
    ];
  }, [handleLogSelect]);

  // 分页配置
  const paginationConfig = useMemo(() => {
    return {
      current: auditLogsResponse?.page || 1,
      pageSize: auditLogsResponse?.pageSize || pageSize,
      total: auditLogsResponse?.total || 0,
      showSizeChanger: true,
      showQuickJumper: true,
      showTotal: (total: number, range: [number, number]) =>
        `显示 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
      pageSizeOptions: ['10', '20', '50'],
      onChange: (page: number, size: number) => {
        // 实际分页逻辑通过 React Query 重新获取数据
        setFilterValues((prev) => ({ ...prev }));
      },
    };
  }, [auditLogsResponse, pageSize]);

  // 表格滚动配置
  const scrollConfig = useMemo(() => {
    if (maxHeight) {
      return { y: maxHeight, x: 'max-content' };
    }
    return { x: 'max-content' };
  }, [maxHeight]);

  // 渲染加载状态
  if (isLoading) {
    return (
      <Card className={`audit-log-list-container ${className}`}>
        <div className="audit-log-loading">
          <Spin size="large" tip="加载审计日志中..." />
        </div>
      </Card>
    );
  }

  // 渲染错误状态
  if (isError) {
    return (
      <Card className={`audit-log-list-container ${className}`}>
        <Alert
          type="error"
          message="加载失败"
          description={error?.message || '无法获取审计日志数据，请稍后重试'}
          showIcon
          action={
            <Button size="small" onClick={handleRefresh}>
              重试
            </Button>
          }
        />
      </Card>
    );
  }

  // 渲染空状态
  if (!auditLogs.length) {
    return (
      <Card className={`audit-log-list-container ${className}`}>
        <Empty 
          description="暂无审计日志记录" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
        {showFilter && (
          <div className="audit-log-filter-section">
            <AuditLogFilter
              values={filterValues}
              onChange={handleFilterChange}
              onReset={handleFilterReset}
            />
          </div>
        )}
      </Card>
    );
  }

  // 渲染主内容
  return (
    <Card 
      className={`audit-log-list-container ${className}`}
      title={
        <div className="audit-log-header">
          <Title level={5} className="audit-log-title">审计日志</Title>
          <Space>
            {showTimelineToggle && (
              <Button
                type="text"
                onClick={handleTimelineToggle}
                className="audit-log-timeline-toggle"
              >
                {state.showTimeline ? '列表视图' : '时间线视图'}
              </Button>
            )}
            <Button
              type="text"
              icon={<ReloadOutlined spin={isRefetching} />}
              onClick={handleRefresh}
              disabled={isRefetching}
              className="audit-log-refresh-btn"
            >
              {isRefetching ? '刷新中...' : '刷新'}
            </Button>
          </Space>
        </div>
      }
    >
      {/* 筛选区域 */}
      {showFilter && (
        <div className="audit-log-filter-section">
          <AuditLogFilter
            values={filterValues}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
            showAdvancedFilter={false}
          />
        </div>
      )}

      {/* 统计信息 */}
      <div className="audit-log-stats">
        <Text type="secondary">
          共 {auditLogsResponse?.total || 0} 条记录，
          当前页 {auditLogs.length} 条
          {enableRealtime && (
            <Tag color="green" className="audit-log-realtime-tag">
              实时同步已开启
            </Tag>
          )}
        </Text>
      </div>

      {/* 数据表格 */}
      <Table<AuditLogTableRow>
        columns={columns}
        dataSource={tableData}
        rowKey="id"
        pagination={paginationConfig}
        scroll={scrollConfig}
        loading={isRefetching}
        size="middle"
        className="audit-log-table"
        rowClassName={(record) => 
          record.isNew ? 'audit-log-row-new' : ''
        }
        onRow={(record) => ({
          onClick: () => handleLogSelect(record),
          style: { cursor: 'pointer' },
        })}
      />

      {/* 详情抽屉 */}
      <AuditLogDetailDrawer
        visible={state.detailDrawerVisible}
        auditLog={state.selectedLog}
        onClose={handleDetailDrawerClose}
      />
    </Card>
  );
};

/**
 * 生成变更摘要文本
 * 
 * @param fieldChanges - 字段变更列表
 * @returns 变更摘要字符串
 */
function generateChangeSummary(fieldChanges?: FieldChange[]): string {
  if (!fieldChanges || fieldChanges.length === 0) {
    return '无变更字段';
  }

  const summaryParts = fieldChanges
    .slice(0, 3) // 最多显示3个字段
    .map((change) => {
      const fieldLabel = change.fieldName;
      if (change.oldValue === null) {
        return `${fieldLabel}: 新增 "${change.newValue}"`;
      }
      if (change.newValue === null) {
        return `${fieldLabel}: 删除 "${change.oldValue}"`;
      }
      return `${fieldLabel}: ${change.oldValue} → ${change.newValue}`;
    });

  if (fieldChanges.length > 3) {
    summaryParts.push(`...等 ${fieldChanges.length} 项变更`);
  }

  return summaryParts.join('；');
}

/**
 * 带筛选器的审计日志列表组件
 * 
 * @description 组合了 AuditLogFilter 和 AuditLogList 的完整功能
 * 
 * @example
 * ```tsx
 * <AuditLogListWithFilter assetId="asset-001" />
 * ```
 */
export const AuditLogListWithFilter: React.FC<Omit<AuditLogListProps, 'showFilter'>> = (props) => {
  return <AuditLogList {...props} showFilter={true} />;
};

/**
 * 带实时同步的审计日志列表组件
 * 
 * @description 启用了实时同步功能的审计日志列表
 * 
 * @example
 * ```tsx
 * <AuditLogListRealtime 
 *   assetId="asset-001" 
 *   onNewLogReceived={(log) => notification.info({ message: '新审计日志', description: `操作类型: ${log.operationType}` })}
 * />
 * ```
 */
export const AuditLogListRealtime: React.FC<AuditLogListProps> = (props) => {
  return <AuditLogList {...props} enableRealtime={true} />;
};

export default AuditLogList;