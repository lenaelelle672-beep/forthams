/**
 * DisposalDetailPage — Disposal application detail page aligned with
 * WorkOrderDetailPage structure.
 *
 * Features:
 * - Full-page detail view (not modal) with back navigation
 * - Status overview section with badge
 * - Basic info section (application number, type, applicant, dates)
 * - Asset info section (asset name, code, department)
 * - Disposal details section (reason, residual value, approval progress)
 * - Approval history timeline with step-by-step records
 * - Approve / Reject actions with comment modal
 * - State-driven action buttons (approve, reject, cancel)
 *
 * @module pages/assets/DisposalDetailPage
 */

import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle as RejectIcon,
  History,
  FileText,
  Package,
  User,
  Clock,
  DollarSign,
  Trash2,
} from 'lucide-react';
import {
  fetchDisposalDetail,
  fetchDisposalApprovalHistory,
  approveDisposalWithComment,
  rejectDisposalWithReason,
} from '../../services/assetDisposalService';
import type {
  DisposalApplication,
  DisposalApprovalRecord,
} from '../../services/assetDisposalService';

const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT: 'bg-blue-50 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVING: 'bg-indigo-100 text-indigo-800',
  APPROVED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-green-100 text-green-600',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-blue-50 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待审批',
  APPROVING: '审批中',
  APPROVED: '已通过',
  COMPLETED: '已完成',
  REJECTED: '已驳回',
  CANCELLED: '已取消',
};

const TYPE_LABELS: Record<string, string> = {
  SCRAP: '报废',
  RETIREMENT: '退役',
};

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

function getStatusBadgeClasses(status?: string): string {
  return STATUS_BADGE_CLASSES[status ?? ''] ?? 'bg-blue-50 text-gray-500';
}

function getStatusLabel(status?: string): string {
  return STATUS_LABELS[status ?? ''] ?? status ?? '-';
}

function getTypeLabel(type?: string): string {
  return TYPE_LABELS[type ?? ''] ?? type ?? '-';
}

interface ApprovalModalProps {
  action: 'approve' | 'reject';
  onConfirm: (comment: string) => void;
  onCancel: () => void;
  submitting: boolean;
}

