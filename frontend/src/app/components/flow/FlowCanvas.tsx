import { useCallback, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
} from "@xyflow/react";

import { Card, CardContent } from "../ui/card";
import { flowNodeTypes } from "./CustomNodes";
import { FLOW_NODE_DND_TYPE, type FlowEdge, type FlowNode, type FlowNodeType } from "../../types/flow";

interface FlowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: OnConnect;
  onNodeSelect: (node: FlowNode | null) => void;
  onAddNodeAtPosition: (type: FlowNodeType, position: { x: number; y: number }) => void;
}

function getMiniMapColor(node: FlowNode) {
  switch (node.type) {
    case "start":
      return "var(--workflow-start)";
    case "approval":
      return "var(--workflow-approval)";
    case "condition":
      return "var(--workflow-condition)";
    case "end":
      return "var(--workflow-end)";
    default:
      return "var(--color-primary)";
  }
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeSelect,
  onAddNodeAtPosition,
}: FlowCanvasProps) {
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      if (!reactFlowInstance) {
        return;
      }

      const nodeType = event.dataTransfer.getData(FLOW_NODE_DND_TYPE) as FlowNodeType;
      if (!nodeType) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      onAddNodeAtPosition(nodeType, position);
    },
    [onAddNodeAtPosition, reactFlowInstance],
  );

  return (
    <Card className="h-full min-h-0 overflow-hidden border-0 bg-[var(--workflow-canvas)] shadow-none">
      <CardContent className="flex h-full min-h-0 flex-col p-3">
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
          <div>
            <div className="text-sm font-semibold text-foreground">可视化流程画布</div>
            <div className="text-xs text-muted-foreground">拖拽左侧节点到画布，点击节点后在右侧调整属性。</div>
          </div>

          <div className="rounded-full bg-[var(--workflow-panel)] px-3 py-1 text-xs font-medium text-foreground/75">
            支持缩放、平移、连线、分支配置
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-hidden rounded-[1.5rem] border border-white/80 bg-[var(--workflow-surface)]"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <ReactFlow<FlowNode, FlowEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={flowNodeTypes}
            onInit={setReactFlowInstance}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => onNodeSelect(node)}
            onPaneClick={() => onNodeSelect(null)}
            onSelectionChange={({ nodes: selectedNodes }) => {
              const selectedNode = selectedNodes[0] as FlowNode | undefined;
              if (selectedNode) {
                onNodeSelect(selectedNode);
              }
            }}
            fitView
            minZoom={0.45}
            maxZoom={1.6}
            snapToGrid
            snapGrid={[20, 20]}
            proOptions={{ hideAttribution: true }}
            className="bg-transparent"
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--workflow-grid)" />
            <MiniMap
              pannable
              zoomable
              className="!rounded-2xl !border !border-white/80 !bg-white/90"
              nodeColor={(node) => getMiniMapColor(node as FlowNode)}
            />
            <Controls className="!rounded-2xl !border !border-white/80 !bg-white/90 !shadow-sm" />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  );
}
