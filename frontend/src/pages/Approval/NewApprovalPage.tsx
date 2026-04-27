/**
 * 新建审批申请页面 (NewApprovalPage)
 * 
 * 功能说明：
 * - 用户可在此页面发起新的审批申请
 * - 选择工单类型、配置审批层级、填写审批理由
 * - 提交后自动流转至首级审批人
 * 
 * @module pages/Approval/NewApprovalPage
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Card, 
  Form, 
  Input, 
  Select, 
  Button, 
  Space, 
  Typography,
  Divider,
  message,
  Spin,
  DatePicker
} from 'antd';
import { 
  PlusOutlined, 
  SaveOutlined, 
  CloseOutlined,
  UserAddOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { 
  ApprovalType, 
  ApprovalLevel, 
  ApprovalStatus,
  WorkOrderApprovalRequest 
} from '../../types/approval';
import { getWorkOrdersForApproval } from '../../services/approvalService';
import { getCurrentUser } from '../../services/userService';

import styles from './NewApprovalPage.module.css';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

/**
 * 审批类型选项配置
 */
const APPROVAL_TYPE_OPTIONS: Array<{ value: ApprovalType; label: string; description: string }> = [
  { 
    value: 'EXPENSE', 
    label: '费用审批', 
    description: '用于部门或个人费用支出申请' 
  },
  { 
    value: 'PURCHASE', 
    label: '采购审批', 
    description: '用于资产或物资采购申请' 
  },
  { 
    value: 'TRANSFER', 
    label: '资产转移审批', 
    description: '用于资产跨部门调拨申请' 
  },
  { 
    value: 'RETIREMENT', 
    label: '资产退役审批', 
    description: '用于资产退役或报废申请' 
  },
  { 
    value: 'LEAVE', 
    label: '请假审批', 
    description: '用于员工请假申请' 
  },
  { 
    value: 'OVERTIME', 
    label: '加班审批', 
    description: '用于员工加班申请' 
  },
];

/**
 * 审批层级配置默认值
 */
const DEFAULT_APPROVAL_LEVELS: ApprovalLevel[] = [
  { sequence: 1, approver_id: 0, approver_name: '' },
];

/**
 * NewApprovalPage 组件属性
 */
interface NewApprovalPageProps {
  /** 工作流 ID（可选，用于编辑已有申请） */
  workflowId?: string;
  /** 关联的工单 ID（可选） */
  workOrderId?: string;
  /** 审批类型预填充（可选） */
  presetApprovalType?: ApprovalType;
  /** 提交成功后的回调 */
  onSuccess?: (approvalId: string) => void;
  /** 取消操作的回调 */
  onCancel?: () => void;
}

/**
 * 新建审批申请页面组件
 * 
 * 功能流程：
 * 1. 用户选择审批类型
 * 2. 用户选择关联工单（可选）
 * 3. 用户配置审批层级（至少一级）
 * 4. 用户填写审批理由
 * 5. 用户提交申请
 * 
 * @param props - 组件属性
 * @returns 审批申请表单页面
 */
