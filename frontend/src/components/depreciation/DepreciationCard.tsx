/**
 * DepreciationCard Component
 * 
 * 资产详情页折旧信息展示卡片
 * 
 * 功能：
 * - 展示直线法和双倍余额递减法的折旧计算结果
 * - 显示月折旧额、累计折旧、账面净值等关键指标
 * - 支持加载状态、错误状态、数据展示三种渲染模式
 * 
 * 使用说明:
 *   import DepreciationCard from '@/components/depreciation/DepreciationCard';
 *   <DepreciationCard assetId={assetId} />
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, DollarSign, Calendar, Loader2, RefreshCw } from 'lucide-react';

/** 折旧方法枚举 */
export type DepreciationMethod = 'straight_line' | 'double_declining';

/** 月折旧数据结构 */
export interface MonthlyDepreciation {
  amount: number;
  rate: number;
}

/** 折旧计算结果数据结构 */
export interface DepreciationData {
  method: DepreciationMethod;
  methodLabel: string;
  purchasePrice: number;
  usefulLifeYears: number;
  salvageValue: number;
  monthlyDepreciation: MonthlyDepreciation;
  accumulatedDepreciation: number;
  netBookValue: number;
  currentYearDepreciation: number;
  depreciationRate: number;
  calculatedAt: string;
}

/** 资产折旧计算请求参数 */
export interface DepreciationRequestParams {
  assetId: string;
  method?: DepreciationMethod;
  referenceDate?: string;
}

/** API 响应数据结构 */
export interface DepreciationApiResponse {
  current_depreciation: number;
  accumulated_depreciation: number;
  net_book_value: number;
  monthly_depreciation: number;
  method: string;
  calculated_at: string;
}

/** DepreciationCard 组件 Props */
export interface DepreciationCardProps {
  /** 资产ID */
  assetId: string;
  /** 折旧计算方法 */
  method?: DepreciationMethod;
  /** 基准日期（可选，默认为当天） */
  referenceDate?: string;
  /** 样式类名 */
  className?: string;
  /** 是否可刷新 */
  refreshable?: boolean;
  /** 刷新回调 */
  onRefresh?: () => void;
}

/** 方法标签映射 */
const METHOD_LABELS: Record<DepreciationMethod, string> = {
  straight_line: '直线法',
  double_declining: '双倍余额递减法',
};

/** 默认折旧数据（资产未计算折旧时使用） */
const DEFAULT_DEPRECIATION: DepreciationData = {
  method: 'straight_line',
  methodLabel: '直线法',
  purchasePrice: 0,
  usefulLifeYears: 0,
  salvageValue: 0,
  monthlyDepreciation: { amount: 0, rate: 0 },
  accumulatedDepreciation: 0,
  netBookValue: 0,
  currentYearDepreciation: 0,
  depreciationRate: 0,
  calculatedAt: '',
};

/**
 * 格式化金额为千分位格式
 * 
 * @param amount - 金额数值
 * @param decimals - 小数位数，默认2位
 * @returns 格式化后的金额字符串
 */
export const formatCurrency = (amount: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

/**
 * 格式化百分比
 * 
 * @param rate - 比率（0-1之间）
 * @param decimals - 小数位数，默认4位
 * @returns 格式化后的百分比字符串
 */
export const formatPercentage = (rate: number, decimals: number = 2): string => {
  return `${(rate * 100).toFixed(decimals)}%`;
};

/**
 * 将 API 响应转换为组件数据格式
 * 
 * @param response - API 响应数据
 * @returns 组件内部使用的数据结构
 */
export const transformApiResponse = (response: DepreciationApiResponse): DepreciationData => {
  const method = response.method as DepreciationMethod;
  const monthlyAmount = response.monthly_depreciation || 0;
  const accumulated = response.accumulated_depreciation || 0;
  const netValue = response.net_book_value || 0;
  const purchasePrice = monthlyAmount > 0 ? (monthlyAmount * 12 * 10) + netValue + accumulated : 0; // 估算原值

  // 计算折旧率
  const depreciationRate = purchasePrice > 0 
    ? accumulated / purchasePrice 
    : 0;

  return {
    method,
    methodLabel: METHOD_LABELS[method] || method,
    purchasePrice,
    usefulLifeYears: monthlyAmount > 0 ? Math.round(1 / (monthlyAmount / (netValue + accumulated + monthlyAmount * 12))) : 0,
    salvageValue: 0,
    monthlyDepreciation: {
      amount: monthlyAmount,
      rate: monthlyAmount / purchasePrice,
    },
    accumulatedDepreciation: accumulated,
    netBookValue: netValue,
    currentYearDepreciation: monthlyAmount * 12,
    depreciationRate,
    calculatedAt: response.calculated_at,
  };
};

/**
 * 获取折旧计算数据
 * 
 * @param assetId - 资产ID
 * @param method - 折旧方法
 * @param referenceDate - 基准日期
 * @param signal - AbortSignal
 * @returns Promise<DepreciationData>
 */
export const fetchDepreciationData = async (
  assetId: string,
  method: DepreciationMethod = 'straight_line',
  referenceDate?: string,
  signal?: AbortSignal
): Promise<DepreciationData> => {
  const params = new URLSearchParams({
    method,
    ...(referenceDate && { reference_date: referenceDate }),
  });

  const response = await fetch(
    `/api/v1/assets/${assetId}/depreciation?${params.toString()}`,
    { signal }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('资产不存在');
    }
    if (response.status === 422) {
      throw new Error('无效的折旧方法参数');
    }
    throw new Error(`折旧计算失败: ${response.statusText}`);
  }

  const data: DepreciationApiResponse = await response.json();
  return transformApiResponse(data);
};

