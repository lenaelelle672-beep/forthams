/**
 * AssetHistoryTimeline — 资产履历时间线组件
 *
 * T6.2: 展示资产的完整履历事件，包括变更日志、工单、保养、领用、借用、检验、报废、入库等多来源事件。
 * 调用 /assets/{id}/history API，按时间降序展示。
 *
 * @module pages/asset/AssetHistoryTimeline
 * @since T6.2
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Clock,
  Activity,
  Wrench,
  Users,
  ArrowLeftRight,
  ClipboardCheck,
  Archive,
  Package,
  PackageOpen,
  AlertTriangle,
  Info,
  AlertCircle,
} from 'lucide-react';
import { getAssetHistory, type AssetHistoryEvent, type AssetHistoryEventType } from '@/api/asset';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the AssetHistoryTimeline component.
 */
export interface AssetHistoryTimelineProps {
  /** 资产 ID */
  assetId: number;
  /** 可选：按事件类型过滤 */
  eventTypes?: AssetHistoryEventType[];
  /** 可选 CSS class name */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 格式化时间戳用于展示。
 */
function formatTimestamp(value: string): string {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

/**
 * 根据事件类型获取图标。
 */
function getEventIcon(eventType: AssetHistoryEventType): React.ReactNode {
  switch (eventType) {
    case 'WORK_ORDER':
      return <Wrench className="w-4 h-4 text-orange-500" />;
    case 'MAINTENANCE':
      return <Wrench className="w-4 h-4 text-blue-500" />;
    case 'ASSIGNMENT':
      return <Users className="w-4 h-4 text-green-500" />;
    case 'BORROW':
      return <ArrowLeftRight className="w-4 h-4 text-purple-500" />;
    case 'INSPECTION':
      return <ClipboardCheck className="w-4 h-4 text-teal-500" />;
    case 'RETIREMENT':
      return <Archive className="w-4 h-4 text-gray-500" />;
    case 'INVENTORY':
      return <Package className="w-4 h-4 text-indigo-500" />;
    case 'INTAKE':
      return <PackageOpen className="w-4 h-4 text-cyan-500" />;
    case 'CHANGE_LOG':
    default:
      return <Clock className="w-4 h-4 text-blue-500" />;
  }
}

/**
 * 根据事件类型获取中文标签。
 */
function getEventLabel(eventType: AssetHistoryEventType): string {
  const labels: Record<AssetHistoryEventType, string> = {
    CHANGE_LOG: '变更日志',
    WORK_ORDER: '工单',
    MAINTENANCE: '保养',
    ASSIGNMENT: '领用',
    BORROW: '借用',
    INSPECTION: '检验',
    RETIREMENT: '报废',
    INVENTORY: '盘点',
    INTAKE: '入库',
  };
  return labels[eventType] || eventType;
}

/**
 * 根据事件级别获取圆点颜色。
 */
function getLevelDotClasses(level: string): string {
  switch (level) {
    case 'ERROR':
      return 'w-3 h-3 rounded-full bg-red-500 border-2 border-white ring-2 ring-red-100 flex-shrink-0';
    case 'WARNING':
      return 'w-3 h-3 rounded-full bg-yellow-400 border-2 border-white ring-2 ring-yellow-100 flex-shrink-0';
    case 'INFO':
    default:
      return 'w-3 h-3 rounded-full bg-blue-400 border-2 border-white ring-2 ring-blue-100 flex-shrink-0';
  }
}

/**
 * 根据事件级别获取图标。
 */
function getLevelIcon(level: string): React.ReactNode {
  switch (level) {
    case 'ERROR':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'WARNING':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'INFO':
    default:
      return <Info className="w-4 h-4 text-blue-500" />;
  }
}

/**
 * 根据事件类型获取 Badge variant。
 */
function getEventBadgeVariant(
  eventType: AssetHistoryEventType,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (eventType) {
    case 'RETIREMENT':
      return 'secondary';
    case 'WORK_ORDER':
      return 'destructive';
    case 'ASSIGNMENT':
    case 'MAINTENANCE':
      return 'default';
    default:
      return 'outline';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetHistoryTimeline 组件
 *
 * 展示资产的完整履历时间线，按时间降序排列。每个节点显示事件类型图标、
 * 标题、操作人、时间戳和事件级别。支持按事件类型过滤。
 *
 * @param props - 组件属性，包括资产ID和可选的事件类型过滤
 * @returns 资产履历时间线 JSX
 */
export const AssetHistoryTimeline: React.FC<AssetHistoryTimelineProps> = ({
  assetId,
  eventTypes,
  className,
}) => {
  const { data: events, isLoading, error } = useQuery({
    queryKey: ['asset-history', assetId, eventTypes],
    queryFn: () => getAssetHistory(assetId, eventTypes),
    enabled: !!assetId,
  });

  const historyEvents: AssetHistoryEvent[] = (events as unknown as AssetHistoryEvent[]) ?? [];

  // 加载状态
  if (isLoading) {
    return (
      <div className={className ?? ''}>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className={className ?? ''}>
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
            <p className="text-sm text-muted-foreground">加载履历失败</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 空状态
  if (!historyEvents || historyEvents.length === 0) {
    return (
      <div className={className ?? ''} data-testid="history-timeline-empty">
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <Activity className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-muted-foreground">暂无履历记录</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={`asset-history-timeline ${className ?? ''}`}
      data-testid="history-timeline"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4" />
            资产履历时间线
            <Badge variant="secondary" className="ml-2">
              {historyEvents.length} 条记录
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {historyEvents.map((event, index) => (
              <div
                key={`${event.eventType}-${event.refId ?? index}`}
                className="flex gap-3"
                data-testid={`history-node-${index}`}
              >
                {/* 时间线连接器 */}
                <div className="flex flex-col items-center">
                  <div className={`${getLevelDotClasses(event.level)} mt-1.5`} />
                  {index < historyEvents.length - 1 && (
                    <div className="w-px h-full bg-blue-50 min-h-[24px]" />
                  )}
                </div>
                {/* 内容 */}
                <div className="pb-4 min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getEventIcon(event.eventType)}
                    <span className="text-sm font-medium text-gray-900">
                      {event.title}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(event.eventTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">
                      操作人: {event.operatorName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={getEventBadgeVariant(event.eventType)} className="text-xs">
                      {getEventLabel(event.eventType)}
                    </Badge>
                    {event.level !== 'INFO' && (
                      <span className="flex items-center gap-1">
                        {getLevelIcon(event.level)}
                        <span className="text-xs text-gray-500">{event.level}</span>
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-xs text-gray-400 mt-1">{event.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssetHistoryTimeline;