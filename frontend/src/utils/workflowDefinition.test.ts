import { describe, expect, it } from 'vitest';
import { createFlowNode, type FlowEdge, type FlowNode } from '@/types/flow';
import { normalizeWorkflowDefinition, validateWorkflowDefinition, type WorkflowDefinitionPayload } from './workflowDefinition';

const CYCLE_ERROR_MESSAGE = '流程存在循环路径，请检查节点连线';

function edge(id: string, source: string, target: string, patch: Partial<FlowEdge> = {}): FlowEdge {
  return { id, source, target, ...patch } as FlowEdge;
}

function definition(nodes: FlowNode[], edges: FlowEdge[]) {
  return normalizeWorkflowDefinition({
    id: 'WF-ASSET_TRANSFER',
    name: '资产转移流程',
    description: '覆盖 task 与 cc 节点校验',
    nodes,
    edges,
  }, 'ASSET_TRANSFER');
}

function rawDefinition(nodes: FlowNode[], edges: FlowEdge[]): WorkflowDefinitionPayload {
  return {
    id: 'WF-ASSET_TRANSFER',
    name: '资产转移流程',
    description: '覆盖发布前校验',
    businessType: 'ASSET_TRANSFER',
    nodes,
    edges,
  };
}

function taskFlow(taskPatch: Partial<FlowNode['data']> = {}, ccPatch: Partial<FlowNode['data']> = {}) {
  const start = createFlowNode('start', { x: 120, y: 40 }, { id: 'start-1' });
  const task = createFlowNode('task', { x: 120, y: 200 }, { id: 'task-1', data: taskPatch });
  const cc = createFlowNode('cc', { x: 120, y: 360 }, { id: 'cc-1', data: ccPatch });
  const end = createFlowNode('end', { x: 120, y: 520 }, { id: 'end-1' });
  return definition([start, task, cc, end], [
    edge('edge-start-task', 'start-1', 'task-1'),
    edge('edge-task-cc', 'task-1', 'cc-1'),
    edge('edge-cc-end', 'cc-1', 'end-1'),
  ]);
}

function approvalFlow(approvalPatch: Partial<FlowNode['data']> = {}) {
  const start = createFlowNode('start', { x: 120, y: 40 }, { id: 'start-1' });
  const approval = createFlowNode('approval', { x: 120, y: 200 }, { id: 'approval-1', data: approvalPatch });
  const end = createFlowNode('end', { x: 120, y: 360 }, { id: 'end-1' });
  return definition([start, approval, end], [
    edge('edge-start-approval', 'start-1', 'approval-1'),
    edge('edge-approval-end', 'approval-1', 'end-1'),
  ]);
}

function conditionFlow(conditionPatch: Partial<FlowNode['data']> = {}, edges: FlowEdge[] = []) {
  const start = createFlowNode('start', { x: 120, y: 40 }, { id: 'start-1' });
  const approval = createFlowNode('approval', { x: 120, y: 200 }, { id: 'approval-1' });
  const condition = createFlowNode('condition', { x: 120, y: 360 }, { id: 'condition-1', data: conditionPatch });
  const financeApproval = createFlowNode('approval', { x: 20, y: 520 }, { id: 'approval-2' });
  const end = createFlowNode('end', { x: 220, y: 520 }, { id: 'end-1' });
  return definition([start, approval, condition, financeApproval, end], edges.length > 0 ? edges : [
    edge('edge-start-approval', 'start-1', 'approval-1'),
    edge('edge-approval-condition', 'approval-1', 'condition-1'),
    edge('edge-condition-true', 'condition-1', 'approval-2', { sourceHandle: 'condition-true' }),
    edge('edge-condition-false', 'condition-1', 'end-1', { sourceHandle: 'condition-false' }),
    edge('edge-approval-end', 'approval-2', 'end-1'),
  ]);
}

