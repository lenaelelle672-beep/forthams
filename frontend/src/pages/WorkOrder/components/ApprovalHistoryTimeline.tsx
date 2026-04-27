/**
 * ApprovalHistoryTimeline.tsx
 *
 * 工单审批历史时间线组件。
 * 以 Ant Design Timeline 形式展示工单的历史审批记录，
 * 包含审批人、操作类型（通过/驳回）、审批意见与时间戳。
 *
 * @module WorkOrder/components/ApprovalHistoryTimeline
 * @see SPEC-SWARM-S5-001 前端审批UI - 审批历史时间线
 */

import React from 'react';
import { Timeline, Tag, Typography, Empty, Spin, Avatar, Tooltip } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleFilled,
  UserOutlined,
  MessageOutlined,
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 审批操作类型枚举 */
export type ApprovalActionType = 'APPROVE' | 'REJECT' | 'SUBMIT' | 'DELEGATE';

/**
 * 单条审批历史记录数据结构。
 * 对应后端 ApprovalHistory 数据模型。
 */
export interface ApprovalHistoryRecord {
  /** 记录唯一标识 */
  id: string;
  /** 关联工单 ID */
  workOrderId: string;
  /** 审批人用户 ID */
  approverId: string;
  /** 审批人姓名（展示用） */
  approverName: string;
  /** 审批人头像 URL（可选） */
  approverAvatar?: string;
  /** 审批操作类型 */
  action: ApprovalActionType;
  /** 审批意见（可为空） */
  comment?: string;
  /** 审批时间（ISO 8601 字符串） */
  createdAt: string;
}

/**
 * ApprovalHistoryTimeline 组件 Props。
 */
