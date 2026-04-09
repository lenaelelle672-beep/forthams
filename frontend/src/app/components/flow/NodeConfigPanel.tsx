import { FileCode2, GitBranch, Trash2 } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Textarea } from "../ui/textarea";
import { FLOW_NODE_CATALOG, type FlowEdge, type FlowNode, type FlowNodeData } from "../../types/flow";

const typeBadgeClasses = {
  start: "bg-[var(--workflow-start-soft)] text-[var(--workflow-start)]",
  approval: "bg-[var(--workflow-approval-soft)] text-[var(--workflow-approval)]",
  condition: "bg-[var(--workflow-condition-soft)] text-[var(--workflow-condition)]",
  end: "bg-[var(--workflow-end-soft)] text-[var(--workflow-end)]",
} as const;

const nativeFieldClassName =
  "flex h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

interface NodeConfigPanelProps {
  selectedNode: FlowNode | null;
  edges: FlowEdge[];
  onUpdateNode: (nodeId: string, patch: Partial<FlowNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
}

export function NodeConfigPanel({ selectedNode, edges, onUpdateNode, onDeleteNode }: NodeConfigPanelProps) {
  if (!selectedNode) {
    return (
      <div className="flex h-full flex-col gap-4 rounded-[1.5rem] bg-[var(--workflow-panel)] p-4">
        <Card className="border-0 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">节点属性</CardTitle>
            <CardDescription>请选择画布中的节点后，在这里编辑名称、描述、审批人和分支条件。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-[1.25rem] bg-[var(--workflow-surface)] p-4 leading-6">
              当前画布支持开始、审批、条件分支、结束四种节点；拖拽连线后可形成完整审批流。
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-start-soft)_70%,white)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workflow-start)]">Start</div>
                <div className="mt-1 text-sm font-semibold text-foreground">流程触发</div>
              </div>
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-approval-soft)_70%,white)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workflow-approval)]">Approval</div>
                <div className="mt-1 text-sm font-semibold text-foreground">审批决策</div>
              </div>
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-condition-soft)_70%,white)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workflow-condition)]">Condition</div>
                <div className="mt-1 text-sm font-semibold text-foreground">条件分流</div>
              </div>
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-end-soft)_70%,white)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workflow-end)]">End</div>
                <div className="mt-1 text-sm font-semibold text-foreground">流程收口</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentType = selectedNode.type;
  const edgeCount = edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id).length;

  return (
    <div className="flex h-full flex-col gap-4 rounded-[1.5rem] bg-[var(--workflow-panel)] p-4">
      <Card className="flex h-full flex-col border-0 bg-white/90 shadow-sm">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="text-base font-semibold">节点属性</CardTitle>
              <CardDescription>{FLOW_NODE_CATALOG[currentType].helper}</CardDescription>
            </div>
            <Badge className={typeBadgeClasses[currentType]}>{FLOW_NODE_CATALOG[currentType].label}</Badge>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileCode2 className="size-3.5" />
            <span>{selectedNode.data.nodeCode}</span>
            <span>·</span>
            <GitBranch className="size-3.5" />
            <span>{edgeCount} 条关联连线</span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-5 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="node-label">节点名称</Label>
            <Input
              id="node-label"
              value={selectedNode.data.label}
              onChange={(event) => onUpdateNode(selectedNode.id, { label: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-description">节点说明</Label>
            <Textarea
              id="node-description"
              rows={3}
              value={selectedNode.data.description}
              onChange={(event) => onUpdateNode(selectedNode.id, { description: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-code">节点编码</Label>
            <Input
              id="node-code"
              value={selectedNode.data.nodeCode}
              onChange={(event) => onUpdateNode(selectedNode.id, { nodeCode: event.target.value })}
            />
          </div>

          <Separator />

          {currentType === "start" && (
            <div className="space-y-2">
              <Label htmlFor="trigger-type">触发方式</Label>
              <select
                id="trigger-type"
                className={nativeFieldClassName}
                value={selectedNode.data.triggerType}
                onChange={(event) => onUpdateNode(selectedNode.id, { triggerType: event.target.value })}
              >
                <option value="表单提交">表单提交</option>
                <option value="定时触发">定时触发</option>
                <option value="接口调用">接口调用</option>
                <option value="手动发起">手动发起</option>
              </select>
            </div>
          )}

          {currentType === "approval" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="approver-role">审批角色</Label>
                <Input
                  id="approver-role"
                  value={selectedNode.data.approverRole}
                  onChange={(event) => onUpdateNode(selectedNode.id, { approverRole: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="approval-mode">审批模式</Label>
                <select
                  id="approval-mode"
                  className={nativeFieldClassName}
                  value={selectedNode.data.approvalMode}
                  onChange={(event) =>
                    onUpdateNode(selectedNode.id, {
                      approvalMode: event.target.value as FlowNodeData["approvalMode"],
                    })
                  }
                >
                  <option value="sequence">依次审批</option>
                  <option value="all">会签（全部通过）</option>
                  <option value="any">或签（任一通过）</option>
                </select>
              </div>
            </>
          )}

          {currentType === "condition" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="condition-expression">条件表达式</Label>
                <Textarea
                  id="condition-expression"
                  rows={4}
                  value={selectedNode.data.conditionExpression}
                  onChange={(event) => onUpdateNode(selectedNode.id, { conditionExpression: event.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="condition-true">满足条件标签</Label>
                  <Input
                    id="condition-true"
                    value={selectedNode.data.trueLabel}
                    onChange={(event) => onUpdateNode(selectedNode.id, { trueLabel: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition-false">不满足标签</Label>
                  <Input
                    id="condition-false"
                    value={selectedNode.data.falseLabel}
                    onChange={(event) => onUpdateNode(selectedNode.id, { falseLabel: event.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {currentType === "end" && (
            <div className="space-y-2">
              <Label htmlFor="result-action">结束动作</Label>
              <Textarea
                id="result-action"
                rows={3}
                value={selectedNode.data.resultAction}
                onChange={(event) => onUpdateNode(selectedNode.id, { resultAction: event.target.value })}
              />
            </div>
          )}

          <Separator />

          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={() => onDeleteNode(selectedNode.id)}
          >
            <Trash2 className="size-4" />
            删除当前节点
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
