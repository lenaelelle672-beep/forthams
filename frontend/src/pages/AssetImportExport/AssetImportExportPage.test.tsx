import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssetImportExportPage from './AssetImportExportPage';

const mockRef = vi.hoisted(() => ({ post: null as unknown as ReturnType<typeof vi.fn> }));

vi.mock('axios', () => {
  const post = vi.fn().mockResolvedValue({ data: new Blob() });
  mockRef.post = post;
  const instance = {
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    get: vi.fn().mockResolvedValue({ data: [] }),
    post,
  };
  const create = vi.fn(() => instance);
  return { default: { create }, create };
});

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    Modal: {
      ...(actual as any).Modal,
      confirm: vi.fn((config: any) => config.onOk?.()),
    },
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

async function clickExportTab() {
  const tab = screen.getAllByText('导出')[0].closest('.ant-tabs-tab');
  if (tab) fireEvent.click(tab);
}

async function findAndClickExportBtn() {
  const panel = screen.getByText('导出条件筛选').closest('.ant-card');
  if (panel) {
    const btn = panel.querySelector('.ant-btn');
    if (btn) fireEvent.click(btn);
  }
}

describe('AssetImportExportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes selected category and status filters to asset export', async () => {
    renderPage();

    await clickExportTab();
    await findAndClickExportBtn();

    await waitFor(() => {
      expect(mockRef.post).toHaveBeenCalledWith(
        '/assets/export',
        { categoryCodes: [], statusCodes: [], locationCodes: [] },
        { responseType: 'blob' },
      );
    });
  });
});
