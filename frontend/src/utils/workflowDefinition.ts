import { MarkerType } from '@xyflow/react';
import type { FlowDefinition, FlowEdge, FlowNode, FlowNodeData, FlowNodeType } from '@/types/flow';
export type WorkflowDefinitionPayload = FlowDefinition & { businessType: string };

const defaultMarkerEnd = { type: MarkerType.ArrowClosed, color: '#3b82f6' };
const defaultStyle = { stroke: '#3b82f6', strokeWidth: 2 };
const defaultLabelStyle = { fill: '#374151', fontSize: 12, fontWeight: 600 };
const defaultLabelBgStyle = { fill: '#f8f9ff', fillOpacity: 1 };

const defaultNodeData: FlowNodeData = {
  type: 'approval', label: '', description: '', nodeCode: '', triggerType: '',
  approverType: 'role', approverRole: '', approverRoleName: '', approverId: '', approvalMode: 'sequence',
  conditionExpression: '', trueLabel: '', falseLabel: '', resultAction: '',
  formSource: '', formSectionName: '', formSummaryFields: '', ccRoleCodes: '', ccUserIds: '',
};

function text(v: unknown) { return typeof v === 'string' ? v.trim() : ''; }
function isPresent(v: unknown) { return v != null && v !== ''; }
function csvValues(value: string) { return value.split(',').map((v) => v.trim()).filter(Boolean); }

const MAX_FORM_SOURCE_LENGTH = 50_000;
const MAX_FORM_META_LENGTH = 1_000;
const CONDITION_EXPRESSION_PATTERN = /^[\u4e00-\u9fffA-Za-z0-9_.-]+\s*(>=|<=|==|!=|>(?!=)|<(?!=))\s*\S.*$/;
const COMPOUND_CONDITION_PATTERN = /\s+(AND|OR)(\s+|$)/i;
const NODE_TYPES = new Set<FlowNodeType>(['start', 'approval', 'task', 'cc', 'condition', 'end']);
const EXECUTABLE_NODE_TYPES = new Set<FlowNodeType>(['approval', 'task']);
const CC_ROLE_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const CC_USER_ID_PATTERN = /^\d+$/;
const CYCLE_ERROR_MESSAGE = '流程存在循环路径，请检查节点连线';

function normalizeNode(node: FlowNode): FlowNode {
  const type = (node.type ?? node.data.type) as FlowNodeType;
  return { ...node, type, position: { x: Number(node.position?.x ?? 0), y: Number(node.position?.y ?? 0) }, data: { ...defaultNodeData, ...node.data, type, approvalMode: node.data.approvalMode ?? 'sequence' } };
}

function normalizeEdge(edge: FlowEdge): FlowEdge {
  return {
    ...edge,
    sourceHandle: edge.sourceHandle ?? null, targetHandle: edge.targetHandle ?? null,
    type: edge.type ?? 'smoothstep', animated: edge.animated ?? false,
    label: edge.label ?? null, markerEnd: edge.markerEnd ?? defaultMarkerEnd,
    style: edge.style ?? defaultStyle, labelStyle: edge.labelStyle ?? defaultLabelStyle,
    labelBgStyle: edge.labelBgStyle ?? defaultLabelBgStyle,
  };
}

export function isValidSimpleConditionExpression(value: unknown) {
  const expression = text(value);
  return Boolean(expression) && CONDITION_EXPRESSION_PATTERN.test(expression) && !COMPOUND_CONDITION_PATTERN.test(expression);
}

export function normalizeWorkflowDefinition(definition: FlowDefinition, businessType: string): WorkflowDefinitionPayload {
  const nodes = (Array.isArray(definition.nodes) ? definition.nodes : []).map(normalizeNode);
  const nodeIds = new Set(nodes.map((n) => n.id).filter(Boolean));
  const edges = (Array.isArray(definition.edges) ? definition.edges : []).map(normalizeEdge).filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  return { ...definition, businessType, id: definition.id || `WF-${businessType}`, name: definition.name, description: definition.description, nodes, edges };
}

