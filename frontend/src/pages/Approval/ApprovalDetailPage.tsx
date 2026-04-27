import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useApprovalStore } from '@/store/approvalStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/approval/ConfirmDialog';
import { formatDateTime } from '@/utils/date';
import {
  WorkOrderStatus,
  type WorkOrderDetail,
  type ApprovalHistoryItem
} from '@/pages/WorkOrder/types/workOrder';
import { useApprovalPermission } from '@/composables/useApprovalPermission';
import { workOrderApi } from '@/pages/WorkOrder/api/workOrderApi';

/**
 * 工单审批详情页组件
 * 
 * 功能说明：
 * - 展示工单完整信息（内容、附件、历史记录）
 * - 支持审批意见录入
 * - 提供通过/拒绝审批操作
 * - 二次确认弹窗保护操作
 * 
 * 对应 ATB 测试用例：
 * - E2E-003: 审批详情页跳转
 * - E2E-004: 审批通过操作
 * - E2E-005: 审批拒绝操作
 * - E2E-006: 二次确认弹窗
 * - E2E-007: 意见必填校验
 * - E2E-010: 审批历史查看
 */
export function ApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const {
    currentWorkOrder,
    loading,
    error,
    fetchWorkOrderDetail,
    approveWorkOrder,
    rejectWorkOrder,
    clearError
  } = useApprovalStore();

  const { canApprove, hasApprovalRole } = useApprovalPermission();
  
  // 组件内部状态
  const [approvalComment, setApprovalComment] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 加载工单详情
  useEffect(() => {
    if (id) {
      fetchWorkOrderDetail(id);
    }
    return () => clearError();
  }, [id, fetchWorkOrderDetail, clearError]);

  // 处理审批操作点击
  const handleApprovalAction = (action: 'approve' | 'reject') => {
    // 权限检查
    if (!hasApprovalRole()) {
      toast.error('您没有审批权限');
      return;
    }
    
    // 拒绝操作需要填写意见（校验）
    if (action === 'reject' && !approvalComment.trim()) {
      toast.error('请输入审批意见');
      return;
    }
    
    setPendingAction(action);
    setConfirmDialogOpen(true);
  };

  // 确认执行审批操作
  const handleConfirmAction = async () => {
    if (!id || !pendingAction) return;
    
    setSubmitting(true);
    
    try {
      if (pendingAction === 'approve') {
        await approveWorkOrder(id, {
          reason: approvalComment || undefined
        });
        toast.success('审批成功');
      } else {
        await rejectWorkOrder(id, {
          reason: approvalComment
        });
        toast.success('已拒绝');
      }
      
      // 关闭确认弹窗
      setConfirmDialogOpen(false);
      setPendingAction(null);
      setApprovalComment('');
      
      // 返回列表页
      setTimeout(() => navigate('/approval'), 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '操作失败';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // 取消审批操作
  const handleCancelAction = () => {
    setConfirmDialogOpen(false);
    setPendingAction(null);
  };

  // 获取状态展示配置
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      [WorkOrderStatus.PENDING]: { label: '待审批', variant: 'secondary' },
      [WorkOrderStatus.IN_PROGRESS]: { label: '审批中', variant: 'default' },
      [WorkOrderStatus.APPROVED]: { label: '已通过', variant: 'default' },
      [WorkOrderStatus.REJECTED]: { label: '已拒绝', variant: 'destructive' },
      [WorkOrderStatus.CLOSED]: { label: '已关闭', variant: 'outline' },
    };
    const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // 渲染加载状态
  if (loading && !currentWorkOrder) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <Button 
              variant="outline" 
              onClick={() => navigate('/approval')}
              className="mt-4"
            >
              返回列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 渲染无数据状态
  if (!currentWorkOrder) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">工单不存在或已删除</p>
            <Button 
              variant="outline" 
              onClick={() => navigate('/approval')}
              className="mt-4"
            >
              返回列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const workOrder = currentWorkOrder as WorkOrderDetail;

  // 判断工单是否可审批（仅 PENDING 和 IN_PROGRESS 状态可审批）
  const canPerformApproval = [
    WorkOrderStatus.PENDING,
    WorkOrderStatus.IN_PROGRESS
  ].includes(workOrder.status as WorkOrderStatus);

  // 判断工单状态是否已终态
  const isFinalState = [
    WorkOrderStatus.APPROVED,
    WorkOrderStatus.REJECTED,
    WorkOrderStatus.CLOSED
  ].includes(workOrder.status as WorkOrderStatus);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/approval')}>
            ← 返回
          </Button>
          <h1 className="text-2xl font-bold">工单审批详情</h1>
        </div>
        {getStatusBadge(workOrder.status)}
      </div>

      {/* 工单基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{workOrder.title}</span>
            <span className="text-sm font-normal text-muted-foreground">
              工单编号: {workOrder.id}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">创建人: </span>
              <span>{workOrder.creator || workOrder.created_by}</span>
            </div>
            <div>
              <span className="text-muted-foreground">创建时间: </span>
              <span>{formatDateTime(workOrder.created_at)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">所属部门: </span>
              <span>{workOrder.department || workOrder.dept_name || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">资产数量: </span>
              <span>{workOrder.asset_count || workOrder.assets?.length || 0}</span>
            </div>
          </div>
          
          {/* 工单内容 */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-2">工单内容</h3>
            <div className="bg-muted/50 rounded-md p-4">
              <p className="whitespace-pre-wrap">{workOrder.content}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 审批意见输入 */}
      {!isFinalState && canPerformApproval && hasApprovalRole() && (
        <Card>
          <CardHeader>
            <CardTitle>审批意见</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="请输入审批意见（拒绝时必填，最大500字符）"
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value.slice(0, 500))}
              rows={4}
              disabled={submitting}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {approvalComment.length}/500
            </p>
          </CardContent>
        </Card>
      )}

      {/* 审批历史记录 - E2E-010 */}
      <Card>
        <CardHeader>
          <CardTitle>审批历史</CardTitle>
        </CardHeader>
        <CardContent>
          {workOrder.history && workOrder.history.length > 0 ? (
            <div className="space-y-4">
              {/* 按时间倒序展示 */}
              {(workOrder.history as ApprovalHistoryItem[])
                .slice()
                .reverse()
                .map((item, index) => (
                  <div key={index} className="flex gap-4 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full border-2 border-primary" />
                      {index < workOrder.history.length - 1 && (
                        <div className="w-0.5 h-full bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {getStatusBadge(item.status || item.action || 'UNKNOWN')}
                        </span>
                        <span className="text-muted-foreground">
                          {item.operator_name || item.operator || '系统'}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDateTime(item.created_at || item.timestamp || new Date())}
                        </span>
                      </div>
                      {item.reason && (
                        <p className="mt-1 text-muted-foreground">{item.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">暂无审批历史</p>
          )}
        </CardContent>
      </Card>

      {/* 审批操作按钮 - E2E-004, E2E-005 */}
      {canPerformApproval && hasApprovalRole() && (
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => handleApprovalAction('reject')}
            disabled={submitting || !approvalComment.trim()}
            className="min-w-[100px]"
            data-testid="reject-button"
          >
            拒绝
          </Button>
          <Button
            onClick={() => handleApprovalAction('approve')}
            disabled={submitting}
            className="min-w-[100px]"
            data-testid="approve-button"
          >
            {submitting ? '处理中...' : '通过'}
          </Button>
        </div>
      )}

      {/* 权限提示 */}
      {canPerformApproval && !hasApprovalRole() && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="pt-6">
            <p className="text-yellow-700 text-sm">
              您没有当前工单的审批权限，请联系部门审批人处理
            </p>
          </CardContent>
        </Card>
      )}

      {/* 二次确认弹窗 - E2E-006 */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title={pendingAction === 'approve' ? '确认通过' : '确认拒绝'}
        description={
          pendingAction === 'approve'
            ? '确定要通过此工单审批吗？此操作不可撤销。'
            : `确定要拒绝此工单吗？审批意见: ${approvalComment || '无'}`
        }
        confirmText={pendingAction === 'approve' ? '确认通过' : '确认拒绝'}
        cancelText="取消"
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
        variant={pendingAction === 'approve' ? 'default' : 'destructive'}
        loading={submitting}
      />
    </div>
  );
}

export default ApprovalDetailPage;