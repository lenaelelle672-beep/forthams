import React, { useCallback, useRef, useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import ScopeSelector from './ScopeSelector';
import { createTask } from '@/api/inventory';
import type { ScopeType } from '@/types/inventory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 盘点范围值类型，与 ScopeSelector 组件的 value/onChange 契约一致 */
interface ScopeValue {
  scopeType: ScopeType;
  scopeIds: string[];
}

/** 新建盘点任务表单值 */
interface TaskFormValues {
  taskName: string;
  scope: ScopeValue;
}

/** 新建盘点任务弹窗组件属性 */
export interface CreateTaskModalProps {
  /** 弹窗是否可见 */
  open: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 创建成功回调，参数为新建任务的 ID */
  onSuccess: (taskId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 判断捕获的错误是否为 Ant Design 表单校验错误
 *
 * Ant Design 的 form.validateFields() 校验失败时会抛出包含 errorFields
 * 属性的对象，以此与网络/业务错误区分。
 *
 * @param error - catch 块中捕获的错误
 * @returns 如果是表单校验错误返回 true
 */
function isFormValidationError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errorFields' in error
  );
}

/**
 * 从未知错误中提取人类可读的消息文本
 *
 * @param error - catch 块中捕获的错误
 * @returns 格式化的错误消息字符串
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || '创建盘点任务失败，请重试';
  }
  if (typeof error === 'string') {
    return error;
  }
  return '创建盘点任务失败，请重试';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * 新建盘点任务弹窗组件 (P3-010-B)
 *
 * 提供任务名称输入和盘点范围选择（按位置树 / 按分类树 / 全部资产），
 * 创建成功后通过 onSuccess 回调将新任务 ID 传递给父组件。
 *
 * 关键特性：
 * - 表单校验：任务名称 1–50 字符必填；scopeType 非 all 时 scopeIds 至少 1 项
 * - 防重复提交：按钮 confirmLoading + submittingRef 双重守卫
 * - destroyOnClose：弹窗关闭时自动销毁内容，避免状态残留
 */
const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  /**
   * 使用 ref 配合 state 实现防重复提交。
   *
   * React 18 的自动批处理可能导致在 setSubmitting(true) 生效前
   * 用户快速二次点击仍然通过 submitting === false 的检查；
   * ref 的赋值是同步的，可覆盖这一竞态窗口。
   */
  const submittingRef = useRef(false);

  /**
   * 处理"确定"按钮点击
   *
   * 流程：防重复检查 → 表单校验 → 锁定提交 → API 请求 → 成功通知 → 关闭
   *
   * submittingRef 在 validateFields 之后、异步请求之前锁定，
   * 确保快速连击仅发出一次 POST 请求。
   */
  const handleOk = useCallback(async () => {
    // 防重复提交守卫
    if (submittingRef.current) return;

    try {
      const values = (await form.validateFields()) as TaskFormValues;

      // 校验通过后才锁定，避免校验失败时也进入 loading
      submittingRef.current = true;
      setSubmitting(true);

      const result = await createTask({
        taskName: values.taskName.trim(),
        scopeType: values.scope.scopeType,
        scopeIds: values.scope.scopeIds,
      });

      message.success('盘点任务创建成功');
      onSuccess(result.taskId);
      onClose();
    } catch (error: unknown) {
      if (isFormValidationError(error)) {
        // Ant Design 表单校验错误，UI 已自动标红，无需额外处理
        return;
      }
      message.error(getErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [form, onSuccess, onClose]);

  /**
   * 处理"取消"按钮点击
   *
   * 提交期间禁止关闭，防止中断请求。
   * destroyOnClose 确保下次打开时表单状态干净。
   */
  const handleCancel = useCallback(() => {
    if (submittingRef.current) return;
    onClose();
  }, [onClose]);

  return (
    <Modal
      title="新建盘点任务"
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      okText="确定"
      cancelText="取消"
      destroyOnClose
      width={680}
      maskClosable={!submitting}
      aria-label="新建盘点任务弹窗"
    >
      <Form form={form} layout="vertical" autoComplete="off">
        {/* ── 任务名称 ── */}
        <Form.Item
          name="taskName"
          label="任务名称"
          rules={[
            { required: true, message: '请输入任务名称' },
            { whitespace: true, message: '任务名称不能为空白字符' },
            { max: 50, message: '任务名称不能超过50个字符' },
          ]}
        >
          <Input
            placeholder="请输入盘点任务名称"
            maxLength={50}
            showCount
            aria-label="任务名称"
          />
        </Form.Item>

        {/* ── 盘点范围选择器 ── */}
        <Form.Item
          name="scope"
          label="盘点范围"
          initialValue={
            { scopeType: 'location' as ScopeType, scopeIds: [] as string[] }
          }
          rules={[
            {
              validator: (
                _rule: unknown,
                value: ScopeValue,
              ) => {
                if (!value || !value.scopeType) {
                  return Promise.reject(new Error('请选择盘点范围'));
                }
                if (
                  value.scopeType !== 'all' &&
                  (!value.scopeIds || value.scopeIds.length === 0)
                ) {
                  return Promise.reject(new Error('请至少选择一个节点'));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <ScopeSelector value={form.getFieldValue('scope')} onChange={(value) => form.setFieldValue('scope', value)} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateTaskModal;