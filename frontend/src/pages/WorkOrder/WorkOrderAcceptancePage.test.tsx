import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkOrderAcceptancePage from './WorkOrderAcceptancePage';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/api/workorder', () => ({
  getWorkOrderDetail: vi.fn(),
  submitForAcceptance: vi.fn(),
  acceptWorkOrder: vi.fn(),
  rejectAcceptance: vi.fn(),
}));

import { getWorkOrderDetail } from '@/api/workorder';

const mockedGetWorkOrderDetail = vi.mocked(getWorkOrderDetail);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/workorders/9/acceptance']}>
        <Routes>
          <Route path="/workorders/:id/acceptance" element={<WorkOrderAcceptancePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('WorkOrderAcceptancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a directly unwrapped work order detail response', async () => {
    mockedGetWorkOrderDetail.mockResolvedValue({
      id: 9,
      title: '空调压缩机异响',
      workOrderNo: 'WO-20260609-0001',
      status: 'EXECUTING',
      assetName: '中央空调',
      assigneeName: '维修员',
    } as never);

    renderPage();

    expect(await screen.findByText('空调压缩机异响')).toBeInTheDocument();
    expect(screen.getByText('WO-20260609-0001')).toBeInTheDocument();
    expect(screen.getByText('中央空调')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /提交验收/ })).toBeInTheDocument();
  });
});
