import { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Button, 
  Card, 
  Tag, 
  Modal, 
  Space, 
  Typography, 
  message,
  Form,
  Input,
  Select,
  Timeline,
  Empty,
  Spin
} from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  HistoryOutlined,
  SendOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { workOrderApi, type WorkOrder, type WorkOrderStatus } from '../api/workorder';
import type { ApprovalHistory } from '../types/approval';

/**
 * WorkOrderListPage Component
 * 
 * 工单列表页面 - 工单审批流程核心页面
 * 
 * 功能说明:
 * - 展示工单列表，支持状态筛选
 * - 支持提交审批、通过、拒绝等操作
 * - 查看审批历史记录
 * 
 * 状态流转:
 * - DRAFT (草稿) -> PENDING (待审批) [提交审批]
 * - PENDING (待审批) -> APPROVED (已通过) [通过]
 * - PENDING (待审批) -> REJECTED (已拒绝) [拒绝]
 * - REJECTED (已拒绝) -> PENDING (待审批) [重新提交]
 * 
 * @since Iteration 1 (SWARM-001)
 */
const { Title } = Typography;
const { TextArea } = Input;

/** 状态配置映射 */
const STATUS_CONFIG: Record<WorkOrderStatus, { color: string; label: string; icon: React.ReactNode }> = {
  DRAFT: { color: 'default', label: '草稿', icon: <FileTextOutlined /> },
  PENDING: { color: 'processing', label: '待审批', icon: <ClockCircleOutlined /> },
  APPROVED: { color: 'success', label: '已通过', icon: <CheckCircleOutlined /> },
  REJECTED: { color: 'error', label: '已拒绝', icon: <CloseCircleOutlined /> },
};

