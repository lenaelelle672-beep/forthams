/**
 * AuditLogPanel Component
 * 
 * 审计日志面板组件 - 展示资产变更历史轨迹
 * 
 * @description
 * - 支持时间范围筛选
 * - 支持字段级变更 Diff 视图
 * - 支持实时 WebSocket 更新
 * - 集成错误处理与重试机制
 * 
 * @spec SWARM-051 Phase 4.2 M4.2.2
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  Calendar as CalendarIcon, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Filter, 
  RefreshCw, 
  AlertCircle,
  Eye,
  User,
  Activity
} from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getAssetAuditLogs } from '@/api/audit';
import type { AuditLog as ApiAuditLog, AuditFieldChange } from '@/api/audit';
import type { PaginatedResponse } from '@/types/common';

// ============== Type Definitions ==============

/** 审计日志操作类型 */
export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';

/** 时间范围 */
export interface TimeRange {
  startTime: Date | null;
  endTime: Date | null;
}

/** 字段变更 */
export interface ChangedField {
  field: string;
  displayName: string;
  oldValue: unknown;
  newValue: unknown;
}

/** 审计日志条目 */
export interface AuditLogEntry {
  eventId: string;
  assetId: string;
  assetType: string;
  operation: OperationType;
  operator: string;
  timestamp: string;
  changedFields: ChangedField[];
  metadata?: Record<string, unknown>;
}

/** @Auditable 字段映射配置 */
export interface FieldDisplayConfig {
  displayName: string;
  diffStrategy: 'text' | 'category' | 'location' | 'status' | 'currency';
}

/** 审计日志响应 */
export interface AuditLogResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

/** AuditLogPanel Props */
export interface AuditLogPanelProps {
  assetId: string;
  initialLogs?: AuditLogEntry[];
  timeRange?: TimeRange;
  operationType?: OperationType;
  onFilterChange?: (filters: AuditFilters) => void;
  onLogClick?: (log: AuditLogEntry) => void;
  className?: string;
}

/** 筛选状态 */
export interface AuditFilters {
  timeRange: TimeRange;
  operationType: OperationType | 'ALL';
  page: number;
  pageSize: number;
}

// ============== Constants ==============

/** @Auditable 字段映射表 */
export const AUDITABLE_FIELD_MAP: Record<string, FieldDisplayConfig> = {
  name: {
    displayName: '资产名称',
    diffStrategy: 'text',
  },
  category: {
    displayName: '资产类别',
    diffStrategy: 'category',
  },
  location: {
    displayName: '存放地点',
    diffStrategy: 'location',
  },
  status: {
    displayName: '资产状态',
    diffStrategy: 'status',
  },
  value: {
    displayName: '资产价值',
    diffStrategy: 'currency',
  },
  description: {
    displayName: '资产描述',
    diffStrategy: 'text',
  },
  serialNumber: {
    displayName: '序列号',
    diffStrategy: 'text',
  },
  purchaseDate: {
    displayName: '购买日期',
    diffStrategy: 'text',
  },
  warrantyExpiry: {
    displayName: '保修到期',
    diffStrategy: 'text',
  },
};

/** 操作类型颜色映射 */
const OPERATION_COLORS: Record<OperationType, { bg: string; text: string; border: string }> = {
  CREATE: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  UPDATE: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  DELETE: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
};

/** 操作类型中文映射 */
const OPERATION_LABELS: Record<OperationType, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
};

// ============== Sub-Components ==============

/**
 * 字段变更 Diff 视图组件
 * 
 * @description 展示字段级变更，支持旧值红色背景、新值绿色背景高亮
 * @see TC-051-03 验收测试
 */
