/**
 * AssetOperationHistory Component
 *
 * 展示资产的完整操作历史记录，聚合处置历史和维保记录。
 * 使用时间线方式按时间倒序排列，展示操作类型、操作人、时间及详情。
 *
 * @module components/AssetOperationHistory
 * @since SWARM-033
 */

import React from 'react';
import { Timeline, Empty, Spin, Tag, Space } from 'antd';
import { formatStatusLabel } from '../constants/assetStatus';

/**
 * 处置历史记录项
 */
export interface DisposalHistoryItem {
  id: number | string;
  disposalType: string;
  disposalTypeLabel?: string;
  workOrderNo?: string;
  status: string;
  applicantName?: string;
  approverName?: string;
  applyDate?: string;
  completedDate?: string;
  remark?: string;
  originalValue?: number;
  disposalValue?: number;
  createTime?: string;
  [key: string]: unknown;
}

/**
 * 维保记录项
 */
export interface MaintenanceHistoryItem {
  id: number | string;
  maintenanceType?: string;
  description?: string;
  status?: string;
  executorName?: string;
  startDate?: string;
  endDate?: string;
  cost?: number;
  remark?: string;
  createTime?: string;
  [key: string]: unknown;
}

/**
 * 统一操作历史条目
 */
export interface OperationHistoryEntry {
  id: string;
  /** 操作类型：disposal / maintenance / status_change */
  operationType: 'disposal' | 'maintenance' | 'status_change';
  /** 操作类型中文标签 */
  operationLabel: string;
  /** 操作状态 */
  status?: string;
  /** 操作人 */
  operatorName?: string;
  /** 操作时间 */
  timestamp: string;
  /** 详情 */
  details: Record<string, unknown>;
}

/**
 * 处置类型中文映射
 */
const DISPOSAL_TYPE_LABELS: Record<string, string> = {
  RETIRE: '退役',
  SCRAP: '报废',
  TRANSFER: '转让',
  COMPENSATION: '赔偿',
};

/**
 * 处置状态中文映射
 */
const DISPOSAL_STATUS_LABELS: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

/**
 * 操作类型颜色映射
 */
const OPERATION_TYPE_COLORS: Record<string, string> = {
  disposal: 'red',
  maintenance: 'green',
  status_change: 'blue',
};

interface AssetOperationHistoryProps {
  /** 操作历史条目列表 */
  entries: OperationHistoryEntry[];
  /** 加载状态 */
  loading?: boolean;
  /** 处置历史原始数据（可选，用于补充展示） */
  disposalHistory?: DisposalHistoryItem[];
  /** 维保历史原始数据（可选，用于补充展示） */
  maintenanceHistory?: MaintenanceHistoryItem[];
}

/**
 * 格式化金额
 */
const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null) return '-';
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * AssetOperationHistory 组件
 *
 * @param props - 组件属性
 * @returns 操作历史时间线 JSX
 */
const AssetOperationHistory: React.FC<AssetOperationHistoryProps> = ({
  entries,
  loading = false,
  disposalHistory = [],
  maintenanceHistory = [],
}) => {
  if (loading) {
    return (
      <div data-testid="operation-history-loading" style={{ textAlign: 'center', padding: '24px 0' }}>
        <Spin tip="操作历史加载中..." />
      </div>
    );
  }

  // 聚合处置和维保记录为统一时间线
  const allEntries: OperationHistoryEntry[] = [
    ...entries,
    // 补充处置记录
    ...disposalHistory
      .filter((d) => !entries.some((e) => e.id === `disposal-${d.id}`))
      .map((d) => ({
        id: `disposal-${d.id}`,
        operationType: 'disposal' as const,
        operationLabel: DISPOSAL_TYPE_LABELS[d.disposalType] || d.disposalTypeLabel || d.disposalType,
        status: DISPOSAL_STATUS_LABELS[d.status] || d.status,
        operatorName: d.applicantName,
        timestamp: d.applyDate || d.createTime || '',
        details: d as unknown as Record<string, unknown>,
      })),
    // 补充维保记录
    ...maintenanceHistory
      .filter((m) => !entries.some((e) => e.id === `maintenance-${m.id}`))
      .map((m) => ({
        id: `maintenance-${m.id}`,
        operationType: 'maintenance' as const,
        operationLabel: m.maintenanceType || '维保',
        status: m.status,
        operatorName: m.executorName,
        timestamp: m.startDate || m.createTime || '',
        details: m as unknown as Record<string, unknown>,
      })),
  ];

  // 按时间倒序排列
  allEntries.sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  if (allEntries.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无操作历史记录"
        data-testid="operation-history-empty"
      />
    );
  }

  return (
    <div data-testid="operation-history">
      <Timeline
        mode="left"
        items={allEntries.map((entry) => ({
          color: OPERATION_TYPE_COLORS[entry.operationType] || 'gray',
          children: (
            <div data-testid={`operation-entry-${entry.id}`}>
              <div style={{ marginBottom: 4 }}>
                <Space>
                  <Tag color={OPERATION_TYPE_COLORS[entry.operationType] || 'default'}>
                    {entry.operationLabel}
                  </Tag>
                  {entry.status && (
                    <Tag>{formatStatusLabel(entry.status)}</Tag>
                  )}
                </Space>
              </div>
              <div style={{ fontSize: 13, color: '#666' }}>
                <Space split="·">
                  {entry.operatorName && <span>{entry.operatorName}</span>}
                  {entry.timestamp && (
                    <span>{new Date(entry.timestamp).toLocaleString('zh-CN')}</span>
                  )}
                </Space>
              </div>
              {/* 处置详情 */}
              {entry.operationType === 'disposal' && entry.details && (
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  <Space split="·">
                    {(entry.details as DisposalHistoryItem).disposalValue !== undefined && (
                      <span>处置金额: {formatCurrency((entry.details as DisposalHistoryItem).disposalValue)}</span>
                    )}
                    {(entry.details as DisposalHistoryItem).remark && (
                      <span>{(entry.details as DisposalHistoryItem).remark}</span>
                    )}
                  </Space>
                </div>
              )}
              {/* 维保详情 */}
              {entry.operationType === 'maintenance' && entry.details && (
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  <Space split="·">
                    {(entry.details as MaintenanceHistoryItem).cost !== undefined && (
                      <span>维保费用: {formatCurrency((entry.details as MaintenanceHistoryItem).cost)}</span>
                    )}
                    {(entry.details as MaintenanceHistoryItem).endDate && (
                      <span>完成: {new Date((entry.details as MaintenanceHistoryItem).endDate!).toLocaleDateString('zh-CN')}</span>
                    )}
                  </Space>
                </div>
              )}
            </div>
          ),
        }))}
      />
    </div>
  );
};

export default AssetOperationHistory;
