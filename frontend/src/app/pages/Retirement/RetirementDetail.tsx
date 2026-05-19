/**
 * 资产退役/报废流程详情页面
 * @module RetirementDetail
 * @description 展示资产退役申请的详细信息、状态流转和审批链路，支持审批操作
 * @category Pages
 * @subcategory Retirement
 * @requires React, Tailwind CSS
 * @see SWARM-502 资产报废/退役流程
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  RotateCcw,
  RefreshCw,
  Calendar,
  User,
  Building2,
  MapPin,
  DollarSign,
  BarChart3,
  Eye,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Timeline,
  TimelineItem,
  TimelineConnector,
  TimelineHeader,
  TimelineTitle,
  TimelineDescription,
  TimelineContent,
  TimelineDot,
} from '@/components/ui/timeline';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { retirementService } from '@/services/retirementService';
import { approvalService } from '@/services/approvalService';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import type {
  RetirementApplication,
  RetirementStatus,
  RetirementTimeline,
  ApprovalRecord,
  AssetBasicInfo,
} from './types/retirement.types';
import type { User as AuthUser } from '@/types';

/** 状态配置映射 */
const STATUS_CONFIG: Record<
  RetirementStatus,
  { label: string; color: string; icon: React.ReactNode; bgColor: string }
> = {
  DRAFT: {
    label: '草稿',
    color: 'text-gray-500',
    icon: <Edit2 className="h-4 w-4" />,
    bgColor: 'bg-gray-100',
  },
  PENDING_APPROVAL: {
    label: '待审批',
    color: 'text-yellow-600',
    icon: <Clock className="h-4 w-4" />,
    bgColor: 'bg-yellow-100',
  },
  APPROVED: {
    label: '已批准',
    color: 'text-blue-600',
    icon: <CheckCircle className="h-4 w-4" />,
    bgColor: 'bg-blue-100',
  },
  REJECTED: {
    label: '已驳回',
    color: 'text-red-600',
    icon: <XCircle className="h-4 w-4" />,
    bgColor: 'bg-red-100',
  },
  CANCELLED: {
    label: '已撤回',
    color: 'text-gray-600',
    icon: <RotateCcw className="h-4 w-4" />,
    bgColor: 'bg-gray-100',
  },
  RETIRED: {
    label: '已退役',
    color: 'text-green-600',
    icon: <CheckCircle className="h-4 w-4" />,
    bgColor: 'bg-green-100',
  },
};

/** 状态流转步骤 */
const STATUS_FLOW: RetirementStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'RETIRED',
];

/** 组件属性接口 */
interface RetirementDetailProps {
  /** 退役申请ID */
  retirementId?: string;
  /** 资产ID */
  assetId?: string;
  /** 是否显示头部导航 */
  showHeader?: boolean;
  /** 回调函数 */
  onStatusChange?: (status: RetirementStatus) => void;
}

/**
 * 资产退役详情页面组件
 * @description 展示资产退役申请的完整信息，包括申请详情、状态流转、审批记录等
 * @param props - 组件属性
 * @returns React组件
 */
