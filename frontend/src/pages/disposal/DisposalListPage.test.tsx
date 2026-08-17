import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';

const authMocks = vi.hoisted(() => ({ useAuth: vi.fn() }));
const disposalMocks = vi.hoisted(() => ({
  getCompensationList: vi.fn(),
  getDisposalList: vi.fn(),
  getDisposalStats: vi.fn(),
}));
const workOrderMocks = vi.hoisted(() => ({ getWorkOrderList: vi.fn() }));

vi.mock('@/context/AuthContext', () => ({ useAuth: authMocks.useAuth }));
vi.mock('@/api/disposal', async () => {
  const actual = await vi.importActual<typeof import('@/api/disposal')>('@/api/disposal');
  return {
    ...actual,
    getCompensationList: disposalMocks.getCompensationList,
    getDisposalList: disposalMocks.getDisposalList,
    getDisposalStats: disposalMocks.getDisposalStats,
  };
});
vi.mock('@/api/workorder', () => ({ getWorkOrderList: workOrderMocks.getWorkOrderList }));
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));
vi.mock('@/components/ui/DataTable', () => ({
  DataTable: ({ data }: { data: Array<{ disposalNo: string }> }) => (
    <div data-testid="disposal-rows">{data.map((row) => row.disposalNo).join(',')}</div>
  ),
}));
vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import DisposalListPage from './DisposalListPage';

function renderPage(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <DisposalListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DisposalListPage permission and filter contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    disposalMocks.getDisposalStats.mockResolvedValue({
      totalThisMonth: 1,
      monthOverMonthDelta: 0,
      pendingCount: 0,
      completedCount: 1,
      recoveredValue: 0,
    });
    disposalMocks.getDisposalList.mockResolvedValue({ records: [], total: 0, size: 10, current: 1 });
    disposalMocks.getCompensationList.mockResolvedValue({
      records: [{
        id: 9,
        assetId: 8,
        compensationNo: 'CMP-001',
        compensationType: 'cash',
        compensationAmount: 100,
        responsibleUserId: 6,
        status: 'PENDING',
      }],
      total: 1,
      size: 10,
      current: 1,
    });
    workOrderMocks.getWorkOrderList.mockResolvedValue({ records: [], total: 0, size: 10, current: 1 });
  });

  it('opens the compensation view for a compensation reader without calling disposal endpoints', async () => {
    authMocks.useAuth.mockReturnValue({
      user: { userId: 7, username: 'reader', realName: '读取者', roles: ['USER'], permissions: ['compensation:query'] },
    });

    renderPage('/disposals?tab=COMPENSATION');

    await waitFor(() => {
      expect(disposalMocks.getCompensationList).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    });
    expect(disposalMocks.getDisposalList).not.toHaveBeenCalled();
    expect(disposalMocks.getDisposalStats).not.toHaveBeenCalled();
    expect(workOrderMocks.getWorkOrderList).not.toHaveBeenCalled();
    expect(screen.getByTestId('compensation-filter-contract')).toHaveTextContent('仅支持分页');
    expect(screen.queryByRole('button', { name: '资产调拨' })).toBeNull();
  });

  it('keeps compensation and work-order calls unavailable to a disposal-only reader', async () => {
    authMocks.useAuth.mockReturnValue({
      user: { userId: 8, username: 'disposal-reader', realName: '处置读取者', roles: ['USER'], permissions: ['disposal:query'] },
    });

    renderPage('/disposals');

    await waitFor(() => {
      expect(disposalMocks.getDisposalList).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        type: 'CLEARANCE',
        status: undefined,
        keyword: undefined,
      });
    });
    expect(disposalMocks.getDisposalStats).toHaveBeenCalled();
    expect(disposalMocks.getCompensationList).not.toHaveBeenCalled();
    expect(workOrderMocks.getWorkOrderList).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '资产赔偿' })).toBeNull();
  });

  it('renders cancelled-requires-resubmission rows with a resubmit hint', async () => {
    authMocks.useAuth.mockReturnValue({
      user: { userId: 8, username: 'disposal-reader', realName: '处置读取者', roles: ['USER'], permissions: ['disposal:query'] },
    });
    disposalMocks.getDisposalList.mockResolvedValue({
      records: [{
        id: 2,
        assetId: 9,
        applicationNo: 'DSP-002',
        assetName: '显示器',
        assetNo: 'AMS-002',
        type: 'SCRAP',
        status: 'CANCELLED_REQUIRES_RESUBMISSION',
        reason: '处理人缺失',
        applicantName: '李四',
        createdAt: '2026-06-10',
      }],
      total: 1,
      size: 10,
      current: 1,
    });

    renderPage('/disposals');

    await waitFor(() => {
      expect(screen.getByTestId('disposal-rows')).toHaveTextContent('DSP-002');
    });
  });
});
