/**
 * AssetDetailCard Component
 * 
 * 资产详情卡片组件 - 展示资产完整属性信息的核心组件
 * 
 * 功能特性:
 * - 资产基本信息、财务信息、运维信息分组展示
 * - 资产状态可视化指示器
 * - 资产标签展示
 * - 审计日志快速预览
 * - @Auditable标记字段变更高亮
 * 
 * @module components/audit/AssetDetailCard
 * @version 1.0.0
 * @author SWARM-051 Frontend Team
 */

import React, { useState, useCallback } from 'react';
import { Card, Descriptions, Tag, Badge, Button, Collapse, Tooltip, Space } from 'antd';
import {
  InfoCircleOutlined,
  DollarOutlined,
  ToolOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { DescriptionsProps } from 'antd';
import './AssetDetailCard.css';

/**
 * 资产状态枚举
 */
export enum AssetStatus {
  IN_USE = 'IN_USE',
  IDLE = 'IDLE',
  SCRAPPED = 'SCRAPPED',
  MAINTENANCE = 'MAINTENANCE',
  TRANSFERRED = 'TRANSFERRED',
}

/**
 * 资产状态配置
 */
const STATUS_CONFIG: Record<
  AssetStatus,
  { color: string; label: string; icon: React.ReactNode }
> = {
  [AssetStatus.IN_USE]: {
    color: 'green',
    label: '在用',
    icon: <CheckCircleOutlined />,
  },
  [AssetStatus.IDLE]: {
    color: 'gold',
    label: '闲置',
    icon: <ClockCircleOutlined />,
  },
  [AssetStatus.SCRAPPED]: {
    color: 'default',
    label: '报废',
    icon: <StopOutlined />,
  },
  [AssetStatus.MAINTENANCE]: {
    color: 'orange',
    label: '维修中',
    icon: <SyncOutlined spin />,
  },
  [AssetStatus.TRANSFERRED]: {
    color: 'blue',
    label: '已调拨',
    icon: <SyncOutlined />,
  },
};

/**
 * 属性分组枚举
 */
export enum AttributeGroup {
  BASIC = 'basic',
  FINANCIAL = 'financial',
  OPERATION = 'operation',
}

/**
 * 属性分组配置
 */
const GROUP_CONFIG: Record<
  AttributeGroup,
  { title: string; icon: React.ReactNode; defaultActive: boolean }
> = {
  [AttributeGroup.BASIC]: {
    title: '基本信息',
    icon: <InfoCircleOutlined />,
    defaultActive: true,
  },
  [AttributeGroup.FINANCIAL]: {
    title: '财务信息',
    icon: <DollarOutlined />,
    defaultActive: true,
  },
  [AttributeGroup.OPERATION]: {
    title: '运维信息',
    icon: <ToolOutlined />,
    defaultActive: false,
  },
};

/**
 * 字段变更信息接口
 */
export interface FieldChange {
  fieldName: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  isAuditable: boolean;
  changedAt?: string;
  changedBy?: string;
}

/**
 * 审计日志预览项接口
 */
export interface AuditLogPreview {
  id: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';
  operatorName: string;
  operationTime: string;
  summary: string;
}

/**
 * 资产详情数据接口
 */
export interface AssetDetailData {
  id: string;
  name: string;
  assetCode: string;
  category: string;
  status: AssetStatus;
  purchaseDate: string;
  originalValue: number;
  netValue: number;
  depreciation: number;
  location: string;
  keeper: string;
  maintenanceDate?: string;
  supplier?: string;
  serialNumber?: string;
  brand?: string;
  model?: string;
  department?: string;
  usageRate?: number;
  remarks?: string;
  tags?: string[];
  fieldChanges?: FieldChange[];
}

/**
 * AssetDetailCard 组件 Props 接口
 */
export interface AssetDetailCardProps {
  /** 资产详情数据 */
  asset: AssetDetailData;
  /** 审计日志预览列表 */
  auditLogs?: AuditLogPreview[];
  /** 是否显示审计日志模块 */
  showAuditLog?: boolean;
  /** 是否显示变更高亮 */
  showChangeHighlight?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 查看更多审计日志回调 */
  onViewMoreAuditLogs?: () => void;
  /** 审计日志项点击回调 */
  onAuditLogClick?: (logId: string) => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 格式化金额显示
 * @param value - 金额值
 * @returns 格式化后的金额字符串
 */
const formatCurrency = (value: number): string => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value);
};

/**
 * 格式化日期显示
 * @param dateString - 日期字符串
 * @returns 格式化后的日期字符串
 */
const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateString;
  }
};

/**
 * 获取操作类型配置
 * @param operationType - 操作类型
 * @returns 操作类型配置对象
 */
