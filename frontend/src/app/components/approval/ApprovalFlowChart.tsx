/**
 * @module frontend/src/app/components/approval/ApprovalFlowChart
 * @description Renders a visual flow chart of the approval history chain.
 */

import React from 'react';
import type { ApprovalHistoryItem, ApprovalItem, ApprovalRuntimePathStep } from '../../services/approval/types';
import { cn } from '../ui/utils';

type ApprovalHistoryLike = ApprovalHistoryItem | {
  id?: number | string;
  processId?: number | string;
  stepNo: number;
  operator?: number | string;
  operatorName?: string;
  status?: string;
  operatedAt?: string;
  comment?: string;
};

type ApprovalRuntimePathLike = ApprovalRuntimePathStep | {
  stepNo: number;
  nodeId?: string;
  nodeCode?: string;
  label?: string;
  approverRole?: string;
  approverRoleName?: string;
  approverType?: string;
  approverId?: number | string;
  approvalMode?: string;
};

type ApprovalLike = Partial<Omit<ApprovalItem, 'history' | 'status' | 'workflowRuntimePath'>> & {
  id?: number | string;
  processNo?: string | null;
  status?: string;
  currentStep?: number | null;
  workflowRuntimePath?: ApprovalRuntimePathLike[];
};

type RuntimeNodeState = 'completed' | 'current' | 'upcoming' | 'rejected' | 'cancelled' | 'ended';

type RuntimeStep = {
  kind: 'runtime';
  stepNo: number;
  status: RuntimeNodeState;
  records: ApprovalHistoryLike[];
  runtime: ApprovalRuntimePathLike;
};

type TimelineStep = RuntimeStep | {
  kind: 'record' | 'current';
  stepNo: number;
  status: RuntimeNodeState;
  records: ApprovalHistoryLike[];
};

export interface ApprovalFlowChartProps {
  /** Current approval process returned by the backend detail API. */
  approval?: ApprovalLike | null;
  /** Ordered list of approval history records (oldest -> newest). */
  approvalHistory: ApprovalHistoryLike[];
  /** Runtime path can be returned beside `process` in the detail container. */
  workflowRuntimePath?: ApprovalRuntimePathLike[];
  /** Optional visible title for detail pages. */
  title?: string;
}

function formatTime(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function normalizeRuntimeState(status?: string, isCurrent = false): RuntimeNodeState {
  const raw = String(status ?? '').trim();
  const normalized = raw.toLowerCase();
  if (['completed', 'current', 'upcoming', 'rejected', 'cancelled', 'ended'].includes(normalized)) {
    return normalized as RuntimeNodeState;
  }
  const upper = raw.toUpperCase();
  if (upper === 'APPROVED') return 'completed';
  if (upper === 'REJECTED') return 'rejected';
  if (upper === 'CANCELLED' || upper === 'CANCELED') return 'cancelled';
  if (upper === 'COMPLETED') return 'ended';
  if (['PENDING', 'APPROVING', 'IN_PROGRESS'].includes(upper)) return isCurrent ? 'current' : 'upcoming';
  return isCurrent ? 'current' : 'upcoming';
}

function statusLabel(status: RuntimeNodeState | string, isCurrent = false): string {
  switch (normalizeRuntimeState(status, isCurrent)) {
    case 'current':
      return '当前处理';
    case 'upcoming':
      return '待处理/未到达';
    case 'completed':
      return '已完成';
    case 'rejected':
      return '异常/驳回';
    case 'ended':
      return '已结束';
    case 'cancelled':
      return '已结束/已取消';
    default:
      return String(status);
  }
}

function statusClasses(status: RuntimeNodeState | string, isCurrent: boolean): string {
  const state = normalizeRuntimeState(status, isCurrent);
  if (state === 'completed') return isCurrent ? 'bg-emerald-500 text-white' : 'border-2 border-emerald-500 text-emerald-600';
  if (state === 'current') return 'bg-blue-500 text-white shadow-sm shadow-blue-100';
  if (state === 'rejected') return isCurrent ? 'bg-red-500 text-white' : 'border-2 border-red-500 text-red-600';
  if (state === 'cancelled') return isCurrent ? 'bg-rose-500 text-white' : 'border-2 border-rose-400 text-rose-600';
  if (state === 'ended') return isCurrent ? 'bg-slate-500 text-white' : 'border-2 border-slate-400 text-slate-600';
  if (state === 'upcoming') {
    return isCurrent ? 'border-2 border-dashed border-blue-300 text-blue-500' : 'border-2 border-dashed border-gray-300 text-gray-400';
  }
  return isCurrent ? 'bg-gray-500 text-white' : 'border-2 border-gray-200 text-gray-400';
}

function statusBadgeClasses(status: RuntimeNodeState | string) {
  const state = normalizeRuntimeState(status);
  if (state === 'completed') return 'bg-emerald-50 text-emerald-700';
  if (state === 'current') return 'bg-blue-50 text-blue-700';
  if (state === 'rejected') return 'bg-red-50 text-red-700';
  if (state === 'cancelled') return 'bg-rose-50 text-rose-700';
  if (state === 'ended') return 'bg-slate-100 text-slate-700';
  return 'bg-gray-50 text-gray-500';
}

function connectorClasses(status: RuntimeNodeState | string, isCurrent: boolean): string {
  const state = normalizeRuntimeState(status, isCurrent);
  if (state === 'completed') return 'bg-emerald-100';
  if (state === 'current') return 'bg-blue-100';
  if (state === 'upcoming') return 'bg-gray-100';
  if (state === 'rejected') return 'bg-red-100';
  if (state === 'cancelled') return 'bg-rose-100';
  if (state === 'ended') return 'bg-slate-200';
  return 'bg-gray-100';
}

function normalizeStepNo(value: unknown, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function groupRecordsByStep(history: ApprovalHistoryLike[]) {
  const grouped = new Map<number, ApprovalHistoryLike[]>();
  for (const record of [...(history || [])].sort((left, right) => left.stepNo - right.stepNo)) {
    const stepNo = normalizeStepNo(record.stepNo);
    grouped.set(stepNo, [...(grouped.get(stepNo) ?? []), record]);
  }
  return grouped;
}

function runtimeStepStatus(records: ApprovalHistoryLike[], approval: ApprovalLike, stepNo: number): RuntimeNodeState {
  const processStatus = String(approval.status ?? '').toUpperCase();
  const currentStep = normalizeStepNo(approval.currentStep, 0);
  if (records.some((record) => normalizeRuntimeState(record.status) === 'rejected')) return 'rejected';
  if (records.some((record) => normalizeRuntimeState(record.status) === 'cancelled')) return 'cancelled';
  if (stepNo === currentStep && processStatus === 'REJECTED') return 'rejected';
  if (stepNo === currentStep && (processStatus === 'CANCELLED' || processStatus === 'CANCELED')) return 'cancelled';
  if (['PENDING', 'APPROVING', 'IN_PROGRESS'].includes(processStatus) && stepNo === currentStep) return 'current';
  if (records.length > 0 && records.every((record) => normalizeRuntimeState(record.status) === 'completed')) return 'completed';
  if (['APPROVED', 'COMPLETED'].includes(processStatus)) return 'ended';
  return 'upcoming';
}

function makeRuntimeTimeline(
  approval: ApprovalLike | null | undefined,
  history: ApprovalHistoryLike[],
  runtimePathOverride?: ApprovalRuntimePathLike[],
): TimelineStep[] | null {
  const runtimePath = runtimePathOverride ?? approval?.workflowRuntimePath;
  if (!approval || !Array.isArray(runtimePath) || runtimePath.length === 0) return null;

  const recordsByStep = groupRecordsByStep(history);
  return [...runtimePath]
    .sort((left, right) => normalizeStepNo(left.stepNo) - normalizeStepNo(right.stepNo))
    .map((runtime) => {
      const stepNo = normalizeStepNo(runtime.stepNo);
      const records = recordsByStep.get(stepNo) ?? [];
      return {
        kind: 'runtime' as const,
        stepNo,
        status: runtimeStepStatus(records, approval, stepNo),
        records,
        runtime,
      };
    });
}

function makeTimeline(
  approval: ApprovalLike | null | undefined,
  history: ApprovalHistoryLike[],
  runtimePathOverride?: ApprovalRuntimePathLike[],
): TimelineStep[] {
  const runtimeTimeline = makeRuntimeTimeline(approval, history, runtimePathOverride);
  if (runtimeTimeline) return runtimeTimeline;
  const records = [...(history || [])].sort((left, right) => left.stepNo - right.stepNo);
  if (!approval) {
    return records.map((record) => ({ kind: 'record' as const, stepNo: record.stepNo, status: normalizeRuntimeState(record.status), records: [record] }));
  }

  const timeline: TimelineStep[] = records.map((record) => ({ kind: 'record' as const, stepNo: record.stepNo, status: normalizeRuntimeState(record.status), records: [record] }));
  const hasCurrentRecord = records.some((record) => record.stepNo === approval.currentStep);
  if (approval.status === 'PENDING' && !hasCurrentRecord) {
    timeline.push({ kind: 'current' as const, stepNo: approval.currentStep || 1, status: 'current', records: [] });
  }
  if (timeline.length === 0) {
    timeline.push({ kind: 'current' as const, stepNo: approval.currentStep || 1, status: normalizeRuntimeState(approval.status, true), records: [] });
  }
  return timeline.sort((left, right) => left.stepNo - right.stepNo);
}

function highlightedIndex(timeline: TimelineStep[]) {
  const pendingIndex = timeline.findIndex((item) => item.status === 'current');
  if (pendingIndex >= 0) return pendingIndex;
  const rejectedIndex = timeline.findIndex((item) => item.status === 'rejected' || item.status === 'cancelled');
  return rejectedIndex >= 0 ? rejectedIndex : timeline.length - 1;
}

function stepTitle(item: TimelineStep) {
  if (item.kind === 'runtime') {
    return item.runtime.label || `第${item.stepNo}级审批`;
  }
  return item.records[0] ? `第${item.stepNo}步审批` : '当前待处理节点';
}

function approvalModeLabel(mode?: string) {
  if (mode === 'any') return '或签';
  if (mode === 'all') return '会签';
  if (mode === 'sequence') return '顺序审批';
  return mode || '默认审批';
}

function handlerSummary(item: TimelineStep) {
  const record = item.records[0];
  const operatorName = record && 'operatorName' in record ? record.operatorName : undefined;
  if (operatorName) return operatorName;
  if (record?.operator != null && String(record.operator).trim()) return `操作人 #${record.operator}`;
  if (item.kind !== 'runtime') return '处理人待记录';

  if (item.status === 'upcoming') {
    if (item.runtime.approverRoleName) return `${item.runtime.approverRoleName}（待流转后确认）`;
    if (item.runtime.approverRole) return `角色 ${item.runtime.approverRole}（待流转后确认）`;
    return '待流转后确认';
  }
  if (item.runtime.approverType === 'user' && item.runtime.approverId) {
    return `指定用户 #${item.runtime.approverId}`;
  }
  if (item.runtime.approverRoleName) return item.runtime.approverRoleName;
  if (item.runtime.approverRole) return `角色 ${item.runtime.approverRole}`;
  return '处理人待解析';
}

function runtimeSummary(item: TimelineStep) {
  if (item.kind !== 'runtime') return null;
  const node = item.runtime.nodeCode ? `节点 ${item.runtime.nodeCode}` : '运行路径节点';
  return `${node} · ${handlerSummary(item)} · 审批模式：${approvalModeLabel(item.runtime.approvalMode)}`;
}

function sectionAnchor(item: TimelineStep) {
  return item.kind === 'runtime' && item.runtime.nodeId ? `workflow-section-${item.runtime.nodeId}` : undefined;
}

function stepKey(item: TimelineStep) {
  return item.kind === 'runtime' && item.runtime.nodeId ? `runtime-${item.runtime.nodeId}` : `${item.kind}-${item.stepNo}`;
}

function stepTooltip(item: TimelineStep, isActive: boolean) {
  const record = item.records[0];
  const summary = [
    `${stepTitle(item)}，第 ${item.stepNo} 步`,
    `状态：${statusLabel(item.status, isActive)}`,
    `处理人/角色：${handlerSummary(item)}`,
  ];
  if (item.kind === 'runtime') summary.push(`审批模式：${approvalModeLabel(item.runtime.approvalMode)}`);
  if (record?.comment) summary.push(`意见：${record.comment}`);
  if (record?.operatedAt) summary.push(`时间：${formatTime(record.operatedAt)}`);
  return summary.join('；');
}

const LEGEND = [
  { label: '已完成', className: 'bg-emerald-500' },
  { label: '当前处理', className: 'bg-blue-500' },
  { label: '待处理/未到达', className: 'border border-dashed border-gray-300 bg-white' },
  { label: '异常/驳回', className: 'bg-red-500' },
  { label: '已取消', className: 'bg-rose-500' },
  { label: '已结束', className: 'bg-slate-500' },
];

export const ApprovalFlowChart: React.FC<ApprovalFlowChartProps> = ({
  approval,
  approvalHistory,
  workflowRuntimePath,
  title,
}) => {
  const timeline = makeTimeline(approval, approvalHistory, workflowRuntimePath);
  const activeStepIndex = highlightedIndex(timeline);
  const defaultSelectedKey = timeline[activeStepIndex] ? stepKey(timeline[activeStepIndex]) : null;
  const [selectedStepKey, setSelectedStepKey] = React.useState<string | null>(defaultSelectedKey);
  React.useEffect(() => {
    setSelectedStepKey(defaultSelectedKey);
  }, [defaultSelectedKey]);
  const selectedStep = timeline.find((item) => stepKey(item) === (selectedStepKey ?? defaultSelectedKey))
    ?? timeline[activeStepIndex]
    ?? timeline[0]
    ?? null;

  if (timeline.length === 0) {
    return (
      <section aria-label={title ?? '运行态流程图'} className="flex flex-col">
        {title ? (
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            <p className="mt-1 text-xs text-gray-500">按后端运行路径展示节点状态、处理人和审批记录。</p>
          </div>
        ) : null}
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <svg
            className="mb-2 h-10 w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="text-sm">暂无审批流转数据</span>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={title ?? '运行态流程图'} className="flex flex-col">
      {title ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            <p className="mt-1 text-xs text-gray-500">悬停、点击或聚焦节点可查看步骤、处理人/角色、审批模式、意见和时间摘要。</p>
          </div>
          <div className="flex max-w-full flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
            {LEGEND.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full', item.className)} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col">
      {timeline.map((item, idx) => {
        const isLast = idx === timeline.length - 1;
        const isActive = idx === activeStepIndex;
        const isSelected = selectedStep ? stepKey(item) === stepKey(selectedStep) : false;
        const records = item.records;
        const key = records[0]?.id ? `record-${records[0].id}-step-${item.stepNo}` : `current-${item.stepNo}`;

        return (
          <div key={key} className="flex items-start" title={stepTooltip(item, isActive)} aria-label={stepTooltip(item, isActive)}>
            <div className="flex flex-col items-center">
              <button
                type="button"
                data-testid={`approval-flow-node-state-${item.status}-step-${item.stepNo}`}
                data-flow-state={item.status}
                data-step-no={item.stepNo}
                data-node-id={item.kind === 'runtime' ? item.runtime.nodeId : undefined}
                aria-pressed={isSelected}
                aria-controls="approval-flow-step-summary"
                onClick={() => setSelectedStepKey(stepKey(item))}
                onFocus={() => setSelectedStepKey(stepKey(item))}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2',
                  statusClasses(item.status, isActive),
                  isSelected && 'ring-2 ring-blue-200 ring-offset-2',
                )}
              >
                {item.stepNo}
              </button>

              {!isLast && (
                <div
                  data-testid={`approval-flow-connector-state-${item.status}-step-${item.stepNo}`}
                  data-flow-connector-state={item.status}
                  className={cn('h-full w-0.5', connectorClasses(item.status, isActive))}
                />
              )}
            </div>

            <div className={cn('ml-4 pb-6', isLast && 'pb-0')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(
                  'text-sm font-medium',
                  isActive ? 'text-gray-900' : 'text-gray-700',
                )}>
                  {stepTitle(item)}
                </span>

                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    statusBadgeClasses(item.status),
                  )}
                >
                  {statusLabel(item.status, isActive)}
                </span>
              </div>

              {records.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {records.map((record, recordIndex) => (
                    <div key={record.id ?? `${item.stepNo}-${recordIndex}`} className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-700">{handlerSummary({ ...item, records: [record] } as TimelineStep)}</span>
                        <span>{statusLabel(record.status ?? item.status)}</span>
                        {record.operatedAt ? <span>{formatTime(record.operatedAt)}</span> : null}
                      </div>
                      {record.comment ? <p className="mt-1 text-gray-500">{record.comment}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {records.length === 0 && approval ? (
                <p className="mt-1 text-sm text-gray-400">
                  {item.status === 'upcoming'
                    ? `第 ${item.stepNo} 步尚未开始。`
                    : `流程 ${approval.processNo || approval.id} 正在等待第 ${item.stepNo} 步审批。`}
                </p>
              ) : null}

              {item.kind === 'runtime' ? (
                <p className="mt-1 text-xs text-gray-400">
                  {runtimeSummary(item)}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
      </div>

      {selectedStep ? (
        <div
          id="approval-flow-step-summary"
          data-testid="approval-flow-step-summary"
          className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{stepTitle(selectedStep)}</span>
            <span
              data-testid="approval-flow-summary-state"
              className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', statusBadgeClasses(selectedStep.status))}
            >
              {statusLabel(selectedStep.status, selectedStep.status === 'current')}
            </span>
          </div>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-400">步骤</dt>
              <dd className="mt-0.5 text-slate-700">第 {selectedStep.stepNo} 步</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">处理人/角色</dt>
              <dd className="mt-0.5 text-slate-700">{handlerSummary(selectedStep)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">审批模式</dt>
              <dd className="mt-0.5 text-slate-700">{selectedStep.kind === 'runtime' ? approvalModeLabel(selectedStep.runtime.approvalMode) : '默认审批'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">关联区段</dt>
              <dd className="mt-0.5 text-slate-700">
                {sectionAnchor(selectedStep) ? (
                  <a className="text-blue-600 hover:text-blue-700" href={`#${sectionAnchor(selectedStep)}`}>
                    {stepTitle(selectedStep)}
                  </a>
                ) : stepTitle(selectedStep)}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">意见</dt>
              <dd className="mt-0.5 text-slate-700">{selectedStep.records[0]?.comment || '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">时间</dt>
              <dd className="mt-0.5 text-slate-700">{formatTime(selectedStep.records[0]?.operatedAt)}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
};

export default ApprovalFlowChart;
