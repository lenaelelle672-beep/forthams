/**
 * AuditLogPanel Component
 * 
 * 审计日志面板组件 - 用于展示资产变更历史轨迹
 * 
 * @description
 * - 展示审计日志时间线列表
 * - 支持时间范围筛选
 * - 支持字段级变更 Diff 视图
 * - 集成 WebSocket 实时更新
 * 
 * @spec SWARM-051 - 前端集成-资产详情页面开发
 * @phase Phase 4.2: 前端审计日志可视化集成
 * 
 * @testId TC-051-02, TC-051-03, TC-051-04, TC-051-05, TC-051-06
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuditLogs } from '../../hooks/useAuditLogs';
import { useAuditRealtime } from '../../hooks/useAuditRealtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, User, ChevronDown, ChevronUp, Filter, RefreshCw, AlertCircle, Activity } from 'lucide-react';
import { format, parseISO, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ============================================================================
// Type Definitions
// ============================================================================

/** 时间范围筛选参数 */
interface TimeRange {
  startTime?: string;
  endTime?: string;
}

/** 字段变更信息 */
interface ChangedField {
  field: string;
  displayName: string;
  oldValue: unknown;
  newValue: unknown;
}

/** 审计日志条目 */
interface AuditLogEntry {
  eventId: string;
  assetId: string;
  assetType: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  operator: string;
  timestamp: string;
  changedFields: ChangedField[];
  metadata?: Record<string, unknown>;
}

/** 审计日志响应数据 */
interface AuditLogResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

/** AuditLogPanel 组件属性 */
interface AuditLogPanelProps {
  /** 资产 ID */
  assetId: string;
  /** 初始时间范围 */
  initialTimeRange?: TimeRange;
  /** 筛选变更回调 */
  onFilterChange?: (range: TimeRange) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** 操作类型颜色映射 */
const OPERATION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800 border-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
  DELETE: 'bg-red-100 text-red-800 border-red-200',
};

/** 操作类型中文显示 */
const OPERATION_LABELS: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 格式化相对时间显示
 * 
 * @param timestamp - ISO8601 时间戳
 * @returns 相对时间字符串 (如 "5分钟前", "2小时前")
 */
