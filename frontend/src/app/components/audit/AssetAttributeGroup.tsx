/**
 * AssetAttributeGroup 组件
 * 
 * 资产属性分组展示组件，用于在资产详情页面按分组展示资产的各类属性信息。
 * 支持折叠/展开操作，展开状态自动持久化到 localStorage。
 * 
 * @description 
 * - 基本信息分组：包含资产名称、编号、类别、状态、购置日期等
 * - 财务信息分组：包含原值、净值、累计折旧、折旧率等
 * - 运维信息分组：包含存放地点、保管人、最近保养等
 * - 变更历史分组：展示资产属性的变更记录
 * 
 * @module components/audit/AssetAttributeGroup
 * @requires antd
 * @requires react
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Collapse, Descriptions, Tag, Badge, Card, Space, Typography, Empty } from 'antd';
import type { CollapseProps } from 'antd';
import {
  InfoCircleOutlined,
  DollarOutlined,
  ToolOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * 资产属性分组Props接口
 * 
 * @interface AssetAttributeGroupProps
 */
export interface AssetAttributeGroupProps {
  /** 资产ID，用于localStorage key */
  assetId?: string;
  /** 资产基本信息 */
  basicInfo: {
    /** 资产名称 */
    name: string;
    /** 资产编号 */
    code: string;
    /** 资产类别 */
    category: string;
    /** 资产状态：using-在用、idle-闲置、scrapped-报废、maintenance-维修中 */
    status: string;
    /** 购置日期 */
    purchaseDate?: string;
    /** 资产描述 */
    description?: string;
  };
  /** 资产财务信息 */
  financialInfo: {
    /** 原值 */
    originalValue: number;
    /** 净值 */
    netValue: number;
    /** 累计折旧 */
    depreciation: number;
    /** 折旧方法 */
    depreciationMethod?: string;
    /** 使用年限（年） */
    usefulLife?: number;
    /** 残值 */
    salvageValue?: number;
  };
  /** 资产运维信息 */
  operationInfo: {
    /** 存放地点 */
    location: string;
    /** 保管人 */
    keeper: string;
    /** 所属部门 */
    department?: string;
    /** 最近保养日期 */
    maintenanceDate?: string;
    /** 下次保养日期 */
    nextMaintenanceDate?: string;
  };
  /** 审计日志信息（可选） */
  auditInfo?: {
    /** 最后修改时间 */
    lastModifiedTime?: string;
    /** 最后修改人 */
    lastModifiedBy?: string;
    /** 变更历史记录 */
    changeHistory?: Array<{
      /** 变更字段名 */
      field: string;
      /** 旧值 */
      oldValue: string;
      /** 新值 */
      newValue: string;
      /** 修改时间 */
      modifiedTime: string;
      /** 修改人 */
      modifiedBy: string;
    }>;
  };
  /** 是否只读模式，默认false */
  readOnly?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 日期格式化工具函数
 * 
 * @param {string} dateStr - ISO格式日期字符串
 * @returns {string} 格式化后的日期字符串 (YYYY-MM-DD)
 */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
};

/**
 * 状态徽章渲染函数
 * 
 * @param {string} status - 资产状态
 * @returns {React.ReactNode} 状态徽章组件
 */
const renderStatusBadge = (status: string): React.ReactNode => {
  const statusMap: Record<string, { color: string; text: string }> = {
    using: { color: 'success', text: '在用' },
    idle: { color: 'default', text: '闲置' },
    scrapped: { color: 'error', text: '报废' },
    maintenance: { color: 'warning', text: '维修中' },
  };

  const config = statusMap[status] || { color: 'default', text: status };
  return <Badge status={config.color as any} text={config.text} />;
};

