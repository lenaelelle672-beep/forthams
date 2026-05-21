/**
 * @module frontend/src/app/components/approval/ApprovalFlowChart
 * @description Renders a visual flow chart of the approval history chain.
 */

import React from 'react';
import type { ApprovalHistoryItem, ApprovalItem, ApprovalRuntimePathStep } from '../../services/approval/types';
import { cn } from '../ui/utils';

type RuntimeStep = {
  kind: 'runtime';
  stepNo: number;
  status: string;
  records: ApprovalHistoryItem[];
  runtime: ApprovalRuntimePathStep;
};

type TimelineStep = RuntimeStep | {
  kind: 'record' | 'current';
  stepNo: number;
  status: string;
  records: ApprovalHistoryItem[];
};

export interface ApprovalFlowChartProps {
  /** Current approval process returned by the backend detail API. */
  approval?: ApprovalItem | null;
  /** Ordered list of approval history records (oldest -> newest). */
  approvalHistory: ApprovalHistoryItem[];
}

function formatTime(iso: string): string {
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

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return '待审批';
    case 'UPCOMING':
      return '未开始';
    case 'APPROVED':
      return '已通过';
    case 'REJECTED':
      return '已驳回';
    case 'COMPLETED':
      return '已完成';
    case 'CANCELLED':
      return '已取消';
    default:
      return status;
  }
}

function statusClasses(status: string, isCurrent: boolean): string {
  if (status === 'APPROVED' || status === 'COMPLETED') {
    return isCurrent ? 'bg-green-500 text-white' : 'border-2 border-green-500 text-green-600';
  }
  if (status === 'REJECTED' || status === 'CANCELLED') {
    return isCurrent ? 'bg-red-500 text-white' : 'border-2 border-red-500 text-red-600';
  }
  if (status === 'PENDING') {
    return isCurrent ? 'bg-blue-500 text-white' : 'border-2 border-blue-300 text-blue-600';
  }
  if (status === 'UPCOMING') {
    return 'border-2 border-dashed border-gray-300 text-gray-400';
  }
  return isCurrent ? 'bg-gray-500 text-white' : 'border-2 border-gray-200 text-gray-400';
}

function groupRecordsByStep(history: ApprovalHistoryItem[]) {
  const grouped = new Map<number, ApprovalHistoryItem[]>();
  for (const record of [...(history || [])].sort((left, right) => left.stepNo - right.stepNo)) {
    grouped.set(record.stepNo, [...(grouped.get(record.stepNo) ?? []), record]);
  }
  return grouped;
}

function runtimeStepStatus(records: ApprovalHistoryItem[], approval: ApprovalItem, stepNo: number) {
  if (records.some((record) => record.status === 'REJECTED')) return 'REJECTED';
  if (approval.status === 'PENDING' && approval.currentStep === stepNo) return 'PENDING';
  if (records.length > 0 && records.every((record) => record.status === 'APPROVED')) return 'APPROVED';
  return 'UPCOMING';
}

function makeRuntimeTimeline(approval: ApprovalItem | null | undefined, history: ApprovalHistoryItem[]): TimelineStep[] | null {
  const runtimePath = approval?.workflowRuntimePath;
  if (!approval || !Array.isArray(runtimePath) || runtimePath.length === 0) return null;

  const recordsByStep = groupRecordsByStep(history);
  return [...runtimePath]
    .sort((left, right) => left.stepNo - right.stepNo)
    .map((runtime) => {
      const records = recordsByStep.get(runtime.stepNo) ?? [];
      return {
        kind: 'runtime' as const,
        stepNo: runtime.stepNo,
        status: runtimeStepStatus(records, approval, runtime.stepNo),
        records,
        runtime,
      };
    });
}

function makeTimeline(approval: ApprovalItem | null | undefined, history: ApprovalHistoryItem[]): TimelineStep[] {
  const runtimeTimeline = makeRuntimeTimeline(approval, history);
  if (runtimeTimeline) return runtimeTimeline;
  const records = [...(history || [])].sort((left, right) => left.stepNo - right.stepNo);
  if (!approval) {
    return records.map((record) => ({ kind: 'record' as const, stepNo: record.stepNo, status: record.status, records: [record] }));
  }

  const timeline: TimelineStep[] = records.map((record) => ({ kind: 'record' as const, stepNo: record.stepNo, status: record.status, records: [record] }));
  const hasCurrentRecord = records.some((record) => record.stepNo === approval.currentStep);
  if (approval.status === 'PENDING' && !hasCurrentRecord) {
    timeline.push({ kind: 'current' as const, stepNo: approval.currentStep, status: 'PENDING', records: [] });
  }
  if (timeline.length === 0) {
    timeline.push({ kind: 'current' as const, stepNo: approval.currentStep || 1, status: approval.status, records: [] });
  }
  return timeline.sort((left, right) => left.stepNo - right.stepNo);
}

function highlightedIndex(timeline: TimelineStep[]) {
  const pendingIndex = timeline.findIndex((item) => item.status === 'PENDING');
  if (pendingIndex >= 0) return pendingIndex;
  const rejectedIndex = timeline.findIndex((item) => item.status === 'REJECTED' || item.status === 'CANCELLED');
  return rejectedIndex >= 0 ? rejectedIndex : timeline.length - 1;
}

function stepTitle(item: TimelineStep) {
  if (item.kind === 'runtime') {
    return item.runtime.label || `第${item.stepNo}级审批`;
  }
  return item.records[0] ? `第${item.stepNo}步审批` : '当前待处理节点';
}

export const ApprovalFlowChart: React.FC<ApprovalFlowChartProps> = ({
  approval,
  approvalHistory,
}) => {
  const timeline = makeTimeline(approval, approvalHistory);

  if (timeline.length === 0) {
    return (
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
    );
  }

  const activeStepIndex = highlightedIndex(timeline);

  return (
    <div className="flex flex-col">
      {timeline.map((item, idx) => {
        const isLast = idx === timeline.length - 1;
        const isActive = idx === activeStepIndex;
        const records = item.records;
        const key = records[0]?.id ? `record-${records[0].id}-step-${item.stepNo}` : `current-${item.stepNo}`;

        return (
          <div key={key} className="flex items-start">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                  statusClasses(item.status, isActive),
                )}
              >
                {item.stepNo}
              </div>

              {!isLast && (
                <div className="h-full w-0.5 bg-blue-50" />
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
                    (item.status === 'APPROVED' || item.status === 'COMPLETED') && 'bg-green-50 text-green-700',
                    (item.status === 'REJECTED' || item.status === 'CANCELLED') && 'bg-red-50 text-red-700',
                    item.status === 'PENDING' && 'bg-blue-50 text-blue-700',
                    item.status === 'UPCOMING' && 'bg-gray-50 text-gray-500',
                    !['APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'PENDING', 'UPCOMING'].includes(item.status) && 'bg-blue-50 text-gray-500',
                  )}
                >
                  {statusLabel(item.status)}
                </span>
              </div>

              {records.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {records.map((record) => (
                    <div key={record.id} className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-700">操作人 #{record.operator}</span>
                        <span>{statusLabel(record.status)}</span>
                        {record.operatedAt ? <span>{formatTime(record.operatedAt)}</span> : null}
                      </div>
                      {record.comment ? <p className="mt-1 text-gray-500">{record.comment}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {records.length === 0 && approval ? (
                <p className="mt-1 text-sm text-gray-400">
                  {item.status === 'UPCOMING'
                    ? `第 ${item.stepNo} 步尚未开始。`
                    : `流程 ${approval.processNo || approval.id} 正在等待第 ${item.stepNo} 步审批。`}
                </p>
              ) : null}

              {item.kind === 'runtime' ? (
                <p className="mt-1 text-xs text-gray-400">
                  {item.runtime.nodeCode ? `节点 ${item.runtime.nodeCode}` : '运行路径节点'}
                  {item.runtime.approverType === 'user' && item.runtime.approverId ? ` · 指定用户 #${item.runtime.approverId}` : ''}
                  {item.runtime.approverRole ? ` · 角色 ${item.runtime.approverRole}` : ''}
                  {item.runtime.approvalMode ? ` · ${item.runtime.approvalMode}` : ''}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ApprovalFlowChart;
