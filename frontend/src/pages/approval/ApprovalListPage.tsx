import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  ListFilter,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  getApprovalList,
  getPendingApprovals,
  getPendingCount,
  approveItem,
  rejectItem,
  getApprovalDetail,
} from '@/api/approval';
import type { ApprovalItem } from '@/api/approval';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';

type ApprovalTab = 'pending' | 'submitted' | 'completed';

const TABS: { key: ApprovalTab; label: string }[] = [
  { key: 'pending', label: '待我审批' },
  { key: 'submitted', label: '我发起的' },
  { key: 'completed', label: '已审批' },
];

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: '审批中', bg: 'bg-[#dbeafe]', color: 'text-[#2563eb]' },
  APPROVING: { label: '审批中', bg: 'bg-[#dbeafe]', color: 'text-[#2563eb]' },
  IN_PROGRESS: { label: '审批中', bg: 'bg-[#dbeafe]', color: 'text-[#2563eb]' },
  APPROVED: { label: '已通过', bg: 'bg-[#dcfce7]', color: 'text-[#16a34a]' },
  REJECTED: { label: '已驳回', bg: 'bg-[#ffdad6]', color: 'text-[#ba1a1a]' },
  CANCELLED: { label: '已取消', bg: 'bg-[#f1f3ff]', color: 'text-[#64748b]' },
};

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  transfer: { label: '资产转移', color: 'bg-[#2563eb]/10 text-[#2563eb] border-[#2563eb]/20' },
  dispose: { label: '资产清退', color: 'bg-[#d4e0f9] text-[#576378] border-[#576378]/10' },
  maintenance: { label: '维保申请', color: 'bg-[#fef3c7] text-[#d97706] border-[#d97706]/10' },
};

const PAGE_SIZE = 10;

