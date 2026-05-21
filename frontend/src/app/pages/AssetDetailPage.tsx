/**
 * AssetDetailPage Component
 *
 * 资产详情页面 — 完整真实 API 集成
 * 职责：展示资产完整元数据、折旧计划、关联工单、处置状态及操作历史
 *
 * @module pages/AssetDetailPage
 * @since SWARM-033
 *
 * outgoing: calls=[
 *   useAssetById@frontend/src/app/hooks/useAssetById.ts;
 *   fetchGraphifyNodes@frontend/src/app/pages/AssetDetailPage.tsx;
 *   renderGraphifyNodes@frontend/src/app/pages/AssetDetailPage.tsx;
 *   renderAssetDetailCard@frontend/src/app/pages/AssetDetailPage.tsx;
 *   renderAuditLogTab@frontend/src/app/pages/AssetDetailPage.tsx
 * ]
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Descriptions, Tag, Spin, Button, Timeline,
  Empty, Tabs, Divider, Space,
} from 'antd';
import {
  ArrowLeftOutlined, AuditOutlined, HistoryOutlined,
  InfoCircleOutlined, DeleteOutlined, DollarOutlined,
  ToolOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useAssetById } from '../hooks/useAssetById';
import { assetService } from '../services/assetService';
import DisposalRequestModal from '../components/disposal/DisposalRequestModal';
import AssetDepreciationTimeline from '../components/AssetDepreciationTimeline';
import type { DepreciationScheduleData } from '../components/AssetDepreciationTimeline';
import AssetWorkOrderHistory from '../components/AssetWorkOrderHistory';
import type { WorkOrderHistoryItem } from '../components/AssetWorkOrderHistory';
import AssetOperationHistory from '../components/AssetOperationHistory';
import type {
  DisposalHistoryItem,
  MaintenanceHistoryItem,
  OperationHistoryEntry,
} from '../components/AssetOperationHistory';
import { getAssetStatusMeta } from '../constants/assetStatus';

/**
 * 资产状态颜色映射
 */
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'green',
  INACTIVE: 'default',
  MAINTENANCE: 'orange',
  SCRAPPED: 'red',
  TRANSFERRED: 'blue',
  RETIRED: 'orange',
  DISPOSED: 'red',
  LOST: 'purple',
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
 * - 资产基本信息卡片 (renderAssetDetailCard)
 * - Graphify 知识图谱节点展示 (renderGraphifyNodes)
 * - 折旧计划时间线 (AssetDepreciationTimeline)
 * - 关联工单历史 (AssetWorkOrderHistory)
 * - 审计日志时间线 (renderAuditLogTab)
 * - 操作历史 (AssetOperationHistory)
 *
 * @returns {JSX.Element} 资产详情页面组件
 */
const AssetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ---- useAssetById hook (AC-001) ----
  const {
    asset,
    auditLogs,
    graphifyNodes,
    loading: isAssetLoading,
    auditLoading,
    error: assetError,
    refreshAsset,
    refreshAuditLogs,
  } = useAssetById(id || null, {
    fetchAuditLogs: true,
    enableGraphify: true,
  });

  // ---- Sub-data state ----
  const [depreciationSchedule, setDepreciationSchedule] = useState<DepreciationScheduleData | null>(null);
  const [depreciationLoading, setDepreciationLoading] = useState(false);

  const [workOrders, setWorkOrders] = useState<WorkOrderHistoryItem[]>([]);
  const [workOrderTotal, setWorkOrderTotal] = useState(0);
  const [workOrderPage, setWorkOrderPage] = useState(1);
  const [workOrderLoading, setWorkOrderLoading] = useState(false);

  const [disposalHistory, setDisposalHistory] = useState<DisposalHistoryItem[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistoryItem[]>([]);
  const [operationLoading, setOperationLoading] = useState(false);

  // Disposal modal
  const [disposalModalVisible, setDisposalModalVisible] = useState(false);

  // ---- Data fetching ----

  /**
   * 获取折旧计划
   */
  const fetchDepreciationSchedule = useCallback(async (assetId: string) => {
    if (!assetId) return;
    setDepreciationLoading(true);
    try {
      const data = await assetService.getDepreciationSchedule(assetId);
      setDepreciationSchedule(data as unknown as DepreciationScheduleData);
    } catch {
      // Some assets may not have depreciation data
      setDepreciationSchedule(null);
    } finally {
      setDepreciationLoading(false);
    }
  }, []);

  /**
   * 获取关联工单列表
   */
  const fetchWorkOrders = useCallback(async (assetId: string, page: number = 1) => {
    if (!assetId) return;
    setWorkOrderLoading(true);
    try {
      const result = await assetService.getWorkOrders(assetId, {
        page,
        pageSize: 10,
      });
      setWorkOrders((result.records || []) as unknown as WorkOrderHistoryItem[]);
      setWorkOrderTotal(result.total || 0);
      setWorkOrderPage(page);
    } catch {
      setWorkOrders([]);
      setWorkOrderTotal(0);
    } finally {
      setWorkOrderLoading(false);
    }
  }, []);

  /**
   * 获取处置历史
   */
  const fetchDisposalHistory = useCallback(async (assetId: string) => {
    if (!assetId) return;
    try {
      const result = await assetService.getDisposalHistory(assetId, {
        page: 1,
        pageSize: 50,
      });
      setDisposalHistory((result.records || []) as unknown as DisposalHistoryItem[]);
    } catch {
      setDisposalHistory([]);
    }
  }, []);

  /**
   * 获取维保记录
   */
  const fetchMaintenanceHistory = useCallback(async (assetId: string) => {
    if (!assetId) return;
    try {
      const result = await assetService.getMaintenanceRecords(assetId, {
        page: 1,
        pageSize: 50,
      });
      setMaintenanceHistory((result.records || []) as unknown as MaintenanceHistoryItem[]);
    } catch {
      setMaintenanceHistory([]);
    }
  }, []);

  /**
   * 获取全部子数据
   */
  const fetchAllSubData = useCallback(async (assetId: string) => {
    setOperationLoading(true);
    await Promise.allSettled([
      fetchDepreciationSchedule(assetId),
      fetchWorkOrders(assetId),
      fetchDisposalHistory(assetId),
      fetchMaintenanceHistory(assetId),
    ]);
    setOperationLoading(false);
  }, [fetchDepreciationSchedule, fetchWorkOrders, fetchDisposalHistory, fetchMaintenanceHistory]);

  // ---- Effects ----

  /**
   * Effect: 加载资产时获取子数据
   */
  useEffect(() => {
    if (asset?.id) {
      fetchAllSubData(String(asset.id));
    }
  }, [asset?.id, fetchAllSubData]);

  /**
   * 获取 Graphify 知识图谱节点数据
   * 对接 Graphify 服务，转换资产数据为图谱节点
   */
  const fetchGraphifyNodes = async (assetId: string) => {
    if (!assetId) return;
    try {
      const graphifyResponse = await fetch(`/api/graphify/nodes?assetId=${assetId}`);
      const graphifyData = await graphifyResponse.json();
      return graphifyData.nodes || [];
    } catch (error) {
      console.error('Failed to fetch Graphify nodes:', error);
      return [];
    }
  };

  /**
   * 处理 @Auditable 字段变更高亮
   */
  const filterAuditableChanges = (changes: Array<{ isAuditable?: boolean; [k: string]: unknown }>) => {
    return changes.filter(change => change.isAuditable === true);
  };

  /**
   * 渲染审计日志时间线项
   */
  const renderAuditTimelineItem = (item: {
    id: string;
    action?: string;
    userName?: string;
    operatorName?: string;
    timestamp: string;
    changes?: Array<{ field: string; oldValue?: string; newValue?: string; isAuditable?: boolean }>;
  }): JSX.Element => {
    const auditableChanges = filterAuditableChanges(item.changes || []);
    const hasAuditableFields = auditableChanges.length > 0;
    const displayName = item.userName || item.operatorName || '系统';
    const actionLabel = ACTION_LABELS[item.action || ''] || item.action || '操作';

    return (
      <Timeline.Item
        key={item.id}
        color={hasAuditableFields ? 'blue' : 'gray'}
        data-testid={`audit-item-${item.id}`}
      >
        <div className="audit-item-content">
          <div className="audit-item-header">
            <Tag color={hasAuditableFields ? 'blue' : 'default'}>
              {actionLabel}
            </Tag>
            <span className="audit-user">{displayName}</span>
            <span className="audit-time">
              {new Date(item.timestamp).toLocaleString('zh-CN')}
            </span>
          </div>

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
   */
  const renderGraphifyNodes = (): JSX.Element => {
    if (isAssetLoading) {
      return (
        <div className="graphify-loading">
          <Spin tip="知识图谱加载中..." />
        </div>
      );
    }

    if (!graphifyNodes || graphifyNodes.length === 0) {
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
        {graphifyNodes.map((node) => (
          <Card
            key={node.id}
            size="small"
            data-testid={`graphify-node-${node.type?.toLowerCase() || 'default'}`}
            style={{ marginBottom: 8 }}
          >
            <div style={{ fontWeight: 500 }}>{node.label}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              <Tag>{node.type || '节点'}</Tag>
              {node.connected && <Tag color="green">已连接</Tag>}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  /**
   * 渲染资产基本信息卡片
   */
  const renderAssetDetailCard = (): JSX.Element | null => {
    if (!asset) return null;

    /** 资产状态机守卫：终态资产禁止发起报废 */
    const terminalStatuses = ['SCRAPPED', 'RETIRED', 'DISPOSED'];
    const isAssetActionable = !terminalStatuses.includes(asset.status);

    return (
      <Card
        title={
          <span>
            <InfoCircleOutlined /> 资产详情
          </span>
        }
        extra={
          <Space>
            {isAssetActionable && (
              <Button
                type="primary"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setDisposalModalVisible(true)}
                data-testid="initiate-disposal-btn"
              >
                发起报废
              </Button>
            )}
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
            >
              返回
            </Button>
          </Space>
        }
        data-testid="asset-detail-card"
        className="asset-detail-card"
      >
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="资产名称" span={2}>
            <span className="asset-name">{asset.name}</span>
          </Descriptions.Item>
          <Descriptions.Item label="资产编号">
            {asset.assetNumber || asset.id}
          </Descriptions.Item>
          <Descriptions.Item label="资产类型">
            {asset.type}
          </Descriptions.Item>
          <Descriptions.Item label="资产状态">
            <Tag color={STATUS_COLORS[asset.status] || 'default'} data-testid="status-badge">
              {getAssetStatusMeta(asset.status).label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="所属部门">
            {asset.department || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="责任人">
            {asset.assignedTo || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="购置日期">
            {asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="原值">
            {asset.purchasePrice ? `¥${asset.purchasePrice.toLocaleString()}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="净值">
            {asset.currentValue ? `¥${asset.currentValue.toLocaleString()}` : '-'}
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
        {asset.customFields && Object.keys(asset.customFields).length > 0 && (
          <>
            <Divider orientation="left" orientationMargin="0">
              <AuditOutlined /> 审计追踪字段 (@Auditable)
            </Divider>
            <Descriptions column={2} bordered size="small">
              {Object.entries(asset.customFields).map(([key, value]) => (
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
   */
  const renderAuditLogTab = (): JSX.Element => {
    if (auditLoading) {
      return (
        <div className="audit-loading">
          <Spin tip="审计日志加载中..." />
        </div>
      );
    }

    if (!auditLogs || auditLogs.length === 0) {
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
          {auditLogs.map((log: any) => renderAuditTimelineItem({
            id: log.id || '',
            action: log.operation || log.action,
            userName: log.operatorName || log.userName,
            timestamp: log.timestamp || '',
            changes: log.changes || [],
          }))}
        </Timeline>
        <div className="audit-pagination">
          <span className="pagination-info">
            共 {auditLogs.length} 条审计记录
          </span>
        </div>
      </div>
    );
  };

  /**
   * 工单分页变更
   */
  const handleWorkOrderPageChange = useCallback((page: number) => {
    if (asset?.id) {
      fetchWorkOrders(String(asset.id), page);
    }
  }, [asset?.id, fetchWorkOrders]);

  /**
   * 工单行点击
   */
  const handleWorkOrderClick = useCallback((record: WorkOrderHistoryItem) => {
    navigate(`/workorders/${record.id}`);
  }, [navigate]);

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
            </span>
          }
        >
          <Button type="primary" onClick={() => refreshAsset()}>
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
        {/* 左侧：资产详情卡片 + 标签页 */}
        <Col xs={24} lg={16}>
          {renderAssetDetailCard()}

          {/* 标签页区域：折旧、工单、审计、操作历史 */}
          <Card style={{ marginTop: 16 }}>
            <Tabs
              defaultActiveKey="depreciation"
              items={[
                {
                  key: 'depreciation',
                  label: (
                    <span>
                      <DollarOutlined /> 折旧计划
                    </span>
                  ),
                  children: (
                    <AssetDepreciationTimeline
                      schedule={depreciationSchedule}
                      loading={depreciationLoading}
                    />
                  ),
                },
                {
                  key: 'workorders',
                  label: (
                    <span>
                      <ToolOutlined /> 关联工单
                    </span>
                  ),
                  children: (
                    <AssetWorkOrderHistory
                      workOrders={workOrders}
                      total={workOrderTotal}
                      loading={workOrderLoading}
                      page={workOrderPage}
                      pageSize={10}
                      onPageChange={handleWorkOrderPageChange}
                      onWorkOrderClick={handleWorkOrderClick}
                    />
                  ),
                },
                {
                  key: 'audit',
                  label: (
                    <span>
                      <HistoryOutlined /> 审计日志
                    </span>
                  ),
                  children: renderAuditLogTab(),
                },
                {
                  key: 'operations',
                  label: (
                    <span>
                      <FileTextOutlined /> 操作历史
                    </span>
                  ),
                  children: (
                    <AssetOperationHistory
                      entries={[]}
                      loading={operationLoading}
                      disposalHistory={disposalHistory}
                      maintenanceHistory={maintenanceHistory}
                    />
                  ),
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

      {/* 报废申请模态框 */}
      <DisposalRequestModal
        visible={disposalModalVisible}
        onClose={() => setDisposalModalVisible(false)}
        onSuccess={() => {
          refreshAsset();
        }}
        assetId={asset?.id || ''}
        assetNo={asset?.assetNumber || asset?.id || ''}
        assetName={asset?.name || ''}
        assetStatus={asset?.status}
      />
    </div>
  );
};

export default AssetDetailPage;
