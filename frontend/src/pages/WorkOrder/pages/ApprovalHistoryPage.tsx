import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Timeline, Tag, Spin, message, Button, Empty, Descriptions } from 'antd';
import { UserOutlined, CheckCircleOutlined, CloseCircleOutlined, SwapOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

interface ApprovalRecord {
  id: string;
  operator: string;
  operatorRole: string;
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'TRANSFER';
  comment: string;
  createdAt: string;
  fromUser?: string;
  toUser?: string;
}

interface WorkOrderDetail {
  id: string;
  title: string;
  status: string;
  priority: string;
  submitter: string;
  submitTime: string;
  description: string;
  currentApprover?: string;
}

/**
 * 工单审批历史页面
 * @description 展示工单的完整审批链路，包括提交、审批、转交等操作记录
 * @param {string} workOrderId - 工单ID，从路由参数获取
 * @returns {React.ReactElement} 审批历史页面组件
 */
const ApprovalHistoryPage: React.FC = () => {
  const { workOrderId } = useParams<{ workOrderId: string }>();
  const [loading, setLoading] = useState<boolean>(true);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([]);
  const [workOrderDetail, setWorkOrderDetail] = useState<WorkOrderDetail | null>(null);

  /**
   * 获取工单详情
   * @description 调用API获取工单基本信息
   */
  const fetchWorkOrderDetail = async (): Promise<void> => {
    try {
      const response = await fetch(`/api/v1/workorders/${workOrderId}`);
      if (!response.ok) throw new Error('获取工单详情失败');
      const data = await response.json();
      setWorkOrderDetail(data);
    } catch (error) {
      message.error('加载工单详情失败');
    }
  };

  /**
   * 获取审批历史记录
   * @description 调用API获取工单的审批历史列表
   */
  const fetchApprovalHistory = async (): Promise<void> => {
    try {
      const response = await fetch(`/api/v1/workorders/${workOrderId}/history`);
      if (!response.ok) throw new Error('获取审批历史失败');
      const data = await response.json();
      setApprovalHistory(data.items || []);
    } catch (error) {
      message.error('加载审批历史失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化数据加载
   * @description 组件挂载时同时获取工单详情和审批历史
   */
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setLoading(true);
      await Promise.all([fetchWorkOrderDetail(), fetchApprovalHistory()]);
    };
    loadData();
  }, [workOrderId]);

  /**
   * 获取操作图标
   * @description 根据操作类型返回对应的图标组件
   * @param {string} action - 操作类型
   * @returns {React.ReactElement} 图标组件
   */
  const getActionIcon = (action: string): React.ReactElement => {
    const iconMap: Record<string, React.ReactElement> = {
      SUBMIT: <ClockCircleOutlined style={{ color: '#1890ff' }} />,
      APPROVE: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      REJECT: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
      TRANSFER: <SwapOutlined style={{ color: '#faad14' }} />,
    };
    return iconMap[action] || <ClockCircleOutlined />;
  };

  /**
   * 获取操作标签颜色
   * @description 根据操作类型返回对应的标签颜色
   * @param {string} action - 操作类型
   * @returns {string} 标签颜色
   */
  const getActionColor = (action: string): string => {
    const colorMap: Record<string, string> = {
      SUBMIT: 'blue',
      APPROVE: 'green',
      REJECT: 'red',
      TRANSFER: 'orange',
    };
    return colorMap[action] || 'default';
  };

  /**
   * 获取操作中文描述
   * @description 将操作类型转换为中文描述
   * @param {string} action - 操作类型
   * @returns {string} 中文描述
   */
  const getActionLabel = (action: string): string => {
    const labelMap: Record<string, string> = {
      SUBMIT: '提交审批',
      APPROVE: '审批通过',
      REJECT: '审批拒绝',
      TRANSFER: '转交审批',
    };
    return labelMap[action] || action;
  };

  /**
   * 格式化时间戳
   * @description 将 ISO 时间字符串转换为可读格式
   * @param {string} timestamp - ISO 格式的时间戳
   * @returns {string} 格式化后的时间字符串
   */
  const formatTimestamp = (timestamp: string): string => {
    return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
  };

  /**
   * 渲染时间线项
   * @description 为每条审批记录生成时间线节点内容
   * @param {ApprovalRecord} record - 审批记录
   * @returns {React.ReactElement} 时间线节点组件
   */
  const renderTimelineItem = (record: ApprovalRecord): React.ReactElement => {
    return (
      <div className="timeline-item" data-testid="history-item">
        <div className="timeline-header">
          <Tag color={getActionColor(record.action)} icon={getActionIcon(record.action)}>
            {getActionLabel(record.action)}
          </Tag>
          <span className="timeline-time">{formatTimestamp(record.createdAt)}</span>
        </div>
        <div className="timeline-content">
          <div className="operator-info">
            <UserOutlined />
            <span className="operator-name">{record.operator}</span>
            <span className="operator-role">（{record.operatorRole}）</span>
          </div>
          {record.comment && (
            <div className="approval-comment" data-testid="approval-comment">
              审批意见：{record.comment}
            </div>
          )}
          {record.action === 'TRANSFER' && record.fromUser && record.toUser && (
            <div className="transfer-info">
              {record.fromUser} → {record.toUser}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="approval-history-loading" data-testid="loading-spinner">
        <Spin size="large" tip="加载审批历史..." />
      </div>
    );
  }

  return (
    <div className="approval-history-page" data-testid="approval-history-page">
      {/* 工单基本信息卡片 */}
      <Card title="工单信息" className="workorder-info-card" data-testid="workorder-info-card">
        {workOrderDetail ? (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="工单编号">{workOrderDetail.id}</Descriptions.Item>
            <Descriptions.Item label="工单标题">{workOrderDetail.title}</Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={workOrderDetail.status === 'PENDING' ? 'processing' : 'default'}>
                {workOrderDetail.status === 'PENDING' ? '待审批' : workOrderDetail.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="优先级">{workOrderDetail.priority}</Descriptions.Item>
            <Descriptions.Item label="提交人">{workOrderDetail.submitter}</Descriptions.Item>
            <Descriptions.Item label="提交时间">
              {formatTimestamp(workOrderDetail.submitTime)}
            </Descriptions.Item>
            <Descriptions.Item label="当前审批人" span={2}>
              {workOrderDetail.currentApprover || '暂无'}
            </Descriptions.Item>
            <Descriptions.Item label="工单描述" span={2}>
              {workOrderDetail.description}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="工单信息加载失败" />
        )}
      </Card>

      {/* 审批历史时间线卡片 */}
      <Card title="审批历史" className="approval-history-card" data-testid="history-card">
        <div data-testid="history-list">
          {approvalHistory.length > 0 ? (
            <Timeline mode="left" items={approvalHistory.map((record) => ({
              key: record.id,
              color: record.action === 'APPROVE' ? 'green' : record.action === 'REJECT' ? 'red' : 'blue',
              dot: getActionIcon(record.action),
              children: renderTimelineItem(record),
            }))} />
          ) : (
            <Empty description="暂无审批历史记录" data-testid="empty-history" />
          )}
        </div>
      </Card>

      {/* 操作按钮区域 */}
      <div className="action-buttons" data-testid="action-buttons">
        <Button onClick={() => window.history.back()} data-testid="btn-back">
          返回
        </Button>
        {workOrderDetail?.status === 'PENDING' && (
          <Button type="primary" data-testid="btn-approve">
            审批
          </Button>
        )}
      </div>
    </div>
  );
};

export default ApprovalHistoryPage;