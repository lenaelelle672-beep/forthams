/**
 * AuditLogPanel Component
 * 
 * 审计日志面板组件 - 资产详情页面核心组件
 * 负责展示资产关联的所有审计轨迹，支持分页、筛选和详情查看
 * 
 * @description
 * - F-02: 资产关联审计日志实时加载与分页展示
 * - F-03: @Auditable 注解标记字段变更的高亮可视化
 * - F-04: 审计日志筛选（按操作类型、时间范围、操作人）
 * - F-05: 审计记录详情折叠展开
 * 
 * @see AuditLog
 * @see useAuditLog
 * @see AuditFilter
 * @see AuditDetailDrawer
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Table, Tag, Button, Space, Empty, Spin, message, Drawer } from 'antd';
import { 
  HistoryOutlined, 
  FilterOutlined, 
  EyeOutlined, 
  ReloadOutlined,
  ExpandOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { useAuditLog } from '../../../hooks/useAuditLog';
import { useAuditableFields } from '../../../hooks/useAuditableFields';
import type { AuditLog, AuditLogFilter, FieldChange } from '../../../types/audit.types';
import { AuditFilter } from './AuditFilter';
import { AuditDetailDrawer } from './AuditDetailDrawer';

import './AuditLogPanel.css';

/** 操作类型标签颜色映射 */
const OPERATION_COLORS: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  VIEW: 'default',
  EXPORT: 'purple'
};

/** 操作类型中文映射 */
const OPERATION_LABELS: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
  VIEW: '查看',
  EXPORT: '导出'
};

export interface AuditLogPanelProps {
  /** 资产 ID */
  assetId: string;
  /** 是否显示筛选器 */
  showFilter?: boolean;
  /** 是否显示刷新按钮 */
  showRefresh?: boolean;
  /** 默认每页数量 */
  defaultPageSize?: number;
  /** 自定义类名 */
  className?: string;
}

/**
 * AuditLogPanel 组件
 * 
 * 资产详情页面的审计日志面板组件，提供以下功能：
 * - 审计日志分页展示
 * - 操作类型、时间范围、操作人筛选
 * - 审计详情折叠展开
 * - @Auditable 字段变更高亮显示
 * 
 * @param props - 组件属性
 * @returns AuditLogPanel 组件
 */
