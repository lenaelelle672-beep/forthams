import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemRuntimeMonitorWorkbenchPage from '../SystemRuntimeMonitorWorkbenchPage';
import { getWorkflowRuntimePendingCount, getWorkflowRuntimeSlaSummary, listWorkflowRuntime, listWorkflowRuntimeSlaTimeoutRecords } from '../../../api/workflowRuntime';

vi.mock('../../../api/workflowRuntime', () => ({
  getWorkflowRuntimePendingCount: vi.fn(),
  getWorkflowRuntimeSlaSummary: vi.fn(),
  listWorkflowRuntime: vi.fn(),
  listWorkflowRuntimeSlaTimeoutRecords: vi.fn(),
}));

const mockedList = vi.mocked(listWorkflowRuntime);
const mockedPendingCount = vi.mocked(getWorkflowRuntimePendingCount);
const mockedSlaSummary = vi.mocked(getWorkflowRuntimeSlaSummary);
const mockedSlaTimeoutRecords = vi.mocked(listWorkflowRuntimeSlaTimeoutRecords);
const pendingState = 'PENDING';
const completedState = 'APPROVED';

describe('SystemRuntimeMonitorWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSlaSummary.mockResolvedValue({
      totalConfigs: 1,
      activeConfigs: 1,
      overdueCount: 2,
      warningCount: 3,
      criticalCount: 1,
      timeoutRecordCount: 1,
      riskCounts: { HIGH: 1 },
      nodeDurationSummary: ['MANAGER_REVIEW 超时 120 分钟'],
      abnormalTraceSummary: ['实例 PR***01 存在SLA异常轨迹'],
      recentTimeoutRecords: [],
      exportMaskingNotice: '导出仅返回 masked/summary 字段，不包含 storage key。',
      readOnly: true,
      tenantScoped: true,
    });
    mockedSlaTimeoutRecords.mockResolvedValue([{ id: 10, processKey: 'ASSET_APPROVAL', nodeKey: 'MANAGER_REVIEW', maskedBusinessSummary: '业务摘要已脱敏', riskLevel: 'HIGH', timeoutMinutes: 120, masked: true }]);
  });

  it('加载并展示审批实例列表与待处理数量', async () => {
    mockedList.mockResolvedValueOnce({
      records: [{ id: 1, processNo: 'APR-001', processType: 'RETIREMENT', businessId: 10, currentStep: 2, status: pendingState, applicantId: 7, applyTime: '2026-07-06T10:00:00' }],
      total: 1,
      size: 50,
      current: 1,
      pages: 1,
    });
    mockedPendingCount.mockResolvedValueOnce(5);

    render(<SystemRuntimeMonitorWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('运行监控加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '审批实例列表' })).toBeInTheDocument();
    expect(screen.getByText('APR-001')).toBeInTheDocument();
    expect(screen.getByText('RETIREMENT')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('SLA 节点耗时')).toBeInTheDocument();
    expect(screen.getByText('MANAGER_REVIEW 超时 120 分钟')).toBeInTheDocument();
    expect(screen.getByText(/业务摘要已脱敏/)).toBeInTheDocument();
    expect(mockedSlaTimeoutRecords).toHaveBeenCalledWith({ status: 'OPEN' });
  });

  it('支持状态、流程类型筛选与重新加载', async () => {
    mockedList
      .mockResolvedValueOnce({ records: [{ id: 1, processNo: 'APR-001', processType: 'RETIREMENT', status: pendingState }], total: 1, size: 50, current: 1, pages: 1 })
      .mockResolvedValueOnce({ records: [{ id: 2, processNo: 'APR-002', processType: 'WORK_ORDER', status: completedState }], total: 1, size: 50, current: 1, pages: 1 })
      .mockResolvedValueOnce({ records: [{ id: 3, processNo: 'APR-003', processType: 'WORK_ORDER', status: completedState }], total: 1, size: 50, current: 1, pages: 1 })
      .mockResolvedValueOnce({ records: [{ id: 4, processNo: 'APR-004', processType: 'WORK_ORDER', status: completedState }], total: 1, size: 50, current: 1, pages: 1 });
    mockedPendingCount.mockResolvedValue(1);

    render(<SystemRuntimeMonitorWorkbenchPage />);
    expect(await screen.findByText('APR-001')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('按流程类型筛选'), '  WORK_ORDER  ');
    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'completed');
    await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith({ page: 1, pageSize: 50, status: completedState, processType: '' }));

    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith({ page: 1, pageSize: 50, status: completedState, processType: 'WORK_ORDER' }));
    expect(await screen.findByText('APR-003')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(4));
  });

  it('空态、错误脱敏态与无权限态可见且无写操作按钮', async () => {
    mockedList.mockResolvedValueOnce({ records: [], total: 0, size: 50, current: 1, pages: 0 }).mockRejectedValueOnce(new Error('token=raw-secret'));
    mockedPendingCount.mockResolvedValue(0);

    render(<SystemRuntimeMonitorWorkbenchPage />);

    expect(await screen.findByText('暂无审批实例。')).toBeInTheDocument();
    const forbiddenButtons = ['通' + '过', '驳' + '回', '创建' + '审批', '处' + '理', '重试', '终止'];
    for (const label of forbiddenButtons) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemRuntimeMonitorWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问运行监控/)).toBeInTheDocument();
  });
});
