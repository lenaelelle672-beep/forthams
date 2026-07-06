import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Undo2, Info, MapPin, User, Lightbulb, CheckCircle2, XCircle, AlertTriangle, Clock, FileText, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { getDisposalDetail, type DisposalType, type DisposalStatus } from '@/api/disposal';
import { approveItem, rejectItem } from '@/api/approval';
import { toast } from 'sonner';

/** 处置类型中文映射 */
const DISPOSAL_TYPE_LABEL: Record<DisposalType, string> = {
  TRANSFER: '调拨',
  CLEARANCE: '清退',
  SCRAP: '报废',
};

/** 处置状态中文映射 */
const STATUS_LABEL: Record<DisposalStatus, string> = {
  PENDING: '待审批',
  APPROVED: '已审批',
  REJECTED: '已拒绝',
  COMPLETED: '已完成',
};

/**
 * 状态徽章组件 — 根据处置状态渲染不同颜色的圆点标签
 */
function StatusBadge({ status }: { status: string }) {
  if (status === '待审批') {
    return (
      <span className="px-3 py-1 bg-amber-100 text-amber-600 text-[10px] font-semibold uppercase tracking-wider rounded-full border border-amber-600/10 flex items-center">
        <span className="w-2 h-2 rounded-full bg-amber-600 mr-2" />
        待审批
      </span>
    );
  }
  if (status === '已完成') {
    return (
      <span className="px-3 py-1 bg-green-100 text-green-600 text-[10px] font-semibold uppercase tracking-wider rounded-full border border-green-600/10 flex items-center">
        <span className="w-2 h-2 rounded-full bg-green-600 mr-2" />
        已完成
      </span>
    );
  }
  if (status === '已拒绝') {
    return (
      <span className="px-3 py-1 bg-red-100 text-red-600 text-[10px] font-semibold uppercase tracking-wider rounded-full border border-red-600/10 flex items-center">
        <span className="w-2 h-2 rounded-full bg-red-600 mr-2" />
        已拒绝
      </span>
    );
  }
  return (
    <span className="px-3 py-1 bg-blue-100 text-blue-600 text-[10px] font-semibold uppercase tracking-wider rounded-full border border-blue-600/10 flex items-center">
      <span className="w-2 h-2 rounded-full bg-blue-600 mr-2" />
      {status}
    </span>
  );
}

/** 审批步骤类型：完成 / 当前 / 待处理 / 已驳回 */
type ApprovalStepStatus = 'done' | 'active' | 'pending' | 'rejected';

/** 单条审批步骤数据结构 */
type ApprovalStep = {
  label: string;
  time: string;
  operator: string;
  comment?: string;
  status: ApprovalStepStatus;
};

/**
 * 审批时间线组件 — 以垂直时间线形式展示审批节点
 * 支持 done（完成，绿色对勾）、active（当前，蓝色脉冲）、rejected（驳回，红色叉号）、pending（待处理，灰色）四种状态
 */
