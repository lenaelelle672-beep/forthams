/**
 * AssetDepreciationTimeline Component
 *
 * 展示资产折旧计划的时间线视图。
 * 按折旧期间逐条展示每期折旧额、累计折旧及账面净值。
 *
 * @module components/AssetDepreciationTimeline
 * @since SWARM-033
 */

import React from 'react';
import { Timeline, Empty, Spin, Tag, Descriptions, Card } from 'antd';

/**
 * 单条折旧明细
 */
export interface DepreciationDetailItem {
  id: string | number;
  period: string;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  netValue: number;
  depreciationRate?: number;
}

/**
 * 折旧计划数据
 */
export interface DepreciationScheduleData {
  assetId?: string | number;
  assetNo?: string;
  assetName?: string;
  methodName?: string;
  method?: string;
  originalValue?: number;
  salvageValue?: number;
  salvageRate?: number;
  usefulLifeYears?: number;
  startDate?: string;
  details: DepreciationDetailItem[];
  assetStatus?: string;
}

interface AssetDepreciationTimelineProps {
  /** 折旧计划数据，null 表示无折旧 */
  schedule: DepreciationScheduleData | null;
  /** 加载状态 */
  loading?: boolean;
}

/**
 * 格式化金额
 */
const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null) return '-';
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * 格式化百分比
 */
const formatPercent = (value: number | undefined): string => {
  if (value === undefined || value === null) return '-';
  return `${(value * 100).toFixed(2)}%`;
};

/**
 * AssetDepreciationTimeline 组件
 *
 * @param props - 组件属性
 * @returns 折旧时间线 JSX
 */
const AssetDepreciationTimeline: React.FC<AssetDepreciationTimelineProps> = ({
  schedule,
  loading = false,
}) => {
  if (loading) {
    return (
      <div data-testid="depreciation-loading" style={{ textAlign: 'center', padding: '24px 0' }}>
        <Spin tip="折旧数据加载中..." />
      </div>
    );
  }

  if (!schedule) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="该资产暂无折旧数据（如土地类资产不折旧）"
        data-testid="depreciation-empty"
      />
    );
  }

  const details = schedule.details || [];

  return (
    <div data-testid="depreciation-timeline">
      {/* 折旧汇总信息 */}
      <Card size="small" className="depreciation-summary-card" style={{ marginBottom: 16 }}>
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="折旧方法">
            <Tag color="blue">{schedule.methodName || schedule.method || '-'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="原值">
            {formatCurrency(schedule.originalValue)}
          </Descriptions.Item>
          <Descriptions.Item label="预计残值">
            {formatCurrency(schedule.salvageValue)}
          </Descriptions.Item>
          <Descriptions.Item label="残值率">
            {formatPercent(schedule.salvageRate)}
          </Descriptions.Item>
          <Descriptions.Item label="折旧年限">
            {schedule.usefulLifeYears ? `${schedule.usefulLifeYears} 年` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="折旧开始日期">
            {schedule.startDate || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 折旧明细时间线 */}
      {details.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无折旧明细记录"
          data-testid="depreciation-details-empty"
        />
      ) : (
        <Timeline
          mode="left"
          items={details.map((item) => ({
            color: item.depreciationAmount > 0 ? 'blue' : 'gray',
            children: (
              <div data-testid={`depreciation-item-${item.period}`}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  <Tag color={item.depreciationAmount > 0 ? 'blue' : 'default'}>
                    {item.period}
                  </Tag>
                </div>
                <Descriptions column={3} size="small">
                  <Descriptions.Item label="本期折旧">
                    <span style={{ color: '#1890ff' }}>
                      {formatCurrency(item.depreciationAmount)}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="累计折旧">
                    {formatCurrency(item.accumulatedDepreciation)}
                  </Descriptions.Item>
                  <Descriptions.Item label="账面净值">
                    {formatCurrency(item.netValue)}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            ),
          }))}
        />
      )}
    </div>
  );
};

export default AssetDepreciationTimeline;