export const FieldDiffView: React.FC<{ changedFields: ChangedField[] }> = ({ changedFields }) => {
  if (!changedFields || changedFields.length === 0) {
    return <span className="text-muted-foreground text-sm">无字段变更</span>;
  }

  return (
    <div className="space-y-2" data-testid="field-diff-view">
      {changedFields.map((field, index) => (
        <div key={`${field.field}-${index}`} className="text-sm">
          <div className="font-medium text-muted-foreground mb-1">
            {field.displayName}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span 
              className="diff-old-value px-2 py-1 rounded bg-red-100 text-red-800 border border-red-300"
              style={{ backgroundColor: '#fee2e2' }}
            >
              {String(field.oldValue ?? '(空)')}
            </span>
            <span className="text-muted-foreground">→</span>
            <span 
              className="diff-new-value px-2 py-1 rounded bg-green-100 text-green-800 border border-green-300"
              style={{ backgroundColor: '#dcfce7' }}
            >
              {String(field.newValue ?? '(空)')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * 单条审计日志条目组件
 * 
 * @description 展示单条审计日志，支持展开/收起变更详情
 */
export const AuditLogEntry: React.FC<{
  log: AuditLogEntry;
  expanded: boolean;
  onToggle: () => void;
  onViewDiff?: () => void;
  isNew?: boolean;
}> = ({ log, expanded, onToggle, onViewDiff, isNew }) => {
  const operationStyle = OPERATION_COLORS[log.operation];
  const timestamp = useMemo(() => {
    try {
      return format(parseISO(log.timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
    } catch {
      return log.timestamp;
    }
  }, [log.timestamp]);

  return (
    <div 
      className={cn(
        "border rounded-lg p-4 transition-all duration-200",
        operationStyle.border,
        isNew && "animate-pulse bg-primary/5"
      )}
      data-testid="audit-log-entry"
      data-testid-new={isNew}
      data-operation={log.operation}
    >
      {/* 头部信息 */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              className={cn(operationStyle.bg, operationStyle.text)}
              variant="secondary"
            >
              {OPERATION_LABELS[log.operation]}
            </Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {log.operator}
            </span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timestamp}
            </span>
          </div>
          
          {/* 变更摘要 */}
          {log.changedFields.length > 0 && (
            <div className="text-sm text-muted-foreground">
              变更字段: {log.changedFields.map(f => f.displayName).join(', ')}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          {log.changedFields.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onViewDiff}
              data-testid="view-diff-btn"
              className="flex items-center gap-1"
            >
              <Eye className="h-4 w-4" />
              查看变更
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onToggle}
            aria-label={expanded ? '收起详情' : '展开详情'}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 展开的变更详情 */}
      {expanded && (
        <div className="mt-4 pt-4 border-t">
          <FieldDiffView changedFields={log.changedFields} />
        </div>
      )}
    </div>
  );
};

/**
 * 筛选工具栏组件
 * 
 * @description 支持时间范围筛选、操作类型筛选
 * @see TC-051-04 验收测试
 */
export const AuditFilterBar: React.FC<{
  filters: AuditFilters;
  onApply: (filters: AuditFilters) => void;
  disabled?: boolean;
}> = ({ filters, onApply, disabled }) => {
  const [localFilters, setLocalFilters] = useState<AuditFilters>(filters);
  const [startDateInput, setStartDateInput] = useState<string>(
    filters.timeRange.startTime ? format(filters.timeRange.startTime, 'yyyy-MM-dd') : ''
  );
  const [endDateInput, setEndDateInput] = useState<string>(
    filters.timeRange.endTime ? format(filters.timeRange.endTime, 'yyyy-MM-dd') : ''
  );

  useEffect(() => {
    setLocalFilters(filters);
    setStartDateInput(filters.timeRange.startTime ? format(filters.timeRange.startTime, 'yyyy-MM-dd') : '');
    setEndDateInput(filters.timeRange.endTime ? format(filters.timeRange.endTime, 'yyyy-MM-dd') : '');
  }, [filters]);

  const handleApply = useCallback(() => {
    const updatedFilters: AuditFilters = {
      ...localFilters,
      timeRange: {
        startTime: startDateInput ? new Date(startDateInput) : null,
        endTime: endDateInput ? new Date(endDateInput) : null,
      },
    };
    onApply(updatedFilters);
  }, [localFilters, startDateInput, endDateInput, onApply]);

  const handleReset = useCallback(() => {
    const defaultFilters: AuditFilters = {
      timeRange: { startTime: null, endTime: null },
      operationType: 'ALL',
      page: 1,
      pageSize: 20,
    };
    setLocalFilters(defaultFilters);
    setStartDateInput('');
    setEndDateInput('');
    onApply(defaultFilters);
  }, [onApply]);

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg" data-testid="audit-filter-bar">
      {/* 时间范围筛选 */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">筛选条件:</span>
      </div>
      
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={startDateInput}
          onChange={(e) => setStartDateInput(e.target.value)}
          className="w-36"
          data-testid="start-date-input"
          disabled={disabled}
        />
        <span className="text-muted-foreground">至</span>
        <Input
          type="date"
          value={endDateInput}
          onChange={(e) => setEndDateInput(e.target.value)}
          className="w-36"
          data-testid="end-date-input"
          disabled={disabled}
        />
      </div>

      {/* 操作类型筛选 */}
      <Select
        value={localFilters.operationType}
        onValueChange={(value) => setLocalFilters(prev => ({ ...prev, operationType: value as OperationType | 'ALL' }))}
        disabled={disabled}
      >
        <SelectTrigger className="w-32" data-testid="operation-type-select">
          <SelectValue placeholder="操作类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">全部</SelectItem>
          <SelectItem value="CREATE">创建</SelectItem>
          <SelectItem value="UPDATE">更新</SelectItem>
          <SelectItem value="DELETE">删除</SelectItem>
        </SelectContent>
      </Select>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <Button 
          onClick={handleApply} 
          disabled={disabled}
          size="sm"
          data-testid="apply-filter-btn"
        >
          应用筛选
        </Button>
        <Button 
          onClick={handleReset} 
          variant="outline"
          disabled={disabled}
          size="sm"
        >
          重置
        </Button>
      </div>
    </div>
  );
};

/**
 * 错误提示组件
 * 
 * @description 展示错误信息与重试按钮
 * @see TC-051-06 验收测试
 */
export const AuditErrorBanner: React.FC<{
  error: Error | null;
  onRetry: () => void;
}> = ({ error, onRetry }) => (
  <div 
    className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
    data-testid="error-banner"
  >
    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
    <div className="flex-1">
      <p className="text-sm font-medium text-destructive">加载审计日志失败</p>
      <p className="text-xs text-muted-foreground">
        {error?.message || '未知错误，请稍后重试'}
      </p>
    </div>
    <Button 
      onClick={onRetry} 
      variant="outline"
      size="sm"
      data-testid="retry-btn"
      className="flex items-center gap-1"
    >
      <RefreshCw className="h-4 w-4" />
      重试
    </Button>
  </div>
);

/**
 * 加载骨架屏组件
 */
const AuditLogSkeleton: React.FC = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="border rounded-lg p-4 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-6 w-16 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="mt-3 h-4 w-48 bg-muted rounded" />
      </div>
    ))}
  </div>
);

/**
 * 空状态组件
 */
const AuditEmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
    <h3 className="text-lg font-medium mb-2">暂无审计日志</h3>
    <p className="text-sm text-muted-foreground">
      该资产暂无变更记录或筛选条件下无数据
    </p>
  </div>
);

// ============== Main Component ==============

/**
 * AuditLogPanel - 审计日志面板主组件
 * 
 * @description
 * 资产详情页的审计日志展示模块，提供：
 * - 时间线展示
 * - 筛选器
 * - 字段变更 Diff 视图
 * - 实时 WebSocket 更新支持
 * 
 * @spec SWARM-051 Phase 4.2 M4.2.2
 * 
 * @example
 * ```tsx
 * <AuditLogPanel 
 *   assetId="asset-uuid-12345"
 *   onFilterChange={(filters) => { /* handle filters */ }}
 * />
 * ```
 */
export const AuditLogPanel: React.FC<AuditLogPanelProps> = ({
  assetId,
  initialLogs = [],
  timeRange,
  operationType,
  onFilterChange,
  onLogClick,
  className,
}) => {
  // ============== State ==============
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [newLogIds, setNewLogIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: initialLogs.length,
  });
  const [filters, setFilters] = useState<AuditFilters>({
    timeRange: timeRange || { startTime: null, endTime: null },
    operationType: operationType || 'ALL',
    page: 1,
    pageSize: 20,
  });

  // ============== Effects ==============

  // 初始加载
  useEffect(() => {
    if (assetId) {
      fetchAuditLogs();
    }
  }, [assetId]);

  // 筛选变更回调
  useEffect(() => {
    onFilterChange?.(filters);
  }, [filters, onFilterChange]);

  // WebSocket 实时更新订阅（预留接口 — 等待后端 WebSocket 就绪）
  useEffect(() => {
    if (!assetId) return;

    // TODO: 等待后端 WebSocket 就绪 — 集成 audit.asset.updated 事件订阅
    // const unsubscribe = subscribeToAuditUpdates(assetId, (event) => {
    //   handleNewAuditEvent(event);
    // });
    // return () => unsubscribe();

    return () => {};
  }, [assetId]);

  // ============== Handlers ==============

  /**
   * 将 API 审计日志映射为本地 AuditLogEntry
   */
  const mapApiLogToEntry = useCallback((apiLog: ApiAuditLog): AuditLogEntry => ({
    eventId: String(apiLog.id),
    assetId: apiLog.resourceId ?? '',
    assetType: apiLog.resourceType ?? '',
    operation: (apiLog.operationType as OperationType) || 'UPDATE',
    operator: apiLog.operatorName,
    timestamp: apiLog.createdAt,
    changedFields: (apiLog.changes ?? []).map((change: AuditFieldChange) => ({
      field: change.field,
      displayName: change.fieldLabel ?? change.field,
      oldValue: change.oldValue ?? '',
      newValue: change.newValue ?? '',
    })),
    metadata: apiLog.description ? { description: apiLog.description } : undefined,
  }), []);

  /**
   * 获取审计日志数据 — 调用真实 API
   */
  const fetchAuditLogs = useCallback(async () => {
    if (!assetId) return;

    setLoading(true);
    setError(null);

    try {
      const numericId = Number(assetId);
      const response = await getAssetAuditLogs(numericId, {
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...(filters.operationType !== 'ALL' ? { operationType: filters.operationType } : {}),
        ...(filters.timeRange.startTime ? { startTime: filters.timeRange.startTime.toISOString() } : {}),
        ...(filters.timeRange.endTime ? { endTime: filters.timeRange.endTime.toISOString() } : {}),
      });

      const pageData = response.data.data;
      const mappedLogs = pageData.records.map(mapApiLogToEntry);

      setLogs(mappedLogs);
      setPagination(prev => ({
        ...prev,
        total: pageData.total,
        page: pageData.current,
        pageSize: pageData.size,
      }));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('获取审计日志失败'));
    } finally {
      setLoading(false);
    }
  }, [assetId, filters, pagination.page, pagination.pageSize, mapApiLogToEntry]);

  /**
   * 处理筛选变更
   */
  const handleFilterChange = useCallback((newFilters: AuditFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  /**
   * 处理日志展开/收起
   */
  const handleToggleExpand = useCallback((logId: string) => {
    setExpandedLogId(prev => prev === logId ? null : logId);
  }, []);

  /**
   * 处理查看变更 Diff
   */
  const handleViewDiff = useCallback((log: AuditLogEntry) => {
    setExpandedLogId(log.eventId);
    onLogClick?.(log);
  }, [onLogClick]);

  /**
   * 处理重试
   */
  const handleRetry = useCallback(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  /**
   * 处理新日志事件（WebSocket）
   */
  const handleNewAuditEvent = useCallback((event: AuditLogEntry) => {
    setLogs(prev => [event, ...prev]);
    setNewLogIds(prev => new Set(prev).add(event.eventId));
    setPagination(prev => ({ ...prev, total: prev.total + 1 }));

    // 5秒后移除新标记
    setTimeout(() => {
      setNewLogIds(prev => {
        const next = new Set(prev);
        next.delete(event.eventId);
        return next;
      });
    }, 5000);
  }, []);

  // ============== Filtered Logs ==============

  const filteredLogs = useMemo(() => {
    let result = [...logs];

    // 时间范围筛选
    if (filters.timeRange.startTime || filters.timeRange.endTime) {
      result = result.filter(log => {
        try {
          const logDate = parseISO(log.timestamp);
          if (filters.timeRange.startTime && filters.timeRange.endTime) {
            return isWithinInterval(logDate, {
              start: filters.timeRange.startTime,
              end: filters.timeRange.endTime,
            });
          } else if (filters.timeRange.startTime) {
            return logDate >= filters.timeRange.startTime;
          } else if (filters.timeRange.endTime) {
            return logDate <= filters.timeRange.endTime;
          }
          return true;
        } catch {
          return true;
        }
      });
    }

    // 操作类型筛选
    if (filters.operationType !== 'ALL') {
      result = result.filter(log => log.operation === filters.operationType);
    }

    return result;
  }, [logs, filters]);

  // ============== Render ==============

  return (
    <Card className={cn('w-full', className)} data-testid="audit-log-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              审计日志
            </CardTitle>
            <CardDescription>
              资产变更历史轨迹 ({pagination.total} 条记录)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAuditLogs}
            disabled={loading}
            className="flex items-center gap-1"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 筛选工具栏 */}
        <AuditFilterBar 
          filters={filters}
          onApply={handleFilterChange}
          disabled={loading}
        />

        {/* 错误提示 */}
        {error && (
          <AuditErrorBanner error={error} onRetry={handleRetry} />
        )}

        {/* 日志列表 */}
        <div className="space-y-3" data-testid="audit-log-timeline">
          {loading ? (
            <AuditLogSkeleton />
          ) : filteredLogs.length === 0 ? (
            <AuditEmptyState />
          ) : (
            filteredLogs.map((log) => (
              <AuditLogEntry
                key={log.eventId}
                log={log}
                expanded={expandedLogId === log.eventId}
                onToggle={() => handleToggleExpand(log.eventId)}
                onViewDiff={() => handleViewDiff(log)}
                isNew={newLogIds.has(log.eventId)}
              />
            ))
          )}
        </div>

        {/* 分页信息 */}
        {pagination.total > pagination.pageSize && (
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
            <span>
              显示 {(pagination.page - 1) * pagination.pageSize + 1} - 
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} 条，
              共 {pagination.total} 条
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                上一页
              </Button>
              <span>第 {pagination.page} 页</span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page * pagination.pageSize >= pagination.total}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ============== Exports ==============

export default AuditLogPanel;