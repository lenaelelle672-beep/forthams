/**
 * AssetDetailPage - 资产详情页面
 * 
 * 功能模块：资产管理 -> 资产详情
 * 需求编号：SWARM-051
 * 
 * @description
 * 资产详情页面是用户查看资产全量属性、关联关系及操作历史的唯一入口。
 * 包含以下核心功能：
 * - 资产基本信息卡片（AssetInfoCard）
 * - 资产扩展属性面板（AssetMetadataPanel）
 * - 审计日志面板（AuditLogPanel）
 * - @Auditable 字段高亮展示
 * - 审计日志筛选与分页
 * 
 * @ATB 验收测试基准
 * - ATB-1: 资产详情页面正常渲染
 * - ATB-2: 资产信息卡片数据展示
 * - ATB-3: 审计日志面板展示
 * - ATB-4: @Auditable 字段高亮展示
 * - ATB-5: AuditService API 对接验证
 * - ATB-6: 审计日志分页加载
 * - ATB-7: 边界场景 - 资产不存在
 * - ATB-8: Loading 状态展示
 * - ATB-9: 变更前后值对比展示
 * 
 * @see {@link https://docs.example.com/asset-detail} 资产详情页设计文档
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertCircle, 
  RefreshCw, 
  Loader2,
  FileText,
  Metadata,
  History,
  ChevronDown,
  ChevronUp,
  Filter,
  MoreHorizontal
} from 'lucide-react';

// 类型导入
import type { AssetDetail } from '../../types/asset.types';
import type { AuditLogEntry, AuditLogFilter, AuditLogResponse } from '../../types/audit.types';

// 服务导入
import { getAssetDetail } from '../../services/assetService';
import { getAuditLogs } from '../../services/auditApi';

// UI 组件导入
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

/**
 * 页面状态枚举
 */
enum PageState {
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  NOT_FOUND = 'NOT_FOUND',
}

/**
 * 资产详情页面组件
 * 
 * @component
 * @example
 * ```tsx
 * // 路由配置
 * <Route path="/asset/detail/:assetId" element={<AssetDetailPage />} />
 * ```
 */
