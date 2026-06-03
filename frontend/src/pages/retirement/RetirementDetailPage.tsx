/**
 * @file pages/retirement/RetirementDetailPage.tsx
 * @description 退役申请详情页 — 强化视觉层次：资产摘要、退役原因、审批状态、历史记录分区清晰
 * @module pages/retirement
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Check, RotateCcw, Package, Clock, DollarSign, FileText,
  MapPin, AlertTriangle, ChevronRight, Loader2, History, User,
  CalendarDays, Tag, Building2, Hash,
} from 'lucide-react';
import {
  getRetirementDetail,
  withdrawRetirement,
  approveRetirement,
  rejectRetirement,
  type RetirementApplication,
  type RetirementStatus,
} from '@/api/retirement';
import { getAssetById } from '@/api/asset';
import type { Asset } from '@/types/asset';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';

/** 退役状态视觉配置：标签、配色方案 */
const STATUS_CONFIG: Record<
  RetirementStatus,
  { label: string; variant: 'gray' | 'default' | 'warning' | 'success' | 'danger' | 'purple'; color: string; iconBg: string }
> = {
  DRAFT:     { label: '草稿',   variant: 'gray',    color: 'bg-gray-100 text-gray-600 border-gray-200',     iconBg: 'bg-gray-200' },
  PENDING:   { label: '待审批', variant: 'default', color: 'bg-blue-50 text-blue-700 border-blue-200',      iconBg: 'bg-blue-100' },
  APPROVING: { label: '审批中', variant: 'warning', color: 'bg-amber-50 text-amber-700 border-amber-200',   iconBg: 'bg-amber-100' },
  APPROVED:  { label: '已通过', variant: 'success', color: 'bg-green-50 text-green-700 border-green-200',   iconBg: 'bg-green-100' },
  REJECTED:  { label: '已驳回', variant: 'danger',  color: 'bg-red-50 text-red-700 border-red-200',         iconBg: 'bg-red-100' },
  WITHDRAWN: { label: '已撤回', variant: 'gray',    color: 'bg-gray-100 text-gray-600 border-gray-200',     iconBg: 'bg-gray-200' },
  COMPLETED: { label: '已完成', variant: 'purple',  color: 'bg-purple-50 text-purple-700 border-purple-200', iconBg: 'bg-purple-100' },
};

/** SectionCard: 统一的分区卡片组件 */
function SectionCard({
  icon,
  iconColor,
  title,
  children,
  accent,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.05)] overflow-hidden">
      <div className={`flex items-center gap-2.5 px-6 py-3.5 border-b ${accent ?? 'border-gray-100'}`}>
        <span className={`flex items-center justify-center w-6 h-6 rounded-md ${iconColor}`}>
          {icon}
        </span>
        <h2 className="text-sm font-bold text-gray-900 tracking-wide">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/** InfoField: 统一的键值对展示组件 */
function InfoField({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
        {icon}{label}
      </p>
      <div className="text-sm text-gray-900">{value ?? '—'}</div>
    </div>
  );
}

