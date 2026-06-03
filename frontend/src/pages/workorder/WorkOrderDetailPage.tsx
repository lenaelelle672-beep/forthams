/**
 * @file pages/workorder/WorkOrderDetailPage.tsx
 * @description 工单详情 + 审批操作 + Phase3 执行跟踪/挂起/验收
 *
 * Tab 布局: 工单详情 | 执行跟踪 (EXECUTING/ON_HOLD时显示)
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Check, X, Clock, AlertTriangle, Shield,
  ChevronRight, FileText, Paperclip, Download, Eye,
  PauseCircle, PlayCircle, ClipboardCheck, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { getWorkOrderDetail, approveWorkOrder, rejectWorkOrder, holdWorkOrder, resumeWorkOrder, submitForAcceptance, acceptWorkOrder, rejectAcceptance } from '@/api/workorder';
import type { WorkOrderDetailResponse } from '@/types/workorder';
import type { WorkOrder } from '@/types/workorder.types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ApprovalTimeline } from '@/components/ui/ApprovalTimeline';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import TimeLogForm from '@/components/execution/TimeLogForm';
import StepChecklist from '@/components/execution/StepChecklist';
import ProgressBar from '@/components/execution/ProgressBar';
import PhotoUpload from '@/components/execution/PhotoUpload';
import SparePartUsageForm from '@/components/spare-parts/SparePartUsageForm';
import AcceptanceDialog from '@/components/acceptance/AcceptanceDialog';

/** 工单状态中文标签 */
const STATUS_LABEL_MAP: Record<string, string> = {
  'DRAFT': '草稿',
  'PENDING': '待审批',
  'APPROVED': '已批准',
  'REJECTED': '已驳回',
  'EXECUTING': '执行中',
  'ON_HOLD': '挂起中',
  'COMPLETED': '已完成',
  'PENDING_ACCEPTANCE': '待验收',
  'ACCEPTANCE_REJECTED': '验收驳回',
  'CANCELLED': '已取消',
};

/** 优先级配置: label + badge variant + 图标颜色 */
const PRIORITY_CONFIG: Record<string, { label: string; variant: 'default' | 'warning' | 'danger' | 'purple'; dot: string }> = {
  'LOW':      { label: '低',   variant: 'default', dot: 'bg-blue-400' },
  'MEDIUM':   { label: '中',   variant: 'warning', dot: 'bg-yellow-500' },
  'HIGH':     { label: '高',   variant: 'danger',  dot: 'bg-red-500' },
  'CRITICAL': { label: '紧急', variant: 'purple',  dot: 'bg-purple-600' },
};

/** 根据 status 计算 Badge variant */
function statusBadgeVariant(status: string): 'success' | 'danger' | 'warning' | 'info' | 'gray' | 'default' {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return 'success';
    case 'REJECTED':
    case 'CANCELLED':
    case 'ACCEPTANCE_REJECTED':
      return 'danger';
    case 'EXECUTING':
    case 'ON_HOLD':
      return 'warning';
    case 'DRAFT':
      return 'gray';
    case 'PENDING':
    case 'PENDING_ACCEPTANCE':
      return 'info';
    default:
      return 'default';
  }
}

/** 计算从 createdAt 到现在的小时数 */
function hoursSince(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 3600000);
}

