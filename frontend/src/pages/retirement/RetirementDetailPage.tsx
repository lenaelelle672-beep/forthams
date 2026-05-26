import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Check, RotateCcw, Package, Clock, DollarSign, FileText,
  MapPin, AlertTriangle, ChevronRight, Loader2,
} from 'lucide-react';
import {
  getRetirementDetail,
  withdrawRetirement,
  approveRetirement,
  rejectRetirement,
  type RetirementApplication,
  type RetirementStatus,
} from '@/api/retirement';
import { getAssetById } from '@/api/asset';
import type { ApiResponse } from '@/types/common';
import type { Asset } from '@/types/asset';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';

const STATUS_CONFIG: Record<
  RetirementStatus,
  { label: string; variant: 'gray' | 'default' | 'warning' | 'success' | 'danger' | 'purple'; color: string }
> = {
  DRAFT:     { label: '草稿',   variant: 'gray',    color: 'bg-gray-100 text-gray-600' },
  PENDING:   { label: '待审批', variant: 'default', color: 'bg-blue-50 text-blue-700' },
  APPROVING: { label: '审批中', variant: 'warning', color: 'bg-amber-50 text-amber-700' },
  APPROVED:  { label: '已通过', variant: 'success', color: 'bg-green-50 text-green-700' },
  REJECTED:  { label: '已驳回', variant: 'danger',  color: 'bg-red-50 text-red-700' },
  WITHDRAWN: { label: '已撤回', variant: 'gray',    color: 'bg-gray-100 text-gray-600' },
  COMPLETED: { label: '已完成', variant: 'purple',  color: 'bg-purple-50 text-purple-700' },
};

function TimelineStep({
  label,
  operator,
  time,
  status,
  comment,
  isLast,
}: {
  label: string;
  operator?: string;
  time?: string;
  status: 'done' | 'active' | 'pending';
  comment?: string;
  isLast: boolean;
}) {
  const dotClass = {
    done: 'bg-green-600 border-green-600',
    active: 'bg-blue-600 border-blue-300 shadow-[0_0_0_4px_rgba(59,130,246,0.15)]',
    pending: 'bg-gray-300 border-gray-300',
  }[status];

  const iconContent = {
    done: <Check className="w-3.5 h-3.5 text-white" />,
    active: <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />,
    pending: <span className="w-2 h-2 rounded-full bg-gray-400" />,
  }[status];

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 ${dotClass}`}>
          {iconContent}
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 mt-1 ${status === 'done' ? 'bg-green-300' : 'bg-gray-200'}`} style={{ minHeight: 28 }} />
        )}
      </div>
      <div className={`flex-1 pb-5 ${status === 'active' ? 'bg-blue-50/50 rounded-lg p-3 -mt-1 mb-1 border border-blue-100' : ''}`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${status === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>
            {label}
          </span>
          <div className="flex items-center gap-2">
            {status === 'active' && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                当前步骤
              </span>
            )}
            {time && <span className="text-xs text-gray-400">{time}</span>}
          </div>
        </div>
        {operator && (
          <p className={`text-xs mt-0.5 ${status === 'pending' ? 'text-gray-300' : 'text-gray-500'}`}>
            {operator}
          </p>
        )}
        {comment && (
          <p className="text-xs text-gray-500 mt-1 bg-white/80 rounded px-2 py-1">
            {comment}
          </p>
        )}
      </div>
    </div>
  );
}

