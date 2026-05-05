import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { CheckCircle, XCircle, ArrowRightLeft, RotateCcw, Bell, Clock, User, FileText, History } from 'lucide-react';
import { workOrderApi, WorkOrder, WorkOrderStatus } from '@/api/workorder';
import { toast } from 'sonner';

/**
 * WorkOrderStatus Enum - 状态机流转规格定义
 * @description 定义工单状态枚举，对应 SPEC 中状态机流转规格
 */
export enum WorkOrderStatus {
  PENDING = 'pending',           // 待审批
  APPROVED = 'approved',         // 已通过
  REJECTED = 'rejected',         // 已驳回
  RETURNED = 'returned',         // 退回修改
  TRANSFERRED = 'transferred',   // 已转交
  CLOSED = 'closed',             // 已关闭
}

/**
 * ApprovalAction Enum - 审批动作类型
 * @description 定义审批动作枚举
 */
export enum ApprovalAction {
  APPROVE = 'approve',           // 审批通过
  REJECT = 'reject',             // 审批驳回
  TRANSFER = 'transfer',         // 转交审批
  RETURN = 'return',             // 退回修改
}

/**
 * ApprovalRequest Interface - 审批请求参数
 * @description 定义审批请求参数接口
 */
export interface ApprovalRequest {
  action: ApprovalAction;
  comment?: string;
  targetApproverId?: string;
  version: number;
}

/**
 * BatchApprovalRequest Interface - 批量审批请求参数
 * @description 定义批量审批请求参数接口，单次批量审批上限 50 条
 */
export interface BatchApprovalRequest {
  workOrderIds: string[];
  action: ApprovalAction;
  comment?: string;
  version: number;
}

/**
 * ValidationError Interface - 验证错误类型
 * @description 定义验证错误类型
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * ApprovalPage Component - 工单审批页面
 * @description 工单审批流程主页面，支持通过/驳回/转交/退回等审批操作
 * @see SPEC: SWARM-2025-Q2-P0-003 Iteration 4
 */
