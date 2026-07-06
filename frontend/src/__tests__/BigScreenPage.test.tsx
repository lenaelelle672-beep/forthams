import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function getKpiValues(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.bs-kpi-value')).map((item) => item.textContent);
}

describe('BigScreenPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not reuse dashboard stats cache that misses bigscreen-only fields', async () => {
    const queryClient = createQueryClient();

    queryClient.setQueryData(['dashboard', 'stats'], {
      totalAssets: 10,
      inUseAssets: 3,
      idleAssets: 7,
      totalValue: 10000,
      netValue: 8000,
      pendingApprovals: 1,
    });

    vi.mocked(http.get).mockResolvedValue({
      totalAssets: 10,
      inUseAssets: 3,
      idleAssets: 7,
      totalValue: 10000,
      netValue: 8000,
      pendingApprovals: 1,
    });

    renderWithClient(queryClient);

    expect(screen.getByText('资产运营分析平台')).toBeTruthy();
    await waitFor(() => expect(http.get).toHaveBeenCalledWith('/bigscreen/stats'));
  });

  it('renders empty KPI values when bigscreen stats request is forbidden', async () => {
    const queryClient = createQueryClient();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(http.get).mockRejectedValue({ response: { status: 403 } });

    const { container } = renderWithClient(queryClient);

    await waitFor(() => expect(http.get).toHaveBeenCalledWith('/bigscreen/stats'));
    await waitFor(() => {
      expect(getKpiValues(container)).toEqual(['今 0', '今 0.0%', '今 0.0万']);
    });
    expect(warnSpy).toHaveBeenCalledWith('[BigScreen] 权限不足，展示空统计数据');
  });

  it('normalizes partial API stats without demo fallback numbers', async () => {
    const queryClient = createQueryClient();

    vi.mocked(http.get).mockResolvedValue({
      totalAssets: 10,
      inUseAssets: 3,
    });

    const { container } = renderWithClient(queryClient);

    await waitFor(() => {
      expect(getKpiValues(container)).toEqual(['今 10', '今 30.0%', '今 0.0万']);
    });
  });
});
