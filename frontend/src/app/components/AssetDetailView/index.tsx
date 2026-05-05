/**
 * 资产详情视图组件
 * 
 * 职责说明:
 * - 展示资产的完整属性信息
 * - 集成审计日志展示模块
 * - 绑定 @Auditable 注解字段变更可视化
 * - 对接 AuditService 服务层
 * 
 * @module AssetDetailView
 * @version Iteration 3 - SWARM-051
 * @requires React 18+
 * @requires Ant Design 5.x
 * @requires auditService
 * @requires audit.types
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Spin, message, Tabs, Row, Col, Descriptions, Tag, Space, Button, Empty } from 'antd';
import { 
  InfoCircleOutlined, 
  HistoryOutlined, 
  FieldTimeOutlined,
  UserOutlined,
  FilterOutlined,
  ReloadOutlined,
  ExpandOutlined
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';

// 类型导入
import type { 
  AuditLog, 
  AuditLogResponse, 
  FieldChange,
  AuditFilterParams 
} from '@/app/types/audit.types';
import type { AssetDetailForGraphify } from '@/app/types/flow';

// 服务导入
import { getAssetAuditLogs } from '@/mocks/assetDetail.mock';
import auditService from '@/app/services/auditService';

// 子组件导入
import { AssetInfoCard } from './AssetInfoCard';
import { AuditLogPanel } from './AuditLogPanel';
import { AuditableFieldHighlight } from './AuditableFieldHighlight';

/**
 * 组件 Props 接口定义
 */
