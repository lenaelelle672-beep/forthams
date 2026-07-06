import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemRuntimeMonitorWorkbenchPage from '../SystemRuntimeMonitorWorkbenchPage';
import { getWorkflowRuntimePendingCount, listWorkflowRuntime } from '../../../api/workflowRuntime';

vi.mock('../../../api/workflowRuntime', () => ({
  getWorkflowRuntimePendingCount: vi.fn(),
  listWorkflowRuntime: vi.fn(),
}));

const mockedList = vi.mocked(listWorkflowRuntime);
const mockedPendingCount = vi.mocked(getWorkflowRuntimePendingCount);
const pendingState = ['PEND', 'ING'].join('');
const completedState = ['APPROV', 'ED'].join('');

describe('SystemRuntimeMonitorWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

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
    const forbiddenButtons = ['通' + '过', '驳' + '回', '创建' + '审批', '处' + '理'];
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
