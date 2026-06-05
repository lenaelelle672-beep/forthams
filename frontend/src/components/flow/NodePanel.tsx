import { type DragEvent, useState } from 'react';
import { ArrowRight, Flag, GitBranch, MoveRight, Play, ShieldCheck } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FLOW_NODE_CATALOG, FLOW_NODE_DND_TYPE, FLOW_NODE_ORDER, type FlowNodeType } from '@/types/flow';

const icons = { start: Play, approval: ShieldCheck, condition: GitBranch, end: Flag } satisfies Record<FlowNodeType, typeof Play>;
const colors: Record<FlowNodeType, string> = {
  start: 'bg-green-100 text-green-600',
  approval: 'bg-blue-100 text-blue-600',
  condition: 'bg-amber-100 text-amber-600',
  end: 'bg-red-100 text-red-600',
};

interface Props { onAddNode: (type: FlowNodeType) => void; }

export function NodePanel({ onAddNode }: Props) {
  const [draggingType, setDraggingType] = useState<FlowNodeType | null>(null);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, type: FlowNodeType) => {
    e.dataTransfer.setData(FLOW_NODE_DND_TYPE, type);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingType(type);
  };

  const handleDragEnd = () => {
    setDraggingType(null);
  };

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl bg-[#eff4ff] p-4">
      <div className="flex h-full flex-col rounded-2xl border-0 bg-white/90 p-4 shadow-sm">
        <div className="mb-3">
          <div className="text-base font-semibold text-gray-900">节点面板</div>
          <div className="text-xs text-gray-500">拖拽到画布创建节点，或点击按钮快速追加</div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto">
          {FLOW_NODE_ORDER.map((type) => {
            const meta = FLOW_NODE_CATALOG[type];
            const Icon = icons[type];
            const isDragging = draggingType === type;
            return (
              <div
                key={type}
                draggable
                onDragStart={(e) => handleDragStart(e, type)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'cursor-grab rounded-2xl border bg-white p-4 shadow-sm transition-all',
                  isDragging
                    ? 'border-blue-400 bg-blue-50/30 opacity-50 ring-2 ring-blue-200 shadow-md scale-[0.97]'
                    : 'border-gray-100 group hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={cn('flex size-10 items-center justify-center rounded-2xl', colors[type])}><Icon className="size-5" /></div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-gray-900">{meta.label}</div>
                      <div className="text-xs leading-5 text-gray-500">{meta.description}</div>
                    </div>
                  </div>
                  <button type="button" className="size-8 rounded-full text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors flex items-center justify-center" onClick={() => onAddNode(type)}>
                    <ArrowRight className="size-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-gray-500">
                  <span>{meta.helper}</span>
                  <MoveRight className="size-3.5 text-blue-500" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
