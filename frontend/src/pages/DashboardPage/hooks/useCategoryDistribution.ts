/**
 * useCategoryDistribution Hook
 *
 * 获取并转换资产分类分布数据，供饼图（ECharts / Recharts）组件使用。
 *
 * 实现规范要求：
 * - 使用 TanStack Query 进行远端数据缓存与状态管理，禁止 useState 存储异步远端数据。
 * - 饼图数据包含各类别资产数量及前端计算的占比百分比。
 * - 数据映射为通用 name-value 结构以适配可视化库。
 *
 * @module pages/DashboardPage/hooks/useCategoryDistribution
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { dashboardApi } from '../services/dashboardApi';
import type { ICategoryPieData } from '../types/dashboard.types';

// ---------------------------------------------------------------------------
// 辅助类型
// ---------------------------------------------------------------------------

/** 饼图单条数据结构（ECharts / Recharts 通用） */
export interface IPieChartDataItem {
  name: string;
  value: number;
  /** 前端计算的百分比，保留一位小数，如 "23.5%" */
  percentage: string;
}

/** Hook 返回值类型 */
export interface IUseCategoryDistributionResult {
  /** 已映射为 name-value 格式的饼图数据，可直接传入图表组件 */
  chartData: IPieChartDataItem[];
  /** 分类资产总数 */
  totalAssets: number;
  /** 后端返回的原始数据（可选保留） */
  rawData: ICategoryPieData[] | undefined;
  /** 加载中状态（用于展示骨架屏 / Spin） */
  isLoading: boolean;
  /** 请求是否失败 */
  isError: boolean;
  /** 错误对象 */
  error: Error | null;
  /** React Query 查询状态 */
  status: UseQueryOptions['queryKey'] extends never ? never : 'pending' | 'error' | 'success';
  /** 手动刷新方法 */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// 数据转换
// ---------------------------------------------------------------------------

/**
 * 将后端返回的原始分类数据转换为饼图所需的 name-value 格式，
 * 并在前端计算每项的占比百分比。
 *
 * @param items - 后端返回的分类数据数组
 * @returns 转换后的饼图数据项数组
 */
export function transformToPieChartData(items: ICategoryPieData[]): IPieChartDataItem[] {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return items.map((item) => ({
    name: item.category,
    value: item.count,
    percentage:
      total > 0
        ? `${((item.count / total) * 100).toFixed(1)}%`
        : '0.0%',
  }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** React Query 缓存键前缀 */
const QUERY_KEY = ['dashboard', 'category-distribution'] as const;

/** 数据保鲜时间（5 分钟），在此期间不会触发后台重新请求 */
const STALE_TIME_MS = 5 * 60 * 1000;

/** 请求失败后最大重试次数 */
const MAX_RETRIES = 2;

/**
 * useCategoryDistribution
 *
 * 获取资产分类占比数据并转换为饼图可用格式。
 *
 * @example
 * ```tsx
 * const { chartData, isLoading, isError } = useCategoryDistribution();
 *
 * if (isLoading) return <Skeleton />;
 * if (isError) return <ErrorMessage />;
 *
 * return <ReactECharts option={{ series: [{ type: 'pie', data: chartData }] }} />;
 * ```
 */
export function useCategoryDistribution(): IUseCategoryDistributionResult {
  const {
    data: rawData,
    isLoading,
    isError,
    error,
    status,
    refetch,
  } = useQuery<ICategoryPieData[]>({
    queryKey: QUERY_KEY,
    queryFn: () => dashboardApi.getCategoryDistribution(),
    staleTime: STALE_TIME_MS,
    retry: MAX_RETRIES,
  });

  const chartData: IPieChartDataItem[] = rawData
    ? transformToPieChartData(rawData)
    : [];

  const totalAssets: number = rawData
    ? rawData.reduce((sum, item) => sum + item.count, 0)
    : 0;

  return {
    chartData,
    totalAssets,
    rawData,
    isLoading,
    isError,
    error: error ?? null,
    status,
    refetch,
  };
}

export default useCategoryDistribution;