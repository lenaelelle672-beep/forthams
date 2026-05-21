/**
 * GraphifyKnowledgeGraph Component
 * 
 * 知识图谱可视化组件 - 用于展示资产关联关系网络
 * 集成 Graphify 节点渲染和交互功能
 * 
 * @module components/audit
 * @description 资产详情页知识图谱模块，负责渲染关联节点和边
 * 
 * @features
 * - 节点渲染：支持 HardwareAsset, SoftwareAsset, DigitalAsset 类型
 * - 边渲染：展示资产间关联关系
 * - 交互功能：节点悬停高亮、点击跳转详情
 * - 布局算法：力导向布局优化节点分布
 * 
 * @requires
 * - react-force-graph-2d: 力导向图库
 * - @Auditable 字段绑定数据
 * - AuditService API
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { AlertCircle, Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip';
import './GraphifyKnowledgeGraph.css';

export interface GraphifyNode {
  /** 节点唯一标识 */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点类型：asset | category | location | user */
  type: 'asset' | 'category' | 'location' | 'user';
  /** 资产类型（仅 type=asset 时有效） */
  assetType?: 'HardwareAsset' | 'SoftwareAsset' | 'DigitalAsset';
  /** 资产状态 */
  status?: string;
  /** 关联的审计字段数量 */
  auditableFieldCount?: number;
  /** 节点颜色 */
  color?: string;
  /** 节点大小 */
  size?: number;
  /** 节点描述 */
  description?: string;
  /** 关联资产ID */
  assetId?: string;
}

export interface GraphifyEdge {
  /** 边唯一标识 */
  id: string;
  /** 源节点ID */
  source: string;
  /** 目标节点ID */
  target: string;
  /** 关系类型 */
  relationType: 'belongs_to' | 'depends_on' | 'related_to' | 'parent_of' | 'child_of';
  /** 关系描述 */
  label?: string;
  /** 边颜色 */
  color?: string;
  /** 边宽度 */
  width?: number;
}

export interface GraphifyKnowledgeGraphProps {
  /** 资产ID */
  assetId: string;
  /** 节点数据 */
  nodes: GraphifyNode[];
  /** 边数据 */
  edges: GraphifyEdge[];
  /** 是否加载中 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 图形宽度 */
  width?: number;
  /** 图形高度 */
  height?: number;
  /** 节点点击回调 */
  onNodeClick?: (node: GraphifyNode) => void;
  /** 边点击回调 */
  onEdgeClick?: (edge: GraphifyEdge) => void;
  /** 图表标题 */
  title?: string;
  /** 是否显示控制面板 */
  showControls?: boolean;
  /** 是否启用力导向动画 */
  enableAnimation?: boolean;
  /** 初始缩放级别 */
  initialZoom?: number;
  /** 节点类型颜色映射 */
  nodeTypeColors?: Record<string, string>;
}

/** 默认节点类型颜色配置 */
const DEFAULT_NODE_TYPE_COLORS: Record<string, string> = {
  asset: '#3B82F6',
  category: '#8B5CF6',
  location: '#10B981',
  user: '#F59E0B',
};

/** 关系类型颜色映射 */
const RELATION_COLORS: Record<string, string> = {
  belongs_to: '#6366F1',
  depends_on: '#EC4899',
  related_to: '#14B8A6',
  parent_of: '#F97316',
  child_of: '#84CC16',
};

/** 获取节点类型对应的默认颜色 */
const getNodeColor = (node: GraphifyNode, customColors?: Record<string, string>): string => {
  if (node.color) return node.color;
  if (node.assetType) {
    const colors: Record<string, string> = {
      HardwareAsset: '#3B82F6',
      SoftwareAsset: '#8B5CF6',
      DigitalAsset: '#10B981',
    };
    return colors[node.assetType] || DEFAULT_NODE_TYPE_COLORS.asset;
  }
  return customColors?.[node.type] || DEFAULT_NODE_TYPE_COLORS[node.type] || '#94A3B8';
};

