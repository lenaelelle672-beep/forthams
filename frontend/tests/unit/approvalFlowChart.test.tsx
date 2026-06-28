import { fireEvent, render, screen, within } from '@testing-library/react';
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

    expect(screen.getAllByText('部门审批').length).toBeGreaterThan(0);
    expect(screen.getAllByText('操作人 #42').length).toBeGreaterThan(0);
    expect(screen.getByText('操作人 #99')).toBeInTheDocument();
    expect(screen.getAllByText('部门审批通过').length).toBeGreaterThan(0);
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

    expect(screen.getAllByText('普通审批').length).toBeGreaterThan(0);
    expect(screen.queryByText('高额审批')).not.toBeInTheDocument();
  });

  it('falls back to approval records when backend runtime path is absent', () => {
    render(
      <ApprovalFlowChart
        approval={approval({ workflowRuntimePath: [] })}
        approvalHistory={[record(1, 1, 42, '旧流程审批通过')]}
      />,
    );

    expect(screen.getAllByText('第1步审批').length).toBeGreaterThan(0);
    expect(screen.getAllByText('旧流程审批通过').length).toBeGreaterThan(0);
  });

  it('normalizes runtime node states and exposes stable locators', () => {
    render(
      <ApprovalFlowChart
        approval={approval({ currentStep: 2 })}
        approvalHistory={[record(1, 1, 42, '部门审批通过')]}
      />,
    );

    expect(screen.getByTestId('approval-flow-node-state-completed-step-1')).toBeVisible();
    expect(screen.getByTestId('approval-flow-node-state-current-step-2')).toBeVisible();
    expect(screen.getByTestId('approval-flow-step-summary')).toHaveTextContent('财务复核');
    expect(screen.getByTestId('approval-flow-summary-state')).toHaveTextContent('当前处理');
  });

  it('uses state-specific connector colors for rejected, cancelled and ended states', () => {
    const assertConnector = (status: ApprovalItem['status'], testId: string, expectedClass: string) => {
      const { unmount } = render(
        <ApprovalFlowChart
          approval={approval({ status, currentStep: 1 })}
          approvalHistory={[]}
        />,
      );

      const connector = screen.getByTestId(testId);
      expect(connector).toHaveClass(expectedClass);
      expect(connector).not.toHaveClass('bg-blue-50');
      unmount();
    };

    assertConnector('REJECTED', 'approval-flow-connector-state-rejected-step-1', 'bg-red-100');
    assertConnector('CANCELLED', 'approval-flow-connector-state-cancelled-step-1', 'bg-rose-100');

    const endedPath: ApprovalRuntimePathStep[] = [
      ...runtimePath,
      {
        stepNo: 3,
        nodeId: 'approval-3',
        nodeCode: 'APP-ARCHIVE',
        label: '归档确认',
        approverRole: '档案管理员',
        approverType: 'role',
        approvalMode: 'sequence',
      },
    ];
    render(
      <ApprovalFlowChart
        approval={approval({ status: 'APPROVED', currentStep: 1, workflowRuntimePath: endedPath })}
        approvalHistory={[]}
      />,
    );

    const endedConnector = screen.getByTestId('approval-flow-connector-state-ended-step-1');
    expect(endedConnector).toHaveClass('bg-slate-200');
    expect(endedConnector).not.toHaveClass('bg-blue-50');
  });

  it('opens a visible summary from click and focus', () => {
    render(
      <ApprovalFlowChart
        approval={approval({ currentStep: 2 })}
        approvalHistory={[record(1, 1, 42, '部门审批通过')]}
      />,
    );

    fireEvent.click(screen.getByTestId('approval-flow-node-state-completed-step-1'));
    const summary = screen.getByTestId('approval-flow-step-summary');
    expect(within(summary).getAllByText('部门审批').length).toBeGreaterThan(0);
    expect(within(summary).getByText('已完成')).toBeInTheDocument();
    expect(within(summary).getByText('部门审批通过')).toBeInTheDocument();
    expect(within(summary).getByText('操作人 #42')).toBeInTheDocument();

    fireEvent.focus(screen.getByTestId('approval-flow-node-state-current-step-2'));
    expect(summary).toHaveTextContent('财务复核');
    expect(summary).toHaveTextContent('当前处理');
  });

  it('does not show unconfirmed future concrete user ids', () => {
    render(
      <ApprovalFlowChart
        approval={approval({
          currentStep: 1,
          workflowRuntimePath: [
            runtimePath[0],
            {
              ...runtimePath[1],
              approverType: 'user',
              approverId: 123,
              approverRole: undefined,
            },
          ],
        })}
        approvalHistory={[]}
      />,
    );

    fireEvent.click(screen.getByTestId('approval-flow-node-state-upcoming-step-2'));
    const summary = screen.getByTestId('approval-flow-step-summary');
    expect(summary).toHaveTextContent('待流转后确认');
    expect(summary).not.toHaveTextContent('指定用户 #123');
  });
});