export function validateWorkflowDefinition(definition: WorkflowDefinitionPayload): string[] {
  const errors: string[] = [];
  const nodeById = new Map<string, FlowNode>();
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  const condHandles = new Map<string, Set<string>>();
  const adj = new Map<string, string[]>();
  let hasCycle = false;

  if (!text(definition.id)) errors.push('流程定义ID不能为空');
  if (!text(definition.name)) errors.push('流程名称不能为空');
  if (!text(definition.description)) errors.push('流程说明不能为空');
  if (!text(definition.businessType)) errors.push('业务流程类型不能为空');
  if (definition.nodes.length === 0) errors.push('流程定义至少需要一个节点');

  const validateCcRecipients = (node: FlowNode, required: boolean) => {
    const ccRoleCodes = text((node.data as Record<string, unknown>).ccRoleCodes);
    const ccUserIds = text((node.data as Record<string, unknown>).ccUserIds);
    if (!ccRoleCodes && !ccUserIds) {
      if (required) errors.push(`抄送节点${node.id}必须配置抄送角色或抄送用户`);
      return;
    }
    for (const roleCode of csvValues(ccRoleCodes)) {
      if (!CC_ROLE_PATTERN.test(roleCode)) errors.push(`抄送节点${node.id}抄送角色格式无效：${roleCode}`);
    }
    for (const userId of csvValues(ccUserIds)) {
      if (!CC_USER_ID_PATTERN.test(userId)) errors.push(`抄送节点${node.id}抄送用户ID格式无效：${userId}`);
    }
  };

  for (const node of definition.nodes) {
    if (!text(node.id)) { errors.push('流程节点ID不能为空'); continue; }
    if (nodeById.has(node.id)) errors.push(`流程节点ID重复：${node.id}`);
    nodeById.set(node.id, node);
    if (!node.type) errors.push(`节点${node.id}类型不能为空`);
    else if (!NODE_TYPES.has(node.type as FlowNodeType)) errors.push(`不支持的流程节点类型：${node.type}`);
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) errors.push(`节点${node.id}坐标不能为空`);
    if (node.data.type !== node.type) errors.push(`节点${node.id}的类型与数据类型不一致`);
    if (!text(node.data.label)) errors.push(`节点${node.id}名称不能为空`);
    if (!text(node.data.description)) errors.push(`节点${node.id}说明不能为空`);
    if (!text(node.data.nodeCode)) errors.push(`节点${node.id}编码不能为空`);
    if (node.type === 'start' && !text(node.data.triggerType)) errors.push('开始节点触发方式不能为空');
    if (node.type === 'start' || node.type === 'approval') {
      const data = node.data as Record<string, unknown>;
      if (typeof data.formSource !== 'string') {
        errors.push(`节点${node.id}的环节子表单必须是字符串`);
      } else if (!text(data.formSource)) {
        errors.push(`节点${node.id}必须配置环节子表单 HTML`);
      } else if (data.formSource.length > MAX_FORM_SOURCE_LENGTH) {
        errors.push(`节点${node.id}的环节子表单 HTML 不能超过 ${MAX_FORM_SOURCE_LENGTH} 字符`);
      }
      for (const key of ['formSectionName', 'formSummaryFields']) {
        const value = data[key];
        if (isPresent(value) && typeof value !== 'string') errors.push(`节点${node.id}的${key}必须是字符串`);
        if (typeof value === 'string' && value.length > MAX_FORM_META_LENGTH) errors.push(`节点${node.id}的${key}不能超过 ${MAX_FORM_META_LENGTH} 字符`);
      }
    }
    if (EXECUTABLE_NODE_TYPES.has(node.type as FlowNodeType)) {
      const noun = node.type === 'task' ? '办理' : '审批';
      const at = (node.data as Record<string, unknown>).approverType;
      if (at === 'user') { if (!text((node.data as Record<string, unknown>).approverId)) errors.push(`${noun}节点${node.id}指定用户${noun}时${noun}人不能为空`); }
      else { if (!text(node.data.approverRole)) errors.push(`${noun}节点${node.id}${noun}角色不能为空`); }
      if (!['sequence', 'all', 'any'].includes(node.data.approvalMode)) errors.push(`${noun}节点${node.id}${noun}模式仅支持 sequence/all/any`);
      validateCcRecipients(node, false);
    }
    if (node.type === 'cc') {
      validateCcRecipients(node, true);
    }
    if (node.type === 'condition') {
      if (!text(node.data.conditionExpression)) errors.push(`条件节点${node.id}表达式不能为空`);
      else if (!isValidSimpleConditionExpression(node.data.conditionExpression)) errors.push(`条件节点${node.id}表达式仅支持简单表达式：字段名 操作符 值`);
      if (!text(node.data.trueLabel)) errors.push(`条件节点${node.id}满足标签不能为空`);
      if (!text(node.data.falseLabel)) errors.push(`条件节点${node.id}不满足标签不能为空`);
    }
    if (node.type === 'end' && !text(node.data.resultAction)) errors.push('结束节点动作不能为空');
  }

  const starts = definition.nodes.filter((n) => n.type === 'start');
  const executableNodes = definition.nodes.filter((n) => EXECUTABLE_NODE_TYPES.has(n.type as FlowNodeType));
  const ends = definition.nodes.filter((n) => n.type === 'end');
  if (starts.length !== 1) errors.push('流程必须且只能包含一个开始节点');
  if (executableNodes.length === 0) errors.push('流程至少需要一个审批或办理节点');
  if (ends.length !== 1) errors.push('流程必须且只能包含一个结束节点');

  for (const edge of definition.edges) {
    if (!text(edge.id)) errors.push('流程连线ID不能为空');
    if (!text(edge.source)) errors.push(`流程连线${edge.id}来源不能为空`);
    if (!text(edge.target)) errors.push(`流程连线${edge.id}目标不能为空`);
    const src = nodeById.get(edge.source); const tgt = nodeById.get(edge.target);
    if (!src) errors.push(`流程连线来源节点不存在：${edge.source}`);
    if (!tgt) errors.push(`流程连线目标节点不存在：${edge.target}`);
    if (!src || !tgt) continue;
    if (src.type === 'end') errors.push('结束节点不能作为连线来源');
    if (tgt.type === 'start') errors.push('开始节点不能作为连线目标');
    if (edge.source === edge.target) {
      hasCycle = true;
      continue;
    }
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    adj.set(edge.source, [...(adj.get(edge.source) ?? []), edge.target]);
    if (src.type === 'condition') {
      const h = String(edge.sourceHandle ?? '');
      if (h !== 'condition-true' && h !== 'condition-false') errors.push(`条件节点${src.id}连线必须使用满足或不满足出口`);
      const hs = condHandles.get(src.id) ?? new Set<string>();
      if (h === 'condition-true' || h === 'condition-false') {
        if (hs.has(h)) errors.push(`条件节点${src.id}只能配置一条${h === 'condition-true' ? '满足' : '不满足'}分支`);
        hs.add(h);
      }
      condHandles.set(src.id, hs);
    }
  }

  const colors = new Map<string, 'visiting' | 'visited'>();
  const visit = (nodeId: string): boolean => {
    const color = colors.get(nodeId);
    if (color === 'visiting') return true;
    if (color === 'visited') return false;
    colors.set(nodeId, 'visiting');
    for (const next of adj.get(nodeId) ?? []) {
      if (visit(next)) return true;
    }
    colors.set(nodeId, 'visited');
    return false;
  };

  for (const node of definition.nodes) {
    if (visit(node.id)) {
      hasCycle = true;
      break;
    }
  }
  if (hasCycle) errors.push(CYCLE_ERROR_MESSAGE);

  for (const node of definition.nodes) {
    if (node.type !== 'start' && (incoming.get(node.id) ?? 0) === 0) errors.push(`节点${node.id}缺少入线`);
    if (node.type !== 'end' && (outgoing.get(node.id) ?? 0) === 0) errors.push(`节点${node.id}缺少出线`);
    if (node.type === 'condition') {
      const hs = condHandles.get(node.id) ?? new Set<string>();
      if (!hs.has('condition-true') || !hs.has('condition-false')) errors.push(`条件节点${node.id}必须同时配置满足和不满足两条分支`);
    }
  }

  const startNode = starts[0];
  if (startNode) {
    const visited = new Set<string>(); const queue = [startNode.id];
    while (queue.length > 0) { const cur = queue.shift(); if (!cur || visited.has(cur)) continue; visited.add(cur); for (const next of adj.get(cur) ?? []) { if (!visited.has(next)) queue.push(next); } }
    if (definition.nodes.some((n) => !visited.has(n.id))) errors.push('流程存在未从开始节点连通的节点');
  }

  return Array.from(new Set(errors));
}
