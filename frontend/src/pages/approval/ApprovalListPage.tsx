import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  ListFilter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';

type ApprovalTab = 'pending' | 'submitted' | 'completed';

interface ApprovalRecord {
  id: string;
  orderNo: string;
  title: string;
  type: string;
  typeLabel: string;
  typeColor: string;
  applicantName: string;
  applicantAvatar?: string;
  submittedAt: string;
  status: string;
  statusLabel: string;
  statusBg: string;
  statusColor: string;
  canApprove: boolean;
}

const MOCK_DATA: ApprovalRecord[] = [
  {
    id: '1', orderNo: 'ASSET-20231024-001', title: '总部IT部门笔记本电脑批量转移',
    type: 'transfer', typeLabel: '资产转移', typeColor: 'bg-[#2563eb]/10 text-[#2563eb] border-[#2563eb]/20',
    applicantName: '张伟', submittedAt: '2023-10-24 09:15',
    status: 'pending', statusLabel: '审批中', statusBg: 'bg-[#dbeafe]', statusColor: 'text-[#2563eb]',
    canApprove: true,
  },
  {
    id: '2', orderNo: 'DISP-20231023-088', title: '上海分拨中心旧款叉车资产清退',
    type: 'dispose', typeLabel: '资产清退', typeColor: 'bg-[#d4e0f9] text-[#576378] border-[#576378]/10',
    applicantName: '李娜', submittedAt: '2023-10-23 14:30',
    status: 'approved', statusLabel: '已通过', statusBg: 'bg-[#dcfce7]', statusColor: 'text-[#16a34a]',
    canApprove: false,
  },
  {
    id: '3', orderNo: 'MAINT-20231022-015', title: '中央空调机组三季度深度维保申请',
    type: 'maintenance', typeLabel: '维保申请', typeColor: 'bg-[#fef3c7] text-[#d97706] border-[#d97706]/10',
    applicantName: '王强', submittedAt: '2023-10-22 11:20',
    status: 'rejected', statusLabel: '已驳回', statusBg: 'bg-[#ffdad6]', statusColor: 'text-[#ba1a1a]',
    canApprove: false,
  },
  {
    id: '4', orderNo: 'ASSET-20231021-042', title: '生产车间机械臂位移调整申请',
    type: 'transfer', typeLabel: '资产转移', typeColor: 'bg-[#2563eb]/10 text-[#2563eb] border-[#2563eb]/20',
    applicantName: '赵敏', submittedAt: '2023-10-21 16:45',
    status: 'pending', statusLabel: '审批中', statusBg: 'bg-[#dbeafe]', statusColor: 'text-[#2563eb]',
    canApprove: true,
  },
  {
    id: '5', orderNo: 'DISP-20231020-005', title: '报废打印机及办公耗材清退',
    type: 'dispose', typeLabel: '资产清退', typeColor: 'bg-[#d4e0f9] text-[#576378] border-[#576378]/10',
    applicantName: '孙磊', submittedAt: '2023-10-20 10:05',
    status: 'approved', statusLabel: '已通过', statusBg: 'bg-[#dcfce7]', statusColor: 'text-[#16a34a]',
    canApprove: false,
  },
];

const TABS: { key: ApprovalTab; label: string }[] = [
  { key: 'pending', label: '待我审批' },
  { key: 'submitted', label: '我发起的' },
  { key: 'completed', label: '已审批' },
];

const SUMMARY_CARDS = [
  { label: '待审批', value: 12, icon: ClipboardCheck, bg: 'bg-[#004191]/10', color: 'text-[#004191]' },
  { label: '已通过', value: 89, icon: CheckCircle2, bg: 'bg-[#dcfce7]/50', color: 'text-[#16a34a]' },
  { label: '已驳回', value: 3, icon: XCircle, bg: 'bg-[#ffdad6]/50', color: 'text-[#ba1a1a]' },
];