describe('validateWorkflowDefinition task/cc nodes', () => {
  it('accepts a task-only executable path with cc recipients', () => {
    const errors = validateWorkflowDefinition(taskFlow());

    expect(errors).toEqual([]);
  });

  it('rejects task nodes without an assignee', () => {
    const errors = validateWorkflowDefinition(taskFlow({ approverRole: '' }));

    expect(errors).toContain('办理节点task-1办理角色不能为空');
  });

  it('rejects cc nodes without role or user recipients', () => {
    const errors = validateWorkflowDefinition(taskFlow({}, { ccRoleCodes: '', ccUserIds: '' }));

    expect(errors).toContain('抄送节点cc-1必须配置抄送角色或抄送用户');
  });

  it('rejects cc role values with unsupported characters', () => {
    const errors = validateWorkflowDefinition(taskFlow({}, { ccRoleCodes: 'FINANCE 用户' }));

    expect(errors).toContain('抄送节点cc-1抄送角色格式无效：FINANCE 用户');
  });

  it('rejects cc user ids that are not numeric', () => {
    const errors = validateWorkflowDefinition(taskFlow({}, { ccRoleCodes: '', ccUserIds: 'user-7' }));

    expect(errors).toContain('抄送节点cc-1抄送用户ID格式无效：user-7');
  });

  it('validates optional cc recipients on executable nodes', () => {
    const errors = validateWorkflowDefinition(taskFlow({ ccRoleCodes: 'FINANCE', ccUserIds: 'user-7' }));

    expect(errors).toContain('抄送节点task-1抄送用户ID格式无效：user-7');
  });
});

