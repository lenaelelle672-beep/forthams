/**
 * @file pages/workorder/WorkOrderDetailPage.tsx
 * @description 工单详情 + 审批操作
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { getWorkOrderDetail, approveWorkOrder, rejectWorkOrder } from '@/api/workorder';
import type { ApiResponse } from '@/types/common';
import type { WorkOrderDetailResponse } from '@/types/workorder';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ApprovalTimeline } from '@/components/ui/ApprovalTimeline';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';

const STATUS_LABEL_MAP: Record<string, string> = {
  'DRAFT': '草稿',
  'SUBMITTED': '已提交',
  'APPROVING_LEVEL_1': '一级审批中',
  'APPROVING_LEVEL_2': '二级审批中',
  'APPROVED': '已批准',
  'REJECTED': '已驳回',
  'EXECUTING': '执行中',
  'COMPLETED': '已完成',
  'CANCELLED': '已取消',
};

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const orderId = Number(id);

  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['workorders', 'detail', orderId],
    queryFn:  () => getWorkOrderDetail(orderId),
    enabled:  !!orderId,
    staleTime: 1000 * 30,
  });

  const detail = (res as ApiResponse<WorkOrderDetailResponse> | undefined)?.data;
  const workOrder = detail?.workOrder ?? detail;
  const approvalRecords = detail?.approvalRecords ?? [];

  const approveMutation = useMutation({
    mutationFn: (data: { version?: number }) => approveWorkOrder(orderId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workorders'] }),
    onError: (err: Error) => toast.error(err.message || '操作失败，请重试'),
  });

  const rejectMutation = useMutation({
    mutationFn: (data: { version?: number; rejectionReason: string }) => rejectWorkOrder(orderId, data),
    onSuccess: () => { setRejectDialog(false); qc.invalidateQueries({ queryKey: ['workorders'] }); },
    onError: (err: Error) => toast.error(err.message || '操作失败，请重试'),
  });

  if (isLoading) {
    return <div className="p-6 space-y-4">{Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  const canApprove = workOrder?.status === 'APPROVING_LEVEL_1' || workOrder?.status === 'APPROVING_LEVEL_2';

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[#0f172a]">{workOrder?.title ?? '工单详情'}</h1>
          {workOrder?.status && (
            <Badge variant={
              workOrder.status === 'APPROVED' ? 'success' :
              workOrder.status === 'REJECTED' ? 'danger' :
              workOrder.status.startsWith('APPROVING') ? 'warning' : 'default'
            }>
              {STATUS_LABEL_MAP[workOrder.status] ?? workOrder.status}
            </Badge>
          )}
        </div>
        {canApprove && (
          <div className="flex gap-2 ml-auto">
            <Button
              variant="destructive"
              size="md"
              onClick={() => setRejectDialog(true)}
            >
              <X className="w-4 h-4" /> 驳回
            </Button>
            <Button
              size="md"
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate({ version: workOrder.version })}
            >
              <Check className="w-4 h-4" /> 审批通过
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader><CardTitle>工单信息</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              ['工单号',   workOrder?.orderNo],
              ['申请人',   workOrder?.applicantName],
              ['部门',     workOrder?.departmentName],
              ['优先级',   workOrder?.priority],
              ['创建时间', workOrder?.createdAt?.substring(0, 16)],
              ['描述',     workOrder?.description],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex gap-4 text-sm">
                <span className="w-20 text-[#94a3b8] flex-shrink-0">{label}</span>
                <span className="text-[#374151]">{String(value ?? '—')}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>审批记录</CardTitle></CardHeader>
          <CardContent>
            <ApprovalTimeline
              steps={approvalRecords.map((r) => ({
                id:           r.id,
                label:        r.approvalLevel === 'LEVEL_1' ? '一级审批' : '二级审批',
                operatorName: r.operatorName,
                action:       r.action,
                comment:      r.comment,
                rejectionReason: r.rejectionReason,
                operatedAt:   r.operatedAt?.substring(0, 16),
              }))}
            />
            {approvalRecords.length === 0 && (
              <p className="text-sm text-[#94a3b8] text-center py-4">暂无审批记录</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 驳回对话框 */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回工单</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <label className="block text-sm font-medium text-[#374151] mb-2">
              驳回原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请填写驳回原因（必填，最多 500 字）..."
              className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-[#94a3b8] mt-1 text-right">{rejectReason.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>取消</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              loading={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate({
                version: workOrder?.version,
                rejectionReason: rejectReason,
              })}
            >
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
