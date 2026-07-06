import { CheckCircle2, Clock, User, XCircle, ChevronRight } from 'lucide-react';

export interface FlowStep {
  stepNo: number;
  nodeId: string;
  nodeCode: string;
  label: string;
  approverType: string;
  approverRole: string;
  approverRoleName: string;
  approvalMode: string;
  /** 匹配到的审批记录 */
  record?: {
    approverId: number;
    approverName?: string;
    result: string;
    opinion: string;
    time: string;
  };
}

interface Props {
  currentStep: number;
  status: string;
  steps: FlowStep[];
  className?: string;
}

function resultBadge(result: string) {
  if (result === 'APPROVED') return { label: '通过', cls: 'bg-green-50 text-green-700 border-green-200' };
  if (result === 'REJECTED') return { label: '驳回', cls: 'bg-red-50 text-red-700 border-red-200' };
  return { label: '待处理', cls: 'bg-gray-50 text-gray-500 border-gray-200' };
}

export default function ApprovalFlowTracker({ currentStep, status, steps, className = '' }: Props) {
  if (!steps?.length) {
    return <p className="text-sm text-gray-400 py-4 text-center">暂无流程节点信息</p>;
  }

  return (
    <div className={`space-y-0 ${className}`}>
      {steps.map((step, i) => {
        const record = step.record;
        const stepNum = step.stepNo;
        const isCompleted = record?.result === 'APPROVED';
        const isRejected = record?.result === 'REJECTED';
        const isCurrent = !isCompleted && !isRejected && stepNum === currentStep;
        const isPending = !isCompleted && !isRejected && stepNum > currentStep;
        const badge = record ? resultBadge(record.result) : isCurrent
          ? { label: '审批中', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
          : { label: '等待中', cls: 'bg-gray-50 text-gray-400 border-gray-200' };

        const isLast = i === steps.length - 1;

        return (
          <div key={step.nodeId} className="flex gap-3">
            {/* 左侧：图标 + 连接线 */}
            <div className="flex flex-col items-center flex-shrink-0">
              {isCompleted ? (
                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              ) : isRejected ? (
                <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-white" />
                </div>
              ) : isCurrent ? (
                <div className="w-7 h-7 rounded-full border-2 border-blue-500 bg-blue-50 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center">
                  <span className="text-[10px] text-gray-400 font-medium">{stepNum}</span>
                </div>
              )}
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[20px] ${isCompleted ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </div>

            {/* 右侧：步骤内容 */}
            <div className={`flex-1 pb-5 ${isPending ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-semibold ${isCurrent ? 'text-blue-700' : 'text-gray-800'}`}>
                  {step.label}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded border ${badge.cls}`}>
                  {badge.label}
                </span>
                {step.approvalMode === 'all' && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded">会签</span>
                )}
              </div>

              {/* 审批角色 */}
              {step.approverRoleName && (
                <p className="text-xs text-gray-400 mt-0.5">
                  审批角色：{step.approverRoleName}
                </p>
              )}

              {/* 审批人 + 结果 */}
              {record ? (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <User className="w-3 h-3 text-gray-400" />
                    <span>{record.approverName || `用户${record.approverId}`}</span>
                    <ChevronRight className="w-3 h-3 text-gray-300" />
                    {isCompleted ? (
                      <span className="text-green-600 font-medium">已通过</span>
                    ) : isRejected ? (
                      <span className="text-red-600 font-medium">已驳回</span>
                    ) : null}
                  </div>
                  {record.opinion && (
                    <p className="text-xs text-gray-400 truncate max-w-[320px]" title={record.opinion}>
                      {record.opinion}
                    </p>
                  )}
                  {record.time && (
                    <p className="text-[10px] text-gray-300">{record.time.replace('T', ' ').substring(0, 16)}</p>
                  )}
                </div>
              ) : isCurrent ? (
                <p className="text-xs text-blue-500 mt-1">等待审批中...</p>
              ) : null}
            </div>
          </div>
        );
      })}

      {/* 最终结果 */}
      {status === 'APPROVED' && (
        <div className="flex gap-3 pt-1">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <span className="text-sm font-semibold text-green-700">流程完成</span>
            <p className="text-xs text-gray-400 mt-0.5">审批已全部通过，业务数据已同步更新</p>
          </div>
        </div>
      )}
      {status === 'REJECTED' && (
        <div className="flex gap-3 pt-1">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <span className="text-sm font-semibold text-red-600">流程已驳回</span>
          </div>
        </div>
      )}
    </div>
  );
}
