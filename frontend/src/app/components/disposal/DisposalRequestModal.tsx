/**
 * DisposalRequestModal Component
 *
 * 资产报废/退役申请模态框 — 受控组件模式
 * 管理内部步骤状态（form → confirm），集成表单控件与 API 调用。
 *
 * 关键约束：
 * - 关闭时彻底卸载或重置内部状态，防止脏数据残留
 * - 确认步骤展示的数据必须是提交前的最终快照（不可直接引用动态绑定值）
 * - 封装 API 调用逻辑：处理 200 OK、403 Forbidden、409 Conflict 等状态码
 *
 * @module components/disposal/DisposalRequestModal
 * @requires react, antd
 * @requires DisposalConfirmationStep
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Steps,
  Button,
  Space,
  message,
  Spin,
} from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import DisposalConfirmationStep from './DisposalConfirmationStep';
import type { DisposalConfirmationStepProps } from './DisposalConfirmationStep';

/**
 * 内部步骤类型
 */
type StepType = 'form' | 'confirm';

/**
 * 报废申请表单值接口
 */
export interface DisposalFormValues {
  /** 报废原因 */
  reason: string;
  /** 报废类型 */
  retirementType: string;
  /** 估计残值 */
  estimatedResidualValue?: number;
  /** 备注 */
  remark?: string;
}

/**
 * DisposalRequestModal 组件属性接口
 *
 * 采用受控组件模式：visible 和 onClose 由父组件控制，
 * 内部状态在关闭时彻底重置。
 *
 * @interface DisposalRequestModalProps
 * @property {boolean} visible - Modal 可见性（受控）
 * @property {function} onClose - 关闭回调
 * @property {function} [onSuccess] - 提交成功回调
 * @property {string|number} assetId - 资产 ID
 * @property {string} assetNo - 资产编号
 * @property {string} assetName - 资产名称
 * @property {string} [assetStatus] - 资产当前状态
 * @property {string} [data-testid] - 测试标识
 */
export interface DisposalRequestModalProps {
  /** Modal 可见性（受控） */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 提交成功回调 */
  onSuccess?: () => void;
  /** 资产 ID */
  assetId: string | number;
  /** 资产编号 */
  assetNo: string;
  /** 资产名称 */
  assetName: string;
  /** 资产当前状态 */
  assetStatus?: string;
  /** data-testid */
  'data-testid'?: string;
}

/** 原因最大长度约束 */
const REASON_MAX_LENGTH = 500;

/** 报废类型选项 */
const RETIREMENT_TYPE_OPTIONS = [
  { value: 'SCRAP', label: '报废' },
  { value: 'RETIREMENT', label: '退役' },
];

/**
 * 根据错误状态码生成用户友好提示
 *
 * @param {unknown} error - 错误对象
 * @returns {string} 友好错误提示文案
 */
function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: unknown }).message);
    // 409 Conflict — 并发申请互斥
    if (msg.includes('409') || msg.includes('Conflict') || msg.includes('已存在')) {
      return '该资产已存在正在审批中的报废申请，请勿重复提交';
    }
    // 403 Forbidden — 跨租户或无权限
    if (msg.includes('403') || msg.includes('Forbidden') || msg.includes('权限')) {
      return '您无权对该资产发起报废申请';
    }
    // 网络异常
    if (msg.includes('Network Error') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return '网络连接异常，请检查网络后重试';
    }
    // 其他错误 — 返回原始消息
    return msg;
  }
  return '提交报废申请失败，请稍后重试';
}

/**
 * DisposalRequestModal — 资产报废/退役申请模态框
 *
 * 两步式流程：
 * 1. 表单步骤 (form)：收集报废原因、类型、残值等
 * 2. 确认步骤 (confirm)：展示只读快照，防误触校验
 *
 * 受控组件模式：visible/onClose 由父组件管理，关闭时内部状态完全重置。
 *
 * @param {DisposalRequestModalProps} props - 组件属性
 * @returns {JSX.Element} 报废申请模态框
 *
 * @example
 * ```tsx
 * <DisposalRequestModal
 *   visible={modalVisible}
 *   onClose={() => setModalVisible(false)}
 *   onSuccess={() => { message.success('提交成功'); }}
 *   assetId={asset.id}
 *   assetNo={asset.assetCode}
 *   assetName={asset.name}
 * />
 * ```
 */
