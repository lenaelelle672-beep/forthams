import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addEdge, type Connection, type EdgeChange, type NodeChange, useEdgesState, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Code, Layers3, Loader2, Play, Redo, RefreshCw, Save, Send, Undo, UserCheck, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';

import { FlowCanvas } from '@/components/flow/FlowCanvas';
import { NodeConfigPanel } from '@/components/flow/NodeConfigPanel';
import { NodePanel } from '@/components/flow/NodePanel';
import { workflowApi, roleApi, type RoleRecord, type WorkflowAssigneePreviewResponse, type WorkflowDefinitionDTO } from '@/api/workflow';
import { useAuth, type AuthUser } from '@/context/AuthContext';
import { businessFlowOptions, getDraftStorageKey, isBusinessType, isCustomBusinessType } from '@/constants/workflowBusiness';
import { normalizeWorkflowDefinition, validateWorkflowDefinition } from '@/utils/workflowDefinition';
import { createFlowEdge, initialFlowEdges, initialFlowNodes, type FlowEdge, type FlowDefinition, type FlowNode, type FlowNodeData, type FlowNodeType } from '@/types/flow';

function cloneNodes() { return initialFlowNodes.map((n) => ({ ...n, position: { ...n.position }, data: { ...n.data } })); }
function cloneEdges() { return initialFlowEdges.map((e) => ({ ...e, data: e.data ? { ...e.data } : e.data })); }

function createFlowNode(type: FlowNodeType, pos: { x: number; y: number }): FlowNode {
  const base = initialFlowNodes.find((n) => n.type === type) ?? initialFlowNodes[1];
  return {
    ...base,
    id: type + '-' + Date.now(),
    type: type,
    position: { x: pos.x, y: pos.y },
    data: { ...base.data, nodeCode: (type + '_' + Date.now()).toUpperCase() },
  };
}

function readDraft(bt: string): Pick<FlowDefinition, 'nodes' | 'edges'> | null {
  try {
    const raw = localStorage.getItem(getDraftStorageKey(bt));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!Array.isArray(p.nodes) || !Array.isArray(p.edges)) return null;
    return syncLegacyFormSource(normalizeWorkflowDefinition(p, bt), typeof p.formSource === 'string' ? p.formSource : '');
  } catch { return null; }
}

function fromApi(val: Record<string, unknown> | undefined, bt: string): Pick<FlowDefinition, 'nodes' | 'edges'> | null {
  if (!val || !Array.isArray(val.nodes) || val.nodes.length === 0 || !Array.isArray(val.edges)) return null;
  return syncLegacyFormSource(normalizeWorkflowDefinition(val as unknown as FlowDefinition, bt), typeof val.formSource === 'string' ? val.formSource : '');
}

function syncLegacyFormSource(definition: Pick<FlowDefinition, 'nodes' | 'edges'>, legacyFormSource: string): Pick<FlowDefinition, 'nodes' | 'edges'> {
  if (!legacyFormSource.trim()) return definition;
  return {
    ...definition,
    nodes: (Array.isArray(definition.nodes) ? definition.nodes : []).map((node) => {
      if (node.type !== 'start' || (typeof node.data.formSource === 'string' && node.data.formSource.trim())) return node;
      return { ...node, data: { ...node.data, formSource: legacyFormSource, formSectionName: node.data.formSectionName || '申请信息' } };
    }),
  };
}

function nodeFormSource(nodes: FlowNode[], type: FlowNodeType) {
  const source = nodes.find((node) => node.type === type)?.data.formSource;
  return typeof source === 'string' ? source : '';
}

function autoPos(i: number) { return { x: 220 + (i % 2) * 220, y: 120 + Math.floor(i / 2) * 160 }; }

function readRoleField(role: RoleRecord, keys: string[]) {
  for (const k of keys) { const v = role[k]; if (v != null && v !== '') return String(v); }
  return '';
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  UNCONFIGURED: { label: '未配置', cls: 'bg-gray-100 text-gray-600' },
  DRAFT:        { label: '草稿',   cls: 'bg-amber-50 text-amber-700' },
  PUBLISHED:    { label: '已发布', cls: 'bg-green-50 text-green-700' },
  ENABLED:      { label: '已启用', cls: 'bg-green-50 text-green-700' },
  DISABLED:     { label: '已停用', cls: 'bg-red-50 text-red-700' },
};

