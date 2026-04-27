/**
 * AuditTable.tsx - 审计日志表格组件
 *
 * @Auditable 字段变更可视化
 *
 * @description
 * 审计日志表格组件，负责展示资产的审计轨迹记录。
 * 支持分页、筛选、详情展开等功能。
 *
 * @see {@link https://ant.design/components/table/} Ant Design Table
 * @see {@link https://ant.design/components/drawer/} Ant Design Drawer
 *
 * @author SWARM-051 Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Empty,
  Spin,
  Tooltip,
  Badge,
} from 'antd';
import {
  EyeOutlined,
  AuditOutlined,
  FilterOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type {
  AuditLog,
  AuditLogListResponse,
  OperationType,
  FieldChange,
} from '../../types/audit.types';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useAuditableFields } from '../../hooks/useAuditableFields';
import { AuditFilter, AuditFilterValues } from './AuditFilter';
import { AuditDetailDrawer } from './AuditDetailDrawer';
import './AuditTable.css';

const { Text, Title } = Typography;

// 操作类型到颜色的映射
const OPERATION_COLORS: Record<OperationType, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  VIEW: 'default',
  EXPORT: 'purple',
};

// 操作类型中文标签
const OPERATION_LABELS: Record<OperationType, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
  VIEW: '查看',
  EXPORT: '导出',
};

/**
 * 审计日志表格属性接口
 */
export interface AuditTableProps {
  /** 资产ID */
  assetId: string;
  /** 是否显示筛选器 */
  showFilter?: boolean;
  /** 是否显示刷新按钮 */
  showRefresh?: boolean;
  /** 是否显示操作列 */
  showActions?: boolean;
  /** 默认每页数量 */
  defaultPageSize?: number;
  /** 自定义类名 */
  className?: string;
  /** 审计日志点击回调 */
  onAuditLogClick?: (log: AuditLog) => void;
  /** 加载状态变更回调 */
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * 审计日志表格组件
 *
 * @example
 * ```tsx
 * <AuditTable
 *   assetId="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
 *   showFilter={true}
 *   showRefresh={true}
 *   defaultPageSize={20}
 * />
 * ```
 */
export const AuditTable: React.FC<AuditTableProps> = ({
  assetId,
  showFilter = true,
  showRefresh = true,
  showActions = true,
  defaultPageSize = 20,
  className = '',
  onAuditLogClick,
  onLoadingChange,
}) => {
  // 状态管理
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);
  const [filterValues, setFilterValues] = useState<AuditFilterValues | null>(null);

  // 使用审计日志 hook
  const {
    data: auditData,
    isLoading,
    error,
    refetch,
  } = useAuditLog({
    assetId,
    page,
    pageSize,
    filters: filterValues ?? undefined,
  });

  // 使用 @Auditable 字段可视化 hook
  const { getAuditableHighlight, getHighlightBadge } = useAuditableFields();

  // 通知父组件加载状态变化
  React.useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  /**
   * 处理筛选条件变更
   *
   * @param filters - 新的筛选条件
   */
  const handleFilterChange = useCallback((filters: AuditFilterValues | null) => {
    setFilterValues(filters);
    setPage(1); // 重置到第一页
  }, []);

  /**
   * 处理分页变更
   *
   * @param newPage - 新的页码
   * @param newPageSize - 新的每页数量
   */
  const handlePageChange = useCallback((newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  }, []);

  /**
   * 处理刷新操作
   */
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  /**
   * 处理审计日志点击
   *
   * @param log - 被点击的审计日志
   */
  const handleAuditLogClick = useCallback((log: AuditLog) => {
    setSelectedLog(log);
    setDrawerVisible(true);
    onAuditLogClick?.(log);
  }, [onAuditLogClick]);

  /**
   * 处理抽屉关闭
   */
  const handleDrawerClose = useCallback(() => {
    setDrawerVisible(false);
    setSelectedLog(null);
  }, []);

