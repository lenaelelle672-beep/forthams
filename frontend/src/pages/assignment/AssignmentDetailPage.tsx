/**
 * @file pages/assignment/AssignmentDetailPage.tsx
 * @description 领用归还详情页
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, CheckCircle, XCircle, Send, ClipboardCheck, Undo2 } from 'lucide-react';
import { useAssignmentDetail, useSubmitAssignment, useApproveAssignment, useRejectAssignment, useCheckoutAssignment, useReturnRequestAssignment, useApproveReturnAssignment, useCancelAssignment } from '@/hooks/assignment/useAssignments';
import { AssignmentStatus, ASSIGNMENT_STATUS_CONFIG, AllocationType, ALLOCATION_TYPE_CONFIG } from '@/types/assignment';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from 'sonner';

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: detailRes, isLoading } = useAssignmentDetail(Number(id));
  const submitMutation = useSubmitAssignment();
  const approveMutation = useApproveAssignment();
  const rejectMutation = useRejectAssignment();
  const checkoutMutation = useCheckoutAssignment();
  const returnRequestMutation = useReturnRequestAssignment();
  const approveReturnMutation = useApproveReturnAssignment();
  const cancelMutation = useCancelAssignment();

  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const item = React.useMemo(() => {
    const res = detailRes as any;
    return res?.data || res;
  }, [detailRes]);

  const status = item?.status as AssignmentStatus | undefined;
  const allocationType = item?.allocationType as string | undefined;

  const statusFlow = [
    AssignmentStatus.DRAFT,
    AssignmentStatus.PENDING_APPROVAL,
    AssignmentStatus.APPROVED,
    AssignmentStatus.CHECKED_OUT,
    AssignmentStatus.RETURN_REQUESTED,
    AssignmentStatus.RETURNED,
  ];

  const allocationTypeCfg = allocationType
    ? ALLOCATION_TYPE_CONFIG[allocationType as AllocationType]
    : null;

  const renderInfoRow = (label: string, value: React.ReactNode) => (
    <div>
      <span className="text-xs text-[#64748b] font-medium">{label}</span>
      <p className="text-sm font-semibold mt-1">{value}</p>
    </div>
  );

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-40 w-full rounded-xl" /></div>;
  }

  if (!item) {
    return <div className="p-6 text-center text-[#64748b]">领用单不存在
      <Button variant="outline" className="ml-4" onClick={() => navigate('/assignments')}>返回列表</Button>
    </div>;
  }

  const currentStepIndex = statusFlow.indexOf(status!);

  const handleReject = () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    if (!rejectReason || rejectReason.trim().length < 10) {
      toast.error('驳回原因至少需要 10 个字符');
      return;
    }
    rejectMutation.mutate({ id: Number(id), reason: rejectReason });
    setShowRejectInput(false);
    setRejectReason('');
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-[#f1f5f9] rounded-full" onClick={() => navigate('/assignments')}>
                <ArrowLeft className="w-5 h-5 text-[#475569]" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-[#0f172a]">领用单详情</h1>
                  <StatusBadge status={status!} />
                  {allocationTypeCfg && (
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ color: allocationTypeCfg.color, backgroundColor: allocationTypeCfg.bgColor }}
                    >
                      {allocationTypeCfg.label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#64748b] mt-1">
                  {item.assetNo} · {item.assetName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {status === AssignmentStatus.DRAFT && (
                <>
                  <Button onClick={() => submitMutation.mutate(Number(id))} loading={submitMutation.isPending}>
                    <Send className="w-4 h-4 mr-2" />提交审批
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/assignments/${id}/edit`)}>编辑</Button>
                </>
              )}
              {status === AssignmentStatus.PENDING_APPROVAL && (
                <>
                  <Button onClick={() => approveMutation.mutate(Number(id))} loading={approveMutation.isPending}
                    className="bg-[#16a34a] hover:bg-[#15803d]">
                    <CheckCircle className="w-4 h-4 mr-2" />审批通过
                  </Button>
                  <Button variant="destructive" onClick={handleReject} loading={rejectMutation.isPending}>
                    <XCircle className="w-4 h-4 mr-2" />驳回
                  </Button>
                </>
              )}
              {status === AssignmentStatus.APPROVED && (
                <Button onClick={() => checkoutMutation.mutate(Number(id))} loading={checkoutMutation.isPending}>
                  <ClipboardCheck className="w-4 h-4 mr-2" />签收领用
                </Button>
              )}
              {status === AssignmentStatus.CHECKED_OUT && (
                <Button variant="outline" onClick={() => returnRequestMutation.mutate(Number(id))} loading={returnRequestMutation.isPending}>
                  <Undo2 className="w-4 h-4 mr-2" />申请归还
                </Button>
              )}
              {status === AssignmentStatus.RETURN_REQUESTED && (
                <Button onClick={() => approveReturnMutation.mutate({ id: Number(id) })}
                  loading={approveReturnMutation.isPending} className="bg-[#16a34a] hover:bg-[#15803d]">
                  <CheckCircle className="w-4 h-4 mr-2" />审批归还
                </Button>
              )}
              {(status === AssignmentStatus.DRAFT || status === AssignmentStatus.PENDING_APPROVAL) && (
                <Button variant="outline" onClick={() => cancelMutation.mutate(Number(id))} loading={cancelMutation.isPending}>取消</Button>
              )}
            </div>
          </div>

          {/* 驳回原因输入框 */}
          {showRejectInput && status === AssignmentStatus.PENDING_APPROVAL && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
              <label className="block text-sm font-medium text-red-700 mb-2">驳回原因（至少 10 个字符）</label>
              <textarea
                className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg resize-none"
                rows={3}
                placeholder="请输入驳回原因..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => { setShowRejectInput(false); setRejectReason(''); }}>取消</Button>
                <Button size="sm" variant="destructive" onClick={handleReject} loading={rejectMutation.isPending}>
                  确认驳回
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 状态进度条 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            {statusFlow.map((s, index) => {
              const cfg = ASSIGNMENT_STATUS_CONFIG[s];
              const isReached = currentStepIndex >= index;
              const isCurrent = currentStepIndex === index;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex flex-col items-center ${isReached ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCurrent ? 'bg-[#004ac6] text-white' :
                      isReached ? 'bg-[#16a34a] text-white' : 'bg-[#e5e7eb] text-[#94a3b8]'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-xs mt-1 text-[#64748b] whitespace-nowrap">{cfg?.label}</span>
                  </div>
                  {index < statusFlow.length - 1 && (
                    <div className={`w-12 h-0.5 ${currentStepIndex > index ? 'bg-[#16a34a]' : 'bg-[#e5e7eb]'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 基本信息 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold mb-4 text-[#0f172a]">基本信息</h2>
          <div className="grid grid-cols-2 gap-6">
            {renderInfoRow('资产编号', item.assetNo || '—')}
            {renderInfoRow('资产名称', item.assetName || '—')}
            {renderInfoRow('领用类型', allocationTypeCfg ? (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ color: allocationTypeCfg.color, backgroundColor: allocationTypeCfg.bgColor }}
              >
                {allocationTypeCfg.label}
              </span>
            ) : '—')}
            {renderInfoRow('状态', <StatusBadge status={status!} />)}
            {renderInfoRow('预计归还日期', item.expectedReturnDate || '—')}
            {item.actualReturnDate && renderInfoRow('实际归还日期', item.actualReturnDate)}
            {item.returnCondition && renderInfoRow('归还状况', item.returnCondition)}
          </div>
        </CardContent>
      </Card>

      {/* 审批信息（有值时显示） */}
      {(item.approverId || item.approvalTime || item.approvalRemark) && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-bold mb-4 text-[#0f172a]">审批信息</h2>
            <div className="grid grid-cols-2 gap-6">
              {item.approverId && renderInfoRow('审批人 ID', item.approverId)}
              {item.approvalTime && renderInfoRow('审批时间', item.approvalTime)}
              {item.approvalRemark && (
                <div className="col-span-2">
                  {renderInfoRow('审批备注', item.approvalRemark)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 备注信息 */}
      {(item.reason || item.remark) && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-bold mb-4 text-[#0f172a]">备注信息</h2>
            <div className="grid grid-cols-1 gap-4">
              {item.reason && renderInfoRow('申请原因', item.reason)}
              {item.remark && renderInfoRow('备注', item.remark)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
