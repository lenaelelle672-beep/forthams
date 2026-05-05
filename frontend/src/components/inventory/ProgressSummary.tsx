import React from 'react';
import { Card, Progress, Row, Col, Statistic } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  InboxOutlined,
} from '@ant-design/icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * ProgressSummary 组件的 Props 接口定义。
 *
 * 纯展示组件，接收盘点统计数据，渲染进度条与统计摘要卡片。
 * 对应 Spec Phase P3-010-C（盘点执行详情页 — 进度条 + 统计摘要）。
 */
export interface ProgressSummaryProps {
  /** 总资产数量 */
  total: number;
  /** 已盘点资产数量 */
  counted: number;
  /** 盘盈数量（绿色） */
  surplus: number;
  /** 盘亏数量（红色） */
  deficit: number;
  /** 进度百分比 (0-100)，保留 1 位小数 */
  progress: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 格式化进度百分比为保留 1 位小数的字符串。
 *
 * 符合 Spec 约束「进度百分比精确到小数点后 1 位」，
 * 并满足 ATB-003 校验「顶部进度条显示 60.0%」。
 *
 * @param percent - Ant Design Progress 传入的当前百分比值，可能为 undefined
 * @returns 格式化后的百分比字符串，如 "60.0%"、"100.0%"
 */
const formatProgressPercent = (percent: number | undefined): string => {
  const safePercent = percent ?? 0;
  return `${safePercent.toFixed(1)}%`;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ProgressSummary — 盘点进度条 + 统计摘要卡片 (P3-010-C)
 *
 * 纯展示组件，接收统计数据 props，实时展示盘点任务的进度概览。
 * 包含：
 * - 顶部进度条，百分比保留 1 位小数
 * - 统计卡片行：总资产、已盘（蓝色）、未盘（灰色）、盘盈（绿色）、盘亏（红色）
 *
 * @example
 * ```tsx
 * <ProgressSummary
 *   total={100}
 *   counted={60}
 *   surplus={2}
 *   deficit={3}
 *   progress={60.0}
 * />
 * ```
 *
 * @param props - 组件属性
 * @param props.total - 总资产数量
 * @param props.counted - 已盘点资产数量
 * @param props.surplus - 盘盈数量
 * @param props.deficit - 盘亏数量
 * @param props.progress - 进度百分比 (0-100)，保留 1 位小数
 * @returns React 元素
 */
export const ProgressSummary: React.FC<ProgressSummaryProps> = ({
  total,
  counted,
  surplus,
  deficit,
  progress,
}) => {
  /** 未盘点数量：总数 − 已盘数，下限为 0 防止负值 */
  const uncounted = Math.max(0, total - counted);

  /** 盘点是否已全部完成 */
  const isCompleted = progress >= 100;

  return (
    <Card
      title="盘点进度概览"
      bordered={false}
      style={{ marginBottom: 16 }}
      aria-label="盘点进度概览"
    >
      {/* ---- 进度条：顶部展示，百分比保留 1 位小数 ---- */}
      <Progress
        percent={progress}
        format={formatProgressPercent}
        status={isCompleted ? 'success' : 'active'}
        style={{ marginBottom: 24 }}
        aria-label={`盘点进度 ${progress.toFixed(1)}%`}
      />

      {/* ---- 统计摘要卡片 ---- */}
      <Row gutter={[16, 16]}>
        {/* 总资产 */}
        <Col xs={12} sm={4}>
          <Statistic
            title="总资产"
            value={total}
            suffix="件"
            valueStyle={{ color: '#595959' }}
            prefix={<InboxOutlined />}
            aria-label={`总资产 ${total} 件`}
          />
        </Col>

        {/* 已盘 */}
        <Col xs={12} sm={4}>
          <Statistic
            title="已盘"
            value={counted}
            suffix="件"
            valueStyle={{ color: '#1890ff' }}
            prefix={<CheckCircleOutlined />}
            aria-label={`已盘 ${counted} 件`}
          />
        </Col>

        {/* 未盘（由 total - counted 派生） */}
        <Col xs={12} sm={4}>
          <Statistic
            title="未盘"
            value={uncounted}
            suffix="件"
            valueStyle={{ color: '#8c8c8c' }}
            prefix={<ExclamationCircleOutlined />}
            aria-label={`未盘 ${uncounted} 件`}
          />
        </Col>

        {/* 盘盈 — 绿色 (ATB-003) */}
        <Col xs={12} sm={4}>
          <Statistic
            title="盘盈"
            value={surplus}
            suffix="件"
            valueStyle={{ color: '#52c41a' }}
            prefix={<ArrowUpOutlined />}
            aria-label={`盘盈 ${surplus} 件`}
          />
        </Col>

        {/* 盘亏 — 红色 (ATB-003) */}
        <Col xs={12} sm={4}>
          <Statistic
            title="盘亏"
            value={deficit}
            suffix="件"
            valueStyle={{ color: '#ff4d4f' }}
            prefix={<ArrowDownOutlined />}
            aria-label={`盘亏 ${deficit} 件`}
          />
        </Col>
      </Row>
    </Card>
  );
};

export default ProgressSummary;