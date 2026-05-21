import { MarkerType } from "@xyflow/react";

import type { BusinessType } from "../constants/workflowBusiness";
import type { FlowDefinition, FlowEdge, FlowNode, FlowNodeData } from "../types/flow";

export type WorkflowDefinitionPayload = FlowDefinition & { businessType: BusinessType };

const defaultMarkerEnd = { type: MarkerType.ArrowClosed, color: "var(--color-primary)" };
const defaultStyle = { stroke: "var(--color-primary)", strokeWidth: 2 };
const defaultLabelStyle = { fill: "var(--color-foreground)", fontSize: 12, fontWeight: 600 };
const defaultLabelBgStyle = { fill: "var(--workflow-surface)", fillOpacity: 1 };

const defaultNodeData: FlowNodeData = {
  type: "approval",
  label: "",
  description: "",
  nodeCode: "",
  triggerType: "",
  approverType: "role",
  approverRole: "",
  approverId: "",
  approvalMode: "sequence",
  conditionExpression: "",
  trueLabel: "",
  falseLabel: "",
  resultAction: "",
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNode(node: FlowNode): FlowNode {
  const type = node.type ?? node.data.type;
  return {
    ...node,
    type,
    position: {
      x: Number(node.position?.x ?? 0),
      y: Number(node.position?.y ?? 0),
    },
    data: {
      ...defaultNodeData,
      ...node.data,
      type,
      approvalMode: node.data.approvalMode ?? "sequence",
    },
  };
}

function normalizeEdge(edge: FlowEdge): FlowEdge {
  return {
    ...edge,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    type: edge.type ?? "smoothstep",
    animated: edge.animated ?? false,
    label: edge.label ?? null,
    markerEnd: edge.markerEnd ?? defaultMarkerEnd,
    style: edge.style ?? defaultStyle,
    labelStyle: edge.labelStyle ?? defaultLabelStyle,
    labelBgStyle: edge.labelBgStyle ?? defaultLabelBgStyle,
  };
}

export function normalizeWorkflowDefinition(
  definition: FlowDefinition,
  businessType: BusinessType,
): WorkflowDefinitionPayload {
  const nodes = (Array.isArray(definition.nodes) ? definition.nodes : []).map(normalizeNode);
  const nodeIds = new Set(nodes.map((node) => node.id).filter(Boolean));
  const edges = (Array.isArray(definition.edges) ? definition.edges : [])
    .map(normalizeEdge)
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target);

  return {
    ...definition,
    businessType,
    id: definition.id || `WF-${businessType}`,
    name: definition.name,
    description: definition.description,
    nodes,
    edges,
  };
}

export function validateWorkflowDefinition(definition: WorkflowDefinitionPayload): string[] {
  const errors: string[] = [];
  const nodeById = new Map<string, FlowNode>();
  const incomingCounts = new Map<string, number>();
  const outgoingCounts = new Map<string, number>();
  const conditionHandles = new Map<string, Set<string>>();
  const adjacency = new Map<string, string[]>();

  if (!text(definition.id)) errors.push("流程定义ID不能为空");
  if (!text(definition.name)) errors.push("流程名称不能为空");
  if (!text(definition.description)) errors.push("流程说明不能为空");
  if (!text(definition.businessType)) errors.push("业务流程类型不能为空");
  if (definition.nodes.length === 0) errors.push("流程定义至少需要一个节点");

  for (const node of definition.nodes) {
    if (!text(node.id)) {
      errors.push("流程节点ID不能为空");
      continue;
    }
    if (nodeById.has(node.id)) errors.push(`流程节点ID重复：${node.id}`);
    nodeById.set(node.id, node);

    if (!node.type) errors.push(`节点${node.id}类型不能为空`);
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
      errors.push(`节点${node.id}坐标不能为空`);
    }
    if (node.data.type !== node.type) errors.push(`节点${node.id}的类型与数据类型不一致`);
    if (!text(node.data.label)) errors.push(`节点${node.id}名称不能为空`);
    if (!text(node.data.description)) errors.push(`节点${node.id}说明不能为空`);
    if (!text(node.data.nodeCode)) errors.push(`节点${node.id}编码不能为空`);

    if (node.type === "start" && !text(node.data.triggerType)) {
      errors.push("开始节点触发方式不能为空");
    }
    if (node.type === "approval") {
      const approverType = (node.data as Record<string, unknown>).approverType;
      if (approverType === "user") {
        if (!text((node.data as Record<string, unknown>).approverId)) {
          errors.push(`审批节点${node.id}指定用户审批时审批人不能为空`);
        }
      } else {
        if (!text(node.data.approverRole)) errors.push(`审批节点${node.id}审批角色不能为空`);
      }
      if (!["sequence", "all", "any"].includes(node.data.approvalMode)) {
        errors.push(`审批节点${node.id}审批模式无效`);
      }
    }
    if (node.type === "condition") {
      if (!text(node.data.conditionExpression)) errors.push(`条件节点${node.id}表达式不能为空`);
      if (!text(node.data.trueLabel)) errors.push(`条件节点${node.id}满足标签不能为空`);
      if (!text(node.data.falseLabel)) errors.push(`条件节点${node.id}不满足标签不能为空`);
    }
    if (node.type === "end" && !text(node.data.resultAction)) {
      errors.push("结束节点动作不能为空");
    }
  }

  const startNodes = definition.nodes.filter((node) => node.type === "start");
  const approvalNodes = definition.nodes.filter((node) => node.type === "approval");
  const endNodes = definition.nodes.filter((node) => node.type === "end");
  if (startNodes.length !== 1) errors.push("流程必须且只能包含一个开始节点");
  if (approvalNodes.length === 0) errors.push("流程至少需要一个审批节点");
  if (endNodes.length !== 1) errors.push("流程必须且只能包含一个结束节点");

  for (const edge of definition.edges) {
    if (!text(edge.id)) errors.push("流程连线ID不能为空");
    if (!text(edge.source)) errors.push(`流程连线${edge.id}来源不能为空`);
    if (!text(edge.target)) errors.push(`流程连线${edge.id}目标不能为空`);
    if (!text(edge.type)) errors.push(`流程连线${edge.id}类型不能为空`);

    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source) errors.push(`流程连线来源节点不存在：${edge.source}`);
    if (!target) errors.push(`流程连线目标节点不存在：${edge.target}`);
    if (!source || !target) continue;

    if (source.type === "end") errors.push("结束节点不能作为连线来源");
    if (target.type === "start") errors.push("开始节点不能作为连线目标");
    incomingCounts.set(edge.target, (incomingCounts.get(edge.target) ?? 0) + 1);
    outgoingCounts.set(edge.source, (outgoingCounts.get(edge.source) ?? 0) + 1);
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);

    if (source.type === "condition") {
      const handle = String(edge.sourceHandle ?? "");
      if (handle !== "condition-true" && handle !== "condition-false") {
        errors.push(`条件节点${source.id}连线必须使用满足或不满足出口`);
      }
      const handles = conditionHandles.get(source.id) ?? new Set<string>();
      handles.add(handle);
      conditionHandles.set(source.id, handles);
    }
  }

  for (const node of definition.nodes) {
    if (node.type !== "start" && (incomingCounts.get(node.id) ?? 0) === 0) {
      errors.push(`节点${node.id}缺少入线`);
    }
    if (node.type !== "end" && (outgoingCounts.get(node.id) ?? 0) === 0) {
      errors.push(`节点${node.id}缺少出线`);
    }
    if (node.type === "condition") {
      const handles = conditionHandles.get(node.id) ?? new Set<string>();
      if (!handles.has("condition-true") || !handles.has("condition-false")) {
        errors.push(`条件节点${node.id}必须同时配置满足和不满足两条分支`);
      }
    }
  }

  const startNode = startNodes[0];
  if (startNode) {
    const visited = new Set<string>();
    const queue = [startNode.id];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) queue.push(next);
      }
    }
    if (definition.nodes.some((node) => !visited.has(node.id))) {
      errors.push("流程存在未从开始节点连通的节点");
    }
  }

  return Array.from(new Set(errors));
}
