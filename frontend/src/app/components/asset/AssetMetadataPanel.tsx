/**
 * AssetMetadataPanel 组件
 * 
 * 资产元数据面板组件，用于展示资产详情页面的资产基础信息和审计日志。
 * 
 * 功能实现:
 * - F-01: 资产基础信息展示（名称、类型、状态、归属部门、创建时间）
 * - F-02: 资产关联审计日志实时加载与分页展示
 * - F-03: @Auditable 注解标记字段变更的高亮可视化
 * - F-04: 审计日志筛选（按操作类型、时间范围、操作人）
 * - F-05: 审计记录详情折叠展开
 * 
 * @module components/asset/AssetMetadataPanel
 * @version SWARM-051 Phase 3
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Descriptions, Tag, Space, Spin, Alert, Typography, Divider, Badge } from 'antd';
import { 
  InfoCircleOutlined, 
  HistoryOutlined, 
  FilterOutlined, 
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import type { DescriptionsProps } from 'antd';

import { useAuditLogs } from '../../hooks/useAuditLogs';
import { useAuditableFields } from '../../hooks/useAuditableFields';
import { AuditFilter } from '../audit/AuditFilter';
import { AuditTable } from '../audit/AuditTable';
import { AuditDetailDrawer } from '../audit/AuditDetailDrawer';
import type { AuditLog, AuditFilterParams, FieldChange } from '../../types/audit.types';

const { Text, Title } = Typography;

/**
 * 资产状态枚举
 */
enum AssetStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  SCRAPPED = 'SCRAPPED'
}

/**
 * 操作类型枚举
 */
enum OperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT'
}

/**
 * 资产基础信息接口
 */
export interface AssetMetadata {
  id: string;
  name: string;
  type: string;
  status: AssetStatus;
  department: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  location?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchasePrice?: number;
}

/**
 * AssetMetadataPanel 组件属性接口
 */
export interface AssetMetadataPanelProps {
  /** 资产 ID */
  assetId: string;
  /** 资产基础信息 */
  asset: AssetMetadata | null;
  /** 加载状态 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: Error | null;
}

/**
 * 状态标签颜色映射
 */
const statusColorMap: Record<AssetStatus, string> = {
  [AssetStatus.ACTIVE]: 'green',
  [AssetStatus.INACTIVE]: 'default',
  [AssetStatus.MAINTENANCE]: 'orange',
  [AssetStatus.SCRAPPED]: 'red'
};

/**
 * 操作类型图标映射
 */
const operationIconMap: Record<OperationType, React.ReactNode> = {
  [OperationType.CREATE]: <CheckCircleOutlined />,
  [OperationType.UPDATE]: <ExclamationCircleOutlined />,
  [OperationType.DELETE]: <DeleteOutlined />,
  [OperationType.VIEW]: <EyeOutlined />,
  [OperationType.EXPORT]: <DownloadOutlined />
};

/**
 * 获取操作类型标签颜色
 * 
 * @param operation - 操作类型
 * @returns 标签颜色
 */
const getOperationColor = (operation: string): string => {
  const colorMap: Record<string, string> = {
    [OperationType.CREATE]: 'green',
    [OperationType.UPDATE]: 'blue',
    [OperationType.DELETE]: 'red',
    [OperationType.VIEW]: 'default',
    [OperationType.EXPORT]: 'purple'
  };
  return colorMap[operation] || 'default';
};

/**
 * 格式化日期时间
 * 
 * @param dateString - ISO 8601 格式日期字符串
 * @returns 格式化后的日期字符串
 */
const formatDateTime = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 格式化日期
 * 
 * @param dateString - ISO 8601 格式日期字符串
 * @returns 格式化后的日期字符串 (YYYY-MM-DD)
 */
const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

/**
 * AssetMetadataPanel 组件
 * 
 * 资产详情页面的主面板组件，整合资产基础信息和审计日志展示。
 * 
 * @param props - 组件属性
 * @returns React 组件
 */
export const AssetMetadataPanel: React.FC<AssetMetadataPanelProps> = ({
  assetId,
  asset,
  isLoading = false,
  error = null
}) => {
  // 状态管理
  const [filterParams, setFilterParams] = useState<AuditFilterParams>({
    page: 1,
    pageSize: 20
  });
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // 审计日志数据 Hook
  const {
    data: auditLogsData,
    isLoading: auditLogsLoading,
    error: auditLogsError,
    refetch: refetchAuditLogs
  } = useAuditLogs(assetId, filterParams);

  // @Auditable 字段可视化 Hook
  const { getAuditableHighlight } = useAuditableFields();

  // 分页配置
  const paginationConfig = useMemo(() => ({
    current: filterParams.page,
    pageSize: filterParams.pageSize,
    total: auditLogsData?.pagination?.total || 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) => 
      `第 ${range[0]} - ${range[1]} 条，共 ${total} 条`,
    onChange: (page: number, pageSize: number) => {
      setFilterParams(prev => ({ ...prev, page, pageSize }));
    }
  }), [filterParams, auditLogsData?.pagination?.total]);

