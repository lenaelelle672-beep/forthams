/**
 * useRetirementList — 退役申请列表查询 Hook
 *
 * 使用 useCallback / useEffect / useState 管理退役申请列表的加载状态，
 * 调用 retirementService.getApplications(params) 获取数据，
 * 将 items 归一化为数组，暴露 { data, isLoading, error, refetch }。
 *
 * 不使用 react-query 或其他外部状态库。
 */
import { useState, useEffect, useCallback } from 'react';
import { retirementService } from '../services/retirementService';
import type { RetirementApplication, RetirementStatus } from '@/app/types/retirement.types';

/**
 * 退役申请列表查询参数
 */
export interface RetirementListParams {
  assetId?: string;
  status?: RetirementStatus;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

/**
 * useRetirementList 返回值
 */
export interface UseRetirementListReturn {
  /** 归一化后的退役申请数组 */
  data: RetirementApplication[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 手动重新加载列表 */
  refetch: (overrideParams?: RetirementListParams) => Promise<void>;
}

/**
 * 将 API 返回的 items 归一化为 RetirementApplication[]
 * 处理可能的 null / undefined / 非数组响应
 */
function normalizeItems(raw: unknown): RetirementApplication[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.items)) {
      return obj.items;
    }
    if (Array.isArray(obj.data)) {
      return obj.data;
    }
  }
  return [];
}

/**
 * 退役申请列表查询 Hook
 *
 * @param params - 可选的查询参数（筛选条件、分页等）
 * @returns { data, isLoading, error, refetch }
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useRetirementList({ status: RetirementStatus.RETIRING });
 * ```
 */
export function useRetirementList(params?: RetirementListParams): UseRetirementListReturn {
  const [data, setData] = useState<RetirementApplication[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取退役申请列表
   * 调用 retirementService.getApplications 并归一化结果
   */
  const fetchData = useCallback(async (fetchParams?: RetirementListParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await retirementService.getApplications(fetchParams);
      setData(normalizeItems(result));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '获取退役申请列表失败';
      setError(message);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 手动重新加载列表，可覆盖查询参数
   */
  const refetch = useCallback(
    async (overrideParams?: RetirementListParams) => {
      await fetchData(overrideParams ?? params);
    },
    [fetchData, params]
  );

  // 初始化加载 & 参数变化时重新加载
  useEffect(() => {
    fetchData(params);
  }, [fetchData, params]);

  return { data, isLoading, error, refetch };
}

export default useRetirementList;
