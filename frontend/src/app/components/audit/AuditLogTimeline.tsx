/**
 * @file AuditLogTimeline.tsx
 * @description 审计日志时间线组件 - 以时间线形式展示资产变更历史
 * @module components/audit
 * 
 * 功能说明:
 * - 按时间倒序展示审计日志（最新在前）
 * - 每个节点显示操作类型图标（CREATE/UPDATE/DELETE/VIEW）
 * - 点击节点可展开查看详情
 * - 支持实时数据更新
 */

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Pencil, 
  Trash2, 
  Eye,
  Clock,
  User,
  Monitor
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 审计日志类型枚举
 */
export enum AuditOperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW'
}

/**
 * 审计日志字段变更
 */
export interface AuditFieldChange {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  isAuditable: boolean;
}

/**
 * 审计日志条目
 */
export interface AuditLogEntry {
  id: string;
  assetId: string;
  operationType: AuditOperationType;
  operatorId: string;
  operatorName: string;
  operatorIp: string;
  operationTime: string;
  fieldChanges: AuditFieldChange[];
  description?: string;
}

/**
 * 审计日志时间线组件属性
 */
export interface AuditLogTimelineProps {
  /** 审计日志列表 */
  logs: AuditLogEntry[];
  /** 是否加载中 */
  loading?: boolean;
  /** 是否为空状态 */
  empty?: boolean;
  /** 空状态文本 */
  emptyText?: string;
  /** 点击日志条目回调 */
  onLogClick?: (log: AuditLogEntry) => void;
  /** 实时模式（自动高亮最新条目） */
  realtime?: boolean;
  /** 最大显示条目数（0 表示不限制） */
  maxVisible?: number;
  /** 自定义类名 */
  className?: string;
}

/**
 * 操作类型配置
 */
const OPERATION_CONFIG = {
  [AuditOperationType.CREATE]: {
    icon: Plus,
    color: 'text-green-600 bg-green-50 border-green-200',
    label: '创建',
    description: '创建资产'
  },
  [AuditOperationType.UPDATE]: {
    icon: Pencil,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    label: '修改',
    description: '更新资产信息'
  },
  [AuditOperationType.DELETE]: {
    icon: Trash2,
    color: 'text-red-600 bg-red-50 border-red-200',
    label: '删除',
    description: '删除资产'
  },
  [AuditOperationType.VIEW]: {
    icon: Eye,
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    label: '查看',
    description: '查看资产详情'
  }
} as const;

/**
 * 获取操作类型配置
 * @param type - 操作类型
 * @returns 操作类型配置
 */
const getOperationConfig = (type: AuditOperationType) => {
  return OPERATION_CONFIG[type] || OPERATION_CONFIG[AuditOperationType.VIEW];
};

/**
 * 格式化操作时间
 * @param timeStr - ISO 时间字符串
 * @returns 格式化后的时间字符串
 */
