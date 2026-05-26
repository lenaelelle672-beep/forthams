import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Flag, GitBranch, Play, ShieldCheck } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { FlowNodeData, FlowNodeType } from '@/types/flow';

const icons = { start: Play, approval: ShieldCheck, condition: GitBranch, end: Flag } satisfies Record<FlowNodeType, typeof Play>;
const tokens = {
  start:     { color: '#16a34a', soft: '#dcfce7', badge: '开始' },
  approval:  { color: '#2563eb', soft: '#dbeafe', badge: '审批' },
  condition: { color: '#f59e0b', soft: '#ffedd5', badge: '条件' },
  end:       { color: '#dc2626', soft: '#fee2e2', badge: '结束' },
} satisfies Record<FlowNodeType, { color: string; soft: string; badge: string }>;

function getMeta(type: FlowNodeType, data: FlowNodeData) {
  switch (type) {
    case 'start': return `触发方式 · ${data.triggerType || '手动触发'}`;
    case 'approval': return `审批人 · ${data.approverRoleName || data.approverRole || '待配置'}`;
    case 'condition': return data.conditionExpression || '请配置分支条件';
    case 'end': return `结束动作 · ${data.resultAction || '流程收口'}`;
    default: return '';
  }
}

function FlowCustomNode({ data, type, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const t = (type ?? d.type) as FlowNodeType;
  const Icon = icons[t] ?? Play;
  const tk = tokens[t];

  return (
    <div className="relative min-w-[240px] max-w-[280px]">
      {t !== 'start' && <Handle type="target" position={Position.Top} className="!size-3 !border-2 !border-white !bg-blue-500" />}

      <div
        className={cn('relative overflow-hidden rounded-[1.25rem] border bg-white px-4 py-4 shadow-sm transition-all duration-200', selected && 'shadow-lg ring-2 ring-blue-500/15')}
        style={{ borderColor: selected ? tk.color : '#e5e7eb' }}
      >
        <div className="absolute inset-y-4 left-0 w-1 rounded-full" style={{ backgroundColor: tk.color }} />
        <div className="flex items-start gap-3 pl-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: tk.soft, color: tk.color }}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ backgroundColor: tk.soft, color: tk.color }}>{tk.badge}</span>
                <div className="truncate text-sm font-semibold text-gray-900">{d.label}</div>
              </div>
              <span className="rounded-full bg-slate-50 px-2 py-1 text-[11px] font-medium text-gray-500">{d.nodeCode}</span>
            </div>
            <p className="line-clamp-2 text-xs leading-5 text-gray-500">{d.description}</p>
            <div className="rounded-2xl bg-slate-50 px-3 py-2 text-[11px] font-medium text-gray-700">{getMeta(t, d)}</div>
          </div>
        </div>
      </div>

      {t === 'condition' ? (
        <>
          <div className="pointer-events-none absolute left-5 top-full mt-2 text-[10px] font-semibold text-amber-600">{d.trueLabel || '满足条件'}</div>
          <div className="pointer-events-none absolute right-5 top-full mt-2 text-[10px] font-semibold text-amber-600">{d.falseLabel || '不满足条件'}</div>
          <Handle id="condition-true" type="source" position={Position.Bottom} style={{ left: '26%', background: tk.color, borderColor: 'white' }} className="!size-3 !border-2" />
          <Handle id="condition-false" type="source" position={Position.Bottom} style={{ left: '74%', background: tk.color, borderColor: 'white' }} className="!size-3 !border-2" />
        </>
      ) : t !== 'end' ? (
        <Handle type="source" position={Position.Bottom} className="!size-3 !border-2 !border-white" style={{ background: tk.color }} />
      ) : null}
    </div>
  );
}

export const flowNodeTypes = { start: FlowCustomNode, approval: FlowCustomNode, condition: FlowCustomNode, end: FlowCustomNode };
