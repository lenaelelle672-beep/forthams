/**
 * 资产折旧计算 Hook
 * 
 * 用于获取和管理资产折旧信息，支持直线法和双倍余额递减法两种折旧计算方式。
 * 
 * @module useDepreciation
 * @version 1.0.0
 * @date 2024
 */

import { useState, useCallback, useEffect } from 'react';
import { httpClient } from '../utils/http';
import type { Asset } from '../types/asset.types';

/**
 * 折旧计算方法枚举
 */
export enum DepreciationMethod {
  /** 直线法 - 每期折旧额固定 */
  STRAIGHT_LINE = 'straight_line',
  /** 双倍余额递减法 - 前期折旧额高、后期低 */
  DOUBLE_DECLINING = 'double_declining'
}

/**
 * 折旧计算结果数据结构
 */
export interface DepreciationResult {
  /** 资产ID */
  asset_id: number;
  /** 折旧计算方法 */
  method: DepreciationMethod;
  /** 折旧计算基准日期 */
  reference_date: string;
  /** 月折旧额（直线法）或当前年折旧额（DDB法） */
  period_depreciation: number;
  /** 累计折旧额 */
  accumulated_depreciation: number;
  /** 账面净值 = 原值 - 累计折旧 */
  net_book_value: number;
  /** 资产原值 */
  purchase_price: number;
  /** 预计残值 */
  salvage_value: number;
  /** 已计提期间数（月） */
  periods_elapsed: number;
  /** 总可用期间数（月） */
  total_periods: number;
  /** 当前折旧进度百分比 */
  depreciation_progress: number;
}

/**
 * 折旧状态枚举
 */
export enum DepreciationStatus {
  /** 正常计提中 */
  ACTIVE = 'active',
  /** 已提足折旧 */
  FULLY_DEPRECIATED = 'fully_depreciated',
  /** 未开始计提 */
  NOT_STARTED = 'not_started',
  /** 资产已退役/处置 */
  RETIRED = 'retired'
}

/**
 * 折旧详细信息（用于详情页展示）
 */
export interface DepreciationDetails {
  /** 资产ID */
  asset_id: number;
  /** 当前折旧状态 */
  status: DepreciationStatus;
  /** 折旧计算方法名称（中文） */
  method_name: string;
  /** 折旧计算方法 */
  method: DepreciationMethod;
  /** 当前期间折旧额 */
  current_depreciation: number;
  /** 本年累计折旧 */
  ytd_depreciation: number;
  /** 历史累计折旧 */
  accumulated_depreciation: number;
  /** 账面净值 */
  net_book_value: number;
  /** 资产原值 */
  purchase_price: number;
  /** 预计残值 */
  salvage_value: number;
  /** 已使用月数 */
  months_used: number;
  /** 预计总使用寿命（月） */
  total_months: number;
  /** 剩余使用寿命（月） */
  remaining_months: number;
  /** 折旧进度百分比 */
  progress_percentage: number;
  /** 折旧完成日期（预计） */
  estimated_end_date: string | null;
}

/**
 * Hook 配置参数
 */
export interface UseDepreciationOptions {
  /** 是否启用自动刷新（默认false） */
  autoRefresh?: boolean;
  /** 自动刷新间隔（毫秒，默认5分钟） */
  refreshInterval?: number;
  /** 参考日期（可选，默认为当天） */
  referenceDate?: string;
}

/**
 * Hook 返回数据类型
 */
export interface UseDepreciationReturn {
  /** 折旧计算结果 */
  data: DepreciationDetails | null;
  /** 原始计算结果（包含更多技术细节） */
  rawResult: DepreciationResult | null;
  /** 加载状态 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 刷新数据方法 */
  refresh: () => Promise<void>;
  /** 更新计算方法 */
  setMethod: (method: DepreciationMethod) => void;
  /** 当前使用的计算方法 */
  currentMethod: DepreciationMethod;
  /** 资产基础信息（从Asset对象提取） */
  assetInfo: Partial<Pick<Asset, 'purchase_price' | 'purchase_date' | 'useful_life_years' | 'salvage_value'>> | null;
}

/**
 * API 响应数据类型
 */
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

/**
 * 获取折旧方法的中文名称
 * 
 * @param method - 折旧计算方法
 * @returns 中文名称
 */
export function getDepreciationMethodName(method: DepreciationMethod): string {
  const methodNames: Record<DepreciationMethod, string> = {
    [DepreciationMethod.STRAIGHT_LINE]: '直线法',
    [DepreciationMethod.DOUBLE_DECLINING]: '双倍余额递减法'
  };
  return methodNames[method] || '未知方法';
}

/**
 * 计算折旧进度百分比
 * 
 * @param accumulated - 累计折旧
 * @param total - 应折旧总额（原值 - 残值）
 * @returns 百分比值（0-100）
 */
function calculateProgress(accumulated: number, total: number): number {
  if (total <= 0) return 100;
  const progress = (accumulated / total) * 100;
  return Math.min(Math.round(progress * 100) / 100, 100);
}

/**
 * 格式化日期为 YYYY-MM-DD
 * 
 * @param date - Date 对象
 * @returns 格式化后的日期字符串
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * 计算两个日期之间的月数差
 * 
 * @param startDate - 开始日期
 * @param endDate - 结束日期
 * @returns 月数差
 */
function calculateMonthsDiff(startDate: Date, endDate: Date): number {
  const yearsDiff = endDate.getFullYear() - startDate.getFullYear();
  const monthsDiff = endDate.getMonth() - startDate.getMonth();
  return yearsDiff * 12 + monthsDiff;
}