export default function ApprovalListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ApprovalTab>('pending');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [rejectDialogId, setRejectDialogId] = useState<number | null>(null);
  const [rejectDialogVersion, setRejectDialogVersion] = useState<number>(0);
  const [rejectReason, setRejectReason] = useState('');

  // Derive the status query param from activeTab + filterStatus
  const queryStatus = activeTab === 'pending' ? 'PENDING' : activeTab === 'completed' ? 'APPROVED' : filterStatus !== 'all' ? filterStatus.toUpperCase() : undefined;

  // ── Pending count for summary cards ──
  const { data: pendingCountRes } = useQuery({
    queryKey: ['approvals', 'pending-count'],
    queryFn: () => getPendingCount(),
    staleTime: 1000 * 30,
  });
  const pendingCount = (pendingCountRes as ApiResponse<number> | undefined)?.data ?? 0;

  // ── Approval list ──
  const statusParam = filterStatus !== 'all' ? filterStatus.toUpperCase() : queryStatus;
  const { data, isLoading } = useQuery({
    queryKey: ['approvals', activeTab, filterType, statusParam, page],
    queryFn: () =>
      getApprovalList({
        status: statusParam,
        page,
        pageSize: PAGE_SIZE,
      }),
    staleTime: 1000 * 30,
    placeholderData: (p) => p,
  });

  const records: ApprovalItem[] = (data as PaginatedResponse<ApprovalItem> | undefined)?.data?.records ?? [];
  const total: number = (data as PaginatedResponse<ApprovalItem> | undefined)?.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Approve mutation ──
  const approveMutation = useMutation({
    mutationFn: ({ id, version }: { id: number; version: number }) =>
      approveItem(id, { version }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
  });

  // ── Reject mutation ──
  const rejectMutation = useMutation({
    mutationFn: ({ id, version, reason }: { id: number; version: number; reason: string }) =>
      rejectItem(id, { version, rejectionReason: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      setRejectDialogId(null);
      setRejectReason('');
    },
  });

  // ── Detail query ──
  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['approvals', 'detail', detailId],
    queryFn: () => getApprovalDetail(detailId!),
    enabled: detailId !== null,
  });
  const detail: ApprovalItem | null = (detailRes as ApiResponse<ApprovalItem> | undefined)?.data ?? null;

  const handleTabChange = (tab: ApprovalTab) => {
    setActiveTab(tab);
    setPage(1);
    setFilterStatus('all');
  };

  // Summary cards — use real pending count, other cards derive from list total
  const summaryCards = [
    { label: '待审批', value: pendingCount, icon: ClipboardCheck, bg: 'bg-[#004191]/10', color: 'text-[#004191]' },
    { label: '已通过', value: activeTab === 'completed' ? total : '-', icon: CheckCircle2, bg: 'bg-[#dcfce7]/50', color: 'text-[#16a34a]' },
    { label: '已驳回', value: '-', icon: XCircle, bg: 'bg-[#ffdad6]/50', color: 'text-[#ba1a1a]' },
  ];

  const getStatusInfo = (status: string) =>
    STATUS_MAP[status] ?? { label: status, bg: 'bg-[#f1f3ff]', color: 'text-[#64748b]' };

  const getTypeInfo = (type: string) =>
    TYPE_MAP[type] ?? { label: type, color: 'bg-[#f1f3ff] text-[#64748b] border-[#e5e7eb]' };

  const canApproveRow = (row: ApprovalItem) =>
    row.status === 'PENDING' || row.status === 'APPROVING' || row.status === 'IN_PROGRESS';

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
              onClick={() => handleTabChange(tab.key)}
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {summaryCards.map((card) => (
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

      {/* Filters */}
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

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#004191]" />
          </div>
        ) : (
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
                {records.map((row) => {
                  const statusInfo = getStatusInfo(row.status);
                  const typeInfo = getTypeInfo(row.businessType ?? row.status);
                  const approvable = canApproveRow(row);
                  return (
                    <tr key={row.id} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-6 py-4 text-sm text-[#004191] font-bold">{row.id}</td>
                      <td className="px-6 py-4 text-sm">{row.title}</td>
                      <td className="px-6 py-4">
                        <span className={`${typeInfo.color} border px-3 py-1 rounded-full text-xs font-medium`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#d4e0f9] flex items-center justify-center text-[10px] font-bold text-[#004191]">
                            {(row.applicantName ?? '-').charAt(0)}
                          </div>
                          <span className="text-sm">{row.applicantName ?? '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-[#424753]">{row.createdAt ?? row.submittedAt ?? '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`${statusInfo.bg} ${statusInfo.color} border border-current/10 px-3 py-1 rounded-full text-xs font-medium`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          {approvable && (
                            <>
                              <button
                                className="text-[#16a34a] hover:underline text-sm font-semibold disabled:opacity-50"
                                disabled={approveMutation.isPending}
                                onClick={() => approveMutation.mutate({ id: row.id, version: row.version })}
                              >
                                {approveMutation.isPending ? '处理中...' : '通过'}
                              </button>
                              <button
                                className="text-[#ba1a1a] hover:underline text-sm font-semibold"
                                onClick={() => { setRejectDialogId(row.id); setRejectReason(''); setRejectDialogVersion(row.version); }}
                              >
                                驳回
                              </button>
                            </>
                          )}
                          <button
                            className="text-[#424753] hover:text-[#161c27] transition-colors text-sm font-semibold"
                            onClick={() => setDetailId(row.id)}
                          >
                            详情
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-[#64748b]">
                      暂无审批数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-6 py-4 bg-[#f1f3ff] border-t border-[#e5e7eb] flex items-center justify-between">
          <span className="text-xs text-[#424753]">
            显示 {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} 到 {Math.min(page * PAGE_SIZE, total)} 项，共 {total} 项
          </span>
          <div className="flex items-center gap-2">
            <button
              className="p-1 hover:bg-[#dee2f2] rounded transition-colors disabled:opacity-30"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = startPage + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold ${
                    page === p ? 'bg-[#004191] text-white' : 'hover:bg-[#dee2f2]'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="p-1 hover:bg-[#dee2f2] rounded transition-colors disabled:opacity-30"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </Card>

      {/* ── Reject dialog ── */}
      <Dialog open={rejectDialogId !== null} onOpenChange={(open) => { if (!open) setRejectDialogId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回审批</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <label className="block text-sm font-semibold text-[#424753] mb-2">驳回原因</label>
            <textarea
              className="w-full border border-[#c2c6d5] rounded px-3 py-2 text-sm focus:ring-[#004191] focus:border-[#004191] min-h-[100px]"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入驳回原因..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogId(null)}>取消</Button>
            <Button
              className="bg-[#ba1a1a] text-white hover:opacity-90"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => {
                if (rejectDialogId !== null) {
                  rejectMutation.mutate({ id: rejectDialogId, version: rejectDialogVersion, reason: rejectReason });
                }
              }}
            >
              {rejectMutation.isPending ? '提交中...' : '确认驳回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail dialog ── */}
      <Dialog open={detailId !== null} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审批详情</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-[#004191]" />
            </div>
          ) : detail ? (
            <div className="px-6 py-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold tracking-wide text-[#64748b] mb-1">编号</p>
                  <p className="font-semibold text-[#0f172a]">{detail.id}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-wide text-[#64748b] mb-1">标题</p>
                  <p className="font-semibold text-[#0f172a]">{detail.title}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-wide text-[#64748b] mb-1">发起人</p>
                  <p className="font-semibold text-[#0f172a]">{detail.applicantName ?? '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-wide text-[#64748b] mb-1">部门</p>
                  <p className="font-semibold text-[#0f172a]">{detail.deptName ?? '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-wide text-[#64748b] mb-1">状态</p>
                  <span className={`${getStatusInfo(detail.status).bg} ${getStatusInfo(detail.status).color} border border-current/10 px-3 py-1 rounded-full text-xs font-medium`}>
                    {getStatusInfo(detail.status).label}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-wide text-[#64748b] mb-1">提交时间</p>
                  <p className="font-semibold text-[#0f172a]">{detail.submittedAt ?? detail.createdAt ?? '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-wide text-[#64748b] mb-1">业务类型</p>
                  <p className="font-semibold text-[#0f172a]">{detail.businessType ?? '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-wide text-[#64748b] mb-1">业务ID</p>
                  <p className="font-semibold text-[#0f172a]">{detail.businessId ?? '-'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-sm text-[#64748b]">未找到审批详情</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
