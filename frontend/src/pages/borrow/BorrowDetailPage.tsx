/**
 * @file pages/borrow/BorrowDetailPage.tsx
 * @description 借用管理详情页
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, CheckCircle, XCircle, Send, ClipboardCheck, Undo2, AlertTriangle } from 'lucide-react';
import { useBorrowDetail, useSubmitBorrow, useApproveBorrow, useRejectBorrow, useBorrowAsset, useReturnBorrow, useCancelBorrow } from '@/hooks/borrow/useBorrows';
import { BorrowStatus, BORROW_STATUS_CONFIG } from '@/types/borrow';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

export default function BorrowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: detailRes, isLoading } = useBorrowDetail(Number(id));
  const submitMutation = useSubmitBorrow();
  const approveMutation = useApproveBorrow();
  const rejectMutation = useRejectBorrow();
  const borrowMutation = useBorrowAsset();
  const returnMutation = useReturnBorrow();
  const cancelMutation = useCancelBorrow();

  const item = React.useMemo(() => {
    const res = detailRes as any;
    return res?.data || res;
  }, [detailRes]);

  const status = item?.status as BorrowStatus | undefined;

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-40 w-full rounded-xl" /></div>;
  }

  if (!item) {
    return <div className="p-6 text-center text-[#64748b]">借用单不存在
      <Button variant="outline" className="ml-4" onClick={() => navigate('/borrows')}>返回列表</Button>
    </div>;
  }

  const isOverdue = status === BorrowStatus.OVERDUE;

  return (
    <div className="p-6 space-y-6">
      {/* 逾期警告 */}
      {isOverdue && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">资产已逾期未归还</p>
            <p className="text-xs text-red-600 mt-0.5">预计归还日期: {item.expectedReturnDate}，请尽快办理归还手续</p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-[#f1f5f9] rounded-full" onClick={() => navigate('/borrows')}>
                <ArrowLeft className="w-5 h-5 text-[#475569]" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-[#0f172a]">借用详情</h1>
                  <StatusBadge status={status!} />
                </div>
                <p className="text-sm text-[#64748b] mt-1">{item.assetNo} · {item.assetName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status === BorrowStatus.DRAFT && (
                <>
                  <Button onClick={() => submitMutation.mutate(Number(id))} loading={submitMutation.isPending}>
                    <Send className="w-4 h-4 mr-2" />提交审批
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/borrows/${id}/edit`)}>编辑</Button>
                </>
              )}
              {status === BorrowStatus.PENDING_APPROVAL && (
                <>
                  <Button onClick={() => approveMutation.mutate(Number(id))} loading={approveMutation.isPending}
                    className="bg-[#16a34a] hover:bg-[#15803d]">
                    <CheckCircle className="w-4 h-4 mr-2" />审批通过
                  </Button>
                  <Button variant="destructive" onClick={() => {
                    const reason = prompt('请输入驳回原因：');
                    if (reason !== null) rejectMutation.mutate({ id: Number(id), reason: reason || undefined });
                  }} loading={rejectMutation.isPending}>
                    <XCircle className="w-4 h-4 mr-2" />驳回
                  </Button>
                </>
              )}
              {status === BorrowStatus.APPROVED && (
                <Button onClick={() => borrowMutation.mutate(Number(id))} loading={borrowMutation.isPending}>
                  <ClipboardCheck className="w-4 h-4 mr-2" />确认借出
                </Button>
              )}
              {(status === BorrowStatus.BORROWED || isOverdue) && (
                <Button variant="outline" onClick={() => {
                  const remark = prompt('归还备注（可选）：');
                  returnMutation.mutate({ id: Number(id), remark: remark || undefined });
                }} loading={returnMutation.isPending}>
                  <Undo2 className="w-4 h-4 mr-2" />确认归还
                </Button>
              )}
              {(status === BorrowStatus.DRAFT || status === BorrowStatus.PENDING_APPROVAL) && (
                <Button variant="outline" onClick={() => cancelMutation.mutate(Number(id))} loading={cancelMutation.isPending}>取消</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold mb-4 text-[#0f172a]">详细信息</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className="text-xs text-[#64748b] font-medium">资产编号</span>
              <p className="text-sm font-semibold mt-1">{item.assetNo || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-[#64748b] font-medium">资产名称</span>
              <p className="text-sm font-semibold mt-1">{item.assetName || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-[#64748b] font-medium">状态</span>
              <p className="mt-1"><StatusBadge status={status!} /></p>
            </div>
            <div>
              <span className="text-xs text-[#64748b] font-medium">借用日期</span>
              <p className="text-sm font-semibold mt-1">{item.borrowDate || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-[#64748b] font-medium">预计归还日期</span>
              <p className={`text-sm font-semibold mt-1 ${isOverdue ? 'text-red-600' : ''}`}>
                {item.expectedReturnDate || '—'}
                {isOverdue && <span className="ml-2 text-xs text-red-500">（已逾期）</span>}
              </p>
            </div>
            {item.actualReturnDate && (
              <div>
                <span className="text-xs text-[#64748b] font-medium">实际归还日期</span>
                <p className="text-sm font-semibold mt-1">{item.actualReturnDate}</p>
              </div>
            )}
            {item.purpose && (
              <div className="col-span-2">
                <span className="text-xs text-[#64748b] font-medium">借用用途</span>
                <p className="text-sm mt-1">{item.purpose}</p>
              </div>
            )}
            {item.remark && (
              <div className="col-span-2">
                <span className="text-xs text-[#64748b] font-medium">备注</span>
                <p className="text-sm mt-1">{item.remark}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
