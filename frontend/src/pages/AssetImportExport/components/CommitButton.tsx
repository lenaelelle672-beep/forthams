import React, { useState, useMemo, useCallback } from 'react';
import { Button, message, Alert, Space } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { commitImport } from '@/api/assetImport';
import type { AssetRow, RowError } from '../types';

/** 确认提交结果（对应后端 POST /api/v1/assets/import/commit 响应） */
interface CommitResult {
  success: boolean;
  importedCount: number;
  failedCount: number;
}

/** CommitButton 组件属性 */
interface CommitButtonProps {
  /** 解析 ID，由 POST /api/v1/assets/import/parse 接口返回 */
  parseId: string;
  /** 解析并修正后的资产行数据（含用户内联修正） */
  rows: AssetRow[];
  /** 行级校验错误列表 */
  errors: RowError[];
  /** 提交成功后的回调 */
  onSuccess?: (result: CommitResult) => void;
  /** 外部禁用控制（例如正在上传中） */
  disabled?: boolean;
}

/**
 * 确认导入按钮组件 (FE-7 / Layer 2.6)
 *
 * 将解析并修正后的资产数据提交至后端。
 *
 * 关键交互规则（对标 SPEC）：
 * - 至少存在一行有效数据才可提交
 * - 提交过程中禁用按钮防止重复提交（ATB-012）
 * - 成功后展示结果摘要，按钮切换为「导入完成」禁用态（ATB-011）
 * - 全部行校验失败时按钮 disabled（ATB-013）
 */
const CommitButton: React.FC<CommitButtonProps> = ({
  parseId,
  rows,
  errors,
  onSuccess,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  /** 存在校验错误的行号集合 */
  const errorRowNumbers = useMemo(() => {
    return new Set(errors.map((e) => e.rowNumber));
  }, [errors]);

  /** 有效行数（无校验错误的行） */
  const validRowCount = useMemo(() => {
    return rows.filter((r) => !errorRowNumbers.has(r.rowNumber)).length;
  }, [rows, errorRowNumbers]);

  /** 是否存在至少一行有效数据 */
  const hasValidRows = validRowCount > 0;

  /** 按钮是否不可用（不含 loading 状态，loading 由 Button.loading 单独控制） */
  const isDisabled = disabled || committed || !hasValidRows;

  /**
   * 点击确认导入处理函数
   *
   * 发送 POST /api/v1/assets/import/commit，请求体为 { parseId, rows }。
   * 内含 loading 与 isDisabled 双重防护，防止并发重复提交。
   */
  const handleCommit = useCallback(async () => {
    if (loading || isDisabled || !parseId) return;

    setLoading(true);
    try {
      // 调用 API 层封装的 commitImport（Layer 0.4）
      const result = await commitImport(parseId, rows);
      const res: CommitResult = {
        success: result.success,
        importedCount: result.importedCount,
        failedCount: result.failedCount,
      };
      setCommitResult(res);
      setCommitted(true);
      message.success(
        `成功导入 ${res.importedCount} 条资产，${res.failedCount} 条失败`
      );
      onSuccess?.(res);
    } catch (error: any) {
      const msg =
        error?.response?.data?.message || '提交失败，请稍后重试';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [loading, isDisabled, parseId, rows, onSuccess]);

  /** 按钮显示文案 */
  const buttonText = committed
    ? '导入完成'
    : loading
      ? '提交中...'
      : `确认导入（${validRowCount} 条有效）`;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* 提交成功后的结果摘要（ATB-011 step 3） */}
      {commitResult && (
        <Alert
          type={commitResult.failedCount > 0 ? 'warning' : 'success'}
          showIcon
          message={`成功导入 ${commitResult.importedCount} 条资产，${commitResult.failedCount} 条失败`}
        />
      )}

      <Button
        type="primary"
        size="large"
        icon={<CheckCircleOutlined />}
        loading={loading}
        disabled={!loading && isDisabled}
        onClick={handleCommit}
        style={{ minWidth: 200 }}
      >
        {buttonText}
      </Button>
    </Space>
  );
};

export default CommitButton;