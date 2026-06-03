/**
 * WorkOrderList Component
 * 
 * 工单列表组件 - 用于展示工单列表，支持筛选、分页和状态展示
 * 
 * @description 
 * - 展示工单列表数据，支持按状态和类型筛选
 * - 提供分页功能，默认每页10条数据
 * - 空状态时显示友好的占位提示
 * 
 * @module components/WorkOrderList
 * @requires antd
 * @requires react
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Space, Button, Select, Input, Card, Typography, Empty, Spin, message } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { WorkOrder, WorkOrderStatus, WorkOrderType, WorkOrderQuery, WorkOrderListQuery, WorkOrderListItem } from '../../types/workorder.types';
import { getWorkOrderList } from '@/api/workorder';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * 工单状态枚举映射
 */
const STATUS_MAP: Partial<Record<WorkOrderStatus, { label: string; color: string }>> = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING: { label: '待审批', color: 'orange' },
  APPROVED: { label: '已通过', color: 'green' },
  REJECTED: { label: '已拒绝', color: 'red' },
  CANCELLED: { label: '已取消', color: 'gray' },
};

/**
 * 工单类型枚举映射
 */
const TYPE_MAP: Partial<Record<WorkOrderType, string>> = {
  IT_SUPPORT: 'IT 支持',
  PURCHASE: '采购申请',
  PERMISSION: '权限申请',
  REPAIR: '维修',
  TRANSFER: '转移',
  DISPOSAL: '处置',
  OTHER: '其他',
};

/**
 * 默认分页配置
 */
const DEFAULT_PAGINATION = {
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
};

/**
 * WorkOrderList Component Props
 */
export interface WorkOrderListProps {
  /** 初始查询参数 */
  initialQuery?: Partial<WorkOrderQuery>;
  /** 是否显示操作列 */
  showActions?: boolean;
  /** 操作列回调 */
  onView?: (workOrder: WorkOrder) => void;
  /** 通过操作回调 */
  onApprove?: (workOrder: WorkOrder) => void;
  /** 拒绝操作回调 */
  onReject?: (workOrder: WorkOrder) => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * WorkOrderList Component
 * 
 * 工单列表组件，支持筛选、分页和操作
 * 
 * @example
 * ```tsx
 * <WorkOrderList
 *   showActions={true}
 *   onView={(wo) => navigate(`/workorder/${wo.id}`)}
 *   onApprove={(wo) => handleApprove(wo.id)}
 *   onReject={(wo) => handleReject(wo.id)}
 * />
 * ```
 */
export const WorkOrderList: React.FC<WorkOrderListProps> = ({
  initialQuery = {},
  showActions = true,
  onView,
  onApprove,
  onReject,
  className = '',
}) => {
  // 状态管理
  const [loading, setLoading] = useState<boolean>(false);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [queryParams, setQueryParams] = useState<WorkOrderQuery>({
    page: 1,
    pageSize: 10,
    ...initialQuery,
  });
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  /**
   * 获取工单列表数据 — 真实 API 调用
   */
  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: WorkOrderListQuery = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        status: queryParams.status,
        type: queryParams.type,
        keyword: searchKeyword || undefined,
      };
      const res = await getWorkOrderList(params);
      const rawItems = res.records ?? [];
      const total = res.total ?? 0;

      // 将 API 响应映射到组件期望的 WorkOrder 格式
      const mappedItems: WorkOrder[] = rawItems.map((item: WorkOrderListItem) => ({
        ...item,
        creatorName: item.reporterName || '',
        updatedAt: item.submittedAt || '',
        description: item.title || '',
      }));

