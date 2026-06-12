/**
 * ConfirmDialog — 盘点管理通用二次确认弹窗
 *
 * 支持两种模式：
 * 1. batch-confirm — 批量确认资产：统一选择实盘状态下拉 + 可选统一备注
 * 2. submit-approval — 提交核准：不可逆操作的二次确认（"确认提交核准？提交后不可修改。"）
 *
 * 交互约束：
 * - 提交核准为不可逆操作，必须二次确认（SWARM-P3-010 交互约束 5）
 * - 所有写操作需防重复提交（按钮 loading）（交互约束 6）
 * - 备注字段最大 200 字符（数据约束）
 *
 * @module components/inventory/ConfirmDialog
 */

import React, { useCallback, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Typography,
  Space,
} from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 实盘状态枚举 */
export type ActualStatus = 'normal' | 'surplus' | 'deficit' | 'damaged' | 'other';

/** 弹窗模式 */
export type ConfirmDialogMode = 'batch-confirm' | 'submit-approval';

/** 批量确认操作的提交载荷 */
export interface BatchConfirmPayload {
  /** 统一实盘状态 */
  actualStatus: ActualStatus;
  /** 统一备注（0-200 字符） */
  remark: string;
}

/** ConfirmDialog 组件属性接口 */
export interface ConfirmDialogProps {
  /**
   * 弹窗模式。
   * - `batch-confirm`：批量确认资产，表单含实盘状态下拉 + 备注输入
   * - `submit-approval`：提交核准，仅展示不可逆操作警告
   */
  mode: ConfirmDialogMode;

  /** 是否显示弹窗（受控） */
  open: boolean;

  /** 关闭弹窗回调 */
  onClose: () => void;

  /**
   * 确认回调。
   * - `batch-confirm` 模式传入 BatchConfirmPayload
   * - `submit-approval` 模式无参数
   *
   * 建议返回 Promise 以便父组件控制 loading / 关闭时机。
   */
  onConfirm: (payload?: BatchConfirmPayload) => Promise<void>;

  /** 已选资产数量（仅 batch-confirm 模式，用于文案提示） */
  selectedCount?: number;

  /** 确认按钮 loading 状态（防重复提交，由父组件 mutation 驱动） */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 实盘状态选项映射（值 → 中文标签） */
const ACTUAL_STATUS_OPTIONS: { value: ActualStatus; label: string }[] = [
  { value: 'normal', label: '正常' },
  { value: 'surplus', label: '盘盈' },
  { value: 'deficit', label: '盘亏' },
  { value: 'damaged', label: '损坏' },
  { value: 'other', label: '其他' },
];

/** 备注字段最大字符数（对齐数据约束 remark: 0-200 字符） */
const REMARK_MAX_LENGTH = 200;

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 判断错误是否为 Ant Design 表单校验失败
 *
 * @param error - 捕获的异常对象
 * @returns 如果是表单校验错误返回 true
 */
function isFormValidationError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'errorFields' in error &&
    Array.isArray((error as Record<string, unknown>).errorFields)
  );
}

// ---------------------------------------------------------------------------
// 子组件：批量确认表单
// ---------------------------------------------------------------------------

/**
 * BatchConfirmForm — 批量确认表单内容
 *
 * 包含实盘状态下拉（必选）和备注输入（选填，最大 200 字符）。
 * 必须嵌套在 Ant Design Form.Provider 中使用。
 *
 * @param props.selectedCount - 已选资产数量，用于展示提示文案
 */
const BatchConfirmForm: React.FC<{ selectedCount: number }> = ({
  selectedCount,
}) => (
  <div>
    <Typography.Text
      type="secondary"
      style={{ display: 'block', marginBottom: 16 }}
    >
      已选择 {selectedCount} 项资产，请统一选择实盘状态：
    </Typography.Text>

    <Form.Item
      name="actualStatus"
      label="实盘状态"
      rules={[{ required: true, message: '请选择实盘状态' }]}
    >
      <Select
        placeholder="请选择实盘状态"
        options={ACTUAL_STATUS_OPTIONS}
        aria-label="选择实盘状态"
      />
    </Form.Item>

    <Form.Item
      name="remark"
      label="备注"
      rules={[
        {
          max: REMARK_MAX_LENGTH,
          message: `备注不能超过 ${REMARK_MAX_LENGTH} 个字符`,
        },
      ]}
    >
      <Input.TextArea
        rows={3}
        maxLength={REMARK_MAX_LENGTH}
        placeholder="请输入备注（选填）"
        showCount
        aria-label="输入备注"
      />
    </Form.Item>
  </div>
);

// ---------------------------------------------------------------------------
// 子组件：提交核准确认内容
// ---------------------------------------------------------------------------

