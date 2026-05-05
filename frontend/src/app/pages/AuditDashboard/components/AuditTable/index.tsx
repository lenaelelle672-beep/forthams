/**
 * AuditTable Component — SWARM-AUD-001 Operation Log Dashboard
 *
 * Renders a detailed audit record table with pagination, expandable rows,
 * and status tagging. Consumes data from the useAuditData hook.
 *
 * @module AuditDashboard/AuditTable
 * @requires antd
 * @requires react
 */

import React, { useCallback } from 'react';
import { Table, Tag, Tooltip, Space } from 'antd';
import type { TableProps, TablePaginationConfig } from 'antd';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  ExpandOutlined,
} from '@ant-design/icons';

import type { AuditRecord } from '../../types/audit';

export interface AuditTableProps {
  /** List of audit records to display */
  records: AuditRecord[];
  /** Total count of records matching current filters */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of records per page */
  pageSize: number;
  /** Whether the table is currently loading */
  loading?: boolean;
  /** Callback invoked when pagination or sort changes */
  onChange: (pagination: {
    page: number;
    pageSize: number;
    sortField?: string;
    sortOrder?: 'ascend' | 'descend';
  }) => void;
  /** Callback invoked when a row is expanded */
  onExpand?: (record: AuditRecord) => void;
  /** Whether a row is currently expanded */
  expandedRowKeys?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps action type strings to Ant Design Tag color tokens.
 */
const ACTION_TYPE_COLORS: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  QUERY: 'default',
  EXPORT: 'purple',
  LOGIN: 'cyan',
  LOGOUT: 'orange',
};

/**
 * Formats an ISO8601 timestamp to a locale-aware date-time string.
 */
const formatTimestamp = (ts: string): string => {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return ts;
  }
};

/**
 * Safely parses and pretty-prints a JSON detail string.
 */
const formatDetail = (detail: string): React.ReactNode => {
  try {
    const parsed = JSON.parse(detail);
    return (
      <pre
        style={{
          margin: 0,
          fontSize: 12,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          color: 'var(--color-text-secondary, #595959)',
        }}
      >
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  } catch {
    return <span>{detail}</span>;
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * StatusBadge renders a coloured tag for SUCCESS / FAILURE audit statuses.
 */
const StatusBadge: React.FC<{ status: AuditRecord['status'] }> = ({ status }) => {
  if (status === 'SUCCESS') {
    return (
      <Tag icon={<CheckCircleOutlined />} color="success">
        成功
      </Tag>
    );
  }
  return (
    <Tag icon={<CloseCircleOutlined />} color="error">
      失败
    </Tag>
  );
};

/**
 * ActionTypeTag renders a coloured tag for each audit action type.
 */
const ActionTypeTag: React.FC<{ actionType: string }> = ({ actionType }) => {
  const color = ACTION_TYPE_COLORS[actionType] ?? 'default';
  return <Tag color={color}>{actionType}</Tag>;
};

// ─── Column Definitions ───────────────────────────────────────────────────────

const buildColumns = (
  onExpand: AuditTableProps['onExpand'],
  expandedRowKeys: AuditTableProps['expandedRowKeys']
): TableProps<AuditRecord>['columns'] => [
  {
    title: '时间戳',
    dataIndex: 'timestamp',
    key: 'timestamp',
    width: 200,
    sorter: true,
    render: (ts: string) => (
      <Tooltip title={ts}>
        <span>{formatTimestamp(ts)}</span>
      </Tooltip>
    ),
  },
  {
    title: '操作者',
    key: 'operator',
    width: 160,
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        <span>{record.operatorName}</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary, #8c8c8c)' }}>
          {record.operatorId}
        </span>
      </Space>
    ),
  },
  {
    title: '操作类型',
    dataIndex: 'actionType',
    key: 'actionType',
    width: 120,
    filters: [
      { text: 'CREATE', value: 'CREATE' },
      { text: 'UPDATE', value: 'UPDATE' },
      { text: 'DELETE', value: 'DELETE' },
      { text: 'QUERY', value: 'QUERY' },
      { text: 'EXPORT', value: 'EXPORT' },
      { text: 'LOGIN', value: 'LOGIN' },
      { text: 'LOGOUT', value: 'LOGOUT' },
    ],
    onFilter: (value, record) => record.actionType === value,
    render: (actionType: string) => <ActionTypeTag actionType={actionType} />,
  },
  {
    title: '资源类型',
    dataIndex: 'resourceType',
    key: 'resourceType',
    width: 120,
    filters: [
      { text: 'User', value: 'User' },
      { text: 'Policy', value: 'Policy' },
      { text: 'Config', value: 'Config' },
      { text: 'Asset', value: 'Asset' },
    ],
    onFilter: (value, record) => record.resourceType === value,
  },
  {
    title: '资源ID',
    dataIndex: 'resourceId',
    key: 'resourceId',
    width: 180,
    ellipsis: { showTitle: false },
    render: (id: string) => (
      <Tooltip title={id} placement="topLeft">
        <span>{id}</span>
      </Tooltip>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    filters: [
      { text: '成功', value: 'SUCCESS' },
      { text: '失败', value: 'FAILURE' },
    ],
    onFilter: (value, record) => record.status === value,
    render: (status: AuditRecord['status']) => <StatusBadge status={status} />,
  },
  {
    title: '',
    key: 'expand',
    width: 50,
    align: 'center',
    render: (_, record) => {
      const isExpanded = expandedRowKeys?.includes(record.id);
      return (
        <Tooltip title={isExpanded ? '收起详情' : '展开详情'}>
          <ExpandOutlined
            style={{ cursor: 'pointer', color: 'var(--color-primary, #1890ff)' }}
            onClick={() => onExpand?.(record)}
            aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
          />
        </Tooltip>
      );
    },
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * AuditTable
 *
 * Displays paginated, sortable, and filterable audit log records with
 * expandable detail rows. Integrates with the useAuditData hook via
 * the onChange callback pattern.
 *
 * @example
 * ```tsx
 * <AuditTable
 *   records={data.records}
 *   total={data.total}
 *   page={pagination.page}
 *   pageSize={pagination.pageSize}
 *   loading={loading}
 *   onChange={handleTableChange}
 *   expandedRowKeys={expandedKeys}
 *   onExpand={handleExpand}
 * />
 * ```
 */
const AuditTable: React.FC<AuditTableProps> = ({
  records,
  total,
  page,
  pageSize,
  loading = false,
  onChange,
  onExpand,
  expandedRowKeys = [],
}) => {
  /**
   * Handles all table state changes (pagination, sorters, filters).
   * Converts Ant Design conventions to the flat callback shape expected
   * by useAuditData.
   */
  const handleTableChange: TableProps<AuditRecord>['onChange'] = useCallback(
    (
      pagination: TablePaginationConfig,
      _filters: Record<string, FilterValue | null>,
      sorter: SorterResult<AuditRecord> | SorterResult<AuditRecord>[]
    ) => {
      const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      onChange({
        page: pagination.current ?? 1,
        pageSize: pagination.pageSize ?? pageSize,
        sortField: singleSorter?.field as string | undefined,
        sortOrder: singleSorter?.order,
      });
    },
    [onChange, pageSize]
  );

  const columns = buildColumns(onExpand, expandedRowKeys);

  const expandedRowRender = (record: AuditRecord) => (
    <div style={{ padding: '8px 0' }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>
        <InfoCircleOutlined /> 变更详情 — {record.resourceType} / {record.resourceId}
      </div>
      <div style={{ marginBottom: 8 }}>
        <strong>IP地址:</strong> {record.ipAddress}
      </div>
      <div style={{ marginBottom: 8 }}>
        <strong>User-Agent:</strong> {record.userAgent}
      </div>
      <div>
        <strong>详情:</strong>
        <div style={{ marginTop: 4 }}>{formatDetail(record.detail)}</div>
      </div>
    </div>
  );

  return (
    <Table<AuditRecord>
      dataSource={records}
      columns={columns}
      rowKey="id"
      loading={loading}
      expandable={{
        expandedRowRender,
        expandedRowKeys,
        showExpandColumn: false, // We use a custom expand column instead
      }}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (t, range) => `第 ${range[0]}-${range[1]} 条，共 ${t} 条记录`,
        pageSizeOptions: ['10', '20', '50', '100'],
      }}
      onChange={handleTableChange}
      scroll={{ x: 1100 }}
      locale={{
        emptyText: '暂无操作记录',
      }}
      size="middle"
      style={{ backgroundColor: 'var(--color-bg-container, #fff)' }}
    />
  );
};

export default AuditTable;