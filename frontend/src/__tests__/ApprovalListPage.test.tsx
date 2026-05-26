import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApprovalListPage from '@/pages/approval/ApprovalListPage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/api/approval', () => ({
  getApprovalList: vi.fn(),
  getPendingApprovals: vi.fn(),
  getPendingCount: vi.fn(),
  approveItem: vi.fn(),
  rejectItem: vi.fn(),
  getApprovalDetail: vi.fn(),
}));

import { getApprovalList, getPendingApprovals, getPendingCount, getApprovalDetail } from '@/api/approval';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ApprovalListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPendingApprovals).mockResolvedValue({ records: [], total: 0, size: 20, current: 1 });
    vi.mocked(getPendingCount).mockResolvedValue(5);
    vi.mocked(getApprovalList).mockResolvedValue({ records: [], total: 0, size: 20, current: 1 });
    vi.mocked(getApprovalDetail).mockResolvedValue({ code: 200, message: 'success', data: null });
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
      expect(screen.getByText('待我审批')).toBeTruthy();
      expect(screen.getByText('我发起的')).toBeTruthy();
      expect(screen.getByText('已审批')).toBeTruthy();
    });
  });

  it('shows breadcrumb link to dashboard', async () => {
    render(<ApprovalListPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('仪表板')).toBeTruthy());
  });

  it('handles API error gracefully', async () => {
    vi.mocked(getPendingCount).mockRejectedValue(new Error('API error'));
    vi.mocked(getApprovalList).mockRejectedValue(new Error('API error'));
    render(<ApprovalListPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getAllByText('审批中心').length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });
  });
});
