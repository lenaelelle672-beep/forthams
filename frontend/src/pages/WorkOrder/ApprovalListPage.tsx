/**
 * ApprovalListPage - 工单审批列表页面
 * 
 * 功能模块：
 * - 待我审批列表：展示当前用户需要审批的工单
 * - 我已审批列表：展示当前用户已处理过的审批
 * - 审批详情：查看工单详情并执行审批操作
 * 
 * 关联后端 API：
 * - GET /api/approvals/pending - 获取待审批工单列表
 * - GET /api/approvals/history - 获取审批历史
 * - POST /api/workorders/{id}/approve - 审批通过
 * - POST /api/workorders/{id}/reject - 审批驳回
 * - POST /api/workorders/{id}/delegate - 转交审批
 * 
 * @_SWARM-501 @工单审批流程
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  List,
  Card,
  Button,
  Tag,
  Space,
  Drawer,
  Timeline,
  Descriptions,
  Modal,
  Form,
  Input,
  Select,
  message,
  Spin,
  Empty,
  Badge,
  Typography,
  Avatar,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SwapOutlined,
  HistoryOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { WorkOrder, WorkOrderStatus, ApprovalHistory, ApprovalChain } from '@/types/workorder.types';
import { useApprovalStore } from '@/stores/approvalStore';
import { workOrderApi } from '../api/workOrderApi';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * 审批操作类型枚举
 */
export enum ApprovalActionType {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  DELEGATE = 'DELEGATE',
  RETURN = 'RETURN',
  SUBMIT = 'SUBMIT',
}

/**
 * 工单状态到中文标签的映射
 */
const STATUS_LABEL_MAP: Record<WorkOrderStatus, { text: string; color: string }> = {
  [WorkOrderStatus.DRAFT]: { text: '草稿', color: 'default' },
  [WorkOrderStatus.PENDING_APPROVAL]: { text: '待审批', color: 'warning' },
  [WorkOrderStatus.APPROVAL_IN_PROGRESS]: { text: '审批中', color: 'processing' },
  [WorkOrderStatus.APPROVED]: { text: '已通过', color: 'success' },
  [WorkOrderStatus.REJECTED]: { text: '已驳回', color: 'error' },
  [WorkOrderStatus.ARCHIVED]: { text: '已归档', color: 'default' },
  [WorkOrderStatus.CANCELLED]: { text: '已取消', color: 'default' },
};

/**
 * 审批列表 Tab 页签类型
 */
type TabType = 'pending' | 'history';

/**
 * 审批详情抽屉Props
 */
interface ApprovalDetailDrawerProps {
  visible: boolean;
  workOrder: WorkOrder | null;
  approvalChain?: ApprovalChain;
  approvalHistory: ApprovalHistory[];
  onClose: () => void;
  onApprove: (workOrderId: string, comment: string) => Promise<void>;
  onReject: (workOrderId: string, reason: string) => Promise<void>;
  onDelegate: (workOrderId: string, toUserId: string, reason?: string) => Promise<void>;
}

/**
 * 审批详情抽屉组件
 * 
 * 展示工单详细信息、审批链状态、审批历史，并提供审批操作入口
 */