const NewApprovalPage: React.FC<NewApprovalPageProps> = ({
  workflowId,
  workOrderId,
  presetApprovalType,
  onSuccess,
  onCancel,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // 组件状态
  const [approvalType, setApprovalType] = useState<ApprovalType | null>(presetApprovalType || null);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string>(workOrderId || '');
  const [approvalLevels, setApprovalLevels] = useState<ApprovalLevel[]>(DEFAULT_APPROVAL_LEVELS);
  const [reason, setReason] = useState<string>('');
  const [expectedDate, setExpectedDate] = useState<dayjs.Dayjs | null>(null);
  const [urgent, setUrgent] = useState<boolean>(false);
  
  // 加载状态
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [workOrdersLoading, setWorkOrdersLoading] = useState<boolean>(false);
  
  // 可选的工作订单列表
  const [workOrders, setWorkOrders] = useState<Array<{ id: string; title: string }>>([]);
  
  // 可选的审批人列表（模拟数据，实际应从 API 获取）
  const [approvers, setApprovers] = useState<Array<{ id: number; name: string; department: string }>>([
    { id: 101, name: '张三', department: '技术部' },
    { id: 102, name: '李四', department: '财务部' },
    { id: 103, name: '王五', department: '行政部' },
    { id: 104, name: '赵六', department: '管理层' },
  ]);

  /**
   * 加载可选的工作订单列表
   */
  const loadWorkOrders = useCallback(async () => {
    if (!approvalType) return;
    
    setWorkOrdersLoading(true);
    try {
      const orders = await getWorkOrdersForApproval(approvalType);
      setWorkOrders(orders);
    } catch (error) {
      console.error('加载工作订单列表失败:', error);
      message.error('加载工作订单列表失败');
    } finally {
      setWorkOrdersLoading(false);
    }
  }, [approvalType]);

  /**
   * 初始化数据
   */
  useEffect(() => {
    if (presetApprovalType) {
      setApprovalType(presetApprovalType);
    }
    loadWorkOrders();
  }, [presetApprovalType, loadWorkOrders]);

  /**
   * 处理审批类型变更
   */
  const handleApprovalTypeChange = (value: ApprovalType) => {
    setApprovalType(value);
    setSelectedWorkOrderId('');
    setWorkOrders([]);
    form.setFieldsValue({ workOrderId: undefined });
  };

  /**
   * 添加审批层级
   */
  const handleAddApprovalLevel = () => {
    if (approvalLevels.length >= 5) {
      message.warning('最多支持 5 级审批');
      return;
    }
    
    const newLevel: ApprovalLevel = {
      sequence: approvalLevels.length + 1,
      approver_id: 0,
      approver_name: '',
    };
    
    setApprovalLevels([...approvalLevels, newLevel]);
  };

  /**
   * 移除审批层级
   */
  const handleRemoveApprovalLevel = (index: number) => {
    if (approvalLevels.length <= 1) {
      message.warning('至少需要保留一级审批');
      return;
    }
    
    const updatedLevels = approvalLevels.filter((_, i) => i !== index);
    // 重新排序
    const reorderedLevels = updatedLevels.map((level, i) => ({
      ...level,
      sequence: i + 1,
    }));
    setApprovalLevels(reorderedLevels);
  };

  /**
   * 更新审批层级
   */
  const handleUpdateApprovalLevel = (index: number, field: keyof ApprovalLevel, value: unknown) => {
    const updatedLevels = [...approvalLevels];
    if (field === 'approver_id') {
      const selectedApprover = approvers.find(a => a.id === value);
      updatedLevels[index] = {
        ...updatedLevels[index],
        approver_id: value as number,
        approver_name: selectedApprover?.name || '',
      };
    } else {
      (updatedLevels[index] as Record<string, unknown>)[field] = value;
    }
    setApprovalLevels(updatedLevels);
  };

  /**
   * 验证表单数据
   */
  const validateForm = (): boolean => {
    if (!approvalType) {
      message.warning('请选择审批类型');
      return false;
    }

    if (approvalLevels.length === 0) {
      message.warning('请至少配置一级审批');
      return false;
    }

    for (const level of approvalLevels) {
      if (!level.approver_id || level.approver_id === 0) {
        message.warning(`第 ${level.sequence} 级审批人未选择`);
        return false;
      }
    }

    if (!reason.trim()) {
      message.warning('请填写审批理由');
      return false;
    }

    if (reason.length > 500) {
      message.warning('审批理由不能超过 500 个字符');
      return false;
    }

    return true;
  };

  /**
   * 提交审批申请
   */
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const currentUser = await getCurrentUser();
      
      const requestData: WorkOrderApprovalRequest = {
        work_order_id: selectedWorkOrderId ? parseInt(selectedWorkOrderId, 10) : 0,
        approval_type: approvalType!,
        levels: approvalLevels.map(level => ({
          approver_id: level.approver_id,
          approver_name: level.approver_name,
          sequence: level.sequence,
        })),
        reason: reason.trim(),
        expected_date: expectedDate ? expectedDate.format('YYYY-MM-DD') : undefined,
        urgent: urgent,
      };

      // 调用后端 API 创建审批申请
      const response = await fetch('/api/v1/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`审批申请提交失败: ${response.status}`);
      }

      const result = await response.json();
      
      message.success('审批申请已提交');
      
      if (onSuccess) {
        onSuccess(result.approval_id);
      } else {
        navigate(`/approvals/${result.approval_id}`);
      }
    } catch (error) {
      console.error('提交审批申请失败:', error);
      message.error('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 处理取消操作
   */
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  /**
   * 处理重置表单
   */
  const handleReset = () => {
    form.resetFields();
    setApprovalType(null);
    setSelectedWorkOrderId('');
    setApprovalLevels(DEFAULT_APPROVAL_LEVELS);
    setReason('');
    setExpectedDate(null);
    setUrgent(false);
    message.info('表单已重置');
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <Title level={4} className={styles.title}>
            <FileTextOutlined className={styles.titleIcon} />
            {t('approval.new.title', '新建审批申请')}
          </Title>
          <Text type="secondary" className={styles.subtitle}>
            {t('approval.new.subtitle', '填写以下信息发起新的审批流程')}
          </Text>
        </div>

        <Divider />

        <Form
          form={form}
          layout="vertical"
          className={styles.form}
          initialValues={{
            approvalType: presetApprovalType,
            workOrderId: workOrderId,
          }}
        >
          {/* 审批类型 */}
          <Form.Item
            name="approvalType"
            label={t('approval.field.type', '审批类型')}
            rules={[{ required: true, message: '请选择审批类型' }]}
          >
            <Select
              placeholder={t('approval.placeholder.selectType', '请选择审批类型')}
              size="large"
              onChange={handleApprovalTypeChange}
              disabled={!!presetApprovalType}
            >
              {APPROVAL_TYPE_OPTIONS.map(option => (
                <Option key={option.value} value={option.value}>
                  <div>
                    <div>{option.label}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {option.description}
                    </Text>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* 关联工作订单（可选） */}
          {approvalType && (
            <Form.Item
              name="workOrderId"
              label={t('approval.field.workOrder', '关联工作订单')}
              extra={t('approval.field.workOrderExtra', '可选 - 关联已有的工作订单')}
            >
              <Select
                placeholder={t('approval.placeholder.selectWorkOrder', '请选择关联的工作订单')}
                size="large"
                allowClear
                showSearch
                optionFilterProp="children"
                loading={workOrdersLoading}
                onChange={(value) => setSelectedWorkOrderId(value || '')}
                filterInputValue={selectedWorkOrderId}
              >
                {workOrders.map(order => (
                  <Option key={order.id} value={order.id}>
                    {order.title}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Divider>{t('approval.section.approvers', '审批层级配置')}</Divider>

          {/* 审批层级配置 */}
          <div className={styles.approvalLevels}>
            {approvalLevels.map((level, index) => (
              <Card 
                key={`level-${index}`} 
                size="small" 
                className={styles.levelCard}
              >
                <Space align="start" size="large" style={{ width: '100%' }}>
                  <div className={styles.levelBadge}>
                    {t('approval.level', '第 {{n}} 级', { n: level.sequence })}
                  </div>
                  
                  <Form.Item
                    label={t('approval.field.approver', '审批人')}
                    required
                    style={{ marginBottom: 0, minWidth: 200 }}
                  >
                    <Select
                      placeholder={t('approval.placeholder.selectApprover', '选择审批人')}
                      value={level.approver_id || undefined}
                      onChange={(value) => handleUpdateApprovalLevel(index, 'approver_id', value)}
                      size="middle"
                    >
                      {approvers.map(approver => (
                        <Option 
                          key={approver.id} 
                          value={approver.id}
                          disabled={approvalLevels.some(l => l.approver_id === approver.id)}
                        >
                          {approver.name} ({approver.department})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Button
                    type="text"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => handleRemoveApprovalLevel(index)}
                    disabled={approvalLevels.length <= 1}
                  >
                    {t('common.remove', '移除')}
                  </Button>
                </Space>
              </Card>
            ))}

            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddApprovalLevel}
              className={styles.addLevelButton}
              block
            >
              {t('approval.action.addLevel', '添加审批层级')}
            </Button>
          </div>

          <Divider>{t('approval.section.details', '申请详情')}</Divider>

          {/* 审批理由 */}
          <Form.Item
            label={t('approval.field.reason', '审批理由')}
            required
            extra={t('approval.field.reasonExtra', '请详细描述申请原因，不超过 500 个字符')}
          >
            <TextArea
              rows={4}
              placeholder={t('approval.placeholder.reason', '请输入审批理由...')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              showCount
            />
          </Form.Item>

          {/* 期望完成日期 */}
          <Form.Item
            label={t('approval.field.expectedDate', '期望完成日期')}
            extra={t('approval.field.expectedDateExtra', '可选 - 设置期望的审批完成时间')}
          >
            <DatePicker
              style={{ width: '100%' }}
              size="large"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
              value={expectedDate}
              onChange={setExpectedDate}
              format="YYYY-MM-DD"
            />
          </Form.Item>

          {/* 加急标识 */}
          <Form.Item
            label={t('approval.field.urgent', '加急处理')}
          >
            <Space>
              <Button
                type={urgent ? 'primary' : 'default'}
                onClick={() => setUrgent(!urgent)}
              >
                {urgent ? '✓ 已加急' : '普通'}
              </Button>
              <Text type="secondary">
                {t('approval.field.urgentHint', '加急审批将优先处理')}
              </Text>
            </Space>
          </Form.Item>
        </Form>

        <Divider />

        {/* 操作按钮 */}
        <div className={styles.actions}>
          <Space size="large">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={handleSubmit}
              size="large"
            >
              {t('approval.action.submit', '提交审批')}
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={handleCancel}
              size="large"
            >
              {t('common.cancel', '取消')}
            </Button>
            <Button
              onClick={handleReset}
              size="large"
            >
              {t('common.reset', '重置')}
            </Button>
          </Space>
        </div>
      </Card>

      {/* 加载状态 */}
      {loading && (
        <div className={styles.loadingOverlay}>
          <Spin size="large" tip={t('common.loading', '加载中...')} />
        </div>
      )}
    </div>
  );
};

export default NewApprovalPage;