/**
 * 资产属性分组组件
 * 
 * @component
 * @param {AssetAttributeGroupProps} props - 组件属性
 * @returns {React.FC} 资产属性分组组件
 * 
 * @example
 * ```tsx
 * <AssetAttributeGroup
 *   assetId="asset-001"
 *   basicInfo={{
 *     name: '联想ThinkPad T490',
 *     code: 'IT-2024-001',
 *     category: '电子设备',
 *     status: 'using',
 *     purchaseDate: '2024-01-15',
 *   }}
 *   financialInfo={{
 *     originalValue: 8500,
 *     netValue: 6800,
 *     depreciation: 1700,
 *     depreciationMethod: '直线法',
 *     usefulLife: 5,
 *   }}
 *   operationInfo={{
 *     location: '研发中心A栋201',
 *     keeper: '张三',
 *     department: '研发部',
 *     maintenanceDate: '2024-06-01',
 *   }}
 *   auditInfo={{
 *     lastModifiedTime: '2024-10-20 14:30:00',
 *     lastModifiedBy: '李四',
 *     changeHistory: [
 *       {
 *         field: '保管人',
 *         oldValue: '王五',
 *         newValue: '张三',
 *         modifiedTime: '2024-10-20 14:30:00',
 *         modifiedBy: '李四',
 *       },
 *     ],
 *   }}
 * />
 * ```
 */
