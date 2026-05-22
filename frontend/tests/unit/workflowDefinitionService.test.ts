import { beforeEach, describe, expect, it, vi } from 'vitest';

import { workflowDefinitionService, type WorkflowDefinitionDTO } from '../../src/app/services/workflowDefinitionService';
import { api } from '../../src/app/utils/api';

vi.mock('../../src/app/utils/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

function fullDefinition() {
  return {
    id: 'WF-ASSET_TRANSFER',
    name: '字段完整流程',
    description: '覆盖流程设计器每个字段',
    businessType: 'ASSET_TRANSFER',
    nodes: [
      {
        id: 'start-1',
        type: 'start',
        position: { x: 120, y: 40 },
        data: {
          type: 'start',
          label: '提交申请',
          description: '提交后进入流程',
          nodeCode: 'START-APPLY',
          triggerType: '表单提交',
          approverRole: '',
          approvalMode: 'sequence',
          conditionExpression: '',
          trueLabel: '',
          falseLabel: '',
          resultAction: '',
        },
      },
      {
        id: 'approval-1',
        type: 'approval',
        position: { x: 120, y: 200 },
        data: {
          type: 'approval',
          label: '部门审批',
          description: '部门负责人确认',
          nodeCode: 'APP-DEPT',
          triggerType: '',
          approverRole: '部门负责人',
          approvalMode: 'all',
          conditionExpression: '',
          trueLabel: '',
          falseLabel: '',
          resultAction: '',
        },
      },
      {
        id: 'condition-1',
        type: 'condition',
        position: { x: 120, y: 360 },
        data: {
          type: 'condition',
          label: '金额判断',
          description: '根据金额分支',
          nodeCode: 'COND-AMOUNT',
          triggerType: '',
          approverRole: '',
          approvalMode: 'sequence',
          conditionExpression: '申请金额 >= 5000',
          trueLabel: '大额采购',
          falseLabel: '常规采购',
          resultAction: '',
        },
      },
      {
        id: 'end-1',
        type: 'end',
        position: { x: 120, y: 520 },
        data: {
          type: 'end',
          label: '流程结束',
          description: '归档并同步业务状态',
          nodeCode: 'END-ARCHIVE',
          triggerType: '',
          approverRole: '',
          approvalMode: 'sequence',
          conditionExpression: '',
          trueLabel: '',
          falseLabel: '',
          resultAction: '归档并同步到审批列表',
        },
      },
    ],
    edges: [
      {
        id: 'edge-start-approval',
        source: 'start-1',
        target: 'approval-1',
        sourceHandle: null,
        targetHandle: null,
        type: 'smoothstep',
        animated: true,
        label: null,
        markerEnd: { type: 'arrowclosed', color: 'var(--color-primary)' },
        style: { stroke: 'var(--color-primary)', strokeWidth: 2 },
        labelStyle: { fill: 'var(--color-foreground)', fontSize: 12, fontWeight: 600 },
        labelBgStyle: { fill: 'var(--workflow-surface)', fillOpacity: 1 },
      },
      {
        id: 'edge-approval-condition',
        source: 'approval-1',
        target: 'condition-1',
        sourceHandle: null,
        targetHandle: null,
        type: 'smoothstep',
        animated: true,
        label: null,
        markerEnd: { type: 'arrowclosed', color: 'var(--color-primary)' },
        style: { stroke: 'var(--color-primary)', strokeWidth: 2 },
        labelStyle: { fill: 'var(--color-foreground)', fontSize: 12, fontWeight: 600 },
        labelBgStyle: { fill: 'var(--workflow-surface)', fillOpacity: 1 },
      },
      {
        id: 'edge-condition-true',
        source: 'condition-1',
        target: 'end-1',
        sourceHandle: 'condition-true',
        targetHandle: 'target-main',
        type: 'smoothstep',
        animated: false,
        label: '大额采购',
        markerEnd: { type: 'arrowclosed', color: 'var(--color-primary)' },
        style: { stroke: 'var(--color-primary)', strokeWidth: 2 },
        labelStyle: { fill: 'var(--color-foreground)', fontSize: 12, fontWeight: 600 },
        labelBgStyle: { fill: 'var(--workflow-surface)', fillOpacity: 1 },
      },
      {
        id: 'edge-condition-false',
        source: 'condition-1',
        target: 'end-1',
        sourceHandle: 'condition-false',
        targetHandle: 'target-alt',
        type: 'smoothstep',
        animated: false,
        label: '常规采购',
        markerEnd: { type: 'arrowclosed', color: 'var(--color-primary)' },
        style: { stroke: 'var(--color-primary)', strokeWidth: 2 },
        labelStyle: { fill: 'var(--color-foreground)', fontSize: 12, fontWeight: 600 },
        labelBgStyle: { fill: 'var(--workflow-surface)', fillOpacity: 1 },
      },
    ],
  };
}

function fullDto(overrides: Partial<WorkflowDefinitionDTO> = {}): WorkflowDefinitionDTO {
  return {
    id: 9,
    businessType: 'ASSET_TRANSFER',
    name: '字段完整流程',
    description: '覆盖流程设计器每个字段',
    definition: fullDefinition(),
    status: 'PUBLISHED',
    version: 3,
    updatedBy: 88,
    publishedBy: 99,
    publishedAt: '2026-05-13T08:00:00',
    createTime: '2026-05-12T08:00:00',
    updateTime: '2026-05-13T09:00:00',
    ...overrides,
  };
}

describe('workflowDefinitionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('user_info', JSON.stringify({ id: 88 }));
  });

  it('passes every workflow designer field when saving a draft', async () => {
    const payload = {
      name: '字段完整流程',
      description: '覆盖流程设计器每个字段',
      definition: fullDefinition(),
    };
    const response = fullDto({ status: 'DRAFT', version: 0, definition: payload.definition });
    mockedApi.put.mockResolvedValueOnce(response);

    const result = await workflowDefinitionService.saveDraft('ASSET_TRANSFER', payload);

    expect(mockedApi.put).toHaveBeenCalledWith('/workflows/ASSET_TRANSFER/draft', {
      ...payload,
      operatorId: 88,
    });
    expect(result).toEqual(response);
    expect(result.definition).toEqual(payload.definition);
  });

  it('returns every workflow definition DTO field from get/list/publish/status APIs', async () => {
    const dto = fullDto();
    mockedApi.get.mockResolvedValueOnce(dto).mockResolvedValueOnce([dto]);
    mockedApi.post.mockResolvedValueOnce(dto).mockResolvedValueOnce(fullDto({ status: 'DISABLED' }));

    await expect(workflowDefinitionService.get('ASSET_TRANSFER')).resolves.toEqual(dto);
    await expect(workflowDefinitionService.list()).resolves.toEqual([dto]);
    await expect(workflowDefinitionService.publish('ASSET_TRANSFER')).resolves.toEqual(dto);
    await expect(workflowDefinitionService.updateStatus('ASSET_TRANSFER', 'DISABLED')).resolves.toEqual(
      fullDto({ status: 'DISABLED' }),
    );

    expect(mockedApi.get).toHaveBeenNthCalledWith(1, '/workflows/ASSET_TRANSFER');
    expect(mockedApi.get).toHaveBeenNthCalledWith(2, '/workflows');
    expect(mockedApi.post).toHaveBeenNthCalledWith(1, '/workflows/ASSET_TRANSFER/publish', { operatorId: 88 });
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, '/workflows/ASSET_TRANSFER/status', { status: 'DISABLED', operatorId: 88 });
  });
});
