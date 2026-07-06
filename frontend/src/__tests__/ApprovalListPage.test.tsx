import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApprovalListPage from '@/pages/approval/ApprovalListPage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'approval:messages.loadFailed': '加载审批数据失败，请重试',
      'approval:list.emptyText': '暂无审批数据，试试调整搜索、状态或日期筛选',
      'approval:list.loading': '加载中',
      'approval:statusOptions.PENDING': '审批中',
      'approval:statusOptions.APPROVED': '已通过',
      'approval:statusOptions.REJECTED': '已驳回',
      'common:actions.refresh': '重新加载',
    }[key] ?? key),
  }),
}));

vi.mock('@/api/workflow', () => ({
  workflowApi: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/api/base', () => ({
  getUserList: vi.fn().mockResolvedValue({ records: [] }),
}));

vi.mock('@/components/ApprovalFlowTracker', () => ({
  default: () => <div data-testid="approval-flow-tracker">审批流转图</div>,
}));

vi.mock('@/api/approval', () => ({
  getApprovalList: vi.fn(),
  getPendingApprovals: vi.fn(),
  getPendingCount: vi.fn(),
  approveItem: vi.fn(),
  rejectItem: vi.fn(),
  getApprovalDetail: vi.fn(),
  getProcessStats: vi.fn(),
}));

import {
  getApprovalList,
  getPendingApprovals,
  getPendingCount,
  getApprovalDetail,
  getProcessStats,
  approveItem,
  rejectItem,
} from '@/api/approval';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const approvalRow = {
  id: 101,
  processNo: 'AP-101',
  processType: 'ASSET_TRANSFER',
  applicantId: 8,
  applicantName: '张三',
  title: '资产转移申请',
  status: 'PENDING',
  version: 2,
  createTime: '2026-05-31',
};

describe('ApprovalListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPendingApprovals).mockResolvedValue({ records: [], total: 0, size: 20, current: 1 });
    vi.mocked(getPendingCount).mockResolvedValue(5);
    vi.mocked(getApprovalList).mockImplementation(async (params) => {
      if (params?.pageSize === 1) {
        return { records: [], total: params.status === 'APPROVED' ? 3 : 1, size: 1, current: 1 };
      }
      return { records: [approvalRow], total: 1, size: 10, current: 1 };
    });
    vi.mocked(getApprovalDetail).mockResolvedValue({ process: approvalRow, records: [], workflowRuntimePath: [] });
    vi.mocked(getProcessStats).mockResolvedValue([]);
    vi.mocked(approveItem).mockResolvedValue(approvalRow);
    vi.mocked(rejectItem).mockResolvedValue(approvalRow);
  });

  it('renders page header and breadcrumbs', async () => {
    render(<ApprovalListPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getAllByText('审批中心').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays tabs for filtering', async () => {
    render(<ApprovalListPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /待我审批/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: '我发起的' })).toBeTruthy();
      expect(screen.getAllByText('已通过').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows launch application action', async () => {
    render(<ApprovalListPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByRole('button', { name: '发起申请' })).toBeTruthy());
  });

  it('passes processType when type filter changes', async () => {
    render(<ApprovalListPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('资产转移申请')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '资产调拨' }));

    await waitFor(() => {
      expect(vi.mocked(getApprovalList)).toHaveBeenCalledWith(
        expect.objectContaining({ processType: 'ASSET_TRANSFER', status: 'PENDING' })
      );
    });
  });

  it('passes keyword when search changes', async () => {
    render(<ApprovalListPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('资产转移申请')).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText('搜索编号、标题或发起人'), { target: { value: 'AP-101' } });

    await waitFor(() => {
      expect(vi.mocked(getApprovalList)).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: 'AP-101', status: 'PENDING' })
      );
    });
  });

  it('hides approval actions outside pending tab', async () => {
    render(<ApprovalListPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('资产转移申请')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '我发起的' }));

    await waitFor(() => {
      expect(screen.queryByText('通过')).toBeNull();
      expect(screen.queryByText('驳回')).toBeNull();
      expect(screen.getAllByRole('button', { name: '查看' }).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders view-only row action in the list', async () => {
    render(<ApprovalListPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('资产转移申请')).toBeTruthy());
    expect(screen.getAllByRole('button', { name: '查看' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: '通过' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '驳回' })).not.toBeInTheDocument();
  });

  it('shows empty state when approval list is empty', async () => {
    vi.mocked(getApprovalList).mockImplementation(async (params) => {
      if (params?.pageSize === 1) {
        return { records: [], total: 0, size: 1, current: 1 };
      }
      return { records: [], total: 0, size: 10, current: 1 };
    });

    render(<ApprovalListPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('暂无审批数据，试试调整搜索、状态或日期筛选')).toBeTruthy());
  });

  it('shows visible error state when approval list fails', async () => {
    vi.mocked(getApprovalList).mockImplementation(async (params) => {
      if (params?.pageSize === 1) {
        return { records: [], total: 0, size: 1, current: 1 };
      }
      throw new Error('API error');
    });

    render(<ApprovalListPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('加载审批数据失败，请重试')).toBeTruthy());
    expect(screen.getByText('重新加载')).toBeTruthy();
  });
});
