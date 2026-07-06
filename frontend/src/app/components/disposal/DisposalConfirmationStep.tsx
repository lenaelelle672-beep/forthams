/**
 * DisposalConfirmationStep Component
 *
 * 报废确认步骤 — 纯展示型组件
 * 展示提交前的最终快照数据，用于防误触校验。
 * 接收只读 props，不可直接引用表单的动态绑定值，
 * 确保提交瞬间数据不可被篡改。
 *
 * @module components/disposal/DisposalConfirmationStep
 * @requires react, antd
 */

import React from 'react';
import { Alert, Descriptions, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * DisposalConfirmationStep 组件属性接口
 *
 * 所有属性均为只读快照，由父组件在表单校验通过后冻结传入。
 *
 * @interface DisposalConfirmationStepProps
 * @property {string} assetNo - 资产编号
 * @property {string} assetName - 资产名称
 * @property {string} reason - 报废原因
 * @property {string} [retirementType] - 报废类型 (SCRAP/RETIREMENT)
 * @property {number} [estimatedResidualValue] - 残值估计
 * @property {function} onConfirm - 确认提交回调
 * @property {function} onBack - 返回上一步回调
 * @property {boolean} [submitting] - 是否正在提交
 * @property {string|null} [errorMessage] - 错误提示信息
 * @property {string} [data-testid] - 测试标识
 */
export interface DisposalConfirmationStepProps {
  /** 资产编号 */
  assetNo: string;
  /** 资产名称 */
  assetName: string;
  /** 报废原因 */
  reason: string;
  /** 报废类型 */
  retirementType?: string;
  /** 残值估计 */
  estimatedResidualValue?: number;
  /** 确认回调 */
  onConfirm: () => void;
  /** 返回上一步回调 */
  onBack: () => void;
  /** 提交中状态 */
  submitting?: boolean;
  /** 错误信息 */
  errorMessage?: string | null;
  /** data-testid */
  'data-testid'?: string;
}

/**
 * 报废类型标签映射
 */
const RETIREMENT_TYPE_LABELS: Record<string, string> = {
  SCRAP: '报废',
  RETIREMENT: '退役',
};

/**
 * DisposalConfirmationStep — 报废确认步骤组件
 *
 * 纯展示型组件，渲染提交前的最终快照数据。
 * 包含防误触警告、资产信息摘要、报废原因展示及错误信息区域。
 *
 * @param {DisposalConfirmationStepProps} props - 组件属性
 * @returns {JSX.Element} 确认步骤组件
 *
 * @example
 * ```tsx
 * <DisposalConfirmationStep
 *   assetNo="A-001"
 *   assetName="测试资产"
 *   reason="达到报废年限"
 *   retirementType="SCRAP"
 *   onConfirm={handleSubmit}
 *   onBack={() => setStep('form')}
 * />
 * ```
 */
const DisposalConfirmationStep: React.FC<DisposalConfirmationStepProps> = ({
  assetNo,
  assetName,
  reason,
  retirementType,
  estimatedResidualValue,
  onConfirm,
  onBack,
  submitting = false,
  errorMessage,
  'data-testid': testId,
}) => {
  return (
    <div data-testid={testId || 'disposal-confirmation-step'}>
      {/* 防误触警告 */}
      <Alert
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="请确认您正在报废以下资产"
        description={
          <Text strong>
            资产编号：
            <Text mark data-testid="confirmation-asset-no">
              {assetNo}
            </Text>
          </Text>
        }
        style={{ marginBottom: 16 }}
      />

      {/* 确认信息快照 — 只读展示 */}
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="资产编号">
          <Text strong data-testid="confirmation-detail-assetno">
            {assetNo}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="资产名称">
          <span data-testid="confirmation-detail-assetname">{assetName}</span>
        </Descriptions.Item>
        <Descriptions.Item label="报废类型">
          {RETIREMENT_TYPE_LABELS[retirementType || 'SCRAP'] || retirementType}
        </Descriptions.Item>
        <Descriptions.Item label="报废原因">
          <span data-testid="confirmation-detail-reason">{reason}</span>
        </Descriptions.Item>
        {estimatedResidualValue !== undefined && (
          <Descriptions.Item label="估计残值">
            ¥{estimatedResidualValue.toLocaleString()}
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* 错误提示 — 处理 403/409/网络异常等 */}
      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message={errorMessage}
          style={{ marginTop: 16 }}
          data-testid="disposal-confirmation-error"
        />
      )}
    </div>
  );
};

export default DisposalConfirmationStep;
