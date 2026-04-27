/**
 * AssetInfoCard Component
 * 
 * 资产基础信息卡片组件，用于在资产详情页面展示资产的核心属性信息。
 * 支持加载状态骨架屏和错误状态展示。
 * 
 * @module AssetDetailView
 * @see {@link https://spec.example.com/swarm-051| SWARM-051 规格文档}
 * 
 * @example
 * // 基础用法
 * <AssetInfoCard asset={assetData} />
 * 
 * // 加载状态
 * <AssetInfoCard isLoading={true} />
 * 
 * // 错误状态
 * <AssetInfoCard error={new Error('加载失败')} />
 */

import React from 'react';
import { Card, Skeleton, Alert, Descriptions, Tag, Space, Typography } from 'antd';
import {
  InfoCircleOutlined,
  BuildOutlined,
  TeamOutlined,
  CalendarOutlined,
  DashboardOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { AntDesign } = Skeleton;

export interface Asset {
  /** 资产唯一标识 (UUID 格式) */
  id: string;
  /** 资产名称 */
  name: string;
  /** 资产类型 */
  type: 'SERVER' | 'LAPTOP' | 'MONITOR' | 'PRINTER' | 'NETWORK_DEVICE' | 'STORAGE' | 'OTHER';
  /** 资产状态 */
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'SCRAPPED' | 'TRANSFERRED';
  /** 归属部门 */
  department: string;
  /** 创建时间 (ISO 8601 格式) */
  createdAt: string;
  /** 资产编号 (可选) */
  assetCode?: string;
  /** 资产描述 (可选) */
  description?: string;
}

export interface AssetInfoCardProps {
  /** 资产数据对象 */
  asset: Asset | null;
  /** 是否处于加载状态 */
  isLoading?: boolean;
  /** 错误信息对象 */
  error?: Error | null;
  /** 自定义类名 */
  className?: string;
}

/**
 * 获取资产类型对应的图标
 * 
 * @param type - 资产类型枚举值
 * @returns 对应的 Ant Design 图标组件
 */
const getAssetTypeIcon = (type: Asset['type']) => {
  const iconMap: Record<Asset['type'], React.ReactNode> = {
    SERVER: <BuildOutlined />,
    LAPTOP: <DashboardOutlined />,
    MONITOR: <DashboardOutlined />,
    PRINTER: <BuildOutlined />,
    NETWORK_DEVICE: <BuildOutlined />,
    STORAGE: <DashboardOutlined />,
    OTHER: <InfoCircleOutlined />
  };
  return iconMap[type] || iconMap.OTHER;
};

/**
 * 获取资产类型对应的展示标签
 * 
 * @param type - 资产类型枚举值
 * @returns 人类可读的类型标签
 */
const getAssetTypeLabel = (type: Asset['type']): string => {
  const labelMap: Record<Asset['type'], string> = {
    SERVER: '服务器',
    LAPTOP: '笔记本电脑',
    MONITOR: '显示器',
    PRINTER: '打印机',
    NETWORK_DEVICE: '网络设备',
    STORAGE: '存储设备',
    OTHER: '其他设备'
  };
  return labelMap[type] || type;
};

/**
 * 获取资产状态对应的颜色标签
 * 
 * @param status - 资产状态枚举值
 * @returns Ant Design Tag 的 color 属性
 */
const getStatusColor = (status: Asset['status']): string => {
  const colorMap: Record<Asset['status'], string> = {
    ACTIVE: 'success',
    INACTIVE: 'default',
    MAINTENANCE: 'processing',
    SCRAPPED: 'error',
    TRANSFERRED: 'warning'
  };
  return colorMap[status] || 'default';
};

/**
 * 获取资产状态对应的中文标签
 * 
 * @param status - 资产状态枚举值
 * @returns 人类可读的状态标签
 */
const getStatusLabel = (status: Asset['status']): string => {
  const labelMap: Record<Asset['status'], string> = {
    ACTIVE: '在用',
    INACTIVE: '闲置',
    MAINTENANCE: '维护中',
    SCRAPPED: '已报废',
    TRANSFERRED: '已转移'
  };
  return labelMap[status] || status;
};

/**
 * 格式化日期显示
 * 
 * @param isoDate - ISO 8601 格式的日期字符串
 * @returns 格式化的日期字符串 (YYYY-MM-DD)
 */
const formatDate = (isoDate: string): string => {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return isoDate;
  }
};

