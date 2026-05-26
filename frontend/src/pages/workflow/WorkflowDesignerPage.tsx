import { useCallback, useEffect, useMemo, useState } from 'react';
import { addEdge, type Connection, useEdgesState, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Code, Layers3, Loader2, Play, Save, Send, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';

import { FlowCanvas } from '@/components/flow/FlowCanvas';
import { NodeConfigPanel } from '@/components/flow/NodeConfigPanel';
import { NodePanel } from '@/components/flow/NodePanel';
import { workflowApi, roleApi, type RoleRecord, type WorkflowDefinitionDTO } from '@/api/workflow';
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
    return normalizeWorkflowDefinition(p, bt);
  } catch { return null; }
}

function fromApi(val: Record<string, unknown> | undefined, bt: string): Pick<FlowDefinition, 'nodes' | 'edges'> | null {
  if (!val || !Array.isArray(val.nodes) || val.nodes.length === 0 || !Array.isArray(val.edges)) return null;
  return normalizeWorkflowDefinition(val as unknown as FlowDefinition, bt);
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

export default function WorkflowDesignerPage() {
  const navigate = useNavigate();
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
  const [approverRoles, setApproverRoles] = useState<string[]>(['SUPER_ADMIN']);
  const [roleDetails, setRoleDetails] = useState<Array<{ roleCode: string; roleName: string }>>([]);
  const [formSource, setFormSource] = useState('');
  const [showFormSource, setShowFormSource] = useState(false);
  const [srvName, setSrvName] = useState<string | null>(null);
  const [srvDesc, setSrvDesc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => { if (!isBusinessType(reqBt) && !isCustomBusinessType(reqBt)) setSp({ businessType }, { replace: true }); }, [businessType, reqBt, setSp]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSaveErr(null);
      try {
        const raw = await workflowApi.get(businessType);
        const def = raw as WorkflowDefinitionDTO;
        if (cancelled) return;
        const defData = def.definition as Record<string, unknown> | undefined;
        const parsed = fromApi(defData, businessType);
        const nn = parsed?.nodes ?? cloneNodes();
        const ne = parsed?.edges ?? cloneEdges();
        setNodes(nn); setEdges(ne);
        setSelId(nn.find((n) => n.type === 'approval')?.id ?? 'approval-1');
        setSrvStatus(def.status); setSrvVersion(def.version);
        setSrvName(def.name ?? null); setSrvDesc(def.description ?? null);
        setFormSource((defData?.formSource as string) || '');
        setSaveMsg(def.id ? '已从后端恢复流程定义' : null);
      } catch {
        if (cancelled) return;
        const draft = readDraft(businessType);
        const nn = draft?.nodes ?? cloneNodes();
        const ne = draft?.edges ?? cloneEdges();
        setNodes(nn); setEdges(ne);
        setSelId(nn.find((n) => n.type === 'approval')?.id ?? 'approval-1');
        setSrvStatus('UNCONFIGURED'); setSrvVersion(0);
        setSaveMsg(draft ? '后端不可用，已恢复本地草稿' : null);
      }
    })();
    return () => { cancelled = true; };
  }, [businessType, setEdges, setNodes]);

  useEffect(() => {
    let cancelled = false;
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
      } catch { if (!cancelled) { setApproverRoles(['SUPER_ADMIN']); setRoleDetails([]); } }
    })();
    return () => { cancelled = true; };
  }, []);

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

  const handleAddNode = useCallback((type: FlowNodeType, pos?: { x: number; y: number }) => {
    setNodes((cur) => { const n = createFlowNode(type, pos ?? autoPos(cur.length)); setSelId(n.id); return [...cur, n]; });
  }, [setNodes]);

  const handleConnect = useCallback((conn: Connection) => {
    const edge = createFlowEdge(conn);
    if (!edge || edge.source === edge.target) { if (edge?.source === edge.target) { setSaveMsg(null); setSaveErr('同一节点不能连接自身'); } return; }
    setEdges((cur) => cur.some((e) => e.source === edge.source && e.target === edge.target && e.sourceHandle === edge.sourceHandle) ? cur : addEdge(edge, cur));
  }, [setEdges]);

  const handleUpdate = useCallback((id: string, patch: Partial<FlowNodeData>) => { setNodes((cur) => cur.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)); }, [setNodes]);

  const handleDelete = useCallback((id: string) => {
    setNodes((cur) => cur.filter((n) => n.id !== id));
    setEdges((cur) => cur.filter((e) => e.source !== id && e.target !== id));
    setSelId((prev) => prev === id ? (nodes.find((n) => n.id !== id)?.id ?? null) : prev);
  }, [nodes, setEdges, setNodes]);

  const defPayload = useMemo(() => {
    const base = normDef as unknown as Record<string, unknown>;
    if (formSource) {
      return { ...base, formSource };
    }
    const { formSource: _, ...rest } = base;
    return rest;
  }, [normDef, formSource]);

  const handleSaveDraft = useCallback(async () => {
    setSaving(true);
    try {
      const raw = await workflowApi.saveDraft(businessType, { name: normDef.name, description: normDef.description, definition: defPayload });
      const saved = raw as WorkflowDefinitionDTO;
      localStorage.setItem(getDraftStorageKey(businessType), JSON.stringify({ ...normDef, formSource, savedAt: new Date().toISOString() }));
      setSrvStatus(saved.status); setSrvVersion(saved.version); setSaveErr(null);
      setSaveMsg(valErrors.length > 0 ? `${flow.name}已保存草稿，发布前需补全校验项` : `${flow.name}已保存草稿`);
    } catch {
      localStorage.setItem(getDraftStorageKey(businessType), JSON.stringify({ ...normDef, formSource, savedAt: new Date().toISOString() }));
      setSaveMsg(`${flow.name}已保存本地草稿`); setSaveErr('后端保存失败');
    } finally { setSaving(false); }
  }, [businessType, flow.name, normDef, defPayload, formSource, valErrors.length]);

  const handlePublish = useCallback(async () => {
    if (!ensureValid('发布')) return;
    setPublishing(true);
    try {
      await workflowApi.saveDraft(businessType, { name: normDef.name, description: normDef.description, definition: defPayload });
      localStorage.setItem(getDraftStorageKey(businessType), JSON.stringify({ ...normDef, formSource, savedAt: new Date().toISOString() }));
      const raw = await workflowApi.publish(businessType);
      const pub = raw as WorkflowDefinitionDTO;
      setSrvStatus(pub.status); setSrvVersion(pub.version); setSaveErr(null);
      setSaveMsg(`${flow.name}已发布为 v${pub.version}`);
    } catch (e) { setSaveMsg(null); setSaveErr(e instanceof Error ? e.message : '发布失败'); }
    finally { setPublishing(false); }
  }, [businessType, ensureValid, flow.name, normDef, defPayload, formSource]);

  const statusStyle = STATUS_STYLES[srvStatus] ?? STATUS_STYLES.UNCONFIGURED;

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
              onClick={handleSaveDraft}
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存草稿
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              发布流程
            </button>
          </div>
        </div>

        {/* Messages */}
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

      {/* 3-column layout */}
      <div className="flex-1 min-h-0 grid grid-cols-[280px_minmax(0,1fr)_340px] divide-x divide-gray-200">
        <NodePanel onAddNode={(type) => handleAddNode(type)} />
        <FlowCanvas nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={handleConnect} onNodeSelect={(n) => setSelId(n?.id ?? null)} onAddNodeAtPosition={handleAddNode} />
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
                onChange={(e) => setFormSource(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                表单源码会保存在流程定义中。自定义流程卡片上的"查看业务表单"按钮会渲染此 HTML。
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto">
              <NodeConfigPanel selectedNode={selNode} edges={edges} approverRoles={approverRoles} roleDetails={roleDetails} onUpdateNode={handleUpdate} onDeleteNode={handleDelete} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
