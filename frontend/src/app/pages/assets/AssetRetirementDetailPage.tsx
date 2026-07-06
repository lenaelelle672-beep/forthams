/**
 * AssetRetirementDetailPage — Detail view for a retirement application with
 * approval chain tracking, process number display, and workflow actions.
 *
 * SWARM-053: Enhances the existing SWARM-038 detail page with:
 * - Approve / Reject / Complete action buttons per state machine rules
 * - RetirementTimeline integration for approval history
 * - Cross-tenant error interception with user-facing banners
 * - Terminal state locking (all buttons disabled when SCRAPPED)
 *
 * State machine mirror:
 *   - PENDING → [Approve] / [Reject] / [Cancel] enabled
 *   - APPROVED → [Complete] enabled, [Approve] / [Reject] / [Cancel] disabled
 *   - SCRAPPED / COMPLETED / CANCELLED → all buttons disabled
 *
 * @module pages/assets/AssetRetirementDetailPage
 * @since SWARM-038, SWARM-053
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import {
  ArrowLeft,
  FileText,
  RefreshCw,
  XCircle,
  CheckCircle,
  Loader2,
  Ban,
  ShieldAlert,
} from 'lucide-react';
import {
  useRetirementDetail,
  RETIREMENT_STATUS_MAP,
} from '../../hooks/useRetirement';
import { retirementService } from '../../services/retirementService';
import { RetirementTimeline } from './components/RetirementTimeline';
import type { TimelineNode } from './components/RetirementTimeline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Approval history record structure from the backend.
 */
interface ApprovalHistoryItem {
  id: string;
  applicationId: string;
  action: string;
  comment?: string;
  operator?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map backend status to a badge variant.
 */
const STATUS_BADGE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'outline',
  APPROVED: 'secondary',
  CANCELLED: 'destructive',
  SCRAPPED: 'destructive',
  COMPLETED: 'default',
  NORMAL: 'secondary',
  RETIRING: 'outline',
  RETIRED: 'destructive',
};

/**
 * Get a display label for the status value.
 *
 * @param status - Backend status string
 * @returns Chinese display label
 */
function getStatusLabel(status: string): string {
  return RETIREMENT_STATUS_MAP[status] ?? status;
}

/**
 * Format a date-time string for display.
 *
 * @param value - ISO date string
 * @returns Formatted date string
 */
function formatDateTime(value: string | undefined | null): string {
  if (!value) return '-';
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
 * Check if an error represents a cross-tenant rejection.
 *
 * @param err - The thrown error
 * @returns true when the backend rejected due to tenant mismatch or 403
 */
function isCrossTenantError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message ?? '';
    return (
      msg.includes('无权操作该资产') ||
      msg.includes('跨租户') ||
      msg.includes('403') ||
      msg.includes('权限不足')
    );
  }
  return false;
}

/**
 * Convert approval history items to TimelineNode format.
 *
 * @param history - Raw approval history from backend
 * @returns TimelineNode array for the RetirementTimeline component
 */
