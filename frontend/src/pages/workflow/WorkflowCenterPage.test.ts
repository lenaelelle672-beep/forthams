import { describe, expect, it } from 'vitest';

import type {
  WorkflowDefinitionDTO,
  WorkflowDesignerDraftDTO,
  WorkflowPublishPayload,
} from '@/api/workflow';
import {
  createDefaultWorkflowDefinition,
  MISSING_RESOLVABLE_ASSIGNEE_MESSAGE,
  publishWorkflowFromCenter,
} from './WorkflowCenterPage';

function workflowDefinition(overrides: Partial<WorkflowDefinitionDTO> = {}): WorkflowDefinitionDTO {
  return {
    id: 8,
    businessType: 'ASSET_TRANSFER',
    name: '资产转移流程',
    description: '用于资产转移审批',
    definition: { nodes: [], edges: [] },
    status: 'DRAFT',
    version: 0,
    draftRevision: 1,
    ...overrides,
  };
}

function designerDraft(overrides: Partial<WorkflowDesignerDraftDTO> = {}): WorkflowDesignerDraftDTO {
  return {
    ...workflowDefinition({ status: 'UNCONFIGURED', draftRevision: null }),
    revision: null,
    publishedDefinitionId: null,
    publishedVersion: null,
    publishedStatus: null,
    ...overrides,
  };
}

