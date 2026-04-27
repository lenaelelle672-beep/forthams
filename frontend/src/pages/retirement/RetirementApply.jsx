import React, { useState, useCallback } from 'react';
import {
  PageContainer,
  Card,
  CardMeta,
  CardDescription,
  CardHeader,
  CardContent,
  CardTitle,
  Form,
  FormField,
  Input,
  Select,
  DatePicker,
  Button,
  message,
  Tag,
  Timeline,
  Descriptions,
  Divider,
  Typography,
  Space,
  Spin,
  Alert,
} from 'antd';
import { useHistory, useParams } from 'react-router-dom';
import { useRetirementApp, useAssetRetirementFlow } from '@/hooks/useRetirementApp';
import { formatDate, statusTagColor } from '@/utils/formatters';
import styles from './RetirementApply.module.css';

const { Title, Text, Paragraph } = Typography;

/**
 * RetirementApply
 * - Create / view a retirement application for a single asset
 * - Asset status: normal -> pending_retirement -> retired (or normal if rejected/withdrawn)
 * - Approval chain: applicant -> admin/approver -> approved/rejected
 * - History timeline shows all state transitions and comments
 */
const RetirementApply = () => {
  const history = useHistory();
  const { id: assetId } = useParams();
  const { asset, loading, error: assetError } = useAssetRetirementFlow(assetId);

  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [action, setAction] = useState<'create' | 'approve' | 'reject' | 'view'>('view');

  const {
    createApplication,
    approveApplication,
    rejectApplication,
    withdrawApplication,
    application,
    applicationLoading,
    applicationError,
    history: historyData,
    refreshApplication,
  } = useRetirementApp(assetId);

  const handleCreate = useCallback(
    async (values) => {
      setSubmitting(true);
      try {
        const resp = await createApplication({
          reason: values.reason,
          expectedDate: values.expectedDate?.format('YYYY-MM-DD'),
        });
        message.success('报废申请已提交');
        setAction('view');
        await refreshApplication();
        form.resetFields();
      } catch (err) {
        message.error(err?.message || '提交失败');
      } finally {
        setSubmitting(false);
      }
    },
    [createApplication, refreshApplication, form]
  );

  const handleApprove = useCallback(
    async (comment) => {
      setApproveSubmitting(true);
      try {
        await approveApplication({ comment });
        message.success('审批通过');
        setAction('view');
        await refreshApplication();
      } catch (err) {
        message.error(err?.message || '审批失败');
      } finally {
        setApproveSubmitting(false);
      }
    },
    [approveApplication, refreshApplication]
  );

  const handleReject = useCallback(
    async (comment) => {
      setApproveSubmitting(true);
      try {
        await rejectApplication({ comment });
        message.success('审批驳回');
        setAction('view');
        await refreshApplication();
      } catch (err) {
        message.error(err?.message || '驳回失败');
      } finally {
        setApproveSubmitting(false);
      }
    },
    [rejectApplication, refreshApplication]
  );

  const handleWithdraw = useCallback(async () => {
    if (!application) return;
    setSubmitting(true);
    try {
      await withdrawApplication();
      message.success('申请已撤回');
      setAction('view');
      await refreshApplication();
    } catch (err) {
      message.error(err?.message || '撤回失败');
    } finally {
      setSubmitting(false);
    }
  }, [withdrawApplication, refreshApplication, application]);

  if (loading) {
    return (
      <PageContainer>
        <Spin size="large" />
      </PageContainer>
    );
  }

  if (assetError || !asset) {
    return (
      <PageContainer>
        <Alert type="error" message="无法加载资产信息" showIcon />
      </PageContainer>
    );
  }

  const canCreate =
    action === 'create' &&
    asset.status === 'normal' &&
    !application?.active;
  const canApprove = action === 'approve' && application?.status === 'pending' && !application?.approved;
  const canReject = action === 'approve' && application?.status === 'pending';
  const canWithdraw = application?.status === 'pending' && application?.applicantId === application?.applicantId;

  return (
    <PageContainer className={styles.container}>
      <Title level={2}>资产报废退役流程</Title>
      <Paragraph type="secondary">
        资产：<Text strong>{asset.assetCode}</Text> — {asset.name} | 部门：{asset.owningDepartment} | 当前状态：<Tag color={statusTagColor(asset.status)}>{asset.status}</Tag>
      </Paragraph>

      <Divider />

      {/* 操作栏 */}
      <Card className={styles.actionCard} size="small">
        <Space>
          {canCreate && (
            <Button type="primary" onClick={() => setAction('create')}>
              提交报废申请
            </Button>
          )}
          {canApprove && (
            <>
              <Button onClick={() => setAction('approve')}>审批通过</Button>
              <Button danger onClick={() => setAction('reject')}>审批驳回</Button>
            </>
          )}
          {canWithdraw && (
            <Button onClick={handleWithdraw}>撤回申请</Button>
          )}
          <Button onClick={() => setAction('view')}>查看详情</Button>
          <Button onClick={() => history.goBack()}>返回</Button>
        </Space>
      </Card>

      <Divider />

      {/* 申请表单 */}
      {action === 'create' && canCreate && (
        <Card title="提交报废申请" className={styles.formCard}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreate}
            initialValues={{ expectedDate: null }}
          >
            <FormField
              name="reason"
              label="报废原因"
              rules={[{ required: true, message: '请输入报废原因' }]}
              required
            >
              <Input.TextArea rows={4} placeholder="请详细描述报废原因" />
            </FormField>
            <FormField
              name="expectedDate"
              label="期望退役日期"
              rules={[{ required: true, message: '请选择期望退役日期' }]}
              required
            >
              <DatePicker style={{ width: '100%' }} disabledDate={(current) => current && current < new Date()} />
            </FormField>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                提交申请
              </Button>
              <Button onClick={() => setAction('view')}>取消</Button>
            </Space>
          </Form>
        </Card>
      )}

      {/* 审批面板 */}
      {action === 'approve' && application && (
        <Card title="审批申请" className={styles.formCard}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="资产">{application.assetCode}</Descriptions.Item>
            <Descriptions.Item label="申请人">{application.applicantName}</Descriptions.Item>
            <Descriptions.Item label="申请时间">{formatDate(application.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="期望退役日期">{formatDate(application.expectedDate)}</Descriptions.Item>
            <Descriptions.Item label="原因">{application.reason}</Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={statusTagColor(application.status)}>{application.status}</Tag>
            </Descriptions.Item>
          </Descriptions>
          <Divider />
          <Space>
            <Button type="primary" danger loading={approveSubmitting} onClick={() => handleApprove('已批准，资产将退役')}>
              审批通过
            </Button>
            <Button danger loading={approveSubmitting} onClick={() => handleReject('不符合退役条件，请重新评估')}>
              审批驳回
            </Button>
          </Space>
        </Card>
      )}

      {/* 申请详情 */}
      {(action === 'view' || !action) && application && (
        <Card title="申请详情" className={styles.detailCard}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="资产">{application.assetCode}</Descriptions.Item>
            <Descriptions.Item label="申请人">{application.applicantName}</Descriptions.Item>
            <Descriptions.Item label="申请时间">{formatDate(application.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="期望退役日期">{formatDate(application.expectedDate)}</Descriptions.Item>
            <Descriptions.Item label="原因">
              <Paragraph copyable>{application.reason}</Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={statusTagColor(application.status)}>{application.status}</Tag>
            </Descriptions.Item>
            {application.approvalComment && (
              <Descriptions.Item label="审批备注">
                <Alert message={application.approvalComment} type="info" showIcon />
              </Descriptions.Item>
            )}
          </Descriptions>

          <Divider />

          {/* 审核历史 */}
          <Title level={5}>审核历史</Title>
          <Timeline
            items={(historyData || []).map((h) => ({
              color: h.action === 'approved' ? 'green' : h.action === 'rejected' ? 'red' : 'blue',
              dot: h.action === 'approved' ? <CheckCircleOutlined /> : h.action === 'rejected' ? <CloseCircleOutlined /> : <ClockCircleOutlined />,
              children: (
                <>
                  <Text strong>{h.action === 'approved' ? '审批通过' : h.action === 'rejected' ? '审批驳回' : h.action === 'withdrawn' ? '申请撤回' : '申请创建'}</Text>
                  <br />
                  <Text type="secondary">{formatDate(h.createdAt)}</Text>
                  {h.performedByName && <br />}
                  {h.performedByName && <Text type="secondary">操作人：{h.performedByName}</Text>}
                  {h.comment && (
                    <>
                      <br />
                      <Text type="secondary">备注：{h.comment}</Text>
                    </>
                  )}
                </>
              ),
            }))}
          />
        </Card>
      )}

      {/* 错误提示 */}
      {applicationError && <Alert type="error" message={applicationError} showIcon style={{ marginTop: 16 }} />}
    </PageContainer>
  );
};

export default RetirementApply;