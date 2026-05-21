/**
 * @file AuditLogDetailDrawer.tsx
 * @description 审计日志详情抽屉组件
 * 
 * 功能说明：
 * - 展示审计日志的详细信息
 * - 显示字段变更对比（旧值 → 新值）
 * - 支持@Auditable标记字段的高亮显示
 * 
 * @module components/audit
 */

import React, { useMemo } from 'react';
import { Drawer, Descriptions, Tag, Timeline, Typography, Space, Divider } from 'antd';
import {
  ClockCircleOutlined,
  UserOutlined,
  LaptopOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { DrawerProps } from 'antd';

const { Title, Text, Paragraph } = Typography;

/**
 * 审计日志操作类型枚举
 */
export enum AuditOperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
}

/**
 * 字段变更数据类型
 */
export interface FieldChange {
  /** 字段名称 */
  fieldName: string;
  /** 旧值 */
  oldValue: string | null;
  /** 新值 */
  newValue: string | null;
  /** 是否为@Auditable标记字段 */
  isAuditable: boolean;
}

/**
 * 审计日志数据类型
 */
export interface AuditLogDetail {
  /** 审计日志ID */
  id: string;
  /** 关联资产ID */
  assetId: string;
  /** 操作类型 */
  operationType: AuditOperationType;
  /** 操作人ID */
  operatorId: string;
  /** 操作人名称 */
  operatorName: string;
  /** 操作人IP地址 */
  operatorIp: string;
  /** 操作时间 */
  operationTime: string;
  /** 字段变更列表 */
  fieldChanges: FieldChange[];
  /** 变更原因（可选） */
  changeReason?: string;
}

/**
 * 审计日志详情抽屉组件属性
 */
export interface AuditLogDetailDrawerProps extends Omit<DrawerProps, 'onClose'> {
  /** 审计日志详情数据 */
  auditLog: AuditLogDetail | null;
  /** 抽屉关闭回调 */
  onClose: () => void;
  /** 是否可见 */
  visible: boolean;
}

/**
 * 根据操作类型获取对应的图标
 * @param operationType - 操作类型
 * @returns 对应的图标组件
 */
const getOperationIcon = (operationType: AuditOperationType): React.ReactNode => {
  const iconStyle = { marginRight: 8 };
  switch (operationType) {
    case AuditOperationType.CREATE:
      return <PlusOutlined style={{ ...iconStyle, color: '#52c41a' }} />;
    case AuditOperationType.UPDATE:
      return <EditOutlined style={{ ...iconStyle, color: '#1890ff' }} />;
    case AuditOperationType.DELETE:
      return <DeleteOutlined style={{ ...iconStyle, color: '#ff4d4f' }} />;
    case AuditOperationType.VIEW:
      return <EyeOutlined style={{ ...iconStyle, color: '#8c8c8c' }} />;
    default:
      return <ClockCircleOutlined style={{ ...iconStyle, color: '#8c8c8c' }} />;
  }
};

/**
 * 根据操作类型获取对应的颜色
 * @param operationType - 操作类型
 * @returns 颜色值
 */
const getOperationColor = (operationType: AuditOperationType): string => {
  switch (operationType) {
    case AuditOperationType.CREATE:
      return '#52c41a';
    case AuditOperationType.UPDATE:
      return '#1890ff';
    case AuditOperationType.DELETE:
      return '#ff4d4f';
    case AuditOperationType.VIEW:
      return '#8c8c8c';
    default:
      return '#8c8c8c';
  }
};

/**
 * 格式化日期时间显示
 * @param dateString - ISO格式日期字符串
 * @returns 格式化后的日期字符串
 */
const formatDateTime = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateString;
  }
};

/**
 * 字段变更行组件
 * @param fieldChange - 字段变更数据
 * @param index - 序号
 */
const FieldChangeRow: React.FC<{ fieldChange: FieldChange; index: number }> = ({
  fieldChange,
  index,
}) => {
  const { fieldName, oldValue, newValue, isAuditable } = fieldChange;

  return (
    <Descriptions.Item
      label={
        <Space>
          <Text strong>{fieldName}</Text>
          {isAuditable && (
            <Tag color="gold" style={{ marginLeft: 4 }}>
              @Auditable
            </Tag>
          )}
        </Space>
      }
    >
      <div
        style={{
          backgroundColor: isAuditable ? '#fff3cd' : undefined,
          padding: '4px 8px',
          borderRadius: 4,
        }}
      >
        {oldValue !== null && oldValue !== undefined && (
          <>
            <Text delete style={{ color: '#ff4d4f', marginRight: 8 }}>
              {oldValue}
            </Text>
            <Text style={{ color: '#8c8c8c', marginRight: 8 }}>→</Text>
          </>
        )}
        {newValue !== null && newValue !== undefined && (
          <Text strong style={{ color: '#52c41a' }}>
            {newValue}
          </Text>
        )}
        {(oldValue === null || oldValue === undefined) &&
          (newValue === null || newValue === undefined) && (
            <Text type="secondary">-</Text>
          )}
      </div>
    </Descriptions.Item>
  );
};

