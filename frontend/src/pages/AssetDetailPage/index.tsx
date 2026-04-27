/**
 * AssetDetailPage Component
 * 
 * SWARM-051: 前端集成-资产详情页面开发
 * 
 * 功能说明:
 * - 资产详情展示主页面
 * - 集成审计日志展示模块
 * - 绑定 @Auditable 注解数据可视化
 * - 对接 AuditService 服务层
 * 
 * @module pages/AssetDetailPage
 * @version 1.0.0
 * @date 2024-01-15
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Spin, message, Empty, Tabs, Descriptions, Tag, Timeline, Avatar, Button } from 'antd';
import { 
  ArrowLeftOutlined, 
  HistoryOutlined, 
  InfoCircleOutlined, 
  ExclamationCircleOutlined,
  UserOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useAuditLogs } from './hooks/useAuditLogs';
import { useAuditableFields } from './hooks/useAuditableFields';
import { AuditLogPanel } from './components/AuditLogPanel';
import { AuditableFieldBadge } from './components/AuditableFieldBadge';
import { GraphifyPanel } from './components/GraphifyPanel';
import type { AssetDetail, AuditLogEntry, AuditableFieldConfig } from './types';

/**
 * AssetDetailPage 主组件
 * 
 * 负责渲染资产详情页面，包含：
 * - 资产基础信息展示
 * - 审计日志时间线
 * - Graphify 知识图谱节点可视化
 * - @Auditable 字段标记
 */
const AssetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // 状态管理
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('info');

  // 审计日志 Hook
  const {
    logs,
    loading: auditLoading,
    hasMore,
    loadMore,
    refresh: refreshAuditLogs,
    error: auditError
  } = useAuditLogs(id);

  // @Auditable 字段配置 Hook
  const {
    fields,
    getFieldChanges,
    isFieldAuditable,
    loading: fieldsLoading
  } = useAuditableFields(asset);

  /**
   * 获取资产详情数据
   * 
   * @description 从后端 API 获取指定资产 ID 的完整信息
   */
  const fetchAssetDetail = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/assets/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setAsset(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取资产详情失败';
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 初始化加载
  useEffect(() => {
    fetchAssetDetail();
  }, [fetchAssetDetail]);

  /**
   * 处理返回导航
   * 
   * @description 返回上一页或资产列表页
   */
  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  /**
   * 处理审计日志刷新
   * 
   * @description 手动刷新审计日志列表
   */
  const handleRefreshAuditLogs = useCallback(() => {
    refreshAuditLogs();
  }, [refreshAuditLogs]);

  /**
   * 渲染资产状态标签
   * 
   * @param status - 资产状态
   * @returns 对应的 Ant Design Tag 组件
   */
  const renderStatusTag = (status: string): React.ReactNode => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      active: { color: 'green', text: '在用' },
      idle: { color: 'orange', text: '闲置' },
      maintenance: { color: 'blue', text: '维护中' },
      scrapped: { color: 'red', text: '已报废' },
      transferred: { color: 'purple', text: '已转移' }
    };
    
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  /**
   * 渲染审计日志时间线项
   * 
   * @param log - 审计日志条目
   * @returns Timeline.Item 组件
   */
  const renderAuditTimelineItem = (log: AuditLogEntry): React.ReactNode => {
    const operationColor: Record<string, string> = {
      CREATE: 'green',
      UPDATE: 'blue',
      DELETE: 'red',
      VIEW: 'gray',
      EXPORT: 'purple'
    };

    return (
      <Timeline.Item
        key={log.id}
        color={operationColor[log.operation] || 'gray'}
        dot={log.operation === 'CREATE' ? <InfoCircleOutlined /> : <ClockCircleOutlined />}
      >
        <div className="audit-timeline-item">
          <div className="audit-header">
            <span className="audit-operation">{log.operation}</span>
            <span className="audit-time">{new Date(log.timestamp).toLocaleString()}</span>
          </div>
          <div className="audit-content">
            <Avatar size="small" icon={<UserOutlined />} />
            <span className="audit-operator">{log.operatorName || '系统'}</span>
          </div>
          {log.changes && log.changes.length > 0 && (
            <div className="audit-changes">
              {log.changes.map((change, index) => (
                <AuditableFieldBadge
                  key={index}
                  fieldName={change.field}
                  oldValue={change.oldValue}
                  newValue={change.newValue}
                  isAuditable={isFieldAuditable(change.field)}
                />
              ))}
            </div>
          )}
        </div>
      </Timeline.Item>
    );
  };

  // 渲染加载状态
  if (loading) {
    return (
      <div className="asset-detail-page loading-container">
        <Spin size="large" tip="加载资产详情..." />
      </div>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <div className="asset-detail-page error-container">
        <Empty
          description={
            <span>
              <ExclamationCircleOutlined style={{ marginRight: 8 }} />
              {error}
            </span>
          }
        >
          <Button type="primary" onClick={fetchAssetDetail}>
            重试
          </Button>
        </Empty>
      </div>
    );
  }

  // 渲染空状态
  if (!asset) {
    return (
      <div className="asset-detail-page empty-container">
        <Empty description="未找到该资产" />
      </div>
    );
  }

  return (
    <div className="asset-detail-page">
      {/* 页面头部 */}
      <div className="page-header">
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={handleBack}
          className="back-button"
        >
          返回
        </Button>
        <h1 className="page-title">资产详情</h1>
        <div className="header-actions">
          {/* 可扩展的操作按钮区域 */}
        </div>
      </div>

      {/* 标签页切换 */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={[
          {
            key: 'info',
            label: (
              <span>
                <InfoCircleOutlined />
                基本信息
              </span>
            ),
            children: (
              <Card className="asset-info-card">
                <Descriptions column={2} bordered>
                  <Descriptions.Item label="资产编号">{asset.assetCode}</Descriptions.Item>
                  <Descriptions.Item label="资产名称">{asset.name}</Descriptions.Item>
                  <Descriptions.Item label="资产类型">{asset.categoryName}</Descriptions.Item>
                  <Descriptions.Item label="资产状态">{renderStatusTag(asset.status)}</Descriptions.Item>
                  <Descriptions.Item label="购入日期">{asset.purchaseDate}</Descriptions.Item>
                  <Descriptions.Item label="资产价值">¥{asset.value}</Descriptions.Item>
                  <Descriptions.Item label="使用部门">{asset.departmentName}</Descriptions.Item>
                  <Descriptions.Item label="使用人">{asset.assigneeName || '-'}</Descriptions.Item>
                  <Descriptions.Item label="存放地点">{asset.location || '-'}</Descriptions.Item>
                  <Descriptions.Item label="创建时间">{new Date(asset.createdAt).toLocaleString()}</Descriptions.Item>
                </Descriptions>
              </Card>
            )
          },
          {
            key: 'audit',
            label: (
              <span>
                <HistoryOutlined />
                审计日志
              </span>
            ),
            children: (
              <div className="audit-tab-content">
                <AuditLogPanel
                  logs={logs}
                  loading={auditLoading}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  onRefresh={handleRefreshAuditLogs}
                  getFieldChanges={getFieldChanges}
                />
              </div>
            )
          },
          {
            key: 'graph',
            label: (
              <span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="8" r="3" />
                  <circle cx="3" cy="3" r="2" />
                  <circle cx="13" cy="3" r="2" />
                  <circle cx="3" cy="13" r="2" />
                  <circle cx="13" cy="13" r="2" />
                </svg>
                知识图谱
              </span>
            ),
            children: (
              <GraphifyPanel assetId={id} asset={asset} />
            )
          }
        ]}
      />
    </div>
  );
};

export default AssetDetailPage;

// 重新导出类型和 hooks 以供外部使用
export { AssetDetailPage };
export type { AssetDetail, AuditLogEntry, AuditableFieldConfig } from './types';