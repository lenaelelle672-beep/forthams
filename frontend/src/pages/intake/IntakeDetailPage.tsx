/**
 * @file pages/intake/IntakeDetailPage.tsx
 * @description 入库验收详情页
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, CheckCircle, XCircle, Send, ClipboardCheck } from 'lucide-react';
import { useIntakeOrderDetail, useSubmitIntakeOrder, useAcceptIntakeOrder, useRejectIntakeOrder, useCancelIntakeOrder, useInspectIntakeOrder } from '@/hooks/intake/useIntakeOrders';
import { IntakeStatus, INTAKE_STATUS_CONFIG, type IntakeOrder, type IntakeCheckItem } from '@/types/intake';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from 'sonner';

export default function IntakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: detailRes, isLoading } = useIntakeOrderDetail(Number(id));
  const submitMutation = useSubmitIntakeOrder();
  const acceptMutation = useAcceptIntakeOrder();
  const rejectMutation = useRejectIntakeOrder();
  const cancelMutation = useCancelIntakeOrder();
  const inspectMutation = useInspectIntakeOrder();

  const order: IntakeOrder | undefined = React.useMemo(() => {
    const res = detailRes as any;
    return res?.data || res;
  }, [detailRes]);

  const [editingItems, setEditingItems] = useState<Record<number, { actualValue: string; result: string; remark: string }>>({});

  React.useEffect(() => {
    if (order?.checkItems) {
      const edits: Record<number, any> = {};
      order.checkItems.forEach((item) => {
        if (item.id != null) {
          edits[item.id] = {
            actualValue: item.actualValue || '',
            result: item.result || 'PENDING',
            remark: item.remark || '',
          };
        }
      });
      setEditingItems(edits);
    }
  }, [order?.checkItems]);

  const canSubmit = order?.status === IntakeStatus.DRAFT;
  const canInspect = order?.status === IntakeStatus.PENDING_INSPECT || order?.status === IntakeStatus.INSPECTING;
  const canAccept = order?.status === IntakeStatus.INSPECTING || order?.status === IntakeStatus.PENDING_INSPECT;
  const canReject = order?.status === IntakeStatus.PENDING_INSPECT || order?.status === IntakeStatus.INSPECTING;
  const canCancel = order?.status === IntakeStatus.DRAFT || order?.status === IntakeStatus.PENDING_INSPECT;

  const handleSubmit = () => submitMutation.mutate(Number(id));
  const handleAccept = () => acceptMutation.mutate(Number(id));
  const handleCancel = () => cancelMutation.mutate(Number(id));

  const handleReject = () => {
    const reason = prompt('请输入驳回原因：');
    rejectMutation.mutate({ id: Number(id), reason: reason || undefined });
  };

  const handleSaveInspect = () => {
    if (!order?.checkItems) return;
    const updatedItems: IntakeCheckItem[] = order.checkItems
      .filter((item) => item.id != null && editingItems[item.id])
      .map((item) => ({
        id: item.id,
        intakeOrderId: item.intakeOrderId,
        itemName: item.itemName,
        expectedValue: item.expectedValue,
        actualValue: editingItems[item.id!]?.actualValue || '',
        result: editingItems[item.id!]?.result || 'PENDING',
        remark: editingItems[item.id!]?.remark || '',
      }));
    inspectMutation.mutate({ id: Number(id), checkItems: updatedItems });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-[#64748b]">验收单不存在</p>
        <Button variant="outline" onClick={() => navigate('/intake')}>返回列表</Button>
      </div>
    );
  }

  const statusConfig = INTAKE_STATUS_CONFIG[order.status as IntakeStatus];

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-[#f1f5f9] rounded-full" onClick={() => navigate('/intake')}>
                <ArrowLeft className="w-5 h-5 text-[#475569]" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-[#0f172a]">验收单详情</h1>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-sm text-[#64748b] mt-1">{order.orderNo}</p>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              {canSubmit && (
                <Button onClick={handleSubmit} loading={submitMutation.isPending}>
                  <Send className="w-4 h-4 mr-2" /> 提交验收
                </Button>
              )}
              {canInspect && (
                <Button variant="outline" onClick={handleSaveInspect} loading={inspectMutation.isPending}>
                  <ClipboardCheck className="w-4 h-4 mr-2" /> 保存质检结果
                </Button>
              )}
              {canAccept && (
                <Button onClick={handleAccept} loading={acceptMutation.isPending} className="bg-[#16a34a] hover:bg-[#15803d]">
                  <CheckCircle className="w-4 h-4 mr-2" /> 验收通过
                </Button>
              )}
              {canReject && (
                <Button variant="destructive" onClick={handleReject} loading={rejectMutation.isPending}>
                  <XCircle className="w-4 h-4 mr-2" /> 驳回
                </Button>
              )}
              {canCancel && (
                <Button variant="outline" onClick={handleCancel} loading={cancelMutation.isPending}>
                  取消
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 基本信息 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold mb-4 text-[#0f172a]">基本信息</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <span className="text-xs text-[#64748b] font-medium">验收单号</span>
              <p className="text-sm font-semibold text-[#334155] mt-1">{order.orderNo}</p>
            </div>
            <div>
              <span className="text-xs text-[#64748b] font-medium">状态</span>
              <p className="mt-1">
                <StatusBadge status={order.status} />
              </p>
            </div>
            <div>
              <span className="text-xs text-[#64748b] font-medium">验收日期</span>
              <p className="text-sm font-semibold text-[#334155] mt-1">{order.orderDate || '—'}</p>
            </div>
            <div>
              <span className="text-xs text-[#64748b] font-medium">总金额</span>
              <p className="text-sm font-semibold text-[#334155] mt-1">
                {order.totalAmount != null ? `¥${order.totalAmount.toLocaleString()}` : '—'}
              </p>
            </div>
            <div>
              <span className="text-xs text-[#64748b] font-medium">创建时间</span>
              <p className="text-sm font-semibold text-[#334155] mt-1">{order.createTime || '—'}</p>
            </div>
            {order.remark && (
              <div className="col-span-3">
                <span className="text-xs text-[#64748b] font-medium">备注</span>
                <p className="text-sm text-[#334155] mt-1">{order.remark}</p>
              </div>
            )}
            {order.rejectReason && (
              <div className="col-span-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <span className="text-xs font-medium text-red-700">驳回原因</span>
                <p className="text-sm text-red-600 mt-1">{order.rejectReason}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 检查项 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold mb-4 text-[#0f172a]">检查项</h2>
          {order.checkItems && order.checkItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                    <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">名称</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">预期值</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">实际值</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">结果</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {order.checkItems.map((item) => (
                    <tr key={item.id} className="border-b border-[#f1f5f9]">
                      <td className="py-2.5 px-3 font-medium text-[#334155]">{item.itemName}</td>
                      <td className="py-2.5 px-3 text-[#64748b]">{item.expectedValue || '—'}</td>
                      <td className="py-2.5 px-3">
                        {canInspect ? (
                          <input
                            className="w-full px-2 py-1 text-sm border border-[#e5e7eb] rounded"
                            value={item.id != null ? (editingItems[item.id]?.actualValue ?? '') : ''}
                            onChange={(e) => {
                              if (item.id != null) {
                                setEditingItems((prev) => ({
                                  ...prev,
                                  [item.id!]: { ...prev[item.id!], actualValue: e.target.value },
                                }));
                              }
                            }}
                          />
                        ) : (
                          <span className="text-[#64748b]">{item.actualValue || '—'}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {canInspect ? (
                          <select
                            className="px-2 py-1 text-sm border border-[#e5e7eb] rounded"
                            value={item.id != null ? (editingItems[item.id]?.result ?? 'PENDING') : 'PENDING'}
                            onChange={(e) => {
                              if (item.id != null) {
                                setEditingItems((prev) => ({
                                  ...prev,
                                  [item.id!]: { ...prev[item.id!], result: e.target.value },
                                }));
                              }
                            }}
                          >
                            <option value="PENDING">待检</option>
                            <option value="PASS">通过</option>
                            <option value="FAIL">不通过</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.result === 'PASS' ? 'bg-green-50 text-green-700' :
                            item.result === 'FAIL' ? 'bg-red-50 text-red-700' :
                            'bg-gray-50 text-gray-500'
                          }`}>
                            {item.result === 'PASS' ? '通过' : item.result === 'FAIL' ? '不通过' : '待检'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[#64748b]">{item.remark || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8]">
              <p className="text-sm">暂无检查项</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 入库资产 */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold mb-4 text-[#0f172a]">入库资产列表</h2>
          {order.intakeAssets && order.intakeAssets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
                    <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">资产编号</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">资产名称</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">品牌</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">型号</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">原值</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">购置日期</th>
                  </tr>
                </thead>
                <tbody>
                  {order.intakeAssets.map((asset) => (
                    <tr key={asset.id} className="border-b border-[#f1f5f9]">
                      <td className="py-2.5 px-3 text-[#334155]">{asset.assetNo || '—'}</td>
                      <td className="py-2.5 px-3 font-medium text-[#0f172a]">{asset.assetName}</td>
                      <td className="py-2.5 px-3 text-[#64748b]">{asset.brand || '—'}</td>
                      <td className="py-2.5 px-3 text-[#64748b]">{asset.model || '—'}</td>
                      <td className="py-2.5 px-3 text-[#64748b]">
                        {asset.originalValue != null ? `¥${asset.originalValue.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#64748b]">{asset.purchaseDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8]">
              <p className="text-sm">暂无入库资产</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