export const ApprovalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 状态管理
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [comment, setComment] = useState<string>('');
  const [targetApproverId, setTargetApproverId] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [activeTab, setActiveTab] = useState<string>('details');
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);

  /**
   * 加载工单详情
   * @description 获取工单详情和审批历史记录
   */
  const loadWorkOrder = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setValidationErrors([]);
      const data = await workOrderApi.getById(id);
      setWorkOrder(data);
      
      // 加载审批历史
      const history = await workOrderApi.getApprovalHistory(id);
      setApprovalHistory(history);
    } catch (error: any) {
      toast.error(`加载工单失败: ${error.message || '未知错误'}`);
      console.error('Load work order error:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadWorkOrder();
  }, [loadWorkOrder]);

  /**
   * 验证审批请求
   * @description 根据审批动作验证必填字段
   * - 驳回/退回操作必须填写审批意见，最小 5 字符
   * - 转交操作必须指定目标审批人
   */
  const validateApprovalRequest = (action: ApprovalAction, comment?: string, targetApproverId?: string): ValidationError[] => {
    const errors: ValidationError[] = [];

    // 意见约束：驳回/退回必须填写意见，最小 5 字符
    if ((action === ApprovalAction.REJECT || action === ApprovalAction.RETURN) && !comment) {
      errors.push({ field: 'comment', message: '审批意见不能为空' });
    } else if ((action === ApprovalAction.REJECT || action === ApprovalAction.RETURN) && comment && comment.trim().length < 5) {
      errors.push({ field: 'comment', message: '审批意见至少需要 5 个字符' });
    }

    // 转交约束：必须指定目标审批人
    if (action === ApprovalAction.TRANSFER && !targetApproverId) {
      errors.push({ field: 'targetApproverId', message: '请选择目标审批人' });
    }

    // 状态约束：已关闭(Closed)状态不可执行审批操作
    if (workOrder?.status === WorkOrderStatus.CLOSED) {
      errors.push({ field: 'status', message: '已关闭的工单不能执行审批操作' });
    }

    // 审批权限约束：仅工单当前审批人可执行审批操作
    // TODO: 集成权限校验服务
    // const canApprove = await approvalService.checkPermission(workOrder.currentApproverId, currentUserId);
    // if (!canApprove) {
    //   errors.push({ field: 'permission', message: '您不是当前工单的审批人' });
    // }

    return errors;
  };

  /**
   * 处理审批动作
   * @description 执行审批操作，通过状态机流转并触发通知
   */
  const handleApprovalAction = async (action: ApprovalAction) => {
    if (!workOrder) return;

    // 验证请求
    const errors = validateApprovalRequest(action, comment, targetApproverId);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      const request: ApprovalRequest = {
        action,
        comment: comment.trim() || undefined,
        targetApproverId: targetApproverId || undefined,
        version: workOrder.version,
      };

      // 根据审批动作调用不同的 API
      switch (action) {
        case ApprovalAction.APPROVE:
          await workOrderApi.approve(id!, request);
          toast.success('审批通过，工单已流转至下一节点');
          break;
        case ApprovalAction.REJECT:
          await workOrderApi.reject(id!, request);
          toast.success('工单已驳回');
          break;
        case ApprovalAction.TRANSFER:
          await workOrderApi.transfer(id!, request);
          toast.success('工单已转交至目标审批人');
          break;
        case ApprovalAction.RETURN:
          await workOrderApi.returnToApplicant(id!, request);
          toast.success('工单已退回给申请人修改');
          break;
      }

      // 刷新数据
      await loadWorkOrder();
      setComment('');
      setTargetApproverId('');
      setValidationErrors([]);
    } catch (error: any) {
      // 并发控制：版本号冲突时返回 409 Conflict
      if (error.status === 409) {
        toast.error('工单已被其他用户修改，请刷新页面后重试');
      } else {
        toast.error(`审批操作失败: ${error.message || '未知错误'}`);
      }
      console.error('Approval action error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 处理批量审批
   * @description 批量执行审批操作，单次上限 50 条
   */
  const handleBatchApproval = async (workOrderIds: string[], action: ApprovalAction, comment?: string) => {
    // 批量约束：单次批量审批上限 50 条
    if (workOrderIds.length > 50) {
      toast.error('单次批量审批上限 50 条工单');
      return;
    }

    // 意见约束：驳回/退回必须填写意见
    if ((action === ApprovalAction.REJECT || action === ApprovalAction.RETURN) && !comment) {
      toast.error('驳回/退回操作必须填写审批意见');
      return;
    }

    try {
      setSubmitting(true);
      const request: BatchApprovalRequest = {
        workOrderIds,
        action,
        comment: comment?.trim(),
        version: Date.now(), // 使用时间戳作为版本号
      };

      await workOrderApi.batchApprove(request);
      toast.success(`成功批量审批 ${workOrderIds.length} 条工单`);
      
      // 刷新数据
      await loadWorkOrder();
      setComment('');
    } catch (error: any) {
      toast.error(`批量审批失败: ${error.message || '未知错误'}`);
      console.error('Batch approval error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 获取状态显示信息
   * @description 根据状态枚举返回对应的显示样式
   */
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'warning' }> = {
      [WorkOrderStatus.PENDING]: { label: '待审批', variant: 'warning' },
      [WorkOrderStatus.APPROVED]: { label: '已通过', variant: 'success' },
      [WorkOrderStatus.REJECTED]: { label: '已驳回', variant: 'destructive' },
      [WorkOrderStatus.RETURNED]: { label: '退回修改', variant: 'destructive' },
      [WorkOrderStatus.TRANSFERRED]: { label: '已转交', variant: 'default' },
      [WorkOrderStatus.CLOSED]: { label: '已关闭', variant: 'default' },
    };

    const config = statusConfig[status] || { label: status, variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  /**
   * 获取审批动作按钮配置
   * @description 根据当前状态返回可执行的审批动作按钮
   */
  const getApprovalActionButtons = () => {
    if (!workOrder) return null;

    // 状态约束：已关闭(Closed)状态不可执行审批操作
    if (workOrder.status === WorkOrderStatus.CLOSED) {
      return (
        <Alert>
          <AlertTitle>工单已关闭</AlertTitle>
          <AlertDescription>已关闭的工单不能执行审批操作</AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="flex flex-wrap gap-3">
        <Button
          variant="default"
          size="sm"
          onClick={() => handleApprovalAction(ApprovalAction.APPROVE)}
          disabled={submitting}
          className="gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          审批通过
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleApprovalAction(ApprovalAction.REJECT)}
          disabled={submitting}
          className="gap-2"
        >
          <XCircle className="h-4 w-4" />
          驳回
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleApprovalAction(ApprovalAction.TRANSFER)}
          disabled={submitting}
          className="gap-2"
        >
          <ArrowRightLeft className="h-4 w-4" />
          转交
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleApprovalAction(ApprovalAction.RETURN)}
          disabled={submitting}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          退回修改
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <Alert variant="destructive">
        <AlertTitle>工单不存在</AlertTitle>
        <AlertDescription>无法加载工单详情</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">工单审批</h1>
          {getStatusBadge(workOrder.status)}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>版本: v{workOrder.version}</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">
            <FileText className="h-4 w-4 mr-2" />
            工单详情
          </TabsTrigger>
          <TabsTrigger value="approval">
            <CheckCircle className="h-4 w-4 mr-2" />
            审批操作
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            审批历史
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>工单信息</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">工单编号</label>
                  <p className="text-sm">{workOrder.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">资产编号</label>
                  <p className="text-sm">{workOrder.assetId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">申请人</label>
                  <p className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {workOrder.applicantName}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">当前审批人</label>
                  <p className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {workOrder.currentApproverName || '待分配'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">创建时间</label>
                  <p className="text-sm">{new Date(workOrder.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">更新时间</label>
                  <p className="text-sm">{new Date(workOrder.updatedAt).toLocaleString()}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">工单描述</label>
                <p className="text-sm">{workOrder.description}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>审批操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {getApprovalActionButtons()}

              {(validationErrors.length > 0) && (
                <Alert variant="destructive">
                  <AlertTitle>验证失败</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    审批意见 <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="请输入审批意见（驳回/退回时必填，至少5个字符）"
                    rows={4}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    驳回/退回操作必须填写审批意见，最小 5 字符
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    目标审批人 <span className="text-destructive">*</span>
                  </label>
                  <Select value={targetApproverId} onValueChange={setTargetApproverId}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择目标审批人（转交时必填）" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* TODO: 加载审批人列表 */}
                      <SelectItem value="approver-1">审批人 A</SelectItem>
                      <SelectItem value="approver-2">审批人 B</SelectItem>
                      <SelectItem value="approver-3">审批人 C</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    转交审批时必须选择目标审批人
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>通知设置</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">审批通知</p>
                <p className="text-xs text-muted-foreground">
                  审批动作触发后自动发送通知给相关方
                </p>
              </div>
              <Badge variant="outline" className="ml-auto">
                通知频率: 同一工单同一操作 5 分钟内不重复发送
              </Badge>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>审批历史</CardTitle>
            </CardHeader>
            <CardContent>
              {approvalHistory.length === 0 ? (
                <Alert>
                  <AlertTitle>暂无审批历史</AlertTitle>
                  <AlertDescription>工单尚未经过任何审批操作</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {approvalHistory.map((record, index) => (
                    <div key={index} className="border-l-2 border-muted pl-4 pb-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{record.action}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(record.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm mt-2">{record.comment || '无'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        操作人: {record.approverName}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApprovalPage;