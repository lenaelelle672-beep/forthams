/**
 * AssetWorkOrderHistory Component
 *
 * 展示资产关联工单的历史记录列表。
 * 显示工单编号、标题、状态、优先级、创建时间等关键信息。
 *
 * @module components/AssetWorkOrderHistory
 * @since SWARM-033
 */

import React from 'react';
import { Table, Empty, Spin, Tag, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';

/**
 * 工单记录数据
 */
export interface WorkOrderHistoryItem {
  id: number;
  workOrderNo?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assetId?: number;
  assetName?: string;
  reporterName?: string;
  assigneeName?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  estimatedCost?: number;
  actualCost?: number;
  createTime?: string;
  updateTime?: string;
  [key: string]: unknown;
}

/**
 * 工单状态颜色映射
 */
const WORK_ORDER_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'default',
  PENDING: 'processing',
  APPROVED: 'blue',
  EXECUTING: 'orange',
  COMPLETED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

/**
 * 工单状态中文标签
 */
const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待审批',
  APPROVED: '待派工',
  EXECUTING: '处理中',
  COMPLETED: '已完成',
  REJECTED: '已驳回',
  CANCELLED: '已取消',
};

/**
 * 优先级颜色映射
 */
const PRIORITY_COLORS: Record<string, string> = {
  NORMAL: 'blue',
  URGENT: 'orange',
  EMERGENCY: 'red',
};

/**
 * 优先级中文标签
 */
const PRIORITY_LABELS: Record<string, string> = {
  NORMAL: '中',
  URGENT: '高',
  EMERGENCY: '紧急',
};

interface AssetWorkOrderHistoryProps {
  /** 工单记录列表 */
  workOrders: WorkOrderHistoryItem[];
  /** 总记录数 */
  total: number;
  /** 加载状态 */
  loading?: boolean;
  /** 当前页码 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 分页变更回调 */
  onPageChange?: (page: number, pageSize: number) => void;
  /** 工单行点击回调 */
  onWorkOrderClick?: (record: WorkOrderHistoryItem) => void;
}

/**
 * AssetWorkOrderHistory 组件
 *
 * @param props - 组件属性
 * @returns 工单历史列表 JSX
 */
const AssetWorkOrderHistory: React.FC<AssetWorkOrderHistoryProps> = ({
  workOrders,
  total,
  loading = false,
  page = 1,
  pageSize = 10,
  onPageChange,
  onWorkOrderClick,
}) => {
  const columns: ColumnsType<WorkOrderHistoryItem> = [
    {
      title: '工单编号',
      dataIndex: 'workOrderNo',
      key: 'workOrderNo',
      width: 150,
      render: (text: string, record: WorkOrderHistoryItem) => (
        <Button
          type="link"
          size="small"
          onClick={() => onWorkOrderClick?.(record)}
          data-testid={`workorder-link-${record.id}`}
        >
          {text || record.id}
        </Button>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={WORK_ORDER_STATUS_COLORS[status] || 'default'}>
          {WORK_ORDER_STATUS_LABELS[status] || status || '-'}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => (
        <Tag color={PRIORITY_COLORS[priority] || 'default'}>
          {PRIORITY_LABELS[priority] || priority || '-'}
        </Tag>
      ),
    },
    {
      title: '报告人',
      dataIndex: 'reporterName',
      key: 'reporterName',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '负责人',
      dataIndex: 'assigneeName',
      key: 'assigneeName',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 170,
      render: (text: string) =>
        text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
  ];

  if (loading && workOrders.length === 0) {
    return (
      <div data-testid="workorder-loading" style={{ textAlign: 'center', padding: '24px 0' }}>
        <Spin tip="工单数据加载中..." />
      </div>
    );
  }

  if (!loading && workOrders.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="该资产暂无关联工单"
        data-testid="workorder-empty"
      />
    );
  }

  return (
    <div data-testid="workorder-history">
      <Table<WorkOrderHistoryItem>
        dataSource={workOrders}
        columns={columns}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 条工单`,
          onChange: onPageChange,
        }}
        onRow={(record) => ({
          onClick: () => onWorkOrderClick?.(record),
          style: { cursor: onWorkOrderClick ? 'pointer' : 'default' },
        })}
      />
    </div>
  );
};

export default AssetWorkOrderHistory;
