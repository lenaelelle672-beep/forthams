/**
 * AssetStatsPanel - 资产总览统计组件
 * 
 * 展示4类关键指标：
 * - 资产总量
 * - 资产分类数
 * - 资产状态分布
 * - 资产总价值
 * 
 * @module DashboardPage/AssetStatsPanel
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { Card, Skeleton, Alert, Button } from 'antd';
import { ReloadOutlined, FileTextOutlined, AppstoreOutlined, DashboardOutlined, DollarOutlined } from '@ant-design/icons';

/** 统计数据接口 */
interface StatData {
  /** 标签名称 */
  label: string;
  /** 当前数值 */
  value: number;
  /** 变化量 */
  change: number;
  /** 变化率（百分比） */
  changeRate: number;
  /** 图标类型 */
  iconType: 'total' | 'category' | 'status' | 'value';
}

/** API 响应数据接口 */
interface StatsApiResponse {
  /** 资产总数 */
  totalCount: number;
  /** 总数变化量 */
  totalChange: number;
  /** 分类数量 */
  categoryCount: number;
  /** 分类变化量 */
  categoryChange: number;
  /** 活跃资产数 */
  activeCount: number;
  /** 活跃资产变化量 */
  activeChange: number;
  /** 资产总价值 */
  totalValue: number;
  /** 价值变化量 */
  valueChange: number;
}

/** 组件 Props 接口 */
interface AssetStatsPanelProps {
  /** 自定义类名 */
  className?: string;
  /** 是否显示变化率 */
  showChange?: boolean;
  /** 刷新回调 */
  onRefresh?: () => void;
}

/** 数字格式化工具函数
 * @param value - 要格式化的数值
 * @returns 格式化后的字符串
 */
const formatNumber = (value: number): string => {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return value.toLocaleString('zh-CN');
};

/** 计算变化率
 * @param current - 当前值
 * @param previous - 之前值
 * @returns 变化率百分比
 */
const calculateChangeRate = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

/** 加载状态组件 */
const StatCardSkeleton: React.FC = () => (
  <Card className="stat-card stat-card-skeleton">
    <Skeleton active paragraph={{ rows: 2 }} />
  </Card>
);

/** 错误状态组件 */
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ 
  message = '数据加载失败', 
  onRetry 
}) => (
  <Alert
    className="stat-error-alert"
    type="error"
    message={message}
    action={
      onRetry ? (
        <Button 
          size="small" 
          icon={<ReloadOutlined />}
          onClick={onRetry}
        >
          重试
        </Button>
      ) : undefined
    }
    showIcon
  />
);

/** 无数据状态组件 */
const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <Card className="stat-card stat-card-empty">
    <div className="stat-empty-content">
      <span className="stat-empty-text">暂无{label}数据</span>
    </div>
  </Card>
);

/** 单个统计卡片组件 */
interface StatCardItemProps {
  data: StatData;
  showChange: boolean;
}

const StatCardItem: React.FC<StatCardItemProps> = ({ data, showChange }) => {
  const { label, value, change, changeRate, iconType } = data;

  // 图标映射
  const iconMap = {
    total: <FileTextOutlined />,
    category: <AppstoreOutlined />,
    status: <DashboardOutlined />,
    value: <DollarOutlined />,
  };

  // 判断变化趋势
  const isPositive = change >= 0;
  const changeClass = isPositive ? 'stat-change-positive' : 'stat-change-negative';

  return (
    <Card className="stat-card" hoverable>
      <div className="stat-card-content">
        <div className="stat-card-header">
          <div className="stat-card-icon">{iconMap[iconType]}</div>
          <span className="stat-card-label">{label}</span>
        </div>
        <div className="stat-card-body">
          <span className="stat-card-value">{formatNumber(value)}</span>
          {showChange && (
            <div className={`stat-card-change ${changeClass}`}>
              <span className="stat-change-value">
                {isPositive ? '+' : ''}{formatNumber(change)}
              </span>
              <span className="stat-change-rate">
                ({isPositive ? '+' : ''}{changeRate}%)
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

/** 模拟 API 调用
 * @returns Promise<StatsApiResponse>
 */
const fetchAssetStats = (): Promise<StatsApiResponse> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        totalCount: 12580,
        totalChange: 328,
        categoryCount: 156,
        categoryChange: 12,
        activeCount: 10842,
        activeChange: 256,
        totalValue: 89564200,
        valueChange: 1234560,
      });
    }, 500);
  });
};

/** 资产总览统计面板组件 */
const AssetStatsPanel: React.FC<AssetStatsPanelProps> = ({
  className = '',
  showChange = true,
  onRefresh,
}) => {
  // 状态管理
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatData[]>([]);

  /** 加载统计数据 */
  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchAssetStats();

      // 转换为 StatData 数组
      const statData: StatData[] = [
        {
          label: '资产总量',
          value: response.totalCount,
          change: response.totalChange,
          changeRate: calculateChangeRate(response.totalCount, response.totalCount - response.totalChange),
          iconType: 'total',
        },
        {
          label: '资产分类',
          value: response.categoryCount,
          change: response.categoryChange,
          changeRate: calculateChangeRate(response.categoryCount, response.categoryCount - response.categoryChange),
          iconType: 'category',
        },
        {
          label: '活跃资产',
          value: response.activeCount,
          change: response.activeChange,
          changeRate: calculateChangeRate(response.activeCount, response.activeCount - response.activeChange),
          iconType: 'status',
        },
        {
          label: '资产总价值',
          value: response.totalValue,
          change: response.valueChange,
          changeRate: calculateChangeRate(response.totalValue, response.totalValue - response.valueChange),
          iconType: 'value',
        },
      ];

      setStats(statData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(`加载统计数据失败: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadStats();
  }, []);

  // 渲染错误状态
  if (error) {
    return (
      <div className={`asset-stats-panel ${className}`}>
        <ErrorState message={error} onRetry={loadStats} />
      </div>
    );
  }

  // 渲染加载状态
  if (loading) {
    return (
      <div className={`asset-stats-panel ${className}`}>
        <div className="stat-cards-grid">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </div>
    );
  }

  // 渲染无数据状态
  if (stats.length === 0) {
    return (
      <div className={`asset-stats-panel ${className}`}>
        <EmptyState label="资产统计" />
      </div>
    );
  }

  // 渲染正常状态
  return (
    <div className={`asset-stats-panel ${className}`}>
      <div className="stat-cards-grid">
        {stats.map((stat, index) => (
          <StatCardItem key={index} data={stat} showChange={showChange} />
        ))}
      </div>
      {onRefresh && (
        <div className="stat-panel-actions">
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => {
              loadStats();
              onRefresh();
            }}
          >
            刷新数据
          </Button>
        </div>
      )}
    </div>
  );
};

export default AssetStatsPanel;