/**
 * @file components/ui/ApprovalTimeline.tsx
 * @description 审批流程时间线组件
 */

import { Check, X, Clock, User } from 'lucide-react';
import { cn } from '@/utils/cn';

interface TimelineStep {
  id: string | number;
  label: string;
  operatorName?: string;
  action?: 'APPROVE' | 'REJECT' | 'PENDING' | 'WAITING';
  comment?: string;
  rejectionReason?: string;
  operatedAt?: string;
}

interface ApprovalTimelineProps {
  steps: TimelineStep[];
  className?: string;
}

const STEP_ICONS = {
  APPROVE:  { icon: Check, color: 'bg-green-100 text-green-600 border-green-200' },
  REJECT:   { icon: X,     color: 'bg-red-100   text-red-600   border-red-200'   },
  PENDING:  { icon: Clock, color: 'bg-blue-100  text-blue-600  border-blue-200'  },
  WAITING:  { icon: User,  color: 'bg-gray-100  text-gray-400  border-gray-200'  },
};

export function ApprovalTimeline({ steps, className }: ApprovalTimelineProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {steps.map((step, index) => {
        const config = STEP_ICONS[step.action ?? 'WAITING'];
        const Icon = config.icon;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex gap-3">
            {/* 节点图标 + 连接线 */}
            <div className="flex flex-col items-center">
              <div className={cn('w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0', config.color)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-[#e5e7eb] mt-1.5 mb-0" style={{ minHeight: 20 }} />}
            </div>

            {/* 内容 */}
            <div className="flex-1 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#374151]">{step.label}</span>
                {step.operatedAt && (
                  <span className="text-xs text-[#94a3b8]">{step.operatedAt}</span>
                )}
              </div>
              {step.operatorName && (
                <p className="text-xs text-[#64748b] mt-0.5">审批人：{step.operatorName}</p>
              )}
              {step.comment && (
                <p className="text-xs text-[#64748b] mt-1 bg-[#f8fafc] rounded px-2 py-1">
                  {step.comment}
                </p>
              )}
              {step.rejectionReason && (
                <p className="text-xs text-red-600 mt-1 bg-red-50 rounded px-2 py-1">
                  驳回原因：{step.rejectionReason}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