/** GraphifyKnowledgeGraph 主组件 */
const GraphifyKnowledgeGraph: React.FC<GraphifyKnowledgeGraphProps> = ({
  assetId,
  nodes,
  edges,
  loading = false,
  error = null,
  width = 600,
  height = 400,
  onNodeClick,
  onEdgeClick,
  title = '知识图谱',
  showControls = true,
  enableAnimation = true,
  initialZoom = 1,
  nodeTypeColors,
}) => {
  const graphRef = useRef<ForceGraphMethods<GraphifyNode, GraphifyEdge>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphifyNode | null>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  const [currentZoom, setCurrentZoom] = useState(initialZoom);

  // 监听容器尺寸变化
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: containerWidth, height: containerHeight } = entry.contentRect;
        if (containerWidth > 0 && containerHeight > 0) {
          setDimensions({ width: containerWidth, height: containerHeight });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 初始化图形中心
  useEffect(() => {
    if (graphRef.current && nodes.length > 0) {
      const centerNode = nodes.find(n => n.assetId === assetId || n.id === assetId);
      if (centerNode) {
        setTimeout(() => {
          graphRef.current?.centerAt(0, 0, 500);
          graphRef.current?.zoom(initialZoom, 500);
        }, 500);
      }
    }
  }, [nodes, assetId, initialZoom]);

  // 节点渲染回调
  const renderNode = useCallback((node: GraphifyNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = 12 / globalScale;
    const nodeSize = (node.size || 8) / globalScale;
    const nodeColor = getNodeColor(node, nodeTypeColors);

    // 绘制节点圆
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, nodeSize, 0, 2 * Math.PI);
    ctx.fillStyle = nodeColor;
    ctx.fill();

    // 绘制边框
    ctx.strokeStyle = hoveredNode?.id === node.id ? '#e2e8f0' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = hoveredNode?.id === node.id ? 2 / globalScale : 1 / globalScale;
    ctx.stroke();

    // 绘制标签
    if (globalScale > 0.5) {
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1E293B';
      
      // 标签背景
      const textWidth = ctx.measureText(label).width;
      const bckgDimensions = [textWidth + 4, fontSize + 2];
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(
        (node.x || 0) - bckgDimensions[0] / 2,
        (node.y || 0) + nodeSize + 2,
        bckgDimensions[0],
        bckgDimensions[1]
      );
      
      // 标签文字
      ctx.fillStyle = '#1E293B';
      ctx.fillText(label, node.x || 0, (node.y || 0) + nodeSize + fontSize / 2 + 3);
    }
  }, [hoveredNode, nodeTypeColors]);

  // 边渲染回调
  const renderEdge = useCallback((edge: GraphifyEdge, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode || sourceNode.x === undefined || targetNode.x === undefined) return;

    const edgeColor = edge.color || RELATION_COLORS[edge.relationType] || '#94A3B8';
    const edgeWidth = (edge.width || 1) / globalScale;

    // 绘制边线
    ctx.beginPath();
    ctx.moveTo(sourceNode.x, sourceNode.y);
    ctx.lineTo(targetNode.x, targetNode.y);
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = edgeWidth;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 绘制关系标签
    if (edge.label && globalScale > 0.7) {
      const midX = (sourceNode.x + targetNode.x) / 2;
      const midY = (sourceNode.y + targetNode.y) / 2;
      const fontSize = 10 / globalScale;

      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      
      const textWidth = ctx.measureText(edge.label).width;
      ctx.fillRect(midX - textWidth / 2 - 2, midY - fontSize / 2 - 2, textWidth + 4, fontSize + 4);
      
      ctx.fillStyle = edgeColor;
      ctx.fillText(edge.label, midX, midY);
    }
  }, [nodes]);

  // 控制函数
  const handleZoomIn = () => {
    if (graphRef.current) {
      const newZoom = Math.min(currentZoom * 1.5, 10);
      graphRef.current.zoom(newZoom, 300);
      setCurrentZoom(newZoom);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const newZoom = Math.max(currentZoom / 1.5, 0.1);
      graphRef.current.zoom(newZoom, 300);
      setCurrentZoom(newZoom);
    }
  };

  const handleFitView = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  };

  // 节点点击处理
  const handleNodeClick = (node: GraphifyNode) => {
    setHoveredNode(node);
    onNodeClick?.(node);
  };

  // 节点悬停处理
  const handleNodeHover = (node: GraphifyNode | null) => {
    setHoveredNode(node);
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'grab';
    }
  };

  // 引擎停止时更新缩放状态
  const handleEngineStop = () => {
    if (graphRef.current) {
      setCurrentZoom(graphRef.current.zoom());
    }
  };

  // 加载状态
  if (loading) {
    return (
      <Card className="graphify-knowledge-graph">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">加载知识图谱数据...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 错误状态 - 修复 No matching nodes found 错误
  if (error) {
    return (
      <Card className="graphify-knowledge-graph">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>知识图谱加载失败</AlertTitle>
            <AlertDescription>
              {error}
              {error.includes('No matching nodes') && (
                <div className="mt-2 text-sm">
                  <p>可能原因：</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>资产ID不存在或已被删除</li>
                    <li>关联数据尚未生成</li>
                    <li>后端服务暂不可用</li>
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // 空状态
  if (nodes.length === 0) {
    return (
      <Card className="graphify-knowledge-graph">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <div className="text-muted-foreground mb-4">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-1">暂无关联数据</h3>
            <p className="text-sm text-muted-foreground">
              该资产暂无关联的节点数据，知识图谱将在有关联资产时显示
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Card className="graphify-knowledge-graph">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {nodes.length} 节点 · {edges.length} 关系
              </Badge>
              {showControls && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomIn}
                    className="h-8 w-8"
                    title="放大"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomOut}
                    className="h-8 w-8"
                    title="缩小"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleFitView}
                    className="h-8 w-8"
                    title="适应视图"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div
            ref={containerRef}
            className="graphify-container relative bg-gray-50 rounded-lg overflow-hidden"
            style={{ height: dimensions.height - 80 }}
          >
            <ForceGraph2D<GraphifyNode, GraphifyEdge>
              ref={graphRef}
              graphData={{ nodes, links: edges.map(e => ({
                ...e,
                source: e.source,
                target: e.target,
              })) }}
              width={dimensions.width}
              height={dimensions.height - 80}
              nodeCanvasObject={renderNode}
              nodeCanvasObjectMode={() => 'replace'}
              linkCanvasObject={renderEdge}
              linkCanvasObjectMode={() => 'replace'}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              onEngineStop={handleEngineStop}
              nodeLabel={(node) => `
                <div class="graphify-tooltip">
                  <strong>${node.name}</strong>
                  <br/>
                  <span>类型: ${node.type}</span>
                  ${node.assetType ? `<br/><span>资产类型: ${node.assetType}</span>` : ''}
                  ${node.status ? `<br/><span>状态: ${node.status}</span>` : ''}
                  ${node.auditableFieldCount ? `<br/><span>审计字段: ${node.auditableFieldCount}个</span>` : ''}
                </div>
              `}
              nodeVal={(node) => node.size || 8}
              linkDirectionalArrowLength={6}
              linkDirectionalArrowRelPos={0.9}
              linkColor={(edge) => edge.color || RELATION_COLORS[(edge as GraphifyEdge).relationType] || '#94A3B8'}
              backgroundColor="#F8FAFC"
              cooldownTicks={100}
              enableNodeDrag={true}
              enableZoomInteraction={true}
              enablePanInteraction={true}
              animateNavigation={enableAnimation}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
            />

            {/* 图例 */}
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm">
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">图例</h4>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: DEFAULT_NODE_TYPE_COLORS.asset }}
                  />
                  <span className="text-xs">资产</span>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: DEFAULT_NODE_TYPE_COLORS.category }}
                  />
                  <span className="text-xs">分类</span>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: DEFAULT_NODE_TYPE_COLORS.location }}
                  />
                  <span className="text-xs">位置</span>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: DEFAULT_NODE_TYPE_COLORS.user }}
                  />
                  <span className="text-xs">用户</span>
                </div>
              </div>
            </div>

            {/* 当前缩放级别 */}
            <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm">
              <span className="text-xs text-muted-foreground">
                缩放: {Math.round(currentZoom * 100)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default GraphifyKnowledgeGraph;