export interface ApprovalHistoryTimelineProps {
  /** 审批历史记录列表 */
  records: ApprovalHistoryRecord[];
  /** 数据加载中状态 */
  loading?: boolean;
  /** 自定义 CSS 类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/**
 * 根据审批操作类型返回对应的时间线节点图标与颜色配置。
 *
 * @param action - 审批操作类型
 * @returns 图标元素与颜色字符串
 */
function getTimelineDotConfig(action: ApprovalActionType): {
  dot: React.ReactNode;
  color: string;
} {
  switch (action) {
    case 'APPROVE':
      return {
        dot: (
          <CheckCircleFilled
            style={{ fontSize: 18, color: '#52c41a' }}
            aria-label="审批通过"
          />
        ),
        color: 'green',
      };
    case 'REJECT':
      return {
        dot: (
          <CloseCircleFilled
            style={{ fontSize: 18, color: '#ff4d4f' }}
            aria-label="审批驳回"
          />
        ),
        color: 'red',
      };
    case 'DELEGATE':
      return {
        dot: (
          <ClockCircleFilled
            style={{ fontSize: 18, color: '#faad14' }}
            aria-label="委托转审"
          />
        ),
        color: 'orange',
      };
    case 'SUBMIT':
    default:
      return {
        dot: (
          <ClockCircleFilled
            style={{ fontSize: 18, color: '#1677ff' }}
            aria-label="提交审批"
          />
        ),
        color: 'blue',
      };
  }
}

/**
 * 将审批操作类型转换为可读的中文标签文本。
 *
 * @param action - 审批操作类型
 * @returns 中文标签文本
 */
function getActionLabel(action: ApprovalActionType): string {
  const labelMap: Record<ApprovalActionType, string> = {
    APPROVE: '审批通过',
    REJECT: '审批驳回',
    SUBMIT: '提交审批',
    DELEGATE: '委托转审',
  };
  return labelMap[action] ?? action;
}

/**
 * 将审批操作类型映射到 Ant Design Tag 颜色。
 *
 * @param action - 审批操作类型
 * @returns Ant Design Tag 颜色字符串
 */
function getActionTagColor(action: ApprovalActionType): string {
  const colorMap: Record<ApprovalActionType, string> = {
    APPROVE: 'success',
    REJECT: 'error',
    SUBMIT: 'processing',
    DELEGATE: 'warning',
  };
  return colorMap[action] ?? 'default';
}

/**
 * 格式化 ISO 8601 时间字符串为本地化展示格式。
 *
 * @param isoString - ISO 8601 格式时间字符串
 * @returns 格式化后的本地时间字符串，若解析失败则返回原始字符串
 */
function formatDateTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

// ─────────────────────────────────────────────
// 子组件：单条审批记录内容
// ─────────────────────────────────────────────

/**
 * ApprovalRecordContent - 渲染单条审批历史记录的详细内容。
 *
 * @param props - 包含单条 ApprovalHistoryRecord 的 props
 */
const ApprovalRecordContent: React.FC<{ record: ApprovalHistoryRecord }> = ({
  record,
}) => {
  return (
    <div
      style={{
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 4,
      }}
      data-testid={`approval-record-${record.id}`}
    >
      {/* 审批人信息行 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <Avatar
          size="small"
          src={record.approverAvatar}
          icon={!record.approverAvatar ? <UserOutlined /> : undefined}
          style={{ flexShrink: 0 }}
        />
        <Text strong style={{ fontSize: 14 }}>
          {record.approverName}
        </Text>
        <Tag
          color={getActionTagColor(record.action)}
          style={{ marginLeft: 4, fontWeight: 600 }}
          data-testid={`approval-action-tag-${record.id}`}
        >
          {getActionLabel(record.action)}
        </Tag>
        <Tooltip title={record.createdAt}>
          <Text
            type="secondary"
            style={{ fontSize: 12, marginLeft: 'auto' }}
            data-testid={`approval-time-${record.id}`}
          >
            {formatDateTime(record.createdAt)}
          </Text>
        </Tooltip>
      </div>

      {/* 审批意见行（可选） */}
      {record.comment && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <MessageOutlined
            style={{ color: '#8c8c8c', marginTop: 3, fontSize: 13 }}
          />
          <Paragraph
            style={{ margin: 0, color: '#595959', fontSize: 13 }}
            data-testid={`approval-comment-${record.id}`}
          >
            {record.comment}
          </Paragraph>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * ApprovalHistoryTimeline - 工单审批历史时间线组件。
 *
 * 按时间顺序（最早在上）展示工单的所有审批历史节点，
 * 每个节点包含：审批人、操作类型标签、审批意见与时间戳。
 * 支持加载状态与空数据兜底展示。
 *
 * @param props - {@link ApprovalHistoryTimelineProps}
 * @returns JSX.Element
 *
 * @example
 * ```tsx
 * <ApprovalHistoryTimeline
 *   records={approvalHistory}
 *   loading={isLoading}
 * />
 * ```
 */
const ApprovalHistoryTimeline: React.FC<ApprovalHistoryTimelineProps> = ({
  records,
  loading = false,
  className,
}) => {
  if (loading) {
    return (
      <div
        style={{ textAlign: 'center', padding: '32px 0' }}
        data-testid="approval-timeline-loading"
      >
        <Spin tip="加载审批历史中..." size="default" />
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无审批历史记录"
        data-testid="approval-timeline-empty"
        style={{ padding: '24px 0' }}
      />
    );
  }

  /** 构造 Ant Design Timeline items 数组 */
  const timelineItems = records.map((record) => {
    const { dot } = getTimelineDotConfig(record.action);
    return {
      key: record.id,
      dot,
      children: <ApprovalRecordContent record={record} />,
    };
  });

  return (
    <div
      className={className}
      data-testid="approval-history-timeline"
      style={{ padding: '8px 0' }}
    >
      <Timeline
        mode="left"
        items={timelineItems}
        style={{ paddingLeft: 8 }}
      />
    </div>
  );
};

export default ApprovalHistoryTimeline;