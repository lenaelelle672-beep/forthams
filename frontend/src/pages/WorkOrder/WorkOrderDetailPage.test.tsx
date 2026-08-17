import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';

const apiMocks = vi.hoisted(() => ({
  getWorkOrderDetail: vi.fn(),
  approveWorkOrder: vi.fn(),
  rejectWorkOrder: vi.fn(),
  holdWorkOrder: vi.fn(),
  resumeWorkOrder: vi.fn(),
  findApprovalProcessId: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/api/workorder', () => ({
  getWorkOrderDetail: apiMocks.getWorkOrderDetail,
  approveWorkOrder: apiMocks.approveWorkOrder,
  rejectWorkOrder: apiMocks.rejectWorkOrder,
  holdWorkOrder: apiMocks.holdWorkOrder,
  resumeWorkOrder: apiMocks.resumeWorkOrder,
}));
vi.mock('@/api/approval', async () => {
  const actual = await vi.importActual<typeof import('@/api/approval')>('@/api/approval');
  return {
    ...actual,
    findApprovalProcessId: apiMocks.findApprovalProcessId,
  };
});
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/Button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    title,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/ui/Badge', () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock('@/components/ui/ApprovalTimeline', () => ({ ApprovalTimeline: () => null }));
vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => <div>loading</div> }));
vi.mock('@/components/execution/TimeLogForm', () => ({ default: () => null }));
vi.mock('@/components/execution/StepChecklist', () => ({ default: () => null }));
vi.mock('@/components/execution/PhotoUpload', () => ({ default: () => null }));
vi.mock('@/components/spare-parts/SparePartUsageForm', () => ({ default: () => null }));
vi.mock('@/components/acceptance/AcceptanceDialog', () => ({ default: () => null }));
vi.mock('@/components/comment/CommentSection', () => ({ default: () => null }));

import WorkOrderDetailPage from './WorkOrderDetailPage';
import { MISSING_APPROVAL_PROCESS_MESSAGE } from '@/api/approval';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/workorders/12']}>
        <Routes>
          <Route path="/workorders/:id" element={<WorkOrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('WorkOrderDetailPage approval contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getWorkOrderDetail.mockResolvedValue({
      id: 12,
      title: '维修打印机',
      status: 'PENDING',
      workOrderNo: 'WO-12',
      reporterName: '张三',
      createTime: '2026-06-09T10:00:00',
    });
  });

  it('disables direct approve actions when no approval process exists', async () => {
    apiMocks.findApprovalProcessId.mockResolvedValue(null);
    renderPage();

    expect(await screen.findByText(MISSING_APPROVAL_PROCESS_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /审批通过/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^驳回$/ })).toBeDisabled();
  });
});