function ApprovalTimeline({ steps }: { steps: ApprovalStep[] }) {
  return (
    <div className="relative space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#c2c6d5]">
      {steps.map((step, idx) => {
        /** 连接线颜色：如果当前步骤是 rejected，则到该步骤的线段变红 */
        const lineColor =
          step.status === 'rejected'
            ? 'bg-red-400'
            : step.status === 'done'
              ? 'bg-green-400'
              : 'bg-[#c2c6d5]';

        return (
          <div key={`${step.label}-${idx}`} className={`relative flex items-start ${step.status === 'pending' ? 'opacity-50' : ''}`}>
            {/* 节点圆点 */}
            <div
              className={`absolute left-0 w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                step.status === 'done'
                  ? 'bg-green-100 border-2 border-green-600'
                  : step.status === 'active'
                    ? 'bg-[#d8e2ff] border-2 border-[#004191] animate-pulse'
                    : step.status === 'rejected'
                      ? 'bg-red-100 border-2 border-red-500'
                      : 'bg-[#e3e8f8] border-2 border-[#c2c6d5]'
              }`}
            >
              {step.status === 'done' && (
                <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {step.status === 'active' && (
                <div className="w-2 h-2 rounded-full bg-[#004191]" />
              )}
              {step.status === 'rejected' && (
                <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {step.status === 'pending' && (
                <div className="w-2 h-2 rounded-full bg-[#c2c6d5]" />
              )}
            </div>

            {/* 步骤内容 */}
            <div className="ml-10 flex-1">
              <div className="flex items-center justify-between mb-1">
                <h4 className={`text-sm font-bold ${
                  step.status === 'active' ? 'text-[#004191]' : step.status === 'rejected' ? 'text-red-600' : ''
                }`}>
                  {step.label}
                </h4>
                {step.time ? (
                  <span className="text-xs text-[#424753] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {step.time}
                  </span>
                ) : step.status === 'active' ? (
                  <span className="text-xs text-[#004191] font-semibold">进行中...</span>
                ) : null}
              </div>
              {step.operator && (
                <p className={`text-xs font-semibold ${step.status === 'active' ? 'text-[#161c27]' : 'text-[#004191]'}`}>{step.operator}</p>
              )}
              {step.comment && (
                <p className="text-xs text-[#424753] mt-1 italic bg-gray-50 px-2 py-1 rounded">"{step.comment}"</p>
              )}
              {step.status === 'rejected' && (
                <div className="mt-2 flex items-start gap-1.5 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-red-700">该审批节点已驳回</span>
                </div>
              )}
              {step.status === 'pending' && !step.operator && (
                <p className="text-xs text-[#424753]">待后续处理</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 风险说明卡片 — 根据处置类型展示对应风险提示
 */
function RiskNotice({ type }: { type: DisposalType }) {
  const riskMap: Record<DisposalType, { label: string; detail: string }> = {
    TRANSFER: {
      label: '调拨风险提示',
      detail: '资产调拨将变更归属部门，请确认接收部门已做好资产登记准备。调拨完成后原部门不得继续使用该资产。',
    },
    CLEARANCE: {
      label: '清退风险提示',
      detail: '资产清退为不可逆操作，清退后资产将从台账中移除。请确认已做好资产验收与残值评估。',
    },
    SCRAP: {
      label: '报废风险提示',
      detail: '资产报废后无法恢复，需确保已完成残值回收与环保处置。报废审批通过后资产状态将永久标记为已报废。',
    },
  };
  const risk = riskMap[type];
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
      <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs font-semibold text-amber-800 mb-0.5">{risk.label}</p>
        <p className="text-xs text-amber-700 leading-relaxed">{risk.detail}</p>
      </div>
    </div>
  );
}

/**
 * 根据处置状态推导审批步骤时间线。
 * REJECTED 状态时，标记财务审批节点为 rejected，其余已通过节点标记为 done。
 */
function buildApprovalSteps(status: DisposalStatus): ApprovalStep[] {
  const steps: ApprovalStep[] = [
    { label: '申请提交', time: '', operator: '', status: 'pending' },
    { label: '部门审批', time: '', operator: '', status: 'pending' },
    { label: '财务审批', time: '', operator: '', status: 'pending' },
    { label: '执行完成', time: '', operator: '', status: 'pending' },
  ];

  if (status === 'PENDING') {
    steps[0].status = 'done';
    steps[1].status = 'active';
  } else if (status === 'APPROVED') {
    steps[0].status = 'done';
    steps[1].status = 'done';
    steps[2].status = 'done';
    steps[3].status = 'active';
  } else if (status === 'COMPLETED') {
    steps.forEach((s) => { s.status = 'done'; });
  } else if (status === 'REJECTED') {
    steps[0].status = 'done';
    steps[1].status = 'done';
    steps[2].status = 'rejected';
    // steps[3] remains pending — 审批流程在此终止
  }

  return steps;
}

/**
 * 处置详情页 — 展示处置详情、审批时间线、风险说明和操作区
 */
export default function DisposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ['disposal', id],
    queryFn: () => getDisposalDetail(Number(id)),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => approveItem(Number(id), {}),
    onSuccess: () => {
      toast.success('审批通过');
      qc.invalidateQueries({ queryKey: ['disposal', id] });
    },
    onError: () => toast.error('审批操作失败，请重试'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectItem(Number(id), { rejectionReason: '不符合处置条件' }),
    onSuccess: () => {
      toast.success('已驳回申请');
      qc.invalidateQueries({ queryKey: ['disposal', id] });
    },
    onError: () => toast.error('驳回操作失败，请重试'),
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#004191] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#424753]">加载处置详情...</span>
        </div>
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-sm text-[#ba1a1a]">加载失败，请重试</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/disposals')}>
            返回列表
          </Button>
        </div>
      </div>
    );
  }

  const statusLabel = STATUS_LABEL[detail.status] ?? detail.status;
  const typeLabel = DISPOSAL_TYPE_LABEL[detail.type] ?? detail.type;
  const approvalSteps = buildApprovalSteps(detail.status);

  return (
    <div className="p-6 min-h-screen pb-24">
      <PageHeader
        title=""
        breadcrumbs={[
          { label: '资产管理' },
          { label: '处置详情' },
        ]}
      />

      {/* 页面标题与状态 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#424753] hover:bg-[#f1f3ff] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-bold text-[#161c27] leading-8">资产处置详情</h2>
            <StatusBadge status={statusLabel} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 左侧主内容区 */}
        <div className="col-span-12 lg:col-span-9 space-y-6">

          {/* 区块一：基本信息 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#e5e7eb]">
                <FileText className="w-4 h-4 text-[#004191]" />
                <h3 className="text-sm font-semibold text-[#004191]">基本信息</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">处置编号</p>
                  <p className="text-sm font-semibold text-[#161c27]">DISP-{detail.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">处置类型</p>
                  <span className="px-2 py-0.5 bg-[#d4e0f9] text-[#38485d] text-xs rounded border border-[#38485d]/10">{typeLabel}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">申请日期</p>
                  <p className="text-sm font-semibold text-[#161c27]">{detail.createdAt}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">申请人</p>
                  <p className="text-sm font-semibold text-[#161c27]">{detail.applicantName ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">当前状态</p>
                  <p className="text-sm font-semibold text-[#2563eb]">{statusLabel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">资产编号</p>
                  <p className="text-sm font-semibold text-[#161c27]">{detail.assetNo ?? '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 区块二：处置详情 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#e5e7eb]">
                <Info className="w-4 h-4 text-[#004191]" />
                <h3 className="text-sm font-semibold text-[#004191]">处置详情</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start p-4 bg-[#f1f3ff]/20 rounded-lg">
                  <MapPin className="w-5 h-5 text-[#004191] mr-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">处置类型</p>
                    <p className="text-sm font-semibold">{typeLabel}</p>
                  </div>
                </div>
                <div className="flex items-start p-4 bg-[#f1f3ff]/20 rounded-lg">
                  <User className="w-5 h-5 text-[#004191] mr-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">申请人</p>
                    <p className="text-sm font-semibold">{detail.applicantName ?? '—'}</p>
                  </div>
                </div>
                <div className="col-span-full flex items-start p-4 bg-[#f1f3ff]/20 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-[#004191] mr-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">处置原因</p>
                    <p className="text-sm font-semibold">{detail.reason ?? '—'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 区块三：风险说明 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#e5e7eb]">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-[#004191]">风险说明</h3>
              </div>
              <RiskNotice type={detail.type} />
            </CardContent>
          </Card>
        </div>

        {/* 右侧：审批流程时间线 */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <Card>
            <CardContent className="p-6 sticky top-[5.5rem]">
              <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#e5e7eb]">
                <Clock className="w-4 h-4 text-[#004191]" />
                <h3 className="text-sm font-semibold text-[#004191]">审批流程</h3>
              </div>
              <ApprovalTimeline steps={approvalSteps} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 底部操作栏 — 主次按钮分区 */}
      <div className="fixed bottom-0 right-0 left-0 bg-white border-t border-[#e5e7eb] p-4 z-40 shadow-lg" style={{ marginLeft: '16rem' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4">
          <div className="flex items-center gap-2 text-[#424753]">
            <span className="text-xs">创建于 {detail.createdAt}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* 次要操作组 — 导航按钮 */}
            <div className="flex items-center gap-2 mr-2 pr-3 border-r border-[#e5e7eb]">
              <Button variant="secondary" size="md" onClick={() => navigate('/disposals')}>
                返回列表
              </Button>
              <Button variant="outline" size="md" onClick={() => navigate(-1)}>
                <Undo2 className="w-4 h-4" />
                返回上一页
              </Button>
            </div>
            {/* 主要操作组 — 审批按钮（仅 PENDING 时显示） */}
            {detail.status === 'PENDING' && (
              <>
                <Button
                  variant="primary"
                  size="md"
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate()}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  审批通过
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  loading={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate()}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4" />
                  驳回申请
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
