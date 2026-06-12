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
import { WorkOrderPriority, WorkOrderStatus, WorkOrderType } from '../../types/workorder.types';
import type { WorkOrder, WorkOrderListQuery } from '../../types/workorder.types';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * 工单状态枚举映射
 */
const STATUS_MAP: Record<WorkOrderStatus, { label: string; color: string }> = {
  [WorkOrderStatus.DRAFT]: { label: '草稿', color: 'default' },
  [WorkOrderStatus.PENDING]: { label: '待进入审批', color: 'blue' },
  [WorkOrderStatus.APPROVING_LEVEL_1]: { label: '一级审批中', color: 'orange' },
  [WorkOrderStatus.APPROVING_LEVEL_2]: { label: '二级审批中', color: 'gold' },
  [WorkOrderStatus.APPROVED]: { label: '已通过', color: 'green' },
  [WorkOrderStatus.REJECTED]: { label: '已拒绝', color: 'red' },
  [WorkOrderStatus.CANCELLED]: { label: '已取消', color: 'gray' },
};

/**
 * 工单类型枚举映射
 */
const TYPE_MAP: Record<WorkOrderType, string> = {
  [WorkOrderType.PURCHASE]: '采购申请',
  [WorkOrderType.REPAIR]: '维修申请',
  [WorkOrderType.TRANSFER]: '调拨申请',
  [WorkOrderType.DISPOSAL]: '处置申请',
  [WorkOrderType.OTHER]: '其他申请',
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
  initialQuery?: Partial<WorkOrderListQuery>;
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
  const [queryParams, setQueryParams] = useState<WorkOrderListQuery>({
    page: 1,
    pageSize: 10,
    ...initialQuery,
  });
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  /**
   * 模拟获取工单列表数据
   * @description 实际项目中应替换为真实 API 调用
   */
  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      // 模拟网络延迟 200-500ms
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      
      // Mock 数据生成
      const mockData: WorkOrder[] = generateMockData(pagination.total || 50);
      
      // 应用筛选条件
      let filteredData = mockData;
      
      if (queryParams.status) {
        const statusFilter = Array.isArray(queryParams.status) ? queryParams.status : [queryParams.status];
        filteredData = filteredData.filter(wo => statusFilter.includes(wo.status));
      }
      
      if (queryParams.type) {
        filteredData = filteredData.filter(wo => wo.type === queryParams.type);
      }
      
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase();
        filteredData = filteredData.filter(wo => 
          wo.orderNo.toLowerCase().includes(keyword) ||
          wo.title.toLowerCase().includes(keyword) ||
          wo.description.toLowerCase().includes(keyword)
        );
      }

      // 分页计算
      const startIndex = (pagination.current - 1) * pagination.pageSize;
      const endIndex = startIndex + pagination.pageSize;
      const paginatedData = filteredData.slice(startIndex, endIndex);

      setWorkOrders(paginatedData);
      setPagination(prev => ({
        ...prev,
        total: filteredData.length,
      }));
    } catch (error) {
      message.error('获取工单列表失败');
      console.error('Fetch work orders error:', error);
    } finally {
      setLoading(false);
    }
  }, [queryParams, pagination.current, pagination.pageSize, searchKeyword]);

  /**
   * 生成 Mock 数据
   * @param count - 数据条数
   */
  const generateMockData = (count: number): WorkOrder[] => {
    const statuses: WorkOrderStatus[] = [
      WorkOrderStatus.DRAFT,
      WorkOrderStatus.PENDING,
      WorkOrderStatus.APPROVING_LEVEL_1,
      WorkOrderStatus.APPROVING_LEVEL_2,
      WorkOrderStatus.APPROVED,
      WorkOrderStatus.REJECTED,
      WorkOrderStatus.CANCELLED,
    ];
    const types: WorkOrderType[] = [
      WorkOrderType.PURCHASE,
      WorkOrderType.REPAIR,
      WorkOrderType.TRANSFER,
      WorkOrderType.DISPOSAL,
      WorkOrderType.OTHER,
    ];
    
    const titles: Record<WorkOrderType, string[]> = {
      [WorkOrderType.PURCHASE]: ['办公桌椅采购', '显示器采购', '键鼠套装采购', '笔记本电脑采购', '服务器采购'],
      [WorkOrderType.REPAIR]: ['空调维修申请', '投影仪维修', '门禁设备维修', '会议屏检修', '打印机维修'],
      [WorkOrderType.TRANSFER]: ['电脑调拨申请', '会议设备调拨', '办公家具调拨', '网络设备调拨', '车辆调拨'],
      [WorkOrderType.DISPOSAL]: ['旧电脑处置', '报废显示器处置', '闲置资产处置', '损坏设备处置', '批量资产处置'],
      [WorkOrderType.OTHER]: ['资产标签补打', '资料补录申请', '盘点异常处理', '配置调整申请', '其他工单事项'],
    };

    return Array.from({ length: count }, (_, index) => {
      const type = types[index % types.length];
      const status = statuses[index % statuses.length];
      const titleOptions = titles[type];
      const createdAt = new Date(Date.now() - index * 86400000).toISOString();
      const updatedAt = new Date(Date.now() - index * 43200000).toISOString();
      
      return {
        id: index + 1,
        orderNo: `WO-${String(index + 1).padStart(6, '0')}`,
        title: titleOptions[index % titleOptions.length],
        type,
        description: `这是第 ${index + 1} 条工单的详细描述信息，描述了用户提交的具体需求内容。`,
        priority: WorkOrderPriority.MEDIUM,
        status,
        version: 1,
        applicantId: (index % 5) + 1,
        applicantName: ['张三', '李四', '王五', '赵六', '钱七'][index % 5],
        departmentId: (index % 3) + 1,
        departmentName: ['行政部', '财务部', '信息部'][index % 3],
        currentApprovalLevel: null,
        rejectionReason: status === WorkOrderStatus.REJECTED ? '审批意见未通过' : null,
        assetIds: [],
        attachments: [],
        createdAt,
        updatedAt,
        submittedAt: status === WorkOrderStatus.DRAFT ? null : createdAt,
        completedAt: status === WorkOrderStatus.APPROVED ? updatedAt : null,
      };
    });
  };

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
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 120,
      fixed: 'left',
      render: (orderNo: string) => (
        <Text strong copyable={{ text: orderNo }}>
          {orderNo}
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
      dataIndex: 'applicantName',
      key: 'applicantName',
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
                {record.status === WorkOrderStatus.PENDING && (
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
