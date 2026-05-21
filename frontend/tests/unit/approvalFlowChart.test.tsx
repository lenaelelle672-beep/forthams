import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApprovalFlowChart } from '../../src/app/components/approval/ApprovalFlowChart';
import type { ApprovalHistoryItem, ApprovalItem, ApprovalRuntimePathStep } from '../../src/app/services/approval/types';

const runtimePath: ApprovalRuntimePathStep[] = [
  {
    stepNo: 1,
    nodeId: 'approval-1',
    nodeCode: 'APP-DEPT',
    label: '部门审批',
    approverRole: '部门负责人',
    approverType: 'role',
    approvalMode: 'all',
  },
  {
    stepNo: 2,
    nodeId: 'approval-2',
    nodeCode: 'APP-FINANCE',
    label: '财务复核',
    approverRole: '财务经理',
    approverType: 'role',
    approvalMode: 'sequence',
  },
];

function approval(overrides: Partial<ApprovalItem> = {}): ApprovalItem {
  return {
    id: 5,
    processNo: 'APR-20260520-001',
    type: 'ASSET_TRANSFER',
    businessId: 12,
    businessData: '{}',
    workflowRuntimePath: runtimePath,
    workflowResultAction: '审批完成并归档',
    applicant: 7,
    status: 'PENDING',
    currentStep: 1,
    createdAt: '2026-05-20T00:00:00Z',
    updatedAt: '2026-05-20T00:00:00Z',
    history: [],
    ...overrides,
  };
}

function record(id: number, stepNo: number, operator: number, comment: string): ApprovalHistoryItem {
  return {
    id,
    processId: 5,
    stepNo,
    operator,
    status: 'APPROVED',
    operatedAt: '2026-05-20T00:00:00Z',
    comment,
  };
}

describe('ApprovalFlowChart', () => {
  it('keeps every approval record for all-mode workflow steps', () => {
    render(
      <ApprovalFlowChart
        approval={approval()}
        approvalHistory={[
          record(1, 1, 42, '部门审批通过'),
          record(2, 1, 99, '另一审批人通过'),
        ]}
      />,
    );

    expect(screen.getByText('部门审批')).toBeInTheDocument();
    expect(screen.getByText('操作人 #42')).toBeInTheDocument();
    expect(screen.getByText('操作人 #99')).toBeInTheDocument();
    expect(screen.getByText('部门审批通过')).toBeInTheDocument();
    expect(screen.getByText('另一审批人通过')).toBeInTheDocument();
  });

  it('uses different copy for pending and upcoming runtime steps', () => {
    render(
      <ApprovalFlowChart
        approval={approval()}
        approvalHistory={[]}
      />,
    );

    expect(screen.getByText('流程 APR-20260520-001 正在等待第 1 步审批。')).toBeInTheDocument();
    expect(screen.getByText('第 2 步尚未开始。')).toBeInTheDocument();
  });

  it('renders only the backend resolved runtime path instead of re-evaluating conditions on the client', () => {
    render(
      <ApprovalFlowChart
        approval={approval({
          workflowRuntimePath: [{
            stepNo: 1,
            nodeId: 'approval-false',
            nodeCode: 'APP-NORMAL',
            label: '普通审批',
            approverRole: '部门负责人',
            approverType: 'role',
            approvalMode: 'sequence',
          }],
          businessData: JSON.stringify({
            _approvalPayload: { amount: 6000 },
            _workflowDefinition: { nodes: [{ id: 'approval-true', data: { label: '高额审批' } }] },
          }),
        })}
        approvalHistory={[]}
      />,
    );

    expect(screen.getByText('普通审批')).toBeInTheDocument();
    expect(screen.queryByText('高额审批')).not.toBeInTheDocument();
  });

  it('falls back to approval records when backend runtime path is absent', () => {
    render(
      <ApprovalFlowChart
        approval={approval({ workflowRuntimePath: [] })}
        approvalHistory={[record(1, 1, 42, '旧流程审批通过')]}
      />,
    );

    expect(screen.getByText('第1步审批')).toBeInTheDocument();
    expect(screen.getByText('旧流程审批通过')).toBeInTheDocument();
  });
});
