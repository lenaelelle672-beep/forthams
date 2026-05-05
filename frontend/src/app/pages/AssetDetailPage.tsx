/**
 * AssetDetailPage Component
 * 
 * 资产详情页面 - 核心展示组件
 * 职责：展示资产完整元数据、集成审计日志、@Auditable字段变更追踪
 * 
 * @module pages/AssetDetailPage
 * @requires react, react-router-dom, antd, @ant-design/icons
 * @requires hooks/useAssetById
 * @requires hooks/useAuditLogs
 * @requires components/flow/CustomNodes
 * @requires services/auditService
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Descriptions, Tag, Spin, message, Button, Timeline, Empty, Tabs, Divider } from 'antd';
import { ArrowLeftOutlined, AuditOutlined, HistoryOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useAssetById } from '../hooks/useAssetById';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { GraphifyNodeFactory } from '../components/flow/CustomNodes';
import type { GraphifyNodeData, GraphifyNodeType } from '../types/flow';
import type { AssetResponse } from '../types/asset.types';
import type { AuditLogResponse, AuditChange } from '../types/audit.types';
import { auditService } from '../services/auditService';

/**
 * 资产状态颜色映射
 */
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'green',
  INACTIVE: 'default',
  MAINTENANCE: 'orange',
  SCRAPPED: 'red',
  TRANSFERRED: 'blue',
};

/**
 * 审计操作类型映射
 */
const ACTION_LABELS: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
  VIEW: '查看',
};

/**
 * AssetDetailPage 组件主函数
 * 
 * 渲染资产详情页面，包含：
 * - 资产基本信息卡片
 * - Graphify 知识图谱节点展示
 * - 审计日志时间线
 * - @Auditable 字段变更追踪
 * 
 * @returns {JSX.Element} 资产详情页面组件
 */
const AssetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // State for graphify nodes
  const [graphifyNodes, setGraphifyNodes] = useState<GraphifyNodeData[]>([]);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  
  // Asset data hook
  const {
    data: asset,
    isLoading: isAssetLoading,
    error: assetError,
    refetch: refetchAsset,
  } = useAssetById(id);
  
  // Audit logs hook
  const {
    data: auditData,
    isLoading: isAuditLoading,
    error: auditError,
    refetch: refetchAudit,
  } = useAuditLogs(id || '', { page: 1, pageSize: 20 });
  
  /**
   * 获取 Graphify 知识图谱节点数据
   * 对接 Graphify 服务，转换资产数据为图谱节点
   */
  const fetchGraphifyNodes = async (assetId: string) => {
    if (!assetId) return;
    
    setIsGraphLoading(true);
    try {
      // 模拟 Graphify API 调用 - 实际应替换为真实 API
      const graphifyResponse = await fetch(`/api/graphify/nodes?assetId=${assetId}`);
      const graphifyData = await graphifyResponse.json();
      
      // 转换数据为 GraphifyNodeData 格式
      const nodes: GraphifyNodeData[] = graphifyData.nodes?.map((node: any) => ({
        id: node.id,
        label: node.label,
        nodeType: node.nodeType as GraphifyNodeType,
        graphifyId: node.graphifyId,
        position: node.position,
        properties: node.properties,
        relationships: node.relationships,
        metadata: node.metadata,
      })) || [];
      
      setGraphifyNodes(nodes);
    } catch (error) {
      console.error('Failed to fetch Graphify nodes:', error);
      message.error('知识图谱加载失败');
      // Fallback: 使用资产数据创建单节点
      if (asset) {
        setGraphifyNodes([{
          id: asset.id,
          label: asset.name,
          nodeType: 'ASSET' as GraphifyNodeType,
          graphifyId: `graphify-${asset.id}`,
          position: { x: 400, y: 300 },
          properties: asset.metadata || {},
        }]);
      }
    } finally {
      setIsGraphLoading(false);
    }
  };
  
  // Effect: 加载资产时获取图谱数据
  useEffect(() => {
    if (asset?.id) {
      fetchGraphifyNodes(asset.id);
    }
  }, [asset?.id]);
  
  /**
   * 处理 @Auditable 字段变更高亮
   * 过滤出 isAuditable: true 的变更记录
   * 
   * @param {AuditChange[]} changes - 变更列表
   * @returns {AuditChange[]} 仅包含 Auditable 字段的变更
   */
  const filterAuditableChanges = (changes: AuditChange[]): AuditChange[] => {
    return changes.filter(change => change.isAuditable === true);
  };
  
  /**
   * 渲染审计日志时间线项
   * 
   * @param {AuditLogResponse['items'][number]} item - 审计日志条目
   * @returns {JSX.Element} 时间线项组件
   */
  const renderAuditTimelineItem = (item: AuditLogResponse['items'][number]): JSX.Element => {
    const auditableChanges = filterAuditableChanges(item.changes || []);
    const hasAuditableFields = auditableChanges.length > 0;
    
    return (
      <Timeline.Item
        key={item.id}
        color={hasAuditableFields ? 'blue' : 'gray'}
        data-testid={`audit-item-${item.id}`}
      >
        <div className="audit-item-content">
          <div className="audit-item-header">
            <Tag color={hasAuditableFields ? 'blue' : 'default'}>
              {ACTION_LABELS[item.action] || item.action}
            </Tag>
            <span className="audit-user">{item.userName}</span>
            <span className="audit-time">
              {new Date(item.timestamp).toLocaleString('zh-CN')}
            </span>
          </div>
          
          {/* 变更详情展示 */}
          {item.changes && item.changes.length > 0 && (
            <div className="audit-changes" data-testid="auditable-field-tracker">
              {item.changes.map((change, idx) => (
                <div
                  key={idx}
                  className={`audit-change-row ${change.isAuditable ? 'audit-highlight' : ''}`}
                  data-testid={`auditable-change-${change.field}`}
                >
                  <span className="change-field">{change.field}:</span>
                  <span className="change-old">
                    {change.oldValue || '(空)'}
                  </span>
                  <span className="change-arrow">→</span>
                  <span className="change-new">
                    {change.newValue || '(空)'}
                  </span>
                  {change.isAuditable && (
                    <Tag color="blue" className="auditable-tag">@Auditable</Tag>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Timeline.Item>
    );
  };
  
  /**
   * 渲染 Graphify 知识图谱节点
   * 使用 GraphifyNodeFactory 工厂创建对应类型的节点组件
   */
  const renderGraphifyNodes = (): JSX.Element => {
    if (isGraphLoading) {
      return (
        <div className="graphify-loading">
          <Spin tip="知识图谱加载中..." />
        </div>
      );
    }
    
    if (graphifyNodes.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无知识图谱数据"
          data-testid="graphify-empty-state"
        />
      );
    }
    
    return (
      <div className="graphify-nodes-container" data-testid="graphify-nodes">
        {graphifyNodes.map((node) => {
          const NodeComponent = GraphifyNodeFactory(node.nodeType);
          return (
            <NodeComponent
              key={node.id}
              data={node}
              data-testid={`graphify-node-${node.nodeType.toLowerCase()}`}
            />
          );
        })}
      </div>
    );
  };
  
  /**
   * 渲染资产基本信息卡片
   * 展示资产的完整元数据信息
   */
  const renderAssetDetailCard = (): JSX.Element => {
    if (!asset) return null;
    
    return (
      <Card
        title={
          <span>
            <InfoCircleOutlined /> 资产详情
          </span>
        }
        extra={
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
          >
            返回
          </Button>
        }
        data-testid="asset-detail-card"
        className="asset-detail-card"
      >
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="资产名称" span={2}>
            <span className="asset-name">{asset.name}</span>
          </Descriptions.Item>
          <Descriptions.Item label="资产编号">
            {asset.assetCode || asset.id}
          </Descriptions.Item>
          <Descriptions.Item label="资产类型">
            {asset.assetType}
          </Descriptions.Item>
          <Descriptions.Item label="资产状态">
            <Tag color={STATUS_COLORS[asset.status] || 'default'} data-testid="status-badge">
              {asset.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="所属部门">
            {asset.department || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="责任人">
            {asset.keeper || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="购置日期">
            {asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="原值">
            {asset.originalValue ? `¥${asset.originalValue.toLocaleString()}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="净值">
            {asset.netValue ? `¥${asset.netValue.toLocaleString()}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="存放地点">
            {asset.location || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {asset.createdAt ? new Date(asset.createdAt).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {asset.updatedAt ? new Date(asset.updatedAt).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
        </Descriptions>
        
        {/* @Auditable 字段特殊展示 */}
        {asset.auditableFields && Object.keys(asset.auditableFields).length > 0 && (
          <>
            <Divider orientation="left" orientationMargin="0">
              <AuditOutlined /> 审计追踪字段 (@Auditable)
            </Divider>
            <Descriptions column={2} bordered size="small">
              {Object.entries(asset.auditableFields).map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>
                  <Tag color="blue">{String(value)}</Tag>
                </Descriptions.Item>
              ))}
            </Descriptions>
          </>
        )}
      </Card>
    );
  };
  
  /**
   * 渲染审计日志标签页
   * 包含时间线和分页控制
   */
  const renderAuditLogTab = (): JSX.Element => {
    if (isAuditLoading) {
      return (
        <div className="audit-loading">
          <Spin tip="审计日志加载中..." />
        </div>
      );
    }
    
    if (auditError) {
      return (
        <div className="audit-error">
          <Empty description={`加载失败: ${auditError.message}`} />
          <Button onClick={() => refetchAudit()}>重试</Button>
        </div>
      );
    }
    
    const items = auditData?.items || [];
    
    if (items.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无审计日志"
          data-testid="audit-log-empty"
        />
      );
    }
    
    return (
      <div className="audit-log-timeline" data-testid="audit-log-timeline">
        <Timeline mode="left">
          {items.map(renderAuditTimelineItem)}
        </Timeline>
        
        {/* 分页控制 */}
        {auditData?.pagination && auditData.pagination.total > auditData.pagination.pageSize && (
          <div className="audit-pagination">
            <Button
              disabled={auditData.pagination.page <= 1}
              onClick={() => refetchAudit()}
            >
              加载更多
            </Button>
            <span className="pagination-info">
              共 {auditData.pagination.total} 条记录
            </span>
          </div>
        )}
      </div>
    );
  };
  
  /**
   * 加载状态处理
   */
  if (isAssetLoading) {
    return (
      <div className="page-loading">
        <Spin size="large" tip="资产数据加载中..." />
      </div>
    );
  }
  
  /**
   * 错误状态处理
   */
  if (assetError || !asset) {
    return (
      <Card>
        <Empty
          description={
            <span>
              资产不存在或加载失败
              {assetError && <p className="error-detail">{assetError.message}</p>}
            </>
          }
        >
          <Button type="primary" onClick={() => refetchAsset()}>
            重试
          </Button>
          <Button onClick={() => navigate(-1)}>返回列表</Button>
        </Empty>
      </Card>
    );
  }
  
  /**
   * 主渲染
   */
  return (
    <div className="asset-detail-page" data-testid="asset-detail-page">
      <Row gutter={[16, 16]}>
        {/* 左侧：资产详情卡片 */}
        <Col xs={24} lg={16}>
          {renderAssetDetailCard()}
          
          {/* 审计日志区域 */}
          <Card
            title={
              <span>
                <HistoryOutlined /> 审计日志
              </span>
            }
            className="audit-card"
          >
            <Tabs
              defaultActiveKey="timeline"
              items={[
                {
                  key: 'timeline',
                  label: '时间线',
                  children: renderAuditLogTab(),
                },
              ]}
            />
          </Card>
        </Col>
        
        {/* 右侧：知识图谱 */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <span>
                <AuditOutlined /> 知识图谱
              </span>
            }
            className="graphify-card"
          >
            {renderGraphifyNodes()}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AssetDetailPage;