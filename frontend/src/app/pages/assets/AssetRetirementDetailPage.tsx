/**
 * AssetRetirementDetailPage — Detail view for a retirement application with
 * approval chain tracking, process number display, and cancel action.
 *
 * SWARM-038: Displays the retirement application status, processNo,
 * approval history timeline, and provides a cancel button for PENDING
 * applications. Terminal states physically disable all action buttons.
 *
 * @module pages/assets/AssetRetirementDetailPage
 * @since SWARM-038
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
  Clock,
  Loader2,
} from 'lucide-react';
import {
  useRetirementDetail,
  RETIREMENT_STATUS_MAP,
} from '../../hooks/useRetirement';
import { retirementService } from '../../services/retirementService';

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetRetirementDetailPage component
 *
 * Renders the retirement application detail with approval chain timeline,
 * process number, status badge, and conditional cancel button.
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
    error,
    isTerminal,
    canCancel,
    refresh,
    cancelRetirement,
    processNo,
  } = useRetirementDetail(applicationId ?? null);

  // -- Approval history state --------------------------------------------------
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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
   * Handle the cancel retirement action.
   *
   * On success, navigates back to the asset detail page where the
   * asset status should have rolled back to the original state.
   */
  const handleCancel = useCallback(async () => {
    setCancelling(true);
    const success = await cancelRetirement();
    setCancelling(false);

    if (success && asset?.id) {
      // Navigate back to asset detail after successful cancellation
      navigate(`/assets?highlight=${asset.id}`);
    }
  }, [cancelRetirement, asset?.id, navigate]);

  // ---- Loading state --------------------------------------------------------
  if (loading && !application) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12" data-testid="retirement-detail-loading">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-56 bg-gray-100 rounded animate-pulse" />
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
  if (error && !application) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12" data-testid="retirement-detail-error">
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <p className="text-muted-foreground mb-4">加载退役申请详情失败：{error}</p>
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

  const statusStr = (application?.status as string) ?? '';

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
            <p className="text-sm text-gray-500 mt-1">
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

      {/* Error toast */}
      {error && application && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm"
          data-testid="error-toast"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Process number and status card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">流程编号</p>
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
              <span className="text-gray-500">关联资产：</span>
              <span className="font-medium">
                {asset?.assetName ?? asset?.assetCode ?? application?.assetId ?? '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">资产编号：</span>
              <span className="font-medium font-mono">
                {asset?.assetCode ?? application?.assetId ?? '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">申请时间：</span>
              <span className="font-medium">
                {formatDateTime(application?.createdAt)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">更新时间：</span>
              <span className="font-medium">
                {formatDateTime(application?.updatedAt)}
              </span>
            </div>
          </div>

          {application?.description && (
            <div className="mt-4 text-sm">
              <span className="text-gray-500">描述：</span>
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
          <div data-testid="approval-chain" className="space-y-4">
            {historyLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : approvalHistory.length > 0 ? (
              approvalHistory.map((item, idx) => {
                const isSuccess = item.action === 'APPROVE' || item.action === 'approve';
                const isReject = item.action === 'REJECT' || item.action === 'reject';
                const isCancel = item.action === 'CANCEL' || item.action === 'cancel';

                return (
                  <div
                    key={item.id ?? idx}
                    className="flex items-start gap-3 pb-4 border-b last:border-b-0"
                    data-testid="approval-chain-item"
                  >
                    {/* Status icon */}
                    <div className="mt-0.5">
                      {isSuccess ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : isReject || isCancel ? (
                        <XCircle className="w-5 h-5 text-red-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {item.operator ?? `审批节点 ${idx + 1}`}
                        </span>
                        <Badge
                          variant={
                            isSuccess
                              ? 'secondary'
                              : isReject || isCancel
                                ? 'destructive'
                                : 'outline'
                          }
                          className="text-xs"
                        >
                          {isSuccess
                            ? '已通过'
                            : isReject
                              ? '已驳回'
                              : isCancel
                                ? '已取消'
                                : '待审批'}
                        </Badge>
                      </div>
                      {item.comment && (
                        <p className="text-sm text-gray-500 mt-1">
                          {item.comment}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                <Clock className="w-4 h-4" />
                <span>暂无审批记录</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        {canCancel && !isTerminal && (
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelling}
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
        )}
      </div>
    </div>
  );
};

export default AssetRetirementDetailPage;