/**
 * DepreciationCard 组件
 * 
 * 在资产详情页展示当前折旧值与净值
 * 支持直线法和双倍余额递减法两种折旧计算方式
 * 
 * @param props - 组件属性
 * @returns React 组件
 */
const DepreciationCard: React.FC<DepreciationCardProps> = ({
  assetId,
  method = 'straight_line',
  referenceDate,
  className = '',
  refreshable = false,
  onRefresh,
}) => {
  // 状态管理
  const [data, setData] = useState<DepreciationData>(DEFAULT_DEPRECIATION);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // 计算折旧数据
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchDepreciationData(
          assetId,
          method,
          referenceDate,
          controller.signal
        );

        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && err instanceof Error) {
          if (err.name === 'AbortError') {
            // 请求被取消，不更新状态
            return;
          }
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [assetId, method, referenceDate]);

  // 刷新处理
  const handleRefresh = async () => {
    if (refreshing) return;

    setRefreshing(true);
    const controller = new AbortController();

    try {
      const result = await fetchDepreciationData(
        assetId,
        method,
        referenceDate,
        controller.signal
      );
      setData(result);
      setError(null);
      onRefresh?.();
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // 加载状态渲染
  if (loading) {
    return (
      <div className={`depreciation-card depreciation-card--loading ${className}`}>
        <div className="depreciation-card__header">
          <div className="skeleton skeleton--title" />
          {refreshable && (
            <div className="skeleton skeleton--icon" />
          )}
        </div>
        <div className="depreciation-card__body">
          <div className="depreciation-card__skeleton-grid">
            <div className="skeleton skeleton--item" />
            <div className="skeleton skeleton--item" />
            <div className="skeleton skeleton--item" />
            <div className="skeleton skeleton--item" />
          </div>
        </div>
        <div className="depreciation-card__footer">
          <div className="skeleton skeleton--footer" />
        </div>
      </div>
    );
  }

  // 错误状态渲染
  if (error) {
    return (
      <div className={`depreciation-card depreciation-card--error ${className}`}>
        <div className="depreciation-card__header">
          <h3 className="depreciation-card__title">
            <AlertTriangle size={18} />
            <span>折旧信息</span>
          </h3>
          {refreshable && (
            <button
              className="depreciation-card__refresh-btn"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="重新加载"
            >
              <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            </button>
          )}
        </div>
        <div className="depreciation-card__error">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // 数据展示渲染
  return (
    <div className={`depreciation-card ${className}`}>
      <div className="depreciation-card__header">
        <h3 className="depreciation-card__title">
          <TrendingDown size={18} />
          <span>折旧信息</span>
        </h3>
        <div className="depreciation-card__header-right">
          <span className="depreciation-card__method-badge">
            {data.methodLabel}
          </span>
          {refreshable && (
            <button
              className="depreciation-card__refresh-btn"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="刷新折旧数据"
            >
              {refreshing ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <RefreshCw size={16} />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="depreciation-card__body">
        <div className="depreciation-card__metrics">
          {/* 月折旧额 */}
          <div className="depreciation-card__metric">
            <div className="depreciation-card__metric-icon">
              <DollarSign size={16} />
            </div>
            <div className="depreciation-card__metric-content">
              <span className="depreciation-card__metric-label">月折旧额</span>
              <span className="depreciation-card__metric-value">
                ¥{formatCurrency(data.monthlyDepreciation.amount)}
              </span>
            </div>
          </div>

          {/* 累计折旧 */}
          <div className="depreciation-card__metric">
            <div className="depreciation-card__metric-icon">
              <TrendingDown size={16} />
            </div>
            <div className="depreciation-card__metric-content">
              <span className="depreciation-card__metric-label">累计折旧</span>
              <span className="depreciation-card__metric-value depreciation-card__metric-value--highlight">
                ¥{formatCurrency(data.accumulatedDepreciation)}
              </span>
            </div>
          </div>

          {/* 账面净值 */}
          <div className="depreciation-card__metric depreciation-card__metric--primary">
            <div className="depreciation-card__metric-icon">
              <DollarSign size={16} />
            </div>
            <div className="depreciation-card__metric-content">
              <span className="depreciation-card__metric-label">账面净值</span>
              <span className="depreciation-card__metric-value">
                ¥{formatCurrency(data.netBookValue)}
              </span>
            </div>
          </div>

          {/* 折旧进度 */}
          <div className="depreciation-card__metric">
            <div className="depreciation-card__metric-icon">
              <Calendar size={16} />
            </div>
            <div className="depreciation-card__metric-content">
              <span className="depreciation-card__metric-label">折旧进度</span>
              <span className="depreciation-card__metric-value">
                {formatPercentage(data.depreciationRate)}
              </span>
            </div>
          </div>
        </div>

        {/* 双倍余额递减法额外展示 */}
        {data.method === 'double_declining' && (
          <div className="depreciation-card__ddb-info">
            <span className="depreciation-card__ddb-rate">
              年折旧率: {formatPercentage(2 / Math.max(data.usefulLifeYears, 1))}
            </span>
            <span className="depreciation-card__ddb-year">
              本年折旧: ¥{formatCurrency(data.currentYearDepreciation)}
            </span>
          </div>
        )}
      </div>

      <div className="depreciation-card__footer">
        <span className="depreciation-card__calculated-at">
          计算时间: {data.calculatedAt || '—'}
        </span>
      </div>
    </div>
  );
};

export default DepreciationCard;

// 保留命名组件导出；类型和工具函数已在声明处导出。
export { DepreciationCard };