function formatRelativeTime(timestamp: string): string {
  try {
    const date = parseISO(timestamp);
    const now = new Date();
    const minutes = differenceInMinutes(now, date);
    const hours = differenceInHours(now, date);
    const days = differenceInDays(now, date);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    
    return format(date, 'yyyy-MM-dd', { locale: zhCN });
  } catch {
    return timestamp;
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * 字段变更 Diff 视图
 * 
 * @description 展示字段级别的变更差异，旧值红色背景，新值绿色背景
 * @testId TC-051-03
 */
interface FieldDiffViewProps {
  changedFields: ChangedField[];
}

const FieldDiffView: React.FC<FieldDiffViewProps> = ({ changedFields }) => {
  if (!changedFields || changedFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
      <div className="text-sm font-medium text-gray-700 mb-3">字段变更详情</div>
      <div className="grid gap-3">
        {changedFields.map((field, index) => (
          <div
            key={`${field.field}-${index}`}
            className="grid grid-cols-12 gap-2 items-center text-sm"
          >
            <div className="col-span-3 font-medium text-gray-700 truncate" title={field.displayName || field.field}>
              {field.displayName || field.field}
            </div>
            <div className="col-span-4 p-2 rounded bg-red-50 text-red-700 border border-red-100 diff-old-value overflow-hidden text-ellipsis" title={String(field.oldValue ?? '-')}>
              {field.oldValue !== undefined ? String(field.oldValue) : '-'}
            </div>
            <div className="col-span-1 flex justify-center text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <div className="col-span-4 p-2 rounded bg-green-50 text-green-700 border border-green-100 diff-new-value overflow-hidden text-ellipsis" title={String(field.newValue ?? '-')}>
              {field.newValue !== undefined ? String(field.newValue) : '-'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 审计日志条目卡片
 * 
 * @description 单条审计日志展示组件，支持展开/折叠
 */
interface AuditLogEntryCardProps {
  log: AuditLogEntry;
  isNew?: boolean;
  onToggle: () => void;
}

const AuditLogEntryCard: React.FC<AuditLogEntryCardProps> = ({ log, isNew, onToggle }) => {
  const hasChanges = log.changedFields && log.changedFields.length > 0;
  const [expanded, setExpanded] = useState(false);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
    onToggle();
  };

  return (
    <div
      className={cn(
        'border rounded-lg p-4 bg-white hover:shadow-md transition-all duration-200 cursor-pointer',
        isNew && 'ring-2 ring-blue-400 animate-pulse'
      )}
      onClick={hasChanges ? handleToggle : undefined}
      data-testid={isNew ? 'audit-log-entry-new' : `audit-log-entry-${log.eventId}`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Operation Badge */}
          <Badge className={OPERATION_COLORS[log.operation] || 'bg-gray-100 text-gray-800'}>
            {OPERATION_LABELS[log.operation] || log.operation}
          </Badge>
          
          {/* Operator */}
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <User className="w-4 h-4" />
            <span className="font-medium">{log.operator}</span>
          </div>
          
          {/* Timestamp */}
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span title={format(parseISO(log.timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}>
              {formatRelativeTime(log.timestamp)}
            </span>
          </div>

          {/* Asset Type Badge */}
          {log.assetType && (
            <Badge variant="outline" className="text-xs">
              {log.assetType}
            </Badge>
          )}
        </div>

        {/* Expand/Collapse Button */}
        {hasChanges && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={handleToggle}
            aria-label={expanded ? '收起详情' : '展开详情'}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Event ID (collapsed view) */}
      <div className="mt-2 text-xs text-gray-400">
        事件ID: {log.eventId}
      </div>

      {/* Expanded Content - Field Diff */}
      {expanded && hasChanges && (
        <FieldDiffView changedFields={log.changedFields} />
      )}
    </div>
  );
};

/**
 * 审计日志筛选工具栏
 * 
 * @description 时间范围筛选组件
 * @testId TC-051-04
 */
interface AuditFilterBarProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onApply: () => void;
}

const AuditFilterBar: React.FC<AuditFilterBarProps> = ({ timeRange, onTimeRangeChange, onApply }) => {
  const [localRange, setLocalRange] = useState<TimeRange>(timeRange);

  const handleChange = (field: 'startTime' | 'endTime', value: string) => {
    const newRange = { ...localRange, [field]: value };
    setLocalRange(newRange);
    onTimeRangeChange(newRange);
  };

  const handleApply = () => {
    onApply();
  };

  return (
    <div className="flex items-end gap-4 p-4 bg-gray-50 rounded-lg">
      <Filter className="w-5 h-5 text-gray-500 mb-3" />
      
      {/* Start Date */}
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="start-date-input">
          开始时间
        </label>
        <Input
          id="start-date-input"
          type="datetime-local"
          value={localRange.startTime || ''}
          onChange={(e) => handleChange('startTime', e.target.value)}
          className="w-full"
        />
      </div>
      
      <span className="text-gray-400 mb-3">至</span>
      
      {/* End Date */}
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block" htmlFor="end-date-input">
          结束时间
        </label>
        <Input
          id="end-date-input"
          type="datetime-local"
          value={localRange.endTime || ''}
          onChange={(e) => handleChange('endTime', e.target.value)}
          className="w-full"
        />
      </div>
      
      {/* Apply Button */}
      <Button
        id="apply-filter-btn"
        onClick={handleApply}
        data-testid="apply-filter-btn"
        className="mb-0"
      >
        应用筛选
      </Button>
    </div>
  );
};

/**
 * 错误提示组件
 * 
 * @description API 错误状态展示
 * @testId TC-051-06
 */
interface ErrorBannerProps {
  message?: string;
  onRetry: () => void;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ message = '加载审计日志失败', onRetry }) => {
  return (
    <div
      className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between"
      data-testid="error-banner"
    >
      <div className="flex items-center gap-2 text-red-700">
        <AlertCircle className="w-5 h-5" />
        <span>{message}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        data-testid="retry-btn"
        className="border-red-300 text-red-700 hover:bg-red-100"
      >
        <RefreshCw className="w-4 h-4 mr-1" />
        重试
      </Button>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * AuditLogPanel - 审计日志面板主组件
 * 
 * @description
 * 资产详情页面的审计日志展示模块，支持：
 * - 审计日志时间线列表渲染
 * - 时间范围筛选
 * - 字段级变更 Diff 视图
 * - WebSocket 实时更新
 * - 错误处理与重试机制
 * 
 * @param props - AuditLogPanelProps
 * @returns React 组件
 * 
 * @example
 * ```tsx
 * <AuditLogPanel
 *   assetId="AST-2024-001"
 *   initialTimeRange={{ startTime: '2024-01-01', endTime: '2024-01-31' }}
 *   onFilterChange={(range) => console.log(range)}
 * />
 * ```
 */
export const AuditLogPanel: React.FC<AuditLogPanelProps> = ({
  assetId,
  initialTimeRange,
  onFilterChange,
}) => {
  // State management
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange || {});
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [newEntryIds, setNewEntryIds] = useState<Set<string>>(new Set());

  // Fetch audit logs using hook
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useAuditLogs({
    assetId,
    timeRange,
  });

  // WebSocket real-time subscription
  const { lastEvent } = useAuditRealtime({
    assetId,
    eventType: 'audit.asset.updated',
  });

  // Merge fetched logs with real-time updates
  const logs: AuditLogEntry[] = React.useMemo(() => {
    const fetchedLogs = data?.data || [];
    
    // If there's a new real-time event, prepend it
    if (lastEvent?.event) {
      const newLog = lastEvent.event as AuditLogEntry;
      // Check if log already exists
      if (!fetchedLogs.some(log => log.eventId === newLog.eventId)) {
        return [newLog, ...fetchedLogs];
      }
    }
    
    return fetchedLogs;
  }, [data, lastEvent]);

  const pagination = data?.pagination;

  // Track new entries from WebSocket
  useEffect(() => {
    if (lastEvent?.event) {
      const newLog = lastEvent.event as AuditLogEntry;
      setNewEntryIds(prev => new Set([...prev, newLog.eventId]));
      
      // Remove "new" marker after 5 seconds
      const timer = setTimeout(() => {
        setNewEntryIds(prev => {
          const next = new Set(prev);
          next.delete(newLog.eventId);
          return next;
        });
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [lastEvent]);

  // Toggle entry expansion
  const toggleExpand = useCallback((eventId: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  // Handle filter application
  const handleApplyFilter = useCallback(() => {
    if (onFilterChange) {
      onFilterChange(timeRange);
    }
    // Trigger refetch is handled automatically by useAuditLogs
  }, [timeRange, onFilterChange]);

  // Handle retry
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="audit-log-panel space-y-4" data-asset-id={assetId}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">审计日志</h3>
        </div>
        {pagination && (
          <span className="text-sm text-gray-500">
            共 {pagination.total} 条记录
          </span>
        )}
      </div>

      {/* Filter Bar */}
      <AuditFilterBar
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        onApply={handleApplyFilter}
      />

      {/* Error Banner */}
      {error && (
        <ErrorBanner message={error.message || '加载审计日志失败'} onRetry={handleRetry} />
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">加载审计日志...</span>
        </div>
      )}

      {/* Audit Log Timeline */}
      {!isLoading && !error && (
        <ScrollArea className="h-[400px] pr-4">
          <div className="audit-log-timeline space-y-3">
            {/* Timeline indicator */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
            
            {logs.map((log) => (
              <AuditLogEntryCard
                key={log.eventId}
                log={log}
                isNew={newEntryIds.has(log.eventId)}
                onToggle={() => toggleExpand(log.eventId)}
              />
            ))}

            {/* Empty State */}
            {logs.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无审计日志记录</p>
                <p className="text-sm mt-1">在时间范围内没有资产变更记录</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Pagination Controls */}
      {pagination && pagination.total > pagination.pageSize && (
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-gray-600">
            第 {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize)} 页
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => {
                // Previous page logic would be handled by the hook
                const newPage = pagination.page - 1;
                // Trigger page change via refetch or callback
              }}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
              onClick={() => {
                // Next page logic would be handled by the hook
                const newPage = pagination.page + 1;
                // Trigger page change via refetch or callback
              }}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      {/* Real-time indicator */}
      {lastEvent && (
        <div className="flex items-center gap-2 text-xs text-green-600">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>实时同步中</span>
        </div>
      )}
    </div>
  );
};

export default AuditLogPanel;