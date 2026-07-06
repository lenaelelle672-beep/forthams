/**
 * useRetirementSubmit — 退役申请提交 Hook
 *
 * 暴露 { mutateAsync, isPending, error }；
 * mutateAsync(values) 调用 retirementService.createApplication(
 *   values.assetId, values.reason, values.expectedDate || values.description
 * )。
 *
 * 不使用 react-query 或其他外部状态库。
 */
import { useState, useCallback } from 'react';
import { retirementService } from '../services/retirementService';
import type { RetirementApplication } from '@/app/types/retirement.types';

/**
 * 退役申请提交参数
 */
export interface RetirementSubmitValues {
  /** 资产ID（必填） */
  assetId: string;
  /** 退役原因（必填） */
  reason: string;
  /** 预期退役日期（可选） */
  expectedDate?: string;
  /** 补充描述（可选，当 expectedDate 缺失时可作为替代字段） */
  description?: string;
}

/**
 * useRetirementSubmit 返回值
 */
export interface UseRetirementSubmitReturn {
  /** 提交退役申请，返回创建的申请记录 */
  mutateAsync: (values: RetirementSubmitValues) => Promise<RetirementApplication>;
  /** 是否正在提交 */
  isPending: boolean;
  /** 错误信息 */
  error: string | null;
}

/**
 * 退役申请提交 Hook
 *
 * @returns { mutateAsync, isPending, error }
 *
 * @example
 * ```tsx
 * const { mutateAsync, isPending, error } = useRetirementSubmit();
 *
 * await mutateAsync({
 *   assetId: 'AST-001',
 *   reason: '设备老化',
 *   expectedDate: '2025-12-31',
 * });
 * ```
 */
export function useRetirementSubmit(): UseRetirementSubmitReturn {
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 提交退役申请
   * 调用 retirementService.createApplication(assetId, reason, expectedDate || description)
   */
  const mutateAsync = useCallback(
    async (values: RetirementSubmitValues): Promise<RetirementApplication> => {
      setIsPending(true);
      setError(null);
      try {
        const result = await retirementService.createApplication(
          values.assetId,
          values.reason,
          values.expectedDate || values.description
        );
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '提交退役申请失败';
        setError(message);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  return { mutateAsync, isPending, error };
}

export default useRetirementSubmit;