/**
 * 审计日志详情抽屉组件
 * 
 * @description 展示审计日志的详细信息，包括：
 * - 基本信息（操作时间、操作人、IP地址等）
 * - 字段变更列表及对比
 * - @Auditable标记字段高亮显示
 * 
 * @example
 * ```tsx
 * <AuditLogDetailDrawer
 *   visible={isDrawerVisible}
 *   auditLog={selectedAuditLog}
 *   onClose={() => setIsDrawerVisible(false)}
 * />
 * ```
 */
const AuditLogDetailDrawer: React.FC<AuditLogDetailDrawerProps> = ({
  auditLog,
  visible,
  onClose,
  ...drawerProps
}) => {
  /**
   * 生成时间线数据
   */
  const timelineItems = useMemo(() => {
    if (!auditLog?.fieldChanges?.length) return [];

    return auditLog.fieldChanges.map((change, index) => ({
      key: `${change.fieldName}-${index}`,
      color: change.isAuditable ? 'gold' : 'blue',
      children: (
        <div
          style={{
            backgroundColor: change.isAuditable ? '#fff3cd' : '#f0f5ff',
            padding: '8px 12px',
            borderRadius: 6,
          }}
        >
          <Text strong>{change.fieldName}</Text>
          {change.isAuditable && (
            <Tag color="gold" style={{ marginLeft: 8 }}>
              @Auditable
            </Tag>
          )}
          <div style={{ marginTop: 4 }}>
            {change.oldValue !== null && change.oldValue !== undefined && (
              <>
                <Text delete type="danger" style={{ marginRight: 8 }}>
                  {change.oldValue}
                </Text>
                <Text type="secondary" style={{ marginRight: 8 }}>
                  →
                </Text>
              </>
            )}
            {change.newValue !== null && change.newValue !== undefined && (
              <Text strong type="success">
                {change.newValue}
              </Text>
            )}
            {(change.oldValue === null || change.oldValue === undefined) &&
              (change.newValue === null || change.newValue === undefined) && (
                <Text type="secondary">无变更</Text>
              )}
          </div>
        </div>
      ),
    }));
  }, [auditLog?.fieldChanges]);

  /**
   * 获取操作类型描述
   */
  const getOperationDescription = (type: AuditOperationType): string => {
    switch (type) {
      case AuditOperationType.CREATE:
        return '创建资产';
      case AuditOperationType.UPDATE:
        return '更新资产';
      case AuditOperationType.DELETE:
        return '删除资产';
      case AuditOperationType.VIEW:
        return '查看资产';
      default:
        return '未知操作';
    }
  };

  return (
    <Drawer
      title={
        <Space>
          {auditLog && getOperationIcon(auditLog.operationType)}
          <span>审计日志详情</span>
        </Space>
      }
      placement="right"
      width={600}
      onClose={onClose}
      open={visible}
      destroyOnClose
      {...drawerProps}
    >
      {auditLog && (
        <>
          {/* 操作基本信息 */}
          <Title level={5} style={{ marginTop: 0 }}>
            <UserOutlined style={{ marginRight: 8 }} />
            操作信息
          </Title>
          <Descriptions
            bordered
            column={1}
            size="small"
            style={{ marginBottom: 24 }}
          >
            <Descriptions.Item label="操作类型">
              <Tag color={getOperationColor(auditLog.operationType)}>
                {getOperationDescription(auditLog.operationType)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="操作时间">
              <Space>
                <ClockCircleOutlined />
                {formatDateTime(auditLog.operationTime)}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="操作人">
              <Space>
                <UserOutlined />
                {auditLog.operatorName} ({auditLog.operatorId})
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="操作IP">
              <Space>
                <LaptopOutlined />
                {auditLog.operatorIp || '-'}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="关联资产ID">
              {auditLog.assetId}
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          {/* 变更原因 */}
          {auditLog.changeReason && (
            <>
              <Title level={5}>
                <EditOutlined style={{ marginRight: 8 }} />
                变更原因
              </Title>
              <Paragraph
                style={{
                  backgroundColor: '#ffffff',
                  padding: 12,
                  borderRadius: 6,
                  marginBottom: 24,
                }}
              >
                {auditLog.changeReason}
              </Paragraph>
              <Divider />
            </>
          )}

          {/* 字段变更详情 */}
          <Title level={5}>
            <EditOutlined style={{ marginRight: 8 }} />
            字段变更详情
          </Title>
          {auditLog.fieldChanges && auditLog.fieldChanges.length > 0 ? (
            <>
              {/* 表格形式展示 */}
              <Descriptions
                bordered
                column={1}
                size="small"
                style={{ marginBottom: 24 }}
              >
                {auditLog.fieldChanges.map((change, index) => (
                  <FieldChangeRow
                    key={`${change.fieldName}-${index}`}
                    fieldChange={change}
                    index={index}
                  />
                ))}
              </Descriptions>

              {/* 时间线形式展示 */}
              <Divider orientation="left">变更时间线</Divider>
              <Timeline
                items={timelineItems}
                style={{ marginTop: 16 }}
              />
            </>
          ) : (
            <Text type="secondary">无字段变更记录</Text>
          )}

          {/* 统计信息 */}
          <Divider />
          <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
            <Text type="secondary">
              总变更字段数：{auditLog.fieldChanges?.length || 0}
            </Text>
            <Text type="secondary">
              @Auditable字段：{auditLog.fieldChanges?.filter(c => c.isAuditable).length || 0}
            </Text>
          </Space>
        </>
      )}
    </Drawer>
  );
};

export default AuditLogDetailDrawer;