function workflowStatusLabel(status: string) {
  return STATUS_STYLES[status]?.label ?? status;
}

/* ---------- undo/redo 快照 ---------- */
interface DesignerSnapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selId: string | null;
}

function deepCloneSnapshot(nodes: FlowNode[], edges: FlowEdge[], selId: string | null): DesignerSnapshot {
  return { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), selId };
}

const MAX_HISTORY = 50;

/* ---------- 判断当前焦点是否在输入组件中（避免快捷键误触） ---------- */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function canEditWorkflowDefinitions(user: AuthUser | null) {
  if (!user) return false;
  const permissions = user.permissions ?? [];
  if (permissions.length === 0) return true;
  return permissions.includes('*') || permissions.includes('*:*:*') || permissions.includes('workflow:definition:edit');
}

type AssigneePreviewSource = 'auto' | 'manual' | null;
type PreviewMode = Exclude<AssigneePreviewSource, null>;

function parsePreviewBusinessData(value: string): { ok: true; businessData: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, businessData: {} };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, businessData: parsed as Record<string, unknown> };
    }
    return { ok: false, error: '业务数据 JSON 必须是对象' };
  } catch {
    return { ok: false, error: '业务数据 JSON 格式无效' };
  }
}

function createAssigneePreviewKey(
  businessType: string,
  status: string,
  version: number,
  nodes: FlowNode[],
  edges: FlowEdge[],
  formSourceValue: string,
) {
  return JSON.stringify({
    businessType,
    status,
    version,
    formSource: formSourceValue,
    nodes: nodes.map((node) => ({ id: node.id, type: node.type, data: node.data })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: edge.data,
      label: edge.label,
    })),
  });
}