/**
 * SubmitApprovalContent — 提交核准确认内容
 *
 * 展示不可逆操作警告图标与文案，提醒用户提交后不可修改。
 */
const SubmitApprovalContent: React.FC = () => (
  <Space align="start" size={12}>
    <ExclamationCircleOutlined
      style={{ color: '#faad14', fontSize: 22, marginTop: 2 }}
      aria-hidden="true"
    />
    <div>
      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        确认提交核准？
      </Typography.Text>
      <Typography.Text type="secondary">
        提交后不可修改，请确认盘点数据无误后再提交。
      </Typography.Text>
    </div>
  </Space>
);

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

/**
 * ConfirmDialog 通用二次确认弹窗
 *
 * 用于盘点管理中两种需要二次确认的操作：
 *
 * 1. **批量确认资产**（mode="batch-confirm"）
 *    - 由 AssetTableToolbar 触发
 *    - 要求统一选择实盘状态下拉（必填）和备注（选填）
 *    - ATB-005 验收场景
 *
 * 2. **提交核准**（mode="submit-approval"）
 *    - 由 DifferenceSummaryPanel 触发
 *    - 不可逆操作警告："确认提交核准？提交后不可修改。"
 *    - ATB-006 验收场景
 *
 * 防重复提交：通过 `loading` 属性控制确认按钮的 loading / disabled 状态，
 * 父组件应在 mutation 执行期间传入 `loading={true}`。
 *
 * @param props - 组件属性，参见 ConfirmDialogProps
 * @returns React 弹窗组件
 *
 * @example
 * // 批量确认
 * <ConfirmDialog
 *   mode="batch-confirm"
 *   open={batchDialogOpen}
 *   onClose={() => setBatchDialogOpen(false)}
 *   onConfirm={handleBatchConfirm}
 *   selectedCount={selectedRowKeys.length}
 *   loading={batchConfirmMutation.isPending}
 * />
 *
 * @example
 * // 提交核准
 * <ConfirmDialog
 *   mode="submit-approval"
 *   open={submitDialogOpen}
 *   onClose={() => setSubmitDialogOpen(false)}
 *   onConfirm={handleSubmitApproval}
 *   loading={submitMutation.isPending}
 * />
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  mode,
  open,
  onClose,
  onConfirm,
  selectedCount = 0,
  loading = false,
}) => {
  const [form] = Form.useForm();

  // 弹窗关闭时重置表单字段，避免残留数据
  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [open, form]);

  /**
   * 处理确认按钮点击
   *
   * - batch-confirm 模式：先校验表单，通过后将 { actualStatus, remark } 传入 onConfirm
   * - submit-approval 模式：直接调用 onConfirm()
   * - 表单校验失败时阻止提交（Ant Design 自动显示错误提示）
   * - loading 期间忽略重复点击（防重复提交）
   */
  const handleOk = useCallback(async () => {
    if (loading) return; // 防重复提交

    try {
      if (mode === 'batch-confirm') {
        const values = await form.validateFields();
        await onConfirm({
          actualStatus: values.actualStatus as ActualStatus,
          remark: (values.remark as string) ?? '',
        });
      } else {
        await onConfirm();
      }
    } catch (error: unknown) {
      // Ant Design 表单校验失败 — 由 Form 自动展示错误信息，无需额外处理
      if (isFormValidationError(error)) {
        return;
      }
      // API / 业务错误由父组件 onConfirm 内部处理（message.error 等），
      // 此处仅防止未捕获异常导致弹窗状态异常
    }
  }, [mode, form, onConfirm, loading]);

  /**
   * 处理取消 / 关闭操作
   * 重置表单并通知父组件关闭弹窗
   */
  const handleCancel = useCallback(() => {
    form.resetFields();
    onClose();
  }, [form, onClose]);

  /**
   * 根据当前模式返回弹窗标题
   * @returns 弹窗标题文案
   */
  const getDialogTitle = (): string =>
    mode === 'batch-confirm' ? '批量确认' : '提交核准';

  /**
   * 根据当前模式返回确认按钮文本
   * @returns 确认按钮文案
   */
  const getOkText = (): string =>
    mode === 'batch-confirm' ? '确认' : '提交';

  return (
    <Modal
      title={getDialogTitle()}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText={getOkText()}
      cancelText="取消"
      destroyOnClose
      maskClosable={false}
      width={480}
      role="alertdialog"
      aria-label={getDialogTitle()}
      aria-modal="true"
    >
      {mode === 'batch-confirm' ? (
        <Form form={form} layout="vertical" preserve={false}>
          <BatchConfirmForm selectedCount={selectedCount} />
        </Form>
      ) : (
        <SubmitApprovalContent />
      )}
    </Modal>
  );
};

export default ConfirmDialog;