function resolveSlaDisplay(
  slaDeadline?: string,
  slaStatus?: string,
  priority?: string,
  createTime?: string,
): { level: 'normal' | 'warning' | 'danger'; label: string } {
  if (slaStatus && slaDeadline) {
    const deadline = new Date(slaDeadline);
    const now = Date.now();
    const remainingHours = Math.max(0, Math.floor((deadline.getTime() - now) / 3600000));
    const overdueHours = Math.max(0, Math.floor((now - deadline.getTime()) / 3600000));
    if (slaStatus === 'BREACHED') return { level: 'danger', label: `已超期 ${overdueHours}h` };
    if (slaStatus === 'WARNING') return { level: 'warning', label: `剩余 ${remainingHours}h` };
    return { level: 'normal', label: `剩余 ${remainingHours}h` };
  }
  const hours = hoursSince(createTime);
  if (hours === null || !priority) return { level: 'normal', label: '—' };
  const thresholds: Record<string, number> = { LOW: 168, MEDIUM: 72, HIGH: 24, CRITICAL: 8 };
  const limit = thresholds[priority] ?? 168;
  const pct = hours / limit;
  if (pct >= 1)    return { level: 'danger',  label: `已超期 ${hours - limit}h` };
  if (pct >= 0.75) return { level: 'warning', label: `剩余 ${limit - hours}h` };
  return { level: 'normal', label: `剩余 ${limit - hours}h` };
}

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const orderId = Number(id);

  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveDialog, setApproveDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'execution'>('detail');
  const [holdDialog, setHoldDialog] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [holdResumeAt, setHoldResumeAt] = useState('');
  const [resumeDialog, setResumeDialog] = useState(false);
  const [resumeNote, setResumeNote] = useState('');
  const [acceptanceMode, setAcceptanceMode] = useState<'submit' | 'accept' | 'reject' | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['workorders', 'detail', orderId],
    queryFn:  () => getWorkOrderDetail(orderId),
    enabled:  !!orderId,
    staleTime: 1000 * 30,
  });

  const detail = res as unknown as WorkOrderDetailResponse | undefined;
  const workOrder = detail?.workOrder as WorkOrder | undefined;
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

  const holdMutation = useMutation({
    mutationFn: () => holdWorkOrder(orderId, { reason: holdReason, holdEndTime: holdResumeAt || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workorders'] }); setHoldDialog(false); setHoldReason(''); toast.success('工单已挂起'); },
    onError: (err: any) => toast.error(err?.message || '操作失败'),
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeWorkOrder(orderId, { note: resumeNote }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workorders'] }); setResumeDialog(false); setResumeNote(''); toast.success('工单已恢复'); },
    onError: (err: any) => toast.error(err?.message || '操作失败'),
  });

  if (isLoading) {
    return <div className="p-6 space-y-4">{Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  const canApprove = workOrder?.status === 'PENDING';
  const priorityCfg = PRIORITY_CONFIG[workOrder?.priority ?? ''];
  const sla = resolveSlaDisplay(workOrder?.slaDeadline, workOrder?.slaStatus, workOrder?.priority, workOrder?.createTime);

  const currentStepId = approvalRecords.length > 0
    ? approvalRecords[approvalRecords.length - 1].id
    : undefined;

  const showExecutionTab = workOrder?.status === 'EXECUTING' || workOrder?.status === 'ON_HOLD';

  return (
    <div className="p-6 space-y-5">
      {/* ── 顶部导航栏 ── */}
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-semibold text-[#0f172a] truncate">
            {workOrder?.title ?? '工单详情'}
          </h1>
          {workOrder?.status && (
            <Badge variant={statusBadgeVariant(workOrder.status)}>
              {STATUS_LABEL_MAP[workOrder.status] ?? workOrder.status}
            </Badge>
          )}
        </div>
        <div className="flex gap-2 ml-auto flex-shrink-0">
          {/* Phase3: 挂起/恢复按钮 */}
          {workOrder?.status === 'EXECUTING' && (
            <Button variant="warning" size="sm" onClick={() => setHoldDialog(true)} className="gap-1">
              <PauseCircle className="w-4 h-4" /> 挂起
            </Button>
          )}
          {workOrder?.status === 'ON_HOLD' && (
            <Button variant="primary" size="sm" onClick={() => setResumeDialog(true)} className="gap-1">
              <PlayCircle className="w-4 h-4" /> 恢复
            </Button>
          )}
          {/* Phase3: 验收按钮 */}
          {workOrder?.status === 'EXECUTING' && (
            <Button variant="primary" size="sm" onClick={() => setAcceptanceMode('submit')} className="gap-1">
              <ClipboardCheck className="w-4 h-4" /> 提交验收
            </Button>
          )}
          {workOrder?.status === 'PENDING_ACCEPTANCE' && (
            <>
              <Button variant="danger" size="sm" onClick={() => setAcceptanceMode('reject')} className="gap-1">
                <X className="w-4 h-4" /> 驳回
              </Button>
              <Button variant="success" size="sm" onClick={() => setAcceptanceMode('accept')} className="gap-1">
                <Check className="w-4 h-4" /> 通过验收
              </Button>
            </>
          )}
          {workOrder?.status === 'ACCEPTANCE_REJECTED' && (
            <Button variant="warning" size="sm" onClick={() => setResumeDialog(true)} className="gap-1">
              <PlayCircle className="w-4 h-4" /> 返工恢复
            </Button>
          )}
          {/* 现有审批按钮 */}
          {canApprove && (
            <>
              <Button size="md" variant="destructive" onClick={() => setRejectDialog(true)}>
                <X className="w-4 h-4" /> 驳回
              </Button>
              <Button size="md" variant="primary" onClick={() => setApproveDialog(true)}>
                <Check className="w-4 h-4" /> 审批通过
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── 信息概览条 ── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-[#f8fafc] rounded-lg border border-[#e5e7eb]">
        <div className="flex items-center gap-1.5 text-sm">
          <AlertTriangle className={`w-3.5 h-3.5 ${priorityCfg ? (priorityCfg.variant === 'danger' || priorityCfg.variant === 'purple' ? 'text-red-500' : 'text-yellow-500') : 'text-gray-400'}`} />
          <span className="text-[#64748b]">优先级</span>
          <Badge variant={priorityCfg?.variant ?? 'gray'}>{priorityCfg?.label ?? workOrder?.priority ?? '—'}</Badge>
        </div>
        <span className="text-[#e5e7eb]">|</span>
        <div className="flex items-center gap-1.5 text-sm">
          {sla.level === 'danger' ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            : sla.level === 'warning' ? <Clock className="w-3.5 h-3.5 text-yellow-500" />
            : <Shield className="w-3.5 h-3.5 text-green-500" />}
          <span className="text-[#64748b]">SLA</span>
          <Badge variant={sla.level === 'danger' ? 'danger' : sla.level === 'warning' ? 'warning' : 'success'}>
            {sla.label}
          </Badge>
        </div>
        <span className="text-[#e5e7eb]">|</span>
        <div className="flex items-center gap-1.5 text-sm">
          <FileText className="w-3.5 h-3.5 text-[#94a3b8]" />
          <span className="text-[#64748b]">工单号</span>
          <span className="text-[#374151] font-medium">{workOrder?.workOrderNo ?? '—'}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-sm">
          <span className="text-[#94a3b8]">申请人</span>
          <span className="text-[#374151]">{workOrder?.reporterName ?? '—'}</span>
          {workOrder?.deptName && (
            <><ChevronRight className="w-3 h-3 text-[#cbd5e1]" /><span className="text-[#64748b]">{workOrder.deptName}</span></>
          )}
        </div>
      </div>

      {/* ── Tab 导航 ── */}
      <div className="flex gap-1 border-b border-[#e5e7eb]">
        <button
          onClick={() => setActiveTab('detail')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'detail' ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-[#64748b] hover:text-[#374151]'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-1.5" />
          工单详情
        </button>
        {showExecutionTab && (
          <button
            onClick={() => setActiveTab('execution')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'execution' ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-[#64748b] hover:text-[#374151]'
            }`}
          >
            <Activity className="w-4 h-4 inline mr-1.5" />
            执行跟踪
          </button>
        )}
      </div>

      {/* ── Tab：工单详情 ── */}
      {activeTab === 'detail' && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2">
            <CardHeader><CardTitle>工单信息</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                ['工单号', workOrder?.workOrderNo],
                ['申请人', workOrder?.reporterName],
                ['部门', workOrder?.deptName],
                ['优先级', workOrder?.priority],
                ['创建时间', workOrder?.createTime?.substring(0, 16)],
                ['描述', workOrder?.description],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex gap-4 text-sm">
                  <span className="w-20 text-[#94a3b8] flex-shrink-0">{label}</span>
                  <span className="text-[#374151]">{String(value ?? '—')}</span>
                </div>
              ))}
              {/* 附件展示 */}
              {workOrder?.attachments && workOrder.attachments.length > 0 && (
                <div className="pt-3 border-t border-[#e5e7eb]">
                  <div className="flex items-center gap-2 mb-3">
                    <Paperclip className="w-4 h-4 text-[#94a3b8]" />
                    <span className="text-sm font-medium text-[#374151]">附件 ({workOrder.attachments.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {workOrder.attachments.map((url: string, index: number) => {
                      const fileName = url.substring(url.lastIndexOf('/') + 1);
                      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
                      return (
                        <div key={index} className="group relative">
                          {isImage ? (
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="block w-20 h-20 rounded-lg border border-[#e5e7eb] overflow-hidden hover:border-[#2563eb] transition-colors">
                              <img src={url} alt={fileName} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </a>
                          ) : (
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-[#e5e7eb] hover:border-[#2563eb] transition-colors text-sm">
                              <FileText className="w-4 h-4 text-[#64748b]" />
                              <span className="text-[#374151] max-w-[120px] truncate">{fileName}</span>
                              <Download className="w-3.5 h-3.5 text-[#94a3b8]" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>审批记录</CardTitle></CardHeader>
            <CardContent>
              <ApprovalTimeline
                steps={approvalRecords.map((r) => ({
                  id: r.id,
                  label: r.approvalLevel === 'LEVEL_1' ? '一级审批' : '二级审批',
                  operatorName: r.operatorName,
                  action: r.action,
                  comment: r.comment,
                  rejectionReason: r.rejectionReason,
                  operatedAt: r.operatedAt?.substring(0, 16),
                }))}
              />
              {currentStepId !== undefined && canApprove && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                  </span>
                  <span className="text-xs font-medium text-blue-700">当前审批节点进行中</span>
                </div>
              )}
              {approvalRecords.length === 0 && (
                <p className="text-sm text-[#94a3b8] text-center py-4">暂无审批记录</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab：执行跟踪 ── */}
      {activeTab === 'execution' && workOrder && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <TimeLogForm workOrderId={orderId} />
            <PhotoUpload workOrderId={orderId} existingPhotos={workOrder?.attachments || []} />
          </div>
          <div className="space-y-4">
            <StepChecklist workOrderId={orderId} />
            <SparePartUsageForm workOrderId={orderId} />
          </div>
        </div>
      )}

      {/* ── 审批通过确认对话框 ── */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认审批通过</DialogTitle></DialogHeader>
          <div className="px-6 py-4">
            <p className="text-sm text-[#374151]">确定要通过工单「{workOrder?.title ?? ''}」的审批吗？此操作不可撤销。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(false)}>取消</Button>
            <Button loading={approveMutation.isPending} onClick={() => approveMutation.mutate({ version: workOrder?.version }, { onSuccess: () => setApproveDialog(false) })}>确认通过</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 驳回对话框 ── */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>驳回工单</DialogTitle></DialogHeader>
          <div className="px-6 py-4">
            <label className="block text-sm font-medium text-[#374151] mb-2">驳回原因 <span className="text-red-500">*</span></label>
            <textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请填写驳回原因（必填，最多 500 字）..."
              className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none" maxLength={500} />
            <p className="text-xs text-[#94a3b8] mt-1 text-right">{rejectReason.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>取消</Button>
            <Button variant="destructive" disabled={!rejectReason.trim()} loading={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate({ version: workOrder?.version, rejectionReason: rejectReason })}>确认驳回</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 挂起对话框 ── */}
      <Dialog open={holdDialog} onOpenChange={setHoldDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>挂起工单</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-1">挂起原因 *</label>
              <textarea value={holdReason} onChange={e => setHoldReason(e.target.value)}
                className="w-full h-24 rounded-xl border border-[#d7deea] text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                placeholder="请说明挂起原因..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">预计恢复时间</label>
              <input type="datetime-local" value={holdResumeAt} onChange={e => setHoldResumeAt(e.target.value)}
                className="w-full h-11 rounded-xl border border-[#d7deea] text-sm px-3" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldDialog(false)}>取消</Button>
            <Button variant="warning" onClick={() => holdMutation.mutate()} loading={holdMutation.isPending}
              disabled={!holdReason.trim()}>确认挂起</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 恢复对话框 ── */}
      <Dialog open={resumeDialog} onOpenChange={setResumeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>恢复工单</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              {workOrder?.status === 'ACCEPTANCE_REJECTED'
                ? '确认将此工单返回执行阶段进行返工？'
                : '确认恢复此工单的执行？'}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">恢复备注</label>
              <textarea value={resumeNote} onChange={e => setResumeNote(e.target.value)}
                className="w-full h-24 rounded-xl border border-[#d7deea] text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                placeholder="可选填写恢复备注..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResumeDialog(false)}>取消</Button>
            <Button variant="primary" onClick={() => resumeMutation.mutate()} loading={resumeMutation.isPending}>确认恢复</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 验收对话框 ── */}
      {acceptanceMode && (
        <AcceptanceDialog
          workOrderId={orderId}
          mode={acceptanceMode}
          open={!!acceptanceMode}
          onOpenChange={() => setAcceptanceMode(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['workorders'] })}
        />
      )}
    </div>
  );
}
