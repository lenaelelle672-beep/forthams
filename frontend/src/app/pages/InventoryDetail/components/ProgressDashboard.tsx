import React, { useMemo } from 'react';
import { Card, Col, Row, Statistic, Progress, Spin } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';

/**
 * 盘点汇总数据接口 —— 描述一次盘点任务的进度核心指标。
 */
export interface IInventorySummary {
  /** 任务范围内的资产总数 */
  totalAssets: number;
  /** 已完成盘点的资产数 */
  countedAssets: number;
  /** 尚未盘点的资产数 */
  uncountedAssets: number;
  /** 盘盈数量（账面无、实盘有） */
  surplusCount: number;
  /** 盘亏数量（账面有、实盘无） */
  shortageCount: number;
}

/** ProgressDashboard 组件属性 */
export interface ProgressDashboardProps {
  /** 盘点汇总数据 */
  summary: IInventorySummary;
  /** 数据加载状态 */
  loading?: boolean;
}

/**
 * 盘点进度看板卡片配置
 */
interface StatCardConfig {
  key: string;
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

/**
 * ProgressDashboard — 盘点执行详情页顶部进度看板
 *
 * 职责：
 * 1. 根据 summary 数据计算并渲染盘点进度百分比（Progress 组件）。
 * 2. 渲染五个核心统计卡片：总资产数 / 已盘 / 未盘 / 盘盈 / 盘亏。
 * 3. 对外仅依赖 `IInventorySummary` 纯数据接口，不发起 API 调用。
 *
 * @param props.summary  - 盘点汇总统计数据
 * @param props.loading  - 是否处于加载态
 */
const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  summary,
  loading = false,
}) => {
  const { totalAssets, countedAssets, uncountedAssets, surplusCount, shortageCount } = summary;

  /** 计算盘点进度百分比 */
  const progressPercent = useMemo(() => {
    if (totalAssets <= 0) return 0;
    return Math.round((countedAssets / totalAssets) * 100);
  }, [totalAssets, countedAssets]);

  /** 五个统计卡片的配置列表 */
  const statisticCards: StatCardConfig[] = useMemo(
    () => [
      {
        key: 'totalAssets',
        title: '总资产数',
        value: totalAssets,
        icon: <DatabaseOutlined />,
        color: '#1890ff',
      },
      {
        key: 'countedAssets',
        title: '已盘',
        value: countedAssets,
        icon: <CheckCircleOutlined />,
        color: '#52c41a',
      },
      {
        key: 'uncountedAssets',
        title: '未盘',
        value: uncountedAssets,
        icon: <CloseCircleOutlined />,
        color: '#faad14',
      },
      {
        key: 'surplusCount',
        title: '盘盈',
        value: surplusCount,
        icon: <PlusCircleOutlined />,
        color: '#13c2c2',
      },
      {
        key: 'shortageCount',
        title: '盘亏',
        value: shortageCount,
        icon: <MinusCircleOutlined />,
        color: '#ff4d4f',
      },
    ],
    [totalAssets, countedAssets, uncountedAssets, surplusCount, shortageCount],
  );

  return (
    <Spin spinning={loading}>
      <div
        data-testid="progress-dashboard"
        style={{ marginBottom: 24 }}
      >
        {/* ── 进度条区域 ── */}
        <Card
          bordered={false}
          style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          styles={{ body: { padding: '16px 24px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                whiteSpace: 'nowrap',
                color: '#595959',
              }}
            >
              盘点进度
            </span>
            <Progress
              data-testid="inventory-progress-bar"
              percent={progressPercent}
              status={progressPercent === 100 ? 'success' : 'active'}
              strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <span
              data-testid="progress-percent-text"
              style={{
                fontWeight: 700,
                fontSize: 16,
                whiteSpace: 'nowrap',
                color: '#1890ff',
                minWidth: 48,
                textAlign: 'right',
              }}
            >
              {progressPercent}%
            </span>
          </div>
        </Card>

        {/* ── 五个统计卡片 ── */}
        <Row gutter={[16, 16]}>
          {statisticCards.map((card) => (
            <Col key={card.key} xs={24} sm={12} md={8} lg={4} flex="1 1 0%">
              <Card
                bordered={false}
                style={{
                  borderRadius: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  textAlign: 'center',
                }}
                styles={{ body: { padding: '20px 12px' } }}
              >
                <div data-testid={`stat-card-${card.key}`}>
                  <Statistic
                    title={
                      <span style={{ fontSize: 13, color: '#8c8c8c' }}>
                        {card.title}
                      </span>
                    }
                    value={card.value}
                    prefix={
                      <span style={{ color: card.color, marginRight: 4 }}>
                        {card.icon}
                      </span>
                    }
                    valueStyle={{ color: card.color, fontWeight: 600 }}
                  />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </Spin>
  );
};

export default ProgressDashboard;