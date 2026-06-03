/**
 * @file pages/workorder/WorkOrderAcceptancePage.tsx
 * @description 工单验收页面
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, XCircle, RotateCcw, FileText } from 'lucide-react';
import { getWorkOrderDetail, submitForAcceptance, acceptWorkOrder, rejectAcceptance } from '@/api/workorder';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import type { ApiResponse } from '@/types/common';
import type { WorkOrder } from '@/types/workorder.types';

export default function WorkOrderAcceptancePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const workOrderId = Number(id);

  const { data: res, isLoading } = useQuery({
    queryKey: ['workorder', workOrderId],
    queryFn: () => getWorkOrderDetail(workOrderId),
    enabled: !!workOrderId,
  });

  const detail = (res as any)?.data;
  const workOrder: WorkOrder | undefined = detail?.workOrder ?? detail;

  const submitMutation = useMutation({
    mutationFn: () => submitForAcceptance(workOrderId, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId] });
      toast.success('已提交验收');
      navigate(`/workorders/${workOrderId}`);
    },
    onError: (err: any) => toast.error(err?.message || '提交失败'),
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptWorkOrder(workOrderId, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId] });
      toast.success('验收通过');
      navigate(`/workorders/${workOrderId}`);
    },
    onError: (err: any) => toast.error(err?.message || '操作失败'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectAcceptance(workOrderId, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId] });
      toast.success('已驳回，工单返回执行');
      navigate(`/workorders/${workOrderId}`);
    },
    onError: (err: any) => toast.error(err?.message || '操作失败'),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">加载中...</div>;
  }

  if (!workOrder) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">工单不存在</div>;
  }

  const status = workOrder.status;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="工单验收"
        description={`工单编号: ${workOrder.workOrderNo || '-'}`}
        actions={
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回
          </Button>
        }
      />

      {/* 工单基本信息 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-lg">{workOrder.title}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">工单号：</span>
              <span className="font-mono">{workOrder.workOrderNo}</span>
            </div>
            <div>
              <span className="text-gray-400">当前状态：</span>
              <Badge variant={status === 'COMPLETED' ? 'success' : 'warning'}>{status}</Badge>
            </div>
            <div>
              <span className="text-gray-400">资产：</span>
              <span>{workOrder.assetName || '-'}</span>
            </div>
            <div>
              <span className="text-gray-400">执行人：</span>
              <span>{workOrder.assigneeName || '-'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 验收操作区 */}
      <Card>
        <CardHeader>
          <CardTitle>验收操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">验收意见</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full h-32 rounded-xl border border-[#d7deea] text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
              placeholder="请输入验收意见..."
            />
          </div>

          <div className="flex gap-3">
            {status === 'EXECUTING' && (
              <Button
                onClick={() => submitMutation.mutate()}
                loading={submitMutation.isPending}
                className="gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                提交验收
              </Button>
            )}
            {status === 'PENDING_ACCEPTANCE' && (
              <>
                <Button
                  variant="success"
                  onClick={() => acceptMutation.mutate()}
                  loading={acceptMutation.isPending}
                  className="gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  验收通过
                </Button>
                <Button
                  variant="danger"
                  onClick={() => rejectMutation.mutate()}
                  loading={rejectMutation.isPending}
                  className="gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  驳回
                </Button>
              </>
            )}
            {status === 'ACCEPTANCE_REJECTED' && (
              <div className="text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
                此工单已被驳回，请重新执行后再次提交验收
              </div>
            )}
            {status !== 'EXECUTING' && status !== 'PENDING_ACCEPTANCE' && status !== 'ACCEPTANCE_REJECTED' && (
              <div className="text-gray-400 text-sm">
                当前工单状态不支持验收操作（当前状态: {status}）
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
