import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Undo2, ArrowRight, Info, MapPin, User, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

interface DisposalAsset {
  assetNo: string;
  assetName: string;
  category: string;
  brandModel: string;
  originalValue: number;
  netValue: number;
  disposalStatus: string;
}

interface ApprovalStep {
  label: string;
  time: string;
  operator: string;
  comment?: string;
  status: 'done' | 'active' | 'pending';
}

interface DisposalDetail {
  disposalNo: string;
  disposalType: string;
  applyDate: string;
  applicant: string;
  currentStatus: string;
  createdTime: string;
  assets: DisposalAsset[];
  transferTarget: string;
  custodian: string;
  reason: string;
  approvalSteps: ApprovalStep[];
  lastUpdated: string;
  overallStatus: string;
}

async function fetchDisposalDetail(id: string): Promise<DisposalDetail> {
  // TODO: Replace with actual API call — GET /api/disposals/:id
  return {
    disposalNo: `DISP-2024-${String(Number(id)).padStart(4, '0')}`,
    disposalType: '调拨',
    applyDate: '2024-05-20',
    applicant: '张三',
    currentStatus: '财务审批中',
    createdTime: '2024-05-20 09:30',
    assets: [
      { assetNo: 'AST-9921', assetName: 'Precision Lathe X1', category: '生产设备', brandModel: 'Siemens S2000', originalValue: 125000, netValue: 45000, disposalStatus: '待移交' },
      { assetNo: 'AST-4402', assetName: 'Server Cluster', category: 'IT基础设施', brandModel: 'Dell PowerEdge R740', originalValue: 88000, netValue: 22000, disposalStatus: '待移交' },
      { assetNo: 'AST-1088', assetName: 'Workstation Pro', category: '办公设备', brandModel: 'HP Z6 G4', originalValue: 12500, netValue: 5200, disposalStatus: '待移交' },
    ],
    transferTarget: '研发中心 (上海分公司)',
    custodian: '赵六',
    reason: '资源优化：分公司研发项目启动，总部相关闲置生产及计算设备调至分公司用于初期测试与生产环境搭建。',
    approvalSteps: [
      { label: '申请提交', time: '2024-05-20 09:30', operator: '张三', comment: '资产已达使用年限，申请调拨至分公司。', status: 'done' },
      { label: '部门审批', time: '2024-05-20 11:20', operator: '李四 (部门经理)', comment: '审批通过，请财务核算价值。', status: 'done' },
      { label: '财务审批', time: '', operator: '王五 (财务主管)', status: 'active' },
      { label: '执行完成', time: '', operator: '', status: 'pending' },
    ],
    lastUpdated: '2024-05-20 11:20:45',
    overallStatus: '待审批',
  };
}

function formatCurrency(value: number) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

function ApprovalTimeline({ steps }: { steps: ApprovalStep[] }) {
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

export default function DisposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ['disposal', id],
    queryFn: () => fetchDisposalDetail(id!),
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
            <StatusBadge status={detail.overallStatus} />
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
                  <p className="text-sm font-semibold text-[#161c27]">{detail.disposalNo}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">处置类型</p>
                  <span className="px-2 py-0.5 bg-[#d4e0f9] text-[#38485d] text-xs rounded border border-[#38485d]/10">{detail.disposalType}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">申请日期</p>
                  <p className="text-sm font-semibold text-[#161c27]">{detail.applyDate}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">申请人</p>
                  <p className="text-sm font-semibold text-[#161c27]">{detail.applicant}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">当前状态</p>
                  <p className="text-sm font-semibold text-[#2563eb]">{detail.currentStatus}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">创建时间</p>
                  <p className="text-sm font-semibold text-[#161c27]">{detail.createdTime}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="bg-[#f1f3ff]/30">
              <CardTitle className="text-[#004191]">处置资产列表</CardTitle>
              <span className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">共 {detail.assets.length} 项资产</span>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#f1f3ff] text-[10px] text-[#424753] uppercase tracking-wider">
                    <th className="px-6 py-3 font-semibold">资产编号</th>
                    <th className="px-6 py-3 font-semibold">资产名称</th>
                    <th className="px-6 py-3 font-semibold">分类</th>
                    <th className="px-6 py-3 font-semibold">品牌/型号</th>
                    <th className="px-6 py-3 font-semibold text-right">原值 (¥)</th>
                    <th className="px-6 py-3 font-semibold text-right">净值 (¥)</th>
                    <th className="px-6 py-3 font-semibold text-center">处置状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb]">
                  {detail.assets.map((asset) => (
                    <tr key={asset.assetNo} className="hover:bg-[#f1f3ff]/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-[#004191]">{asset.assetNo}</td>
                      <td className="px-6 py-4 text-sm">{asset.assetName}</td>
                      <td className="px-6 py-4 text-sm">{asset.category}</td>
                      <td className="px-6 py-4 text-sm text-[#424753]">{asset.brandModel}</td>
                      <td className="px-6 py-4 text-sm text-right">{formatCurrency(asset.originalValue)}</td>
                      <td className="px-6 py-4 text-sm text-right">{formatCurrency(asset.netValue)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-0.5 bg-[#dbeafe] text-[#2563eb] text-xs rounded border border-[#2563eb]/10">
                          {asset.disposalStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                    <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">调拨目标</p>
                    <p className="text-sm font-semibold">{detail.transferTarget}</p>
                  </div>
                </div>
                <div className="flex items-start p-4 bg-[#f1f3ff]/20 rounded-lg">
                  <User className="w-5 h-5 text-[#004191] mr-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">资产保管人</p>
                    <p className="text-sm font-semibold">{detail.custodian}</p>
                  </div>
                </div>
                <div className="col-span-full flex items-start p-4 bg-[#f1f3ff]/20 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-[#004191] mr-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-[#424753] uppercase tracking-wider font-semibold">调拨原因</p>
                    <p className="text-sm font-semibold">{detail.reason}</p>
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
              <ApprovalTimeline steps={detail.approvalSteps} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 right-0 left-0 bg-white border-t border-[#e5e7eb] p-4 z-40 shadow-lg" style={{ marginLeft: '16rem' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4">
          <div className="flex items-center gap-2 text-[#424753]">
            <span className="text-xs">最后更新于 {detail.lastUpdated}</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="secondary" size="md" onClick={() => navigate('/disposals')}>
              返回列表
            </Button>
            <Button variant="outline" size="md" onClick={() => navigate(-1)}>
              <Undo2 className="w-4 h-4" />
              撤回申请
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