const formatOperationTime = (timeStr: string): string => {
  try {
    const date = new Date(timeStr);
    return format(date, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
  } catch {
    return timeStr;
  }
};

/**
 * 获取相对时间描述
 * @param timeStr - ISO 时间字符串
 * @returns 相对时间描述
 */
const getRelativeTimeDescription = (timeStr: string): string => {
  try {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return format(date, 'MM-dd', { locale: zhCN });
  } catch {
    return '';
  }
};

/**
 * 生成变更描述文本
 * @param fieldChanges - 字段变更列表
 * @returns 变更描述文本
 */
const generateChangeDescription = (fieldChanges: AuditFieldChange[]): string => {
  if (!fieldChanges || fieldChanges.length === 0) {
    return '无字段变更';
  }
  
  const auditableChanges = fieldChanges.filter(fc => fc.isAuditable);
  if (auditableChanges.length === 0) {
    return '无字段变更';
  }
  
  if (auditableChanges.length === 1) {
    return `修改了 ${auditableChanges[0].fieldName}`;
  }
  
  return `修改了 ${auditableChanges.length} 个字段`;
};

/**
 * 单条审计日志时间线节点组件
 */
interface TimelineNodeProps {
  log: AuditLogEntry;
  isFirst: boolean;
  isLast: boolean;
  isNew?: boolean;
  onClick?: () => void;
}

const TimelineNode: React.FC<TimelineNodeProps> = ({
  log,
  isFirst,
  isLast,
  isNew = false,
  onClick
}) => {
  const [expanded, setExpanded] = useState(false);
  const config = getOperationConfig(log.operationType);
  const Icon = config.icon;
  const description = log.description || generateChangeDescription(log.fieldChanges);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div className="relative flex gap-4">
      {/* 时间线连接线 */}
      <div className="flex flex-col items-center">
        {!isFirst && (
          <div className="w-px h-4 bg-border" />
        )}
        <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-border min-h-[40px]" />
        )}
      </div>

      {/* 日志内容卡片 */}
      <Card 
        className={`flex-1 mb-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
          isNew ? 'ring-2 ring-primary/50 bg-primary/5' : ''
        }`}
        onClick={onClick}
      >
        <div className="p-4">
          {/* 头部信息 */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={config.color}>
                  {config.label}
                </Badge>
                {isNew && (
                  <Badge variant="default" className="animate-pulse">
                    NEW
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-foreground font-medium truncate">
                {description}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleToggle}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* 元信息 */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatOperationTime(log.operationTime)}
              <span className="ml-1 text-muted-foreground/70">
                ({getRelativeTimeDescription(log.operationTime)})
              </span>
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {log.operatorName}
            </span>
            <span className="flex items-center gap-1">
              <Monitor className="w-3 h-3" />
              {log.operatorIp}
            </span>
          </div>

          {/* 展开详情 */}
          {expanded && log.fieldChanges.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                变更详情
              </p>
              <div className="space-y-2">
                {log.fieldChanges.map((change, index) => (
                  <div 
                    key={`${change.fieldName}-${index}`}
                    className={`text-sm p-2 rounded ${
                      change.isAuditable 
                        ? 'bg-amber-50 border border-amber-200' 
                        : 'bg-muted/50'
                    }`}
                  >
                    <div className="font-medium text-foreground">
                      {change.fieldName}
                      {!change.isAuditable && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (非审计字段)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <span className="text-red-600 line-through">
                        {change.oldValue ?? '(空)'}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-green-600 font-medium">
                        {change.newValue ?? '(空)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

/**
 * 审计日志时间线组件
 * 
 * @example
 * ```tsx
 * const logs: AuditLogEntry[] = [...] // 从 API 获取的审计日志
 * 
 * <AuditLogTimeline 
 *   logs={logs}
 *   onLogClick={(log) => console.log(log)}
 *   realtime={true}
 * />
 * ```
 */
const AuditLogTimeline: React.FC<AuditLogTimelineProps> = ({
  logs,
  loading = false,
  empty = false,
  emptyText = '暂无审计日志记录',
  onLogClick,
  realtime = false,
  maxVisible = 0,
  className = ''
}) => {
  // 根据 maxVisible 截取显示的日志
  const visibleLogs = maxVisible > 0 
    ? logs.slice(0, maxVisible) 
    : logs;
  
  // 判断是否为新条目（实时模式下第一条为新的）
  const isNewEntry = (index: number) => {
    return realtime && index === 0;
  };

  // 空状态
  if (empty || (!loading && logs.length === 0)) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">{emptyText}</p>
        </div>
      </div>
    );
  }

  // 加载状态
  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
              {i < 3 && <div className="w-px flex-1 bg-muted animate-pulse min-h-[40px]" />}
            </div>
            <Card className="flex-1 p-4">
              <div className="space-y-3">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                <div className="h-3 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
              </div>
            </Card>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-0 ${className}`}>
      {/* 时间线标题 */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          变更历史 ({logs.length})
        </h3>
        {realtime && (
          <Badge variant="outline" className="text-xs">
            <span className="w-2 h-2 mr-1 rounded-full bg-green-500 animate-pulse" />
            实时同步中
          </Badge>
        )}
      </div>

      {/* 时间线列表 */}
      <div className="pl-2">
        {visibleLogs.map((log, index) => (
          <TimelineNode
            key={log.id}
            log={log}
            isFirst={index === 0}
            isLast={index === visibleLogs.length - 1}
            isNew={isNewEntry(index)}
            onClick={() => onLogClick?.(log)}
          />
        ))}
      </div>

      {/* 查看更多 */}
      {maxVisible > 0 && logs.length > maxVisible && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm">
            查看全部 {logs.length} 条记录
          </Button>
        </div>
      )}
    </div>
  );
};

export default AuditLogTimeline;