/**
 * AssetInfoCard Component
 * 
 * 资产详情页面 - 资产基本信息卡片组件
 * 展示资产的核心字段信息，包括名称、类型、状态、创建时间、负责人等
 * 
 * @Auditable 字段会在 metadata.auditableFields 中标记的字段添加高亮样式
 * 用于合规性追溯和可视化标识
 * 
 * @see SWARM-051 - 前端集成-资产详情页面开发规格文档
 * @see REQ-051-02 - 资产基本信息卡片组件
 * @see REQ-051-06 - @Auditable 字段可视化高亮
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AssetDetail } from '@/types/asset.types';
import styles from './AssetInfoCard.module.css';

interface AssetInfoCardProps {
  /** 资产详情数据 */
  asset: AssetDetail;
  /** 自定义类名 */
  className?: string;
}

/**
 * 格式化日期为本地化显示格式
 * @param dateStr - ISO 8601 格式的日期字符串
 * @returns 格式化后的日期字符串 (YYYY-MM-DD HH:mm:ss)
 */
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * 判断字段是否为 @Auditable 字段
 * @param fieldName - 字段名称
 * @param auditableFields - @Auditable 字段列表
 * @returns 是否需要高亮
 */
const isAuditableField = (
  fieldName: string,
  auditableFields: string[] = []
): boolean => {
  return auditableFields.includes(fieldName);
};

/**
 * 获取状态徽章的样式类名
 * @param status - 资产状态
 * @returns 对应的样式类名
 */
const getStatusBadgeClass = (status: string): string => {
  const statusClassMap: Record<string, string> = {
    'ACTIVE': styles.statusActive,
    'INACTIVE': styles.statusInactive,
    'MAINTENANCE': styles.statusMaintenance,
    'RETIRED': styles.statusRetired,
    'PENDING': styles.statusPending,
  };
  return statusClassMap[status] || styles.statusDefault;
};

/**
 * AssetInfoCard 组件
 * 
 * 展示资产的基本信息卡片，包含以下核心字段：
 * - 资产名称 (@Auditable)
 * - 资产类型
 * - 资产状态 (@Auditable)
 * - 创建时间
 * - 负责人 (@Auditable)
 * - 更新时间
 * - 资产ID
 */
export const AssetInfoCard: React.FC<AssetInfoCardProps> = ({ 
  asset,
  className = ''
}) => {
  // 从 asset 对象中解构核心字段
  const {
    id,
    name,
    type,
    status,
    createdAt,
    updatedAt,
    owner,
    metadata = {}
  } = asset;

  // 获取 @Auditable 标记的字段列表
  const auditableFields: string[] = metadata?.auditableFields || [];

  return (
    <Card 
      className={`${styles.assetInfoCard} ${className}`}
      data-testid="asset-info-card"
    >
      <CardHeader className={styles.header}>
        <CardTitle className={styles.title}>资产基本信息</CardTitle>
        {id && (
          <span className={styles.assetId} data-testid="field-id">
            ID: {id}
          </span>
        )}
      </CardHeader>

      <CardContent className={styles.content}>
        {/* 资产名称 - @Auditable 字段 */}
        <div 
          className={`${styles.fieldRow} ${isAuditableField('name', auditableFields) ? styles.auditableHighlight : ''}`}
        >
          <span className={styles.fieldLabel}>资产名称</span>
          <span 
            className={styles.fieldValue}
            data-testid="field-name"
          >
            {name || '-'}
          </span>
        </div>

        {/* 资产类型 */}
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>资产类型</span>
          <span 
            className={styles.fieldValue}
            data-testid="field-type"
          >
            {type || '-'}
          </span>
        </div>

        {/* 资产状态 - @Auditable 字段 */}
        <div 
          className={`${styles.fieldRow} ${isAuditableField('status', auditableFields) ? styles.auditableHighlight : ''}`}
        >
          <span className={styles.fieldLabel}>资产状态</span>
          <Badge 
            className={`${styles.statusBadge} ${getStatusBadgeClass(status)}`}
            data-testid="field-status"
          >
            {status || '-'}
          </Badge>
        </div>

        {/* 创建时间 */}
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>创建时间</span>
          <span 
            className={styles.fieldValue}
            data-testid="field-created-at"
          >
            {createdAt ? formatDate(createdAt) : '-'}
          </span>
        </div>

        {/* 更新时间 */}
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>更新时间</span>
          <span 
            className={styles.fieldValue}
            data-testid="field-updated-at"
          >
            {updatedAt ? formatDate(updatedAt) : '-'}
          </span>
        </div>

        {/* 负责人 - @Auditable 字段 */}
        <div 
          className={`${styles.fieldRow} ${isAuditableField('owner', auditableFields) ? styles.auditableHighlight : ''}`}
        >
          <span className={styles.fieldLabel}>负责人</span>
          <span 
            className={styles.fieldValue}
            data-testid="field-owner"
          >
            {owner || '-'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssetInfoCard;