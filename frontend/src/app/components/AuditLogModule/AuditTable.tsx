/**
 * AuditTable.tsx - 审计日志表格组件
 * 
 * 功能说明:
 * - 展示资产关联的审计日志列表
 * - 支持分页、排序、筛选操作
 * - 高亮显示 @Auditable 注解标记的字段变更
 * - 提供详情展开功能
 * 
 * @packageDocumentation
 * @module AuditLogModule
 * @requires antd
 * @requires react
 */

import React, { useMemo, useState } from 'react';
import { Table, Tag, Button, Space, Typography, Tooltip, Badge } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { 
  EyeOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  PlusOutlined, 
  DownloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import type { 
  AuditLog, 
  AuditOperationType, 
  FieldChange 
} from './types/audit.types';
import { useAuditableFields } from '../../hooks/useAuditableFields';
import styles from './AuditTable.module.css';

const { Text } = Typography;

/**
 * 操作类型到图标和颜色的映射配置
 */
const OPERATION_CONFIG: Record<AuditOperationType, { icon: React.ReactNode; color: string; label: string }> = {
  CREATE: { icon: <PlusOutlined />, color: 'green', label: '创建' },
  UPDATE: { icon: <EditOutlined />, color: 'blue', label: '更新' },
  DELETE: { icon: <DeleteOutlined />, color: 'red', label: '删除' },
  VIEW: { icon: <EyeOutlined />, color: 'default', label: '查看' },
  EXPORT: { icon: <DownloadOutlined />, color: 'purple', label: '导出' },
};

/**
 * AuditTable 组件 Props 接口
 */
export interface AuditTableProps {
  /** 审计日志数据列表 */
  dataSource: AuditLog[];
  /** 总记录数 */
  total: number;
  /** 当前页码 */
  current: number;
  /** 每页条数 */
  pageSize: number;
  /** 加载状态 */
  loading?: boolean;
  /** 行点击事件 */
  onRowClick?: (record: AuditLog) => void;
  /** 详情按钮点击事件 */
  onDetailClick?: (record: AuditLog) => void;
  /** 分页改变事件 */
  onPageChange?: (page: number, pageSize: number) => void;
  /** 排序事件 */
  onSort?: (field: string, order: 'ascend' | 'descend' | null) => void;
  /** 表格类名 */
  className?: string;
}

/**
 * AuditTable 组件
 * 
 * 用于展示资产审计日志的表格组件，支持分页和字段变更高亮。
 * 
 * @example
 * ```tsx
 * <AuditTable
 *   dataSource={auditLogs}
 *   total={100}
 *   current={1}
 *   pageSize={20}
 *   loading={false}
 *   onDetailClick={(log) => openDetailDrawer(log)}
 *   onPageChange={(page, size) => fetchLogs(page, size)}
 * />
 * ```
 * 
 * @param props - AuditTableProps
 * @returns React 组件
 */
export const AuditTable: React.FC<AuditTableProps> = ({
  dataSource,
  total,
  current,
  pageSize,
  loading = false,
  onRowClick,
  onDetailClick,
  onPageChange,
  onSort,
  className,
}) => {
  const { getAuditableHighlight } = useAuditableFields();
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  /**
   * 格式化时间戳
   * @param timestamp - ISO 格式时间戳
   * @returns 格式化后的时间字符串
   */
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  /**
   * 处理行展开状态变化
   * @param expanded - 是否展开
   * @param record - 对应的审计记录
   */
  const handleExpand = (expanded: boolean, record: AuditLog) => {
    setExpandedRowKeys(expanded ? [record.id] : []);
  };

  /**
   * 渲染变更摘要
   * @param changes - 字段变更列表
   * @returns 变更摘要 React 节点
   */
  const renderChangeSummary = (changes: FieldChange[]): React.ReactNode => {
    if (!changes || changes.length === 0) {
      return <Text type="secondary">无变更</Text>;
    }

    const auditableHighlights = getAuditableHighlight(changes);
    const displayChanges = changes.slice(0, 2);
    const remainingCount = changes.length - 2;

    return (
      <Space size={4} wrap>
        {displayChanges.map((change, index) => {
          const highlight = auditableHighlights[index];
          return (
            <Tooltip
              key={index}
              title={
                <div>
                  <div>字段: {change.field}</div>
                  <div>旧值: {change.oldValue ?? '空'}</div>
                  <div>新值: {change.newValue ?? '空'}</div>
                  {highlight?.highlight && (
                    <div style={{ color: '#faad14', marginTop: 4 }}>
                      ⚡ @Auditable 标记字段
                    </div>
                  )}
                </div>
              }
            >
              <Tag
                color={highlight?.highlight ? 'orange' : 'default'}
                style={{ marginRight: 4 }}
              >
                {change.field}
              </Tag>
            </Tooltip>
          );
        })}
        {remainingCount > 0 && (
          <Tag>+{remainingCount} 项</Tag>
        )}
      </Space>
    );
  };

  /**
   * 渲染操作类型标签
   * @param operation - 操作类型
   * @returns 操作类型标签
   */
  const renderOperationTag = (operation: AuditOperationType): React.ReactNode => {
    const config = OPERATION_CONFIG[operation] || OPERATION_CONFIG.VIEW;
    return (
      <Tag icon={config.icon} color={config.color}>
        {config.label}
      </Tag>
    );
  };

  /**
   * 表格列定义
   */
  const columns: ColumnsType<AuditLog> = useMemo(
    () => [
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
        render: renderOperationTag,
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
        sorter: true,
        render: (timestamp: string) => (
          <Text type="secondary">{formatTimestamp(timestamp)}</Text>
        ),
      },
      {
        title: '变更摘要',
        dataIndex: 'changes',
        key: 'changes',
        ellipsis: { showTitle: false },
        render: renderChangeSummary,
      },
      {
        title: '详情',
        key: 'actions',
        width: 80,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Tooltip title="查看详情">
              <Button
                type="text"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onDetailClick?.(record);
                }}
                data-testid="expand-detail"
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [getAuditableHighlight, onDetailClick]
  );

  /**
   * 分页配置
   */
  const pagination: TablePaginationConfig = useMemo(
    () => ({
      current,
      pageSize,
      total,
      showSizeChanger: true,
      showQuickJumper: true,
      showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
      pageSizeOptions: ['10', '20', '50', '100'],
      onChange: (page, size) => {
        onPageChange?.(page, size);
      },
    }),
    [current, pageSize, total, onPageChange]
  );

  /**
   * 行类名计算
   * @param record - 审计日志记录
   * @returns 行类名
   */
  const rowClassName = (record: AuditLog): string => {
    const hasAuditableChanges = record.changes?.some(
      (change) => change.auditable === true
    );
    return hasAuditableChanges ? styles.auditableRow : '';
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <Table<AuditLog>
        columns={columns}
        dataSource={dataSource}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        scroll={{ x: 800 }}
        size="middle"
        onRow={(record) => ({
          onClick: () => onRowClick?.(record),
          style: { cursor: onRowClick ? 'pointer' : 'default' },
        })}
        expandable={{
          expandedRowKeys,
          onExpand: handleExpand,
          expandedRowRender: (record) => (
            <div className={styles.expandedContent}>
              <div className={styles.detailSection}>
                <Text strong>完整变更明细</Text>
                <div className={styles.changesList}>
                  {record.changes?.map((change, index) => {
                    const highlight = getAuditableHighlight(record.changes || [])[index];
                    return (
                      <div 
                        key={index} 
                        className={`${styles.changeItem} ${highlight?.highlight ? styles.auditableHighlight : ''}`}
                      >
                        <Badge 
                          status={highlight?.highlight ? 'warning' : 'default'} 
                          text={
                            <span>
                              <Text strong>{change.field}</Text>
                              {highlight?.highlight && (
                                <Tag color="orange" size="small" style={{ marginLeft: 8 }}>
                                  @Auditable
                                </Tag>
                              )}
                            </span>
                          }
                        />
                        <div className={styles.changeValues}>
                          <Text delete type="secondary">{change.oldValue ?? '(空)'}</Text>
                          <Text style={{ margin: '0 8px' }}>→</Text>
                          <Text type="secondary">{change.newValue ?? '(空)'}</Text>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {record.description && (
                <div className={styles.detailSection}>
                  <Text strong>备注</Text>
                  <Text type="secondary">{record.description}</Text>
                </div>
              )}
            </div>
          ),
        }}
        rowClassName={rowClassName}
        locale={{
          emptyText: (
            <div className={styles.emptyState}>
              <InfoCircleOutlined style={{ fontSize: 48, color: '#ccc' }} />
              <Text type="secondary" style={{ marginTop: 16, display: 'block' }}>
                暂无审计记录
              </Text>
            </div>
          ),
        }}
      />
    </div>
  );
};

export default AuditTable;