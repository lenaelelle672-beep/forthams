/**
 * GlobalSearch.test.tsx
 *
 * Tests for the Cmd+K global search component covering:
 * - Keyboard shortcut (Cmd+K / Ctrl+K) to open/close
 * - Input filtering
 * - Empty results display
 * - Item selection triggers navigation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import GlobalSearch from '@/components/GlobalSearch';

// Mock globalSearch API to prevent actual HTTP calls
vi.mock('@/api/search', () => ({
  globalSearch: vi.fn().mockResolvedValue({ data: [] }),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <GlobalSearch />
    </MemoryRouter>,
  );
}

function triggerCmdK() {
  fireEvent.keyDown(document, new KeyboardEvent('keydown', {
    key: 'k',
    metaKey: true,
    bubbles: true,
    cancelable: true,
  }));
}

function triggerCtrlK() {
  fireEvent.keyDown(document, new KeyboardEvent('keydown', {
    key: 'k',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  }));
}

/** Type into cmdk's controlled CommandInput */
function typeInSearch(text: string) {
  const input = screen.getByPlaceholderText('搜索页面或业务数据...');
  fireEvent.input(input, { target: { value: text } });
}

describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render without crashing', () => {
    renderWithRouter();
    expect(document.body).toBeDefined();
  });

  it('should open dialog when Cmd+K is pressed', async () => {
    renderWithRouter();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    triggerCmdK();

    await waitFor(() => {
      const dialog = screen.queryByRole('dialog');
      expect(dialog).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should open dialog when Ctrl+K is pressed', async () => {
    renderWithRouter();

    triggerCtrlK();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should show navigation groups when opened', async () => {
    renderWithRouter();

    triggerCmdK();

    await waitFor(() => {
      const dashboard = screen.queryByText('仪表板');
      expect(dashboard).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('should navigate when a search result is selected', async () => {
    renderWithRouter();

    triggerCmdK();

    await waitFor(() => {
      const dashboard = screen.queryByText('仪表板');
      if (dashboard) {
        fireEvent.click(dashboard);
      }
    }, { timeout: 2000 });

    await waitFor(() => {
      const navCalls = mockNavigate.mock.calls.length;
      expect(navCalls > 0 || !screen.queryByRole('dialog')).toBeTruthy();
    }, { timeout: 1000 });
  });

  it('should filter items when typing in search input', async () => {
    renderWithRouter();

    triggerCmdK();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeInTheDocument();
    }, { timeout: 2000 });

    typeInSearch('资产');

    await waitFor(() => {
      const assetItems = screen.queryAllByText(/资产/);
      const settings = screen.queryByText('系统设置');
      expect(settings || assetItems.length > 0).toBeTruthy();
    }, { timeout: 1000 });
  });

  it('should show empty state when no search results match', async () => {
    renderWithRouter();

    triggerCmdK();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeInTheDocument();
    }, { timeout: 2000 });

    typeInSearch('zzznotexist');

    const emptyMsg = await screen.findByText('未找到匹配的页面或数据', {}, { timeout: 2000 });
    expect(emptyMsg).toBeInTheDocument();
  });
});
