import React, { useEffect, useState } from 'react';
import { 
  Table, Tag, Button, Space, Modal, Form, Input, Select, 
  message, Timeline, Card, Badge, Typography, Dropdown, 
  Tooltip, Empty, Spin, Alert 
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { 
  PlusOutlined, EyeOutlined, CheckOutlined, 
  CloseOutlined, SwapOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, UserOutlined, HistoryOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { workOrderApi } from '../../api/workOrderApi';
import type { WorkOrder, WorkOrderStatus, ApprovalHistory, ApprovalAction } from '../../types/workOrder';
import { StatusBadge } from '../components/StatusBadge';
import { ApprovalActions } from '../components/ApprovalActions';
import { HistoryTimeline } from '../components/HistoryTimeline';
import styles from './WorkOrderListPage.module.css';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface WorkOrderListPageProps {
  /** Current user ID for permission checking */
  currentUserId: string;
  /** Current user role */
  currentUserRole: 'ADMIN' | 'APPROVER' | 'USER';
  /** Initial filter status */
  initialStatus?: WorkOrderStatus;
}

/**
 * WorkOrderListPage - 工单列表页面组件
 * 
 * 提供工单列表展示、状态筛选、审批操作等功能
 * 支持工单提交、查看审批历史、执行审批操作
 * 
 * @description Iteration 1 - 工单审批流程核心页面
 * @author SWARM Team
 * @version 1.0.0
 */
export const WorkOrderListPage: React.FC<WorkOrderListPageProps> = ({
  currentUserId,
  currentUserRole,
  initialStatus
}) => {
  // 状态管理
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filterStatus, setFilterStatus] = useState<WorkOrderStatus | 'ALL'>(initialStatus || 'ALL');
  
  // 模态框状态
  const [submitModalVisible, setSubmitModalVisible] = useState<boolean>(false);
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [historyModalVisible, setHistoryModalVisible] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  // 当前选中的工单
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<ApprovalHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  
  // 表单引用
  const [submitForm] = Form.useForm();
  const [approvalForm] = Form.useForm();

  /**
   * 加载工单列表数据
   * 
   * @description 根据当前筛选条件加载工单列表
   * @param page - 页码
   * @param pageSize - 每页条数
   */
  const fetchWorkOrders = async (page: number = 1, pageSize: number = 10) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, pageSize };
      if (filterStatus !== 'ALL') {
        params.status = filterStatus;
      }
      
      const response = await workOrderApi.list(params);
      setWorkOrders(response.items || []);
      setPagination({
        current: response.currentPage || page,
        pageSize: response.pageSize || pageSize,
        total: response.total || 0
      });
    } catch (error) {
      message.error('加载工单列表失败');
      console.error('Failed to fetch work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载审批历史记录
   * 
   * @description 获取指定工单的完整审批历史
   * @param workOrderId - 工单ID
   */
  const fetchApprovalHistory = async (workOrderId: string) => {
    setHistoryLoading(true);
    try {
      const history = await workOrderApi.getHistory(workOrderId);
      setSelectedHistory(history);
    } catch (error) {
      message.error('加载审批历史失败');
      console.error('Failed to fetch approval history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchWorkOrders();
  }, [filterStatus]);

  /**
   * 提交新工单
   * 
   * @description 用户填写工单表单并提交审批请求
   */
  const handleSubmitWorkOrder = async (values: any) => {
    setSubmitting(true);
    try {
      const payload = {
        title: values.title,
        description: values.description,
        priority: values.priority || 'NORMAL',
        category: values.category
      };
      
      await workOrderApi.submit(payload);
      message.success('工单提交成功');
      setSubmitModalVisible(false);
      submitForm.resetFields();
      fetchWorkOrders();
    } catch (error) {
      message.error('工单提交失败');
      console.error('Failed to submit work order:', error);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 执行审批操作
   * 
   * @description 审批人对工单执行通过/拒绝/转交操作
   * @param workOrderId - 工单ID
   * @param action - 审批动作
   * @param values - 表单数据
   */
  const handleApprovalAction = async (
    workOrderId: string, 
    action: ApprovalAction, 
    values: any
  ) => {
    try {
      const payload: Record<string, any> = {
        comment: values.comment || ''
      };
      
      let response;
      switch (action) {
        case 'APPROVE':
          response = await workOrderApi.approve(workOrderId, payload);
          message.success('工单已通过');
          break;
        case 'REJECT':
          response = await workOrderApi.reject(workOrderId, payload);
          message.success('工单已拒绝');
          break;
        case 'TRANSFER':
          payload.toUserId = values.toUserId;
          response = await workOrderApi.transfer(workOrderId, payload);
          message.success('工单已转交');
          break;
      }
      
      setDetailModalVisible(false);
      fetchWorkOrders();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || '审批操作失败';
      message.error(errorMsg);
      console.error('Approval action failed:', error);
    }
  };

  /**
   * 查看工单详情
   * 
   * @description 打开工单详情模态框
   * @param workOrder - 工单对象
   */
  const handleViewDetail = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
    setDetailModalVisible(true);
    approvalForm.setFieldsValue({ comment: '' });
  };

  /**
   * 查看审批历史
   * 
   * @description 打开审批历史模态框
   * @param workOrder - 工单对象
   */
  const handleViewHistory = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
    setHistoryModalVisible(true);
    fetchApprovalHistory(workOrder.id);
  };

  /**
   * 检查用户是否有审批权限
   * 
   * @description 根据当前用户和工单状态判断权限
   * @param workOrder - 工单对象
   * @returns 是否有审批权限
   */
  const canApprove = (workOrder: WorkOrder): boolean => {
    if (currentUserRole === 'ADMIN' || currentUserRole === 'APPROVER') {
      return workOrder.status === 'PENDING' && 
             workOrder.approverId === currentUserId;
    }
    return false;
  };

  /**
   * 检查用户是否可以提交工单
   * 
   * @description 所有登录用户都可以提交工单
   * @returns 是否有提交权限
   */
  const canSubmit = (): boolean => {
    return ['ADMIN', 'APPROVER', 'USER'].includes(currentUserRole);
  };

  /**
   * 渲染状态标签
   * 
   * @description 根据状态值渲染对应的Ant Design Tag
   * @param status - 工单状态
   * @returns React节点
   */
  const renderStatusTag = (status: WorkOrderStatus): React.ReactNode => {
    return <StatusBadge status={status} />;
  };

  /**
   * 渲染优先级标签
   * 
   * @description 根据优先级渲染不同颜色的标签
   * @param priority - 优先级
   * @returns React节点
   */
  const renderPriorityTag = (priority: string): React.ReactNode => {
    const colorMap: Record<string, string> = {
      LOW: 'green',
      NORMAL: 'blue',
      HIGH: 'orange',
      URGENT: 'red'
    };
    return (
      <Tag color={colorMap[priority] || 'default'}>
        {priority === 'LOW' ? '低' : 
         priority === 'NORMAL' ? '普通' : 
         priority === 'HIGH' ? '高' : '紧急'}
      </Tag>
    );
  };

  // 表格列定义
  const columns: ColumnsType<WorkOrder> = [
    {
      title: '工单编号',
      dataIndex: 'workOrderNo',
      key: 'workOrderNo',
      width: 150,
      fixed: 'left',
      render: (text: string) => (
        <Text strong className={styles.workOrderNo}>{text}</Text>
      )
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
      render: (text: string, record: WorkOrder) => (
        <Tooltip title={text}>
          <span className={styles.titleCell}>{text}</span>
        </Tooltip>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filters: [
        { text: '待审批', value: 'PENDING' },
        { text: '已通过', value: 'APPROVED' },
        { text: '已拒绝', value: 'REJECTED' },
        { text: '已转交', value: 'TRANSFERRED' }
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: WorkOrderStatus) => renderStatusTag(status)
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => renderPriorityTag(priority)
    },
    {
      title: '申请人',
      dataIndex: 'applicantName',
      key: 'applicantName',
      width: 120,
      render: (name: string) => (
        <Space>
          <UserOutlined />
          <span>{name}</span>
        </Space>
      )
    },
    {
      title: '审批人',
      dataIndex: 'approverName',
      key: 'approverName',
      width: 120,
      render: (name: string, record: WorkOrder) => 
        name ? (
          <Space>
            <UserOutlined />
            <span>{name}</span>
          </Space>
        ) : (
          <Text type="secondary">待分配</Text>
        )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      defaultSortOrder: 'descend',
      render: (date: string) => (
        <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
          <span>{dayjs(date).fromNow()}</span>
        </Tooltip>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record: WorkOrder) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button 
            type="link" 
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            历史
          </Button>
          {canApprove(record) && (
            <Dropdown menu={{
              items: [
                {
                  key: 'approve',
                  icon: <CheckOutlined />,
                  label: '通过',
                  onClick: () => {
                    approvalForm.setFieldsValue({ action: 'APPROVE' });
                    handleApprovalAction(record.id, 'APPROVE', { comment: '' });
                  }
                },
                {
                  key: 'reject',
                  icon: <CloseOutlined />,
                  label: '拒绝',
                  onClick: () => {
                    Modal.confirm({
                      title: '确认拒绝',
                      content: '确定要拒绝此工单吗？',
                      onOk: () => {
                        approvalForm.setFieldsValue({ action: 'REJECT' });
                        handleApprovalAction(record.id, 'REJECT', { comment: '' });
                      }
                    });
                  }
                },
                {
                  key: 'transfer',
                  icon: <SwapOutlined />,
                  label: '转交',
                  onClick: () => {
                    Modal.confirm({
                      title: '转交审批',
                      content: '请选择接收人',
                      icon: <ExclamationCircleOutlined />,
                    });
                  }
                }
              ]
            }}>
              <Button type="link" size="small">
                审批
              </Button>
            </Dropdown>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className={styles.container}>
      {/* 页面标题区 */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <Title level={4} className={styles.pageTitle}>工单管理</Title>
          <Text type="secondary">工单审批流程管理</Text>
        </div>
        {canSubmit() && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setSubmitModalVisible(true)}
          >
            提交工单
          </Button>
        )}
      </div>

      {/* 状态筛选区 */}
      <Card size="small" className={styles.filterCard}>
        <Space>
          <Text>状态筛选：</Text>
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'TRANSFERRED'] as const).map(status => (
            <Badge 
              key={status}
              count={status === 'ALL' ? pagination.total : 
                workOrders.filter(w => w.status === status).length}
              showZero
            >
              <Tag 
                className={styles.filterTag}
                color={filterStatus === status ? 'blue' : 'default'}
                onClick={() => setFilterStatus(status)}
                style={{ cursor: 'pointer' }}
              >
                {status === 'ALL' ? '全部' : 
                 status === 'PENDING' ? '待审批' :
                 status === 'APPROVED' ? '已通过' :
                 status === 'REJECTED' ? '已拒绝' : '已转交'}
              </Tag>
            </Badge>
          ))}
        </Space>
      </Card>

      {/* 工单列表 */}
      <Card className={styles.tableCard}>
        <Table
          columns={columns}
          dataSource={workOrders}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => fetchWorkOrders(page, pageSize)
          }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无工单数据"
              />
            )
          }}
        />
      </Card>

      {/* 提交工单模态框 */}
      <Modal
        title="提交工单"
        open={submitModalVisible}
        onCancel={() => {
          setSubmitModalVisible(false);
          submitForm.resetFields();
        }}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form
          form={submitForm}
          layout="vertical"
          onFinish={handleSubmitWorkOrder}
          initialValues={{ priority: 'NORMAL' }}
        >
          <Form.Item
            name="title"
            label="工单标题"
            rules={[
              { required: true, message: '请输入工单标题' },
              { max: 100, message: '标题不能超过100个字符' }
            ]}
          >
            <Input placeholder="请输入工单标题" maxLength={100} showCount />
          </Form.Item>

          <Form.Item
            name="category"
            label="工单类别"
            rules={[{ required: true, message: '请选择工单类别' }]}
          >
            <Select placeholder="请选择工单类别">
              <Option value="ASSET_PURCHASE">资产采购</Option>
              <Option value="ASSET_TRANSFER">资产调拨</Option>
              <Option value="ASSET_DISPOSAL">资产报废</Option>
              <Option value="MAINTENANCE">维修保养</Option>
              <Option value="COMPENSATION">赔偿处理</Option>
              <Option value="OTHER">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="priority"
            label="优先级"
          >
            <Select>
              <Option value="LOW">低</Option>
              <Option value="NORMAL">普通</Option>
              <Option value="HIGH">高</Option>
              <Option value="URGENT">紧急</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="工单描述"
            rules={[
              { required: true, message: '请输入工单描述' },
              { max: 2000, message: '描述不能超过2000个字符' }
            ]}
          >
            <TextArea 
              rows={6} 
              placeholder="请详细描述工单内容..."
              maxLength={2000}
              showCount
            />
          </Form.Item>

          <Form.Item className={styles.formFooter}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setSubmitModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                提交审批
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 工单详情模态框 */}
      <Modal
        title={`工单详情 - ${selectedWorkOrder?.workOrderNo || ''}`}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedWorkOrder(null);
          approvalForm.resetFields();
        }}
        footer={null}
        width={700}
        destroyOnClose
      >
        {selectedWorkOrder && (
          <div className={styles.detailContent}>
            <Card size="small" className={styles.detailCard}>
              <Form
                form={approvalForm}
                layout="vertical"
              >
                <div className={styles.detailHeader}>
                  <Title level={5}>{selectedWorkOrder.title}</Title>
                  {renderStatusTag(selectedWorkOrder.status)}
                </div>

                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <Text type="secondary">工单编号</Text>
                    <div>{selectedWorkOrder.workOrderNo}</div>
                  </div>
                  <div className={styles.detailItem}>
                    <Text type="secondary">工单类别</Text>
                    <div>{selectedWorkOrder.category}</div>
                  </div>
                  <div className={styles.detailItem}>
                    <Text type="secondary">优先级</Text>
                    <div>{renderPriorityTag(selectedWorkOrder.priority)}</div>
                  </div>
                  <div className={styles.detailItem}>
                    <Text type="secondary">申请人</Text>
                    <div>{selectedWorkOrder.applicantName}</div>
                  </div>
                  <div className={styles.detailItem}>
                    <Text type="secondary">审批人</Text>
                    <div>{selectedWorkOrder.approverName || '待分配'}</div>
                  </div>
                  <div className={styles.detailItem}>
                    <Text type="secondary">创建时间</Text>
                    <div>{dayjs(selectedWorkOrder.createdAt).format('YYYY-MM-DD HH:mm')}</div>
                  </div>
                </div>

                <div className={styles.descriptionSection}>
                  <Text type="secondary">工单描述</Text>
                  <div className={styles.descriptionContent}>
                    {selectedWorkOrder.description}
                  </div>
                </div>
              </Form>
            </Card>

            {/* 审批操作区 */}
            {canApprove(selectedWorkOrder) && (
              <Card size="small" className={styles.approvalCard}>
                <Title level={5}>审批操作</Title>
                <ApprovalActions
                  workOrderId={selectedWorkOrder.id}
                  onApprove={(comment) => handleApprovalAction(selectedWorkOrder.id, 'APPROVE', { comment })}
                  onReject={(comment) => handleApprovalAction(selectedWorkOrder.id, 'REJECT', { comment })}
                  onTransfer={(toUserId, comment) => handleApprovalAction(selectedWorkOrder.id, 'TRANSFER', { toUserId, comment })}
                />
              </Card>
            )}
          </div>
        )}
      </Modal>

      {/* 审批历史模态框 */}
      <Modal
        title={`审批历史 - ${selectedWorkOrder?.workOrderNo || ''}`}
        open={historyModalVisible}
        onCancel={() => {
          setHistoryModalVisible(false);
          setSelectedWorkOrder(null);
          setSelectedHistory([]);
        }}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Spin spinning={historyLoading}>
          {selectedHistory.length > 0 ? (
            <HistoryTimeline history={selectedHistory} />
          ) : (
            <Empty description="暂无审批历史记录" />
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default WorkOrderListPage;