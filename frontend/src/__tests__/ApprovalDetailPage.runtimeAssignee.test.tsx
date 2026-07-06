import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApprovalDetailPage from '@/pages/approval/ApprovalDetailPage';
import { getApprovalDetail } from '@/api/approval';
import { workflowApi } from '@/api/workflow';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'approval:list.loading': '加载中',
      'approval:messages.approveSuccess': '审批通过成功',
      'approval:messages.rejectSuccess': '审批驳回成功',
      'approval:messages.recallSuccess': '审批已取消',
    }[key] ?? key),
  }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      userId: 9001,
      id: 9001,
      username: 'readonly.viewer',
      realName: '只读查看人',
      roles: ['VIEWER'],
      permissions: ['approval:process:view'],
    },
  }),
}));

vi.mock('@/api/base', () => ({
  getUserList: vi.fn().mockResolvedValue({ records: [] }),
}));

vi.mock('@/api/approval', () => ({
  getApprovalDetail: vi.fn(),
  approveItem: vi.fn(),
  rejectItem: vi.fn(),
  cancelApproval: vi.fn(),
}));

vi.mock('@/api/workflow', () => ({
  workflowApi: {
    previewRuntimeAssignees: vi.fn(),
  },
}));

vi.mock('@/components/approval/ApprovalFlowChart', () => ({
  ApprovalFlowChart: () => <div data-testid="approval-flow-chart" />,
}));

vi.mock('@/components/ApprovalFlowTracker', () => ({
  default: () => <div data-testid="approval-flow-tracker" />,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderApprovalDetailPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/approvals/101']}>
        <Routes>
          <Route path="/approvals/:id" element={<ApprovalDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function createDetailResponse() {
  return {
    process: {
      id: 101,
      processNo: 'AP-101',
      processType: 'ASSET_TRANSFER',
      businessType: 'ASSET_TRANSFER',
      businessId: 501,
      businessData: '{}',
      applicantId: 8,
      applicantName: '申请人甲',
      deptName: '资产管理部',
      title: '资产调拨申请',
      status: 'PENDING',
      currentStep: 2,
      version: 1,
      createTime: '2026-06-01 09:00',
    },
    records: [],
    workflowRuntimePath: [
      {
        stepNo: 1,
        nodeId: 'start',
        nodeCode: 'START',
        label: '发起申请',
        approverType: 'user',
        approverId: '8',
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
        approvalMode: 'sequence',
      },
    ],
  };
}

function resolvedPreview(assigneeCount: number, assignees: unknown[]) {
  return {
    businessType: 'ASSET_TRANSFER',
    calculable: true,
    missingFields: [],
    nodes: [
      {
        stepNo: 2,
        nodeId: 'dept-review',
        nodeCode: 'DEPT_REVIEW',
        label: '部门审批',
        approverType: 'role',
        approverRole: 'DEPT_MANAGER',
        resolved: true,
        assigneeCount,
        assignees,
      },
    ],
  };
}

describe('ApprovalDetailPage runtime assignee preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApprovalDetail).mockResolvedValue(createDetailResponse());
  });

  it('auto-loads a safe summary for calculable current-node assignees without exposing concrete assignees', async () => {
    vi.mocked(workflowApi.previewRuntimeAssignees).mockResolvedValue(
      resolvedPreview(2, [
        { userId: 'SECRET_UID_1001', realName: 'SECRET_NAME_ALPHA' },
        { userId: '1002', realName: '第二处理人' },
      ] as any),
    );

    renderApprovalDetailPage();

    const card = await screen.findByTestId('runtime-assignee-preview-card');
    expect(await within(card).findByText('已解析 2 名候选处理人')).toBeInTheDocument();
    expect(within(card).getByText('具体处理人名单已隐藏')).toBeInTheDocument();
    expect(within(card).queryByText(/SECRET_UID_1001|SECRET_NAME_ALPHA/)).not.toBeInTheDocument();
  });

  it('shows hidden-state reason and missing fields when runtime assignees are not calculable', async () => {
    vi.mocked(workflowApi.previewRuntimeAssignees).mockResolvedValue({
      businessType: 'ASSET_TRANSFER',
      calculable: false,
      reason: '缺少条件，无法确认处理人',
      missingFields: ['deptId', 'amount'],
      nodes: [],
    });

    renderApprovalDetailPage();

    await screen.findByText('缺少条件，无法确认处理人');
    const hidden = screen.getByTestId('runtime-assignee-preview-hidden');
    expect(within(hidden).getByText('缺少条件，无法确认处理人')).toBeInTheDocument();
    expect(within(hidden).getByText('缺少字段：deptId、amount')).toBeInTheDocument();
    expect(screen.queryByTestId('runtime-assignee-preview-result')).not.toBeInTheDocument();
    expect(screen.queryByText(/已解析/)).not.toBeInTheDocument();
  });

  it('recalculates manually and keeps concrete assignees hidden after the refreshed summary', async () => {
    vi.mocked(workflowApi.previewRuntimeAssignees)
      .mockResolvedValueOnce(resolvedPreview(1, [{ userId: '1001' }]))
      .mockResolvedValueOnce(
        resolvedPreview(3, [
          { userId: '1001' },
          { userId: 'SECRET_UID_2002', realName: 'SECRET_NAME_BETA' },
          { userId: '1003' },
        ] as any),
      );

    renderApprovalDetailPage();

    const card = await screen.findByTestId('runtime-assignee-preview-card');
    expect(await within(card).findByText('已解析 1 名候选处理人')).toBeInTheDocument();
    expect(workflowApi.previewRuntimeAssignees).toHaveBeenCalledTimes(1);

    fireEvent.click(within(card).getByRole('button', { name: '重新计算' }));

    await waitFor(() => expect(workflowApi.previewRuntimeAssignees).toHaveBeenCalledTimes(2));
    expect(await within(card).findByText('已解析 3 名候选处理人')).toBeInTheDocument();
    expect(within(card).getByText('具体处理人名单已隐藏')).toBeInTheDocument();
    expect(within(card).queryByText(/SECRET_UID_2002|SECRET_NAME_BETA/)).not.toBeInTheDocument();
  });

  it('shows the service failure reason and keeps the result hidden when runtime assignee preview fails', async () => {
    vi.mocked(workflowApi.previewRuntimeAssignees).mockRejectedValueOnce(new Error('处理人计算服务暂不可用'));

    renderApprovalDetailPage();

    const hidden = await screen.findByTestId('runtime-assignee-preview-hidden');
    await waitFor(() => {
      expect(within(hidden).getByText('处理人计算服务暂不可用')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('runtime-assignee-preview-result')).not.toBeInTheDocument();
    expect(screen.queryByText(/已解析/)).not.toBeInTheDocument();
  });

  it('blocks calculable previews that only return non-current future nodes without leaking future assignees', async () => {
    vi.mocked(workflowApi.previewRuntimeAssignees).mockResolvedValue({
      businessType: 'ASSET_TRANSFER',
      calculable: true,
      missingFields: [],
      nodes: [
        {
          stepNo: 3,
          nodeId: 'finance-review',
          nodeCode: 'FINANCE_REVIEW',
          label: '财务审批',
          approverType: 'user',
          resolved: true,
          assigneeCount: 1,
          assignees: [{ userId: 'SECRET_FUTURE_UID', realName: 'SECRET_FUTURE_ASSIGNEE' }],
        },
      ],
    });

    renderApprovalDetailPage();

    const hidden = await screen.findByTestId('runtime-assignee-preview-hidden');
    expect(await within(hidden).findByText('当前节点暂未返回可计算处理人')).toBeInTheDocument();
    expect(screen.queryByTestId('runtime-assignee-preview-result')).not.toBeInTheDocument();
    expect(screen.queryByText(/已解析/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SECRET_FUTURE_UID|SECRET_FUTURE_ASSIGNEE/)).not.toBeInTheDocument();
  });

  it('renders a disabled preview card without calling the API when the process has no business type', async () => {
    const response = createDetailResponse();
    response.process.processType = '';
    response.process.businessType = '';
    vi.mocked(getApprovalDetail).mockResolvedValueOnce(response);

    renderApprovalDetailPage();

    const card = await screen.findByTestId('runtime-assignee-preview-card');
    expect(within(card).getByRole('button', { name: '计算处理人' })).toBeDisabled();
    expect(within(card).getByText('当前流程缺少业务类型，处理人名单已隐藏')).toBeInTheDocument();
    expect(workflowApi.previewRuntimeAssignees).not.toHaveBeenCalled();
  });
});