/** TimelineStep: 审批进度时间线节点 */
function TimelineStep({
  label,
  operator,
  time,
  status,
  comment,
  isLast,
}: {
  label: string;
  operator?: string;
  time?: string;
  status: 'done' | 'active' | 'pending';
  comment?: string;
  isLast: boolean;
}) {
  const dotClass = {
    done: 'bg-green-600 border-green-600',
    active: 'bg-blue-600 border-blue-300 shadow-[0_0_0_4px_rgba(59,130,246,0.15)]',
    pending: 'bg-gray-300 border-gray-300',
  }[status];

  const iconContent = {
    done: <Check className="w-3.5 h-3.5 text-white" />,
    active: <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />,
    pending: <span className="w-2 h-2 rounded-full bg-gray-400" />,
  }[status];

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 ${dotClass}`}>
          {iconContent}
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 mt-1 ${status === 'done' ? 'bg-green-300' : 'bg-gray-200'}`} style={{ minHeight: 28 }} />
        )}
      </div>
      <div className={`flex-1 pb-5 ${status === 'active' ? 'bg-blue-50/50 rounded-lg p-3 -mt-1 mb-1 border border-blue-100' : ''}`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${status === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>
            {label}
          </span>
          <div className="flex items-center gap-2">
            {status === 'active' && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                当前步骤
              </span>
            )}
            {time && <span className="text-xs text-gray-400">{time}</span>}
          </div>
        </div>
        {operator && (
          <p className={`text-xs mt-0.5 ${status === 'pending' ? 'text-gray-300' : 'text-gray-500'}`}>
            {operator}
          </p>
        )}
        {comment && (
          <p className="text-xs text-gray-500 mt-1 bg-white/80 rounded px-2 py-1">
            {comment}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * RetirementDetailPage — 退役申请详情页主组件。
 * 视觉层次分为：① 资产摘要卡 ② 退役原因 & 申请信息 ③ 审批状态时间线 ④ 操作按钮。
 * 布局采用响应式两栏，小屏自动堆叠。
 */
export default function RetirementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const retirementId = Number(id);

  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  /** 查询退役申请详情 */
  const { data: res, isLoading } = useQuery({
    queryKey: ['retirement', 'detail', retirementId],
    queryFn: () => getRetirementDetail(retirementId),
    enabled: !!retirementId,
    staleTime: 1000 * 30,
  });

  const record: RetirementApplication = res as unknown as RetirementApplication | undefined;

  /** 查询关联资产详情 */
  const { data: assetRes } = useQuery({
    queryKey: ['asset', 'detail', record?.assetId],
    queryFn: () => getAssetById(record!.assetId),
    enabled: !!record?.assetId,
    staleTime: 1000 * 60,
  });
  const asset = assetRes as unknown as Asset | undefined;

  /** 撤回操作 mutation */
  const withdrawMutation = useMutation({
    mutationFn: () => withdrawRetirement(retirementId),
    onSuccess: () => {
      setWithdrawDialog(false);
      qc.invalidateQueries({ queryKey: ['retirement'] });
    },
  });

  /** 审批通过 mutation */
  const approveMutation = useMutation({
    mutationFn: () => approveRetirement(retirementId),
    onSuccess: () => {
      toast.success('审批通过');
      qc.invalidateQueries({ queryKey: ['retirement'] });
    },
    onError: (err: Error) => toast.error(err.message || '审批操作失败，请重试'),
  });

  /** 驳回操作 mutation */
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectRetirement(retirementId, reason),
    onSuccess: () => {
      toast.success('已驳回');
      setRejectDialog(false);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['retirement'] });
    },
    onError: (err: Error) => toast.error(err.message || '驳回操作失败，请重试'),
  });

  /* ── Loading skeleton ─────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  /* ── Empty state ──────────────────────────────────────── */
  if (!record) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">未找到该退役申请记录</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/retirement')}>
          返回列表
        </Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[record.status];
  const canWithdraw = record.status === 'PENDING' || record.status === 'DRAFT';
  const isTerminal = record.status === 'APPROVED' || record.status === 'REJECTED' || record.status === 'WITHDRAWN' || record.status === 'COMPLETED';

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ── Page Header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <p className="text-xs text-gray-500">退役管理 / 申请详情</p>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                退役申请 #{retirementId}
              </h1>
              {statusCfg && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
              )}
            </div>
          </div>
        </div>
        {canWithdraw && (
          <Button variant="outline" size="sm" onClick={() => setWithdrawDialog(true)}>
            <RotateCcw className="w-4 h-4" /> 撤回申请
          </Button>
        )}
      </div>

      {/* ── Main content: 2-column responsive layout ────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">

        {/* ── Left column ────────────────────────────────── */}
        <div className="space-y-6">

          {/* ① 资产摘要卡 — 视觉最突出 */}
          {asset && (
            <SectionCard
              icon={<Package className="w-3.5 h-3.5 text-emerald-600" />}
              iconColor="bg-emerald-50"
              title="关联资产摘要"
              accent="border-emerald-100"
            >
              {/* 资产名称 & 编号 hero 区域 */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Package className="w-7 h-7 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 truncate">{asset.assetName ?? asset.name ?? '—'}</h3>
                  <p className="text-sm text-blue-600 font-semibold mt-0.5">{asset.assetNo ?? '—'}</p>
                </div>
              </div>

              {/* 资产核心指标 grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-gray-100">
                <InfoField
                  label="分类"
                  value={
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 px-2 py-0.5 rounded">
                      <Tag className="w-3 h-3 text-gray-400" />
                      {asset.categoryName ?? '未分类'}
                    </span>
                  }
                />
                <InfoField
                  label="状态"
                  value={asset.status ?? '—'}
                />
                <InfoField
                  label="存放位置"
                  value={(
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      {asset.locationName ?? asset.location ?? '—'}
                    </span>
                  )}
                  icon={<MapPin className="w-3 h-3" />}
                />
                <InfoField
                  label="购入价格"
                  value={
                    asset.purchasePrice != null || asset.originalValue != null
                      ? <span className="font-semibold">¥{(Number(asset.purchasePrice ?? asset.originalValue)).toLocaleString()}</span>
                      : '—'
                  }
                  icon={<DollarSign className="w-3 h-3" />}
                />
              </div>

              {/* 第二行指标 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                <InfoField
                  label="使用部门"
                  value={asset.deptName ?? '—'}
                  icon={<Building2 className="w-3 h-3" />}
                />
                <InfoField
                  label="使用人"
                  value={asset.userName ?? '—'}
                  icon={<User className="w-3 h-3" />}
                />
                <InfoField
                  label="规格型号"
                  value={asset.model ?? '—'}
                />
                <InfoField
                  label="购置日期"
                  value={asset.purchaseDate?.substring(0, 10) ?? '—'}
                  icon={<CalendarDays className="w-3 h-3" />}
                />
              </div>

              {/* 查看资产详情链接 */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  onClick={() => navigate(`/assets/${record.assetId}`)}
                >
                  查看资产详情
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </SectionCard>
          )}

          {/* ② 退役原因 & 申请信息 — 原因突出展示 */}
          <SectionCard
            icon={<FileText className="w-3.5 h-3.5 text-blue-600" />}
            iconColor="bg-blue-50"
            title="退役原因 & 申请信息"
            accent="border-blue-100"
          >
            {/* 退役原因 — 视觉强调 */}
            <div className="bg-amber-50/60 border border-amber-200/60 rounded-lg p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                退役原因
              </p>
              <p className="text-sm text-gray-800 leading-relaxed font-medium">
                {record.reason ?? '—'}
              </p>
            </div>

            {/* 申请元数据 */}
            <div className="grid grid-cols-2 gap-4 mt-5">
              <InfoField label="申请编号" value={<span className="font-mono">#{record.id}</span>} icon={<Hash className="w-3 h-3" />} />
              <InfoField label="申请人" value={record.applicantName} icon={<User className="w-3 h-3" />} />
              <InfoField label="申请时间" value={record.createdAt?.substring(0, 16)} icon={<CalendarDays className="w-3 h-3" />} />
              <InfoField label="更新时间" value={record.updatedAt?.substring(0, 16)} icon={<CalendarDays className="w-3 h-3" />} />
            </div>

            {/* 预计残值 */}
            {record.residualValue != null && (
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3 bg-green-50/40 rounded-lg px-4 py-3 -mx-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-100">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">预计残值</p>
                  <p className="text-lg font-bold text-gray-900">
                    ¥{Number(record.residualValue).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </SectionCard>

          {/* ③ 历史记录 — 终态时展示 */}
          {isTerminal && record.approvalRecords && record.approvalRecords.length > 0 && (
            <SectionCard
              icon={<History className="w-3.5 h-3.5 text-gray-600" />}
              iconColor="bg-gray-100"
              title="历史记录"
            >
              <div className="space-y-3">
                {record.approvalRecords.map((r) => {
                  const actionLabel = r.action === 'APPROVE' ? '审批通过' : '审批驳回';
                  const actionColor = r.action === 'APPROVE'
                    ? 'text-green-700 bg-green-50 border-green-200'
                    : 'text-red-700 bg-red-50 border-red-200';
                  return (
                    <div
                      key={r.id}
                      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${actionColor}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{actionLabel}</span>
                          {r.operatorName && (
                            <span className="text-xs text-gray-500">by {r.operatorName}</span>
                          )}
                        </div>
                        {(r.comment ?? r.rejectionReason) && (
                          <p className="text-xs text-gray-600 mt-1">{r.comment ?? r.rejectionReason}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5">
                        {r.createdAt?.substring(0, 16)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>

        {/* ── Right column: 审批状态 & 操作 ──────────────── */}
        <div className="space-y-6">

          {/* ③ 审批进度时间线 */}
          <SectionCard
            icon={<Clock className="w-3.5 h-3.5 text-blue-600" />}
            iconColor="bg-blue-50"
            title="审批状态"
            accent="border-blue-100"
          >
            {/* 当前状态大号展示 */}
            {statusCfg && (
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusCfg.iconBg}`}>
                  {record.status === 'APPROVED' || record.status === 'COMPLETED'
                    ? <Check className="w-5 h-5 text-green-600" />
                    : record.status === 'REJECTED'
                      ? <AlertTriangle className="w-5 h-5 text-red-500" />
                      : record.status === 'APPROVING'
                        ? <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        : <Clock className="w-5 h-5 text-gray-500" />}
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{statusCfg.label}</p>
                  <p className="text-xs text-gray-400">
                    {record.updatedAt?.substring(0, 16) ?? record.createdAt?.substring(0, 16) ?? ''}
                  </p>
                </div>
              </div>
            )}

            {/* 时间线 */}
            {record.approvalRecords && record.approvalRecords.length > 0 ? (
              <div className="space-y-0">
                {record.approvalRecords.map((r, i) => (
                  <TimelineStep
                    key={r.id}
                    label={r.action === 'APPROVE' ? '审批通过' : r.action === 'REJECT' ? '审批驳回' : '审批操作'}
                    operator={r.operatorName}
                    time={r.createdAt?.substring(0, 16)}
                    status={
                      r.action === 'APPROVE' ? 'done' :
                      r.action === 'REJECT' ? 'done' :
                      r.action === 'PENDING' ? 'active' : 'pending'
                    }
                    comment={r.comment ?? r.rejectionReason}
                    isLast={i === record.approvalRecords!.length - 1}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400 text-sm">暂无审批记录</div>
            )}
          </SectionCard>

          {/* ④ 操作按钮区 */}
          {(canWithdraw || record.status === 'APPROVING') && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-4 flex gap-3">
              {record.status === 'APPROVING' && (
                <>
                  <Button
                    className="flex-1"
                    size="md"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate()}
                  >
                    {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    通过审批
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    size="md"
                    disabled={rejectMutation.isPending}
                    onClick={() => { setRejectReason(''); setRejectDialog(true); }}
                  >
                    {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                    驳回
                  </Button>
                </>
              )}
              {canWithdraw && (
                <Button
                  variant="outline"
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                  size="md"
                  onClick={() => setWithdrawDialog(true)}
                >
                  <RotateCcw className="w-4 h-4" /> 撤回申请
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Withdraw dialog ──────────────────────────────── */}
      <Dialog open={withdrawDialog} onOpenChange={setWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>撤回退役申请</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <p className="text-sm text-gray-500">
              确定要撤回该退役申请吗？撤回后申请将变为「已撤回」状态。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialog(false)}>取消</Button>
            <Button
              variant="destructive"
              loading={withdrawMutation.isPending}
              onClick={() => withdrawMutation.mutate()}
            >
              确认撤回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject dialog ────────────────────────────────── */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回退役申请</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              驳回原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请填写驳回原因（必填，最多 500 字）..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none"
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{rejectReason.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>取消</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              loading={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(rejectReason)}
            >
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
