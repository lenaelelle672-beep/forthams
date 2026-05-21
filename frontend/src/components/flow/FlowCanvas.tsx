import { useCallback, useState } from 'react';
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, type OnConnect, type OnEdgesChange, type OnNodesChange, type ReactFlowInstance } from '@xyflow/react';
import { flowNodeTypes } from './CustomNodes';
import { FLOW_NODE_DND_TYPE, type FlowEdge, type FlowNode, type FlowNodeType } from '@/types/flow';

interface Props {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: OnConnect;
  onNodeSelect: (node: FlowNode | null) => void;
  onAddNodeAtPosition: (type: FlowNodeType, pos: { x: number; y: number }) => void;
}

function mmColor(node: FlowNode) {
  const map: Record<string, string> = { start: '#16a34a', approval: '#2563eb', condition: '#f59e0b', end: '#dc2626' };
  return map[node.type ?? ''] ?? '#3b82f6';
}

export function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeSelect, onAddNodeAtPosition }: Props) {
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!rfInstance) return;
    const nodeType = e.dataTransfer.getData(FLOW_NODE_DND_TYPE) as FlowNodeType;
    if (!nodeType) return;
    onAddNodeAtPosition(nodeType, rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }, [onAddNodeAtPosition, rfInstance]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[#f4f7ff]">
      <div className="flex-shrink-0 flex items-center justify-between bg-white border-b border-gray-100 px-4 py-2.5">
        <div>
          <span className="text-sm font-semibold text-gray-900">可视化流程画布</span>
          <span className="ml-3 text-xs text-gray-400">拖拽左侧节点到画布，点击节点后右侧编辑属性</span>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">缩放 · 平移 · 连线 · 分支</span>
      </div>
      <div className="flex-1 min-h-0" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow<FlowNode, FlowEdge>
          nodes={nodes} edges={edges} nodeTypes={flowNodeTypes}
          onInit={setRfInstance} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          onNodeClick={(_, node) => onNodeSelect(node)} onPaneClick={() => onNodeSelect(null)}
          onSelectionChange={({ nodes: sel }) => { const s = sel[0] as FlowNode | undefined; if (s) onNodeSelect(s); }}
          fitView minZoom={0.45} maxZoom={1.6} snapToGrid snapGrid={[20, 20]} proOptions={{ hideAttribution: true }}
          className="bg-transparent"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="rgba(59,130,246,0.12)" />
          <MiniMap pannable zoomable className="!rounded-2xl !border !border-gray-200 !bg-white/90" nodeColor={(n) => mmColor(n as FlowNode)} />
          <Controls className="!rounded-2xl !border !border-gray-200 !bg-white/90 !shadow-sm" />
        </ReactFlow>
      </div>
    </div>
  );
}