/**
 * 资产折旧计算 Hook
 * 
 * @param assetId - 资产ID
 * @param options - 配置选项
 * @returns 折旧数据和操作方法
 * 
 * @example
 * ```tsx
 * function AssetDepreciationCard({ assetId }) {
 *   const {
 *     data,
 *     isLoading,
 *     error,
 *     refresh,
 *     currentMethod
 *   } = useDepreciation(assetId);
 * 
 *   if (isLoading) return <Skeleton />;
 *   if (error) return <ErrorMessage error={error} />;
 * 
 *   return (
 *     <div>
 *       <h3>折旧信息</h3>
 *       <p>方法: {data?.method_name}</p>
 *       <p>账面净值: {data?.net_book_value}</p>
 *       <button onClick={refresh}>刷新</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDepreciation(
  assetId: number | null,
  options: UseDepreciationOptions = {}
): UseDepreciationReturn {
  const {
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000, // 默认5分钟
    referenceDate
  } = options;

  // 状态管理
  const [data, setData] = useState<DepreciationDetails | null>(null);
  const [rawResult, setRawResult] = useState<DepreciationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentMethod, setCurrentMethod] = useState<DepreciationMethod>(
    DepreciationMethod.STRAIGHT_LINE
  );
  const [assetInfo, setAssetInfo] = useState<Partial<Pick<Asset, 'purchase_price' | 'purchase_date' | 'useful_life_years' | 'salvage_value'>> | null>(null);

  /**
   * 转换原始API结果为详情格式
   */
  const transformToDetails = useCallback((
    result: DepreciationResult,
    asset?: Partial<Pick<Asset, 'purchase_price' | 'purchase_date' | 'useful_life_years' | 'salvage_value'>>
  ): DepreciationDetails => {
    const now = new Date();
    const referenceDateObj = new Date(result.reference_date);
    const purchaseDate = asset?.purchase_date ? new Date(asset.purchase_date) : referenceDateObj;
    const totalMonths = (asset?.useful_life_years || 10) * 12;
    const monthsUsed = result.periods_elapsed;
    const remainingMonths = Math.max(0, totalMonths - monthsUsed);
    const depreciableAmount = result.purchase_price - result.salvage_value;

    // 计算折旧状态
    let status: DepreciationStatus;
    if (result.net_book_value <= result.salvage_value) {
      status = DepreciationStatus.FULLY_DEPRECIATED;
    } else if (monthsUsed === 0) {
      status = DepreciationStatus.NOT_STARTED;
    } else {
      status = DepreciationStatus.ACTIVE;
    }

    // 计算预计结束日期
    let estimatedEndDate: string | null = null;
    if (asset?.purchase_date && asset?.useful_life_years) {
      const endDate = new Date(asset.purchase_date);
      endDate.setFullYear(endDate.getFullYear() + asset.useful_life_years);
      estimatedEndDate = formatDate(endDate);
    }

    return {
      asset_id: result.asset_id,
      status,
      method_name: getDepreciationMethodName(result.method),
      method: result.method,
      current_depreciation: result.period_depreciation,
      ytd_depreciation: result.period_depreciation,
      accumulated_depreciation: result.accumulated_depreciation,
      net_book_value: result.net_book_value,
      purchase_price: result.purchase_price,
      salvage_value: result.salvage_value,
      months_used: monthsUsed,
      total_months: totalMonths,
      remaining_months: remainingMonths,
      progress_percentage: calculateProgress(result.accumulated_depreciation, depreciableAmount),
      estimated_end_date: estimatedEndDate
    };
  }, []);

  /**
   * 从API获取折旧数据
   */
  const fetchDepreciation = useCallback(async () => {
    if (assetId === null) {
      setData(null);
      setRawResult(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, string | number> = {
        method: currentMethod
      };

      if (referenceDate) {
        params.reference_date = referenceDate;
      }

      const response = await httpClient.get<ApiResponse<DepreciationResult>>(
        `/assets/${assetId}/depreciation`,
        { params }
      );

      const result = response.data;

      // 如果响应包含资产信息，保存下来
      if (result.purchase_price) {
        setAssetInfo({
          purchase_price: result.purchase_price,
          salvage_value: result.salvage_value
        });
      }

      setRawResult(result);
      setData(transformToDetails(result, assetInfo));
    } catch (err) {
      const error = err instanceof Error ? err : new Error('获取折旧数据失败');
      setError(error);
      setData(null);
      setRawResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [assetId, currentMethod, referenceDate, transformToDetails, assetInfo]);

  /**
   * 更新计算方法
   */
  const updateMethod = useCallback((method: DepreciationMethod) => {
    setCurrentMethod(method);
  }, []);

  /**
   * 刷新数据
   */
  const refresh = useCallback(async () => {
    await fetchDepreciation();
  }, [fetchDepreciation]);

  // 初始加载和依赖变化时获取数据
  useEffect(() => {
    fetchDepreciation();
  }, [fetchDepreciation]);

  // 自动刷新逻辑
  useEffect(() => {
    if (!autoRefresh || assetId === null) {
      return;
    }

    const timerId = setInterval(() => {
      fetchDepreciation();
    }, refreshInterval);

    return () => {
      clearInterval(timerId);
    };
  }, [autoRefresh, refreshInterval, assetId, fetchDepreciation]);

  return {
    data,
    rawResult,
    isLoading,
    error,
    refresh,
    setMethod: updateMethod,
    currentMethod,
    assetInfo
  };
}

/**
 * 获取折旧摘要信息（轻量级版本，用于列表页）
 */
export function useDepreciationSummary(assetId: number | null) {
  return useDepreciation(assetId, {
    autoRefresh: false
  });
}

export default useDepreciation;