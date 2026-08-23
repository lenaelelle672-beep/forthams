import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { addEdge, type Connection, useEdgesState, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { FlowCanvas } from '../../components/flow/FlowCanvas';
import { NodeConfigPanel } from '../../components/flow/NodeConfigPanel';
import { NodePanel } from '../../components/flow/NodePanel';
import {
  flowDesignerApi,
  type FlowDesignerDefinitionDTO,
  type FlowDesignerEdgeDTO,
  type FlowDesignerGraphDTO,
  type FlowDesignerNodeDTO,
  type FlowDesignerValidationResult,
  type WorkflowDefinitionVersionDTO,
} from '../../api/flowDesigner';
import {
  createFlowEdge,
  createFlowNode,
  initialFlowEdges,
  initialFlowNodes,
  type FlowEdge,
  type FlowNode,
  type FlowNodeData,
  type FlowNodeType,
} from '../../types/flow';

type SystemFlowDesignerWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const defaultGraph: FlowDesignerGraphDTO = {
  id: 'ASSET_TRANSFER',
  name: '资产转移流程',
  description: '用于资产转移审批',
  nodes: [
    { id: 'start', type: 'START', label: '开始' },
    { id: 'approval', type: 'APPROVAL', label: '部门审批' },
    { id: 'end', type: 'END', label: '结束' },
  ],
  edges: [
    { id: 'edge-start-approval', source: 'start', target: 'approval' },
    { id: 'edge-approval-end', source: 'approval', target: 'end' },
  ],
};

type FlowDesignerNodeWithCanvas = FlowDesignerNodeDTO & {
  data?: Record<string, unknown>;
  position?: { x?: unknown; y?: unknown };
};

type FlowDesignerEdgeWithCanvas = FlowDesignerEdgeDTO & {
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

function cloneNodes() {
  return initialFlowNodes.map((node) => ({ ...node, position: { ...node.position }, data: { ...node.data } }));
}

function cloneEdges() {
  return initialFlowEdges.map((edge) => ({ ...edge, data: edge.data ? { ...edge.data } : edge.data }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textFrom(values: unknown[], fallback = '') {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

function numberFrom(value: unknown, fallback: number) {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function flowTypeFromDesigner(type: unknown): FlowNodeType {
  const normalized = String(type ?? '').toUpperCase();
  if (normalized === 'START') return 'start';
  if (normalized === 'END') return 'end';
  if (normalized === 'TASK' || normalized === 'USER_TASK' || normalized === 'SERVICE_TASK' || normalized === 'FORM') return 'task';
  if (normalized === 'NOTIFY' || normalized === 'CC') return 'cc';
  if (normalized === 'EXCLUSIVE_GATEWAY' || normalized === 'PARALLEL_GATEWAY' || normalized === 'CONDITION') return 'condition';
  return 'approval';
}

function designerTypeFromFlow(type: FlowNodeType) {
  const map: Record<FlowNodeType, string> = {
    start: 'START',
    approval: 'APPROVAL',
    task: 'TASK',
    cc: 'NOTIFY',
    condition: 'EXCLUSIVE_GATEWAY',
    end: 'END',
  };
  return map[type];
}

function positionFromNode(node: FlowDesignerNodeWithCanvas, index: number, type: FlowNodeType) {
  const config = isRecord(node.config) ? node.config : {};
  const position = isRecord(node.position) ? node.position : isRecord(config.position) ? config.position : null;
  const fallbackX = type === 'condition' ? 360 : 320;
  return {
    x: numberFrom(position?.x, fallbackX),
    y: numberFrom(position?.y, 80 + index * 170),
  };
}

function nodeDataFromDesigner(node: FlowDesignerNodeWithCanvas, type: FlowNodeType) {
  const config = isRecord(node.config) ? node.config : {};
  const data = isRecord(node.data) ? node.data : {};
  const { type: _dataType, position: _dataPosition, ...safeData } = data;
  const { position: _configPosition, ...safeConfig } = config;
  const label = textFrom([node.label, safeConfig.label, safeData.label], node.id);
  const approvalMode = textFrom([safeConfig.approvalMode, safeData.approvalMode], 'sequence');

  return {
    ...safeData,
    ...safeConfig,
    label,
    description: textFrom([safeConfig.description, safeData.description], label),
    nodeCode: textFrom([safeConfig.nodeCode, safeData.nodeCode], node.id.toUpperCase()),
    triggerType: textFrom([safeConfig.triggerType, safeData.triggerType], type === 'start' ? '表单提交' : ''),
    approverType: textFrom([safeConfig.approverType, safeData.approverType]) === 'user' ? 'user' : 'role',
    approverRole: textFrom([safeConfig.approverRole, safeData.approverRole], type === 'approval' || type === 'task' ? 'SUPER_ADMIN' : ''),
    approverRoleName: textFrom([safeConfig.approverRoleName, safeData.approverRoleName]),
    approverId: textFrom([safeConfig.approverId, safeData.approverId]),
    approvalMode: approvalMode === 'any' || approvalMode === 'all' ? approvalMode : 'sequence',
    conditionExpression: textFrom([safeConfig.conditionExpression, safeData.conditionExpression], type === 'condition' ? '申请金额 >= 5000' : ''),
    trueLabel: textFrom([safeConfig.trueLabel, safeData.trueLabel], type === 'condition' ? '满足条件' : ''),
    falseLabel: textFrom([safeConfig.falseLabel, safeData.falseLabel], type === 'condition' ? '不满足条件' : ''),
    resultAction: textFrom([safeConfig.resultAction, safeData.resultAction], type === 'end' ? '流程结束并归档' : ''),
    formSource: textFrom([safeConfig.formSource, safeData.formSource], type === 'start' || type === 'approval' ? '<form><label>审批意见</label><textarea name="approvalComment"></textarea></form>' : ''),
    formSectionName: textFrom([safeConfig.formSectionName, safeData.formSectionName], type === 'start' ? '申请信息' : type === 'approval' ? '审批意见' : ''),
    formSummaryFields: textFrom([safeConfig.formSummaryFields, safeData.formSummaryFields], type === 'start' ? 'reason,amount' : ''),
    ccRoleCodes: textFrom([safeConfig.ccRoleCodes, safeData.ccRoleCodes], type === 'cc' ? 'SUPER_ADMIN' : ''),
    ccUserIds: textFrom([safeConfig.ccUserIds, safeData.ccUserIds]),
  } satisfies Partial<FlowNodeData> & Record<string, unknown>;
}

function graphToCanvas(graph: FlowDesignerGraphDTO) {
  const sourceNodes = Array.isArray(graph.nodes) && graph.nodes.length > 0 ? graph.nodes : defaultGraph.nodes;
  const nodes = sourceNodes.map((rawNode, index) => {
    const node = rawNode as FlowDesignerNodeWithCanvas;
    const type = flowTypeFromDesigner(node.type ?? node.data?.type);
    return createFlowNode(type, positionFromNode(node, index, type), {
      id: node.id,
      data: nodeDataFromDesigner(node, type),
    });
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (Array.isArray(graph.edges) ? graph.edges : [])
    .map((rawEdge) => {
      const edge = rawEdge as FlowDesignerEdgeWithCanvas;
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return null;
      const next = createFlowEdge({
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
      });
      if (!next) return null;
      return {
        ...next,
        id: edge.id ?? next.id,
        label: edge.label ?? next.label,
      };
    })
    .filter(Boolean) as FlowEdge[];

  return {
    nodes: nodes.length > 0 ? nodes : cloneNodes(),
    edges: edges.length > 0 ? edges : cloneEdges().filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
  };
}

function canvasToGraph(
  businessType: string,
  name: string,
  description: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): FlowDesignerGraphDTO {
  return {
    id: businessType,
    name,
    description,
    nodes: nodes.map((node) => {
      const { type: _type, label: _label, description: nodeDescription, nodeCode, ...restData } = node.data;
      return {
        id: node.id,
        type: designerTypeFromFlow(node.type ?? node.data.type),
        label: node.data.label,
        config: {
          ...restData,
          description: nodeDescription,
          nodeCode,
          position: node.position,
        },
      };
    }),
    edges: edges.map((edge) => {
      const dto: FlowDesignerEdgeWithCanvas = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
      };
      if (typeof edge.label === 'string' && edge.label) dto.label = edge.label;
      if (edge.sourceHandle) dto.sourceHandle = edge.sourceHandle;
      if (edge.targetHandle) dto.targetHandle = edge.targetHandle;
      return dto;
    }),
  };
}

function graphFromDefinition(definition: FlowDesignerDefinitionDTO | null): FlowDesignerGraphDTO {
  const graph = definition?.definition as FlowDesignerGraphDTO | null | undefined;
  if (graph?.nodes && graph?.edges) {
    return {
      id: graph.id ?? definition?.businessType ?? defaultGraph.id,
      name: graph.name ?? definition?.name ?? defaultGraph.name,
      description: graph.description ?? definition?.description ?? defaultGraph.description,
      nodes: graph.nodes,
      edges: graph.edges,
    };
  }
  return defaultGraph;
}

export default function SystemFlowDesignerWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemFlowDesignerWorkbenchPageProps) {
  const [definitions, setDefinitions] = useState<FlowDesignerDefinitionDTO[]>([]);
  const [selectedBusinessType, setSelectedBusinessType] = useState(defaultGraph.id ?? 'ASSET_TRANSFER');
  const [selectedDefinition, setSelectedDefinition] = useState<FlowDesignerDefinitionDTO | null>(null);
  const [draftName, setDraftName] = useState(defaultGraph.name ?? '流程设计器草稿');
  const [draftDescription, setDraftDescription] = useState(defaultGraph.description ?? '');
  const initialCanvas = useMemo(() => graphToCanvas(defaultGraph), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialCanvas.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialCanvas.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialCanvas.nodes[1]?.id ?? initialCanvas.nodes[0]?.id ?? null);
  const [versions, setVersions] = useState<WorkflowDefinitionVersionDTO[]>([]);
  const [validationResult, setValidationResult] = useState<FlowDesignerValidationResult | null>(null);
  const [loading, setLoading] = useState(canView);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedVersion = useMemo(() => versions[0], [versions]);
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  const buildGraph = useCallback(() => canvasToGraph(selectedBusinessType, draftName, draftDescription, nodes, edges), [draftDescription, draftName, edges, nodes, selectedBusinessType]);

  const loadDesigner = async (businessType = selectedBusinessType) => {
    setLoading(true);
    setError(null);
    try {
      const [nextDefinitions, nextDefinition, nextVersions] = await Promise.all([
        flowDesignerApi.listDefinitions(),
        flowDesignerApi.getDesigner(businessType),
        flowDesignerApi.listVersions(businessType),
      ]);
      const graph = graphFromDefinition(nextDefinition);
      const canvas = graphToCanvas(graph);
      setDefinitions(nextDefinitions);
      setSelectedDefinition(nextDefinition);
      setSelectedBusinessType(businessType);
      setDraftName(nextDefinition.name ?? graph.name ?? businessType);
      setDraftDescription(nextDefinition.description ?? graph.description ?? '');
      setNodes(canvas.nodes);
      setEdges(canvas.edges);
      setSelectedNodeId(canvas.nodes.find((node) => node.type === 'approval' || node.type === 'task')?.id ?? canvas.nodes[0]?.id ?? null);
      setVersions(nextVersions);
      setValidationResult(null);
      setMessage(null);
    } catch {
      setDefinitions([]);
      setVersions([]);
      setSelectedDefinition(null);
      setError('流程设计器加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadDesigner(defaultGraph.id ?? 'ASSET_TRANSFER');
  }, [canView]);

  const runValidation = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await flowDesignerApi.validateGraph(selectedBusinessType, buildGraph());
      setValidationResult(result);
      setMessage(result.valid ? '图结构校验通过，可进入发布复核。' : '图结构校验未通过，请修复错误后再发布。');
    } catch {
      setError('图结构校验失败，敏感细节已脱敏');
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await flowDesignerApi.saveDraft(selectedBusinessType, {
        name: draftName,
        description: draftDescription,
        graph: buildGraph(),
      });
      setSelectedDefinition(saved);
      setMessage('草稿已通过 /workflows/{businessType}/designer/draft 保存。');
    } catch {
      setError('草稿保存失败，敏感细节已脱敏');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      const published = await flowDesignerApi.publish(selectedBusinessType, {
        confirmed: true,
        publishNote: '流程设计器发布复核通过',
        impactScope: '仅影响后续新发起审批实例',
        rollbackPlan: '通过版本历史恢复到上一稳定版本',
      });
      const nextVersions = await flowDesignerApi.listVersions(selectedBusinessType);
      setSelectedDefinition(published);
      setVersions(nextVersions);
      setMessage('发布完成：后端已记录 operatorId、影响范围与回滚预案。');
    } catch {
      setError('发布失败，请确认图结构、权限与二次确认。');
    } finally {
      setSaving(false);
    }
  };

  const rollbackLatest = async () => {
    if (!selectedVersion) return;
    setSaving(true);
    setError(null);
    try {
      const rolledBack = await flowDesignerApi.rollback(selectedBusinessType, selectedVersion.version, {
        confirmed: true,
        reason: `恢复到 v${selectedVersion.version} 稳定版本`,
        impactScope: '仅影响后续新发起审批实例',
        rollbackPlan: '必要时再次恢复到发布前版本',
      });
      const nextVersions = await flowDesignerApi.listVersions(selectedBusinessType);
      setSelectedDefinition(rolledBack);
      setVersions(nextVersions);
      setMessage(`已通过 /versions/${selectedVersion.version}/rollback 恢复版本并追加审计证据。`);
    } catch {
      setError('版本恢复失败，请确认 rollback 权限与审计原因。');
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadDesigner(selectedBusinessType);
  };

  const handleAddNode = useCallback((type: FlowNodeType, position?: { x: number; y: number }) => {
    setValidationResult(null);
    setNodes((current) => {
      const node = createFlowNode(type, position ?? { x: 320, y: 80 + current.length * 170 });
      setSelectedNodeId(node.id);
      return [...current, node];
    });
  }, [setNodes]);

  const handleConnect = useCallback((connection: Connection) => {
    const edge = createFlowEdge(connection);
    if (!edge || edge.source === edge.target) return;
    setValidationResult(null);
    setEdges((current) => current.some((item) => item.source === edge.source && item.target === edge.target && item.sourceHandle === edge.sourceHandle) ? current : addEdge(edge, current));
  }, [setEdges]);

  const handleUpdateNode = useCallback((id: string, patch: Partial<FlowNodeData> & Record<string, unknown>) => {
    setValidationResult(null);
    setNodes((current) => current.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node));
  }, [setNodes]);

  const handleDeleteNode = useCallback((id: string) => {
    setValidationResult(null);
    setNodes((current) => current.filter((node) => node.id !== id));
    setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    setSelectedNodeId((current) => current === id ? null : current);
  }, [setEdges, setNodes]);

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问流程设计器，请确认 system:flow:query、workflow:designer:edit、workflow:designer:publish 与 workflow:designer:rollback 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">流程设计器</h3>
          <p className="mt-1 text-sm text-slate-500">
            真实调用 /workflows、/workflows/{'{businessType}'}/designer/draft、/designer/validate、/publish 与 /versions/{'{version}'}/rollback。
          </p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading || saving}
          type="button"
          onClick={() => void loadDesigner(selectedBusinessType)}
        >
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        发布与版本恢复均要求后端权限 fail-closed、confirmed=true、operatorId、审计原因、影响范围与回滚预案；前端按钮仅作体验辅助。
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleSelect}>
        <label className="sr-only" htmlFor="flow-designer-business-type">业务流程类型</label>
        <select
          id="flow-designer-business-type"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={selectedBusinessType}
          onChange={(event) => setSelectedBusinessType(event.target.value)}
        >
          {(definitions.length > 0 ? definitions : [{ businessType: selectedBusinessType, name: draftName }]).map((definition) => (
            <option key={definition.businessType} value={definition.businessType}>{definition.name} · {definition.businessType}</option>
          ))}
        </select>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={loading || saving} type="submit">
          载入设计
        </button>
      </form>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium">草稿名称</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" value={draftName} onChange={(event) => setDraftName(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium">草稿说明</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} />
          </label>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <h4 className="text-base font-semibold text-slate-900">大画布流程建模工作台</h4>
              <p className="mt-1 text-xs text-slate-500">左侧节点库、可视化流程画布、右侧节点属性同屏；拖拽左侧节点到画布，移动节点后保存草稿。</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">拖拽环节节点</span>
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-cyan-700">连线分支</span>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">右侧属性配置</span>
            </div>
          </div>
          <div className="grid gap-3 xl:h-[680px] xl:grid-cols-[260px_minmax(0,1fr)_320px]">
            <div className="h-[360px] xl:h-full">
              <NodePanel onAddNode={(type) => handleAddNode(type)} />
            </div>
            <div className="h-[560px] overflow-hidden rounded-2xl border border-slate-100 xl:h-full">
              <FlowCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
                onNodeSelect={(node) => setSelectedNodeId(node?.id ?? null)}
                onAddNodeAtPosition={handleAddNode}
              />
            </div>
            <div className="h-[560px] overflow-hidden xl:h-full">
              <NodeConfigPanel
                selectedNode={selectedNode}
                edges={edges}
                onUpdateNode={handleUpdateNode}
                onDeleteNode={handleDeleteNode}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100" disabled={saving} type="button" onClick={saveDraft}>
            保存草稿
          </button>
          <button className="rounded-xl border border-blue-200 px-4 py-2 text-sm text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100" disabled={saving} type="button" onClick={runValidation}>
            图结构校验
          </button>
          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={saving} type="button" onClick={publish}>
            发布流程
          </button>
          <button className="rounded-xl bg-amber-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={saving || !selectedVersion} type="button" onClick={rollbackLatest}>
            恢复最近版本
          </button>
        </div>

        <aside className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-3 font-semibold">当前定义</h4>
            <dl className="space-y-2 text-sm text-slate-600">
              <div><dt className="text-xs text-slate-500">状态 / 版本</dt><dd>{selectedDefinition?.status ?? 'UNCONFIGURED'} / v{selectedDefinition?.version ?? 0}</dd></div>
              <div><dt className="text-xs text-slate-500">节点 / 连线</dt><dd>{nodes.length} / {edges.length}</dd></div>
              <div><dt className="text-xs text-slate-500">最后更新时间</dt><dd>{selectedDefinition?.updateTime ?? '-'}</dd></div>
            </dl>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <h4 className="mb-3 font-semibold">校验与审计证据</h4>
            {validationResult ? (
              <div className="space-y-2 text-sm text-slate-600">
                <p className={validationResult.valid ? 'text-green-700' : 'text-red-700'}>{validationResult.valid ? '校验通过' : '校验失败'}</p>
                <p>节点 {validationResult.nodeCount} 个，连线 {validationResult.edgeCount} 条</p>
                {validationResult.errors.map((item) => <p key={item} className="text-red-700">{item}</p>)}
              </div>
            ) : <p className="text-sm text-slate-500">尚未执行图结构校验。</p>}
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <h4 className="mb-3 font-semibold">版本历史</h4>
            {versions.length === 0 ? <h3 className="text-sm font-medium text-slate-500">暂无发布/回滚审计版本。</h3> : null}
            <div className="space-y-2 text-sm text-slate-600">
              {versions.slice(0, 5).map((version) => (
                <div key={version.id ?? `${version.version}-${version.actionType}`} className="rounded-xl bg-slate-50 px-3 py-2">
                  v{version.version} · {version.actionType} · {version.publishedAt ?? version.createTime ?? '-'}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {message ? <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">流程设计器加载中...</div> : null}
    </section>
  );
}
