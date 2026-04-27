/**
 * 资产报废申请页面
 * 
 * 功能说明：
 * - 用户可在此页面提交资产报废申请
 * - 关联目标资产及报废原因
 * - 提交后可跟踪审批进度
 * 
 * @module RetirementApplicationPage
 * @version 1.0.0
 * @author SWARM-002 Team
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Alert, 
  Button, 
  Card, 
  Col, 
  Form, 
  Input, 
  message, 
  Row, 
  Select, 
  Spin, 
  Steps, 
  Timeline, 
  Typography 
} from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined, 
  FileTextOutlined, 
  SaveOutlined, 
  SendOutlined 
} from '@ant-design/icons';
import type { 
  RetirementApplication, 
  RetirementStatus, 
  RetirementReason 
} from '@/types/retirement.types';
import { useApprovalPermission } from '@/composables/useApprovalPermission';
import { useRetirementApplication } from '@/hooks/useRetirementApplication';
import { useAssetSelection } from '@/hooks/useAssetSelection';
import { formatDateTime } from '@/utils/formatters';

/** 报废原因选项配置 */
const RETIREMENT_REASON_OPTIONS: Array<{
  value: RetirementReason;
  label: string;
  description: string;
}> = [
  {
    value: 'DAMAGED',
    label: '设备损坏',
    description: '设备因物理损坏无法修复'
  },
  {
    value: 'OBSOLETE',
    label: '技术落后',
    description: '设备技术过时，无法满足业务需求'
  },
  {
    value: 'EXPIRED',
    label: '使用期限到期',
    description: '设备已超过正常使用年限'
  },
  {
    value: 'MAINTENANCE_COST',
    label: '维护成本过高',
    description: '设备维护费用超出经济可行性'
  },
  {
    value: 'UPGRADE',
    label: '升级换代',
    description: '因系统/设备升级而退役'
  },
  {
    value: 'OTHER',
    label: '其他原因',
    description: '其他需要说明的原因'
  }
];

/** 状态步骤映射 */
const STATUS_STEPS: Record<RetirementStatus, { title: string; description: string }> = {
  DRAFT: { title: '草稿', description: '申请暂存中' },
  PENDING: { title: '审批中', description: '等待审批人处理' },
  APPROVED: { title: '已批准', description: '报废申请已通过' },
  REJECTED: { title: '已驳回', description: '报废申请未通过' }
};

/**
 * 资产报废申请页面组件
 * 
 * @description 提供报废申请表单、提交功能和审批进度跟踪
 */
const RetirementApplicationPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: applicationId } = useParams<{ id?: string }>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<RetirementApplication | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<Array<{
    approver: string;
    decision: string;
    comment: string;
    timestamp: string;
  }>>([]);

  // 使用自定义 Hooks 加载数据和权限
  const { canSubmit, canApprove } = useApprovalPermission();
  const { loadApplication, submitApplication, saveDraft, isLoading } = useRetirementApplication();
  const { assets, loadAvailableAssets, selectedAsset, setSelectedAsset } = useAssetSelection({
    statusFilter: ['IN_USE']
  });

  /**
   * 初始化加载
   */
  const initializePage = useCallback(async () => {
    setLoading(true);
    try {
      // 加载可选资产列表
      await loadAvailableAssets();
      
      // 如果是编辑模式，加载已有申请
      if (applicationId) {
        const appData = await loadApplication(applicationId);
        setApplication(appData);
        setApprovalHistory(appData.approvalHistory || []);
        
        // 填充表单
        form.setFieldsValue({
          assetId: appData.assetId,
          reason: appData.reason,
          description: appData.description,
          draft: appData.status === 'DRAFT'
        });
      }
    } catch (error) {
      message.error('加载数据失败');
      console.error('Initialization error:', error);
    } finally {
      setLoading(false);
    }
  }, [applicationId, form, loadApplication, loadAvailableAssets]);

  useEffect(() => {
    initializePage();
  }, [initializePage]);

  /**
   * 保存草稿
   */
  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const draftData: Partial<RetirementApplication> = {
        assetId: values.assetId,
        reason: values.reason,
        description: values.description,
        status: 'DRAFT' as RetirementStatus
      };

      if (applicationId) {
        await saveDraft(applicationId, draftData);
        message.success('草稿保存成功');
      } else {
        const newId = await saveDraft(null, draftData);
        message.success('草稿保存成功');
        navigate(`/retirement/${newId}/edit`, { replace: true });
      }
    } catch (error) {
      message.error('保存草稿失败');
      console.error('Save draft error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 提交申请
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (!values.assetId) {
        message.warning('请选择要报废的资产');
        return;
      }
      
      if (!values.reason) {
        message.warning('请选择报废原因');
        return;
      }

      if (!canSubmit()) {
        message.error('您没有权限提交报废申请');
        return;
      }

      setSubmitting(true);

      const applicationData: Omit<RetirementApplication, 'id' | 'createdAt' | 'updatedAt'> = {
        assetId: values.assetId,
        reason: values.reason,
        description: values.description || '',
        status: 'PENDING' as RetirementStatus,
        applicantId: '', // 后端会自动填充
        currentApproverId: ''
      };

      const result = await submitApplication(applicationData);
      
      message.success('报废申请提交成功');
      navigate(`/retirement/${result.id}/progress`);
    } catch (error) {
      message.error('提交申请失败，请重试');
      console.error('Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 获取当前步骤索引
   */
  const getCurrentStep = (): number => {
    if (!application) return 0;
    const statusOrder: RetirementStatus[] = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'];
    return statusOrder.indexOf(application.status);
  };

  /**
   * 渲染审批进度时间线
   */
  const renderApprovalTimeline = () => {
    if (approvalHistory.length === 0) {
      return (
        <Alert
          type="info"
          message="暂无审批记录"
          description="提交申请后，审批记录将显示在此处"
          showIcon
        />
      );
    }

    return (
      <Timeline mode="left">
        {approvalHistory.map((record, index) => (
          <Timeline.Item
            key={index}
            color={record.decision === 'APPROVED' ? 'green' : 'red'}
            dot={record.decision === 'APPROVED' 
              ? <CheckCircleOutlined /> 
              : record.decision === 'REJECTED'
              ? <CloseCircleOutlined />
              : <ClockCircleOutlined />
            }
          >
            <Card size="small" className="approval-record-card">
              <Row gutter={16}>
                <Col span={12}>
                  <Typography.Text strong>审批人：</Typography.Text>
                  <Typography.Text>{record.approver}</Typography.Text>
                </Col>
                <Col span={12}>
                  <Typography.Text strong>决定：</Typography.Text>
                  <Typography.Text type={record.decision === 'APPROVED' ? 'success' : 'danger'}>
                    {record.decision === 'APPROVED' ? '批准' : '驳回'}
                  </Typography.Text>
                </Col>
              </Row>
              {record.comment && (
                <div className="mt-2">
                  <Typography.Text type="secondary">意见：{record.comment}</Typography.Text>
                </div>
              )}
              <div className="mt-2">
                <Typography.Text type="secondary" className="text-xs">
                  {formatDateTime(record.timestamp)}
                </Typography.Text>
              </div>
            </Card>
          </Timeline.Item>
        ))}
      </Timeline>
    );
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  const isViewMode = application && application.status !== 'DRAFT';
  const isEditMode = application && application.status === 'DRAFT';

  return (
    <div className="retirement-application-page p-6">
      {/* 页面标题 */}
      <div className="page-header mb-6">
        <Typography.Title level={4}>
          <FileTextOutlined className="mr-2" />
          {applicationId 
            ? isViewMode 
              ? '报废申请详情' 
              : '编辑报废申请'
            : '新建报废申请'
          }
        </Typography.Title>
      </div>

      {/* 审批进度（仅查看模式） */}
      {isViewMode && application && (
        <Card className="mb-6">
          <Steps 
            current={getCurrentStep()} 
            items={Object.entries(STATUS_STEPS).map(([status, info]) => ({
              title: info.title,
              description: info.description,
              status: status === application.status ? 'process' : undefined
            }))}
          />
        </Card>
      )}

      <Row gutter={24}>
        {/* 左侧：申请表单 */}
        <Col span={isViewMode ? 16 : 24}>
          <Card 
            title="报废申请信息" 
            extra={
              !isViewMode && (
                <Button.Group>
                  <Button 
                    icon={<SaveOutlined />} 
                    onClick={handleSaveDraft}
                    loading={submitting}
                    disabled={!canSubmit()}
                  >
                    保存草稿
                  </Button>
                  <Button 
                    type="primary" 
                    icon={<SendOutlined />} 
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={!canSubmit()}
                  >
                    提交申请
                  </Button>
                </Button.Group>
              )
            }
          >
            <Form
              form={form}
              layout="vertical"
              disabled={isViewMode}
              requiredMark="optional"
            >
              <Form.Item
                name="assetId"
                label="选择资产"
                rules={[
                  { required: true, message: '请选择要报废的资产' },
                  { type: 'string', message: '资产ID格式不正确' }
                ]}
              >
                <Select
                  placeholder="请选择资产"
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  disabled={!!applicationId}
                  onChange={(value) => setSelectedAsset(value)}
                  options={assets.map(asset => ({
                    value: asset.id,
                    label: `${asset.assetCode} - ${asset.name}`,
                    status: asset.status
                  }))}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>

              {selectedAsset && (
                <Card size="small" className="mb-4 bg-gray-50">
                  <Row gutter={16}>
                    <Col span={8}>
                      <Typography.Text type="secondary">资产编号：</Typography.Text>
                      <Typography.Text strong>{selectedAsset.assetCode}</Typography.Text>
                    </Col>
                    <Col span={8}>
                      <Typography.Text type="secondary">资产名称：</Typography.Text>
                      <Typography.Text strong>{selectedAsset.name}</Typography.Text>
                    </Col>
                    <Col span={8}>
                      <Typography.Text type="secondary">当前状态：</Typography.Text>
                      <Typography.Text type="warning">{selectedAsset.status}</Typography.Text>
                    </Col>
                  </Row>
                </Card>
              )}

              <Form.Item
                name="reason"
                label="报废原因"
                rules={[{ required: true, message: '请选择报废原因' }}
              >
                <Select
                  placeholder="请选择报废原因"
                  options={RETIREMENT_REASON_OPTIONS.map(opt => ({
                    value: opt.value,
                    label: opt.label,
                    title: opt.description
                  }))}
                />
              </Form.Item>

              <Form.Item
                name="description"
                label="详细说明"
                tooltip="请详细描述资产报废的原因和情况"
              >
                <Input.TextArea
                  rows={4}
                  placeholder="请详细描述资产报废的原因、需要说明的情况..."
                  maxLength={500}
                  showCount
                />
              </Form.Item>

              {application && (
                <Form.Item label="申请状态">
                  <Select
                    value={application.status}
                    disabled
                    options={Object.entries(STATUS_STEPS).map(([value, info]) => ({
                      value,
                      label: info.title
                    }))}
                  />
                </Form.Item>
              )}
            </Form>
          </Card>
        </Col>

        {/* 右侧：审批历史（仅查看模式） */}
        {isViewMode && (
          <Col span={8}>
            <Card title="审批进度" className="approval-history-card">
              {renderApprovalTimeline()}
            </Card>
          </Col>
        )}
      </Row>

      {/* 操作按钮区域（查看模式） */}
      {isViewMode && (
        <Card className="mt-6">
          <Row justify="space-between">
            <Col>
              <Button onClick={() => navigate('/retirement/list')}>
                返回列表
              </Button>
            </Col>
            {isEditMode && canSubmit() && (
              <Col>
                <Button.Group>
                  <Button 
                    icon={<SaveOutlined />} 
                    onClick={handleSaveDraft}
                    loading={submitting}
                  >
                    保存草稿
                  </Button>
                  <Button 
                    type="primary" 
                    icon={<SendOutlined />} 
                    onClick={handleSubmit}
                    loading={submitting}
                  >
                    提交申请
                  </Button>
                </Button.Group>
              </Col>
            )}
            {application?.status === 'PENDING' && canApprove(application.currentApproverId) && (
              <Col>
                <Button.Group>
                  <Button type="primary" icon={<CheckCircleOutlined />}>
                    批准
                  </Button>
                  <Button danger icon={<CloseCircleOutlined />}>
                    驳回
                  </Button>
                </Button.Group>
              </Col>
            )}
          </Row>
        </Card>
      )}
    </div>
  );
};

export default RetirementApplicationPage;