/** 状态选项列表 */
const STATUS_OPTIONS = [
  { value: 'ALL', label: '全部状态' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'PENDING', label: '待审批' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已拒绝' },
];

/**
 * 操作类型映射
 * 
 * @param action - 操作类型
 * @returns 操作显示配置
 */
const getActionConfig = (action: string): { color: string; label: string } => {
  const configMap: Record<string, { color: string; label: string }> = {
    CREATE: { color: 'default', label: '创建工单' },
    SUBMIT: { color: 'blue', label: '提交审批' },
    APPROVE: { color: 'green', label: '审批通过' },
    REJECT: { color: 'red', label: '审批拒绝' },
    CANCEL: { color: 'orange', label: '取消工单' },
  };
  return configMap[action] || { color: 'gray', label: action };
};

/**
 * WorkOrderListPage Component
 * 
 * 工单列表页面主组件
 * 提供工单列表展示、状态筛选、审批操作和历史查看功能
 */
export function WorkOrderListPage() {
  // 状态管理
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  
  // 弹窗状态
  const [approvalModalVisible, setApprovalModalVisible] = useState<boolean>(false);
  const [historyModalVisible, setHistoryModalVisible] = useState<boolean>(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [approvalComment, setApprovalComment] = useState<string>('');
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);
  
  const [form] = Form.useForm();

  /**
   * 加载工单列表数据
   * 
   * @description 从API获取工单列表，支持状态筛选和分页
   */
  const loadWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page: pagination.current,
        pageSize: pagination.pageSize,
      };
      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }
      const response = await workOrderApi.list(params);
      setWorkOrders(response.items || []);
      setPagination(prev => ({
        ...prev,
        total: response.total || 0,
      }));
    } catch (error) {
      message.error('加载工单列表失败');
      console.error('Failed to load work orders:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, selectedStatus]);

  /**
   * 加载审批历史记录
   * 
   * @param workOrderId - 工单ID
   * @description 获取指定工单的完整审批历史
   */
  const loadApprovalHistory = useCallback(async (workOrderId: string) => {
    setModalLoading(true);
    try {
      const history = await workOrderApi.getHistory(workOrderId);
      setApprovalHistory(history);
    } catch (error) {
      message.error('加载审批历史失败');
      console.error('Failed to load approval history:', error);
    } finally {
      setModalLoading(false);
    }
  }, []);

  /**
   * 提交工单审批
   * 
   * @param workOrder - 工单对象
   * @description 将草稿状态工单提交为待审批状态
   */
  const handleSubmitForApproval = useCallback(async (workOrder: WorkOrder) => {
    try {
      await workOrderApi.submit(workOrder.id);
      message.success('工单已提交审批');
      loadWorkOrders();
    } catch (error) {
      message.error('提交审批失败');
      console.error('Failed to submit for approval:', error);
    }
  }, [loadWorkOrders]);

  /**
   * 打开审批弹窗
   * 
   * @param workOrder - 工单对象
   * @param action - 审批动作 (approve/reject)
   * @description 打开审批操作弹窗
   */
  const openApprovalModal = useCallback((workOrder: WorkOrder, action: 'approve' | 'reject') => {
    setSelectedWorkOrder(workOrder);
    setApprovalAction(action);
    setApprovalComment('');
    setApprovalModalVisible(true);
  }, []);

  /**
   * 执行审批操作
   * 
   * @description 调用后端API执行审批通过或拒绝
   */
  const handleApproval = useCallback(async () => {
    if (!selectedWorkOrder || !approvalAction) return;

    // 拒绝操作必须填写意见
    if (approvalAction === 'reject' && !approvalComment.trim()) {
      message.error('审批意见不能为空');
      return;
    }

    setModalLoading(true);
    try {
      if (approvalAction === 'approve') {
        await workOrderApi.approve(selectedWorkOrder.id, { comment: approvalComment });
        message.success('工单审批已通过');
      } else {
        await workOrderApi.reject(selectedWorkOrder.id, { comment: approvalComment });
        message.success('工单已拒绝');
      }
      setApprovalModalVisible(false);
      loadWorkOrders();
    } catch (error) {
      message.error(`审批操作失败`);
      console.error('Failed to process approval:', error);
    } finally {
      setModalLoading(false);
    }
  }, [selectedWorkOrder, approvalAction, approvalComment, loadWorkOrders]);

  /**
   * 打开历史记录弹窗
   * 
   * @param workOrder - 工单对象
   * @description 加载并显示工单审批历史
   */
  const openHistoryModal = useCallback((workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
    setHistoryModalVisible(true);
    loadApprovalHistory(workOrder.id);
  }, [loadApprovalHistory]);

  /**
   * 处理分页变化
   * 
   * @param page - 当前页码
   * @param pageSize - 每页数量
   * @description 更新分页状态并重新加载数据
   */
  const handlePageChange = useCallback((page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  }, []);

  /**
   * 处理状态筛选变化
   * 
   * @param status - 选中的状态值
   * @description 更新筛选状态并重置到第一页
   */
  const handleStatusFilterChange = useCallback((status: string) => {
    setSelectedStatus(status);
    setPagination(prev => ({ ...prev, current: 1 }));
  }, []);

  /**
   * 表格列定义
   */
  const columns: ColumnsType<WorkOrder> = [
    {
      title: '工单ID',
      dataIndex: 'id',
      key: 'id',
      width: 180,
      render: (id: string) => <span className="font-mono text-xs">{id.slice(0, 8)}...</span>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string) => <span title={title}>{title}</span>,
    },
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: WorkOrderStatus) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (createdAt: string) => new Date(createdAt).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => {
        const { status } = record;
        return (
          <Space size="small">
            {/* 草稿状态: 显示提交按钮 */}
            {status === 'DRAFT' && (
              <Button 
                type="primary" 
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleSubmitForApproval(record)}
              >
                提交审批
              </Button>
            )}
            
            {/* 待审批状态: 显示通过/拒绝按钮 */}
            {status === 'PENDING' && (
              <>
                <Button 
                  type="primary" 
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => openApprovalModal(record, 'approve')}
                >
                  通过
                </Button>
                <Button 
                  danger 
                  size="small"
                  icon={<CloseCircleOutlined />}
                  onClick={() => openApprovalModal(record, 'reject')}
                >
                  拒绝
                </Button>
              </>
            )}
            
            {/* 已拒绝状态: 显示重新提交按钮 */}
            {status === 'REJECTED' && (
              <Button 
                type="default" 
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleSubmitForApproval(record)}
              >
                重新提交
              </Button>
            )}
            
            {/* 历史记录按钮 (所有状态) */}
            <Button 
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => openHistoryModal(record)}
            >
              历史
            </Button>
          </Space>
        );
      },
    },
  ];

  // 初始化加载数据
  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders]);

  return (
    <div className="work-order-list-page p-6">
      <Card>
        <div className="mb-4 flex justify-between items-center">
          <Title level={4} className="m-0">工单列表</Title>
          <Space>
            <Select
              value={selectedStatus}
              onChange={handleStatusFilterChange}
              options={STATUS_OPTIONS}
              style={{ width: 120 }}
            />
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={workOrders}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: handlePageChange,
          }}
          locale={{
            emptyText: (
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
                description="暂无工单数据"
              />
            ),
          }}
        />
      </Card>

      {/* 审批操作弹窗 */}
      <Modal
        title={approvalAction === 'approve' ? '审批通过' : '审批拒绝'}
        open={approvalModalVisible}
        onOk={handleApproval}
        onCancel={() => setApprovalModalVisible(false)}
        confirmLoading={modalLoading}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ 
          danger: approvalAction === 'reject',
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="工单标题">
            <div className="font-medium">{selectedWorkOrder?.title}</div>
          </Form.Item>
          <Form.Item 
            label="审批意见" 
            required={approvalAction === 'reject'}
            help={approvalAction === 'reject' ? '拒绝操作必须填写审批意见' : '选填'}
          >
            <TextArea
              rows={4}
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              placeholder={approvalAction === 'reject' ? '请输入拒绝原因...' : '选填审批意见'}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 审批历史弹窗 */}
      <Modal
        title="审批历史"
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={600}
      >
        <Spin spinning={modalLoading}>
          <div className="mb-4">
            <strong>工单标题:</strong> {selectedWorkOrder?.title}
          </div>
          {approvalHistory.length > 0 ? (
            <Timeline
              items={approvalHistory.map((item) => {
                const actionConfig = getActionConfig(item.action);
                return {
                  color: actionConfig.color === 'green' ? 'green' : 
                         actionConfig.color === 'red' ? 'red' : 'blue',
                  children: (
                    <div className="approval-history-item">
                      <div className="flex justify-between items-start">
                        <Tag color={actionConfig.color}>{actionConfig.label}</Tag>
                        <span className="text-gray-400 text-xs">
                          {new Date(item.created_at).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span className="text-gray-600">操作人: </span>
                        <span>{item.operator_name || '系统'}</span>
                      </div>
                      {item.comment && (
                        <div className="mt-1 text-gray-600">
                          <span>意见: </span>
                          <span>{item.comment}</span>
                        </div>
                      )}
                    </div>
                  ),
                };
              })}
            />
          ) : (
            <Empty description="暂无审批历史记录" />
          )}
        </Spin>
      </Modal>
    </div>
  );
}

export default WorkOrderListPage;