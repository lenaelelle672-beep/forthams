/**
 * CategoryPieChart — 资产类别分布饼图组件
 *
 * 使用 Recharts PieChart 渲染资产在各分类下的数量分布。
 * 集成图表依赖进行绘制，支持加载态和空态。
 *
 * 所有样式来自 DashboardPage.module.css，禁止使用内联样式。
 *
 * @module components/dashboard/CategoryPieChart
 * @see frontend/src/app/hooks/useDashboardData.ts — CategoryItem
 */

import React from 'react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { CategoryItem } from '../../hooks/useDashboardData';
import { formatNumber } from '../../pages/DashboardPage';
import styles from './DashboardPage.module.css';

/**
 * CategoryPieChart 组件属性
 */
export interface CategoryPieChartProps {
  /** 聚合后的分类数组 */
  data: CategoryItem[];
  /** 加载状态 */
  loading?: boolean;
  /** 自定义容器 data-testid */
  dataTestId?: string;
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
 * CategoryPieChart 组件
 *
 * 展示资产分类分布饼图（环形图）。
 * 生成 SVG 元素和与类别数量相等的 Legend 节点。
 *
 * @example
 * ```tsx
 * <CategoryPieChart data={[{ name: 'IT', value: 50 }]} />
 * <CategoryPieChart data={[]} loading={true} />
 * ```
 */
export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  data = [],
  loading = false,
  dataTestId,
}) => {
  /**
   * 渲染加载态
   */
  if (loading) {
    return (
      <div className={styles.chartPanel} data-testid={dataTestId}>
        <h3 className={styles.chartPanelTitle}>资产分类分布</h3>
        <div className={styles.chartLoading}>
          正在加载分类分布数据...
        </div>
      </div>
    );
  }

  /**
   * 渲染空态
   */
  if (!data || data.length === 0) {
    return (
      <div className={styles.chartPanel} data-testid={dataTestId}>
        <h3 className={styles.chartPanelTitle}>资产分类分布</h3>
        <div className={styles.chartEmpty}>
          暂无分类分布数据
        </div>
      </div>
    );
  }

  /**
   * 渲染饼图
   */
  return (
    <div className={styles.chartPanel} data-testid={dataTestId}>
      <h3 className={styles.chartPanelTitle}>资产分类分布</h3>
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

export default CategoryPieChart;