function AssigneePreviewPanel({
  preview,
  source,
  previewing,
  businessData,
  onBusinessDataChange,
  onPreview,
}: {
  preview: WorkflowAssigneePreviewResponse | null;
  source: AssigneePreviewSource;
  previewing: boolean;
  businessData: string;
  onBusinessDataChange: (value: string) => void;
  onPreview: () => void;
}) {
  const missingFields = Array.isArray(preview?.missingFields) ? preview.missingFields : [];
  const nodes = Array.isArray(preview?.nodes) ? preview.nodes : [];
  const unresolvedNodes = nodes.filter((node) => !node.resolved || node.reason);
  const sourceText = source === 'auto'
    ? (preview?.calculable ? '已自动计算处理人' : '自动计算已运行')
    : '手动计算结果';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3" aria-label="处理人预览面板">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-gray-700">处理人预览</div>
        <button
          type="button"
          onClick={onPreview}
          disabled={previewing}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {previewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
          {preview ? '重新计算' : '计算处理人'}
        </button>
      </div>
      <textarea
        className="h-20 w-full resize-none rounded-md border border-gray-200 bg-gray-50 p-2 font-mono text-xs text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        value={businessData}
        onChange={(e) => onBusinessDataChange(e.target.value)}
        aria-label="业务数据 JSON"
      />
      {preview && (
        <div className={`mt-3 rounded-md border p-2 text-xs ${preview.calculable ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">{preview.calculable ? '已解析处理人' : '不可计算'}</div>
            <div className="text-[11px] opacity-80">{sourceText}</div>
          </div>
          {!preview.calculable && (
            <div className="mt-2 space-y-1">
              {preview.reason && <div>{preview.reason}</div>}
              {missingFields.length > 0 && <div>缺少字段：{missingFields.join('、')}</div>}
              {unresolvedNodes.length > 0 ? (
                unresolvedNodes.map((node) => (
                  <div key={node.nodeId} className="rounded border border-white/70 bg-white/70 px-2 py-1">
                    <div className="font-medium text-gray-800">{node.stepNo}. {node.label || node.nodeCode || node.nodeId}</div>
                    <div className="mt-0.5 text-amber-700">{node.reason || '节点未解析，请补全条件字段后重新计算'}</div>
                  </div>
                ))
              ) : (
                <div className="text-amber-700">处理人名单已隐藏，补全条件字段后再计算。</div>
              )}
            </div>
          )}
          {preview.calculable && (
            <div className="mt-2 space-y-1">
              {nodes.map((node) => (
                <div key={node.nodeId} className="rounded border border-white/70 bg-white/70 px-2 py-1">
                  <div className="font-medium text-gray-800">{node.stepNo}. {node.label || node.nodeCode || node.nodeId}</div>
                  {node.resolved ? (
                    <div className="mt-0.5 text-gray-600">
                      <div>已解析 {node.assigneeCount ?? (Array.isArray(node.assignees) ? node.assignees.length : 0)} 名候选处理人</div>
                      <div className="mt-0.5 text-gray-500">具体处理人名单已隐藏</div>
                    </div>
                  ) : (
                    <div className="mt-0.5 text-amber-700">{node.reason || '未解析'}</div>
                  )}
                </div>
              ))}
              {nodes.length === 0 && <div className="text-gray-500">未返回可展示节点</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkflowDesignerPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const reqBt = sp.get('businessType');
  const reqBtStr = reqBt || '';
  const isCustom = reqBtStr ? isCustomBusinessType(reqBtStr) : false;
  const businessType: string = reqBtStr && (isBusinessType(reqBtStr) || isCustom) ? reqBtStr : 'ASSET_TRANSFER';
  const flow = businessFlowOptions.find((o) => o.businessType === businessType) ?? (isCustom
    ? { businessType, name: businessType.replace(/^CUSTOM_/, ''), description: '自定义流程', businessName: '自定义' as const, formPath: '' as const, stepCount: 4 as const, accentClass: 'bg-gray-400' as const }
    : businessFlowOptions[0]);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(cloneNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(cloneEdges());
  const [selId, setSelId] = useState<string | null>('approval-1');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [srvStatus, setSrvStatus] = useState('UNCONFIGURED');
  const [srvVersion, setSrvVersion] = useState(0);
  const [approverRoles, setApproverRoles] = useState<string[]>([]);
  const [roleDetails, setRoleDetails] = useState<Array<{ roleCode: string; roleName: string }>>([]);
  const [formSource, setFormSource] = useState('');
  const [showFormSource, setShowFormSource] = useState(false);
  const [srvName, setSrvName] = useState<string | null>(null);
  const [srvDesc, setSrvDesc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reloadingBackend, setReloadingBackend] = useState(false);
  const [previewingAssignees, setPreviewingAssignees] = useState(false);
  const [assigneePreview, setAssigneePreview] = useState<WorkflowAssigneePreviewResponse | null>(null);
  const [assigneePreviewSource, setAssigneePreviewSource] = useState<AssigneePreviewSource>(null);
  const [previewBusinessData, setPreviewBusinessData] = useState('{}');
  const [loadedAssigneePreviewKey, setLoadedAssigneePreviewKey] = useState('');
  const canEditWorkflow = useMemo(() => canEditWorkflowDefinitions(user), [user]);

  /* ---- undo / redo 历史栈 ---- */
  const pastStates = useRef<DesignerSnapshot[]>([]);
  const futureStates = useRef<DesignerSnapshot[]>([]);
  const autoPreviewedKeyRef = useRef<string | null>(null);

  const applyLoadedDefinition = useCallback((def: WorkflowDefinitionDTO, message: string | null) => {
    const defData = def.definition as Record<string, unknown> | undefined;
    const parsed = fromApi(defData, businessType);
    const nn = parsed?.nodes ?? cloneNodes();
    const ne = parsed?.edges ?? cloneEdges();
    const loadedFormSource = (typeof defData?.formSource === 'string' ? defData.formSource : '') || nodeFormSource(nn, 'start');
    setAssigneePreview(null);
    setNodes(nn);
    setEdges(ne);
    setSelId(nn.find((n) => n.type === 'approval')?.id ?? 'approval-1');
    setSrvStatus(def.status);
    setSrvVersion(def.version);
    setSrvName(def.name ?? null);
    setSrvDesc(def.description ?? null);
    setFormSource(loadedFormSource);
    setLoadedAssigneePreviewKey(createAssigneePreviewKey(businessType, def.status, def.version, nn, ne, loadedFormSource));
    pastStates.current = [];
    futureStates.current = [];
    setSaveErr(null);
    setSaveMsg(message);
  }, [businessType, setEdges, setNodes]);

  useEffect(() => {
    if (!assigneePreview) setAssigneePreviewSource(null);
  }, [assigneePreview]);

  const pushSnapshot = useCallback(() => {
    pastStates.current.push(deepCloneSnapshot(nodes, edges, selId));
    if (pastStates.current.length > MAX_HISTORY) pastStates.current.shift();
    futureStates.current = [];
  }, [nodes, edges, selId]);

  const handleUndo = useCallback(() => {
    const prev = pastStates.current.pop();
    if (!prev) return;
    setAssigneePreview(null);
    // 保存当前状态到 future 栈
    const cur = deepCloneSnapshot(nodes, edges, selId);
    futureStates.current.push(cur);
    if (futureStates.current.length > MAX_HISTORY) futureStates.current.shift();
    // 恢复历史
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setSelId(prev.selId);
  }, [nodes, edges, selId, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    const next = futureStates.current.pop();
    if (!next) return;
    setAssigneePreview(null);
    // 保存当前状态到 past 栈
    const cur = deepCloneSnapshot(nodes, edges, selId);
    pastStates.current.push(cur);
    if (pastStates.current.length > MAX_HISTORY) pastStates.current.shift();
    // 恢复
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelId(next.selId);
  }, [nodes, edges, selId, setNodes, setEdges]);

  useEffect(() => { if (!isBusinessType(reqBt) && !isCustomBusinessType(reqBt)) setSp({ businessType }, { replace: true }); }, [businessType, reqBt, setSp]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSaveErr(null);
      try {
        const raw = await workflowApi.get(businessType);
        const def = raw as WorkflowDefinitionDTO;
        if (cancelled) return;
        applyLoadedDefinition(def, def.id ? `已读取后端定义：${workflowStatusLabel(def.status)} v${def.version}` : null);
      } catch {
        if (cancelled) return;
        const draft = readDraft(businessType);
        const nn = draft?.nodes ?? cloneNodes();
        const ne = draft?.edges ?? cloneEdges();
        const draftFormSource = nodeFormSource(nn, 'start');
        setAssigneePreview(null);
        setNodes(nn); setEdges(ne);
        setSelId(nn.find((n) => n.type === 'approval')?.id ?? 'approval-1');
        setSrvStatus('UNCONFIGURED'); setSrvVersion(0);
        setSrvName(null); setSrvDesc(null);
        setFormSource(draftFormSource);
        setLoadedAssigneePreviewKey(createAssigneePreviewKey(businessType, 'UNCONFIGURED', 0, nn, ne, draftFormSource));
        setSaveMsg(draft ? '后端不可用，已恢复本地草稿' : null);
      }
    })();
    return () => { cancelled = true; };
  }, [applyLoadedDefinition, businessType, setEdges, setNodes]);

  useEffect(() => {
    let cancelled = false;
    if (!canEditWorkflow) return () => { cancelled = true; };
    (async () => {
      try {
        const res = await roleApi.getAll();
        let list: RoleRecord[] = [];
        if (Array.isArray(res)) list = res;
        if (list.length === 0) console.warn('[WorkflowDesignerPage] 角色加载结果为空列表，res=', res);
        const codes = list.map((role) => readRoleField(role, ['roleCode', 'role_code', 'code']) || readRoleField(role, ['roleName', 'role_name', 'name'])).filter(Boolean);
        const unique = Array.from(new Set(['SUPER_ADMIN', ...codes]));
        if (!cancelled && unique.length > 0) {
          setApproverRoles(unique);
          setRoleDetails(list.map((r) => ({ roleCode: readRoleField(r, ['roleCode', 'role_code', 'code']), roleName: readRoleField(r, ['roleName', 'role_name', 'name']) })).filter((r) => r.roleCode));
        }
      } catch { if (!cancelled) { setApproverRoles([]); setRoleDetails([]); } }
    })();
    return () => { cancelled = true; };
  }, [canEditWorkflow]);

  const selNode = useMemo(() => nodes.find((n) => n.id === selId) ?? null, [nodes, selId]);
  const flowDef = useMemo<FlowDefinition>(() => ({
    id: `WF-${businessType}`,
    name: isCustom && srvName ? srvName : flow.name,
    description: isCustom && srvDesc ? srvDesc : flow.description,
    nodes, edges
  }), [flow, businessType, isCustom, srvName, srvDesc, nodes, edges]);
  const normDef = useMemo(() => normalizeWorkflowDefinition(flowDef, businessType), [businessType, flowDef]);
  const valErrors = useMemo(() => validateWorkflowDefinition(normDef), [normDef]);

  const ensureValid = useCallback((action: string) => {
    if (valErrors.length === 0) return true;
    setSaveMsg(null); setSaveErr(`${action}前请补全：${valErrors.join('；')}`);
    return false;
  }, [valErrors]);

  /* ---- 流程修改操作（每个操作前保存快照以支持撤销） ---- */
  const handleAddNode = useCallback((type: FlowNodeType, pos?: { x: number; y: number }) => {
    if (!canEditWorkflow) return;
    setAssigneePreview(null);
    pushSnapshot();
    setNodes((cur) => { const n = createFlowNode(type, pos ?? autoPos(cur.length)); setSelId(n.id); return [...cur, n]; });
  }, [canEditWorkflow, setNodes, pushSnapshot]);

  const handleConnect = useCallback((conn: Connection) => {
    if (!canEditWorkflow) return;
    const edge = createFlowEdge(conn);
    if (!edge || edge.source === edge.target) { if (edge?.source === edge.target) { setSaveMsg(null); setSaveErr('同一节点不能连接自身'); } return; }
    setAssigneePreview(null);
    pushSnapshot();
    setEdges((cur) => cur.some((e) => e.source === edge.source && e.target === edge.target && e.sourceHandle === edge.sourceHandle) ? cur : addEdge(edge, cur));
  }, [canEditWorkflow, setEdges, pushSnapshot]);

  const handleUpdate = useCallback((id: string, patch: Partial<FlowNodeData>) => {
    if (!canEditWorkflow) return;
    setAssigneePreview(null);
    pushSnapshot();
    setNodes((cur) => cur.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
  }, [canEditWorkflow, setNodes, pushSnapshot]);

  const handleDelete = useCallback((id: string) => {
    if (!canEditWorkflow) return;
    setAssigneePreview(null);
    pushSnapshot();
    setNodes((cur) => cur.filter((n) => n.id !== id));
    setEdges((cur) => cur.filter((e) => e.source !== id && e.target !== id));
    setSelId((prev) => prev === id ? (nodes.find((n) => n.id !== id)?.id ?? null) : prev);
  }, [canEditWorkflow, nodes, setEdges, setNodes, pushSnapshot]);

  /* ---- 保存 / 发布 ---- */
  const defPayload = useMemo(() => {
    const base = normDef as unknown as Record<string, unknown>;
    const startFormSource = nodeFormSource(normDef.nodes, 'start');
    const topLevelFormSource = formSource || startFormSource;
    if (topLevelFormSource) {
      const nodes = normDef.nodes.map((node) => {
        if (node.type !== 'start') return node;
        return { ...node, data: { ...node.data, formSource: topLevelFormSource } };
      });
      return { ...base, formSource: topLevelFormSource, nodes };
    }
    const { formSource: _, ...rest } = base;
    return rest;
  }, [normDef, formSource]);

  const handleNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setAssigneePreview(null);
    onNodesChange(changes);
  }, [onNodesChange]);

  const handleEdgesChange = useCallback((changes: EdgeChange<FlowEdge>[]) => {
    setAssigneePreview(null);
    onEdgesChange(changes);
  }, [onEdgesChange]);

  const handleReloadBackendDefinition = useCallback(async () => {
    setReloadingBackend(true);
    setSaveMsg(null);
    setSaveErr(null);
    try {
      const raw = await workflowApi.get(businessType);
      const def = raw as WorkflowDefinitionDTO;
      applyLoadedDefinition(def, `已重新读取后端定义：${workflowStatusLabel(def.status)} v${def.version}`);
    } catch (e) {
      setSaveMsg(null);
      setSaveErr(e instanceof Error ? e.message : '重新读取后端定义失败');
    } finally {
      setReloadingBackend(false);
    }
  }, [applyLoadedDefinition, businessType]);

  const handleSaveDraft = useCallback(async () => {
    if (!canEditWorkflow) {
      setSaveMsg(null);
      setSaveErr('当前账号只有流程查看权限，无法保存流程草稿。');
      return;
    }
    setSaving(true);
    try {
      const raw = await workflowApi.saveDraft(businessType, { name: normDef.name, description: normDef.description, definition: defPayload });
      const saved = raw as WorkflowDefinitionDTO;
      localStorage.setItem(getDraftStorageKey(businessType), JSON.stringify({ ...normDef, formSource, savedAt: new Date().toISOString() }));
      setSrvStatus(saved.status); setSrvVersion(saved.version); setSaveErr(null);
      setSaveMsg(valErrors.length > 0 ? `${flow.name}已保存草稿，发布前需补全校验项` : `${flow.name}已保存草稿`);
    } catch {
      localStorage.setItem(getDraftStorageKey(businessType), JSON.stringify({ ...normDef, formSource, savedAt: new Date().toISOString() }));
      setSaveMsg(null); setSaveErr(`${flow.name}仅保存为本地草稿，后端未同步，请稍后重试`);
    } finally { setSaving(false); }
  }, [businessType, canEditWorkflow, flow.name, normDef, defPayload, formSource, valErrors.length]);

  const handlePublish = useCallback(async () => {
    if (!canEditWorkflow) {
      setSaveMsg(null);
      setSaveErr('当前账号只有流程查看权限，无法发布流程。');
      return;
    }
    if (!ensureValid('发布')) return;
    setPublishing(true);
    try {
      await workflowApi.saveDraft(businessType, { name: normDef.name, description: normDef.description, definition: defPayload });
      localStorage.setItem(getDraftStorageKey(businessType), JSON.stringify({ ...normDef, formSource, savedAt: new Date().toISOString() }));
      await workflowApi.publish(businessType);
      const raw = await workflowApi.get(businessType);
      const pub = raw as WorkflowDefinitionDTO;
      applyLoadedDefinition(pub, `${flow.name}已发布为 v${pub.version}`);
    } catch (e) { setSaveMsg(null); setSaveErr(e instanceof Error ? e.message : '发布失败'); }
    finally { setPublishing(false); }
  }, [applyLoadedDefinition, businessType, canEditWorkflow, ensureValid, flow.name, normDef, defPayload, formSource]);

  const handlePreviewAssignees = useCallback(async (mode: PreviewMode = 'manual') => {
    const parsedBusinessData = parsePreviewBusinessData(previewBusinessData);
    if (!parsedBusinessData.ok) {
      if (mode === 'manual') {
        setAssigneePreview(null);
        setSaveMsg(null);
        setSaveErr('error' in parsedBusinessData ? parsedBusinessData.error : '业务数据 JSON 格式无效');
      }
      return;
    }
    setPreviewingAssignees(true);
    try {
      const result = await workflowApi.previewAssignees(businessType, { definition: defPayload, businessData: parsedBusinessData.businessData });
      setAssigneePreview(result);
      setAssigneePreviewSource(mode);
      setSaveErr(null);
      if (mode === 'manual') setSaveMsg(result.calculable ? '处理人计算完成' : null);
    } catch (e) {
      setAssigneePreview(null);
      if (mode === 'manual') {
        setSaveMsg(null);
        setSaveErr(e instanceof Error ? e.message : '处理人计算失败');
      }
    } finally {
      setPreviewingAssignees(false);
    }
  }, [businessType, defPayload, previewBusinessData]);

  useEffect(() => {
    if (!loadedAssigneePreviewKey || autoPreviewedKeyRef.current === loadedAssigneePreviewKey) return;
    autoPreviewedKeyRef.current = loadedAssigneePreviewKey;
    void handlePreviewAssignees('auto');
  }, [handlePreviewAssignees, loadedAssigneePreviewKey]);

  const statusStyle = STATUS_STYLES[srvStatus] ?? STATUS_STYLES.UNCONFIGURED;

  /* ---- 快捷键绑定 ---- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // ⌘Z / Ctrl+Z → 撤销
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canEditWorkflow) handleUndo();
        return;
      }
      // ⌘⇧Z / Ctrl+Shift+Z → 重做
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (canEditWorkflow) handleRedo();
        return;
      }
      // ⌘S / Ctrl+S → 保存
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (canEditWorkflow) handleSaveDraft();
        return;
      }
      // Del / Backspace → 删除选中节点（仅当不在输入框中时）
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused()) {
        if (selId) {
          e.preventDefault();
          if (canEditWorkflow) handleDelete(selId);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [canEditWorkflow, handleUndo, handleRedo, handleSaveDraft, handleDelete, selId]);

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: breadcrumb + title */}
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              onClick={() => navigate('/workflows')}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">流程中心 / 设计器</p>
              <h1 className="text-lg font-semibold text-gray-900 truncate">{flow.name}</h1>
            </div>
          </div>

          {/* Center: business type selector + meta */}
          <div className="flex items-center gap-3">
            {isCustom ? (
              <span className="inline-flex items-center h-8 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500 font-mono">
                {businessType}
              </span>
            ) : (
              <select
                value={businessType}
                onChange={(e) => { if (isBusinessType(e.target.value)) setSp({ businessType: e.target.value }); }}
                className="h-8 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              >
                {businessFlowOptions.map((o) => <option key={o.businessType} value={o.businessType}>{o.name}</option>)}
              </select>
            )}
            <span className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600">
              <Layers3 className="w-3.5 h-3.5" />
              {nodes.length} 个节点
            </span>
            <span className={`inline-flex items-center gap-1 h-8 rounded-full px-3 text-xs font-medium ${statusStyle.cls}`}>
              {statusStyle.label} v{srvVersion}
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => handlePreviewAssignees('manual')}
              disabled={previewingAssignees}
              className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {previewingAssignees ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              {assigneePreview ? '重新计算' : '计算处理人'}
            </button>
            <button
              onClick={handleReloadBackendDefinition}
              disabled={reloadingBackend || saving || publishing}
              title="从后端重新读取当前业务类型的流程定义"
              className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {reloadingBackend ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              重新读取后端定义
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={saving || !canEditWorkflow}
              title={!canEditWorkflow ? '缺少 workflow:definition:edit 权限' : undefined}
              className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {canEditWorkflow ? '保存草稿' : '只读模式'}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || !canEditWorkflow}
              title={!canEditWorkflow ? '缺少 workflow:definition:edit 权限' : undefined}
              className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              发布流程
            </button>
          </div>
        </div>

        {/* Messages */}
        {!canEditWorkflow && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            当前账号只有流程查看权限，无法保存、发布或编辑流程。请返回流程列表查看已配置流程，或联系管理员授予 workflow:definition:edit 权限。
          </div>
        )}
        {saveMsg && (
          <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><Play className="w-3.5 h-3.5" /> {saveMsg}</span>
            <button type="button" onClick={() => setSaveMsg(null)} className="text-green-500 hover:text-green-700 flex-shrink-0"><X className="w-4 h-4" /></button>
          </div>
        )}
        {saveErr && (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 flex items-center justify-between gap-2">
            <span>{saveErr}</span>
            <button type="button" onClick={() => setSaveErr(null)} className="text-red-500 hover:text-red-700 flex-shrink-0"><X className="w-4 h-4" /></button>
          </div>
        )}
        {valErrors.length > 0 && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            <span className="font-semibold">流程设计待补全：</span>{valErrors.join('；')}
          </div>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex-shrink-0 border-t border-gray-100 px-6 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 border border-gray-200 bg-gray-50 rounded text-[10px] font-mono text-gray-500">Del</kbd>
            {canEditWorkflow ? '删除节点' : '只读'}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 border border-gray-200 bg-gray-50 rounded text-[10px] font-mono text-gray-500">⌘S</kbd>
            保存草稿
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 border border-gray-200 bg-gray-50 rounded text-[10px] font-mono text-gray-500">⌘Z</kbd>
            撤销
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 border border-gray-200 bg-gray-50 rounded text-[10px] font-mono text-gray-500">⌘⇧Z</kbd>
            重做
          </span>
          {/* undo/redo toolbar buttons as visual indicator */}
          <span className="w-px h-4 bg-gray-200 mx-1" />
          <button
            onClick={handleUndo}
            disabled={pastStates.current.length === 0}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="撤销 (⌘Z)"
          >
            <Undo className="w-3 h-3" />
          </button>
          <button
            onClick={handleRedo}
            disabled={futureStates.current.length === 0}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="重做 (⌘⇧Z)"
          >
            <Redo className="w-3 h-3" />
          </button>
        </div>
        <span className="text-[11px] text-gray-300">滚轮缩放 · 拖拽布点 · 连线分流 · 拖拽吸附对齐</span>
      </div>

      {/* 3-column layout */}
      <div className="flex-1 min-h-0 grid grid-cols-[280px_minmax(0,1fr)_340px] divide-x divide-gray-200">
        {canEditWorkflow ? (
          <NodePanel onAddNode={(type) => handleAddNode(type)} />
        ) : (
          <div className="h-full bg-slate-50 p-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
              <div className="mb-2 font-semibold text-slate-900">只读预览</div>
              当前账号可查看流程结构，但不能新增节点、调整连线或修改节点属性。
            </div>
          </div>
        )}
        <FlowCanvas
          nodes={nodes} edges={edges}
          onNodesChange={canEditWorkflow ? handleNodesChange : () => undefined} onEdgesChange={canEditWorkflow ? handleEdgesChange : () => undefined}
          onConnect={handleConnect}
          onNodeSelect={(n) => setSelId(n?.id ?? null)}
          onAddNodeAtPosition={handleAddNode}
          onNodeDragStart={canEditWorkflow ? pushSnapshot : () => undefined}
        />
        <div className="flex flex-col min-h-0">
          <div className="flex-shrink-0 flex border-b border-gray-200">
            <button
              className={`flex-1 px-3 py-2 text-xs font-medium text-center ${!showFormSource ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setShowFormSource(false)}
            >
              节点属性
            </button>
            <button
              className={`flex-1 px-3 py-2 text-xs font-medium text-center ${showFormSource ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setShowFormSource(true)}
            >
              <Code className="inline w-3 h-3 mr-1" />表单源码
            </button>
          </div>
          {showFormSource ? (
            <div className="flex-1 flex flex-col p-3 overflow-auto">
              <div className="text-xs font-medium text-gray-500 mb-2">自定义表单 HTML（保存草稿后生效）</div>
              <textarea
                className="flex-1 w-full min-h-[200px] rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs font-mono text-gray-800 outline-none resize-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder={`<form>\n  <label>字段名</label>\n  <input name="field" />\n  <button type="submit">提交</button>\n</form>`}
                value={formSource}
                disabled={!canEditWorkflow}
                onChange={(e) => { setAssigneePreview(null); setFormSource(e.target.value); }}
              />
              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                表单源码会保存在流程定义中。自定义流程卡片上的"查看业务表单"按钮会渲染此 HTML。
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto">
              {canEditWorkflow ? (
                <div className="space-y-3">
                  <NodeConfigPanel selectedNode={selNode} edges={edges} approverRoles={approverRoles} roleDetails={roleDetails} onUpdateNode={handleUpdate} onDeleteNode={handleDelete} />
                  <div className="mx-3 mb-3">
                    <AssigneePreviewPanel
                      preview={assigneePreview}
                      source={assigneePreviewSource}
                      previewing={previewingAssignees}
                      businessData={previewBusinessData}
                      onBusinessDataChange={(value) => { setAssigneePreview(null); setPreviewBusinessData(value); }}
                      onPreview={() => handlePreviewAssignees('manual')}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                    <div className="mb-2 font-semibold text-slate-900">节点属性</div>
                    只读权限下节点属性面板已锁定，避免误以为修改后可以保存。
                  </div>
                  <AssigneePreviewPanel
                    preview={assigneePreview}
                    source={assigneePreviewSource}
                    previewing={previewingAssignees}
                    businessData={previewBusinessData}
                    onBusinessDataChange={(value) => { setAssigneePreview(null); setPreviewBusinessData(value); }}
                    onPreview={() => handlePreviewAssignees('manual')}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