export const AuditLogPanel: React.FC<AuditLogPanelProps> = ({
  assetId,
  showFilter = true,
  showRefresh = true,
  defaultPageSize = 20,
  className = ''
}) => {
  // 状态管理
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  
  // 筛选条件状态
  const [filters, setFilters] = useState<AuditLogFilter>({
    operationType: undefined,
    startTime: undefined,
    endTime: undefined,
    operator: undefined
  });

  // 使用审计日志 hook
  const {
    logs,
    pagination,
    loading,
    error,
    refresh,
    loadMore
  } = useAuditLog({
    assetId,
    page: 1,
    pageSize: defaultPageSize,
    ...filters
  });

  // 使用 @Auditable 字段可视化 hook
  const { getAuditableHighlight } = useAuditableFields();

  /**
   * 处理筛选条件变更
   * 
   * @param newFilters - 新的筛选条件
   */
  const handleFilterChange = useCallback((newFilters: AuditLogFilter) => {
    setFilters(newFilters);
  }, []);

  /**
   * 重置筛选条件
   */
  const handleFilterReset = useCallback(() => {
    setFilters({
      operationType: undefined,
      startTime: undefined,
      endTime: undefined,
      operator: undefined
    });
  }, []);

  /**
   * 处理刷新操作
   */
  const handleRefresh = useCallback(() => {
    refresh();
    message.success('审计日志已刷新');
  }, [refresh]);

  /**
   * 处理审计日志详情查看
   * 
   * @param log - 选中的审计日志
   */
  const handleViewDetail = useCallback((log: AuditLog) => {
    setSelectedLog(log);
    setDrawerVisible(true);
  }, []);

  /**
   * 关闭详情抽屉
   */
  const handleCloseDrawer = useCallback(() => {
    setDrawerVisible(false);
    setSelectedLog(null);
  }, []);

  /**
   * 格式化时间显示
   * 
   * @param timestamp - ISO 时间戳
   * @returns 格式化后的时间字符串
   */
  const formatTimestamp = useCallback((timestamp: string) => {
    return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
  }, []);

  /**
   * 判断是否有有效的筛选条件
   */
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.operationType ||
      filters.startTime ||
      filters.endTime ||
      filters.operator
    );
  }, [filters]);

  /**
   * 处理分页变更
   * 
   * @param page - 新的页码
   * @param pageSize - 新的每页数量
   */
  const handlePageChange = useCallback((page: number, pageSize: number) => {
    loadMore(page, pageSize);
  }, [loadMore]);

  /**
   * 渲染操作类型标签
   * 
   * @param operation - 操作类型
   * @returns React 节点
   */
  const renderOperationTag = useCallback((operation: string) => {
    const color = OPERATION_COLORS[operation] || 'default';
    const label = OPERATION_LABELS[operation] || operation;
    return <Tag color={color}>{label}</Tag>;
  }, []);

  /**
   * 渲染变更摘要
   * 
   * @param changes - 字段变更列表
   * @returns React 节点
   */
  const renderChangeSummary = useCallback((changes: FieldChange[]) => {
    if (!changes || changes.length === 0) {
      return <span className="change-summary-empty">无变更</span>;
    }

    const highlightedChanges = getAuditableHighlight(changes);
    const summaryItems = highlightedChanges.slice(0, 3).map((change, index) => {
      const isHighlighted = 'highlight' in change && change.highlight;
      return (
        <span 
          key={index} 
          className={`change-summary-item ${isHighlighted ? 'change-summary-highlight' : ''}`}
        >
          {change.field}
          {index < Math.min(highlightedChanges.length, 3) - 1 && '、'}
        </span>
      );
    });

    const suffix = highlightedChanges.length > 3 ? `等${highlightedChanges.length}项` : '';
    return (
      <span className="change-summary">
        {summaryItems}
        {suffix}
      </span>
    );
  }, [getAuditableHighlight]);

  // 表格列定义
  const columns: ColumnsType<AuditLog> = useMemo(() => [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: string) => (
        <span className="timestamp-cell">{formatTimestamp(timestamp)}</span>
      )
    },
    {
      title: '操作类型',
      dataIndex: 'operation',
      key: 'operation',
      width: 100,
      render: (operation: string) => renderOperationTag(operation)
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 120,
      render: (operator: string) => (
        <span className="operator-cell">{operator}</span>
      )
    },
    {
      title: '变更内容',
      dataIndex: 'changes',
      key: 'changes',
      render: (changes: FieldChange[]) => renderChangeSummary(changes)
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
          data-testid="expand-detail"
        >
          详情
        </Button>
      )
    }
  ], [formatTimestamp, renderOperationTag, renderChangeSummary, handleViewDetail]);

  // 渲染空状态
  const renderEmpty = useCallback(() => (
    <Empty 
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        hasActiveFilters ? '未找到符合条件的审计记录' : '暂无审计记录'
      }
    >
      {hasActiveFilters && (
        <Button type="link" onClick={handleFilterReset}>
          清除筛选
        </Button>
      )}
    </Empty>
  ), [hasActiveFilters, handleFilterReset]);

  // 渲染加载状态
  const renderLoading = useCallback(() => (
    <div className="audit-log-loading">
      <Spin size="large" tip="加载审计日志..." />
    </div>
  ), []);

  // 渲染错误状态
  const renderError = useCallback(() => (
    <div className="audit-log-error">
      <Empty 
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span className="error-message">
            审计日志加载失败: {error?.message || '未知错误'}
          </span>
        }
      >
        <Button type="primary" icon={<ReloadOutlined />} onClick={handleRefresh}>
          重试
        </Button>
      </Empty>
    </div>
  ), [error, handleRefresh]);

  return (
    <Card 
      className={`audit-log-panel ${className}`}
      title={
        <div className="audit-log-panel-header">
          <HistoryOutlined />
          <span>审计日志</span>
          {pagination && pagination.total > 0 && (
            <Tag className="audit-count-tag">
              共 {pagination.total} 条
            </Tag>
          )}
        </div>
      }
      extra={
        <Space>
          {showFilter && (
            <Button 
              icon={<FilterOutlined />}
              onClick={() => setFilterVisible(!filterVisible)}
              type={hasActiveFilters ? 'primary' : 'default'}
              ghost={hasActiveFilters}
            >
              筛选
              {hasActiveFilters && (
                <span className="filter-badge">•</span>
              )}
            </Button>
          )}
          {showRefresh && (
            <Button 
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
            >
              刷新
            </Button>
          )}
        </Space>
      }
      styles={{
        body: { padding: filterVisible ? '0 24px 24px' : 24 }
      }}
    >
      {/* 筛选器 */}
      {showFilter && filterVisible && (
        <AuditFilter
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleFilterReset}
          visible={filterVisible}
          onClose={() => setFilterVisible(false)}
        />
      )}

      {/* 审计日志表格 */}
      {loading && logs.length === 0 ? (
        renderLoading()
      ) : error && logs.length === 0 ? (
        renderError()
      ) : (
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          pagination={{
            current: pagination?.page || 1,
            pageSize: pagination?.pageSize || defaultPageSize,
            total: pagination?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 页，共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: handlePageChange
          }}
          locale={{
            emptyText: renderEmpty()
          }}
          className="audit-log-table"
          size="middle"
        />
      )}

      {/* 审计详情抽屉 */}
      <AuditDetailDrawer
        visible={drawerVisible}
        auditLog={selectedLog}
        onClose={handleCloseDrawer}
      />
    </Card>
  );
};

export default AuditLogPanel;