  /**
   * 格式化时间戳
   *
   * @param timestamp - ISO 8601 格式的时间戳
   * @returns 格式化后的时间字符串
   */
  const formatTimestamp = useCallback((timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, []);

  /**
   * 渲染变更信息
   *
   * @param changes - 字段变更数组
   * @returns React 节点
   */
  const renderChanges = useCallback((changes: FieldChange[]): React.ReactNode => {
    if (!changes || changes.length === 0) {
      return <Text type="secondary">无变更</Text>;
    }

    const highlighted = getAuditableHighlight(changes);

    return (
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {highlighted.map((change, index) => (
          <div key={index} className={`audit-change-item ${change.highlight ? 'auditable-highlight' : ''}`}>
            <Tag color={change.highlight ? 'orange' : 'default'}>
              {change.field}
            </Tag>
            <Text type="secondary">
              {change.oldValue ?? '空'} → {change.newValue ?? '空'}
            </Text>
            {change.highlight && (
              <Tooltip title="@Auditable 标记字段">
                <Badge color="orange" />
              </Tooltip>
            )}
          </div>
        ))}
      </Space>
    );
  }, [getAuditableHighlight]);

  // 表格列定义
  const columns: ColumnsType<AuditLog> = useMemo(() => [
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
        { text: '导出', value: 'EXPORT' },
      ],
      onFilter: (value, record) => record.operation === value,
      render: (operation: OperationType) => (
        <Tag color={OPERATION_COLORS[operation]}>
          {OPERATION_LABELS[operation]}
        </Tag>
      ),
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 120,
      ellipsis: true,
      render: (operator: string) => (
        <Tooltip title={operator}>
          <Text>{operator}</Text>
        </Tooltip>
      ),
    },
    {
      title: '操作时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      sorter: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      defaultSortOrder: 'descend',
      render: (timestamp: string) => (
        <Text type="secondary">{formatTimestamp(timestamp)}</Text>
      ),
    },
    {
      title: '变更内容',
      dataIndex: 'changes',
      key: 'changes',
      ellipsis: true,
      render: (changes: FieldChange[]) => renderChanges(changes),
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
      ellipsis: true,
      render: (ip: string) => ip ? <Text type="secondary">{ip}</Text> : <Text type="secondary">-</Text>,
    },
  ], [formatTimestamp, renderChanges]);

  // 操作列定义
  const actionColumn: ColumnsType<AuditLog>[number] = useMemo(() => ({
    title: '操作',
    key: 'actions',
    width: 80,
    fixed: 'right',
    render: (_: unknown, record: AuditLog) => (
      <Button
        type="link"
        icon={<EyeOutlined />}
        onClick={() => handleAuditLogClick(record)}
        data-testid="expand-detail"
      >
        详情
      </Button>
    ),
  }), [handleAuditLogClick]);

  // 完整的列定义
  const fullColumns: ColumnsType<AuditLog> = useMemo(() => {
    return showActions ? [...columns, actionColumn] : columns;
  }, [columns, actionColumn, showActions]);

  // 计算分页配置
  const paginationConfig = useMemo(() => {
    const response = auditData as AuditLogListResponse | undefined;
    return {
      current: page,
      pageSize: pageSize,
      total: response?.pagination?.total ?? 0,
      showSizeChanger: true,
      showQuickJumper: true,
      showTotal: (total: number, range: [number, number]) =>
        `第 ${range[0]} - ${range[1]} 条，共 ${total} 条`,
      onChange: handlePageChange,
      pageSizeOptions: ['10', '20', '50', '100'],
    };
  }, [page, pageSize, auditData, handlePageChange]);

  // 渲染错误状态
  if (error) {
    return (
      <div className={`audit-table-container ${className}`}>
        <div className="audit-table-error">
          <Text type="danger">审计日志加载失败: {error.message}</Text>
          <Button onClick={handleRefresh}>重试</Button>
        </div>
      </div>
    );
  }

  // 渲染空状态
  const renderEmptyState = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="暂无审计记录"
      className="audit-table-empty"
    />
  );

  return (
    <div className={`audit-table-container ${className}`}>
      {/* 头部工具栏 */}
      <div className="audit-table-toolbar">
        <Space>
          <AuditOutlined />
          <Title level={5} style={{ margin: 0 }}>审计日志</Title>
          <Badge
            count={auditData?.pagination?.total ?? 0}
            style={{ backgroundColor: '#1890ff' }}
          />
        </Space>
        <Space>
          {showRefresh && (
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={isLoading}
            >
              刷新
            </Button>
          )}
        </Space>
      </div>

      {/* 筛选器 */}
      {showFilter && (
        <div className="audit-table-filter">
          <AuditFilter
            onFilterChange={handleFilterChange}
            initialValues={filterValues}
          />
        </div>
      )}

      {/* 表格 */}
      <Spin spinning={isLoading} tip="加载审计日志...">
        <Table<AuditLog>
          columns={fullColumns}
          dataSource={auditData?.data ?? []}
          rowKey="id"
          pagination={paginationConfig}
          scroll={{ x: 1000 }}
          locale={{
            emptyText: renderEmptyState,
          }}
          className="audit-table"
        />
      </Spin>

      {/* 详情抽屉 */}
      <AuditDetailDrawer
        visible={drawerVisible}
        auditLog={selectedLog}
        onClose={handleDrawerClose}
        getAuditableHighlight={getAuditableHighlight}
      />
    </div>
  );
};

export default AuditTable;