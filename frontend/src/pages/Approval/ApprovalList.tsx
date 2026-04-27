/**
 * 审批列表页面组件
 * 
 * 功能描述：
 * - 展示当前用户待审批的工单列表
 * - 支持通过/驳回审批操作
 * - 展示审批历史时间线
 * 
 * @module pages/approval/ApprovalList
 * @requires React
 * @requires types/approval
 * @requires services/approvalService
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  HistoryOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { 
  Table, 
  Button, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  message, 
  Timeline,
  Card,
  Row,
  Col,
  Space,
  Empty,
  Spin,
  Tooltip
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { 
  WorkOrder, 
  ApprovalAction, 
  ApprovalRecord,
  ApprovalStatus 
} from '../../types/approval';
import { approvalService } from '../../services/approvalService';

/** 审批操作表单类型 */
interface ApprovalFormValues {
  comment: string;
  reason?: string;
}

/**
 * 审批列表页面组件
 * 
 * @description
 * 提供工单审批功能的主页面，包括：
 * - 待审批工单列表展示
 * - 审批操作（通过/驳回）
 * - 审批历史时间线查看
 * 
 * @returns React 组件
 */
const ApprovalList: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState<boolean>(true);
  const [pendingOrders, setPendingOrders] = useState<WorkOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([]);
  const [historyVisible, setHistoryVisible] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState<boolean>(false);
  const [currentAction, setCurrentAction] = useState<ApprovalAction | null>(null);
  const [form] = Form.useForm<ApprovalFormValues>();

  /**
   * 加载待审批工单列表
   */
  const loadPendingOrders = useCallback(async () => {
    try {
      setLoading(true);
      const orders = await approvalService.getPendingApprovals();
      setPendingOrders(orders);
    } catch (error) {
      message.error('加载待审批工单失败');
      console.error('Failed to load pending orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 加载审批历史
   * @param workOrderId - 工单ID
   */
  const loadApprovalHistory = useCallback(async (workOrderId: number) => {
    try {
      const history = await approvalService.getApprovalHistory(workOrderId);
      setApprovalHistory(history);
      setHistoryVisible(true);
    } catch (error) {
      message.error('加载审批历史失败');
      console.error('Failed to load approval history:', error);
    }
  }, []);

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadPendingOrders();
  }, [loadPendingOrders]);

  /**
   * 处理审批操作
   * @param order - 工单对象
   * @param action - 审批动作
   */
  const handleApprovalAction = (order: WorkOrder, action: ApprovalAction) => {
    setSelectedOrder(order);
    setCurrentAction(action);
    form.resetFields();
    setApprovalModalVisible(true);
  };

  /**
   * 提交审批表单
   */
  const handleSubmitApproval = async () => {
    if (!selectedOrder || !currentAction) return;

    try {
      const values = await form.validateFields();
      setActionLoading(true);

      if (currentAction === ApprovalAction.APPROVE) {
        await approvalService.approve(selectedOrder.id, values.comment);
        message.success('工单已通过');
      } else if (currentAction === ApprovalAction.REJECT) {
        if (!values.reason) {
          message.error('驳回必须填写原因');
          setActionLoading(false);
          return;
        }
        await approvalService.reject(selectedOrder.id, values.reason);
        message.success('工单已驳回');
      } else if (currentAction === ApprovalAction.RESUBMIT) {
        await approvalService.resubmit(selectedOrder.id, values.comment);
        message.success('工单已重新提交');
      }

      setApprovalModalVisible(false);
      setSelectedOrder(null);
      setCurrentAction(null);
      loadPendingOrders();
    } catch (error) {
      message.error('审批操作失败');
      console.error('Approval action failed:', error);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 取消审批操作
   */
  const handleCancelApproval = () => {
    setApprovalModalVisible(false);
    setSelectedOrder(null);
    setCurrentAction(null);
    form.resetFields();
  };

  /**
   * 查看审批历史
   * @param order - 工单对象
   */
  const handleViewHistory = (order: WorkOrder) => {
    setSelectedOrder(order);
    loadApprovalHistory(order.id);
  };

  /**
   * 获取状态标签颜色
   * @param status - 工单状态
   * @returns 颜色字符串
   */
  const getStatusColor = (status: ApprovalStatus): string => {
    const colorMap: Record<ApprovalStatus, string> = {
      [ApprovalStatus.PENDING]: 'orange',
      [ApprovalStatus.APPROVED]: 'green',
      [ApprovalStatus.REJECTED]: 'red',
      [ApprovalStatus.DRAFT]: 'default',
      [ApprovalStatus.SUBMITTED]: 'blue',
      [ApprovalStatus.CLOSED]: 'gray',
    };
    return colorMap[status] || 'default';
  };

  /**
   * 获取状态显示文本
   * @param status - 工单状态
   * @returns 显示文本
   */
  const getStatusText = (status: ApprovalStatus): string => {
    const textMap: Record<ApprovalStatus, string> = {
      [ApprovalStatus.PENDING]: '待审批',
      [ApprovalStatus.APPROVED]: '已通过',
      [ApprovalStatus.REJECTED]: '已驳回',
      [ApprovalStatus.DRAFT]: '草稿',
      [ApprovalStatus.SUBMITTED]: '已提交',
      [ApprovalStatus.CLOSED]: '已关闭',
    };
    return textMap[status] || status;
  };

  /**
   * 获取操作图标
   * @param action - 审批动作
   * @returns React 节点
   */
  const getActionIcon = (action: ApprovalAction): React.ReactNode => {
    switch (action) {
      case ApprovalAction.SUBMIT:
        return <ClockCircleOutlined />;
      case ApprovalAction.APPROVE:
        return <CheckCircleOutlined />;
      case ApprovalAction.REJECT:
        return <CloseCircleOutlined />;
      default:
        return <HistoryOutlined />;
    }
  };

  /**
   * 获取动作显示文本
   * @param action - 审批动作
   * @returns 显示文本
   */
  const getActionText = (action: ApprovalAction): string => {
    const textMap: Record<ApprovalAction, string> = {
      [ApprovalAction.SUBMIT]: '提交',
      [ApprovalAction.APPROVE]: '通过',
      [ApprovalAction.REJECT]: '驳回',
      [ApprovalAction.RESUBMIT]: '重新提交',
    };
    return textMap[action] || action;
  };

  // 表格列定义
  const columns: ColumnsType<WorkOrder> = [
    {
      title: '工单编号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 150,
      fixed: 'left',
    },
    {
      title: '工单标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '工单类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => (
        <Tag color="blue">{type}</Tag>
      ),
    },
    {
      title: '申请人',
      dataIndex: 'applicantName',
      key: 'applicantName',
      width: 100,
    },
    {
      title: '申请部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ApprovalStatus) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_: unknown, record: WorkOrder) => (
        <Space size="small">
          <Tooltip title="通过">
            <Button 
              type="primary" 
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApprovalAction(record, ApprovalAction.APPROVE)}
            >
              通过
            </Button>
          </Tooltip>
          <Tooltip title="驳回">
            <Button 
              danger 
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={() => handleApprovalAction(record, ApprovalAction.REJECT)}
            >
              驳回
            </Button>
          </Tooltip>
          <Tooltip title="查看历史">
            <Button 
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => handleViewHistory(record)}
            >
              历史
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 渲染审批历史时间线节点
  const renderTimelineItem = (record: ApprovalRecord, index: number) => {
    const isLast = index === approvalHistory.length - 1;
    const isApproved = record.action === ApprovalAction.APPROVE;
    const isRejected = record.action === ApprovalAction.REJECT;
    
    const dotColor = isApproved ? 'green' : isRejected ? 'red' : 'blue';
    
    return (
      <Timeline.Item 
        key={record.id} 
        color={dotColor}
        dot={getActionIcon(record.action)}
      >
        <Card size="small" className="approval-history-card">
          <Row gutter={16}>
            <Col span={12}>
              <Space direction="vertical" size={4}>
                <strong>{getActionText(record.action)}</strong>
                <span className="approval-operator">
                  操作人: {record.operatorName || '系统'}
                </span>
                <span className="approval-time">
                  {new Date(record.createdAt).toLocaleString()}
                </span>
              </Space>
            </Col>
            <Col span={12}>
              {record.comment && (
                <div className="approval-comment">
                  <ExclamationCircleOutlined /> 备注: {record.comment}
                </div>
              )}
              {record.reason && (
                <div className="approval-reason">
                  <span style={{ color: 'red' }}>驳回原因: {record.reason}</span>
                </div>
              )}
            </Col>
          </Row>
        </Card>
      </Timeline.Item>
    );
  };

  return (
    <div className="approval-list-page" data-testid="approval-list-page">
      <Card 
        title="工单审批" 
        className="approval-card"
        extra={
          <Button 
            type="primary" 
            icon={<ClockCircleOutlined />}
            onClick={loadPendingOrders}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        {/* 统计信息 */}
        <Row gutter={16} className="approval-stats" style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="待审批" 
                value={pendingOrders.length} 
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="今日已审批" 
                value={0} 
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="本周审批" 
                value={0} 
                valueStyle={{ color: '#1890ff' }}
                prefix={<HistoryOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="本月审批" 
                value={0} 
                valueStyle={{ color: '#722ed1' }}
                prefix={<HistoryOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* 待审批工单列表 */}
        <div data-testid="pending-list">
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={pendingOrders}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
              scroll={{ x: 1200 }}
              locale={{
                emptyText: (
                  <Empty 
                    description="暂无待审批工单" 
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
              rowClassName={(record) => 
                record.priority === 'HIGH' ? 'high-priority-row' : ''
              }
            />
          </Spin>
        </div>
      </Card>

      {/* 审批操作模态框 */}
      <Modal
        title={currentAction === ApprovalAction.APPROVE ? '通过审批' : '驳回工单'}
        open={approvalModalVisible}
        onOk={handleSubmitApproval}
        onCancel={handleCancelApproval}
        confirmLoading={actionLoading}
        okText={currentAction === ApprovalAction.APPROVE ? '确认通过' : '确认驳回'}
        cancelText="取消"
        okButtonProps={{ 
          danger: currentAction === ApprovalAction.REJECT,
          'data-testid': 'confirm-btn'
        }}
        width={500}
      >
        <Form form={form} layout="vertical">
          {selectedOrder && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical">
                <div>
                  <strong>工单编号:</strong> {selectedOrder.orderNo}
                </div>
                <div>
                  <strong>工单标题:</strong> {selectedOrder.title}
                </div>
                <div>
                  <strong>申请人:</strong> {selectedOrder.applicantName}
                </div>
              </Space>
            </Card>
          )}
          
          <Form.Item
            name="comment"
            label="审批意见"
            rules={[
              { 
                required: currentAction === ApprovalAction.APPROVE,
                message: '请输入审批意见' 
              }
            ]}
          >
            <Input.TextArea 
              rows={4} 
              placeholder="请输入审批意见（通过时必填）"
              data-testid="comment-input"
            />
          </Form.Item>

          {currentAction === ApprovalAction.REJECT && (
            <Form.Item
              name="reason"
              label="驳回原因"
              rules={[
                { 
                  required: true,
                  message: '请输入驳回原因' 
                }
              ]}
            >
              <Input.TextArea 
                rows={3} 
                placeholder="请输入驳回原因（必填）"
                data-testid="rejection-reason"
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 审批历史模态框 */}
      <Modal
        title="审批历史"
        open={historyVisible}
        onCancel={() => {
          setHistoryVisible(false);
          setSelectedOrder(null);
        }}
        footer={null}
        width={700}
      >
        {selectedOrder && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space>
                <span>
                  <strong>工单编号:</strong> {selectedOrder.orderNo}
                </span>
                <span>
                  <strong>工单标题:</strong> {selectedOrder.title}
                </span>
              </Space>
            </Card>
            
            <Timeline data-testid="approval-timeline">
              {approvalHistory.length > 0 ? (
                approvalHistory.map((record, index) => 
                  renderTimelineItem(record, index)
                )
              ) : (
                <Empty description="暂无审批历史" />
              )}
            </Timeline>
          </div>
        )}
      </Modal>
    </div>
  );
};

// 导入Statistic组件
import { Statistic } from 'antd';

export default ApprovalList;