const ApprovalDetailDrawer: React.FC<ApprovalDetailDrawerProps> = ({
  visible,
  workOrder,
  approvalChain,
  approvalHistory,
  onClose,
  onApprove,
  onReject,
  onDelegate,
}) => {
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [delegateModalVisible, setDelegateModalVisible] = useState(false);
  const [comment, setComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [delegateTo, setDelegateTo] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);

  // 加载可转交的审批人列表
  useEffect(() => {
    if (delegateModalVisible) {
      // 实际项目中应从用户服务获取，这里模拟数据
      setUsers([
        { id: 'user-002', name: '李经理' },
        { id: 'user-003', name: '王总监' },
        { id: 'user-004', name: '张主管' },
      ]);
    }
  }, [delegateModalVisible]);

  /**
   * 处理审批通过
   */
  const handleApprove = async () => {
    if (!workOrder) return;
    setSubmitting(true);
    try {
      await onApprove(workOrder.id, comment);
      message.success('审批通过');
      setApproveModalVisible(false);
      setComment('');
    } catch (error) {
      message.error('审批操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 处理审批驳回
   */
  const handleReject = async () => {
    if (!workOrder || !rejectReason.trim()) {
      message.warning('请填写驳回原因');
      return;
    }
    setSubmitting(true);
    try {
      await onReject(workOrder.id, rejectReason);
      message.success('工单已驳回');
      setRejectModalVisible(false);
      setRejectReason('');
    } catch (error) {
      message.error('驳回操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 处理审批转交
   */
  const handleDelegate = async () => {
    if (!workOrder || !delegateTo) {
      message.warning('请选择转交对象');
      return;
    }
    setSubmitting(true);
    try {
      await onDelegate(workOrder.id, delegateTo, comment);
      message.success('审批已转交');
      setDelegateModalVisible(false);
      setDelegateTo('');
      setComment('');
    } catch (error) {
      message.error('转交操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!workOrder) return null;

  const statusInfo = STATUS_LABEL_MAP[workOrder.status] || { text: '未知', color: 'default' };
  const currentNode = approvalChain?.nodes?.find(n => n.order === approvalChain.currentNodeOrder);

  return (
    <>
      <Drawer
        title={
          <Space>
            <FileTextOutlined />
            <span>工单详情 - {workOrder.title}</span>
          </Space>
        }
        placement="right"
        width={720}
        open={visible}
        onClose={onClose}
        extra={
          <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
        }
      >
        {/* 工单基本信息 */}
        <Descriptions title="工单信息" bordered column={2} size="small">
          <Descriptions.Item label="工单编号">{workOrder.id}</Descriptions.Item>
          <Descriptions.Item label="工单类型">{workOrder.type || '通用'}</Descriptions.Item>
          <Descriptions.Item label="申请人">
            <Space>
              <Avatar size="small" icon={<UserOutlined />} />
              <span>{workOrder.requesterName || '未知'}</span>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="申请部门">{workOrder.requesterDept || '未知'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(workOrder.createdAt).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="申请金额">
            <Text strong>
              ¥{workOrder.amount?.toLocaleString() || '0'}
            </Text>
          </Descriptions.Item>
        </Descriptions>

        {/* 审批链状态 */}
        {approvalChain && (
          <Card 
            title="审批流程" 
            size="small" 
            style={{ marginTop: 16 }}
            extra={
              <Tag color="blue">
                第 {approvalChain.currentNodeOrder || 1} / {approvalChain.nodes?.length || 0} 级
              </Tag>
            }
          >
            <Timeline
              items={approvalChain.nodes?.map((node, index) => {
                const isCompleted = node.order < (approvalChain.currentNodeOrder || 0);
                const isCurrent = node.order === approvalChain.currentNodeOrder;
                const nodeHistory = approvalHistory.find(h => h.nodeOrder === node.order);

                return {
                  color: isCompleted ? 'green' : isCurrent ? 'blue' : 'gray',
                  children: (
                    <div className={isCurrent ? 'current-approval-node' : ''}>
                      <Space>
                        <Text strong>审批节点 {node.order}</Text>
                        <Text type="secondary">({node.approverType === 'ROLE' ? node.approverRole : node.approverName})</Text>
                      </Space>
                      {nodeHistory && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary">
                            {nodeHistory.action === 'APPROVE' ? '✅ ' : nodeHistory.action === 'REJECT' ? '❌ ' : ''}
                            {nodeHistory.action} - {nodeHistory.approverName}
                          </Text>
                          {nodeHistory.comment && (
                            <div style={{ fontSize: 12, color: '#888' }}>
                              批注：{nodeHistory.comment}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ),
                };
              })}
            />
          </Card>
        )}

        {/* 审批历史时间线 */}
        <Card 
          title={
            <Space>
              <HistoryOutlined />
              <span>审批记录</span>
            </Space>
          } 
          size="small" 
          style={{ marginTop: 16 }}
        >
          {approvalHistory.length > 0 ? (
            <Timeline
              items={approvalHistory.map((record, index) => {
                const actionIcon = {
                  [ApprovalActionType.APPROVE]: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
                  [ApprovalActionType.REJECT]: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                  [ApprovalActionType.DELEGATE]: <SwapOutlined style={{ color: '#1890ff' }} />,
                  [ApprovalActionType.RETURN]: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
                }[record.action as ApprovalActionType] || <ClockCircleOutlined />;

                return {
                  dot: actionIcon,
                  children: (
                    <div>
                      <Space>
                        <Text strong>{record.approverName}</Text>
                        <Tag color={
                          record.action === 'APPROVE' ? 'success' : 
                          record.action === 'REJECT' ? 'error' : 
                          record.action === 'DELEGATE' ? 'processing' : 'warning'
                        }>
                          {record.action === 'APPROVE' ? '通过' : 
                           record.action === 'REJECT' ? '驳回' : 
                           record.action === 'DELEGATE' ? '转交' : '退回'}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(record.actionTime).format('YYYY-MM-DD HH:mm')}
                        </Text>
                      </Space>
                      {record.comment && (
                        <div style={{ marginTop: 4, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                          <Text>{record.comment}</Text>
                        </div>
                      )}
                      {record.action === 'DELEGATE' && record.delegateTo && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary">转交给：{record.delegateTo}</Text>
                        </div>
                      )}
                    </div>
                  ),
                };
              })}
            />
          ) : (
            <Empty description="暂无审批记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        {/* 工单描述 */}
        {workOrder.description && (
          <Card title="工单描述" size="small" style={{ marginTop: 16 }}>
            <Text>{workOrder.description}</Text>
          </Card>
        )}

        {/* 审批操作按钮（仅在待审批状态下显示） */}
        {(workOrder.status === WorkOrderStatus.PENDING_APPROVAL || 
          workOrder.status === WorkOrderStatus.APPROVAL_IN_PROGRESS) && (
          <Card title="审批操作" size="small" style={{ marginTop: 16 }}>
            <Space size="large">
              <Button 
                type="primary" 
                icon={<CheckCircleOutlined />}
                onClick={() => setApproveModalVisible(true)}
              >
                审批通过
              </Button>
              <Button 
                danger 
                icon={<CloseCircleOutlined />}
                onClick={() => setRejectModalVisible(true)}
              >
                驳回
              </Button>
              <Button 
                icon={<SwapOutlined />}
                onClick={() => setDelegateModalVisible(true)}
              >
                转交
              </Button>
            </Space>
          </Card>
        )}
      </Drawer>

      {/* 审批通过确认弹窗 */}
      <Modal
        title="确认审批通过"
        open={approveModalVisible}
        onOk={handleApprove}
        onCancel={() => setApproveModalVisible(false)}
        confirmLoading={submitting}
        okText="确认通过"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="审批意见（可选）">
            <TextArea
              rows={4}
              placeholder="请输入审批意见..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 驳回确认弹窗 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>确认驳回工单</span>
          </Space>
        }
        open={rejectModalVisible}
        onOk={handleReject}
        onCancel={() => setRejectModalVisible(false)}
        confirmLoading={submitting}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item 
            label="驳回原因" 
            required
            validateStatus={rejectReason.trim() ? 'success' : 'error'}
            help={!rejectReason.trim() ? '请填写驳回原因' : ''}
          >
            <TextArea
              rows={4}
              placeholder="请输入驳回原因（必填）..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 转交确认弹窗 */}
      <Modal
        title="转交审批"
        open={delegateModalVisible}
        onOk={handleDelegate}
        onCancel={() => setDelegateModalVisible(false)}
        confirmLoading={submitting}
        okText="确认转交"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="转交给" required>
            <Select
              placeholder="请选择审批人"
              value={delegateTo}
              onChange={setDelegateTo}
              options={users.map(u => ({ label: u.name, value: u.id }))}
            />
          </Form.Item>
          <Form.Item label="转交说明（可选）">
            <TextArea
              rows={3}
              placeholder="请输入转交说明..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={200}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

/**
 * 审批列表页面主组件
 * 
 * @description
 * 提供两个 Tab 页签：
 * 1. 待我审批：展示需要当前用户审批的工单列表
 * 2. 我已审批：展示当前用户已处理过的审批历史
 */
const ApprovalListPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);
  const [approvalChain, setApprovalChain] = useState<ApprovalChain | undefined>();
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // 使用审批 Store
  const {
    pendingApprovals,
    approvalHistory: storeHistory,
    isLoading,
    fetchPendingApprovals,
    fetchApprovalHistory,
  } = useApprovalStore();

  /**
   * 初始化加载待审批列表
   */
  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  /**
   * 加载工单详情
   */
  const loadWorkOrderDetail = useCallback(async (workOrder: WorkOrder) => {
    setDetailLoading(true);
    setSelectedWorkOrder(workOrder);
    
    try {
      // 并行加载审批历史和审批链信息
      const [historyRes, chainRes] = await Promise.all([
        workOrderApi.getApprovalHistory(workOrder.id),
        workOrderApi.getApprovalChain(workOrder.id).catch(() => null),
      ]);
      
      setApprovalHistory(historyRes.data || []);
      setApprovalChain(chainRes.data || undefined);
      setDetailDrawerVisible(true);
    } catch (error) {
      message.error('加载工单详情失败');
      console.error('Failed to load work order detail:', error);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  /**
   * 处理审批通过
   */
  const handleApprove = async (workOrderId: string, comment: string) => {
    try {
      await workOrderApi.approve(workOrderId, { comment });
      // 刷新列表
      await fetchPendingApprovals();
      setDetailDrawerVisible(false);
    } catch (error) {
      throw error;
    }
  };

  /**
   * 处理审批驳回
   */
  const handleReject = async (workOrderId: string, reason: string) => {
    try {
      await workOrderApi.reject(workOrderId, { reason });
      // 刷新列表
      await fetchPendingApprovals();
      setDetailDrawerVisible(false);
    } catch (error) {
      throw error;
    }
  };

  /**
   * 处理审批转交
   */
  const handleDelegate = async (workOrderId: string, toUserId: string, reason?: string) => {
    try {
      await workOrderApi.delegate(workOrderId, { toUserId, reason });
      // 刷新列表
      await fetchPendingApprovals();
      setDetailDrawerVisible(false);
    } catch (error) {
      throw error;
    }
  };

  /**
   * 切换 Tab
   */
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'history') {
      fetchApprovalHistory();
    }
  };

  /**
   * 渲染待审批列表项
   */
  const renderPendingItem = (item: WorkOrder) => {
    const statusInfo = STATUS_LABEL_MAP[item.status] || { text: '未知', color: 'default' };

    return (
      <Card
        hoverable
        className="approval-item"
        style={{ marginBottom: 12 }}
        onClick={() => loadWorkOrderDetail(item)}
        data-testid="pending-workorder-item"
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <Space align="start">
              <Badge status="processing" />
              <Title level={5} style={{ margin: 0 }}>{item.title}</Title>
              <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
            </Space>
            
            <div style={{ marginTop: 8, marginLeft: 24 }}>
              <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                <Text type="secondary">
                  <UserOutlined style={{ marginRight: 4 }} />
                  {item.requesterName || '未知'}
                </Text>
                <Text type="secondary">
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {dayjs(item.createdAt).fromNow()}
                </Text>
                {item.amount && (
                  <Text strong style={{ color: '#1890ff' }}>
                    ¥{item.amount.toLocaleString()}
                  </Text>
                )}
              </Space>
            </div>

            {item.description && (
              <div style={{ marginTop: 8, marginLeft: 24 }}>
                <Text type="secondary" ellipsis={{ rows: 2 }}>
                  {item.description}
                </Text>
              </div>
            )}
          </div>

          <div className="approval-actions" style={{ marginLeft: 16 }}>
            <Space direction="vertical" size="small">
              <Tooltip title="查看详情并审批">
                <Button type="link" size="small">
                  查看详情 →
                </Button>
              </Tooltip>
            </Space>
          </div>
        </div>
      </Card>
    );
  };

  /**
   * 渲染已审批列表项
   */
  const renderHistoryItem = (item: WorkOrder) => {
    const myAction = storeHistory.find(h => h.workOrderId === item.id);
    const actionText = myAction?.action === 'APPROVE' ? '通过' : 
                       myAction?.action === 'REJECT' ? '驳回' : 
                       myAction?.action === 'DELEGATE' ? '已转交' : '已处理';
    const actionColor = myAction?.action === 'APPROVE' ? 'success' : 
                        myAction?.action === 'REJECT' ? 'error' : 'default';

    return (
      <Card
        hoverable
        className="history-item"
        style={{ marginBottom: 12 }}
        onClick={() => loadWorkOrderDetail(item)}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <Space align="start">
              <FileTextOutlined />
              <Title level={5} style={{ margin: 0 }}>{item.title}</Title>
              <Tag color={actionColor}>{actionText}</Tag>
            </Space>
            
            <div style={{ marginTop: 8, marginLeft: 24 }}>
              <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                <Text type="secondary">
                  <UserOutlined style={{ marginRight: 4 }} />
                  {item.requesterName || '未知'}
                </Text>
                <Text type="secondary">
                  <HistoryOutlined style={{ marginRight: 4 }} />
                  {myAction ? dayjs(myAction.actionTime).format('YYYY-MM-DD HH:mm') : '-'}
                </Text>
              </Space>
            </div>
          </div>

          <Button type="link" size="small">
            查看详情 →
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="approval-list-page" style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={4}>工单审批</Title>
          <Text type="secondary">
            {activeTab === 'pending' 
              ? `您有 ${pendingApprovals.length} 条待审批工单`
              : `您已处理 ${storeHistory.length} 条审批`
            }
          </Text>
        </div>

        {/* Tab 切换 */}
        <Space style={{ marginBottom: 16 }}>
          <Button
            type={activeTab === 'pending' ? 'primary' : 'default'}
            onClick={() => handleTabChange('pending')}
            data-testid="tab-pending"
          >
            <Badge count={pendingApprovals.length} size="small" offset={[8, 0]}>
              待我审批
            </Badge>
          </Button>
          <Button
            type={activeTab === 'history' ? 'primary' : 'default'}
            onClick={() => handleTabChange('history')}
            data-testid="tab-history"
          >
            我已审批
          </Button>
        </Space>

        {/* 加载状态 */}
        {(loading || isLoading) && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" tip="加载中..." />
          </div>
        )}

        {/* 待审批列表 */}
        {!loading && !isLoading && activeTab === 'pending' && (
          <>
            {pendingApprovals.length > 0 ? (
              <List
                dataSource={pendingApprovals}
                renderItem={renderPendingItem}
                locale={{
                  emptyText: (
                    <Empty 
                      description="暂无待审批工单" 
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ),
                }}
              />
            ) : (
              <Empty 
                description="暂无待审批工单" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={() => message.info('您已完成所有审批任务！')}>
                  刷新列表
                </Button>
              </Empty>
            )}
          </>
        )}

        {/* 已审批历史列表 */}
        {!loading && !isLoading && activeTab === 'history' && (
          <>
            {storeHistory.length > 0 ? (
              <List
                dataSource={storeHistory.map(h => h.workOrder).filter(Boolean) as WorkOrder[]}
                renderItem={renderHistoryItem}
              />
            ) : (
              <Empty 
                description="暂无审批历史" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </>
        )}
      </Card>

      {/* 审批详情抽屉 */}
      <ApprovalDetailDrawer
        visible={detailDrawerVisible}
        workOrder={selectedWorkOrder}
        approvalChain={approvalChain}
        approvalHistory={approvalHistory}
        onClose={() => setDetailDrawerVisible(false)}
        onApprove={handleApprove}
        onReject={handleReject}
        onDelegate={handleDelegate}
      />
    </div>
  );
};

export default ApprovalListPage;