import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import CompensationDetailPage from './CompensationDetailPage';
import { getCompensationDetail } from '@/api/disposal';

vi.mock('@/api/disposal', () => ({ getCompensationDetail: vi.fn() }));

const compensation = {
  id: 9,
  compensationNo: 'CMP-20260609-001',
  assetId: 8,
  compensationType: 'cash',
  compensationAmount: 123.45,
  description: '资产损坏赔偿',
  incidentDate: '2026-06-09',
  responsibleUserId: 6,
  responsibleDeptId: 2,
  status: 'PENDING',
  createTime: '2026-06-09T10:00:00',
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/compensation/9']}>
        <Routes>
          <Route path="/compensation/:id" element={<CompensationDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CompensationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the compensation detail through the compensation API and renders backend fields', async () => {
    vi.mocked(getCompensationDetail).mockResolvedValue(compensation);
    renderPage();

    expect(await screen.findByText('CMP-20260609-001')).toBeTruthy();
    expect(screen.getByText('¥ 123.45')).toBeTruthy();
    expect(screen.getByText('资产损坏赔偿')).toBeTruthy();
    expect(screen.getByText('责任部门 ID')).toBeTruthy();
    expect(getCompensationDetail).toHaveBeenCalledWith(9);
  });
});