export const RetirementDetail: React.FC<RetirementDetailProps> = ({
  retirementId,
  assetId,
  showHeader = true,
  onStatusChange,
}) => {
  const { id } = useParams<{ id: string }>;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, hasPermission, canApprove } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [application, setApplication] = useState<RetirementApplication | null>(null);
  const [assetInfo, setAssetInfo] = useState<AssetBasicInfo | null>(null);
  const [timeline, setTimeline] = useState<RetirementTimeline[]>([]);
  const [approvalRecords, setApprovalRecords] = useState<ApprovalRecord[]>([]);

  // 审批对话框状态
  const [approvalDialogOpen, setApprovalDialogOpen] = useState<boolean>(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState<boolean>(false);
  const [approvalComment, setApprovalComment] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>('');

  // 获取实际使用的ID
  const actualId = retirementId || id;

  /**
   * 加载退役申请详情
   */
  const loadApplicationDetail = useCallback(async () => {
    if (!actualId && !assetId) {
      toast({
        title: '参数错误',
        description: '缺少退役申请ID或资产ID',
        variant: 'destructive',
      });
      navigate('/retirement');
      return;
    }

    setLoading(true);
    try {
      let appData: RetirementApplication;
      let timelineData: RetirementTimeline[] = [];
      let approvalData: ApprovalRecord[] = [];
      let assetData: AssetBasicInfo | null = null;

      if (actualId) {
        // 通过退役申请ID加载
        const response = await retirementService.getRetirementById(actualId);
        appData = response.data;
        timelineData = response.timeline || [];
        approvalData = response.approvals || [];
        assetData = response.asset || null;
      } else {
        // 通过资产ID加载最新的退役申请
        const response = await retirementService.getLatestByAssetId(assetId!);
        appData = response.data;
        timelineData = response.timeline || [];
        approvalData = response.approvals || [];
        assetData = response.asset || null;
      }

      setApplication(appData);
      setTimeline(timelineData);
      setApprovalRecords(approvalData);
      setAssetInfo(assetData);

      // 触发状态变更回调
      if (onStatusChange && appData.status) {
        onStatusChange(appData.status);
      }
    } catch (error: any) {
      console.error('加载退役申请详情失败:', error);
      toast({
        title: '加载失败',
        description: error.message || '无法加载退役申请详情',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [actualId, assetId, navigate, toast, onStatusChange]);

  // 初始加载
  useEffect(() => {
    loadApplicationDetail();
  }, [loadApplicationDetail]);

  /**
   * 提交退役申请
   */
  const handleSubmit = async () => {
    if (!application) return;

    setSubmitting(true);
    try {
      await retirementService.submitApplication(application.id);
      toast({
        title: '提交成功',
        description: '退役申请已提交，等待审批',
      });
      loadApplicationDetail();
    } catch (error: any) {
      toast({
        title: '提交失败',
        description: error.message || '无法提交退役申请',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 撤回退役申请
   */
  const handleWithdraw = async () => {
    if (!application) return;

    setSubmitting(true);
    try {
      await retirementService.withdrawApplication(application.id);
      toast({
        title: '撤回成功',
        description: '退役申请已撤回',
      });
      loadApplicationDetail();
    } catch (error: any) {
      toast({
        title: '撤回失败',
        description: error.message || '无法撤回退役申请',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 执行审批通过
   */
  const handleApprove = async () => {
    if (!application) return;

    setSubmitting(true);
    try {
      await approvalService.approveRetirement(application.id, {
        comment: approvalComment,
        effective_date: effectiveDate,
      });
      toast({
        title: '审批通过',
        description: '退役申请已批准',
      });
      setApprovalDialogOpen(false);
      setApprovalComment('');
      setEffectiveDate('');
      loadApplicationDetail();
    } catch (error: any) {
      toast({
        title: '审批失败',
        description: error.message || '无法执行审批',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 执行审批驳回
   */
  const handleReject = async () => {
    if (!application) return;

    if (!rejectReason.trim()) {
      toast({
        title: '请填写驳回原因',
        description: '驳回原因不能为空',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await approvalService.rejectRetirement(application.id, {
        reason: rejectReason,
      });
      toast({
        title: '已驳回',
        description: '退役申请已被驳回',
      });
      setRejectDialogOpen(false);
      setRejectReason('');
      loadApplicationDetail();
    } catch (error: any) {
      toast({
        title: '驳回失败',
        description: error.message || '无法驳回申请',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 执行退役操作
   */
  const handleExecuteRetirement = async () => {
    if (!application) return;

    setSubmitting(true);
    try {
      await retirementService.executeRetirement(application.id);
      toast({
        title: '执行成功',
        description: '资产已退役，状态已更新',
      });
      loadApplicationDetail();
    } catch (error: any) {
      toast({
        title: '执行失败',
        description: error.message || '无法执行退役操作',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 编辑退役申请
   */
  const handleEdit = () => {
    if (!application) return;
    navigate(`/retirement/edit/${application.id}`);
  };

  /**
   * 判断当前用户是否可以执行某操作
   */
  const canPerformAction = (action: 'submit' | 'withdraw' | 'approve' | 'reject' | 'execute' | 'edit'): boolean => {
    if (!application || !user) return false;

    const { status, created_by } = application;

    switch (action) {
      case 'submit':
        return status === 'DRAFT' && (user.id === created_by || hasPermission('retirement:submit'));
      case 'withdraw':
        return status === 'PENDING_APPROVAL' && (user.id === created_by || hasPermission('retirement:withdraw'));
      case 'approve':
        return status === 'PENDING_APPROVAL' && canApprove('retirement');
      case 'reject':
        return status === 'PENDING_APPROVAL' && canApprove('retirement');
      case 'execute':
        return status === 'APPROVED' && hasPermission('retirement:execute');
      case 'edit':
        return status === 'DRAFT' && (user.id === created_by || hasPermission('retirement:edit'));
      default:
        return false;
    }
  };

  /**
   * 格式化日期时间
   */
  const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * 格式化日期
   */
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };

  /**
   * 获取当前状态在流程中的索引
   */
  const getCurrentStatusIndex = (status: RetirementStatus): number => {
    if (status === 'REJECTED' || status === 'CANCELLED') {
      return -1;
    }
    return STATUS_FLOW.indexOf(status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>无法找到退役申请记录</AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[application.status];
  const currentStatusIndex = getCurrentStatusIndex(application.status);
  const isPendingApproval = application.status === 'PENDING_APPROVAL';
  const isDraft = application.status === 'DRAFT';
  const isApproved = application.status === 'APPROVED';

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 头部导航 */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/retirement')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">退役申请详情</h1>
              <p className="text-sm text-muted-foreground">
                申请编号: {application.application_no || application.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 操作按钮 */}
            {canPerformAction('edit') && (
              <Button variant="outline" onClick={handleEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                编辑
              </Button>
            )}
            {canPerformAction('submit') && (
              <Button onClick={handleSubmit} disabled={submitting}>
                <Send className="h-4 w-4 mr-2" />
                {submitting ? '提交中...' : '提交申请'}
              </Button>
            )}
            {canPerformAction('withdraw') && (
              <Button variant="outline" onClick={handleWithdraw} disabled={submitting}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {submitting ? '撤回中...' : '撤回申请'}
              </Button>
            )}
            {canPerformAction('approve') && (
              <Button
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setApprovalDialogOpen(true)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                批准
              </Button>
            )}
            {canPerformAction('reject') && (
              <Button
                variant="destructive"
                onClick={() => setRejectDialogOpen(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                驳回
              </Button>
            )}
            {canPerformAction('execute') && (
              <Button
                variant="default"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleExecuteRetirement}
                disabled={submitting}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {submitting ? '执行中...' : '执行退役'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 状态展示 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>申请状态</span>
            <Badge
              variant="outline"
              className={`${statusConfig.color} ${statusConfig.bgColor} border-0 px-3 py-1`}
            >
              {statusConfig.icon}
              <span className="ml-1">{statusConfig.label}</span>
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 状态流转图 */}
          <div className="flex items-center justify-between mb-6 overflow-x-auto">
            {STATUS_FLOW.map((status, index) => {
              const config = STATUS_CONFIG[status];
              const isCompleted = currentStatusIndex > index;
              const isCurrent = currentStatusIndex === index;
              const isRejected = application.status === 'REJECTED' && index === 1;
              const isCancelled = application.status === 'CANCELLED' && index === 1;

              return (
                <div key={status} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center
                        ${isCompleted ? 'bg-green-500 text-white' : ''}
                        ${isCurrent ? `${config.bgColor} ${config.color} border-2 border-current` : ''}
                        ${!isCompleted && !isCurrent ? 'bg-gray-100 text-gray-400' : ''}
                        ${isRejected || isCancelled ? 'bg-red-100 text-red-600' : ''}
                      `}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        config.icon
                      )}
                    </div>
                    <span
                      className={`
                        text-xs mt-2 whitespace-nowrap
                        ${isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'}
                        ${isRejected || isCancelled ? 'text-red-600' : ''}
                      `}
                    >
                      {config.label}
                    </span>
                  </div>
                  {index < STATUS_FLOW.length - 1 && (
                    <div
                      className={`
                        w-16 h-0.5 mx-2
                        ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}
                      `}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* 驳回/撤回提示 */}
          {(application.status === 'REJECTED' || application.status === 'CANCELLED') && (
            <Alert
              variant={application.status === 'REJECTED' ? 'destructive' : 'default'}
              className="mt-4"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {application.status === 'REJECTED' ? '申请已驳回' : '申请已撤回'}
              </AlertTitle>
              <AlertDescription>
                {application.status === 'REJECTED'
                  ? `驳回原因: ${application.rejection_reason || '未填写'}`
                  : '申请人已主动撤回此申请'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tab 内容 */}
      <Tabs defaultValue="detail" className="space-y-4">
        <TabsList>
          <TabsTrigger value="detail">申请详情</TabsTrigger>
          <TabsTrigger value="timeline">处理记录</TabsTrigger>
          <TabsTrigger value="approvals">审批记录</TabsTrigger>
        </TabsList>

        {/* 申请详情 Tab */}
        <TabsContent value="detail" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 资产信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  资产信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {assetInfo ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">资产编号</Label>
                        <p className="font-medium">{assetInfo.asset_no}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">资产名称</Label>
                        <p className="font-medium">{assetInfo.name}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">资产分类</Label>
                        <p className="font-medium">{assetInfo.category_name}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">当前状态</Label>
                        <p className="font-medium">
                          <Badge variant="outline">{assetInfo.status}</Badge>
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">使用部门</Label>
                        <p className="font-medium flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {assetInfo.department_name || '-'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">存放地点</Label>
                        <p className="font-medium flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {assetInfo.location || '-'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">购置日期</Label>
                        <p className="font-medium">{formatDate(assetInfo.purchase_date)}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">账面价值</Label>
                        <p className="font-medium flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {assetInfo.current_value?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">暂无资产信息</p>
                )}
              </CardContent>
            </Card>

            {/* 申请信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  申请信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">申请人</Label>
                    <p className="font-medium flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {application.applicant_name || user?.username || '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">申请部门</Label>
                    <p className="font-medium flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {application.department_name || '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">申请日期</Label>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(application.created_at)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">计划退役日期</Label>
                    <p className="font-medium">
                      {formatDate(application.planned_retirement_date)}
                    </p>
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">退役原因</Label>
                  <p className="font-medium mt-1">{application.reason}</p>
                </div>
                {application.description && (
                  <div>
                    <Label className="text-muted-foreground">详细说明</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {application.description}
                    </p>
                  </div>
                )}
                {application.remarks && (
                  <div>
                    <Label className="text-muted-foreground">备注</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {application.remarks}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 附件信息 */}
          {application.attachments && application.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>附件</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {application.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(attachment.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 处理记录 Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                处理记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length > 0 ? (
                <Timeline>
                  {timeline.map((item, index) => (
                    <TimelineItem
                      key={item.id || index}
                      isLast={index === timeline.length - 1}
                    >
                      <TimelineConnector />
                      <TimelineHeader>
                        <TimelineDot
                          className={
                            item.action === 'CREATE'
                              ? 'bg-blue-500'
                              : item.action === 'APPROVE'
                              ? 'bg-green-500'
                              : item.action === 'REJECT'
                              ? 'bg-red-500'
                              : 'bg-gray-400'
                          }
                        />
                        <TimelineTitle>{item.action_text}</TimelineTitle>
                        <TimelineDescription>
                          {formatDateTime(item.created_at)}
                        </TimelineDescription>
                      </TimelineHeader>
                      <TimelineContent>
                        <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm">{item.description}</p>
                          {item.operator_name && (
                            <p className="text-xs text-muted-foreground mt-1">
                              操作人: {item.operator_name}
                            </p>
                          )}
                        </div>
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  暂无处理记录
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 审批记录 Tab */}
        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                审批记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              {approvalRecords.length > 0 ? (
                <div className="space-y-4">
                  {approvalRecords.map((record, index) => (
                    <div
                      key={record.id || index}
                      className="border rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className={`
                              w-10 h-10 rounded-full flex items-center justify-center
                              ${record.action === 'APPROVE' ? 'bg-green-100 text-green-600' : ''}
                              ${record.action === 'REJECT' ? 'bg-red-100 text-red-600' : ''}
                            `}
                          >
                            {record.action === 'APPROVE' ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              <XCircle className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {record.approver_name}
                              <span className="text-muted-foreground font-normal ml-2">
                                {record.action === 'APPROVE' ? '批准' : '驳回'}了该申请
                              </span>
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDateTime(record.action_time)}
                            </p>
                            {record.comment && (
                              <p className="mt-2 text-sm bg-muted/50 p-2 rounded">
                                {record.comment}
                              </p>
                            )}
                            {record.reason && (
                              <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                                驳回原因: {record.reason}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  暂无审批记录
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 审批通过对话框 */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批准退役申请</DialogTitle>
            <DialogDescription>
              请填写批准意见和生效日期
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveDate">生效日期</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment">批准意见</Label>
              <Textarea
                id="comment"
                placeholder="请输入批准意见（可选）"
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={submitting}
            >
              {submitting ? '提交中...' : '确认批准'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 驳回对话框 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回退役申请</DialogTitle>
            <DialogDescription>
              请填写驳回原因
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectReason">
                驳回原因 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rejectReason"
                placeholder="请输入驳回原因（必填）"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={submitting}>
              {submitting ? '提交中...' : '确认驳回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RetirementDetail;
