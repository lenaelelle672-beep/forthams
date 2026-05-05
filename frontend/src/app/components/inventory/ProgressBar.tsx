import React, { useMemo } from 'react';
import { Card, Col, Row, Statistic, Progress, Space, Typography, Spin } from 'antd';
import {
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * ProgressBar — 盘点执行详情页顶部进度看板组件
 *
 * 渲染盘点任务的进度条与 5 个核心统计指标卡片：
 *   总资产数 / 已盘 / 未盘 / 盘盈 / 盘亏
 *
 * @see SWARM-P3-010-FE — ATB-03 验收基准
 */

/** 进度看板组件属性 */
export interface IInventoryProgressProps {
  /** 任务范围内总资产数 */
  totalCount?: number;
  /** 已盘点资产数 */
  scannedCount?: number;
  /** 盘盈数量（账面无、实盘有） */
  surplusCount?: number;
  /** 盘亏数量（账面有、实盘无） */
  deficitCount?: number;
  /** 数据是否正在加载 */
  loading?: boolean;
}

const ProgressBar: React.FC<IInventoryProgressProps> = ({
  totalCount = 0,
  scannedCount = 0,
  surplusCount = 0,
  deficitCount = 0,
  loading = false,
}) => {
  /* ---- derived values ---- */

  /** 未盘数量 */
  const pendingCount = useMemo(
    () => Math.max(totalCount - scannedCount, 0),
    [totalCount, scannedCount],
  );

  /** 盘点完成百分比（0-100，取整） */
  const progressPercentage = useMemo(() => {
    if (totalCount <= 0) return 0;
    return Math.min(Math.round((scannedCount / totalCount) * 100), 100);
  }, [totalCount, scannedCount]);

  /** Ant Design Progress 组件的 status */
  const progressStatus: 'success' | 'exception' | 'active' | 'normal' = useMemo(() => {
    if (progressPercentage >= 100) {
      return deficitCount > 0 ? 'exception' : 'success';
    }
    return progressPercentage > 0 ? 'active' : 'normal';
  }, [progressPercentage, deficitCount]);

  /* ---- early returns ---- */

  if (loading) {
    return (
      <Card variant="outlined" style={{ marginBottom: 24, borderRadius: 8 }}>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip="加载盘点进度..." />
        </div>
      </Card>
    );
  }

  if (!totalCount) {
    return (
      <Card variant="outlined" style={{ marginBottom: 24, borderRadius: 8 }}>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text type="secondary">暂无盘点数据，请创建任务或选择已有任务</Text>
        </div>
      </Card>
    );
  }

  /* ---- main render ---- */

  return (
    <Card
      variant="outlined"
      style={{ marginBottom: 24, borderRadius: 8 }}
      title={
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            盘点进度概览
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Inventory Progress
          </Text>
        </Space>
      }
      extra={
        <Text strong style={{ fontSize: 16 }}>
          {progressPercentage}% 已完成
        </Text>
      }
    >
      {/* ---- 主进度条 ---- */}
      <Progress
        percent={progressPercentage}
        status={progressStatus}
        size="default"
        style={{ marginBottom: 24 }}
      />

      {/* ---- 5 个核心统计卡片（ATB-03） ---- */}
      <Row gutter={[24, 16]}>
        {/* 总资产数 */}
        <Col xs={24} sm={12} md={8} lg={4} xl={4}>
          <Statistic
            title="总资产数"
            value={totalCount}
            prefix={<FileTextOutlined />}
            valueStyle={{ fontWeight: 700 }}
          />
        </Col>

        {/* 已盘 */}
        <Col xs={24} sm={12} md={8} lg={4} xl={4}>
          <Statistic
            title="已盘"
            value={scannedCount}
            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            valueStyle={{
              fontWeight: 700,
              color: scannedCount > 0 ? '#52c41a' : 'inherit',
            }}
          />
        </Col>

        {/* 未盘 */}
        <Col xs={24} sm={12} md={8} lg={4} xl={4}>
          <Statistic
            title="未盘"
            value={pendingCount}
            prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
            valueStyle={{
              fontWeight: 700,
              color: pendingCount > 0 ? '#faad14' : 'inherit',
            }}
          />
        </Col>

        {/* 盘盈 */}
        <Col xs={24} sm={12} md={8} lg={4} xl={4}>
          <Statistic
            title="盘盈"
            value={surplusCount}
            prefix={<ArrowUpOutlined style={{ color: '#1890ff' }} />}
            valueStyle={{
              fontWeight: 700,
              color: surplusCount > 0 ? '#1890ff' : 'inherit',
            }}
          />
        </Col>

        {/* 盘亏 */}
        <Col xs={24} sm={12} md={8} lg={4} xl={4}>
          <Statistic
            title="盘亏"
            value={deficitCount}
            prefix={<ArrowDownOutlined style={{ color: '#ff4d4f' }} />}
            valueStyle={{
              fontWeight: 700,
              color: deficitCount > 0 ? '#ff4d4f' : 'inherit',
            }}
          />
        </Col>
      </Row>

      {/* ---- 差异提醒横幅 ---- */}
      {(surplusCount > 0 || deficitCount > 0) && (
        <div
          style={{
            marginTop: 24,
            padding: '12px 16px',
            backgroundColor: '#fff7e6',
            borderRadius: 6,
            borderLeft: '4px solid #ffa940',
          }}
        >
          <Text type="warning" strong>
            差异提醒：
          </Text>
          <span style={{ marginLeft: 8 }}>
            当前盘点存在 {surplusCount} 件盘盈资产，{deficitCount} 件盘亏资产。请核实后提交结果。
          </span>
        </div>
      )}
    </Card>
  );
};

export default React.memo(ProgressBar);