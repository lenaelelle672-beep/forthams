import React from 'react';
import { Card, Row, Col, Skeleton } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { AssetOverviewDTO } from '../../types/dashboard.types';
import styles from './AssetOverviewStat.module.css';

/**
 * 资产总览统计卡片组件
 * 
 * 展示资产总数、在线数、离线数、告警数四项核心指标
 * 支持趋势指示、正负值颜色区分、响应式布局
 * 
 * @param data - 资产统计数据
 * @param loading - 加载状态
 */
export interface AssetOverviewStatProps {
  data?: AssetOverviewDTO;
  loading?: boolean;
}

// 趋势方向类型
type TrendDirection = 'up' | 'down' | 'neutral';

/**
 * 解析趋势值为方向类型
 */
const parseTrendDirection = (trend: number | undefined | null): TrendDirection => {
  if (trend === undefined || trend === null || trend === 0) return 'neutral';
  return trend > 0 ? 'up' : 'down';
};

/**
 * 格式化数值显示
 * - 超过999,500截断显示"999K+"
 * - 0显示"0"
 * - null/undefined显示"--"
 */
const formatValue = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '--';
  if (value === 0) return '0';
  // C-001: 资产总数展示上限 999,999，超过截断显示 "999K+"
  if (value >= 999500) return '999K+';
  return value.toLocaleString('zh-CN');
};

/**
 * 解析趋势字符串为数值
 */
const parseTrendValue = (trend?: string | number): number | undefined => {
  if (trend === undefined || trend === null) return undefined;
  if (typeof trend === 'number') return trend;
  // 解析 "+5.2%" 或 "-3.1%" 格式
  const match = String(trend).match(/^[+-]?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : undefined;
};

/**
 * 单个统计卡片组件
 */
interface StatCardProps {
  label: string;
  value: number | undefined | null;
  trend?: string | number;
  color?: string;
  loading?: boolean;
  isCritical?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  trend,
  color,
  loading = false,
  isCritical = false,
}) => {
  const trendValue = parseTrendValue(trend);
  const trendDirection = parseTrendDirection(trendValue);

  const getTrendIcon = () => {
    if (trendDirection === 'up') {
      return <ArrowUpOutlined className={styles.trendIconUp} />;
    }
    if (trendDirection === 'down') {
      return <ArrowDownOutlined className={styles.trendIconDown} />;
    }
    return null;
  };

  const getTrendClassName = () => {
    if (trendDirection === 'up') return styles.trendUp;
    if (trendDirection === 'down') return styles.trendDown;
    return styles.trendNeutral;
  };

  if (loading) {
    return (
      <Card className={`${styles.statCard} ${isCritical ? styles.critical : ''}`}>
        <Skeleton active paragraph={{ rows: 1 }} />
      </Card>
    );
  }

  return (
    <Card 
      className={`${styles.statCard} ${isCritical ? styles.critical : ''}`}
      style={color ? { borderLeftColor: color, borderLeftWidth: '3px' } : undefined}
    >
      <div className={styles.cardContent}>
        <div className={styles.label}>{label}</div>
        <div className={styles.valueWrapper}>
          <span className={styles.value}>{formatValue(value)}</span>
          {trendValue !== undefined && (
            <span className={`${styles.trend} ${getTrendClassName()}`}>
              {getTrendIcon()}
              <span>{Math.abs(trendValue).toFixed(1)}%</span>
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};

/**
 * 资产总览统计组件
 * 
 * 展示四项核心指标：
 * - 资产总数 (total)
 * - 在线数 (online)
 * - 离线数 (offline)
 * - 告警数 (warning)
 */
const AssetOverviewStat: React.FC<AssetOverviewStatProps> = ({ data, loading = false }) => {
  const stats = [
    {
      label: '资产总数',
      value: data?.total,
      trend: data?.totalTrend,
      key: 'total',
    },
    {
      label: '在线数',
      value: data?.online,
      trend: data?.onlineTrend,
      key: 'online',
    },
    {
      label: '离线数',
      value: data?.offline,
      trend: data?.offlineTrend,
      key: 'offline',
    },
    {
      label: '告警数',
      value: data?.warning,
      trend: data?.warningTrend,
      key: 'warning',
      isCritical: true,
    },
  ];

  return (
    <div className={styles.container} data-testid="asset-overview-stat">
      <Row gutter={[16, 16]}>
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={6} key={stat.key}>
            <StatCard
              label={stat.label}
              value={stat.value}
              trend={stat.trend}
              loading={loading}
              isCritical={stat.isCritical}
            />
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default AssetOverviewStat;