/**
 * WorkOrderDetailPage - 工单详情页面组件
 * 
 * 提供工单详情查看、审批操作和状态追踪功能。
 * 支持审批通过/拒绝操作，并展示完整的审批历史时间轴。
 * 
 * @module pages/WorkOrderDetailPage
 * @requires react
 * @requires react-router-dom
 * @requires antd
 * @requires @ant-design/icons
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Spin,
  message,
  Timeline,
  Modal,
  Form,
  Input,
  Divider,
  Typography,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  UserOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { WorkOrder, ApprovalRecord } from './types/workOrder';
import { workOrderApi } from './api/workOrderApi';

/** 工单状态颜色映射 */
const STATUS_COLOR_MAP: Record<string, string> = {
  DRAFT: 'default',
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  CLOSED: 'warning',
};

/** 工单状态中文映射 */
const STATUS_TEXT_MAP: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  CLOSED: '已关闭',
};

/** 工单类型中文映射 */
const TYPE_TEXT_MAP: Record<string, string> = {
  IT_SUPPORT: 'IT 支持',
  PURCHASE: '采购申请',
  PERMISSION: '权限申请',
};

/** 审批操作类型 */
type ApprovalAction = 'APPROVE' | 'REJECT';

/** 审批操作参数 */
interface ApprovalPayload {
  workOrderId: string;
  action: ApprovalAction;
  comment?: string;
}

/**
 * 工单详情页面组件
 * 
 * @returns {JSX.Element} 工单详情页面
 */
const WorkOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([]);
  const [approvalModalVisible, setApprovalModalVisible] = useState<boolean>(false);
  const [currentAction, setCurrentAction] = useState<ApprovalAction | null>(null);
  const [approvalForm] = Form.useForm();

  /**
   * 加载工单详情数据
   */
  const fetchWorkOrderDetail = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const [detailData, historyData] = await Promise.all([
        workOrderApi.getWorkOrderById(id),
        workOrderApi.getApprovalHistory(id),
      ]);
      setWorkOrder(detailData);
      setApprovalHistory(historyData);
    } catch (error) {
      message.error('加载工单详情失败');
      console.error('Failed to fetch work order detail:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchWorkOrderDetail();
  }, [fetchWorkOrderDetail]);

  /**
   * 处理审批操作
   * @param action - 审批动作（通过/拒绝）
   */
  const handleApprovalAction = (action: ApprovalAction) => {
    setCurrentAction(action);
    approvalForm.resetFields();
    setApprovalModalVisible(true);
  };

  /**
   * 提交审批表单
   */
  const handleApprovalSubmit = async () => {
    if (!id || !currentAction) return;

    try {
      const values = await approvalForm.validateFields();
      setSubmitting(true);

      const payload: ApprovalPayload = {
        workOrderId: id,
        action: currentAction,
        comment: values.comment,
      };

      if (currentAction === 'APPROVE') {
        await workOrderApi.approveWorkOrder(payload);
        message.success('工单审批通过');
      } else {
        await workOrderApi.rejectWorkOrder(payload);
        message.success('工单已拒绝');
      }

      setApprovalModalVisible(false);
      fetchWorkOrderDetail();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      } else {
        message.error('审批操作失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 返回列表页
   */
  const handleGoBack = () => {
    navigate('/workorder/list');
  };

  /**
   * 格式化日期时间
   * @param dateString - ISO 日期字符串
   * @returns 格式化后的日期字符串
   */
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * 获取审批动作文本
   * @param action - 审批动作
   * @returns 动作文本
   */
  const getActionText = (action: string): string => {
    return action === 'APPROVE' ? '通过' : '拒绝';
  };

  /**
   * 获取审批动作颜色
   * @param action - 审批动作
   * @returns 颜色标识
   */
  const getActionColor = (action: string): string => {
    return action === 'APPROVE' ? 'green' : 'red';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载工单详情..." />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <Card>
        <Alert message="工单不存在或已被删除" type="warning" showIcon />
        <Button type="primary" onClick={handleGoBack} style={{ marginTop: 16 }}>
          返回列表
        </Button>
      </Card>
    );
  }

  const canApprove = workOrder.status === 'PENDING';

  return (
    <div style={{ padding: 24 }}>
      {/* 页面标题栏 */}
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={handleGoBack} type="text" />
            <FileTextOutlined />
            <span>工单详情</span>
          </Space>
        }
        extra={
          canApprove && (
            <Space>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleApprovalAction('APPROVE')}
              >
                通过
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => handleApprovalAction('REJECT')}
              >
                拒绝
              </Button>
            </Space>
          )
        }
      >
        {/* 工单基本信息 */}
        <Descriptions column={2} bordered>
          <Descriptions.Item label="工单标题" span={2}>
            <Typography.Text strong>{workOrder.title}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="工单类型">
            {TYPE_TEXT_MAP[workOrder.type] || workOrder.type}
          </Descriptions.Item>
          <Descriptions.Item label="工单状态">
            <Tag color={STATUS_COLOR_MAP[workOrder.status]}>
              {STATUS_TEXT_MAP[workOrder.status] || workOrder.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="创建人">
            <Space>
              <UserOutlined />
              {workOrder.creatorName}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            <Space>
              <ClockCircleOutlined />
              {formatDateTime(workOrder.createdAt)}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="工单描述" span={2}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {workOrder.description}
            </Typography.Paragraph>
          </Descriptions.Item>
        </Descriptions>

        {/* 审批历史时间轴 */}
        {approvalHistory.length > 0 && (
          <>
            <Divider orientation="left">审批历史</Divider>
            <Card bodyStyle={{ background: '#fafafa' }}>
              <Timeline
                items={approvalHistory.map((record) => ({
                  color: getActionColor(record.action),
                  children: (
                    <div key={record.id}>
                      <Typography.Text strong>
                        审批人: {record.approverName}
                      </Typography.Text>
                      <br />
                      <Tag color={getActionColor(record.action)}>
                        {getActionText(record.action)}
                      </Tag>
                      {record.comment && (
                        <>
                          <br />
                          <Typography.Text type="secondary">
                            意见: {record.comment}
                          </Typography.Text>
                        </>
                      )}
                      <br />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDateTime(record.timestamp)}
                      </Typography.Text>
                    </div>
                  ),
                }))}
              />
            </Card>
          </>
        )}
      </Card>

      {/* 审批操作 Modal */}
      <Modal
        title={currentAction === 'APPROVE' ? '审批通过' : '审批拒绝'}
        open={approvalModalVisible}
        onOk={handleApprovalSubmit}
        onCancel={() => setApprovalModalVisible(false)}
        confirmLoading={submitting}
        okText="确认"
        cancelText="取消"
        okButtonProps={{
          danger: currentAction === 'REJECT',
        }}
      >
        <Form form={approvalForm} layout="vertical">
          <Form.Item
            name="comment"
            label={currentAction === 'REJECT' ? '拒绝原因（必填）' : '审批意见（可选）'}
            rules={
              currentAction === 'REJECT'
                ? [{ required: true, message: '请输入拒绝原因' }]
                : []
            }
          >
            <Input.TextArea
              rows={4}
              placeholder={
                currentAction === 'REJECT'
                  ? '请输入拒绝原因'
                  : '请输入审批意见（可选）'
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkOrderDetailPage;