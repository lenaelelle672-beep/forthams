import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { ApprovalFlowChart } from '@/app/components/approval/ApprovalFlowChart';

type ApprovalFlowChartProps = ComponentProps<typeof ApprovalFlowChart>;

const runtimePath = [
  {
    stepNo: 1,
    nodeId: 'submit',
    nodeCode: 'SUBMIT',
    label: '提交申请',
    approverType: 'user',
    approverId: 1001,
    approvalMode: 'sequence',
  },
  {
    stepNo: 2,
    nodeId: 'dept-review',
    nodeCode: 'DEPT_REVIEW',
    label: '部门审批',
    approverType: 'role',
    approverRole: 'DEPT_MANAGER',
    approverRoleName: '部门经理',
    approvalMode: 'all',
  },
  {
    stepNo: 3,
    nodeId: 'finance-review',
    nodeCode: 'FINANCE_REVIEW',
    label: '财务审批',
    approverType: 'role',
    approverRole: 'FINANCE',
    approverRoleName: '财务专员',
    approvalMode: 'any',
  },
];

function renderChart({
  approval = {
    id: 3001,
    processNo: 'AP-3001',
    status: 'PENDING',
    currentStep: 2,
    workflowRuntimePath: runtimePath,
  },
  approvalHistory = [
    {
      id: 1,
      stepNo: 1,
      operator: 1001,
      operatorName: '申请人甲',
      status: 'APPROVED',
      operatedAt: '2026-06-01T09:00:00.000Z',
      comment: '已提交',
    },
  ],
  workflowRuntimePath,
}: {
  approval?: ApprovalFlowChartProps['approval'];
  approvalHistory?: ApprovalFlowChartProps['approvalHistory'];
  workflowRuntimePath?: ApprovalFlowChartProps['workflowRuntimePath'];
} = {}) {
  return render(
    <ApprovalFlowChart
      title="运行态流程图"
      approval={approval}
      approvalHistory={approvalHistory}
      workflowRuntimePath={workflowRuntimePath}
    />,
  );
}

function summary() {
  return screen.getByTestId('approval-flow-step-summary');
}

describe('ApprovalFlowChart runtime states', () => {
  it('renders the runtime chart section title and complete legend', () => {
    renderChart();

    expect(screen.getByRole('region', { name: '运行态流程图' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '运行态流程图' })).toBeInTheDocument();
    const legend = screen.getByText('已取消').closest('div');
    expect(legend).not.toBeNull();
    expect(within(legend as HTMLElement).getByText('已完成')).toBeInTheDocument();
    expect(within(legend as HTMLElement).getByText('当前处理')).toBeInTheDocument();
    expect(within(legend as HTMLElement).getByText('待处理/未到达')).toBeInTheDocument();
    expect(within(legend as HTMLElement).getByText('异常/驳回')).toBeInTheDocument();
    expect(within(legend as HTMLElement).getByText('已取消')).toBeInTheDocument();
    expect(within(legend as HTMLElement).getByText('已结束')).toBeInTheDocument();
  });

  it('builds completed, current, and upcoming nodes from runtime path and history', () => {
    renderChart();

    expect(screen.getByTestId('approval-flow-node-state-completed-step-1')).toBeInTheDocument();
    expect(screen.getByTestId('approval-flow-node-state-current-step-2')).toBeInTheDocument();
    expect(screen.getByTestId('approval-flow-node-state-upcoming-step-3')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('approval-flow-node-state-current-step-2'));

    expect(within(summary()).getByTestId('approval-flow-summary-state')).toHaveTextContent('当前处理');
    expect(within(summary()).getByText('部门经理')).toBeInTheDocument();
    expect(within(summary()).getByText('会签')).toBeInTheDocument();
    expect(within(summary()).getByRole('link', { name: '部门审批' })).toHaveAttribute(
      'href',
      '#workflow-section-dept-review',
    );

    fireEvent.click(screen.getByTestId('approval-flow-node-state-upcoming-step-3'));

    expect(within(summary()).getByTestId('approval-flow-summary-state')).toHaveTextContent('待处理/未到达');
    expect(within(summary()).getByText('财务专员（待流转后确认）')).toBeInTheDocument();
    expect(within(summary()).getByText('或签')).toBeInTheDocument();
    expect(within(summary()).getByRole('link', { name: '财务审批' })).toHaveAttribute(
      'href',
      '#workflow-section-finance-review',
    );
  });

  it('renders rejected nodes with rejected summary state and section anchor', () => {
    renderChart({
      approval: {
        id: 3002,
        processNo: 'AP-3002',
        status: 'REJECTED',
        currentStep: 2,
        workflowRuntimePath: runtimePath,
      },
      approvalHistory: [
        {
          id: 21,
          stepNo: 2,
          operatorName: '部门经理',
          status: 'REJECTED',
          operatedAt: '2026-06-01T10:00:00.000Z',
          comment: '资料不完整',
        },
      ],
    });

    fireEvent.click(screen.getByTestId('approval-flow-node-state-rejected-step-2'));

    expect(within(summary()).getByTestId('approval-flow-summary-state')).toHaveTextContent('异常/驳回');
    expect(within(summary()).getByRole('link', { name: '部门审批' })).toHaveAttribute(
      'href',
      '#workflow-section-dept-review',
    );
  });

  it('renders cancelled nodes with cancelled summary state and section anchor', () => {
    renderChart({
      approval: {
        id: 3003,
        processNo: 'AP-3003',
        status: 'CANCELLED',
        currentStep: 3,
        workflowRuntimePath: runtimePath,
      },
      approvalHistory: [
        {
          id: 31,
          stepNo: 3,
          operatorName: '财务专员',
          status: 'CANCELLED',
          operatedAt: '2026-06-01T11:00:00.000Z',
          comment: '申请人撤回',
        },
      ],
    });

    fireEvent.click(screen.getByTestId('approval-flow-node-state-cancelled-step-3'));

    expect(within(summary()).getByTestId('approval-flow-summary-state')).toHaveTextContent('已结束/已取消');
    expect(within(summary()).getByRole('link', { name: '财务审批' })).toHaveAttribute(
      'href',
      '#workflow-section-finance-review',
    );
  });

  it('renders ended nodes when an approved runtime step has no completed records', () => {
    renderChart({
      approval: {
        id: 3004,
        processNo: 'AP-3004',
        status: 'APPROVED',
        currentStep: 2,
        workflowRuntimePath: runtimePath.slice(0, 2),
      },
      approvalHistory: [
        {
          id: 41,
          stepNo: 1,
          operatorName: '申请人甲',
          status: 'APPROVED',
          operatedAt: '2026-06-01T09:00:00.000Z',
        },
      ],
    });

    fireEvent.click(screen.getByTestId('approval-flow-node-state-ended-step-2'));

    expect(within(summary()).getByTestId('approval-flow-summary-state')).toHaveTextContent('已结束');
  });

  it('keeps the runtime chart aria label in the empty state', () => {
    renderChart({
      approval: null,
      approvalHistory: [],
      workflowRuntimePath: [],
    });

    expect(screen.getByRole('region', { name: '运行态流程图' })).toBeInTheDocument();
    expect(screen.getByText('暂无审批流转数据')).toBeInTheDocument();
  });
});
