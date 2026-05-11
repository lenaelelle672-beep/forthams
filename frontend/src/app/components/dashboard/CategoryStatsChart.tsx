/**
 * CategoryStatsChart — 资产分类分布统计图表组件
 *
 * 使用 Recharts PieChart 渲染资产在各分类下的数量分布。
 * 支持外部注入数据或通过 useDashboardData 自行获取。
 *
 * @module components/dashboard/CategoryStatsChart
 * @see frontend/src/app/hooks/useDashboardData.ts — CategoryItem
 */

import React, { useEffect, useState } from 'react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { dashboardService } from '../../services/dashboardService';
import type { CategoryItem } from '../../hooks/useDashboardData';

/**
 * CategoryStatsChart 组件属性
 */
export interface CategoryStatsChartProps {
  /** 自定义类名 */
  className?: string;
  /** 外部注入数据（可选，不传则组件自行拉取） */
  data?: CategoryItem[];
  /** 加载状态 */
  loading?: boolean;
}

/** 图表调色板 */
const CHART_PALETTE = [
  '#5470C6',
  '#91CC75',
  '#FAC858',
  '#EE6666',
  '#73C0DE',
  '#3BA272',
  '#FC8452',
  '#9A60B4',
  '#EA7CCC',
  '#0068B7',
];

/**
 * 格式化数值显示
 *
 * @param value - 待格式化数值
 * @returns 带有千位分隔符的字符串
 */
function formatNumber(value: number | string): string {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return String(value);
  return new Intl.NumberFormat('zh-CN').format(numericValue);
}

/**
 * 将后端 categoryDistribution Record 转换为 Recharts 所需的数组格式
 *
 * @param distribution - 后端返回的分类-数量映射
 * @returns PieChart 可消费的数据数组
 */
function toChartData(
  distribution: Record<string, number> | undefined,
): CategoryItem[] {
  if (!distribution || typeof distribution !== 'object') return [];
  return Object.entries(distribution)
    .filter(([, value]) => typeof value === 'number')
    .map(([name, value]) => ({ name, value }));
}

/**
 * CategoryStatsChart 组件
 *
 * 展示资产分类分布饼图（环形图）。
 * 当外部未传入 data 时，组件自行从 dashboardService.getStats() 获取数据。
 *
 * @example
 * ```tsx
 * <CategoryStatsChart />
 * <CategoryStatsChart data={[{ name: 'IT', value: 50 }]} />
 * ```
 */
export const CategoryStatsChart: React.FC<CategoryStatsChartProps> = ({
  className = '',
  data: externalData,
  loading: externalLoading,
}) => {
  const [internalData, setInternalData] = useState<CategoryItem[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /** 外部传入数据时跳过内部拉取 */
    if (externalData !== undefined) return;

    let mounted = true;

    async function fetchCategoryData() {
      setInternalLoading(true);
      setError(null);

      try {
        const stats = await dashboardService.getStats();
        if (!mounted) return;
        setInternalData(toChartData(stats.categoryDistribution));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : '分类分布数据加载失败');
      } finally {
        if (mounted) setInternalLoading(false);
      }
    }

    void fetchCategoryData();

    return () => {
      mounted = false;
    };
  }, [externalData]);

  const data = externalData ?? internalData;
  const loading = externalLoading ?? internalLoading;

  /** 渲染加载态 */
  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">资产分类分布</h3>
        <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
          正在加载分类分布数据...
        </div>
      </div>
    );
  }

  /** 渲染错误态 */
  if (error) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">资产分类分布</h3>
        <div className="flex h-[300px] items-center justify-center text-sm text-red-500">
          {error}
        </div>
      </div>
    );
  }

  /** 渲染空态 */
  if (!data || data.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">资产分类分布</h3>
        <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
          暂无分类分布数据
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">资产分类分布</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            cx="50%"
            cy="50%"
            data={data}
            dataKey="value"
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            labelLine={false}
            nameKey="name"
            outerRadius={100}
          >
            {data.map((_entry, index) => (
              <Cell
                key={`cell-category-${index}`}
                fill={CHART_PALETTE[index % CHART_PALETTE.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${formatNumber(value as number)} 件`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CategoryStatsChart;
