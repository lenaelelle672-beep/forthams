import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Flag, GitBranch, Play, ShieldCheck, SquareTerminal } from "lucide-react";

import { cn } from "../ui/utils";
import type { FlowNodeData, FlowNodeType } from "../../types/flow";

const nodeIcons = {
  start: Play,
  approval: ShieldCheck,
  condition: GitBranch,
  end: Flag,
} satisfies Record<FlowNodeType, typeof Play>;

const nodeTokens = {
  start: {
    color: "var(--workflow-start)",
    soft: "var(--workflow-start-soft)",
    badge: "开始",
  },
  approval: {
    color: "var(--workflow-approval)",
    soft: "var(--workflow-approval-soft)",
    badge: "审批",
  },
  condition: {
    color: "var(--workflow-condition)",
    soft: "var(--workflow-condition-soft)",
    badge: "条件",
  },
  end: {
    color: "var(--workflow-end)",
    soft: "var(--workflow-end-soft)",
    badge: "结束",
  },
} satisfies Record<FlowNodeType, { color: string; soft: string; badge: string }>;

function getNodeMeta(type: FlowNodeType, data: FlowNodeData) {
  switch (type) {
    case "start":
      return `触发方式 · ${data.triggerType || "手动触发"}`;
    case "approval":
      return `审批人 · ${data.approverRole || "待配置"}`;
    case "condition":
      return data.conditionExpression || "请配置分支条件";
    case "end":
      return `结束动作 · ${data.resultAction || "流程收口"}`;
    default:
      return "";
  }
}

function FlowCustomNode({ data, type, selected }: NodeProps) {
  const typedData = data as FlowNodeData;
  const nodeType = (type ?? typedData.type) as FlowNodeType;
  const Icon = nodeIcons[nodeType] ?? SquareTerminal;
  const token = nodeTokens[nodeType];

  return (
    <div className="relative min-w-[240px] max-w-[280px]">
      {nodeType !== "start" && (
        <Handle
          type="target"
          position={Position.Top}
          className="!size-3 !border-2 !border-white !bg-primary"
        />
      )}

      <div
        className={cn(
          "relative overflow-hidden rounded-[1.25rem] border bg-card px-4 py-4 shadow-sm transition-all duration-200",
          selected && "shadow-lg ring-2 ring-primary/15",
        )}
        style={{ borderColor: selected ? token.color : "var(--color-border)" }}
      >
        <div
          className="absolute inset-y-4 left-0 w-1 rounded-full"
          style={{ backgroundColor: token.color }}
        />

        <div className="flex items-start gap-3 pl-2">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: token.soft, color: token.color }}
          >
            <Icon className="size-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <span
                  className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase"
                  style={{ backgroundColor: token.soft, color: token.color }}
                >
                  {token.badge}
                </span>
                <div className="truncate text-sm font-semibold text-foreground">{typedData.label}</div>
              </div>

              <span className="rounded-full bg-[var(--workflow-panel)] px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {typedData.nodeCode}
              </span>
            </div>

            <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{typedData.description}</p>

            <div className="rounded-2xl bg-[var(--workflow-panel)] px-3 py-2 text-[11px] font-medium text-foreground/80">
              {getNodeMeta(nodeType, typedData)}
            </div>
          </div>
        </div>
      </div>

      {nodeType === "condition" ? (
        <>
          <div className="pointer-events-none absolute left-5 top-full mt-2 text-[10px] font-semibold text-[var(--workflow-condition)]">
            {typedData.trueLabel || "满足条件"}
          </div>
          <div className="pointer-events-none absolute right-5 top-full mt-2 text-[10px] font-semibold text-[var(--workflow-condition)]">
            {typedData.falseLabel || "不满足条件"}
          </div>
          <Handle
            id="condition-true"
            type="source"
            position={Position.Bottom}
            style={{ left: "26%", background: token.color, borderColor: "white" }}
            className="!size-3 !border-2"
          />
          <Handle
            id="condition-false"
            type="source"
            position={Position.Bottom}
            style={{ left: "74%", background: token.color, borderColor: "white" }}
            className="!size-3 !border-2"
          />
        </>
      ) : nodeType !== "end" ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!size-3 !border-2 !border-white"
          style={{ background: token.color }}
        />
      ) : null}
    </div>
  );
}

export const flowNodeTypes = {
  start: FlowCustomNode,
  approval: FlowCustomNode,
  condition: FlowCustomNode,
  end: FlowCustomNode,
};