      setWorkOrders(mappedItems);
      setPagination(prev => ({
        ...prev,
        total,
      }));
    } catch (error) {
      message.error('获取工单列表失败');
      console.error('Fetch work orders error:', error);
    } finally {
      setLoading(false);
    }
  }, [queryParams, pagination.current, pagination.pageSize, searchKeyword]);

  // 初始加载和查询参数变化时获取数据
  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  /**
   * 处理表格分页变化
   */
  const handleTableChange = (newPagination: any) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });
  };

  /**
   * 处理状态筛选变化
   */
  const handleStatusChange = (value: WorkOrderStatus | undefined) => {
    setQueryParams(prev => ({ ...prev, status: value, page: 1 }));
  };

  /**
   * 处理类型筛选变化
   */
  const handleTypeChange = (value: WorkOrderType | undefined) => {
    setQueryParams(prev => ({ ...prev, type: value, page: 1 }));
  };

  /**
   * 处理搜索关键词变化（防抖）
   */
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setQueryParams(prev => ({ ...prev, page: 1 }));
  };

  /**
   * 重置筛选条件
   */
  const handleReset = () => {
    setQueryParams({ page: 1, pageSize: 10 });
    setSearchKeyword('');
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  /**
   * 表格列配置
   */
  const columns: ColumnsType<WorkOrder> = [
    {
      title: '工单编号',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      fixed: 'left',
      render: (id: string) => (
        <Text strong copyable={{ text: id }}>
          {id}
        </Text>
      ),
    },
    {
      title: '工单标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string) => (
        <Text ellipsis={{ tooltip: title }}>
          {title}
        </Text>
      ),
    },
    {
      title: '工单类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: WorkOrderType) => TYPE_MAP[type] || type,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: WorkOrderStatus) => {
        const config = STATUS_MAP[status] || { label: status, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
      filters: Object.entries(STATUS_MAP).map(([value, { label }]) => ({ text: label, value })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: '创建人',
      dataIndex: 'creatorName',
      key: 'creatorName',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    ...(showActions
      ? [
          {
            title: '操作',
            key: 'actions',
            width: 200,
            fixed: 'right',
            render: (_: any, record: WorkOrder) => (
              <Space size="small">
                <Button
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => onView?.(record)}
                >
                  查看
                </Button>
                {record.status === 'PENDING' && (
                  <>
                    <Button
                      type="link"
                      icon={<CheckOutlined />}
                      onClick={() => onApprove?.(record)}
                      className="text-green-600"
                    >
                      通过
                    </Button>
                    <Button
                      type="link"
                      icon={<CloseOutlined />}
                      onClick={() => onReject?.(record)}
                      className="text-red-600"
                    >
                      拒绝
                    </Button>
                  </>
                )}
              </Space>
            ),
          } as ColumnsType<WorkOrder>[number],
        ]
      : []),
  ];

  return (
    <Card className={`work-order-list ${className}`} styles={{ body: { padding: '16px' } }}>
      {/* 筛选工具栏 */}
      <div className="mb-4">
        <Space wrap align="center" className="w-full justify-between">
          <Space wrap>
            <Input
              placeholder="搜索工单标题或描述"
              prefix={<SearchOutlined />}
              allowClear
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: 240 }}
            />
            <Select
              placeholder="工单状态"
              allowClear
              onChange={handleStatusChange}
              style={{ width: 120 }}
              value={queryParams.status}
            >
              {Object.entries(STATUS_MAP).map(([value, { label }]) => (
                <Option key={value} value={value}>
                  {label}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="工单类型"
              allowClear
              onChange={handleTypeChange}
              style={{ width: 120 }}
              value={queryParams.type}
            >
              {Object.entries(TYPE_MAP).map(([value, label]) => (
                <Option key={value} value={value}>
                  {label}
                </Option>
              ))}
            </Select>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </Space>
      </div>

      {/* 数据表格 */}
      <Table<WorkOrder>
        columns={columns}
        dataSource={workOrders}
        rowKey="id"
        loading={{
          indicator: <Spin />,
          spinning: loading,
        }}
        pagination={pagination}
        onChange={handleTableChange}
        scroll={{ x: 1000 }}
        locale={{
          emptyText: loading ? <Spin size="large" /> : <Empty description="暂无数据" />,
        }}
      />
    </Card>
  );
};

export default WorkOrderList;
