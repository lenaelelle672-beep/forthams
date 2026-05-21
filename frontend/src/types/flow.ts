import { type Connection, type Edge, MarkerType, type Node, type XYPosition } from '@xyflow/react';

export type FlowNodeType = 'start' | 'approval' | 'condition' | 'end';

export interface FlowNodeData extends Record<string, unknown> {
  type: FlowNodeType;
  label: string;
  description: string;
  nodeCode: string;
  triggerType: string;
  approverType: 'role' | 'user';
  approverRole: string;
  approverId: string;
  approvalMode: 'any' | 'all' | 'sequence';
  conditionExpression: string;
  trueLabel: string;
  falseLabel: string;
  resultAction: string;
}

export type FlowNode = Node<FlowNodeData, FlowNodeType>;
export type FlowEdge = Edge;

export interface FlowDefinition {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export const FLOW_NODE_ORDER: FlowNodeType[] = ['start', 'approval', 'condition', 'end'];
export const FLOW_NODE_DND_TYPE = 'application/forthams-flow-node';

export const FLOW_NODE_CATALOG: Record<FlowNodeType, { label: string; description: string; helper: string }> = {
  start: { label: '开始节点', description: '流程入口与触发条件', helper: '适合表单提交、批量导入、定时任务' },
  approval: { label: '审批节点', description: '指派审批人并定义会签规则', helper: '支持按岗位、部门负责人、固定审批人配置' },
  condition: { label: '条件分支', description: '按金额、类别或字段值分流', helper: '支持通过/驳回、满足/不满足双向分支' },
  end: { label: '结束节点', description: '流程收口与结果归档', helper: '适合结束审批、归档单据、推送通知' },
};

const NODE_DEFAULTS: Record<FlowNodeType, Omit<FlowNodeData, 'type'>> = {
  start: { label: '开始节点', description: '从资产申请单提交开始', nodeCode: 'START-001', triggerType: '表单提交', approverType: 'role', approverRole: '', approverId: '', approvalMode: 'sequence', conditionExpression: '', trueLabel: '', falseLabel: '', resultAction: '' },
  approval: { label: '审批节点', description: '由部门负责人审核资产申请', nodeCode: 'APP-001', triggerType: '', approverType: 'role', approverRole: 'SUPER_ADMIN', approverId: '', approvalMode: 'sequence', conditionExpression: '', trueLabel: '', falseLabel: '', resultAction: '' },
  condition: { label: '条件分支', description: '根据金额或字段命中不同路径', nodeCode: 'COND-001', triggerType: '', approverType: 'role', approverRole: '', approverId: '', approvalMode: 'sequence', conditionExpression: '申请金额 >= 5000', trueLabel: '满足条件', falseLabel: '不满足条件', resultAction: '' },
  end: { label: '结束节点', description: '流程结束并同步审批结果', nodeCode: 'END-001', triggerType: '', approverType: 'role', approverRole: '', approverId: '', approvalMode: 'sequence', conditionExpression: '', trueLabel: '', falseLabel: '', resultAction: '审批完成并归档' },
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function createFlowNode(type: FlowNodeType, position: XYPosition, options?: { id?: string; data?: Partial<FlowNodeData> }): FlowNode {
  return {
    id: options?.id ?? createId(type),
    type,
    position,
    data: { type, ...NODE_DEFAULTS[type], ...options?.data } as FlowNodeData,
  };
}

export function createFlowEdge(connection: Connection): FlowEdge | null {
  if (!connection.source || !connection.target) return null;
  const isCondTrue = connection.sourceHandle === 'condition-true';
  const isCondFalse = connection.sourceHandle === 'condition-false';
  return {
    id: createId('edge'),
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    type: 'smoothstep',
    animated: !isCondTrue && !isCondFalse,
    label: isCondTrue ? '满足条件' : isCondFalse ? '不满足条件' : undefined,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
    style: { stroke: '#3b82f6', strokeWidth: 2 },
    labelStyle: { fill: '#374151', fontSize: 12, fontWeight: 600 },
    labelBgStyle: { fill: '#f8f9ff', fillOpacity: 1 },
  };
}

export const initialFlowNodes: FlowNode[] = [
  createFlowNode('start', { x: 320, y: 40 }, { id: 'start-1', data: { label: '提交资产申请', description: '员工发起资产采购或领用申请', nodeCode: 'START-APPLY', triggerType: '表单提交' } }),
  createFlowNode('approval', { x: 320, y: 190 }, { id: 'approval-1', data: { label: '部门负责人审批', description: '确认必要性、预算归属与领用部门', nodeCode: 'APP-DEPT', approverType: 'role', approverRole: 'SUPER_ADMIN', approvalMode: 'sequence' } }),
  createFlowNode('condition', { x: 320, y: 360 }, { id: 'condition-1', data: { label: '金额阈值判断', description: '大额采购进入财务复核，小额申请直接结束', nodeCode: 'COND-AMOUNT', conditionExpression: '申请金额 >= 5000', trueLabel: '大额采购', falseLabel: '常规采购' } }),
  createFlowNode('approval', { x: 70, y: 560 }, { id: 'approval-2', data: { label: '财务复核', description: '确认预算科目与付款计划', nodeCode: 'APP-FINANCE', approverType: 'role', approverRole: 'SUPER_ADMIN', approvalMode: 'all' } }),
  createFlowNode('end', { x: 560, y: 560 }, { id: 'end-1', data: { label: '流程结束', description: '输出审批结论并写入归档记录', nodeCode: 'END-ARCHIVE', resultAction: '归档并同步到审批列表' } }),
];

const mkEdge = (id: string, source: string, target: string, opts?: Partial<FlowEdge>): FlowEdge => ({
  id, source, target, type: 'smoothstep', animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
  style: { stroke: '#3b82f6', strokeWidth: 2 },
  ...opts,
});

export const initialFlowEdges: FlowEdge[] = [
  mkEdge('edge-start-approval', 'start-1', 'approval-1'),
  mkEdge('edge-approval-condition', 'approval-1', 'condition-1'),
  mkEdge('edge-condition-true', 'condition-1', 'approval-2', {
    sourceHandle: 'condition-true', label: '大额采购', animated: false,
    labelStyle: { fill: '#374151', fontSize: 12, fontWeight: 600 },
    labelBgStyle: { fill: '#f8f9ff', fillOpacity: 1 },
  }),
  mkEdge('edge-condition-false', 'condition-1', 'end-1', {
    sourceHandle: 'condition-false', label: '常规采购', animated: false,
    labelStyle: { fill: '#374151', fontSize: 12, fontWeight: 600 },
    labelBgStyle: { fill: '#f8f9ff', fillOpacity: 1 },
  }),
  mkEdge('edge-approval-end', 'approval-2', 'end-1'),
];