describe('validateWorkflowDefinition publish checks', () => {
  it('accepts a valid approval flow', () => {
    const errors = validateWorkflowDefinition(approvalFlow());

    expect(errors).toEqual([]);
  });

  it('rejects missing start and approval form sources', () => {
    const start = createFlowNode('start', { x: 120, y: 40 }, { id: 'start-1', data: { formSource: '' } });
    const approval = createFlowNode('approval', { x: 120, y: 200 }, { id: 'approval-1', data: { formSource: '' } });
    const end = createFlowNode('end', { x: 120, y: 360 }, { id: 'end-1' });
    const errors = validateWorkflowDefinition(definition([start, approval, end], [
      edge('edge-start-approval', 'start-1', 'approval-1'),
      edge('edge-approval-end', 'approval-1', 'end-1'),
    ]));

    expect(errors).toContain('节点start-1必须配置环节子表单 HTML');
    expect(errors).toContain('节点approval-1必须配置环节子表单 HTML');
  });

  it('rejects approval nodes without an approver', () => {
    const roleErrors = validateWorkflowDefinition(approvalFlow({ approverRole: '' }));
    const userErrors = validateWorkflowDefinition(approvalFlow({ approverType: 'user', approverId: '' }));

    expect(roleErrors).toContain('审批节点approval-1审批角色不能为空');
    expect(userErrors).toContain('审批节点approval-1指定用户审批时审批人不能为空');
  });

  it('rejects no end and multiple end flows', () => {
    const start = createFlowNode('start', { x: 120, y: 40 }, { id: 'start-1' });
    const approval = createFlowNode('approval', { x: 120, y: 200 }, { id: 'approval-1' });
    const end1 = createFlowNode('end', { x: 120, y: 360 }, { id: 'end-1' });
    const end2 = createFlowNode('end', { x: 220, y: 360 }, { id: 'end-2' });

    expect(validateWorkflowDefinition(definition([start, approval], [
      edge('edge-start-approval', 'start-1', 'approval-1'),
    ]))).toContain('流程必须且只能包含一个结束节点');
    expect(validateWorkflowDefinition(definition([start, approval, end1, end2], [
      edge('edge-start-approval', 'start-1', 'approval-1'),
      edge('edge-approval-end', 'approval-1', 'end-1'),
    ]))).toContain('流程必须且只能包含一个结束节点');
  });

  it('rejects duplicate and missing condition branches', () => {
    const errors = validateWorkflowDefinition(conditionFlow({}, [
      edge('edge-start-approval', 'start-1', 'approval-1'),
      edge('edge-approval-condition', 'approval-1', 'condition-1'),
      edge('edge-condition-true-1', 'condition-1', 'approval-2', { sourceHandle: 'condition-true' }),
      edge('edge-condition-true-2', 'condition-1', 'end-1', { sourceHandle: 'condition-true' }),
      edge('edge-approval-end', 'approval-2', 'end-1'),
    ]));

    expect(errors).toContain('条件节点condition-1只能配置一条满足分支');
    expect(errors).toContain('条件节点condition-1必须同时配置满足和不满足两条分支');
  });

  it('rejects invalid compound condition expressions', () => {
    const errors = validateWorkflowDefinition(conditionFlow({ conditionExpression: '申请金额 >= 5000 AND 资产类别 == 固定资产' }));

    expect(errors).toContain('条件节点condition-1表达式仅支持简单表达式：字段名 操作符 值');
  });

  it('rejects unreachable nodes', () => {
    const start = createFlowNode('start', { x: 120, y: 40 }, { id: 'start-1' });
    const approval = createFlowNode('approval', { x: 120, y: 200 }, { id: 'approval-1' });
    const end = createFlowNode('end', { x: 120, y: 360 }, { id: 'end-1' });
    const unreachable = createFlowNode('approval', { x: 360, y: 200 }, { id: 'approval-2' });
    const errors = validateWorkflowDefinition(definition([start, approval, end, unreachable], [
      edge('edge-start-approval', 'start-1', 'approval-1'),
      edge('edge-approval-end', 'approval-1', 'end-1'),
    ]));

    expect(errors).toContain('流程存在未从开始节点连通的节点');
  });

  it('rejects directed cycles once', () => {
    const start = createFlowNode('start', { x: 120, y: 40 }, { id: 'start-1' });
    const approval1 = createFlowNode('approval', { x: 120, y: 200 }, { id: 'approval-1' });
    const approval2 = createFlowNode('approval', { x: 120, y: 360 }, { id: 'approval-2' });
    const end = createFlowNode('end', { x: 120, y: 520 }, { id: 'end-1' });
    const errors = validateWorkflowDefinition(definition([start, approval1, approval2, end], [
      edge('edge-start-approval', 'start-1', 'approval-1'),
      edge('edge-approval-1-2', 'approval-1', 'approval-2'),
      edge('edge-approval-2-1', 'approval-2', 'approval-1'),
      edge('edge-approval-end', 'approval-2', 'end-1'),
    ]));

    expect(errors.filter((error) => error === CYCLE_ERROR_MESSAGE)).toHaveLength(1);
  });

  it('rejects self-loops once without counting them as structural edges', () => {
    const start = createFlowNode('start', { x: 120, y: 40 }, { id: 'start-1' });
    const approval = createFlowNode('approval', { x: 120, y: 200 }, { id: 'approval-1' });
    const end = createFlowNode('end', { x: 120, y: 360 }, { id: 'end-1' });
    const errors = validateWorkflowDefinition(rawDefinition([start, approval, end], [
      edge('edge-start-approval', 'start-1', 'approval-1'),
      edge('edge-approval-self', 'approval-1', 'approval-1'),
    ]));

    expect(errors.filter((error) => error === CYCLE_ERROR_MESSAGE)).toHaveLength(1);
    expect(errors).toContain('节点approval-1缺少出线');
    expect(errors).toContain('节点end-1缺少入线');
  });

  it('keeps normalized self-loops visible to cycle validation', () => {
    const start = createFlowNode('start', { x: 120, y: 40 }, { id: 'start-1' });
    const approval = createFlowNode('approval', { x: 120, y: 200 }, { id: 'approval-1' });
    const end = createFlowNode('end', { x: 120, y: 360 }, { id: 'end-1' });
    const normalized = definition([start, approval, end], [
      edge('edge-start-approval', 'start-1', 'approval-1'),
      edge('edge-approval-end', 'approval-1', 'end-1'),
      edge('edge-approval-self', 'approval-1', 'approval-1'),
    ]);
    const errors = validateWorkflowDefinition(normalized);

    expect(normalized.edges.some((e) => e.source === 'approval-1' && e.target === 'approval-1')).toBe(true);
    expect(errors.filter((error) => error === CYCLE_ERROR_MESSAGE)).toHaveLength(1);
    expect(errors).not.toContain('节点approval-1缺少出线');
    expect(errors).not.toContain('节点end-1缺少入线');
  });
});
