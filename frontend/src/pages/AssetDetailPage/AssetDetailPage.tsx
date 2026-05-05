/**
 * AssetDetailPage - 资产详情页面主组件
 * 
 * 核心职责:
 * 1. 资产信息全维度展示 - 实体的元数据、关联关系、可视化拓扑
 * 2. 操作审计追溯 - 实时展示资产变更的历史轨迹，满足合规与排查需求
 * 3. 变更可视化联动 - 将后端 @Auditable 注解标注字段的变更事件映射为前端可读日志条目
 * 
 * @SWARM-051 Phase 4.2: 前端审计日志可视化集成
 * @Iterative Iteration 8
 * 
 * @see AuditLogPanel 审计日志展示模块
 * @see AuditService 服务层对接
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, Activity, Info, Network } from 'lucide-react';
import { useAuditLogs } from './hooks/useAuditLogs';
import { useAuditableFields } from './hooks/useAuditableFields';
import { AuditLogPanel } from './components/AuditLogPanel/AuditLogPanel';
import { AssetInfoPanel } from './components/AssetInfoPanel/AssetInfoPanel';
import { AssetTopologyView } from './components/AssetTopologyView/AssetTopologyView';
import type { AuditLogEntry, TimeRange, OperationType } from './types/audit.types';
import type { AssetDetail } from '@/types/asset.types';
import { auditableFieldMap } from './config/auditableFieldMap';

// Mock asset data - 实际项目中应从 API 获取
const mockAssetDetail: AssetDetail = {
  id: 'AST-2024-001',
  name: 'Dell PowerEdge R740 服务器',
  category: '电子设备',
  subCategory: '服务器',
  status: '在用',
  location: '数据中心A-机柜12-3U',
  department: '信息技术部',
  purchaseDate: '2023-06-15',
  purchasePrice: 45000,
  currentValue: 38000,
  serialNumber: 'SN7GH8K2L',
  manufacturer: 'Dell Technologies',
  model: 'PowerEdge R740',
  responsiblePerson: '张三',
  description: '用于核心业务系统运行的物理服务器',
  tags: ['服务器', '核心系统', '高可用'],
  metadata: {
    cpu: 'Intel Xeon Gold 6248',
    memory: '256GB DDR4',
    storage: '4TB SSD RAID 5',
    network: '4x 1Gbps + 2x 10Gbps'
  }
};

interface TimeRangeFilter {
  startTime?: string;
  endTime?: string;
}

/**
 * AssetDetailPage 主组件
 * 
 * 提供资产详情展示的完整页面，包含:
 * - 资产基本信息面板 (AssetInfoPanel)
 * - 审计日志面板 (AuditLogPanel) - 核心功能
 * - 资产关系拓扑图 (AssetTopologyView) - 预留
 * 
 * @param props - 组件无外部 props，通过 URL params 获取 assetId
 * @returns 资产详情页面 JSX 元素
 */
