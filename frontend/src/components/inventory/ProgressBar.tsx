import React, { useMemo } from 'react';
import { Card, Col, Row, Statistic, Progress } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';

/**
 * 盘点数据汇总接口
 * 用于进度看板展示的核心数据结构
 */
export interface IInventorySummary {
  /** 总资产数 */
  totalAssets: number;
  /** 已盘点数 */
  countedAssets: number;
  /** 盘盈数量（账面无，实物有） */
  surplusCount?: number;
  /** 盘亏数量（账面有，实物无） */
  deficitCount?: number;
}

/** ProgressBar 组件属性 */
export interface ProgressBarProps {
  /** 盘点汇总数据 */
  summary: IInventorySummary;
  /** 是否加载中 */
  loading?: boolean;
}

/**
 * 各统计卡片的响应式栅格布局配置
 * md 断点: 4 + 5×4 = 24 列，铺满整行
 * sm 断点: 每卡片 12 列，每行 2 个
 * xs 断点: 每卡片 24 列，每行 1 个
 */
const CARD_COL_SPANS: Record<string, number>[] = [
  { xs: 24, sm: 12, md: 4 },
  { xs: 24, sm: 12, md: 5 },
  { xs: 24, sm: 12, md: 5 },
  { xs: 24, sm: 12, md: 5 },
  { xs: 24, sm: 12, md: 5 },
];

/**
 * ProgressBar — 盘点进度看板组件
 *
 * 展示盘点任务执行进度的顶部看板，包含：
 * - 完成百分比进度条
 * - 5 个核心统计指标卡片：总资产数、已盘、未盘、盘盈、盘亏
 *
 * 符合 ATB-03 验收标准：
 * 顶部 Progress 百分比与 Mock 数据一致；
 * 五个统计卡片数值精确匹配。
 *
 * @param props.summary - 盘点汇总数据
 * @param props.loading - 加载状态
 * @returns 盘点进度看板 React 组件
 */
const ProgressBar: React.FC<ProgressBarProps> = ({ summary, loading = false }) => {
  /** 计算完成百分比（0–100），防止除零 */
  const progressPercentage = useMemo<number>(() => {
    if (summary.totalAssets <= 0) return 0;
    return Math.min(100, Math.round((summary.countedAssets / summary.totalAssets) * 100));
  }, [summary.totalAssets, summary.countedAssets]);

  /** 未盘点资产数 */
  const uncountedAssets = useMemo<number>(
    () => Math.max(0, summary.totalAssets - summary.countedAssets),
    [summary.totalAssets, summary.countedAssets],
  );

  /** 盘盈数量（账面无，实物有） */
  const surplusCount = summary.surplusCount ?? 0;
  /** 盘亏数量（账面有，实物无） */
  const deficitCount = summary.deficitCount ?? 0;

  /** 进度条状态：100% 时显示成功色，否则显示动态流动效果 */
  const progressStatus: 'success' | 'active' =
    progressPercentage === 100 ? 'success' : 'active';

  /** 五个核心统计卡片配置 */
  const statCards = [
    {
      title: '总资产数',
      value: summary.totalAssets,
      prefix: <DatabaseOutlined style={{ color: '#8c8c8c' }} />,
      valueStyle: undefined as React.CSSProperties | undefined,
      testId: 'stat-total-assets',
    },
    {
      title: '已盘',
      value: summary.countedAssets,
      prefix: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      valueStyle: { color: '#52c41a' },
      testId: 'stat-counted',
    },
    {
      title: '未盘',
      value: uncountedAssets,
      prefix: <ClockCircleOutlined style={{ color: '#faad14' }} />,
      valueStyle: { color: '#faad14' },
      testId: 'stat-uncounted',
    },
    {
      title: '盘盈',
      value: surplusCount,
      prefix: <ArrowUpOutlined />,
      valueStyle: { color: surplusCount > 0 ? '#52c41a' : undefined },
      testId: 'stat-surplus',
    },
    {
      title: '盘亏',
      value: deficitCount,
      prefix: <ArrowDownOutlined />,
      valueStyle: { color: deficitCount > 0 ? '#ff4d4f' : undefined },
      testId: 'stat-deficit',
    },
  ];

  return (
    <Card
      loading={loading}
      style={{ marginBottom: 16, borderRadius: 8 }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      {/* 顶部进度条 */}
      <Progress
        percent={progressPercentage}
        status={progressStatus}
        strokeColor={{ '0%': '#1890ff', '100%': '#52c41a' }}
        style={{ marginBottom: 20 }}
        data-testid="inventory-progress-bar"
      />

      {/* 五个核心统计指标卡片 */}
      <Row gutter={[16, 16]} data-testid="inventory-stat-cards">
        {statCards.map((card, index) => (
          <Col
            {...CARD_COL_SPANS[index]}
            key={card.title}
            style={index > 0 ? { borderLeft: '1px solid #f0f0f0' } : undefined}
          >
            <Statistic
              title={card.title}
              value={card.value}
              prefix={card.prefix}
              valueStyle={card.valueStyle}
              data-testid={card.testId}
            />
          </Col>
        ))}
      </Row>
    </Card>
  );
};

export default ProgressBar;