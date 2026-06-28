import { describe, expect, it } from 'vitest';
import { createFlowNode, type FlowEdge, type FlowNode } from '@/types/flow';
import { normalizeWorkflowDefinition, validateWorkflowDefinition } from './workflowDefinition';

function edge(id: string, source: string, target: string): FlowEdge {
  return { id, source, target } as FlowEdge;
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
