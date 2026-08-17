import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';

const apiMocks = vi.hoisted(() => ({
  getRetirementDetail: vi.fn(),
  withdrawRetirement: vi.fn(),
  approveRetirement: vi.fn(),
  rejectRetirement: vi.fn(),
  getAssetById: vi.fn(),
  findApprovalProcessId: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/api/retirement', () => ({
  getRetirementDetail: apiMocks.getRetirementDetail,
  withdrawRetirement: apiMocks.withdrawRetirement,
  approveRetirement: apiMocks.approveRetirement,
  rejectRetirement: apiMocks.rejectRetirement,
}));
vi.mock('@/api/asset', () => ({ getAssetById: apiMocks.getAssetById }));
vi.mock('@/api/approval', async () => {
  const actual = await vi.importActual<typeof import('@/api/approval')>('@/api/approval');
  return {
    ...actual,
    findApprovalProcessId: apiMocks.findApprovalProcessId,
  };
});
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
vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => <div>loading</div> }));

import RetirementDetailPage from './RetirementDetailPage';
import { MISSING_APPROVAL_PROCESS_MESSAGE } from '@/api/approval';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/retirement/12']}>
        <Routes>
          <Route path="/retirement/:id" element={<RetirementDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RetirementDetailPage approval contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getRetirementDetail.mockResolvedValue({
      id: 12,
      assetId: 8,
      applicantId: 3,
      reason: '老化',
      status: 'PENDING',
      createdAt: '2026-06-09',
      updatedAt: '2026-06-09',
    });
    apiMocks.getAssetById.mockResolvedValue({ id: 8, assetName: '打印机', assetNo: 'AMS-008' });
  });

  it('keeps approve buttons unavailable without a controlled approval process', async () => {
    apiMocks.findApprovalProcessId.mockResolvedValue(null);
    renderPage();

    expect(await screen.findByText(MISSING_APPROVAL_PROCESS_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /通过审批/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^驳回$/ })).toBeDisabled();
  });
});