  /**
   * 处理筛选参数变化
   * 
   * @param newFilters - 新的筛选参数
   */
  const handleFilterChange = useCallback((newFilters: AuditFilterParams) => {
    setFilterParams(prev => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  /**
   * 处理筛选重置
   */
  const handleFilterReset = useCallback(() => {
    setFilterParams({ page: 1, pageSize: 20 });
  }, []);

  /**
   * 处理审计日志点击
   * 
   * @param auditLog - 选中的审计日志
   */
  const handleAuditLogClick = useCallback((auditLog: AuditLog) => {
    // 对变更字段进行 @Auditable 高亮处理
    const highlightedChanges = auditLog.changes?.map(change => {
      const highlighted = getAuditableHighlight([change]);
      return highlighted[0] || change;
    });

    setSelectedAuditLog({
      ...auditLog,
      changes: highlightedChanges as FieldChange[]
    });
    setDrawerVisible(true);
  }, [getAuditableHighlight]);

  /**
   * 处理抽屉关闭
   */
  const handleDrawerClose = useCallback(() => {
    setDrawerVisible(false);
    setSelectedAuditLog(null);
  }, []);

  /**
   * 渲染资产基础信息卡片
   * 
   * @returns React 组件
   */
  const renderAssetInfoCard = (): React.ReactNode => {
    if (isLoading) {
      return (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">资产信息加载中...</Text>
            </div>
          </div>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
          <Alert
            message="资产信息加载失败"
            description={error.message}
            type="error"
            showIcon
          />
        </Card>
      );
    }

    if (!asset) {
      return (
        <Card>
          <Alert
            message="未找到资产信息"
            description="该资产不存在或已被删除"
            type="warning"
            showIcon
          />
        </Card>
      );
    }

    const assetDescriptionsItems: DescriptionsProps['items'] = [
      {
        key: 'name',
        label: '资产名称',
        children: <Text strong>{asset.name}</Text>
      },
      {
        key: 'type',
        label: '资产类型',
        children: <Tag color="blue">{asset.type}</Tag>
      },
      {
        key: 'status',
        label: '资产状态',
        children: (
          <Badge 
            status={asset.status === AssetStatus.ACTIVE ? 'success' : 'default'} 
            text={
              <Tag color={statusColorMap[asset.status]}>
                {asset.status}
              </Tag>
            }
          />
        )
      },
      {
        key: 'department',
        label: '归属部门',
        children: <Text>{asset.department}</Text>
      },
      {
        key: 'location',
        label: '存放地点',
        children: <Text>{asset.location || '-'}</Text>
      },
      {
        key: 'serialNumber',
        label: '序列号',
        children: <Text code>{asset.serialNumber || '-'}</Text>
      },
      {
        key: 'createdAt',
        label: '创建时间',
        children: (
          <Space>
            <ClockCircleOutlined />
            <Text>{formatDateTime(asset.createdAt)}</Text>
          </Space>
        )
      },
      {
        key: 'updatedAt',
        label: '更新时间',
        children: (
          <Space>
            <ClockCircleOutlined />
            <Text>{asset.updatedAt ? formatDateTime(asset.updatedAt) : '-'}</Text>
          </Space>
        )
      },
      {
        key: 'purchaseDate',
        label: '采购日期',
        children: <Text>{formatDate(asset.purchaseDate || '')}</Text>
      },
      {
        key: 'purchasePrice',
        label: '采购价格',
        children: asset.purchasePrice ? (
          <Text type="warning">¥{asset.purchasePrice.toLocaleString()}</Text>
        ) : (
          <Text type="secondary">-</Text>
        )
      }
    ];

    // 如果有描述信息，添加到最后
    if (asset.description) {
      assetDescriptionsItems.push({
        key: 'description',
        label: '资产描述',
        children: <Text>{asset.description}</Text>,
        span: 3
      });
    }

    return (
      <Card 
        title={
          <Space>
            <InfoCircleOutlined />
            <span>资产基础信息</span>
          </Space>
        }
        extra={
          <Tag color={statusColorMap[asset.status]}>
            {operationIconMap[asset.status === AssetStatus.ACTIVE ? OperationType.CREATE : OperationType.UPDATE]}
            {' '}
            {asset.status}
          </Tag>
        }
      >
        <Descriptions 
          column={{ xs: 1, sm: 2, md: 3 }}
          items={assetDescriptionsItems}
          bordered
          size="small"
        />
      </Card>
    );
  };

  /**
   * 渲染审计日志面板
   * 
   * @returns React 组件
   */
  const renderAuditLogPanel = (): React.ReactNode => {
    return (
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <span>审计日志</span>
            {auditLogsData?.pagination?.total !== undefined && (
              <Tag color="blue">{auditLogsData.pagination.total}</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Badge 
              status={auditLogsLoading ? 'processing' : 'success'} 
              text={auditLogsLoading ? '加载中' : '已同步'} 
            />
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* 筛选器 */}
          <div data-testid="audit-filter-section">
            <Space align="center" style={{ marginBottom: 16 }}>
              <FilterOutlined />
              <Text strong>筛选条件</Text>
            </Space>
            <AuditFilter
              initialValues={filterParams}
              onFilterChange={handleFilterChange}
              onReset={handleFilterReset}
            />
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* 错误提示 */}
          {auditLogsError && (
            <Alert
              message="审计日志加载失败"
              description={auditLogsError.message}
              type="error"
              showIcon
              action={
                <Text 
                  onClick={refetchAuditLogs} 
                  style={{ cursor: 'pointer', color: '#1677ff' }}
                >
                  重试
                </Text>
              }
            />
          )}

          {/* 审计日志表格 */}
          <div data-testid="audit-table-section">
            <AuditTable
              dataSource={auditLogsData?.items || []}
              loading={auditLogsLoading}
              pagination={paginationConfig}
              onRowClick={handleAuditLogClick}
              getAuditableHighlight={getAuditableHighlight}
            />
          </div>
        </Space>
      </Card>
    );
  };

  return (
    <div className="asset-metadata-panel" data-testid="asset-metadata-panel">
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 资产基础信息卡片 */}
        <div data-testid="asset-info-card">
          {renderAssetInfoCard()}
        </div>

        {/* 审计日志面板 */}
        <div data-testid="audit-log-panel">
          {assetId && renderAuditLogPanel()}
        </div>
      </Space>

      {/* 审计详情抽屉 */}
      <AuditDetailDrawer
        visible={drawerVisible}
        auditLog={selectedAuditLog}
        onClose={handleDrawerClose}
        getAuditableHighlight={getAuditableHighlight}
      />
    </div>
  );
};

export default AssetMetadataPanel;