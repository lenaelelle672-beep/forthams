import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getWorkflowRuntimePendingCount,
  getWorkflowRuntimeSlaSummary,
  listWorkflowRuntimeSlaTimeoutRecords,
  listWorkflowRuntime,
  type WorkflowRuntimePage,
  type WorkflowRuntimeProcess,
  type WorkflowRuntimeSlaSummary,
  type WorkflowRuntimeSlaTimeoutRecord,
} from '../../api/workflowRuntime';

type SystemRuntimeMonitorWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type RuntimeStatusFilter = 'all' | 'pending' | 'completed' | 'returned';

const RUNTIME_STATUS = {
  pending: 'PENDING',
  completed: 'APPROVED',
  returned: 'REJECTED',
} as const;

function backendStatus(filter: RuntimeStatusFilter) {
  if (filter === 'pending') {
    return RUNTIME_STATUS.pending;
  }
  if (filter === 'completed') {
    return RUNTIME_STATUS.completed;
  }
  if (filter === 'returned') {
    return RUNTIME_STATUS.returned;
  }
  return undefined;
}

function statusLabel(status: string | null | undefined) {
  const value = String(status ?? '').trim().toUpperCase();
  if (value === RUNTIME_STATUS.pending) {
    return '待处理';
  }
  if (value === RUNTIME_STATUS.completed) {
    return '已完成';
  }
  if (value === RUNTIME_STATUS.returned) {
    return '已退回';
  }
  return value || '未知';
}

function emptyRuntimePage(): WorkflowRuntimePage {
  return { records: [], total: 0, size: 50, current: 1, pages: 0 };
}

function emptySlaSummary(): WorkflowRuntimeSlaSummary {
  return {
    totalConfigs: 0,
    activeConfigs: 0,
    overdueCount: 0,
    warningCount: 0,
    criticalCount: 0,
    timeoutRecordCount: 0,
    riskCounts: {},
    nodeDurationSummary: [],
    abnormalTraceSummary: [],
    recentTimeoutRecords: [],
    exportMaskingNotice: 'SLA 导出仅展示脱敏摘要。',
    readOnly: true,
    tenantScoped: true,
  };
}

export default function SystemRuntimeMonitorWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemRuntimeMonitorWorkbenchPageProps) {
  const [runtimePage, setRuntimePage] = useState<WorkflowRuntimePage>(emptyRuntimePage);
  const [pendingCount, setPendingCount] = useState(0);
  const [slaSummary, setSlaSummary] = useState<WorkflowRuntimeSlaSummary>(emptySlaSummary);
  const [slaTimeoutRecords, setSlaTimeoutRecords] = useState<WorkflowRuntimeSlaTimeoutRecord[]>([]);
  const [processTypeInput, setProcessTypeInput] = useState('');
  const [activeProcessType, setActiveProcessType] = useState('');
  const [statusFilter, setStatusFilter] = useState<RuntimeStatusFilter>('all');
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadRuntime = async (status: RuntimeStatusFilter = statusFilter, processType = activeProcessType) => {
    setLoading(true);
    setError(null);
    try {
      const [nextPage, nextPendingCount, nextSlaSummary, nextSlaTimeoutRecords] = await Promise.all([
        listWorkflowRuntime({ page: 1, pageSize: 50, status: backendStatus(status), processType }),
        getWorkflowRuntimePendingCount(),
        getWorkflowRuntimeSlaSummary(),
        listWorkflowRuntimeSlaTimeoutRecords({ status: 'OPEN' }),
      ]);
      setRuntimePage(nextPage);
      setPendingCount(nextPendingCount);
      setSlaSummary(nextSlaSummary);
      setSlaTimeoutRecords(nextSlaTimeoutRecords);
    } catch {
      setRuntimePage(emptyRuntimePage());
      setPendingCount(0);
      setSlaSummary(emptySlaSummary());
      setSlaTimeoutRecords([]);
      setError('运行监控加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadRuntime('all', '');
  }, [canView]);

  const records = useMemo<WorkflowRuntimeProcess[]>(() => runtimePage.records ?? [], [runtimePage.records]);
  const nodeDurationSummary = slaSummary.nodeDurationSummary ?? [];
  const abnormalTraceSummary = slaSummary.abnormalTraceSummary ?? [];

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextProcessType = processTypeInput.trim();
    setActiveProcessType(nextProcessType);
    void loadRuntime(statusFilter, nextProcessType);
  };

  const handleStatusChange = (nextStatus: RuntimeStatusFilter) => {
    setStatusFilter(nextStatus);
    void loadRuntime(nextStatus, activeProcessType);
  };

  const handleReload = () => {
    void loadRuntime(statusFilter, activeProcessType);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问运行监控，请确认 system:runtime:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">运行监控</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示 /approvals/list、/approvals/pending/count、/sla-config/runtime-summary 与 /sla-config/timeout-records 返回的审批实例、SLA 风险摘要和超时记录。</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
          type="button"
          onClick={handleReload}
        >
          重新加载
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">待处理数量</h3>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">当前页实例</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{records.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-medium text-slate-500">总实例</h3>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{runtimePage.total ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">SLA 超时</p>
          <p className="mt-2 text-2xl font-semibold text-red-600">{slaSummary.overdueCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">SLA 预警</p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{slaSummary.warningCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">高风险轨迹</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{slaSummary.criticalCount ?? 0}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        SLA 只读边界：节点耗时、异常轨迹、超时记录和导出提示均来自 SLA 摘要接口；本页不提供通过、驳回、重试、终止或业务状态修改动作。
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="runtime-process-type">流程类型</label>
        <input
          id="runtime-process-type"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按流程类型筛选"
          value={processTypeInput}
          onChange={(event) => setProcessTypeInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="runtime-status-filter">状态筛选</label>
        <select
          id="runtime-status-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={statusFilter}
          onChange={(event) => handleStatusChange(event.target.value as RuntimeStatusFilter)}
        >
          <option value="all">全部状态</option>
          <option value="pending">待处理</option>
          <option value="completed">已完成</option>
          <option value="returned">已退回</option>
        </select>
        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loading}
          type="submit"
        >
          搜索
        </button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">运行监控加载中...</div> : null}
      {!loading && !error && records.length === 0 ? (
        <h3 className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-medium text-slate-500">暂无审批实例。</h3>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">审批实例列表</h4>
          <span className="text-xs text-slate-500">第 {runtimePage.current ?? 1} / {runtimePage.pages ?? 0} 页</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">流程编号</th>
                <th scope="col" className="py-2 pr-3">流程类型</th>
                <th scope="col" className="py-2 pr-3">业务 ID</th>
                <th scope="col" className="py-2 pr-3">当前步骤</th>
                <th scope="col" className="py-2 pr-3">状态</th>
                <th scope="col" className="py-2 pr-3">申请人</th>
                <th scope="col" className="py-2 pr-3">发起时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{record.processNo ?? `#${record.id}`}</td>
                  <td className="py-2 pr-3 text-slate-600">{record.processType ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.businessId ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.currentStep ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{statusLabel(record.status)}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.applicantId ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.applyTime ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h4 className="mb-3 font-semibold">SLA 节点耗时</h4>
          {nodeDurationSummary.length === 0 ? <h3 className="text-sm font-medium text-slate-500">暂无节点耗时异常。</h3> : null}
          <ul className="space-y-2 text-sm text-slate-600">
            {nodeDurationSummary.map((item) => <li key={item} className="rounded-xl bg-slate-50 px-3 py-2">{item}</li>)}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h4 className="mb-3 font-semibold">SLA 异常轨迹</h4>
          {abnormalTraceSummary.length === 0 ? <h3 className="text-sm font-medium text-slate-500">暂无异常轨迹。</h3> : null}
          <ul className="space-y-2 text-sm text-slate-600">
            {abnormalTraceSummary.map((item) => <li key={item} className="rounded-xl bg-slate-50 px-3 py-2">{item}</li>)}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h4 className="mb-3 font-semibold">超时记录与脱敏导出提示</h4>
          <p className="text-sm text-slate-500">{slaSummary.exportMaskingNotice ?? '导出仅返回 masked/summary 字段。'}</p>
          <div className="mt-3 space-y-2">
            {slaTimeoutRecords.length === 0 ? <h3 className="text-sm font-medium text-slate-500">暂无超时记录。</h3> : null}
            {slaTimeoutRecords.slice(0, 3).map((record) => (
              <div key={record.id} className="rounded-xl border border-slate-100 px-3 py-2 text-sm text-slate-600">
                <p className="font-medium">{record.processKey ?? '-'} / {record.nodeKey ?? '-'}</p>
                <p className="text-xs text-slate-500">{record.maskedBusinessSummary ?? '业务摘要已脱敏'} · {record.riskLevel ?? 'UNKNOWN'} · {record.timeoutMinutes ?? 0} 分钟</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
