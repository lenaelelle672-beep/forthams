/**
 * AuditDetailDrawer.tsx
 * 
 * 审计详情抽屉组件
 * 
 * 功能说明:
 * - 展示单条审计记录的完整详情
 * - 支持 @Auditable 标记字段的高亮可视化
 * - 展示字段变更的旧值与新值对比
 * 
 * @module AuditLogModule
 * @see ATB-06: 审计详情抽屉展开验证
 */

import React, { useMemo } from 'react';
import {
  Drawer,
  Descriptions,
  Tag,
  Timeline,
  Typography,
  Space,
  Card,
  Tooltip,
  Empty,
  Spin,
  Alert
} from 'antd';
import {
  UserOutlined,
  ClockCircleOutlined,
  FieldBinaryOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  EyeOutlined,
  DownloadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import type { DescriptionsProps } from 'antd';

import { useAuditableFields } from '../../hooks/useAuditableFields';
import type { AuditLog, FieldChange } from '../types/audit.types';

const { Title, Text } = Typography;

/**
 * 操作类型与图标的映射关系
 */
const OPERATION_ICON_MAP: Record<string, React.ReactNode> = {
  CREATE: <PlusOutlined />,
  UPDATE: <EditOutlined />,
  DELETE: <DeleteOutlined />,
  VIEW: <EyeOutlined />,
  EXPORT: <DownloadOutlined />
};

/**
 * 操作类型与颜色的映射关系
 */
const OPERATION_COLOR_MAP: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  VIEW: 'default',
  EXPORT: 'purple'
};

/**
 * 字段变更行组件属性
 */
interface FieldChangeRowProps {
  change: FieldChange;
  index: number;
}

/**
 * 字段变更行组件
 * 
 * 展示单个字段的变更详情，支持 @Auditable 字段高亮显示
 * 
 * @param change - 字段变更数据
 * @param index - 变更索引，用于唯一键
 */
const FieldChangeRow: React.FC<FieldChangeRowProps> = ({ change, index }) => {
  const { isAuditable, getHighlightStyle } = useAuditableFields();
  
  const isAuditableField = change.auditable ?? isAuditable(change.field);
  const highlightStyle = isAuditableField ? getHighlightStyle(change.field) : undefined;

  return (
    <Timeline.Item
      key={`field-change-${index}`}
      dot={isAuditableField ? <WarningOutlined style={{ color: '#fa8c16' }} /> : <FieldBinaryOutlined />}
      color={isAuditableField ? 'orange' : 'blue'}
    >
      <Card size="small" style={highlightStyle}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space>
            <Text strong style={{ minWidth: 100 }}>
              {change.field}
            </Text>
            {isAuditableField && (
              <Tag color="orange" data-testid="auditable-badge">
                @Auditable
              </Tag>
            )}
          </Space>
          
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="旧值">
              <Text delete type="secondary" data-testid="old-value">
                {change.oldValue ?? '-'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="新值">
              <Text mark data-testid="new-value">
                {change.newValue ?? '-'}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Card>
    </Timeline.Item>
  );
};

/**
 * 审计详情抽屉组件属性
 */
export interface AuditDetailDrawerProps {
  /** 审计记录数据 */
  auditLog?: AuditLog;
  /** 抽屉是否可见 */
  open: boolean;
  /** 抽屉关闭回调 */
  onClose: () => void;
  /** 加载状态 */
  loading?: boolean;
  /** 错误信息 */
  error?: Error | null;
}

/**
 * 审计详情抽屉组件
 * 
 * 展示审计记录的完整详情，包括操作类型、操作人、时间戳、
 * 变更字段列表等。支持 @Auditable 字段的高亮显示。
 * 
 * @example
 * ```tsx
 * <AuditDetailDrawer
 *   auditLog={selectedAuditLog}
 *   open={drawerVisible}
 *   onClose={() => setDrawerVisible(false)}
 * />
 * ```
 * 
 * @param auditLog - 审计记录数据
 * @param open - 抽屉是否可见
 * @param onClose - 关闭回调
 * @param loading - 加载状态
 * @param error - 错误信息
 */
export const AuditDetailDrawer: React.FC<AuditDetailDrawerProps> = ({
  auditLog,
  open,
  onClose,
  loading = false,
  error = null
}) => {
  /**
   * 计算审计记录的基本信息描述项
   */
  const descriptionItems: DescriptionsProps['items'] = useMemo(() => {
    if (!auditLog) return [];

    return [
      {
        key: 'operation',
        label: '操作类型',
        children: (
          <Space data-testid="detail-operation">
            <Tag color={OPERATION_COLOR_MAP[auditLog.operation] || 'default'} icon={OPERATION_ICON_MAP[auditLog.operation]}>
              {auditLog.operation}
            </Tag>
          </Space>
        )
      },
      {
        key: 'operator',
        label: '操作人',
        children: (
          <Space data-testid="detail-operator">
            <UserOutlined />
            <Text>{auditLog.operator}</Text>
          </Space>
        )
      },
      {
        key: 'timestamp',
        label: '操作时间',
        children: (
          <Space data-testid="detail-timestamp">
            <ClockCircleOutlined />
            <Text>{auditLog.timestamp ? new Date(auditLog.timestamp).toLocaleString('zh-CN') : '-'}</Text>
          </Space>
        )
      },
      {
        key: 'assetId',
        label: '资产ID',
        children: (
          <Text copyable data-testid="detail-asset-id">
            {auditLog.assetId}
          </Text>
        )
      },
      {
        key: 'logId',
        label: '日志ID',
        children: (
          <Text copyable type="secondary" data-testid="detail-log-id">
            {auditLog.id}
          </Text>
        )
      }
    ];
  }, [auditLog]);

  /**
   * 统计 @Auditable 字段变更数量
   */
  const auditableChangesCount = useMemo(() => {
    if (!auditLog?.changes) return 0;
    return auditLog.changes.filter(c => c.auditable).length;
  }, [auditLog?.changes]);

  /**
   * 处理抽屉关闭事件
   */
  const handleClose = () => {
    onClose();
  };

  return (
    <Drawer
      title={
        <Space>
          <FieldBinaryOutlined />
          <span>审计详情</span>
          {auditLog && (
            <Tag color={OPERATION_COLOR_MAP[auditLog.operation]}>
              {auditLog.operation}
            </Tag>
          )}
        </Space>
      }
      placement="right"
      width={600}
      onClose={handleClose}
      open={open}
      data-testid="audit-detail-drawer"
      destroyOnClose
    >
      <Spin spinning={loading} tip="加载审计详情...">
        {error && (
          <Alert
            message="加载失败"
            description={error.message}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {!auditLog && !loading && !error && (
          <Empty description="暂无审计记录详情" />
        )}

        {auditLog && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 基本信息卡片 */}
            <Card title="基本信息" size="small">
              <Descriptions
                items={descriptionItems}
                column={1}
                size="small"
              />
            </Card>

            {/* IP 地址信息（如果有） */}
            {auditLog.ipAddress && (
              <Card title="操作环境" size="small">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="IP地址">
                    <Text copyable data-testid="detail-ip-address">
                      {auditLog.ipAddress}
                    </Text>
                  </Descriptions.Item>
                  {auditLog.userAgent && (
                    <Descriptions.Item label="User Agent">
                      <Tooltip title={auditLog.userAgent}>
                        <Text type="secondary" ellipsis style={{ maxWidth: 400 }}>
                          {auditLog.userAgent}
                        </Text>
                      </Tooltip>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}

            {/* 变更详情区域 */}
            <Card
              title={
                <Space>
                  <span>字段变更</span>
                  {auditableChangesCount > 0 && (
                    <Tag color="orange">
                      {auditableChangesCount} 个 @Auditable 字段
                    </Tag>
                  )}
                  <Tag>{auditLog.changes?.length || 0} 项变更</Tag>
                </Space>
              }
              size="small"
              data-testid="changes-card"
            >
              {auditLog.changes && auditLog.changes.length > 0 ? (
                <Timeline mode="left" style={{ marginTop: 16 }}>
                  {auditLog.changes.map((change, index) => (
                    <FieldChangeRow
                      key={`change-${index}`}
                      change={change}
                      index={index}
                    />
                  ))}
                </Timeline>
              ) : (
                <Empty description="暂无字段变更" />
              )}
            </Card>

            {/* 额外信息区域（如果有） */}
            {(auditLog.description || auditLog.reason) && (
              <Card title="备注信息" size="small">
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {auditLog.description && (
                    <div>
                      <Text type="secondary">描述：</Text>
                      <Text data-testid="detail-description">{auditLog.description}</Text>
                    </div>
                  )}
                  {auditLog.reason && (
                    <div>
                      <Text type="secondary">原因：</Text>
                      <Text data-testid="detail-reason">{auditLog.reason}</Text>
                    </div>
                  )}
                </Space>
              </Card>
            )}
          </Space>
        )}
      </Spin>
    </Drawer>
  );
};

/**
 * 审计详情抽屉组件默认导出
 */
export default AuditDetailDrawer;

/**
 * 类型导出
 */
export type { AuditDetailDrawerProps };