const AssetAttributeGroup: React.FC<AssetAttributeGroupProps> = ({
  assetId,
  basicInfo,
  financialInfo,
  operationInfo,
  auditInfo,
  readOnly = false,
  className,
  style,
}) => {
  /** 展开状态 */
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['basic', 'financial', 'operation']);

  /**
   * 从localStorage恢复展开状态
   */
  useEffect(() => {
    if (assetId) {
      const savedState = localStorage.getItem(`asset-group-${assetId}-expanded`);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (Array.isArray(parsed)) {
            setExpandedKeys(parsed);
          }
        } catch (e) {
          console.warn('Failed to parse expanded state from localStorage:', e);
        }
      }
    }
  }, [assetId]);

  /**
   * 保存展开状态到localStorage
   * 
   * @param {string[]} keys - 展开的分组key数组
   */
  const handlePanelChange = (keys: string | string[]) => {
    const newKeys = Array.isArray(keys) ? keys : [keys];
    setExpandedKeys(newKeys);
    if (assetId) {
      try {
        localStorage.setItem(`asset-group-${assetId}-expanded`, JSON.stringify(newKeys));
      } catch (e) {
        console.warn('Failed to save expanded state to localStorage:', e);
      }
    }
  };

  /**
   * 计算折旧率
   */
  const depreciationRate = useMemo(() => {
    if (!financialInfo.originalValue || financialInfo.originalValue === 0) {
      return 0;
    }
    return (financialInfo.depreciation / financialInfo.originalValue) * 100;
  }, [financialInfo.originalValue, financialInfo.depreciation]);

  /**
   * 货币格式化工具函数
   * 
   * @param {number} value - 金额值
   * @returns {string} 格式化后的货币字符串
   */
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    });
  };

  /**
   * 生成基本信息分组项
   */
  const basicItems: CollapseProps['items'][number] = useMemo(() => ({
    label: (
      <span>
        <InfoCircleOutlined /> 基本信息
      </span>
    ),
    children: (
      <div style={{ padding: '4px 0' }}>
        <Descriptions column={2} size="small" colon={false}>
          <Descriptions.Item label="资产名称" span={2}>
            <Text strong>{basicInfo.name}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="资产编号">
            <Tag color="blue">{basicInfo.code}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="资产类别">
            <Tag>{basicInfo.category}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="资产状态">
            {renderStatusBadge(basicInfo.status)}
          </Descriptions.Item>
          <Descriptions.Item label="购置日期">
            {basicInfo.purchaseDate ? formatDate(basicInfo.purchaseDate) : '-'}
          </Descriptions.Item>
          {basicInfo.description && (
            <Descriptions.Item label="资产描述" span={2}>
              <Text type="secondary">{basicInfo.description}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>
    ),
    key: 'basic',
  }), [basicInfo]);

  /**
   * 生成财务信息分组项
   */
  const financialItems: CollapseProps['items'][number] = useMemo(() => {
    const rateColor = depreciationRate > 70 ? 'red' : depreciationRate > 50 ? 'orange' : 'green';
    return {
      label: (
        <span>
          <DollarOutlined /> 财务信息
        </span>
      ),
      children: (
        <div style={{ padding: '4px 0' }}>
          <Descriptions column={2} size="small" colon={false}>
            <Descriptions.Item label="原值">
              <Text>{formatCurrency(financialInfo.originalValue)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="净值">
              <Text type="success" strong>
                {formatCurrency(financialInfo.netValue)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="累计折旧">
              <Text type="danger">
                -{formatCurrency(financialInfo.depreciation)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="折旧率">
              <Tag color={rateColor}>
                {depreciationRate.toFixed(2)}%
              </Tag>
            </Descriptions.Item>
            {financialInfo.depreciationMethod && (
              <Descriptions.Item label="折旧方法">
                {financialInfo.depreciationMethod}
              </Descriptions.Item>
            )}
            {financialInfo.usefulLife !== undefined && (
              <Descriptions.Item label="使用年限">
                {financialInfo.usefulLife} 年
              </Descriptions.Item>
            )}
            {financialInfo.salvageValue !== undefined && (
              <Descriptions.Item label="残值">
                {formatCurrency(financialInfo.salvageValue)}
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>
      ),
      key: 'financial',
    };
  }, [financialInfo, depreciationRate]);

  /**
   * 生成运维信息分组项
   */
  const operationItems: CollapseProps['items'][number] = useMemo(() => ({
    label: (
      <span>
        <ToolOutlined /> 运维信息
      </span>
    ),
    children: (
      <div style={{ padding: '4px 0' }}>
        <Descriptions column={2} size="small" colon={false}>
          <Descriptions.Item label="存放地点">
            {operationInfo.location}
          </Descriptions.Item>
          <Descriptions.Item label="保管人">
            <Text strong>{operationInfo.keeper}</Text>
          </Descriptions.Item>
          {operationInfo.department && (
            <Descriptions.Item label="所属部门">
              <Tag color="purple">{operationInfo.department}</Tag>
            </Descriptions.Item>
          )}
          {operationInfo.maintenanceDate && (
            <Descriptions.Item label="最近保养">
              {formatDate(operationInfo.maintenanceDate)}
            </Descriptions.Item>
          )}
          {operationInfo.nextMaintenanceDate && (
            <Descriptions.Item label="下次保养">
              <Text type="warning">
                {formatDate(operationInfo.nextMaintenanceDate)}
              </Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>
    ),
    key: 'operation',
  }), [operationInfo]);

  /**
   * 生成变更历史分组项
   */
  const auditItems: CollapseProps['items'][number] | null = useMemo(() => {
    if (!auditInfo) return null;

    return {
      label: (
        <span>
          <ClockCircleOutlined /> 变更历史
        </span>
      ),
      children: (
        <div style={{ padding: '4px 0' }}>
          {auditInfo.lastModifiedTime && (
            <Space style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                最后修改: {formatDate(auditInfo.lastModifiedTime)}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                by {auditInfo.lastModifiedBy || '-'}
              </Text>
            </Space>
          )}
          {auditInfo.changeHistory && auditInfo.changeHistory.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {auditInfo.changeHistory.map((item, index) => (
                <Card
                  key={index}
                  size="small"
                  bordered={false}
                  style={{ background: '#fffbe6' }}
                >
                  <Space split={<ArrowRightOutlined style={{ color: '#faad14', fontSize: 10 }} />}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.field}
                    </Text>
                    <Text delete type="danger" style={{ fontSize: 12 }}>
                      {item.oldValue}
                    </Text>
                    <Text strong type="success" style={{ fontSize: 12 }}>
                      {item.newValue}
                    </Text>
                  </Space>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {formatDate(item.modifiedTime)} | {item.modifiedBy}
                    </Text>
                  </div>
                </Card>
              ))}
            </Space>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无变更记录"
              style={{ margin: '16px 0' }}
            />
          )}
        </div>
      ),
      key: 'audit',
    };
  }, [auditInfo]);

  /**
   * 构建所有分组项
   */
  const items: CollapseProps['items'] = useMemo(() => {
    const allItems: CollapseProps['items'] = [basicItems, financialItems, operationItems];
    if (auditItems) {
      allItems.push(auditItems);
    }
    return allItems;
  }, [basicItems, financialItems, operationItems, auditItems]);

  return (
    <div className={className} style={style}>
      <Collapse
        activeKey={expandedKeys}
        onChange={handlePanelChange}
        items={items}
        defaultActiveKey={['basic', 'financial', 'operation']}
        expandIconPosition="end"
        size="small"
      />
    </div>
  );
};

export default AssetAttributeGroup;
export { AssetAttributeGroup };
export type { AssetAttributeGroupProps };