export function AssetDetailPage(): React.JSX.Element {
  // 从 URL 获取资产 ID
  const { assetId } = useParams<{ assetId: string }>();
  
  // 本地状态
  const [assetDetail, setAssetDetail] = useState<AssetDetail | null>(null);
  const [isLoadingAsset, setIsLoadingAsset] = useState(true);
  const [assetError, setAssetError] = useState<string | null>(null);
  
  // 审计日志筛选状态
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>({});
  const [operationTypeFilter, setOperationTypeFilter] = useState<OperationType | undefined>(undefined);
  
  // AuditLogPanel 展开状态
  const [isAuditPanelExpanded, setIsAuditPanelExpanded] = useState(true);
  
  // 使用审计日志 Hook
  const {
    logs,
    isLoading: isLoadingLogs,
    error: logsError,
    pagination,
    refetch,
    isFetching
  } = useAuditLogs({
    assetId: assetId || '',
    timeRange: timeRangeFilter,
    operationType: operationTypeFilter,
    page: 1,
    pageSize: 20
  });
  
  // 使用 @Auditable 字段映射 Hook
  const { getFieldDisplayName, getDiffStrategy } = useAuditableFields(auditableFieldMap);
  
  // 加载资产详情数据
  useEffect(() => {
    const loadAssetDetail = async (): Promise<void> => {
      if (!assetId) {
        setAssetError('缺少资产ID参数');
        setIsLoadingAsset(false);
        return;
      }
      
      setIsLoadingAsset(true);
      setAssetError(null);
      
      try {
        // 模拟 API 调用延迟
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 实际项目中应调用: assetService.getAssetById(assetId)
        setAssetDetail(mockAssetDetail);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取资产详情失败';
        setAssetError(errorMessage);
      } finally {
        setIsLoadingAsset(false);
      }
    };
    
    loadAssetDetail();
  }, [assetId]);
  
  /**
   * 处理时间范围筛选变化
   * @param range - 新的时间范围筛选条件
   */
  const handleTimeRangeChange = useCallback((range: TimeRangeFilter): void => {
    setTimeRangeFilter(range);
  }, []);
  
  /**
   * 处理操作类型筛选变化
   * @param operation - 新的操作类型筛选条件
   */
  const handleOperationTypeChange = useCallback((operation: OperationType | undefined): void => {
    setOperationTypeFilter(operation);
  }, []);
  
  /**
   * 处理审计日志筛选应用
   * @param filters - 组合筛选条件
   */
  const handleApplyFilters = useCallback((filters: { timeRange?: TimeRangeFilter; operationType?: OperationType }): void => {
    if (filters.timeRange) {
      setTimeRangeFilter(filters.timeRange);
    }
    if (filters.operationType !== undefined) {
      setOperationTypeFilter(filters.operationType);
    }
  }, []);
  
  /**
   * 处理重试操作
   * 用于 API 错误后的重试
   */
  const handleRetry = useCallback((): void => {
    refetch();
  }, [refetch]);
  
  /**
   * 渲染错误状态
   * @param message - 错误消息
   * @param onRetry - 重试回调函数
   */
  const renderErrorState = (message: string, onRetry?: () => void): React.JSX.Element => (
    <Alert variant="destructive" data-testid="error-banner" className="m-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>加载失败</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      {onRetry && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRetry}
          data-testid="retry-btn"
          className="mt-4"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          重试
        </Button>
      )}
    </Alert>
  );
  
  /**
   * 渲染加载状态
   */
  const renderLoadingState = (): React.JSX.Element => (
    <div className="space-y-4 p-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
      <Skeleton className="h-[200px] w-full rounded-xl" />
      <Skeleton className="h-[200px] w-full rounded-xl" />
    </div>
  );
  
  /**
   * 渲染资产详情主内容
   */
  const renderAssetContent = (): React.JSX.Element => (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">资产详情</h1>
          <p className="text-muted-foreground">
            {assetDetail?.name || assetId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>
      
      {/* 主内容区域 - 使用 Tabs 布局 */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            基本信息
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            审计日志
            {logs.length > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {logs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="topology" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            关系拓扑
          </TabsTrigger>
        </TabsList>
        
        {/* 基本信息 Tab */}
        <TabsContent value="info" className="space-y-4">
          <AssetInfoPanel 
            asset={assetDetail}
            auditableFields={auditableFieldMap}
          />
        </TabsContent>
        
        {/* 审计日志 Tab - 核心功能 */}
        <TabsContent value="audit" className="space-y-4">
          <AuditLogPanel
            assetId={assetId || ''}
            logs={logs}
            isLoading={isLoadingLogs}
            error={logsError}
            pagination={pagination}
            isFetching={isFetching}
            expanded={isAuditPanelExpanded}
            onExpandChange={setIsAuditPanelExpanded}
            onRefresh={handleRetry}
            onFilterChange={handleApplyFilters}
            getFieldDisplayName={getFieldDisplayName}
            getDiffStrategy={getDiffStrategy}
            timeRange={timeRangeFilter}
            operationType={operationTypeFilter}
          />
        </TabsContent>
        
        {/* 关系拓扑 Tab */}
        <TabsContent value="topology" className="space-y-4">
          <AssetTopologyView
            assetId={assetId || ''}
            assetName={assetDetail?.name}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
  
  // 渲染逻辑
  if (isLoadingAsset) {
    return (
      <div className="min-h-screen bg-background">
        <Card className="m-6">
          <CardHeader>
            <CardTitle>资产详情</CardTitle>
          </CardHeader>
          <CardContent>
            {renderLoadingState()}
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (assetError) {
    return (
      <div className="min-h-screen bg-background">
        {renderErrorState(assetError)}
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      {renderAssetContent()}
    </div>
  );
}

export default AssetDetailPage;