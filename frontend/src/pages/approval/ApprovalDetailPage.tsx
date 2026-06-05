/**
 * @file pages/approval/ApprovalDetailPage.tsx
 * @description 审批流程详情页 — 独立页面，支持审批操作
 *
 * 功能：
 * - 展示审批流程完整信息（基本信息、业务数据、审批流转）
 * - 底部固定操作栏：通过（含审批意见）、驳回（含驳回原因）、取消
 * - 面包屑导航返回列表
 */

import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  User,
  CalendarDays,
  GitBranch,
  Hash,
  Building2,
  Send,
  RotateCcw,
  MessageSquare,
  ShieldCheck,
  ExternalLink,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  getApprovalDetail,
  approveItem,
  rejectItem,
  cancelApproval,
} from '@/api/approval';
import type { ApprovalItem } from '@/api/approval';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import ApprovalFlowTracker, { type FlowStep } from '@/components/ApprovalFlowTracker';
import { getUserList } from '@/api/base';

// ── 状态配置 ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string; ring: string }> = {
  PENDING:     { label: '待审批', dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200', ring: 'ring-blue-100' },
  APPROVING:   { label: '审批中', dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200', ring: 'ring-blue-100' },
  IN_PROGRESS: { label: '审批中', dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200', ring: 'ring-blue-100' },
  APPROVED:    { label: '已通过', dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-100' },
  REJECTED:    { label: '已驳回', dot: 'bg-red-400',    text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200', ring: 'ring-red-100' },
  CANCELLED:   { label: '已取消', dot: 'bg-slate-400',  text: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200', ring: 'ring-slate-100' },
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  ASSET_TRANSFER:    { label: '资产调拨', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  ASSET_CLEARANCE:   { label: '资产清退', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  ASSET_SCRAP:       { label: '资产报废', color: 'bg-red-50 text-red-700 border-red-200' },
  ASSET_COMPENSATION:{ label: '资产赔偿', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  WORK_ORDER:        { label: '工单申请', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  RETIREMENT:        { label: '退役申请', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  transfer:          { label: '资产转移', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  dispose:           { label: '资产清退', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  maintenance:       { label: '维保申请', color: 'bg-teal-50 text-teal-700 border-teal-200' },
};

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', ring: 'ring-slate-100' };
}

function getTypeCfg(type: string) {
  return TYPE_LABELS[type] ?? { label: type || '未知类型', color: 'bg-slate-50 text-slate-600 border-slate-200' };
}

// ── 业务数据字段映射与格式化 ─────────────────────────────────────────────────

/** 字段名 → 中文标签 */
const FIELD_LABELS: Record<string, string> = {
  // 资产相关
  assetId: '资产 ID', assetIds: '资产列表', assetNo: '资产编号', assetName: '资产名称',
  categoryId: '分类 ID', categoryName: '分类名称',
  // 调拨相关
  transferType: '调拨类型', fromDept: '调出部门', toDept: '调入部门',
  fromLocation: '调出位置', toLocation: '调入位置', transferTo: '调拨至',
  // 清退/报废
  clearanceReason: '清退原因', scrapReason: '报废原因', scrapDate: '报废日期',
  disposalMethod: '处置方式', estimatedResidualValue: '预估残值',
  urgency: '紧急程度', applicationDate: '申请日期',
  // 赔偿
  incidentDate: '事故日期', compensationType: '赔偿方式',
  compensationAmount: '赔偿金额', compensationMethod: '赔偿方式',
  // 通用
  reason: '原因/说明', description: '描述', remark: '备注', notes: '备注',
  priority: '优先级', status: '状态', quantity: '数量',
  approvalFlow: '审批流程', workflow: '工作流',
  // 工单
  workOrderType: '工单类型', assigneeId: '指派人 ID', assigneeName: '指派人',
  expectedCompletionDate: '预计完成日期', actualCompletionDate: '实际完成日期',
  // 维保
  maintenanceType: '维保类型', maintenanceDate: '维保日期',
  estimatedCost: '预估费用', actualCost: '实际费用',
  // 其他
  originalValue: '原值', currentValue: '当前净值',
  location: '位置', deptId: '部门 ID', deptName: '部门',
  brand: '品牌', model: '型号', serialNo: '序列号',
};

/** 获取字段中文标签 */
function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

/** 业务单据路由映射：processType → 跳转路径 */
function getBusinessRoute(processType: string | undefined, businessId: number | undefined): string | null {
  if (!businessId || businessId <= 0) return null;
  const map: Record<string, string> = {
    ASSET_TRANSFER: `/assets/${businessId}`,
    ASSET_CLEARANCE: `/disposal/clearance/${businessId}`,
    ASSET_SCRAP: `/disposal/scrap/${businessId}`,
    ASSET_COMPENSATION: `/disposal/compensation/${businessId}`,
    WORK_ORDER: `/work-orders/${businessId}`,
    RETIREMENT: `/retirement/${businessId}`,
    transfer: `/assets/${businessId}`,
    dispose: `/disposal/${businessId}`,
    maintenance: `/maintenance/${businessId}`,
  };
  return map[processType ?? ''] ?? null;
}

/** 格式化单个值 */
function formatBusinessValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') {
    // 金额类字段加 ¥ 前缀
    if (/amount|value|cost|price|residual/i.test(key)) return `¥${value.toLocaleString()}`;
    return String(value);
  }
  if (typeof value === 'string') {
    // 日期格式化
    if (/date|time/i.test(key) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.replace('T', ' ').substring(0, 16);
    }
    return value;
  }
  return String(value);
}

/** 可展开的嵌套对象/数组展示组件 */
function NestedValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (value == null || value === '') return <span className="text-slate-400">—</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-400">（空）</span>;
    // 简单数组（全为原始值）→ 逗号连接
    if (value.every(v => typeof v !== 'object' || v === null)) {
      return <span className="text-slate-800">{value.map(v => formatBusinessValue('', v)).join('、')}</span>;
    }
    // 复杂数组 → 展开列表
    return (
      <div className="mt-1">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {value.length} 项
        </button>
        {expanded && (
          <div className="mt-1 space-y-1 border-l-2 border-slate-200 pl-3">
            {value.map((item, i) => (
              <div key={i} className="text-xs">
                {typeof item === 'object' && item !== null ? (
                  <NestedValue value={item} depth={depth + 1} />
                ) : (
                  <span className="text-slate-700">{formatBusinessValue('', item)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-slate-400">（空）</span>;
    return (
      <div className="mt-1">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {entries.length} 个字段
        </button>
        {expanded && (
          <div className="mt-1 space-y-1.5 border-l-2 border-slate-200 pl-3">
            {entries.map(([k, v]) => (
              <div key={k}>
                <span className="text-[10px] font-medium text-slate-500">{getFieldLabel(k)}</span>
                <div className="text-xs text-slate-800">
                  {typeof v === 'object' && v !== null ? (
                    <NestedValue value={v} depth={depth + 1} />
                  ) : (
                    formatBusinessValue(k, v)
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-slate-800">{String(value)}</span>;
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export default function ApprovalDetailPage() {
  const { t } = useTranslation(['approval', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const approvalId = Number(id);

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [approveComment, setApproveComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // ── 加载审批详情 ──────────────────────────────────────────────────────────
  const { data: detailRes, isLoading } = useQuery({
    queryKey: ['approvals', 'detail', approvalId],
    queryFn: () => getApprovalDetail(approvalId),
    enabled: !!approvalId,
    staleTime: 1000 * 15,
  });

  const detailContainer = detailRes as {
    process?: ApprovalItem;
    records?: Record<string, unknown>[];
    workflowRuntimePath?: Record<string, unknown>[];
  } | null | undefined;

  const detail: ApprovalItem | null = detailContainer?.process ?? null;
  const detailRecords: Record<string, unknown>[] = detailContainer?.records ?? [];
  const workflowPath: Record<string, unknown>[] = detailContainer?.workflowRuntimePath ?? [];

  // ── 用户名映射 ──────────────────────────────────────────────────────────
  const { data: userNameMapRes } = useQuery({
    queryKey: ['users', 'name-map'],
    queryFn: async () => {
      const r = await getUserList({ page: 1, pageSize: 200 });
      const records = (r as { records?: { id: number; realName?: string; username?: string }[] }).records ?? [];
      return new Map<number, string>(records.map(u => [u.id, u.realName || u.username || `用户${u.id}`]));
    },
    staleTime: 60000,
  });

  // ── 构建流转步骤 ────────────────────────────────────────────────────────
  const flowSteps: FlowStep[] = useMemo(() => {
    return (workflowPath as Array<Record<string, unknown>>).map((node) => {
      const stepNo = typeof node.stepNo === 'number' ? node.stepNo : Number(node.stepNo ?? 1);
      const match = (detailRecords as Array<Record<string, unknown>>).find((r) => r.stepNo === stepNo);
      const approverId = match?.approverId as number | undefined;
      return {
        stepNo,
        nodeId: String(node.nodeId ?? node.nodeCode ?? ''),
        nodeCode: String(node.nodeCode ?? ''),
        label: String(node.label ?? ''),
        approverType: String(node.approverType ?? ''),
        approverRole: String(node.approverRole ?? ''),
        approverRoleName: String(node.approverRoleName ?? ''),
        approvalMode: String(node.approvalMode ?? 'sequence'),
        record: match ? {
          approverId: approverId ?? 0,
          approverName: approverId != null ? (userNameMapRes?.get(approverId) ?? `用户${approverId}`) : undefined,
          result: String(match.approveResult ?? ''),
          opinion: String(match.approveOpinion ?? ''),
          time: String(match.approveTime ?? ''),
        } : undefined,
      };
    });
  }, [workflowPath, detailRecords, userNameMapRes]);

  // ── 审批操作 mutations ──────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: () => approveItem(approvalId, { version: detail?.version ?? 0, comment: approveComment }),
    onSuccess: () => {
      toast.success(t('approval:messages.approveSuccess'));
      setApproveDialogOpen(false);
      setApproveComment('');
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (err: Error) => toast.error(err.message || '审批操作失败'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectItem(approvalId, { version: detail?.version ?? 0, rejectionReason: rejectReason }),
    onSuccess: () => {
      toast.success(t('approval:messages.rejectSuccess'));
      setRejectDialogOpen(false);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (err: Error) => toast.error(err.message || '驳回操作失败'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelApproval(approvalId),
    onSuccess: () => {
      toast.success(t('approval:messages.recallSuccess'));
      setCancelDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (err: Error) => toast.error(err.message || '取消失败'),
  });

  // ── 计算可操作状态 ──────────────────────────────────────────────────────
  const canApprove = detail && (detail.status === 'PENDING' || detail.status === 'APPROVING' || detail.status === 'IN_PROGRESS');
  const canCancel = detail && (detail.status === 'PENDING' || detail.status === 'DRAFT');
  const isTerminal = detail && (detail.status === 'APPROVED' || detail.status === 'REJECTED' || detail.status === 'CANCELLED');

  const statusCfg = detail ? getStatusCfg(detail.status) : null;
  const typeCfg = detail ? getTypeCfg(detail.processType ?? detail.businessType ?? '') : null;

  // ── 解析业务数据 ────────────────────────────────────────────────────────
  const businessData = useMemo(() => {
    if (!detail?.businessData) return null;
    try {
      return JSON.parse(detail.businessData);
    } catch {
      return null;
    }
  }, [detail?.businessData]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">{t('approval:list.loading')}</p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <XCircle className="h-12 w-12 text-slate-300" />
        <p className="text-slate-500">未找到该审批记录</p>
        <Button variant="outline" onClick={() => navigate('/approvals')}>
          <ArrowLeft className="mr-2 h-4 w-4" />返回审批列表
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[var(--app-background)]">
      {/* ── 顶部面包屑 ── */}
      <div className="border-b border-slate-100 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-[1200px] items-center gap-2 text-sm">
          <button
            onClick={() => navigate('/approvals')}
            className="flex items-center gap-1 text-slate-500 transition-colors hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            审批中心
          </button>
          <span className="text-slate-300">/</span>
          <span className="font-medium text-slate-800">
            {detail.processNo ?? `审批 #${approvalId}`}
          </span>
        </div>
      </div>

      {/* ── 主体内容 ── */}
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">

          {/* ── 左侧：详情信息 ── */}
          <div className="space-y-6">

            {/* 流程概要卡片 */}
            <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
              {/* 头部：编号 + 状态 */}
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-medium text-slate-400">流程编号</span>
                    </div>
                    <h1 className="mt-1 text-lg font-bold text-slate-900">
                      {detail.processNo ?? `#${approvalId}`}
                    </h1>
                    {detail.title && (
                      <p className="mt-1 text-sm text-slate-500">{detail.title}</p>
                    )}
                  </div>
                  {statusCfg && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ring-1 ring-inset ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text} ${statusCfg.ring}`}>
                      <span className={`h-2 w-2 rounded-full ${statusCfg.dot}`} />
                      {statusCfg.label}
                    </span>
                  )}
                </div>
              </div>

              {/* 基本信息网格 */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-5 px-6 py-5 sm:grid-cols-3">
                <InfoField icon={<GitBranch className="h-3.5 w-3.5" />} label="流程类型">
                  {typeCfg && (
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${typeCfg.color}`}>
                      {typeCfg.label}
                    </span>
                  )}
                </InfoField>
                <InfoField icon={<User className="h-3.5 w-3.5" />} label="发起人">
                  <span className="text-sm font-semibold text-slate-900">
                    {detail.applicantName ?? (detail.applicantId ? `用户${detail.applicantId}` : '—')}
                  </span>
                </InfoField>
                {detail.deptName && (
                  <InfoField icon={<Building2 className="h-3.5 w-3.5" />} label="所属部门">
                    <span className="text-sm font-medium text-slate-700">{detail.deptName}</span>
                  </InfoField>
                )}
                <InfoField icon={<CalendarDays className="h-3.5 w-3.5" />} label="发起时间">
                  <span className="text-sm text-slate-600">
                    {detail.createTime ?? detail.applyTime ?? detail.createdAt ?? detail.submittedAt ?? '—'}
                  </span>
                </InfoField>
                {detail.businessId != null && detail.businessId > 0 && (
                  <InfoField icon={<Hash className="h-3.5 w-3.5" />} label="业务ID">
                    <span className="text-sm font-mono text-slate-600">#{detail.businessId}</span>
                  </InfoField>
                )}
                {detail.currentStep != null && (
                  <InfoField icon={<ShieldCheck className="h-3.5 w-3.5" />} label="当前步骤">
                    <span className="text-sm font-semibold text-blue-600">第 {detail.currentStep} 步</span>
                  </InfoField>
                )}
              </div>
            </Card>

            {/* 业务数据卡片 */}
            {businessData && Object.keys(businessData).length > 0 && (
              <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                    <h2 className="text-sm font-bold text-slate-900">业务数据</h2>
                  </div>
                  {(() => {
                    const route = getBusinessRoute(detail.processType ?? detail.businessType, detail.businessId);
                    return route ? (
                      <button
                        onClick={() => navigate(route)}
                        className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        查看业务单据
                      </button>
                    ) : null;
                  })()}
                </div>
                <div className="px-6 py-4">
                  {/* 主字段网格 */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
                    {Object.entries(businessData).map(([key, value]) => {
                      const isComplex = typeof value === 'object' && value !== null;
                      return (
                        <div key={key} className={isComplex ? 'col-span-2 sm:col-span-3' : ''}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {getFieldLabel(key)}
                          </p>
                          <div className="mt-0.5 text-sm">
                            {isComplex ? (
                              <NestedValue value={value} />
                            ) : (
                              <span className="text-slate-800">{formatBusinessValue(key, value)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* 审批流转卡片 */}
            <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="text-sm font-bold text-slate-900">审批流转</h2>
              </div>
              <div className="px-6 py-5">
                <ApprovalFlowTracker
                  currentStep={detail.currentStep ?? 1}
                  status={detail.status}
                  steps={flowSteps}
                />
              </div>
            </Card>

            {/* 审批记录列表 */}
            {detailRecords.length > 0 && (
              <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h2 className="text-sm font-bold text-slate-900">审批记录</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {detailRecords.map((r, i) => {
                    const result = String(r.approveResult ?? '');
                    const isApproved = result === 'APPROVED';
                    const isRejected = result === 'REJECTED';
                    const approverId = r.approverId as number | undefined;
                    const approverName = approverId != null ? (userNameMapRes?.get(approverId) ?? `用户${approverId}`) : '—';
                    return (
                      <div key={i} className="flex items-start gap-4 px-6 py-4">
                        <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                          isApproved ? 'bg-emerald-100' : isRejected ? 'bg-red-100' : 'bg-slate-100'
                        }`}>
                          {isApproved ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
                           isRejected ? <XCircle className="h-4 w-4 text-red-600" /> :
                           <Clock className="h-4 w-4 text-slate-400" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">{approverName}</span>
                            <span className={`text-xs font-medium ${isApproved ? 'text-emerald-600' : isRejected ? 'text-red-600' : 'text-slate-400'}`}>
                              {isApproved ? '已通过' : isRejected ? '已驳回' : '待处理'}
                            </span>
                          </div>
                          {r.approveOpinion && (
                            <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
                              <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" />
                              {String(r.approveOpinion)}
                            </p>
                          )}
                          {r.approveTime && (
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {String(r.approveTime).replace('T', ' ').substring(0, 16)}
                            </p>
                          )}
                        </div>
                        <span className="flex-shrink-0 text-xs text-slate-400">
                          步骤 {String(r.stepNo ?? '')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* ── 右侧：操作面板（sticky） ── */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">

            {/* 快速操作卡 */}
            {canApprove && (
              <Card className="overflow-hidden rounded-2xl border-blue-200/60 shadow-sm shadow-blue-100/50">
                <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3">
                  <h3 className="text-sm font-bold text-blue-900">审批操作</h3>
                  <p className="mt-0.5 text-xs text-blue-600/80">此流程等待您的审批</p>
                </div>
                <div className="space-y-3 p-5">
                  <Button
                    className="w-full justify-center bg-emerald-600 text-white hover:bg-emerald-700"
                    size="lg"
                    disabled={approveMutation.isPending}
                    onClick={() => setApproveDialogOpen(true)}
                  >
                    {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    审批通过
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-center border-red-200 text-red-600 hover:bg-red-50"
                    size="lg"
                    disabled={rejectMutation.isPending}
                    onClick={() => setRejectDialogOpen(true)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    驳回申请
                  </Button>
                </div>
              </Card>
            )}

            {/* 发起人操作 */}
            {canCancel && (
              <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
                <div className="p-5">
                  <Button
                    variant="outline"
                    className="w-full justify-center"
                    disabled={cancelMutation.isPending}
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    {cancelMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    取消申请
                  </Button>
                </div>
              </Card>
            )}

            {/* 终态提示 */}
            {isTerminal && (
              <Card className={`overflow-hidden rounded-2xl border shadow-sm ${
                detail.status === 'APPROVED' ? 'border-emerald-200' :
                detail.status === 'REJECTED' ? 'border-red-200' :
                'border-slate-200'
              }`}>
                <div className={`px-5 py-4 text-center ${
                  detail.status === 'APPROVED' ? 'bg-emerald-50' :
                  detail.status === 'REJECTED' ? 'bg-red-50' :
                  'bg-slate-50'
                }`}>
                  {detail.status === 'APPROVED' ? (
                    <>
                      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                      <p className="mt-2 text-sm font-bold text-emerald-800">审批已通过</p>
                      <p className="mt-0.5 text-xs text-emerald-600">流程已全部完成</p>
                    </>
                  ) : detail.status === 'REJECTED' ? (
                    <>
                      <XCircle className="mx-auto h-8 w-8 text-red-500" />
                      <p className="mt-2 text-sm font-bold text-red-800">审批已驳回</p>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mx-auto h-8 w-8 text-slate-400" />
                      <p className="mt-2 text-sm font-bold text-slate-700">审批已取消</p>
                    </>
                  )}
                </div>
              </Card>
            )}

            {/* 流程概要信息卡 */}
            <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
              <div className="border-b border-slate-100 px-5 py-3">
                <h3 className="text-xs font-bold text-slate-500">流程概要</h3>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">总步骤</span>
                  <span className="text-sm font-bold text-slate-800">{flowSteps.length} 步</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">已完成</span>
                  <span className="text-sm font-bold text-emerald-600">
                    {flowSteps.filter(s => s.record?.result === 'APPROVED').length} 步
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">已驳回</span>
                  <span className="text-sm font-bold text-red-600">
                    {flowSteps.filter(s => s.record?.result === 'REJECTED').length} 步
                  </span>
                </div>
                {/* 进度条 */}
                {flowSteps.length > 0 && (
                  <div className="mt-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          detail.status === 'REJECTED' ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.round(
                            (flowSteps.filter(s => s.record?.result === 'APPROVED' || s.record?.result === 'REJECTED').length / flowSteps.length) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ── 底部固定操作栏（移动端/审批中时展示） ── */}
      {canApprove && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] backdrop-blur-sm lg:hidden">
          <div className="mx-auto flex max-w-[600px] items-center gap-3">
            <Button
              className="flex-1 justify-center bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={approveMutation.isPending}
              onClick={() => setApproveDialogOpen(true)}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />通过
            </Button>
            <Button
              variant="outline"
              className="flex-1 justify-center border-red-200 text-red-600 hover:bg-red-50"
              disabled={rejectMutation.isPending}
              onClick={() => setRejectDialogOpen(true)}
            >
              <XCircle className="mr-1.5 h-4 w-4" />驳回
            </Button>
          </div>
        </div>
      )}

      {/* ── 通过弹窗 ── */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审批通过</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-sm text-emerald-800">
                确认通过 <span className="font-bold">{detail.processNo ?? `审批 #${approvalId}`}</span> ？
              </p>
            </div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              审批意见 <span className="text-xs text-slate-400">（选填）</span>
            </label>
            <textarea
              className="min-h-[80px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              maxLength={500}
              placeholder="可填写审批意见..."
            />
            <p className="mt-1 text-right text-xs text-slate-400">{approveComment.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>取消</Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              {approveMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />处理中...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />确认通过</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 驳回弹窗 ── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回申请</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">
                确认驳回 <span className="font-bold">{detail.processNo ?? `审批 #${approvalId}`}</span>？
              </p>
            </div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              驳回原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={500}
              placeholder="请输入驳回原因（必填）..."
            />
            <p className="mt-1 text-right text-xs text-slate-400">{rejectReason.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>取消</Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
            >
              {rejectMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />提交中...</>
              ) : (
                <><XCircle className="mr-2 h-4 w-4" />确认驳回</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 取消确认弹窗 ── */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消申请</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <p className="text-sm text-slate-600">
              确定要取消 <span className="font-bold">{detail.processNo ?? `审批 #${approvalId}`}</span> 吗？取消后流程将终止。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>返回</Button>
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              {cancelMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />处理中...</>
              ) : (
                <><RotateCcw className="mr-2 h-4 w-4" />确认取消</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── 信息字段组件 ──────────────────────────────────────────────────────────────

function InfoField({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400">{icon}</span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