/**
 * 资产信息卡片骨架屏组件
 * 
 * 在数据加载过程中显示骨架屏，提供视觉反馈。
 */
const AssetInfoCardSkeleton: React.FC = () => (
  <Card className="asset-info-card">
    <Skeleton active paragraph={{ rows: 3 }} />
  </Card>
);

/**
 * 资产信息卡片错误状态组件
 * 
 * @param error - 错误信息对象
 */
const AssetInfoCardError: React.FC<{ error: Error }> = ({ error }) => (
  <Alert
    type="error"
    message="资产信息加载失败"
    description={error.message || '请稍后重试或联系管理员'}
    showIcon
    icon={<InfoCircleOutlined />}
  />
);

/**
 * 资产基础信息卡片主组件
 * 
 * @param props - 组件属性
 * @returns 资产信息卡片 JSX 元素
 */
export const AssetInfoCard: React.FC<AssetInfoCardProps> = ({
  asset,
  isLoading = false,
  error = null,
  className = ''
}) => {
  // 错误状态渲染
  if (error) {
    return <AssetInfoCardError error={error} />;
  }

  // 加载状态渲染
  if (isLoading || !asset) {
    return <AssetInfoCardSkeleton />;
  }

  return (
    <Card 
      className={`asset-info-card ${className}`}
      title={
        <Space>
          {getAssetTypeIcon(asset.type)}
          <span>资产基本信息</span>
        </Space>
      }
      bordered={false}
    >
      <Descriptions
        column={2}
        size="small"
        labelStyle={{ fontWeight: 500, color: '#666' }}
        contentStyle={{ color: '#333' }}
      >
        <Descriptions.Item 
          label={
            <Space>
              <InfoCircleOutlined />
              资产名称
            </Space>
          }
          span={2}
        >
          <Title level={5} style={{ margin: 0 }}>
            {asset.name}
          </Title>
        </Descriptions.Item>

        <Descriptions.Item 
          label={
            <Space>
              {getAssetTypeIcon(asset.type)}
              资产类型
            </Space>
          }
        >
          <Tag color="blue" icon={getAssetTypeIcon(asset.type)}>
            {getAssetTypeLabel(asset.type)}
          </Tag>
        </Descriptions.Item>

        <Descriptions.Item 
          label={
            <Space>
              <DashboardOutlined />
              资产状态
            </Space>
          }
        >
          <Tag color={getStatusColor(asset.status)}>
            {getStatusLabel(asset.status)}
          </Tag>
        </Descriptions.Item>

        <Descriptions.Item 
          label={
            <Space>
              <TeamOutlined />
              归属部门
            </Space>
          }
        >
          <Text>{asset.department}</Text>
        </Descriptions.Item>

        <Descriptions.Item 
          label={
            <Space>
              <CalendarOutlined />
              创建时间
            </Space>
          }
        >
          <Text type="secondary">{formatDate(asset.createdAt)}</Text>
        </Descriptions.Item>

        {asset.assetCode && (
          <Descriptions.Item label="资产编号">
            <Text code>{asset.assetCode}</Text>
          </Descriptions.Item>
        )}

        {asset.description && (
          <Descriptions.Item label="资产描述" span={2}>
            <Text type="secondary">{asset.description}</Text>
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );
};

/**
 * AssetInfoCard 默认导出
 */
export default AssetInfoCard;