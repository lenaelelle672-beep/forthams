import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { addEdge, type Connection, useEdgesState, useNodesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Layers3, Sparkles, Workflow } from "lucide-react";

import { FlowCanvas } from "../components/flow/FlowCanvas";
import { NodeConfigPanel } from "../components/flow/NodeConfigPanel";
import { NodePanel } from "../components/flow/NodePanel";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  createFlowEdge,
  createFlowNode,
  initialFlowEdges,
  initialFlowNodes,
  type FlowDefinition,
  type FlowNode,
  type FlowNodeData,
  type FlowNodeType,
} from "../types/flow";

function getAutoPosition(index: number) {
  const column = index % 2;
  const row = Math.floor(index / 2);

  return {
    x: 220 + column * 220,
    y: 120 + row * 160,
  };
}

const designerTokens = {
  "--workflow-surface": "#f8f9ff",
  "--workflow-panel": "#eff4ff",
  "--workflow-canvas": "#f4f7ff",
  "--workflow-grid": "rgba(67, 56, 218, 0.12)",
  "--workflow-start": "#16a34a",
  "--workflow-start-soft": "#dcfce7",
  "--workflow-approval": "#2563eb",
  "--workflow-approval-soft": "#dbeafe",
  "--workflow-condition": "#f59e0b",
  "--workflow-condition-soft": "#ffedd5",
  "--workflow-end": "#dc2626",
  "--workflow-end-soft": "#fee2e2",
} as CSSProperties;

export function WorkflowDesigner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialFlowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlowEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("approval-1");

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const flowDefinition = useMemo<FlowDefinition>(
    () => ({
      id: "WF-AMS-2026-001",
      name: "资产审批流程设计器",
      description: "可视化编排开始、审批、条件分支与结束节点，支持节点配置与连线路径编辑。",
      nodes,
      edges,
    }),
    [edges, nodes],
  );

  const handleAddNodeAtPosition = useCallback(
    (type: FlowNodeType, position?: { x: number; y: number }) => {
      const newNode = createFlowNode(type, position ?? getAutoPosition(nodes.length), {
        data: {
          nodeCode: `${type.toUpperCase()}-${String(nodes.length + 1).padStart(3, "0")}`,
        },
      });

      setNodes((currentNodes) => [...currentNodes, newNode]);
      setSelectedNodeId(newNode.id);
    },
    [nodes.length, setNodes],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const edge = createFlowEdge(connection);
      if (!edge) {
        return;
      }

      setEdges((currentEdges) => addEdge(edge, currentEdges));
    },
    [setEdges],
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, patch: Partial<FlowNodeData>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...patch,
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      );

      setSelectedNodeId((currentSelected) => (currentSelected === nodeId ? null : currentSelected));
    },
    [setEdges, setNodes],
  );

  return (
    <div className="space-y-6" style={designerTokens}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge className="rounded-full bg-[var(--workflow-approval-soft)] px-3 py-1 text-[var(--workflow-approval)]">
            Workflow Designer
          </Badge>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">审批流程可视化设计器</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              基于 Stitch 的企业级流程编辑模式，提供左侧节点面板、中间可视化画布、右侧属性配置区，支持拖拽建模、连线与节点编辑。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="bg-white/80">
            <Layers3 className="size-4" />
            {flowDefinition.nodes.length} 个节点
          </Button>
          <Button variant="outline" className="bg-white/80">
            <Workflow className="size-4" />
            {flowDefinition.edges.length} 条连线
          </Button>
          <Button className="bg-gradient-to-r from-primary to-[var(--workflow-approval)] text-primary-foreground hover:opacity-90">
            <Sparkles className="size-4" />
            保存流程草稿
          </Button>
        </div>
      </div>

      <Card className="border-0 bg-[var(--workflow-surface)] shadow-none">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-4 rounded-[1.5rem] bg-white/80 p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--workflow-approval)]">{flowDefinition.id}</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{flowDefinition.name}</div>
              <div className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{flowDefinition.description}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-start-soft)_70%,white)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--workflow-start)]">开始</div>
                <div className="mt-1 font-semibold text-foreground">{nodes.filter((node) => node.type === "start").length}</div>
              </div>
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-approval-soft)_70%,white)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--workflow-approval)]">审批</div>
                <div className="mt-1 font-semibold text-foreground">{nodes.filter((node) => node.type === "approval").length}</div>
              </div>
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-condition-soft)_70%,white)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--workflow-condition)]">条件</div>
                <div className="mt-1 font-semibold text-foreground">{nodes.filter((node) => node.type === "condition").length}</div>
              </div>
              <div className="rounded-[1.25rem] bg-[color-mix(in_srgb,var(--workflow-end-soft)_70%,white)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--workflow-end)]">结束</div>
                <div className="mt-1 font-semibold text-foreground">{nodes.filter((node) => node.type === "end").length}</div>
              </div>
            </div>
          </div>

          <div className="grid h-[calc(100vh-14rem)] min-h-[720px] grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
            <NodePanel onAddNode={(type) => handleAddNodeAtPosition(type)} />
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              onNodeSelect={(node) => setSelectedNodeId(node?.id ?? null)}
              onAddNodeAtPosition={handleAddNodeAtPosition}
            />
            <NodeConfigPanel
              selectedNode={selectedNode}
              edges={edges}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
