import type { DragEvent } from "react";
import { ArrowRight, Flag, GitBranch, MoveRight, Play, ShieldCheck } from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { cn } from "../ui/utils";
import {
  FLOW_NODE_CATALOG,
  FLOW_NODE_DND_TYPE,
  FLOW_NODE_ORDER,
  type FlowNodeType,
} from "../../types/flow";

const icons = {
  start: Play,
  approval: ShieldCheck,
  condition: GitBranch,
  end: Flag,
} satisfies Record<FlowNodeType, typeof Play>;

const colorClasses: Record<FlowNodeType, string> = {
  start: "bg-[var(--workflow-start-soft)] text-[var(--workflow-start)]",
  approval: "bg-[var(--workflow-approval-soft)] text-[var(--workflow-approval)]",
  condition: "bg-[var(--workflow-condition-soft)] text-[var(--workflow-condition)]",
  end: "bg-[var(--workflow-end-soft)] text-[var(--workflow-end)]",
};

interface NodePanelProps {
  onAddNode: (type: FlowNodeType) => void;
}

export function NodePanel({ onAddNode }: NodePanelProps) {
  const handleDragStart = (event: DragEvent<HTMLDivElement>, type: FlowNodeType) => {
    event.dataTransfer.setData(FLOW_NODE_DND_TYPE, type);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex h-full flex-col gap-4 rounded-[1.5rem] bg-[var(--workflow-panel)] p-4">
      <Card className="flex h-full flex-col border-0 bg-white/90 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">节点面板</CardTitle>
          <CardDescription>拖拽到画布即可创建节点，点击右侧按钮可快速追加到当前流程。</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-y-auto">
          {FLOW_NODE_ORDER.map((type) => {
            const meta = FLOW_NODE_CATALOG[type];
            const Icon = icons[type];

            return (
              <div
                key={type}
                draggable
                onDragStart={(event) => handleDragStart(event, type)}
                className="group cursor-grab rounded-[1.25rem] border border-white/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={cn("flex size-10 items-center justify-center rounded-2xl", colorClasses[type])}>
                      <Icon className="size-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground">{meta.label}</div>
                      <div className="text-xs leading-5 text-muted-foreground">{meta.description}</div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full text-muted-foreground hover:text-primary"
                    onClick={() => onAddNode(type)}
                  >
                    <ArrowRight className="size-4" />
                  </Button>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-2xl bg-[var(--workflow-surface)] px-3 py-2 text-[11px] text-muted-foreground">
                  <span>{meta.helper}</span>
                  <MoveRight className="size-3.5 text-primary" />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="rounded-[1.25rem] bg-white/80 px-4 py-3 text-xs leading-6 text-muted-foreground shadow-sm">
        建议顺序：开始 → 审批 → 条件分支 → 审批/结束。条件节点底部有两个出口，可分别连接不同路径。
      </div>
    </div>
  );
}