function historyToTimelineNodes(history: ApprovalHistoryItem[]): TimelineNode[] {
  return history.map((item, idx) => ({
    id: item.id ?? `node-${idx}`,
    action: item.action,
    operator: item.operator,
    comment: item.comment,
    timestamp: item.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetRetirementDetailPage component
 *
 * Renders the retirement application detail with:
 * - Process number and status display
 * - RetirementTimeline for approval chain visualization
 * - Action buttons (Approve, Reject, Cancel, Complete) per state machine
 * - Cross-tenant error banner
 *
 * @returns The retirement detail page JSX
 */
export const AssetRetirementDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: applicationId } = useParams<{ id: string }>();

  // -- Retirement detail hook --------------------------------------------------
  const {
    application,
    asset,
    loading,
    error: hookError,
    isTerminal,
    canCancel,
    refresh,
    cancelRetirement,
    processNo,
  } = useRetirementDetail(applicationId ?? null);

  // -- Approval history state --------------------------------------------------
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // -- Action states -----------------------------------------------------------
  const [cancelling, setCancelling] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // -- Derived state -----------------------------------------------------------
  const statusStr = (application?.status as string) ?? '';
  const isPending = statusStr === 'PENDING';
  const isApproved = statusStr === 'APPROVED';

  /**
   * Whether Approve/Reject buttons should be enabled.
   * Per state machine: only PENDING allows Approve/Reject.
   */
  const canApproveOrReject = isPending && !isTerminal;

  /**
   * Whether Complete button should be enabled.
   * Per state machine: only APPROVED allows Complete.
   */
  const canComplete = isApproved && !isTerminal;

  /**
   * Whether Cancel button should be enabled.
   * Per state machine: only PENDING allows Cancel.
   */
  const canCancelApplication = canCancel && !isTerminal;

  /**
   * Load approval history for the application.
   */
  const loadHistory = useCallback(async () => {
    if (!applicationId) return;

    setHistoryLoading(true);
    try {
      const history = await retirementService.getApprovalHistory(applicationId);
      setApprovalHistory(history);
    } catch {
      setApprovalHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /**
   * Handle cross-tenant and generic errors from mutation actions.
   *
   * @param err - The thrown error
   */
  const handleActionError = useCallback((err: unknown) => {
    if (isCrossTenantError(err)) {
      setActionError('权限不足，无法操作此资产');
    } else {
      const message = err instanceof Error ? err.message : '操作失败';
      setActionError(message);
    }
  }, []);

  /**
   * Handle the Approve retirement action.
   */
  const handleApprove = useCallback(async () => {
    if (!applicationId) return;
    setApproving(true);
    setActionError(null);
    try {
      await retirementService.approveApplication(applicationId);
      await refresh();
      await loadHistory();
    } catch (err) {
      handleActionError(err);
    } finally {
      setApproving(false);
    }
  }, [applicationId, refresh, loadHistory, handleActionError]);

  /**
   * Handle the Reject retirement action.
   */
  const handleReject = useCallback(async () => {
    if (!applicationId) return;
    if (!rejectReason.trim()) {
      setActionError('请填写驳回原因');
      return;
    }
    setRejecting(true);
    setActionError(null);
    try {
      await retirementService.rejectApplication(applicationId, rejectReason.trim());
      setRejectReason('');
      await refresh();
      await loadHistory();
    } catch (err) {
      handleActionError(err);
    } finally {
      setRejecting(false);
    }
  }, [applicationId, rejectReason, refresh, loadHistory, handleActionError]);

  /**
   * Handle the Cancel retirement action.
   */
  const handleCancel = useCallback(async () => {
    setCancelling(true);
    setActionError(null);
    const success = await cancelRetirement();
    setCancelling(false);

    if (!success) {
      // cancelRetirement handles its own error display via hookError
    } else if (asset?.id) {
      await loadHistory();
    }
  }, [cancelRetirement, asset?.id, loadHistory]);

  /**
   * Handle the Complete retirement action.
   */
  const handleComplete = useCallback(async () => {
    if (!applicationId) return;
    setCompleting(true);
    setActionError(null);
    try {
      await retirementService.completeRetirement(applicationId);
      await refresh();
      await loadHistory();
    } catch (err) {
      handleActionError(err);
    } finally {
      setCompleting(false);
    }
  }, [applicationId, refresh, loadHistory, handleActionError]);

  // Build timeline nodes from approval history
  const timelineNodes = historyToTimelineNodes(approvalHistory);

  // ---- Loading state --------------------------------------------------------
  if (loading && !application) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12" data-testid="retirement-detail-loading">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-blue-50 rounded-lg animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-56 bg-blue-50 rounded animate-pulse" />
            <div className="h-4 w-40 bg-gray-50 rounded animate-pulse" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error state ----------------------------------------------------------
  if (hookError && !application) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12" data-testid="retirement-detail-error">
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <p className="text-muted-foreground mb-4">加载退役申请详情失败：{hookError}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回
              </Button>
              <Button variant="outline" onClick={refresh}>
                <RefreshCw className="w-4 h-4 mr-1" />
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Main render ----------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12" data-testid="retirement-detail-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            data-testid="retirement-back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <div className="p-2 bg-orange-50 rounded-lg">
            <FileText className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">退役申请详情</h2>
            <p className="text-sm text-gray-400 mt-1">
              查看退役申请状态与审批链路
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Cross-tenant / action error banner */}
      {actionError && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm flex items-center gap-2"
          data-testid="error-banner"
          role="alert"
        >
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          {actionError}
        </div>
      )}

      {/* Hook-level error toast */}
      {hookError && application && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm flex items-center gap-2"
          data-testid="error-toast"
          role="alert"
        >
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          {hookError}
        </div>
      )}

      {/* Process number and status card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-400">流程编号</p>
              <p
                className="text-xl font-bold font-mono"
                data-testid="process-no"
              >
                {processNo ?? '-'}
              </p>
            </div>
            <Badge
              variant={STATUS_BADGE_VARIANT[statusStr] ?? 'outline'}
              className="text-sm px-3 py-1"
              data-testid="status-badge"
            >
              {getStatusLabel(statusStr)}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">关联资产：</span>
              <span className="font-medium">
                {asset?.assetName ?? asset?.assetCode ?? application?.assetId ?? '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">资产编号：</span>
              <span className="font-medium font-mono">
                {asset?.assetCode ?? application?.assetId ?? '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">资产状态：</span>
              <span className="font-medium" data-testid="asset-status-label">
                {asset?.status ?? '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">申请时间：</span>
              <span className="font-medium">
                {formatDateTime(application?.createdAt)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">更新时间：</span>
              <span className="font-medium">
                {formatDateTime(application?.updatedAt)}
              </span>
            </div>
          </div>

          {application?.description && (
            <div className="mt-4 text-sm">
              <span className="text-gray-400">描述：</span>
              <p className="mt-1 p-3 bg-gray-50 rounded-md text-gray-700">
                {application.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval chain timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">审批链路</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <RetirementTimeline nodes={timelineNodes} />
          )}
        </CardContent>
      </Card>

      {/* Reject reason input (shown only when PENDING and user wants to reject) */}
      {isPending && (
        <Card data-testid="reject-reason-card">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-700">
              驳回原因（驳回时必填）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="请输入驳回原因..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="reject-reason-input"
            />
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3" data-testid="action-buttons">
        {/* Cancel button — PENDING only */}
        <Button
          variant="destructive"
          onClick={handleCancel}
          disabled={!canCancelApplication || cancelling}
          data-testid="cancel-retirement-btn"
        >
          {cancelling ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              撤销中...
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 mr-1" />
              撤销申请
            </>
          )}
        </Button>

        {/* Reject button — PENDING only */}
        <Button
          variant="destructive"
          onClick={handleReject}
          disabled={!canApproveOrReject || rejecting}
          data-testid="reject-retirement-btn"
        >
          {rejecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              驳回中...
            </>
          ) : (
            <>
              <Ban className="w-4 h-4 mr-1" />
              驳回
            </>
          )}
        </Button>

        {/* Approve button — PENDING only */}
        <Button
          variant="default"
          onClick={handleApprove}
          disabled={!canApproveOrReject || approving}
          data-testid="approve-retirement-btn"
        >
          {approving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              审批中...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-1" />
              审批通过
            </>
          )}
        </Button>

        {/* Complete button — APPROVED only */}
        <Button
          variant="default"
          onClick={handleComplete}
          disabled={!canComplete || completing}
          data-testid="complete-retirement-btn"
        >
          {completing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              完成中...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-1" />
              确认完成
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AssetRetirementDetailPage;
