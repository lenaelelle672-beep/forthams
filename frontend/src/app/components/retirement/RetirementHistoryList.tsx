/**
 * RetirementHistoryList — Displays a list of retirement history records for an asset.
 *
 * SWARM-062: Reusable component for viewing complete retirement history,
 * including approval chain progress and status transitions.
 *
 * @module components/retirement/RetirementHistoryList
 * @since SWARM-062
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  History,
} from 'lucide-react';
import { retirementService } from '../../services/retirementService';
import type { RetirementApplication } from '../../types/retirement.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single history record returned by the retirement service.
 */
interface HistoryRecord {
  /** Record ID */
  id: string;
  /** Asset ID */
  assetId: string;
  /** Action performed (e.g., APPROVE, REJECT, SUBMIT) */
  action: string;
  /** Previous status */
  fromStatus: string;
  /** New status */
  toStatus: string;
  /** Timestamp of the action */
  timestamp: string;
  /** Operator who performed the action */
  operator: string;
  /** Optional reason/comment */
  reason?: string;
}

/**
 * Props for the RetirementHistoryList component.
 */
export interface RetirementHistoryListProps {
  /** Asset ID to fetch history for */
  assetId: string;
  /** Optional: pre-loaded application list for this asset */
  applications?: RetirementApplication[];
  /** Optional className for the outer container */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the status display label for a retirement status value.
 *
 * @param status - Status string from backend
 * @returns Chinese display label
 */
function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: '待审批',
    PENDING_APPROVAL: '待审批',
    APPROVED: '已审批',
    CANCELLED: '已取消',
    SCRAPPED: '已报废',
    COMPLETED: '已完成',
    RETIRED: '已退役',
    REJECTED: '已驳回',
    DRAFT: '草稿',
    NORMAL: '正常',
    RETIRING: '退役中',
  };
  return map[status] ?? status;
}

/**
 * Get the icon component for an action type.
 *
 * @param action - Action string (APPROVE, REJECT, SUBMIT, CANCEL, etc.)
 * @returns Icon element
 */
function getActionIcon(action: string): React.ReactNode {
  switch (action.toUpperCase()) {
    case 'APPROVE':
    case 'COMPLETED':
    case 'RETIRED':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'REJECT':
    case 'REJECTED':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'CANCEL':
    case 'CANCELLED':
      return <AlertCircle className="w-4 h-4 text-gray-500" />;
    default:
      return <Clock className="w-4 h-4 text-blue-500" />;
  }
}

/**
 * Format a timestamp for display.
 *
 * @param value - ISO date string
 * @returns Formatted date string
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
 * Get badge variant for a status.
 *
 * @param status - Status string
 * @returns Badge variant name
 */
function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const upper = status.toUpperCase();
  if (['RETIRED', 'COMPLETED', 'SCRAPPED'].includes(upper)) return 'secondary';
  if (['REJECTED', 'CANCELLED'].includes(upper)) return 'destructive';
  if (['APPROVED'].includes(upper)) return 'default';
  return 'outline';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RetirementHistoryList component
 *
 * Fetches and displays the complete retirement history for a given asset,
 * showing approval chain progress, status transitions, and operator info.
 *
 * @param props - Component props including assetId
 * @returns The retirement history list JSX
 */
export const RetirementHistoryList: React.FC<RetirementHistoryListProps> = ({
  assetId,
  applications,
  className,
}) => {
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch retirement history for the given asset.
   */
  const fetchHistory = useCallback(async () => {
    if (!assetId) return;

    setLoading(true);
    setError(null);

    try {
      const records = await retirementService.getRetirementHistory(assetId);
      setHistoryRecords(records);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取退役历史失败';
      setError(message);
      setHistoryRecords([]);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ---- Loading state --------------------------------------------------------
  if (loading) {
    return (
      <div
        className={`space-y-3 ${className ?? ''}`}
        data-testid="retirement-history-loading"
      >
        <Card>
          <CardContent className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-4 h-4 bg-gray-100 rounded-full animate-pulse" />
                <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error state ----------------------------------------------------------
  if (error) {
    return (
      <div className={`space-y-3 ${className ?? ''}`} data-testid="retirement-history-error">
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <AlertCircle className="h-8 w-8 text-yellow-500 mb-2" />
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchHistory}>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Applications list (if provided) --------------------------------------
  const showApplications = applications && applications.length > 0;

  // ---- Empty state ----------------------------------------------------------
  if (!showApplications && historyRecords.length === 0) {
    return (
      <div className={`space-y-3 ${className ?? ''}`} data-testid="retirement-history-empty">
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <History className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-muted-foreground">暂无退役历史记录</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Main render ----------------------------------------------------------
  return (
    <div className={`space-y-4 ${className ?? ''}`} data-testid="retirement-history-list">
      {/* Applications section */}
      {showApplications && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History className="w-4 h-4" />
              退役申请记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {applications!.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {getActionIcon(app.status)}
                    <div>
                      <p className="text-sm font-medium">
                        {app.retirementNo ?? app.id}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTimestamp(app.createdAt)}
                        {app.applicant?.name && ` · ${app.applicant.name}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant={getStatusBadgeVariant(app.status)}>
                    {getStatusLabel(app.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline section */}
      {historyRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4" />
              状态变更历史
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {historyRecords.map((record, index) => (
                <div key={record.id ?? index} className="flex gap-3">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white ring-2 ring-blue-100 mt-1.5 flex-shrink-0" />
                    {index < historyRecords.length - 1 && (
                      <div className="w-px h-full bg-gray-200 min-h-[24px]" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-4 min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {record.operator}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(record.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {getStatusLabel(record.fromStatus)}
                      </Badge>
                      <span className="text-gray-400">→</span>
                      <Badge variant={getStatusBadgeVariant(record.toStatus)} className="text-xs">
                        {getStatusLabel(record.toStatus)}
                      </Badge>
                    </div>
                    {record.reason && (
                      <p className="text-xs text-gray-500 mt-1">{record.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RetirementHistoryList;
