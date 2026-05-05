/**
 * WorkOrderListPage - 工单列表页面
 * 
 * 功能描述：
 * - 展示所有工单列表
 * - 支持状态、类型筛选
 * - 支持分页浏览
 * - 支持关键词搜索
 * - 展示审批操作入口
 * 
 * @description 工单审批流程前端页面 - Iteration 1
 * @see Phase 1: 基础工单管理 (P1.2, P1.5)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Card,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Typography,
  Badge,
  Tooltip,
  Spin,
  Empty,
  message,
  Modal,
  Form,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { workOrderApi, WorkOrder, WorkOrderQuery } from '../api/workOrderApi';
import { useWorkOrderStore } from '../stores/workOrderStore';

const { Title } = Typography;
const { Option } = Select;

// 工单状态枚举与配置
const WORK_ORDER_STATUS = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING: { label: '待审批', color: 'processing' },
  APPROVED: { label: '已通过', color: 'success' },
  REJECTED: { label: '已拒绝', color: 'error' },
  CLOSED: { label: '已关闭', color: 'default' },
} as const;

// 工单类型枚举与配置
const WORK_ORDER_TYPE = {
  IT_SUPPORT: { label: 'IT 支持', color: 'blue' },
  PURCHASE: { label: '采购申请', color: 'purple' },
  PERMISSION: { label: '权限申请', color: 'cyan' },
} as const;

type WorkOrderStatus = keyof typeof WORK_ORDER_STATUS;
type WorkOrderType = keyof typeof WORK_ORDER_TYPE;

/**
 * 格式化工单状态显示
 * @param status - 工单状态
 * @returns 状态标签组件
 */
const formatStatus = (status: WorkOrderStatus): React.ReactNode => {
  const config = WORK_ORDER_STATUS[status] || WORK_ORDER_STATUS.DRAFT;
  return <Badge status={config.color as any} text={config.label} />;
};

/**
 * 格式化工单类型显示
 * @param type - 工单类型
 * @returns 类型标签组件
 */
const formatType = (type: WorkOrderType): React.ReactNode => {
  const config = WORK_ORDER_TYPE[type] || WORK_ORDER_TYPE.IT_SUPPORT;
  return <Tag color={config.color}>{config.label}</Tag>;
};

/**
 * WorkOrderListPage 组件
 * 
 * 工单列表页面主组件，提供工单列表展示、筛选、搜索等功能
 */