export default function RetirementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const retirementId = Number(id);

  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['retirement', 'detail', retirementId],
    queryFn: () => getRetirementDetail(retirementId),
    enabled: !!retirementId,
    staleTime: 1000 * 30,
  });

  const record: RetirementApplication = res as unknown as RetirementApplication | undefined;
  const { data: assetRes } = useQuery({
    queryKey: ['asset', 'detail', record?.assetId],
    queryFn: () => getAssetById(record!.assetId),
    enabled: !!record?.assetId,
    staleTime: 1000 * 60,
  });
  const asset = assetRes as unknown as Asset | undefined;
  const withdrawMutation = useMutation({
    mutationFn: () => withdrawRetirement(retirementId),
    onSuccess: () => {
      setWithdrawDialog(false);
      qc.invalidateQueries({ queryKey: ['retirement'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveRetirement(retirementId),
    onSuccess: () => {
      toast.success('审批通过');
      qc.invalidateQueries({ queryKey: ['retirement'] });
    },
    onError: (err: Error) => toast.error(err.message || '审批操作失败，请重试'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectRetirement(retirementId, reason),
    onSuccess: () => {
      toast.success('已驳回');
      setRejectDialog(false);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['retirement'] });
    },
    onError: (err: Error) => toast.error(err.message || '驳回操作失败，请重试'),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!record) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">未找到该退役申请记录</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/retirement')}>
          返回列表
        </Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[record.status];
  const canWithdraw = record.status === 'PENDING' || record.status === 'DRAFT';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <p className="text-xs text-gray-500">退役管理 / 申请详情</p>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl font-semibold text-gray-900">
                退役申请 #{retirementId}
              </h1>
              {statusCfg && (
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
              )}
            </div>
          </div>
        </div>
        {canWithdraw && (
          <Button variant="outline" size="sm" onClick={() => setWithdrawDialog(true)}>
            <RotateCcw className="w-4 h-4" /> 撤回申请
          </Button>
        )}
      </div>

      {/* Main content: 2-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Application info card */}
          <div className="bg-white border border-gray-200 rounded-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
              <FileText className="w-4 h-4 text-blue-500" />
              <h2 className="text-base font-semibold text-gray-900">申请信息</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: '申请编号', value: `#${record.id}` },
                  { label: '申请人', value: record.applicantName ?? '—' },
                  { label: '申请时间', value: record.createdAt?.substring(0, 16) ?? '—' },
                  { label: '更新时间', value: record.updatedAt?.substring(0, 16) ?? '—' },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                      {item.label}
                    </p>
                    <p className="text-sm text-gray-900">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">退役原因</p>
                <p className="text-sm text-gray-700 leading-relaxed">{record.reason ?? '—'}</p>
              </div>
              {record.residualValue != null && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">预计残值</p>
                    <p className="text-lg font-bold text-gray-900">
                      ¥{Number(record.residualValue).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Related asset card */}
          {asset && (
            <div className="bg-white border border-gray-200 rounded-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                <Package className="w-4 h-4 text-emerald-500" />
                <h2 className="text-base font-semibold text-gray-900">关联资产</h2>
              </div>
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                    <Package className="w-8 h-8 text-gray-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900">{asset.assetName ?? asset.name ?? '—'}</h3>
                    <p className="text-sm text-blue-600 font-medium">{asset.assetNo ?? '—'}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {asset.categoryName ?? '未分类'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400">存放位置</p>
                      <p className="text-sm text-gray-900">{asset.locationName ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400">购入价格</p>
                      <p className="text-sm text-gray-900">
                        {asset.purchasePrice != null ? `¥${Number(asset.purchasePrice).toLocaleString()}` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    onClick={() => navigate(`/assets/${record.assetId}`)}
                  >
                    查看资产详情
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Approval timeline */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
              <Clock className="w-4 h-4 text-blue-500" />
              <h2 className="text-base font-semibold text-gray-900">审批进度</h2>
            </div>
            <div className="p-6">
              {record.approvalRecords && record.approvalRecords.length > 0 ? (
                <div className="space-y-0">
                  {record.approvalRecords.map((r, i) => (
                    <TimelineStep
                      key={r.id}
                      label="审批操作"
                      operator={r.operatorName}
                      time={r.createdAt?.substring(0, 16)}
                      status={
                        r.action === 'APPROVE' ? 'done' :
                        r.action === 'REJECT' ? 'done' :
                        r.action === 'PENDING' ? 'active' : 'pending'
                      }
                      comment={r.comment ?? r.rejectionReason}
                      isLast={i === record.approvalRecords!.length - 1}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400 text-sm">暂无审批记录</div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {(canWithdraw || record.status === 'APPROVING') && (
            <div className="bg-white border border-gray-200 rounded-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 flex gap-3">
              {record.status === 'APPROVING' && (
                <>
                  <Button
                    className="flex-1"
                    size="md"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate()}
                  >
                    {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    通过审批
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    size="md"
                    disabled={rejectMutation.isPending}
                    onClick={() => { setRejectReason(''); setRejectDialog(true); }}
                  >
                    {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                    驳回
                  </Button>
                </>
              )}
              {canWithdraw && (
                <Button
                  variant="outline"
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                  size="md"
                  onClick={() => setWithdrawDialog(true)}
                >
                  <RotateCcw className="w-4 h-4" /> 撤回申请
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Withdraw dialog */}
      <Dialog open={withdrawDialog} onOpenChange={setWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>撤回退役申请</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <p className="text-sm text-gray-500">
              确定要撤回该退役申请吗？撤回后申请将变为「已撤回」状态。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialog(false)}>取消</Button>
            <Button
              variant="destructive"
              loading={withdrawMutation.isPending}
              onClick={() => withdrawMutation.mutate()}
            >
              确认撤回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回退役申请</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              驳回原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请填写驳回原因（必填，最多 500 字）..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none"
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{rejectReason.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>取消</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              loading={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(rejectReason)}
            >
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
