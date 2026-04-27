import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowLeft,
  AlertCircle,
  Clock,
  User,
  FileText,
} from 'lucide-react';
import { ticketApi } from '@/api/tickets';
import type { Ticket, TicketStatus, ApprovalAction } from '@/types/ticket.types';
import { useApprovalPermission } from '@/composables/useApprovalPermission';

/**
 * 工单审批页面组件
 * 
 * 根据 SPEC-SWARM-2025-Q2-P0-003-v3 实现工单审批流程：
 * - 审批详情展示 (P0)
 * - 审批/拒绝/驳回操作按钮 (P0)
 * - 操作结果反馈 (P0)
 * 
 * ATB-3 前端审批页面功能验收测试覆盖
 */
export const TicketApprovalPage: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  
  // 工单状态
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 操作相关状态
  const [actionLoading, setActionLoading] = useState(false);
  const [actionType, setActionType] = useState<ApprovalAction | null>(null);
  const [comment, setComment] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // 权限检查
  const { canApprove, canReject, canReturn, loading: permissionLoading } = useApprovalPermission(ticket);
  
  // 加载工单详情
  const fetchTicketDetail = useCallback(async () => {
    if (!ticketId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await ticketApi.getTicketById(ticketId);
      setTicket(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取工单详情失败';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);
  
  useEffect(() => {
    fetchTicketDetail();
  }, [fetchTicketDetail]);
  
  // 执行审批操作
  const handleApprovalAction = useCallback(async () => {
    if (!ticket || !actionType) return;
    
    try {
      setActionLoading(true);
      
      const result = await ticketApi.approveTicket(ticket.id, {
        action: actionType,
        comment: comment.trim() || undefined,
      });
      
      // ATB-3.2/3.3: Toast 提示操作结果
      if (actionType === 'approve') {
        toast.success('审批成功', {
          description: `工单状态已更新为: ${result.status}`,
        });
      } else if (actionType === 'reject') {
        toast.info('工单已拒绝', {
          description: comment.trim() || '审批人已拒绝该工单',
        });
      } else if (actionType === 'return') {
        toast.warning('工单已驳回', {
          description: '请修改后重新提交',
        });
      }
      
      // 刷新工单详情
      await fetchTicketDetail();
      setShowConfirmDialog(false);
      setComment('');
      setActionType(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败';
      toast.error('操作失败', {
        description: message,
      });
    } finally {
      setActionLoading(false);
    }
  }, [ticket, actionType, comment, fetchTicketDetail]);
  
  // 打开确认对话框
  const openConfirmDialog = useCallback((action: ApprovalAction) => {
    setActionType(action);
    setShowConfirmDialog(true);
  }, []);
  
  // 关闭确认对话框
  const closeConfirmDialog = useCallback(() => {
    setShowConfirmDialog(false);
    setActionType(null);
    setComment('');
  }, []);
  
  // 获取状态显示配置
  const getStatusConfig = useCallback((status: TicketStatus) => {
    const configMap: Record<TicketStatus, { label: string; color: string; icon: React.ReactNode }> = {
      draft: { label: '草稿', color: 'secondary', icon: <FileText className="h-4 w-4" /> },
      pending_approval: { label: '待审批', color: 'warning', icon: <Clock className="h-4 w-4" /> },
      processing: { label: '处理中', color: 'info', icon: <User className="h-4 w-4" /> },
      completed: { label: '已完成', color: 'success', icon: <CheckCircle2 className="h-4 w-4" /> },
      rejected: { label: '已拒绝', color: 'destructive', icon: <XCircle className="h-4 w-4" /> },
      cancelled: { label: '已取消', color: 'secondary', icon: <XCircle className="h-4 w-4" /> },
    };
    return configMap[status] || configMap.draft;
  }, []);
  
  // 获取操作按钮配置
  const getActionConfig = useCallback((action: ApprovalAction) => {
    const configMap: Record<ApprovalAction, { label: string; icon: React.ReactNode; variant: 'default' | 'destructive' | 'outline' }> = {
      approve: { label: '批准', icon: <CheckCircle2 className="h-4 w-4 mr-2" />, variant: 'default' },
      reject: { label: '拒绝', icon: <XCircle className="h-4 w-4 mr-2" />, variant: 'destructive' },
      return: { label: '驳回', icon: <RotateCcw className="h-4 w-4 mr-2" />, variant: 'outline' },
    };
    return configMap[action];
  }, []);
  
  // 判断操作按钮是否可用
  const isActionDisabled = useCallback((action: ApprovalAction) => {
    if (!ticket) return true;
    
    // ATB-1.x: 基于状态机校验
    // 只有 "待审批" 状态可以执行审批操作
    if (ticket.status !== 'pending_approval') {
      return true;
    }
    
    switch (action) {
      case 'approve':
        return !canApprove;
      case 'reject':
        return !canReject;
      case 'return':
        return !canReturn;
      default:
        return true;
    }
  }, [ticket, canApprove, canReject, canReturn]);
  
  // 加载状态
  if (loading || permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }
  
  // 错误状态
  if (error || !ticket) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            {error || '工单不存在'}
          </AlertDescription>
        </Alert>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
      </div>
    );
  }
  
  const statusConfig = getStatusConfig(ticket.status);
  
  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
      </div>
      
      {/* 工单详情卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">工单详情</CardTitle>
            <Badge variant={statusConfig.color as any}>
              <span className="flex items-center gap-1">
                {statusConfig.icon}
                {statusConfig.label}
              </span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">工单编号</span>
              <p className="font-medium">{ticket.ticketNumber || ticket.id}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">标题</span>
              <p className="font-medium">{ticket.title}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">创建人</span>
              <p className="font-medium">{ticket.creatorName || ticket.creator?.name || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">创建时间</span>
              <p className="font-medium">
                {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '-'}
              </p>
            </div>
            {ticket.approverName && (
              <div>
                <span className="text-sm text-muted-foreground">审批人</span>
                <p className="font-medium">{ticket.approverName}</p>
              </div>
            )}
            {ticket.assigneeName && (
              <div>
                <span className="text-sm text-muted-foreground">负责人</span>
                <p className="font-medium">{ticket.assigneeName}</p>
              </div>
            )}
          </div>
          
          {ticket.description && (
            <div>
              <span className="text-sm text-muted-foreground">描述</span>
              <p className="mt-1 text-sm">{ticket.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* 审批历史卡片 */}
      {ticket.approvalHistory && ticket.approvalHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">审批历史</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ticket.approvalHistory.map((record, index) => (
                <div key={index} className="flex gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    {record.action === 'approve' && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {record.action === 'reject' && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    {record.action === 'return' && (
                      <RotateCcw className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {record.approverName || record.approver?.name || '审批人'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {record.actionAt ? new Date(record.actionAt).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {record.action === 'approve' && '批准'}
                      {record.action === 'reject' && '拒绝'}
                      {record.action === 'return' && '驳回'}
                    </p>
                    {record.comment && (
                      <p className="text-sm mt-2 p-2 bg-muted rounded">
                        {record.comment}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* 审批操作区域 */}
      {ticket.status === 'pending_approval' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">审批操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ATB-3.4: 无权限用户按钮置灰或隐藏 */}
            <div className="flex gap-3 flex-wrap">
              {/* 批准按钮 */}
              <Button
                data-testid="btn-approve"
                onClick={() => openConfirmDialog('approve')}
                disabled={isActionDisabled('approve')}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                批准
              </Button>
              
              {/* 拒绝按钮 */}
              <Button
                data-testid="btn-reject"
                variant="destructive"
                onClick={() => openConfirmDialog('reject')}
                disabled={isActionDisabled('reject')}
              >
                <XCircle className="h-4 w-4 mr-2" />
                拒绝
              </Button>
              
              {/* 驳回按钮 */}
              <Button
                data-testid="btn-return"
                variant="outline"
                onClick={() => openConfirmDialog('return')}
                disabled={isActionDisabled('return')}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                驳回
              </Button>
            </div>
            
            {/* 状态不可操作的提示 */}
            {ticket.status !== 'pending_approval' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  当前工单状态不允许进行审批操作
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* 确认对话框 */}
      <Dialog open={showConfirmDialog} onOpenChange={closeConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType && getActionConfig(actionType).label}工单
            </DialogTitle>
            <DialogDescription>
              请确认您的操作，审批后将无法撤销
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                审批意见（可选）
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  actionType === 'approve' 
                    ? '审批通过，可填写意见...'
                    : actionType === 'reject'
                    ? '请填写拒绝原因...'
                    : '请填写驳回原因...'
                }
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={closeConfirmDialog}>
              取消
            </Button>
            <Button
              data-testid="confirm-dialog-yes"
              onClick={handleApprovalAction}
              disabled={actionLoading}
              variant={actionType === 'reject' ? 'destructive' : 'default'}
            >
              {actionLoading ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TicketApprovalPage;