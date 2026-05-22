import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Undo2, Info, MapPin, User, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { getDisposalDetail, type DisposalType, type DisposalStatus } from '@/api/disposal';

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
  return (
    <span className="px-3 py-1 bg-blue-100 text-blue-600 text-[10px] font-semibold uppercase tracking-wider rounded-full border border-blue-600/10 flex items-center">
      <span className="w-2 h-2 rounded-full bg-blue-600 mr-2" />
      {status}
    </span>
  );
}

function ApprovalTimeline({ steps }: { steps: { label: string; time: string; operator: string; comment?: string; status: 'done' | 'active' | 'pending' }[] }) {
  return (
    <div className="relative space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#c2c6d5]">
      {steps.map((step) => (
        <div key={step.label} className={`relative flex items-start ${step.status === 'pending' ? 'opacity-50' : ''}`}>
          <div className={`absolute left-0 w-6 h-6 rounded-full flex items-center justify-center z-10 ${
            step.status === 'done'
              ? 'bg-green-100 border-2 border-green-600'
              : step.status === 'active'
                ? 'bg-[#d8e2ff] border-2 border-[#004191] animate-pulse'
                : 'bg-[#e3e8f8] border-2 border-[#c2c6d5]'
          }`}>
            {step.status === 'done' && (
              <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {step.status === 'active' && (
              <div className="w-2 h-2 rounded-full bg-[#004191]" />
            )}
            {step.status === 'pending' && (
              <div className="w-2 h-2 rounded-full bg-[#c2c6d5]" />
            )}
          </div>
          <div className="ml-10">
            <div className="flex items-center justify-between mb-1">
              <h4 className={`text-sm font-bold ${step.status === 'active' ? 'text-[#004191]' : ''}`}>{step.label}</h4>
              {step.time ? (
                <span className="text-xs text-[#424753]">{step.time}</span>
              ) : step.status === 'active' ? (
                <span className="text-xs text-[#004191] font-semibold">进行中...</span>
              ) : null}
            </div>
            {step.operator && (
              <p className={`text-xs font-semibold ${step.status === 'active' ? 'text-[#161c27]' : 'text-[#004191]'}`}>{step.operator}</p>
            )}
            {step.comment && (
              <p className="text-xs text-[#424753] mt-1 italic">"{step.comment}"</p>
            )}
            {step.status === 'pending' && !step.operator && (
              <p className="text-xs">待后续处理</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 根据处置状态推导审批步骤时间线
 */
function buildApprovalSteps(status: DisposalStatus) {
  const steps = [
    { label: '申请提交', time: '', operator: '', status: 'pending' as const },
    { label: '部门审批', time: '', operator: '', status: 'pending' as const },
    { label: '财务审批', time: '', operator: '', status: 'pending' as const },
    { label: '执行完成', time: '', operator: '', status: 'pending' as const },
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
    steps[2].status = 'done';
  }

  return steps;
}

export default function DisposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ['disposal', id],
    queryFn: async () => {
      const res = await getDisposalDetail(Number(id));
      return res.data.data;
    },
    enabled: !!id,
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
        <div className="col-span-12 lg:col-span-9 space-y-6">
          <Card>
            <CardContent className="p-6">
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

          <Card>
            <CardContent className="p-6">
              <h3 className="text-base font-semibold text-[#004191] mb-6 flex items-center gap-2">
                <Info className="w-5 h-5" />
                处置信息
              </h3>
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
        </div>

        <div className="col-span-12 lg:col-span-3 space-y-6">
          <Card>
            <CardContent className="p-6 sticky top-[5.5rem]">
              <h3 className="text-base font-semibold text-[#004191] mb-6">审批流程</h3>
              <ApprovalTimeline steps={approvalSteps} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 right-0 left-0 bg-white border-t border-[#e5e7eb] p-4 z-40 shadow-lg" style={{ marginLeft: '16rem' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4">
          <div className="flex items-center gap-2 text-[#424753]">
            <span className="text-xs">创建于 {detail.createdAt}</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="secondary" size="md" onClick={() => navigate('/disposals')}>
              返回列表
            </Button>
             <Button variant="outline" size="md" onClick={() => navigate(-1)}>
               <Undo2 className="w-4 h-4" />
               返回上一页
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