const getOperationTypeConfig = (
  operationType: AuditLogPreview['operationType']
): { color: string; label: string } => {
  const configMap: Record<AuditLogPreview['operationType'], { color: string; label: string }> = {
    CREATE: { color: 'green', label: '创建' },
    UPDATE: { color: 'blue', label: '更新' },
    DELETE: { color: 'red', label: '删除' },
    VIEW: { color: 'default', label: '查看' },
  };
  return configMap[operationType] || { color: 'default', label: '未知' };
};

/**
 * AssetDetailCard 组件
 * 
 * 资产详情卡片组件，用于展示资产的完整属性信息
 * 
 * @example
 * ```tsx
 * <AssetDetailCard
 *   asset={assetData}
 *   auditLogs={auditLogList}
 *   showAuditLog={true}
 *   showChangeHighlight={true}
 * />
 * ```
 */
export const AssetDetailCard: React.FC<AssetDetailCardProps> = ({
  asset,
  auditLogs = [],
  showAuditLog = true,
  showChangeHighlight = true,
  loading = false,
  onViewMoreAuditLogs,
  onAuditLogClick,
  className = '',
}) => {
  // 折叠面板激活的分组
  const [activeGroups, setActiveGroups] = useState<string[]>([
    AttributeGroup.BASIC,
    AttributeGroup.FINANCIAL,
  ]);

  /**
   * 处理折叠面板变化
   */
  const handleCollapseChange = useCallback((keys: string | string[]) => {
    setActiveGroups(Array.isArray(keys) ? keys : [keys]);
  }, []);

  /**
   * 渲染状态指示器
   */
  const renderStatusIndicator = useCallback(() => {
    const config = STATUS_CONFIG[asset.status] || STATUS_CONFIG[AssetStatus.IN_USE];
    return (
      <Badge
        status={config.color as 'success' | 'processing' | 'default' | 'error' | 'warning'}
        text={
          <span className="asset-status-text">
            {config.icon}
            <span style={{ marginLeft: 4 }}>{config.label}</span>
          </span>
        }
      />
    );
  }, [asset.status]);

  /**
   * 渲染资产标签
   */
  const renderTags = useCallback(() => {
    if (!asset.tags || asset.tags.length === 0) return null;
    return (
      <div className="asset-tags-container">
        <span className="asset-tags-label">资产标签：</span>
        <Space size={4} wrap>
          {asset.tags.map((tag, index) => (
            <Tag key={index} color="blue" className="asset-tag">
              {tag}
            </Tag>
          ))}
        </Space>
      </div>
    );
  }, [asset.tags]);

  /**
   * 判断字段是否有变更
   */
  const isFieldChanged = useCallback(
    (fieldName: string): FieldChange | undefined => {
      if (!showChangeHighlight || !asset.fieldChanges) return undefined;
      return asset.fieldChanges.find(
        (change) => change.fieldName === fieldName && change.isAuditable
      );
    },
    [asset.fieldChanges, showChangeHighlight]
  );

  /**
   * 渲染带变更高亮的字段值
   */
  const renderValueWithHighlight = useCallback(
    (
      value: React.ReactNode,
      fieldName: string,
      className?: string
    ): React.ReactNode => {
      const change = isFieldChanged(fieldName);
      if (!change) return value;

      return (
        <Tooltip
          title={
            <div className="change-tooltip">
              <div>
                <strong>旧值：</strong>
                <span className="old-value">{change.oldValue || '(空)'}</span>
              </div>
              <div>
                <strong>新值：</strong>
                <span className="new-value">{change.newValue || '(空)'}</span>
              </div>
              {change.changedAt && (
                <div className="change-time">
                  <strong>变更时间：</strong>
                  {formatDate(change.changedAt)}
                </div>
              )}
            </div>
          }
        >
          <span className={`field-changed ${className || ''}`}>
            {value}
            <ExclamationCircleOutlined className="changed-indicator" />
          </span>
        </Tooltip>
      );
    },
    [isFieldChanged]
  );

  /**
   * 基本信息项配置
   */
  const basicItems: DescriptionsProps['items'] = [
    {
      key: 'assetCode',
      label: '资产编号',
      children: renderValueWithHighlight(asset.assetCode, 'assetCode'),
      span: 2,
    },
    {
      key: 'category',
      label: '资产类别',
      children: renderValueWithHighlight(asset.category, 'category'),
    },
    {
      key: 'status',
      label: '资产状态',
      children: renderStatusIndicator(),
      span: 2,
    },
    {
      key: 'name',
      label: '资产名称',
      children: renderValueWithHighlight(asset.name, 'name'),
      span: 2,
    },
    {
      key: 'serialNumber',
      label: '序列号',
      children: asset.serialNumber || '-',
    },
    {
      key: 'brand',
      label: '品牌',
      children: asset.brand || '-',
    },
    {
      key: 'model',
      label: '型号',
      children: asset.model || '-',
    },
  ];

  /**
   * 财务信息项配置
   */
  const financialItems: DescriptionsProps['items'] = [
    {
      key: 'originalValue',
      label: '原值',
      children: renderValueWithHighlight(
        formatCurrency(asset.originalValue),
        'originalValue',
        'currency-value'
      ),
      span: 2,
    },
    {
      key: 'netValue',
      label: '净值',
      children: renderValueWithHighlight(
        formatCurrency(asset.netValue),
        'netValue',
        'currency-value'
      ),
    },
    {
      key: 'depreciation',
      label: '累计折旧',
      children: formatCurrency(asset.depreciation),
      span: 2,
    },
    {
      key: 'purchaseDate',
      label: '购置日期',
      children: renderValueWithHighlight(formatDate(asset.purchaseDate), 'purchaseDate'),
      span: 2,
    },
    {
      key: 'supplier',
      label: '供应商',
      children: asset.supplier || '-',
    },
  ];

  /**
   * 运维信息项配置
   */
  const operationItems: DescriptionsProps['items'] = [
    {
      key: 'location',
      label: '存放地点',
      children: renderValueWithHighlight(asset.location, 'location'),
      span: 2,
    },
    {
      key: 'department',
      label: '所属部门',
      children: renderValueWithHighlight(asset.department || '-', 'department'),
    },
    {
      key: 'keeper',
      label: '保管人',
      children: renderValueWithHighlight(asset.keeper, 'keeper'),
      span: 2,
    },
    {
      key: 'maintenanceDate',
      label: '最近维护日期',
      children: formatDate(asset.maintenanceDate),
      span: 2,
    },
    {
      key: 'usageRate',
      label: '使用率',
      children: asset.usageRate ? `${asset.usageRate}%` : '-',
    },
    {
      key: 'remarks',
      label: '备注',
      children: asset.remarks || '-',
      span: 3,
    },
  ];

  /**
   * 渲染分组内容
   */
  const renderGroupItems = (
    group: AttributeGroup,
    items: DescriptionsProps['items']
  ): React.ReactNode => {
    const config = GROUP_CONFIG[group];
    return (
      <Collapse.Item
        key={group}
        header={
          <span className="group-header">
            {config.icon}
            <span style={{ marginLeft: 8 }}>{config.title}</span>
          </span>
        }
        forceRender
      >
        <Descriptions
          column={{ xs: 1, sm: 2, md: 3 }}
          size="small"
          bordered
          items={items}
          className="asset-descriptions"
        />
      </Collapse.Item>
    );
  };

  /**
   * 渲染审计日志预览
   */
  const renderAuditLogPreview = useCallback((): React.ReactNode => {
    if (!showAuditLog || auditLogs.length === 0) return null;

    return (
      <div className="audit-log-preview">
        <div className="audit-log-header">
          <HistoryOutlined />
          <span style={{ marginLeft: 8 }}>最近变更</span>
        </div>
        <div className="audit-log-list">
          {auditLogs.slice(0, 5).map((log) => {
            const typeConfig = getOperationTypeConfig(log.operationType);
            return (
              <div
                key={log.id}
                className="audit-log-item"
                onClick={() => onAuditLogClick?.(log.id)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') onAuditLogClick?.(log.id);
                }}
              >
                <div className="audit-log-item-main">
                  <Tag color={typeConfig.color} className="audit-log-tag">
                    {typeConfig.label}
                  </Tag>
                  <span className="audit-log-summary">{log.summary}</span>
                </div>
                <div className="audit-log-meta">
                  <span className="audit-log-operator">{log.operatorName}</span>
                  <span className="audit-log-time">{formatDate(log.operationTime)}</span>
                </div>
              </div>
            );
          })}
        </div>
        {auditLogs.length > 5 && onViewMoreAuditLogs && (
          <div className="audit-log-footer">
            <Button type="link" onClick={onViewMoreAuditLogs} size="small">
              查看全部 ({auditLogs.length})
            </Button>
          </div>
        )}
      </div>
    );
  }, [auditLogs, showAuditLog, onAuditLogClick, onViewMoreAuditLogs]);

  return (
    <Card
      className={`asset-detail-card ${className}`}
      loading={loading}
      title={
        <div className="card-title">
          <InfoCircleOutlined />
          <span style={{ marginLeft: 8 }}>{asset.name}</span>
        </div>
      }
      extra={
        <div className="card-extra">
          {renderStatusIndicator()}
        </div>
      }
    >
      {/* 资产标签 */}
      {renderTags()}

      {/* 属性分组折叠面板 */}
      <Collapse
        activeKey={activeGroups}
        onChange={handleCollapseChange}
        className="asset-collapse"
        expandIconPosition="end"
      >
        {renderGroupItems(AttributeGroup.BASIC, basicItems)}
        {renderGroupItems(AttributeGroup.FINANCIAL, financialItems)}
        {renderGroupItems(AttributeGroup.OPERATION, operationItems)}
      </Collapse>

      {/* 审计日志预览 */}
      {renderAuditLogPreview()}
    </Card>
  );
};

/**
 * AssetDetailCard 组件导出
 */
export default AssetDetailCard;