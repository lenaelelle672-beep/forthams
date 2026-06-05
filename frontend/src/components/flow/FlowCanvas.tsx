import { useCallback, useState } from 'react';
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow,
  type OnConnect, type OnEdgesChange, type OnNodeDrag, type OnNodesChange, type ReactFlowInstance,
} from '@xyflow/react';
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
  /** 节点拖拽开始时回调（用于父组件撤销快照） */
  onNodeDragStart?: OnNodeDrag<FlowNode>;
}

/** 对齐辅助线描述 */
interface AlignLine {
  type: 'vertical' | 'horizontal';
  flowPos: number;
}

const ALIGN_THRESHOLD = 8;
const DEFAULT_NODE_W = 240;
const DEFAULT_NODE_H = 140;

function mmColor(node: FlowNode) {
  const map: Record<string, string> = { start: '#16a34a', approval: '#2563eb', condition: '#f59e0b', end: '#dc2626' };
  return map[node.type ?? ''] ?? '#3b82f6';
}

export function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeSelect, onAddNodeAtPosition, onNodeDragStart }: Props) {
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [, setDraggingNodeId] = useState<string | null>(null);
  const [alignLines, setAlignLines] = useState<AlignLine[]>([]);

  /* ---- 外部节点拖入 ---- */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!rfInstance) return;
    const nodeType = e.dataTransfer.getData(FLOW_NODE_DND_TYPE) as FlowNodeType;
    if (!nodeType) return;
    const pos = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    onAddNodeAtPosition(nodeType, pos);
    setTimeout(() => {
      rfInstance.setCenter(pos.x, pos.y, { zoom: 1.15, duration: 200 });
    }, 50);
  }, [onAddNodeAtPosition, rfInstance]);

  /* ---- 对齐辅助线检测 ---- */
  const onNodeDragHandler = useCallback((_event: React.MouseEvent, dragged: FlowNode, _allNodes: FlowNode[]) => {
    const lines: AlignLine[] = [];
    const dx = dragged.position.x;
    const dy = dragged.position.y;
    const dw = (dragged.measured?.width ?? DEFAULT_NODE_W) / 2;
    const dh = (dragged.measured?.height ?? DEFAULT_NODE_H) / 2;

    for (const n of nodes) {
      if (n.id === dragged.id) continue;
      const nx = n.position.x;
      const ny = n.position.y;
      const nw = (n.measured?.width ?? DEFAULT_NODE_W) / 2;
      const nh = (n.measured?.height ?? DEFAULT_NODE_H) / 2;

      // X 轴：左边缘 & 中心 & 右边缘
      if (Math.abs(dx - nx) < ALIGN_THRESHOLD) lines.push({ type: 'vertical', flowPos: nx });
      if (Math.abs((dx + dw * 2) - (nx + nw * 2)) < ALIGN_THRESHOLD) lines.push({ type: 'vertical', flowPos: nx + nw * 2 });
      if (Math.abs((dx + dw) - (nx + nw)) < ALIGN_THRESHOLD) lines.push({ type: 'vertical', flowPos: nx + nw });

      // Y 轴：上边缘 & 中心 & 下边缘
      if (Math.abs(dy - ny) < ALIGN_THRESHOLD) lines.push({ type: 'horizontal', flowPos: ny });
      if (Math.abs((dy + dh * 2) - (ny + nh * 2)) < ALIGN_THRESHOLD) lines.push({ type: 'horizontal', flowPos: ny + nh * 2 });
      if (Math.abs((dy + dh) - (ny + nh)) < ALIGN_THRESHOLD) lines.push({ type: 'horizontal', flowPos: ny + nh });
    }

    // 去重（同一位置只保留一条线）
    const seen = new Set<number>();
    const deduped: AlignLine[] = [];
    for (const ln of lines) {
      const key = ln.type === 'vertical' ? ln.flowPos : ln.flowPos + 100000;
      if (!seen.has(key)) { seen.add(key); deduped.push(ln); }
    }
    setAlignLines(deduped);
  }, [nodes]);

  const onNodeDragStartHandler = useCallback((event: React.MouseEvent, node: FlowNode, allNodes: FlowNode[]) => {
    setDraggingNodeId(node.id);
    setAlignLines([]);
    onNodeDragStart?.(event, node, allNodes);
  }, [onNodeDragStart]);

  const onNodeDragStopHandler = useCallback(() => {
    setDraggingNodeId(null);
    setAlignLines([]);
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[#f4f7ff]">
      {/* 拖拽节点全局 CSS 增强 */}
      <style>{`
        .react-flow__node.dragging {
          z-index: 1000 !important;
          filter: drop-shadow(0 8px 24px rgba(59, 130, 246, 0.28));
          opacity: 0.92;
          transition: filter 0.15s ease, opacity 0.15s ease;
        }
        .react-flow__node:not(.dragging) {
          transition: filter 0.2s ease;
        }
        .react-flow__node:hover {
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.08));
        }
      `}</style>

      <div className="flex-shrink-0 flex items-center justify-between bg-white border-b border-gray-100 px-4 py-2.5">
        <div>
          <span className="text-sm font-semibold text-gray-900">可视化流程画布</span>
          <span className="ml-3 text-xs text-gray-400">拖拽左侧节点到画布，点击节点后右侧编辑属性</span>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">缩放 · 平移 · 连线 · 分支</span>
      </div>
      <div
        className={`flex-1 min-h-0 transition-all duration-200 ${isDragOver ? 'bg-blue-50/60' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className={`w-full h-full transition-all duration-200 rounded-lg ${isDragOver ? 'ring-2 ring-inset ring-blue-400/40 border-2 border-dashed border-blue-300/50' : ''}`}>
          <ReactFlow<FlowNode, FlowEdge>
            nodes={nodes} edges={edges} nodeTypes={flowNodeTypes}
            onInit={setRfInstance}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => onNodeSelect(node)}
            onPaneClick={() => onNodeSelect(null)}
            onSelectionChange={({ nodes: sel }) => { const s = sel[0] as FlowNode | undefined; if (s) onNodeSelect(s); }}
            onNodeDragStart={onNodeDragStartHandler}
            onNodeDrag={onNodeDragHandler}
            onNodeDragStop={onNodeDragStopHandler}
            fitView minZoom={0.45} maxZoom={1.6}
            snapToGrid snapGrid={[20, 20]}
            proOptions={{ hideAttribution: true }}
            className="bg-transparent"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="rgba(59,130,246,0.15)" />

            {/* 对齐辅助线 SVG —— 坐标基于 flow 坐标系，随画布缩放平移 */}
            {alignLines.length > 0 && (
              <svg
                className="pointer-events-none absolute inset-0"
                style={{ width: '100%', height: '100%', overflow: 'visible' }}
              >
                {alignLines.map((ln, i) =>
                  ln.type === 'vertical' ? (
                    <line key={`v-${i}`} x1={ln.flowPos} y1={-100000} x2={ln.flowPos} y2={100000}
                      stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.85} />
                  ) : (
                    <line key={`h-${i}`} x1={-100000} y1={ln.flowPos} x2={100000} y2={ln.flowPos}
                      stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.85} />
                  ),
                )}
              </svg>
            )}

            <MiniMap pannable zoomable className="!rounded-2xl !border !border-gray-200 !bg-white/90"
              nodeColor={(n) => mmColor(n as FlowNode)} />
            <Controls className="!rounded-2xl !border !border-gray-200 !bg-white/90 !shadow-sm" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