const DisposalRequestModal: React.FC<DisposalRequestModalProps> = ({
  visible,
  onClose,
  onSuccess,
  assetId,
  assetNo,
  assetName,
  assetStatus,
  'data-testid': testId,
}) => {
  /** 内部步骤状态 */
  const [currentStep, setCurrentStep] = useState<StepType>('form');
  /** 提交 loading */
  const [submitting, setSubmitting] = useState(false);
  /** 错误信息 */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** 确认步骤的快照数据（从表单数据冻结而来） */
  const [confirmSnapshot, setConfirmSnapshot] = useState<DisposalFormValues | null>(null);

  const [form] = Form.useForm<DisposalFormValues>();

  /**
   * 步骤索引映射
   */
  const stepIndex = currentStep === 'form' ? 0 : 1;

  /**
   * 重置所有内部状态
   * 在关闭时调用，确保无脏数据残留
   */
  const resetState = useCallback(() => {
    setCurrentStep('form');
    setSubmitting(false);
    setErrorMessage(null);
    setConfirmSnapshot(null);
    form.resetFields();
  }, [form]);

  /**
   * 处理关闭操作
   * 如果正在提交中，阻止关闭（防止中断请求）
   */
  const handleClose = useCallback(() => {
    if (submitting) return;
    resetState();
    onClose();
  }, [submitting, resetState, onClose]);

  /**
   * 处理表单"下一步"操作
   * 校验通过后冻结表单数据为快照，进入确认步骤
   */
  const handleNext = useCallback(async () => {
    try {
      setErrorMessage(null);
      const values = await form.validateFields();
      // 冻结快照 — 确认步骤引用此快照而非动态表单值
      setConfirmSnapshot({ ...values });
      setCurrentStep('confirm');
    } catch {
      // 表单校验失败，antd 会自动展示字段级错误
    }
  }, [form]);

  /**
   * 处理"返回上一步"操作
   * 从确认步骤返回表单步骤，保留表单数据
   */
  const handleBack = useCallback(() => {
    setErrorMessage(null);
    setCurrentStep('form');
  }, []);

  /**
   * 提交报废申请
   * 调用后端 POST /api/v1/retirement/apply 接口
   * 处理 200 OK / 403 Forbidden / 409 Conflict / 网络异常
   */
  const handleSubmit = useCallback(async () => {
    if (!confirmSnapshot) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      // 构建请求体 — 必须包含 assetId
      const requestBody = {
        assetId: Number(assetId),
        reason: confirmSnapshot.reason,
        retirementType: confirmSnapshot.retirementType || 'SCRAP',
        estimatedResidualValue: confirmSnapshot.estimatedResidualValue ?? 0,
        remark: confirmSnapshot.remark,
      };

      const response = await fetch('/api/v1/retirement/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // 处理 HTTP 错误状态码
      if (!response.ok) {
        let errorMsg = `请求失败 (${response.status})`;
        try {
          const errorBody = await response.json();
          if (errorBody?.message) {
            errorMsg = errorBody.message;
          }
        } catch {
          // 响应体非 JSON
        }

        // 409 Conflict — 并发申请互斥
        if (response.status === 409) {
          setErrorMessage('该资产已存在正在审批中的报废申请，请勿重复提交');
          return;
        }
        // 403 Forbidden — 跨租户或无权限
        if (response.status === 403) {
          setErrorMessage('您无权对该资产发起报废申请');
          return;
        }

        setErrorMessage(errorMsg);
        return;
      }

      // 提交成功
      const result = await response.json();
      resetState();
      message.success('报废申请提交成功，等待审批');
      onSuccess?.();
    } catch (error) {
      // 网络异常处理
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [confirmSnapshot, assetId, resetState, onSuccess]);

  /**
   * Modal 底部按钮
   */
  const footerButtons = useMemo(() => {
    if (currentStep === 'form') {
      return (
        <Space>
          <Button onClick={handleClose} disabled={submitting} data-testid="disposal-modal-cancel">
            取消
          </Button>
          <Button type="primary" onClick={handleNext} data-testid="disposal-modal-next">
            下一步
          </Button>
        </Space>
      );
    }

    // confirm 步骤
    return (
      <Space>
        <Button onClick={handleBack} disabled={submitting} data-testid="disposal-modal-back">
          上一步
        </Button>
        <Button onClick={handleClose} disabled={submitting} data-testid="disposal-modal-cancel-confirm">
          取消
        </Button>
        <Button
          type="primary"
          danger
          onClick={handleSubmit}
          loading={submitting}
          data-testid="disposal-modal-submit"
        >
          确认提交
        </Button>
      </Space>
    );
  }, [currentStep, submitting, handleClose, handleNext, handleBack, handleSubmit]);

  return (
    <Modal
      title="发起报废/退役申请"
      open={visible}
      onCancel={handleClose}
      footer={footerButtons}
      destroyOnClose
      maskClosable={!submitting}
      closable={!submitting}
      width={600}
      data-testid={testId || 'disposal-request-modal'}
    >
      {/* 步骤指示器 */}
      <Steps
        current={stepIndex}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: '填写信息' },
          { title: '确认提交' },
        ]}
      />

      {/* 提交中全局 loading */}
      {submitting && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin tip="正在提交报废申请..." data-testid="disposal-submitting-spin">
            <div style={{ minHeight: 60 }} />
          </Spin>
        </div>
      )}

      {/* 步骤一：表单 */}
      {currentStep === 'form' && (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            retirementType: 'SCRAP',
          }}
          data-testid="disposal-form"
        >
          <Form.Item
            name="retirementType"
            label="报废类型"
            rules={[{ required: true, message: '请选择报废类型' }]}
          >
            <Select options={RETIREMENT_TYPE_OPTIONS} placeholder="请选择报废类型" />
          </Form.Item>

          <Form.Item
            name="reason"
            label="报废原因"
            rules={[
              { required: true, message: '请填写报废原因' },
              { max: REASON_MAX_LENGTH, message: `报废原因不能超过 ${REASON_MAX_LENGTH} 个字符` },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={REASON_MAX_LENGTH}
              showCount
              placeholder="请详细描述报废原因"
              data-testid="disposal-reason-input"
            />
          </Form.Item>

          <Form.Item
            name="estimatedResidualValue"
            label="估计残值（元）"
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入估计残值"
              data-testid="disposal-residual-value-input"
            />
          </Form.Item>

          <Form.Item
            name="remark"
            label="备注"
          >
            <Input.TextArea
              rows={2}
              maxLength={200}
              showCount
              placeholder="备注信息（选填）"
              data-testid="disposal-remark-input"
            />
          </Form.Item>
        </Form>
      )}

      {/* 步骤二：确认快照 */}
      {currentStep === 'confirm' && confirmSnapshot && !submitting && (
        <DisposalConfirmationStep
          assetNo={assetNo}
          assetName={assetName}
          reason={confirmSnapshot.reason}
          retirementType={confirmSnapshot.retirementType}
          estimatedResidualValue={confirmSnapshot.estimatedResidualValue}
          onConfirm={handleSubmit}
          onBack={handleBack}
          submitting={submitting}
          errorMessage={errorMessage}
        />
      )}

      {/* 确认步骤中的错误信息（提交失败后额外展示） */}
      {currentStep === 'confirm' && errorMessage && !submitting && (
        <></>
      )}
    </Modal>
  );
};

export default DisposalRequestModal;