const WorkOrderListPage: React.FC = () => {
  const navigate = useNavigate();
  const { workOrders, total, loading, setLoading, setWorkOrders, setTotal } = useWorkOrderStore();

  // 表单实例
  const [form] = Form.useForm();

  // 状态管理
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<WorkOrderStatus | undefined>();
  const [filterType, setFilterType] = useState<WorkOrderType | undefined>();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });

  // 审批弹窗状态
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [currentWorkOrder, setCurrentWorkOrder] = useState<WorkOrder | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalComment, setApprovalComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * 获取工单列表数据
   */
  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams: WorkOrderQuery = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword: searchKeyword || undefined,
        status: filterStatus,
        type: filterType,
      };

      const response = await workOrderApi.getWorkOrders(queryParams);
      
      if (response.success && response.data) {
        setWorkOrders(response.data.items);
        setTotal(response.data.total);
      } else {
        message.error(response.message || '获取工单列表失败');
      }
    } catch (error) {
      console.error('获取工单列表失败:', error);
      message.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, searchKeyword, filterStatus, filterType, setLoading, setWorkOrders, setTotal]);

  // 初始加载
  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  /**
   * 刷新列表
   */
  const handleRefresh = () => {
    fetchWorkOrders();
    message.success('列表已刷新');
  };

  /**
   * 搜索处理
   */
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  /**
   * 筛选状态变化处理
   */
  const handleStatusFilterChange = (value: WorkOrderStatus | undefined) => {
    setFilterStatus(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  /**
   * 筛选类型变化处理
   */
  const handleTypeFilterChange = (value: WorkOrderType | undefined) => {
    setFilterType(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  /**
   * 分页变化处理
   */
  const handleTableChange = (paginationConfig: any) => {
    setPagination({
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
    });
  };

  /**
   * 查看工单详情
   */
  const handleViewDetail = (record: WorkOrder) => {
    navigate(`/workorder/${record.id}`);
  };

  /**
   * 打开审批弹窗
   */
  const handleOpenApproval = (record: WorkOrder, action: 'approve' | 'reject') => {
    setCurrentWorkOrder(record);
    setApprovalAction(action);
    setApprovalComment('');
    setApprovalModalVisible(true);
  };

  /**
   * 提交审批
   */
  const handleSubmitApproval = async () => {
    if (!currentWorkOrder) return;

    if (approvalAction === 'reject' && !approvalComment.trim()) {
      message.error('请输入拒绝原因');
      return;
    }

    setSubmitting(true);
    try {
      const apiCall = approvalAction === 'approve'
        ? workOrderApi.approveWorkOrder(currentWorkOrder.id, approvalComment)
        : workOrderApi.rejectWorkOrder(currentWorkOrder.id, approvalComment);

      const response = await apiCall;

      if (response.success) {
        message.success(approvalAction === 'approve' ? '工单已通过审批' : '工单已拒绝');
        setApprovalModalVisible(false);
        fetchWorkOrders();
      } else {
        message.error(response.message || '审批操作失败');
      }
    } catch (error) {
      console.error('审批操作失败:', error);
      message.error('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 关闭审批弹窗
   */
  const handleCloseApprovalModal = () => {
    setApprovalModalVisible(false);
    setCurrentWorkOrder(null);
    setApprovalComment('');
  };

  /**
   * 表格列配置
   */
  const columns: ColumnsType<WorkOrder> = [
    {
      title: '工单标题',
      dataIndex: 'title',
      key: 'title',
      width: 280,
      ellipsis: true,
      render: (text: string, record: WorkOrder) => (
        <Tooltip title={text}>
          <a onClick={() => handleViewDetail(record)}>{text}</a>
        </Tooltip>
      ),
    },
    {
      title: '工单类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: WorkOrderType) => formatType(type),
    },
    {
      title: '工单状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: WorkOrderStatus) => formatStatus(status),
    },
    {
      title: '申请人',
      dataIndex: 'creatorName',
      key: 'creatorName',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      sorter: (a: WorkOrder, b: WorkOrder) => 
        dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_: any, record: WorkOrder) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          {record.status === 'PENDING' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleOpenApproval(record, 'approve')}
              >
                通过
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleOpenApproval(record, 'reject')}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        {/* 页面标题 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 0 }}>工单列表</Title>
        </div>

        {/* 筛选区域 */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap size="middle">
            <Input.Search
              placeholder="搜索工单标题或描述"
              allowClear
              enterButton={<Button type="primary" icon={<SearchOutlined />}>搜索</Button>}
              onSearch={handleSearch}
              style={{ width: 300 }}
            />
            
            <Select
              placeholder="工单状态"
              allowClear
              style={{ width: 140 }}
              value={filterStatus}
              onChange={handleStatusFilterChange}
              suffixIcon={<FilterOutlined />}
            >
              {Object.entries(WORK_ORDER_STATUS).map(([key, config]) => (
                <Option key={key} value={key}>{config.label}</Option>
              ))}
            </Select>

            <Select
              placeholder="工单类型"
              allowClear
              style={{ width: 140 }}
              value={filterType}
              onChange={handleTypeFilterChange}
              suffixIcon={<FilterOutlined />}
            >
              {Object.entries(WORK_ORDER_TYPE).map(([key, config]) => (
                <Option key={key} value={key}>{config.label}</Option>
              ))}
            </Select>

            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
            >
              刷新
            </Button>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/workorder/submit')}
            >
              新建工单
            </Button>
          </Space>
        </div>

        {/* 表格区域 */}
        <Table
          columns={columns}
          dataSource={workOrders}
          rowKey="id"
          loading={{
            spinning: loading,
            indicator: <Spin size="large" />,
          }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total: number) => `共 ${total} 条记录`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无工单数据"
              />
            ),
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 审批操作弹窗 */}
      <Modal
        title={approvalAction === 'approve' ? '审批通过' : '审批拒绝'}
        open={approvalModalVisible}
        onOk={handleSubmitApproval}
        onCancel={handleCloseApprovalModal}
        okText={approvalAction === 'approve' ? '确认通过' : '确认拒绝'}
        cancelText="取消"
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="工单标题">
            <Input value={currentWorkOrder?.title} disabled />
          </Form.Item>
          
          <Form.Item 
            label={approvalAction === 'approve' ? '审批意见' : '拒绝原因'}
            required={approvalAction === 'reject'}
          >
            <Input.TextArea
              rows={4}
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              placeholder={
                approvalAction === 'approve'
                  ? '请输入审批意见（可选）'
                  : '请输入拒绝原因（必填）'
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkOrderListPage;