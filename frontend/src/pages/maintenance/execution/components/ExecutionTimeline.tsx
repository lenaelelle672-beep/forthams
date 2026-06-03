/**
 * @file components/ExecutionTimeline.tsx
 * @description 施工时间轴组件 — 垂直展示施工步骤序列
 *
 * Props：
 * - steps: 施工步骤列表
 * - status: 执行状态（决定配色风格）
 */

import React from 'react';
import { Clock, User, Circle, CheckCircle2, PauseCircle } from 'lucide-react';
import type { MaintenanceExecutionStep } from '@/types/maintenanceExecution';

interface ExecutionTimelineProps {
  steps: MaintenanceExecutionStep[];
  status: string;
}

const statusColors: Record<string, string> = {
  RUNNING: 'text-green-600 border-green-400',
  PAUSED: 'text-amber-600 border-amber-400',
  COMPLETED: 'text-gray-500 border-gray-300',
  IDLE: 'text-gray-400 border-gray-200',
};

const statusIcons: Record<string, React.ElementType> = {
  RUNNING: Circle,
  PAUSED: PauseCircle,
  COMPLETED: CheckCircle2,
  IDLE: Circle,
};

export function ExecutionTimeline({ steps, status }: ExecutionTimelineProps) {
  const colorClass = statusColors[status] || statusColors.IDLE;
  const StatusIcon = statusIcons[status] || Circle;

  if (!steps || steps.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        暂无施工步骤记录
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* 顶部状态指示 */}
      <div className={`absolute left-2 top-0 ${colorClass}`}>
        <StatusIcon className="h-4 w-4 -ml-1" />
      </div>

      {/* 时间轴连线 */}
      <div className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-border" />

      {/* 步骤列表 */}
      <div className="space-y-6">
        {steps.map((step, index) => (
          <div key={step.id || index} className="relative">
            {/* 时间轴节点 */}
            <div className="absolute -left-[22px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />

            {/* 步骤卡片 */}
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-sm">
                    {step.stepOrder ? `${step.stepOrder}. ` : ''}{step.stepName}
                  </h4>
                  {step.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                  )}
                </div>
                {step.laborHours != null && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                    <Clock className="h-3 w-3" />
                    {step.laborHours}h
                  </div>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {step.operatorName && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {step.operatorName}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