export default function ApprovalListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ApprovalTab>('pending');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['approvals', activeTab, filterType, filterStatus, page],
    queryFn: async () => {
      // TODO: replace with real API call
      return { data: { records: MOCK_DATA, total: 12 } };
    },
    staleTime: 1000 * 30,
    placeholderData: (p) => p,
  });

  const records = (data as any)?.data?.records ?? [];
  const total = (data as any)?.data?.total ?? 0;

  return (
    <div className="min-h-screen">
      <div className="mb-6">
        <PageHeader
          title="审批中心"
          breadcrumbs={[{ label: '仪表板', href: '/dashboard' }, { label: '审批中心' }]}
        />

        <div className="flex border-b border-[#e5e7eb] gap-8">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-2 py-3 text-sm font-semibold relative transition-colors ${
                activeTab === tab.key
                  ? 'text-[#004191]'
                  : 'text-[#424753] hover:text-[#004191]'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#004191]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {SUMMARY_CARDS.map((card) => (
          <Card key={card.label} className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-[#424753] mb-1">{card.label}</p>
              <h3 className={`text-xl font-bold ${card.color}`}>{card.value}</h3>
            </div>
            <div className={`w-12 h-12 rounded-full ${card.bg} flex items-center justify-center ${card.color}`}>
              <card.icon className="w-6 h-6" />
            </div>
          </Card>
        ))}
      </div>

      <div className="bg-[#f1f3ff] p-4 rounded mb-3 flex flex-wrap items-center gap-4 border border-[#e5e7eb]/50">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-wide text-[#424753]">类型</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-white border border-[#c2c6d5] text-sm rounded px-3 py-1.5 focus:ring-[#004191] focus:border-[#004191]"
          >
            <option value="all">全部类型</option>
            <option value="transfer">资产转移</option>
            <option value="dispose">资产清退</option>
            <option value="maintenance">维保申请</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-wide text-[#424753]">状态</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-[#c2c6d5] text-sm rounded px-3 py-1.5 focus:ring-[#004191] focus:border-[#004191]"
          >
            <option value="all">全部状态</option>
            <option value="pending">审批中</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-wide text-[#424753]">日期范围</span>
          <input type="date" className="bg-white border border-[#c2c6d5] text-sm rounded px-3 py-1.5" />
          <span className="text-[#424753]">至</span>
          <input type="date" className="bg-white border border-[#c2c6d5] text-sm rounded px-3 py-1.5" />
        </div>
        <button className="ml-auto flex items-center gap-2 bg-[#004191] text-white px-5 py-2 rounded text-sm font-semibold hover:opacity-90 transition-opacity">
          <ListFilter className="w-5 h-5" />
          重置筛选
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f1f3ff] border-b border-[#e5e7eb]">
                <th className="px-6 py-4 text-sm font-semibold text-[#424753]">申请编号</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#424753]">标题</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#424753]">类型</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#424753]">发起人</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#424753]">发起时间</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#424753]">状态</th>
                <th className="px-6 py-4 text-sm font-semibold text-[#424753]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {records.map((row: ApprovalRecord) => (
                <tr key={row.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-6 py-4 text-sm text-[#004191] font-bold">{row.orderNo}</td>
                  <td className="px-6 py-4 text-sm">{row.title}</td>
                  <td className="px-6 py-4">
                    <span className={`${row.typeColor} border px-3 py-1 rounded-full text-xs font-medium`}>
                      {row.typeLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#d4e0f9] flex items-center justify-center text-[10px] font-bold text-[#004191]">
                        {row.applicantName.charAt(0)}
                      </div>
                      <span className="text-sm">{row.applicantName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-[#424753]">{row.submittedAt}</td>
                  <td className="px-6 py-4">
                    <span className={`${row.statusBg} ${row.statusColor} border border-current/10 px-3 py-1 rounded-full text-xs font-medium`}>
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      {row.canApprove && (
                        <button
                          className="text-[#004191] hover:underline text-sm font-semibold"
                          onClick={() => navigate(`/approvals/${row.id}`)}
                        >
                          审批
                        </button>
                      )}
                      <button
                        className="text-[#424753] hover:text-[#161c27] transition-colors text-sm font-semibold"
                        onClick={() => navigate(`/approvals/${row.id}`)}
                      >
                        查看
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-[#f1f3ff] border-t border-[#e5e7eb] flex items-center justify-between">
          <span className="text-xs text-[#424753]">显示 1 到 5 项，共 {total} 项待审批</span>
          <div className="flex items-center gap-2">
            <button
              className="p-1 hover:bg-[#dee2f2] rounded transition-colors disabled:opacity-30"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold ${
                  page === p ? 'bg-[#004191] text-white' : 'hover:bg-[#dee2f2]'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              className="p-1 hover:bg-[#dee2f2] rounded transition-colors"
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
