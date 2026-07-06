import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssetImportExportPage from './AssetImportExportPage';
import { exportAssets } from '@/api/assetImport';

vi.mock('@/api/assetImport', () => ({
  parseImportFile: vi.fn(),
  getImportTemplate: vi.fn(),
  exportAssets: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedExportAssets = vi.mocked(exportAssets);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AssetImportExportPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AssetImportExportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExportAssets.mockResolvedValue(new Blob(['assetNo,assetName'], { type: 'text/csv' }));
  });

  it('passes selected category and status filters to asset export', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: '导出资产' }));
    await user.click(screen.getByLabelText('重型设备'));
    await user.selectOptions(screen.getByLabelText('资产状态'), '在用');
    await user.click(screen.getByRole('button', { name: /导出数据/ }));

    await waitFor(() => {
      expect(mockedExportAssets).toHaveBeenCalledWith({
        categoryCodes: ['重型设备'],
        statusCodes: ['在用'],
        locationCodes: [],
      });
    });
  });
});