describe('WorkflowCenterPage default publication', () => {
  it('creates a linear valid draft and publishes with the returned CAS revision', async () => {
    const calls: Array<{ method: string; payload?: unknown }> = [];
    const defaultDefinition = createDefaultWorkflowDefinition(
      'ASSET_TRANSFER',
      '资产转移流程',
      '用于资产转移审批',
      { approverType: 'role', approverRole: 'DEPT_MANAGER' },
    );
    const api = {
      getDesignerDraft: async () => {
        calls.push({ method: 'getDesignerDraft' });
        return designerDraft();
      },
      listRoles: async () => [{ id: 3, roleCode: 'DEPT_MANAGER', roleName: '部门主管' }],
      previewAssignees: async () => {
        calls.push({ method: 'previewAssignees' });
        return {
          businessType: 'ASSET_TRANSFER',
          calculable: true,
          missingFields: [],
          nodes: [{
            stepNo: 1,
            nodeId: 'approval',
            resolved: true,
            assigneeCount: 1,
            assignees: [{ userId: '9' }],
          }],
        };
      },
      saveDraft: async (_businessType: string, payload: {
        name: string;
        description: string;
        definition: Record<string, unknown> | null;
        expectedRevision: number | null;
      }) => {
        calls.push({ method: 'saveDraft', payload });
        return workflowDefinition({ draftRevision: 7 });
      },
      publish: async (_businessType: string, payload: WorkflowPublishPayload) => {
        calls.push({ method: 'publish', payload });
        return workflowDefinition({ status: 'PUBLISHED', version: 1, draftRevision: null });
      },
    };

    await expect(publishWorkflowFromCenter(
      api,
      'ASSET_TRANSFER',
      '资产转移流程',
      '用于资产转移审批',
      { createDefaultDraft: true },
    ))
      .resolves.toMatchObject({ status: 'PUBLISHED', version: 1 });

    expect(defaultDefinition).toEqual({
      id: 'WF-ASSET_TRANSFER',
      name: '资产转移流程',
      description: '用于资产转移审批',
      nodes: [
        { id: 'start', type: 'START', label: '开始' },
        {
          id: 'approval',
          type: 'APPROVAL',
          label: '默认审批',
          config: { approverType: 'role', approverRole: 'DEPT_MANAGER', approvalMode: 'sequence' },
        },
        { id: 'end', type: 'END', label: '结束' },
      ],
      edges: [
        { id: 'edge-start-approval', source: 'start', target: 'approval' },
        { id: 'edge-approval-end', source: 'approval', target: 'end' },
      ],
    });

    expect(calls).toEqual([
      { method: 'getDesignerDraft' },
      { method: 'previewAssignees' },
      {
        method: 'saveDraft',
        payload: {
          name: '资产转移流程',
          description: '用于资产转移审批',
          definition: defaultDefinition,
          expectedRevision: null,
        },
      },
      {
        method: 'publish',
        payload: {
          expectedDraftRevision: 7,
          publishNote: '资产转移流程发布',
          impactScope: '仅影响后续新发起审批实例',
          rollbackPlan: '通过版本历史恢复至已发布稳定版本',
        },
      },
    ]);
  });

  it('stops before publish when a newly saved draft lacks a CAS revision', async () => {
    let publishCalled = false;
    const api = {
      getDesignerDraft: async () => designerDraft(),
      listRoles: async () => [{ id: 3, roleCode: 'DEPT_MANAGER' }],
      previewAssignees: async () => ({
        businessType: 'ASSET_TRANSFER',
        calculable: true,
        missingFields: [],
        nodes: [{ stepNo: 1, nodeId: 'approval', resolved: true, assigneeCount: 1, assignees: [{ userId: '9' }] }],
      }),
      saveDraft: async () => workflowDefinition({ draftRevision: null }),
      publish: async () => {
        publishCalled = true;
        return workflowDefinition({ status: 'PUBLISHED', version: 1, draftRevision: null });
      },
    };

    await expect(publishWorkflowFromCenter(
      api,
      'ASSET_TRANSFER',
      '资产转移流程',
      '用于资产转移审批',
      { createDefaultDraft: true },
    ))
      .rejects.toThrow('默认流程草稿保存后未返回 revision');
    expect(publishCalled).toBe(false);
  });

  it('uses the reviewed existing draft revision without overwriting it', async () => {
    let saved = false;
    let publishedRevision: number | undefined;
    const api = {
      getDesignerDraft: async () => designerDraft({ revision: 3 }),
      previewAssignees: async () => {
        throw new Error('should not preview existing draft');
      },
      saveDraft: async () => {
        saved = true;
        return workflowDefinition();
      },
      publish: async (_businessType: string, payload: WorkflowPublishPayload) => {
        publishedRevision = payload.expectedDraftRevision;
        return workflowDefinition({ status: 'PUBLISHED', version: 2, draftRevision: null });
      },
    };

    await publishWorkflowFromCenter(api, 'ASSET_TRANSFER', '资产转移流程', '用于资产转移审批');

    expect(saved).toBe(false);
    expect(publishedRevision).toBe(3);
  });

  it('does not create a default draft during an ordinary re-publication', async () => {
    let saved = false;
    let published = false;
    const api = {
      getDesignerDraft: async () => designerDraft(),
      previewAssignees: async () => {
        throw new Error('should not preview during ordinary re-publication');
      },
      saveDraft: async () => {
        saved = true;
        return workflowDefinition();
      },
      publish: async () => {
        published = true;
        return workflowDefinition({ status: 'PUBLISHED', version: 2, draftRevision: null });
      },
    };

    await expect(publishWorkflowFromCenter(api, 'ASSET_TRANSFER', '资产转移流程', '用于资产转移审批'))
      .rejects.toThrow('请先保存并重新审阅流程草稿后再发布');
    expect(saved).toBe(false);
    expect(published).toBe(false);
  });

  it('refuses to publish a default graph without a resolvable assignee', async () => {
    let published = false;
    const api = {
      getDesignerDraft: async () => designerDraft(),
      listRoles: async () => [{ id: 1, roleCode: 'SUPER_ADMIN' }, { id: 2, roleCode: 'ADMIN' }],
      previewAssignees: async () => ({
        businessType: 'ASSET_TRANSFER',
        calculable: false,
        missingFields: [],
        nodes: [{ stepNo: 1, nodeId: 'approval', resolved: false, assignees: [] }],
      }),
      saveDraft: async () => workflowDefinition({ draftRevision: 1 }),
      publish: async () => {
        published = true;
        return workflowDefinition({ status: 'PUBLISHED', version: 1, draftRevision: null });
      },
    };

    await expect(publishWorkflowFromCenter(
      api,
      'ASSET_TRANSFER',
      '资产转移流程',
      '用于资产转移审批',
      { createDefaultDraft: true },
    )).rejects.toThrow(MISSING_RESOLVABLE_ASSIGNEE_MESSAGE);
    expect(published).toBe(false);
  });
});
