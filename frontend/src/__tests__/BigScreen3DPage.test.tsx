import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BigScreen3DPage from '@/pages/bigscreen/BigScreen3DPage';
import http from '@/utils/http';

vi.mock('@/pages/bigscreen/BigScreen3DCanvas', () => ({
  default: () => <div data-testid="bigscreen-3d-canvas" />,
}));

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderWithClient(queryClient = createQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BigScreen3DPage />
    </QueryClientProvider>,
  );
}

function getKpiText(label: string) {
  return screen.getByText(label).closest('.ams3d-kpi')?.textContent ?? '';
}

describe('BigScreen3DPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(performance.now() + 1200);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty stats and city metrics when bigscreen stats request fails', async () => {
    vi.mocked(http.get).mockRejectedValue(new Error('forbidden'));

    renderWithClient();

    await waitFor(() => expect(http.get).toHaveBeenCalledWith('/bigscreen/stats'));
    expect(getKpiText('资产总数')).toBe('资产总数0件');
    expect(getKpiText('在用资产')).toBe('在用资产0件');
    expect(getKpiText('资产原值')).toBe('资产原值0.0万');
    expect(getKpiText('资产净值')).toBe('资产净值0.0万');
    expect(screen.getByText(/资产 0 件，在线率/)).toBeTruthy();
  });

  it('normalizes partial API stats without demo fallback values', async () => {
    vi.mocked(http.get).mockResolvedValue({
      totalAssets: 10,
      inUseAssets: 3,
    });

    renderWithClient();

    await waitFor(() => expect(getKpiText('资产总数')).toBe('资产总数10件'));
    expect(getKpiText('在用资产')).toBe('在用资产3件');
    expect(getKpiText('资产原值')).toBe('资产原值0.0万');
    expect(getKpiText('资产净值')).toBe('资产净值0.0万');
  });
});