function ApprovalCommentModal({
  action,
  onConfirm,
  onCancel,
  submitting,
}: ApprovalModalProps) {
  const [comment, setComment] = useState('');
  const isApprove = action === 'approve';

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onConfirm(comment);
    },
    [onConfirm, comment],
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
      data-testid="disposal-approval-modal"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isApprove ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <RejectIcon className="w-5 h-5 text-red-600" />
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {isApprove ? '审批通过' : '审批拒绝'}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-500 text-xl"
              disabled={submitting}
            >
              &times;
            </button>
          </div>

          <div className="px-6 py-4">
            <label
              htmlFor="disposal-approval-comment"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              审批意见
              {!isApprove && (
                <span className="ml-1 text-xs text-red-500">
                  （拒绝时建议填写原因）
                </span>
              )}
            </label>
            <textarea
              id="disposal-approval-comment"
              data-testid="disposal-approval-comment-input"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={4}
              maxLength={1000}
              placeholder={
                isApprove
                  ? '请输入审批意见（可选）...'
                  : '请输入拒绝原因...'
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {comment.length} / 1000
            </p>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || (!isApprove && !comment.trim())}
              data-testid={`btn-disposal-confirm-${action}`}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isApprove
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中...
                </span>
              ) : isApprove ? (
                '确认通过'
              ) : (
                '确认拒绝'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApprovalTimeline({
  history,
}: {
  history: DisposalApprovalRecord[];
}) {
  if (history.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-gray-400 text-sm">
        暂无审批记录
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="disposal-approval-timeline">
      <div className="space-y-0">
        {history.map((entry, index) => {
          const isApproved = entry.result === 'APPROVED';
          const isLast = index === history.length - 1;

          return (
            <div key={entry.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isApproved
                      ? 'bg-green-100 text-green-600'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {isApproved ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <RejectIcon className="w-4 h-4" />
                  )}
                </div>
                {!isLast && (
                  <div className="w-px h-full bg-blue-50 min-h-[24px]" />
                )}
              </div>

              <div className="pb-6 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    审批人 #{entry.operatorId}
                    {entry.operatorName && ` — ${entry.operatorName}`}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      isApproved
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {isApproved ? '已通过' : '已拒绝'}
                  </span>
                  <span className="text-xs text-gray-400">
                    第 {entry.stepNo} 步
                  </span>
                </div>
                {entry.comment && (
                  <p className="mt-1 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    {entry.comment}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {entry.operatedAt || '-'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DisposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [record, setRecord] = useState<DisposalApplication | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<
    DisposalApprovalRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalAction, setModalAction] = useState<'approve' | 'reject' | null>(
    null,
  );

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const numId = Number(id);
      const [detail, history] = await Promise.all([
        fetchDisposalDetail(numId),
        fetchDisposalApprovalHistory(numId).catch(() => []),
      ]);
      setRecord(detail);
      setApprovalHistory(history);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '加载处置详情失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleModalConfirm = useCallback(
    async (comment: string) => {
      if (!id) return;
      try {
        setMutating(true);
        setError(null);
        const numId = Number(id);
        if (modalAction === 'approve') {
          await approveDisposalWithComment(numId, comment || undefined);
          setNotice('处置申请已审批通过');
        } else {
          await rejectDisposalWithReason(numId, comment);
          setNotice('处置申请已拒绝');
        }
        setModalAction(null);
        await refetch();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : '操作失败';
        setError(message);
      } finally {
        setMutating(false);
      }
    },
    [id, modalAction, refetch],
  );

  const clearError = useCallback(() => setError(null), []);

  const canApproveReject =
    record?.status === 'PENDING' || record?.status === 'APPROVING';
  const isPending =
    record?.status === 'PENDING' || record?.status === 'APPROVING';

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-red-50 rounded-lg animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-red-50 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-50 rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-10 bg-gray-50 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error && !record) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/disposals')}
            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">处置申请详情</h2>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">加载失败</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!record) return null;

  return (
    <div
      className="max-w-4xl mx-auto space-y-6 pb-12"
      data-testid="disposal-detail-page"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/disposals')}
            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
            type="button"
            data-testid="disposal-back-btn"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="p-2 bg-red-50 rounded-lg">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              处置申请详情
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              申请编号：{record.applicationNo ?? record.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notice banner */}
      {notice && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex items-center justify-between">
          <span>{notice}</span>
          <button
            onClick={() => setNotice(null)}
            className="text-green-600 hover:text-green-800"
          >
            &times;
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* PENDING warning */}
      {isPending && (
        <div
          className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
          role="alert"
          data-testid="disposal-pending-warning"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-medium">处置申请正在审批中</p>
            <p className="mt-1">
              当前状态为{getStatusLabel(record.status)}，您可以通过下方按钮进行审批通过或拒绝操作。
            </p>
          </div>
        </div>
      )}

      {/* Section: Status Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
          <h3 className="text-lg font-semibold text-gray-900">状态概览</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">申请编号</p>
              <p className="text-lg font-semibold text-gray-900">
                {record.applicationNo ?? record.id}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">状态</p>
              <span
                className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${getStatusBadgeClasses(record.status)}`}
                data-testid="disposal-detail-status"
              >
                {getStatusLabel(record.status)}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">处置类型</p>
              <span className="inline-block px-3 py-1 text-sm font-medium rounded bg-gray-100 text-gray-700">
                {getTypeLabel(record.retirementType)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Basic Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">基本信息</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">申请人</p>
              <p className="text-base text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                {record.applicantName ?? '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">所属部门</p>
              <p className="text-base text-gray-900">
                {record.deptName ?? '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">申请时间</p>
              <p className="text-base text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                {formatDateTime(record.createTime)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">最后更新</p>
              <p className="text-base text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                {formatDateTime(record.updateTime)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Asset Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-purple-50/50 flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-purple-900">关联资产</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">资产名称</p>
              <p className="text-base text-gray-900">
                {record.assetName ?? '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">资产编号</p>
              <p className="text-base text-gray-900 font-mono">
                {record.assetCode ?? record.assetId ?? '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Disposal Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-red-50/50 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-red-500" />
          <h3 className="text-lg font-semibold text-red-900">处置详情</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {record.estimatedResidualValue != null && (
              <div>
                <p className="text-sm text-gray-400 mb-1">预估残值</p>
                <p className="text-base text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  ¥
                  {record.estimatedResidualValue.toLocaleString('zh-CN', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            )}
            {record.totalApprovalSteps != null && (
              <div>
                <p className="text-sm text-gray-400 mb-1">审批进度</p>
                <p className="text-base text-gray-900">
                  {record.currentApprovalStep ?? 0} /{' '}
                  {record.totalApprovalSteps}
                </p>
              </div>
            )}
            {record.reason && (
              <div className="md:col-span-2">
                <p className="text-sm text-gray-400 mb-1">处置原因</p>
                <p className="text-base text-gray-700 whitespace-pre-wrap p-3 bg-gray-50 rounded-md">
                  {record.reason}
                </p>
              </div>
            )}
            {record.remark && (
              <div className="md:col-span-2">
                <p className="text-sm text-gray-400 mb-1">备注</p>
                <p className="text-base text-gray-700 whitespace-pre-wrap p-3 bg-gray-50 rounded-md">
                  {record.remark}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Approval History Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-green-50/50 flex items-center gap-2">
          <History className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">审批记录</h3>
        </div>
        <ApprovalTimeline history={approvalHistory} />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 sticky bottom-6 bg-white p-4 rounded-xl shadow-lg border border-gray-200">
        <button
          type="button"
          onClick={() => navigate('/disposals')}
          className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
        >
          返回列表
        </button>

        {canApproveReject && (
          <button
            onClick={() => setModalAction('approve')}
            disabled={mutating}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            data-testid="disposal-approve-btn"
          >
            <CheckCircle2 className="w-4 h-4" />
            审批通过
          </button>
        )}

        {canApproveReject && (
          <button
            onClick={() => setModalAction('reject')}
            disabled={mutating}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            data-testid="disposal-reject-btn"
          >
            <RejectIcon className="w-4 h-4" />
            审批拒绝
          </button>
        )}
      </div>

      {modalAction && (
        <ApprovalCommentModal
          action={modalAction}
          onConfirm={handleModalConfirm}
          onCancel={() => setModalAction(null)}
          submitting={mutating}
        />
      )}
    </div>
  );
}

export default DisposalDetailPage;