interface AssetDetailViewProps {
  /** 资产 ID (可选，默认从 URL 路由参数获取) */
  assetId?: string;
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 是否启用审计日志模块 */
  enableAuditLog?: boolean;
  /** 是否启用 @Auditable 字段高亮 */
  enableAuditableHighlight?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 资产详情视图主组件
 * 
 * 功能说明:
 * 1. 加载并展示资产基础信息
 * 2. 集成审计日志面板，支持分页、筛选
 * 3. 对 @Auditable 标记字段变更进行高亮可视化
 * 4. 实时对接 AuditService 获取审计数据
 * 
 * @param props - 组件属性
 * @returns 资产详情视图组件
 * 
 * @example
 * ```tsx
 * // 基本使用
 * <AssetDetailView />
 * 
 * // 自定义资产 ID
 * <AssetDetailView assetId="asset-123" enableAuditLog={true} />
 * ```
 */
export const AssetDetailView: React.FC<AssetDetailViewProps> = ({
  assetId: propAssetId,
  loading: propLoading = false,
  enableAuditLog = true,
  enableAuditableHighlight = true,
  className,
  style
}) => {
  // ============================================
  // 状态定义
  // ============================================
  
  /** 资产 ID (优先使用 props传入，否则使用路由参数) */
  const params = useParams<{ assetId: string }>();
  const assetId = propAssetId || params?.assetId || '';
  
  /** 资产数据 */
  const [asset, setAsset] = useState<AssetDetailForGraphify | null>(null);
  
  /** 组件加载状态 */
  const [isLoading, setIsLoading] = useState<boolean>(propLoading);
  
  /** 错误信息 */
  const [error, setError] = useState<Error | null>(null);
  
  /** 审计日志数据 */
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  /** 审计日志加载状态 */
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  
  /** 审计日志分页信息 */
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0
  });
  
  /** 审计日志筛选参数 */
  const [filterParams, setFilterParams] = useState<AuditFilterParams>({});
  
  /** 当前激活的 Tab */
  const [activeTab, setActiveTab] = useState<string>('info');

  // ============================================
  // 审计日志加载函数
  // ============================================
  
  /**
   * 加载指定资产的审计日志
   * 
   * 功能说明:
   * - 调用 AuditService 获取审计日志数据
   * - 支持分页和筛选参数
   * - 自动处理加载状态和错误
   * 
   * @param id - 资产 ID
   * @param page - 页码
   * @param pageSize - 每页数量
   * @param filters - 筛选参数
   */
  const loadAuditLogs = useCallback(async (
    id: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: AuditFilterParams
  ) => {
    if (!id) return;
    
    setAuditLoading(true);
    setError(null);
    
    try {
      const response: AuditLogResponse = await auditService.getLogsByAssetId(id, {
        page,
        pageSize,
        ...filters
      });
      
      setAuditLogs(response.data || []);
      setPagination({
        page: response.pagination?.page || page,
        pageSize: response.pagination?.pageSize || pageSize,
        total: response.pagination?.total || 0
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '审计日志加载失败';
      setError(err instanceof Error ? err : new Error(errorMessage));
      message.error(errorMessage);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  // ============================================
  // 资产数据加载函数
  // ============================================
  
  /**
   * 加载资产详情数据
   * 
   * 功能说明:
   * - 调用资产服务获取资产详情
   * - 同时触发审计日志加载
   * 
   * @param id - 资产 ID
   */
  const loadAssetDetail = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 使用 mock 数据 (实际应调用 assetService.getAssetById)
      const mockAsset: AssetDetailForGraphify = {
        id,
        name: `资产 ${id}`,
        type: 'SERVER',
        status: 'ACTIVE',
        department: 'IT Infrastructure',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        graphifyId: `GF-${id}`,
        position: { x: 100, y: 200 },
        properties: {
          status: 'ACTIVE',
          category: 'Server',
          serialNumber: `SN-${id}`
        },
        metadata: {
          createdBy: 'admin',
          lastModifiedBy: 'admin'
        }
      };
      
      setAsset(mockAsset);
      
      // 加载审计日志
      if (enableAuditLog) {
        await loadAuditLogs(id, pagination.page, pagination.pageSize, filterParams);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '资产信息加载失败';
      setError(err instanceof Error ? err : new Error(errorMessage));
      message.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [enableAuditLog, loadAuditLogs, pagination.page, pagination.pageSize, filterParams]);

  // ============================================
  // 副作用处理
  // ============================================
  
  /** 组件挂载时加载资产数据 */
  useEffect(() => {
    if (assetId) {
      loadAssetDetail(assetId);
    }
  }, [assetId, loadAssetDetail]);
  
  /** 筛选参数变更时重新加载审计日志 */
  useEffect(() => {
    if (assetId && enableAuditLog) {
      loadAuditLogs(assetId, pagination.page, pagination.pageSize, filterParams);
    }
  }, [filterParams]);

  // ============================================
  // 事件处理函数
  // ============================================
  
  /**
   * 处理审计日志分页变更
   * 
   * @param page - 新的页码
   * @param pageSize - 新的每页数量
   */
  const handleAuditPageChange = useCallback((page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, page, pageSize }));
    loadAuditLogs(assetId, page, pageSize, filterParams);
  }, [assetId, filterParams, loadAuditLogs]);
  
  /**
   * 处理审计日志筛选变更
   * 
   * @param filters - 新的筛选参数
   */
  const handleAuditFilterChange = useCallback((filters: AuditFilterParams) => {
    setFilterParams(filters);
    setPagination(prev => ({ ...prev, page: 1 })); // 重置到第一页
  }, []);
  
  /**
   * 处理审计日志刷新
   */
  const handleAuditRefresh = useCallback(() => {
    loadAuditLogs(assetId, pagination.page, pagination.pageSize, filterParams);
  }, [assetId, pagination.page, pagination.pageSize, filterParams, loadAuditLogs]);
  
  /**
   * 处理 Tab 切换
   * 
   * @param key - 激活的 Tab 键
   */
  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  // ============================================
  // 计算属性
  // ============================================
  
  /** 提取所有 @Auditable 标记的字段变更 */
  const auditableChanges = useMemo(() => {
    if (!enableAuditableHighlight) return [];
    
    return auditLogs
      .flatMap(log => log.changes || [])
      .filter((change: FieldChange) => change.auditable === true);
  }, [auditLogs, enableAuditableHighlight]);
  
  /** 获取高亮颜色映射 */
  const auditableHighlightConfig = useMemo(() => ({
    badgeColor: 'orange',
    tooltipText: '@Auditable 标记字段变更'
  }), []);

  // ============================================
  // 渲染逻辑
  // ============================================
  
  /** 加载状态渲染 */
  if (isLoading && !asset) {
    return (
      <div className={`asset-detail-view loading ${className || ''}`} style={style}>
        <Card>
          <div className="flex items-center justify-center h-64">
            <Spin size="large" tip="加载资产详情..." />
          </div>
        </Card>
      </div>
    );
  }
  
  /** 错误状态渲染 */
  if (error && !asset) {
    return (
      <div className={`asset-detail-view error ${className || ''}`} style={style}>
        <Card>
          <Empty
            description={
              <span className="text-red-500">
                {error.message || '资产信息加载失败'}
              </span>
            }
          >
            <Button type="primary" onClick={() => loadAssetDetail(assetId)}>
              重试
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }
  
  /** 资产不存在状态 */
  if (!asset) {
    return (
      <div className={`asset-detail-view empty ${className || ''}`} style={style}>
        <Card>
          <Empty description="资产不存在或已被删除" />
        </Card>
      </div>
    );
  }

  // ============================================
  // Tab 配置
  // ============================================
  
  const tabItems = [
    {
      key: 'info',
      label: (
        <span>
          <InfoCircleOutlined />
          基本信息
        </span>
      ),
      children: (
        <Row gutter={[16, 16]}>
          {/* 资产信息卡片 */}
          <Col xs={24} lg={enableAuditLog ? 12 : 24}>
            <AssetInfoCard asset={asset} />
          </Col>
          
          {/* @Auditable 字段高亮可视化 */}
          {enableAuditableHighlight && auditableChanges.length > 0 && (
            <Col xs={24} lg={12}>
              <Card 
                title={
                  <Space>
                    <FieldTimeOutlined />
                    <span>@Auditable 字段变更记录</span>
                  </Space>
                }
                extra={
                  <Tag color="orange">
                    {auditableChanges.length} 项变更
                  </Tag>
                }
              >
                <AuditableFieldHighlight 
                  changes={auditableChanges}
                  highlightConfig={auditableHighlightConfig}
                />
              </Card>
            </Col>
          )}
        </Row>
      )
    },
    ...(enableAuditLog ? [{
      key: 'audit',
      label: (
        <span>
          <HistoryOutlined />
          审计日志
          {pagination.total > 0 && (
            <Tag className="ml-2" color="blue">
              {pagination.total}
            </Tag>
          )}
        </span>
      ),
      children: (
        <AuditLogPanel
          assetId={assetId}
          auditLogs={auditLogs}
          pagination={pagination}
          loading={auditLoading}
          filterParams={filterParams}
          onPageChange={handleAuditPageChange}
          onFilterChange={handleAuditFilterChange}
          onRefresh={handleAuditRefresh}
        />
      )
    }] : [])
  ];

  // ============================================
  // 主渲染
  // ============================================
  
  return (
    <div 
      className={`asset-detail-view ${className || ''}`} 
      style={style}
      data-testid="asset-detail-view"
    >
      {/* 页面标题区 */}
      <Card className="mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="m-0 text-xl font-semibold">{asset.name}</h2>
            <p className="m-0 text-gray-500">
              资产编号: {asset.id} | 类型: {asset.type} | 状态: 
              <Tag color={asset.status === 'ACTIVE' ? 'green' : 'default'} className="ml-1">
                {asset.status}
              </Tag>
            </p>
          </div>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => loadAssetDetail(assetId)}
              loading={isLoading}
            >
              刷新
            </Button>
          </Space>
        </div>
      </Card>
      
      {/* 主内容区 - Tabs */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          size="large"
        />
      </Card>
    </div>
  );
};

// ============================================
// 子组件: AssetInfoCard
// ============================================

interface AssetInfoCardProps {
  /** 资产数据 */
  asset: AssetDetailForGraphify;
  /** 是否加载中 */
  loading?: boolean;
}

/**
 * 资产信息卡片组件
 * 
 * 功能说明:
 * - 展示资产的基础属性信息
 * - 支持加载状态骨架屏
 * - 支持错误状态展示
 * 
 * @param props - 组件属性
 * @returns 资产信息卡片组件
 */
export const AssetInfoCard: React.FC<AssetInfoCardProps> = ({
  asset,
  loading = false
}) => {
  if (loading) {
    return (
      <Card loading title="资产信息" />
    );
  }

  return (
    <Card 
      title={
        <Space>
          <InfoCircleOutlined />
          <span>资产信息</span>
        </Space>
      }
    >
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="资产名称">{asset.name}</Descriptions.Item>
        <Descriptions.Item label="资产类型">{asset.type}</Descriptions.Item>
        <Descriptions.Item label="资产状态">
          <Tag color={asset.status === 'ACTIVE' ? 'success' : 'default'}>
            {asset.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="归属部门">{asset.department}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {asset.createdAt ? new Date(asset.createdAt).toLocaleString() : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {asset.updatedAt ? new Date(asset.updatedAt).toLocaleString() : '-'}
        </Descriptions.Item>
        {asset.properties?.serialNumber && (
          <Descriptions.Item label="序列号">
            {asset.properties.serialNumber}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );
};

// ============================================
// 子组件: AuditableFieldHighlight
// ============================================

interface AuditableFieldHighlightProps {
  /** 字段变更列表 */
  changes: FieldChange[];
  /** 高亮配置 */
  highlightConfig?: {
    badgeColor?: string;
    tooltipText?: string;
  };
}

/**
 * @Auditable 字段高亮可视化组件
 * 
 * 功能说明:
 * - 展示所有 @Auditable 标记的字段变更
 * - 对关键字段变更进行高亮显示
 * - 支持 tooltip 提示详情
 * 
 * @param props - 组件属性
 * @returns 高亮可视化组件
 */
export const AuditableFieldHighlight: React.FC<AuditableFieldHighlightProps> = ({
  changes,
  highlightConfig = {
    badgeColor: 'orange',
    tooltipText: '@Auditable 标记字段变更'
  }
}) => {
  if (!changes || changes.length === 0) {
    return <Empty description="暂无 @Auditable 字段变更记录" />;
  }

  return (
    <div className="auditable-highlight-list">
      {changes.map((change, index) => (
        <div 
          key={`${change.field}-${index}`}
          className="auditable-highlight-item p-3 mb-2 bg-orange-50 border border-orange-200 rounded"
        >
          <div className="flex items-center gap-2 mb-1">
            <Tag color={highlightConfig.badgeColor}>@Auditable</Tag>
            <span className="font-medium">{change.field}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">原值: </span>
            <span className="line-through text-red-500">{change.oldValue || '(空)'}</span>
            <span className="mx-2">→</span>
            <span className="text-gray-500">新值: </span>
            <span className="text-green-600">{change.newValue || '(空)'}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// 子组件: AuditLogPanel
// ============================================

interface AuditLogPanelProps {
  /** 资产 ID */
  assetId: string;
  /** 审计日志数据 */
  auditLogs: AuditLog[];
  /** 分页信息 */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  /** 加载状态 */
  loading: boolean;
  /** 筛选参数 */
  filterParams: AuditFilterParams;
  /** 分页变更回调 */
  onPageChange: (page: number, pageSize: number) => void;
  /** 筛选变更回调 */
  onFilterChange: (filters: AuditFilterParams) => void;
  /** 刷新回调 */
  onRefresh: () => void;
}

/**
 * 审计日志面板组件
 * 
 * 功能说明:
 * - 展示资产关联的审计日志列表
 * - 支持分页导航
 * - 支持筛选功能
 * - 支持刷新操作
 * 
 * @param props - 组件属性
 * @returns 审计日志面板组件
 */
export const AuditLogPanel: React.FC<AuditLogPanelProps> = ({
  assetId,
  auditLogs,
  pagination,
  loading,
  filterParams,
  onPageChange,
  onFilterChange,
  onRefresh
}) => {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  /** 操作类型选项 */
  const operationOptions = [
    { label: '全部', value: '' },
    { label: '创建 (CREATE)', value: 'CREATE' },
    { label: '更新 (UPDATE)', value: 'UPDATE' },
    { label: '删除 (DELETE)', value: 'DELETE' },
    { label: '查看 (VIEW)', value: 'VIEW' },
    { label: '导出 (EXPORT)', value: 'EXPORT' }
  ];

  /** 表格列定义 */
  const columns = [
    {
      title: '操作时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '操作类型',
      dataIndex: 'operation',
      key: 'operation',
      width: 120,
      render: (operation: string) => {
        const colorMap: Record<string, string> = {
          'CREATE': 'green',
          'UPDATE': 'blue',
          'DELETE': 'red',
          'VIEW': 'cyan',
          'EXPORT': 'purple'
        };
        return <Tag color={colorMap[operation] || 'default'}>{operation}</Tag>;
      }
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 120,
      render: (text: string) => (
        <Space>
          <UserOutlined />
          {text}
        </Space>
      )
    },
    {
      title: '变更摘要',
      dataIndex: 'changes',
      key: 'changes',
      ellipsis: true,
      render: (changes: FieldChange[]) => {
        if (!changes || changes.length === 0) return '-';
        const summary = changes
          .slice(0, 2)
          .map(c => c.field)
          .join(', ');
        const suffix = changes.length > 2 ? `...(+${changes.length - 2})` : '';
        return (
          <span>
            {summary}
            {suffix && <Tag className="ml-1" color="orange">{suffix}</Tag>}
          </span>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: AuditLog) => (
        <Button 
          type="link" 
          icon={<ExpandOutlined />}
          onClick={() => {
            setSelectedLog(record);
            setDrawerVisible(true);
          }}
        >
          详情
        </Button>
      )
    }
  ];

  return (
    <div className="audit-log-panel" data-testid="audit-log-panel">
      {/* 筛选工具栏 */}
      <div className="flex justify-between items-center mb-4">
        <Space>
          <span>操作类型:</span>
          <select
            className="ant-select"
            value={filterParams.operationType || ''}
            onChange={(e) => onFilterChange({ 
              ...filterParams, 
              operationType: e.target.value as AuditFilterParams['operationType'] 
            })}
          >
            {operationOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Space>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={onRefresh}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      {/* 审计日志表格 */}
      <div 
        className="audit-table-wrapper"
        data-testid="audit-table"
      >
        <table className="ant-table ant-table-bordered">
          <thead className="ant-table-thead">
            <tr>
              {columns.map(col => (
                <th key={col.key as string} style={{ width: col.width }}>
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="ant-table-tbody">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center p-8">
                  <Spin />
                </td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center p-8">
                  <Empty description="暂无审计记录" />
                </td>
              </tr>
            ) : (
              auditLogs.map(log => (
                <tr key={log.id}>
                  {columns.map(col => (
                    <td key={col.key as string}>
                      {col.render
                        ? col.render(
                            (log as Record<string, unknown>)[col.dataIndex as string] as unknown,
                            log
                          )
                        : (log as Record<string, unknown>)[col.dataIndex as string] as string}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页控件 */}
      <div className="flex justify-end mt-4">
        <Space>
          <span>共 {pagination.total} 条</span>
          <select
            className="ant-select"
            value={pagination.pageSize}
            onChange={(e) => onPageChange(pagination.page, Number(e.target.value))}
          >
            <option value={10}>10 条/页</option>
            <option value={20}>20 条/页</option>
            <option value={50}>50 条/页</option>
            <option value={100}>100 条/页</option>
          </select>
          <div className="inline-flex">
            <button
              className="ant-pagination-prev"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1, pagination.pageSize)}
            >
              <span>‹</span>
            </button>
            <span className="ant-pagination-item-active">
              {pagination.page}
            </span>
            <button
              className="ant-pagination-next"
              disabled={pagination.page * pagination.pageSize >= pagination.total}
              onClick={() => onPageChange(pagination.page + 1, pagination.pageSize)}
            >
              <span>›</span>
            </button>
          </div>
        </Space>
      </div>

      {/* 详情抽屉 */}
      {drawerVisible && selectedLog && (
        <div 
          className="ant-drawer ant-drawer-right ant-drawer-open"
          data-testid="audit-detail-drawer"
        >
          <div className="ant-drawer-content-wrapper" style={{ width: 400 }}>
            <div className="ant-drawer-content">
              <div className="ant-drawer-header">
                <div className="ant-drawer-title">审计日志详情</div>
                <button 
                  className="ant-drawer-close"
                  onClick={() => setDrawerVisible(false)}
                >
                  ×
                </button>
              </div>
              <div className="ant-drawer-body">
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="日志 ID">{selectedLog.id}</Descriptions.Item>
                  <Descriptions.Item label="资产 ID">{selectedLog.assetId}</Descriptions.Item>
                  <Descriptions.Item label="操作类型">
                    <Tag color={
                      selectedLog.operation === 'CREATE' ? 'green' :
                      selectedLog.operation === 'UPDATE' ? 'blue' :
                      selectedLog.operation === 'DELETE' ? 'red' : 'default'
                    }>
                      {selectedLog.operation}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="操作人">{selectedLog.operator}</Descriptions.Item>
                  <Descriptions.Item label="操作时间">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </Descriptions.Item>
                </Descriptions>
                
                <h4 className="mt-4 mb-2 font-medium">变更明细</h4>
                {selectedLog.changes && selectedLog.changes.length > 0 ? (
                  <div className="changes-list">
                    {selectedLog.changes.map((change, idx) => (
                      <div 
                        key={idx}
                        className={`p-3 mb-2 rounded ${
                          change.auditable 
                            ? 'bg-orange-50 border border-orange-200' 
                            : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{change.field}</span>
                          {change.auditable && (
                            <Tag color="orange" size="small">@Auditable</Tag>
                          )}
                        </div>
                        <div className="text-sm mt-1">
                          <span className="text-red-500">{change.oldValue || '(空)'}</span>
                          <span className="mx-2">→</span>
                          <span className="text-green-600">{change.newValue || '(空)'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description="无变更明细" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// 默认导出
// ============================================

export default AssetDetailView;