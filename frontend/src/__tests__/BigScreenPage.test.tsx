import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BigScreenPage from '@/pages/bigscreen/BigScreenPage';
import http from '@/utils/http';

vi.mock('@/components/bigscreen/AssetMapChart', () => ({
  default: () => <div data-testid="asset-map-chart" />,
}));

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
  },
}));

function renderWithClient(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BigScreenPage />
    </QueryClientProvider>,
  );
}

describe('BigScreenPage', () => {
  it('does not reuse dashboard stats cache that misses bigscreen-only fields', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    queryClient.setQueryData(['dashboard', 'stats'], {
      totalAssets: 10,
      inUseAssets: 3,
      idleAssets: 7,
      totalValue: 10000,
      netValue: 8000,
      pendingApprovals: 1,
    });

    vi.mocked(http.get).mockResolvedValue({
      code: 200,
      message: 'success',
      data: {
        totalAssets: 10,
        inUseAssets: 3,
        idleAssets: 7,
        totalValue: 10000,
        netValue: 8000,
        pendingApprovals: 1,
      },
    });

    renderWithClient(queryClient);

    expect(screen.getByText('资产运营分析平台')).toBeTruthy();
    await waitFor(() => expect(http.get).toHaveBeenCalledWith('/bigscreen/stats'));
  });
});