const AssetDetailPage: React.FC = () => {
  // ============ 路由与导航 ============
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();

  // ============ 状态管理 ============
  const [pageState, setPageState] = useState<PageState>(PageState.LOADING);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // 资产详情状态
  const [assetDetail, setAssetDetail] = useState<AssetDetail | null>(null);
  
  // 审计日志状态
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState<boolean>(false);
  const [auditLogsHasMore, setAuditLogsHasMore] = useState<boolean>(false);
  const [auditLogsTotal, setAuditLogsTotal] = useState<number>(0);
  
  // 筛选状态
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [filterDateRange, setFilterDateRange] = useState<string>('90d');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 20;
  const MAX_LOGS = 100;

  // ============ 数据获取 ============
  
  /**
   * 获取资产详情数据
   * @async
   * @function fetchAssetDetail
   * @returns {Promise<void>}
   */
  const fetchAssetDetail = useCallback(async () => {
    if (!assetId) {
      setPageState(PageState.ERROR);
      setErrorMessage('缺少资产ID参数');
      return;
    }

    setPageState(PageState.LOADING);
    setErrorMessage('');

    try {
      const data = await getAssetDetail(assetId);
      
      if (!data) {
        setPageState(PageState.NOT_FOUND);
        setErrorMessage('未找到该资产');
        return;
      }

      setAssetDetail(data);
      setPageState(PageState.SUCCESS);
      
      // 资产详情加载成功后，获取审计日志
      fetchAuditLogs(data.id, 1);
    } catch (error) {
      setPageState(PageState.ERROR);
      setErrorMessage(error instanceof Error ? error.message : '获取资产详情失败');
    }
  }, [assetId]);

  /**
   * 获取审计日志列表
   * @async
   * @function fetchAuditLogs
   * @param {string} assetId - 资产ID
   * @param {number} page - 页码
   * @returns {Promise<void>}
   */
  const fetchAuditLogs = useCallback(async (assetId: string, page: number) => {
    setAuditLogsLoading(true);

    try {
      const filter: AuditLogFilter = {
        assetId,
        page,
        pageSize: PAGE_SIZE,
      };

      // 应用操作类型筛选
      if (filterAction !== 'ALL') {
        filter.action = filterAction as AuditLogEntry['action'];
      }

      // 应用时间范围筛选
      const now = new Date();
      let startDate: Date;
      switch (filterDateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
        default:
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
      }
      filter.startDate = startDate.toISOString();
      filter.endDate = now.toISOString();

      const response: AuditLogResponse = await getAuditLogs(filter);

      if (page === 1) {
        setAuditLogs(response.logs || []);
      } else {
        setAuditLogs(prev => [...prev, ...(response.logs || [])]);
      }

      const totalLogs = response.total || 0;
      setAuditLogsTotal(totalLogs);
      setAuditLogsHasMore(
        (page * PAGE_SIZE < totalLogs) && 
        (page * PAGE_SIZE < MAX_LOGS)
      );
      setCurrentPage(page);
    } catch (error) {
      console.error('获取审计日志失败:', error);
      // 审计日志获取失败不影响主页面显示
    } finally {
      setAuditLogsLoading(false);
    }
  }, [filterAction, filterDateRange]);

  /**
   * 加载更多审计日志
   * @function handleLoadMoreLogs
   */
  const handleLoadMoreLogs = useCallback(() => {
    if (assetDetail && !auditLogsLoading && auditLogsHasMore) {
      fetchAuditLogs(assetDetail.id, currentPage + 1);
    }
  }, [assetDetail, auditLogsLoading, auditLogsHasMore, currentPage, fetchAuditLogs]);

  /**
   * 重新获取数据
   * @function handleRetry
   */
  const handleRetry = useCallback(() => {
    fetchAssetDetail();
  }, [fetchAssetDetail]);

  /**
   * 返回上一页
   * @function handleGoBack
   */
  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // ============ 副作用 ============
  
  /**
   * 组件挂载时获取资产详情
   */
  useEffect(() => {
    fetchAssetDetail();
  }, [fetchAssetDetail]);

  // ============ 工具函数 ============
  
  /**
   * 格式化日期时间
   * @function formatDateTime
   * @param {string} isoString - ISO 8601 格式的时间字符串
   * @returns {string} 格式化后的时间字符串
   */
  const formatDateTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return isoString;
    }
  };

  /**
   * 格式化相对时间
   * @function formatRelativeTime
   * @param {string} isoString - ISO 8601 格式的时间字符串
   * @returns {string} 相对时间字符串
   */
  const formatRelativeTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return `${diffMins} 分钟前`;
      if (diffHours < 24) return `${diffHours} 小时前`;
      if (diffDays < 30) return `${diffDays} 天前`;
      return formatDateTime(isoString);
    } catch {
      return isoString;
    }
  };

  /**
   * 获取操作类型标签
   * @function getActionBadge
   * @param {AuditLogEntry['action']} action - 操作类型
   * @returns {React.ReactNode} 标签组件
   */
  const getActionBadge = (action: AuditLogEntry['action']): React.ReactNode => {
    const badgeConfig: Record<string, { variant: string; label: string }> = {
      CREATE: { variant: 'default', label: '创建' },
      UPDATE: { variant: 'secondary', label: '更新' },
      DELETE: { variant: 'destructive', label: '删除' },
      VIEW: { variant: 'outline', label: '查看' },
    };
    
    const config = badgeConfig[action] || { variant: 'outline', label: action };
    
    return (
      <Badge variant={config.variant as any} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  /**
   * 检查字段是否为 @Auditable 字段
   * @function isAuditableField
   * @param {string} fieldName - 字段名
   * @returns {boolean}
   */
  const isAuditableField = (fieldName: string): boolean => {
    if (!assetDetail?.metadata?.auditableFields) return false;
    return assetDetail.metadata.auditableFields.includes(fieldName);
  };

  /**
   * 切换日志详情展开状态
   * @function toggleLogDetail
   * @param {string} logId - 日志ID
   */
  const toggleLogDetail = (logId: string) => {
    setExpandedLogId(prev => prev === logId ? null : logId);
  };

  // ============ 渲染方法 ============

  /**
   * 渲染加载状态
   * @function renderLoadingState
   * @returns {React.ReactNode}
   */
  const renderLoadingState = (): React.ReactNode => (
    <div className="container mx-auto py-8 px-4" data-testid="loading-skeleton">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-8 w-48" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* 基本信息卡片骨架 */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 扩展属性面板骨架 */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
        
        {/* 审计日志面板骨架 */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  /**
   * 渲染错误状态
   * @function renderErrorState
   * @param {string} message - 错误信息
   * @param {boolean} isNotFound - 是否为 404
   * @returns {React.ReactNode}
   */
  const renderErrorState = (message: string, isNotFound: boolean = false): React.ReactNode => (
    <div className="container mx-auto py-16 px-4">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-6">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {isNotFound ? '资产未找到' : '加载失败'}
        </h1>
        <p className="text-muted-foreground mb-6" data-testid={isNotFound ? 'error-not-found' : 'error-message'}>
          {message || (isNotFound ? '未找到该资产' : '加载资产详情时发生错误')}
        </p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={handleGoBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <Button onClick={handleRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      </div>
    </div>
  );

  /**
   * 渲染资产基本信息卡片
   * @function renderAssetInfoCard
   * @returns {React.ReactNode}
   */
  const renderAssetInfoCard = (): React.ReactNode => {
    if (!assetDetail) return null;

    return (
      <Card className="mb-6" data-testid="asset-name-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            资产基本信息
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/asset/edit/${assetDetail.id}`}>编辑资产</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.print()}>打印</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 资产名称 */}
            <div 
              className={`space-y-1 ${isAuditableField('name') ? 'auditable-highlight' : ''}`}
              data-testid="field-name"
            >
              <p className="text-sm text-muted-foreground">资产名称</p>
              <p className="font-semibold text-lg">{assetDetail.name}</p>
            </div>

            {/* 资产类型 */}
            <div className="space-y-1" data-testid="field-type">
              <p className="text-sm text-muted-foreground">资产类型</p>
              <p className="font-semibold">
                <Badge variant="outline">{assetDetail.type}</Badge>
              </p>
            </div>

            {/* 资产状态 */}
            <div 
              className={`space-y-1 ${isAuditableField('status') ? 'auditable-highlight' : ''}`}
              data-testid="field-status"
            >
              <p className="text-sm text-muted-foreground">资产状态</p>
              <p className="font-semibold">
                <Badge variant={assetDetail.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {assetDetail.status}
                </Badge>
              </p>
            </div>

            {/* 负责人 */}
            <div 
              className={`space-y-1 ${isAuditableField('owner') ? 'auditable-highlight' : ''}`}
              data-testid="field-owner"
            >
              <p className="text-sm text-muted-foreground">负责人</p>
              <p className="font-semibold">{assetDetail.owner || '-'}</p>
            </div>

            {/* 资产ID */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">资产ID</p>
              <p className="font-mono text-sm">{assetDetail.id}</p>
            </div>

            {/* 创建时间 */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">创建时间</p>
              <p className="text-sm">{formatDateTime(assetDetail.createdAt)}</p>
            </div>

            {/* 更新时间 */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">更新时间</p>
              <p className="text-sm">{formatDateTime(assetDetail.updatedAt)}</p>
            </div>

            {/* 所属部门 */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">所属部门</p>
              <p className="text-sm">{assetDetail.department || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  /**
   * 渲染资产扩展属性面板
   * @function renderAssetMetadataPanel
   * @returns {React.ReactNode}
   */
  const renderAssetMetadataPanel = (): React.ReactNode => {
    if (!assetDetail) return null;

    const metadata = assetDetail.metadata || {};
    const metadataEntries = Object.entries(metadata).filter(
      ([key, value]) => key !== 'auditableFields' && value !== undefined && value !== null
    );

    return (
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Metadata className="h-5 w-5" />
            扩展属性
          </CardTitle>
          <Badge variant="outline">{metadataEntries.length} 项</Badge>
        </CardHeader>
        <CardContent>
          {metadataEntries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metadataEntries.map(([key, value]) => (
                <div 
                  key={key} 
                  className={`p-3 rounded-lg border ${isAuditableField(key) ? 'auditable-highlight' : 'bg-muted/50'}`}
                >
                  <p className="text-sm text-muted-foreground mb-1">{key}</p>
                  <p className="font-medium break-all">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Metadata className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>暂无扩展属性数据</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  /**
   * 渲染变更前后值对比
   * @function renderFieldChanges
   * @param {AuditLogEntry} log - 审计日志条目
   * @returns {React.ReactNode}
   */
  const renderFieldChanges = (log: AuditLogEntry): React.ReactNode => {
    if (!log.changes || log.changes.length === 0) {
      return <p className="text-sm text-muted-foreground">无字段变更</p>;
    }

    return (
      <div className="space-y-2 mt-3 pt-3 border-t" data-testid="change-list">
        {log.changes.map((change, index) => (
          <div 
            key={`${change.field}-${index}`} 
            className="grid grid-cols-3 gap-2 text-sm items-center"
            data-testid="change-item"
          >
            <div className="font-medium truncate" data-testid="change-field">
              {change.field}
            </div>
            <div className="text-destructive text-right truncate" data-testid="change-old-value">
              {change.oldValue ?? '(空)'}
            </div>
            <div className="text-muted-foreground text-center">→</div>
            <div className="text-right truncate col-start-3" data-testid="change-new-value">
              {change.newValue ?? '(空)'}
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * 渲染审计日志面板
   * @function renderAuditLogPanel
   * @returns {React.ReactNode}
   */
  const renderAuditLogPanel = (): React.ReactNode => (
    <Card data-testid="audit-log-panel">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <History className="h-5 w-5" />
            审计日志
            <Badge variant="outline" className="ml-2">
              {auditLogsTotal} 条
            </Badge>
          </CardTitle>
          
          {/* 筛选器 */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-[120px] h-8">
                  <SelectValue placeholder="操作类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部操作</SelectItem>
                  <SelectItem value="CREATE">创建</SelectItem>
                  <SelectItem value="UPDATE">更新</SelectItem>
                  <SelectItem value="DELETE">删除</SelectItem>
                  <SelectItem value="VIEW">查看</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Select value={filterDateRange} onValueChange={setFilterDateRange}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="时间范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">最近 7 天</SelectItem>
                <SelectItem value="30d">最近 30 天</SelectItem>
                <SelectItem value="90d">最近 90 天</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* 审计日志列表 */}
        <div className="space-y-3" role="list" aria-label="审计日志列表">
          {auditLogs.length > 0 ? (
            auditLogs.map((log) => (
              <div 
                key={log.id} 
                className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                data-testid="audit-log-item"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {getActionBadge(log.action)}
                      <span className="text-sm font-medium" data-testid="log-action">
                        {log.action === 'CREATE' && '创建资产'}
                        {log.action === 'UPDATE' && '更新资产'}
                        {log.action === 'DELETE' && '删除资产'}
                        {log.action === 'VIEW' && '查看资产'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">操作人:</span>
                        <span className="font-medium truncate" data-testid="log-operator">
                          {log.operator}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">时间:</span>
                        <span className="truncate" data-testid="log-timestamp" title={formatDateTime(log.timestamp)}>
                          {formatRelativeTime(log.timestamp)}
                        </span>
                      </div>
                    </div>
                    
                    {/* 字段变更详情 - 仅 UPDATE 类型展示 */}
                    {log.action === 'UPDATE' && log.changes && log.changes.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleLogDetail(log.id)}
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          {expandedLogId === log.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          {expandedLogId === log.id ? '收起详情' : '查看变更详情'}
                          <Badge variant="outline" className="ml-1 text-xs">
                            {log.changes.length} 项
                          </Badge>
                        </button>
                        
                        {expandedLogId === log.id && renderFieldChanges(log)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            !auditLogsLoading && (
              <div className="text-center py-12 text-muted-foreground" data-testid="empty-audit-logs">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无审计日志记录</p>
              </div>
            )
          )}
        </div>

        {/* 加载状态 */}
        {auditLogsLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">加载中...</span>
          </div>
        )}

        {/* 加载更多按钮 */}
        {auditLogsHasMore && !auditLogsLoading && (
          <div className="mt-6 text-center">
            <Button 
              variant="outline" 
              onClick={handleLoadMoreLogs}
              data-testid="load-more-btn"
              disabled={auditLogsLoading}
            >
              {auditLogsLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  加载中...
                </>
              ) : (
                `加载更多 (${Math.min(currentPage * PAGE_SIZE, auditLogsTotal)}/${auditLogsTotal})`
              )}
            </Button>
          </div>
        )}

        {/* 已加载全部提示 */}
        {!auditLogsHasMore && auditLogs.length > 0 && auditLogsTotal > PAGE_SIZE && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            已加载全部 {auditLogs.length} 条记录
          </p>
        )}
      </CardContent>
    </Card>
  );

  // ============ 主渲染 ============
  
  /**
   * 根据页面状态渲染不同内容
   */
  const renderContent = (): React.ReactNode => {
    switch (pageState) {
      case PageState.LOADING:
        return renderLoadingState();
      
      case PageState.NOT_FOUND:
        return renderErrorState(errorMessage, true);
      
      case PageState.ERROR:
        return renderErrorState(errorMessage, false);
      
      case PageState.SUCCESS:
      default:
        return (
          <div className="container mx-auto py-8 px-4">
            {/* 返回导航 */}
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" size="icon" onClick={handleGoBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold">资产详情</h1>
              {assetDetail && (
                <Badge variant="outline" className="ml-auto">
                  ID: {assetDetail.id}
                </Badge>
              )}
            </div>

            {/* 响应式布局 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 左侧：资产信息 + 扩展属性 */}
              <div className="lg:col-span-2 space-y-6">
                {renderAssetInfoCard()}
                {renderAssetMetadataPanel()}
              </div>

              {/* 右侧：审计日志面板 */}
              <div className="lg:col-span-1">
                {renderAuditLogPanel()}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {renderContent()}
    </div>
  );
};

export default AssetDetailPage;