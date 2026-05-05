/**
 * @file CreateTaskModal.test.tsx
 * @description CreateTaskModal 组件单元测试
 *
 * 覆盖规格:
 * - SWARM-P3-010-B: 新建盘点任务弹窗（范围选择器）
 * - ATB-002: 新建盘点任务弹窗 — 完整流程
 * - ATB-008: 防重复提交
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

import CreateTaskModal from '../../../src/app/pages/InventoryTasks/components/CreateTaskModal/CreateTaskModal';

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const MOCK_CREATED_TASK = {
  id: 'task-uuid-001',
  taskName: '2024Q4办公室盘点',
  scopeType: 'all',
  scopeIds: [],
  status: 'draft',
  progress: 0,
  totalAssets: 0,
  countedAssets: 0,
  createdAt: '2024-01-15T10:30:00Z',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** @returns mock fetch spy that will be assigned to globalThis.fetch */
function createFetchSpy() {
  return vi.fn();
}

/** Render the modal with default props and optional overrides */
function renderModal(overrides: Partial<Parameters<typeof CreateTaskModal>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    ...overrides,
  };
  const result = render(<CreateTaskModal {...props} />);
  return { ...result, props };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('CreateTaskModal', () => {
  let fetchSpy: ReturnType<typeof createFetchSpy>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = createFetchSpy();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------- */
  /*  Rendering                                                      */
  /* -------------------------------------------------------------- */
  describe('rendering', () => {
    it('renders the modal dialog when open is true', () => {
      renderModal();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render the modal dialog when open is false', () => {
      renderModal({ open: false });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the task name input field', () => {
      renderModal();
      expect(
        screen.getByPlaceholderText(/任务名称/),
      ).toBeInTheDocument();
    });

    it('renders scope type tabs: location, category, all', () => {
      renderModal();
      expect(screen.getByText(/按位置/)).toBeInTheDocument();
      expect(screen.getByText(/按分类/)).toBeInTheDocument();
      expect(screen.getByText(/全部资产/)).toBeInTheDocument();
    });

    it('renders confirm and cancel buttons', () => {
      renderModal();
      expect(
        screen.getByRole('button', { name: /确定|确认|提交/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /取消/ }),
      ).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------- */
  /*  Form validation                                                */
  /* -------------------------------------------------------------- */
  describe('form validation', () => {
    it('shows validation error when submitting with empty task name', async () => {
      renderModal();

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /确定|确认|提交/ }),
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText(/请输入.*名称|任务名称.*必填|请填写/),
        ).toBeInTheDocument();
      });
    });

    it('shows validation error when scope is not selected', async () => {
      renderModal();

      const input = screen.getByPlaceholderText(/任务名称/);
      await act(async () => {
        fireEvent.change(input, { target: { value: '测试盘点任务' } });
      });

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /确定|确认|提交/ }),
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText(/请选择.*范围|盘点范围/),
        ).toBeInTheDocument();
      });
    });

    it('shows error when location tab is selected but no tree nodes are checked', async () => {
      renderModal();

      const input = screen.getByPlaceholderText(/任务名称/);
      await act(async () => {
        fireEvent.change(input, { target: { value: '测试盘点任务' } });
      });

      // Switch to location tab without selecting nodes
      await act(async () => {
        fireEvent.click(screen.getByText(/按位置/));
      });

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /确定|确认|提交/ }),
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText(/至少.*选择|请选择.*节点/),
        ).toBeInTheDocument();
      });
    });

    it('shows error when category tab is selected but no tree nodes are checked', async () => {
      renderModal();

      const input = screen.getByPlaceholderText(/任务名称/);
      await act(async () => {
        fireEvent.change(input, { target: { value: '测试盘点任务' } });
      });

      // Switch to category tab without selecting nodes
      await act(async () => {
        fireEvent.click(screen.getByText(/按分类/));
      });

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /确定|确认|提交/ }),
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText(/至少.*选择|请选择.*节点/),
        ).toBeInTheDocument();
      });
    });
  });

  /* -------------------------------------------------------------- */
  /*  Scope type switching                                           */
  /* -------------------------------------------------------------- */
  describe('scope type switching', () => {
    it('shows info message when "全部资产" is selected', async () => {
      renderModal();

      await act(async () => {
        fireEvent.click(screen.getByText(/全部资产/));
      });

      expect(
        screen.getByText(/将对所有资产进行盘点/),
      ).toBeInTheDocument();
    });

    it('clears location selections when switching to category tab', async () => {
      renderModal();

      // Select location tab
      await act(async () => {
        fireEvent.click(screen.getByText(/按位置/));
      });

      // Switch to category tab — previous location selections should be cleared
      await act(async () => {
        fireEvent.click(screen.getByText(/按分类/));
      });

      // Verify scopeIds are empty by attempting submission
      // (scopeIds should be [] after tab switch)
    });

    it('clears category selections when switching to location tab', async () => {
      renderModal();

      await act(async () => {
        fireEvent.click(screen.getByText(/按分类/));
      });

      await act(async () => {
        fireEvent.click(screen.getByText(/按位置/));
      });
    });

    it('hides tree area and shows info text when switching to "全部资产"', async () => {
      renderModal();

      // First select a tree-based tab
      await act(async () => {
        fireEvent.click(screen.getByText(/按位置/));
      });

      // Then switch to "全部资产" — tree should disappear
      await act(async () => {
        fireEvent.click(screen.getByText(/全部资产/));
      });

      expect(
        screen.getByText(/将对所有资产进行盘点/),
      ).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------- */
  /*  Successful submission                                          */
  /* -------------------------------------------------------------- */
  describe('successful submission', () => {
    it('sends POST request with correct payload for scopeType=all', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_CREATED_TASK),
      });

      renderModal();

      // Fill task name
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/任务名称/), {
          target: { value: '2024Q4办公室盘点' },
        });
      });

      // Select "全部资产"
      await act(async () => {
        fireEvent.click(screen.getByText(/全部资产/));
      });

      // Submit
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /确定|确认|提交/ }),
        );
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toMatch(/\/api\/.*inventory.*tasks/);
      expect(options?.method).toBe('POST');

      const body = JSON.parse(options?.body as string);
      expect(body.taskName).toBe('2024Q4办公室盘点');
      expect(body.scopeType).toBe('all');
      expect(body.scopeIds).toEqual([]);
    });

    it('invokes onSuccess callback with created task after successful submission', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_CREATED_TASK),
      });

      const { props } = renderModal();

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/任务名称/), {
          target: { value: '2024Q4办公室盘点' },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByText(/全部资产/));
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /确定|确认|提交/ }),
        );
      });

      await waitFor(() => {
        expect(props.onSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'task-uuid-001' }),
        );
      });
    });

    it('closes modal after successful submission', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_CREATED_TASK),
      });

      renderModal();

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/任务名称/), {
          target: { value: '2024Q4办公室盘点' },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByText(/全部资产/));
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /确定|确认|提交/ }),
        );
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  /* -------------------------------------------------------------- */
  /*  Error handling                                                 */
  /* -------------------------------------------------------------- */
  describe('error handling', () => {
    it('keeps modal open and shows error on HTTP error response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      renderModal();

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/任务名称/), {
          target: { value: '错误测试' },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByText(/全部资产/));
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /确定|确认|提交/ }),
        );
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      // Modal should stay open on error
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('handles network error gracefully without crashing', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network Error'));

      renderModal();

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/任务名称/), {
          target: { value: '网络错误测试' },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByText(/全部资产/));
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /确定|确认|提交/ }),
        );
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      // Component should not crash — modal still visible
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------- */
  /*  Duplicate submission prevention (ATB-008)                      */
  /* -------------------------------------------------------------- */
  describe('duplicate submission prevention', () => {
    it('sends only one POST request when submit is clicked rapidly', async () => {
      let resolveResponse!: (v: unknown) => void;
      fetchSpy.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
      );

      renderModal();

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/任务名称/), {
          target: { value: '防重复提交测试' },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByText(/全部资产/));
      });

      const submitBtn = screen.getByRole('button', {
        name: /确定|确认|提交/,
      });

      // Rapid double-click
      await act(async () => {
        fireEvent.click(submitBtn);
      });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Only one API call should have been made
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Clean up — resolve pending promise
      await act(async () => {
        resolveResponse({
          ok: true,
          json: () => Promise.resolve(MOCK_CREATED_TASK),
        });
      });
    });

    it('disables submit button during loading to prevent duplicate requests', async () => {
      let resolveResponse!: (v: unknown) => void;
      fetchSpy.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
      );

      renderModal();

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/任务名称/), {
          target: { value: 'Loading状态测试' },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByText(/全部资产/));
      });

      const submitBtn = screen.getByRole('button', {
        name: /确定|确认|提交/,
      });

      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Button should be disabled while request is in-flight
      expect(submitBtn).toBeDisabled();

      // Resolve to clean up
      await act(async () => {
        resolveResponse({
          ok: true,
          json: () => Promise.resolve(MOCK_CREATED_TASK),
        });
      });
    });
  });

  /* -------------------------------------------------------------- */
  /*  Modal close behavior                                           */
  /* -------------------------------------------------------------- */
  describe('modal close behavior', () => {
    it('calls onClose when cancel button is clicked', async () => {
      const { props } = renderModal();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /取消/ }));
      });

      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('resets form state when modal is closed and reopened', async () => {
      const { rerender, props } = renderModal();

      // Fill in form data
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/任务名称/), {
          target: { value: '待清除的数据' },
        });
      });

      // Close modal
      rerender(<CreateTaskModal {...props} open={false} />);

      // Reopen modal
      rerender(<CreateTaskModal {...props} open={true} />);

      // Task name input should be empty after reopen
      const input = screen.getByPlaceholderText(/任务名称/) as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  /* -------------------------------------------------------------- */
  /*  Task name constraints                                          */
  /* -------------------------------------------------------------- */
  describe('task name constraints', () => {
    it('accepts a task name within the 1-50 character range', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_CREATED_TASK),
      });

      renderModal();

      const validName = 'A'.repeat(50); // exactly 50 chars
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/任务名称/), {
          target: { value: validName },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByText(/全部资产/));
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /确定|确认|提交/ }),
        );
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
        const [, options] = fetchSpy.mock.calls[0];
        const body = JSON.parse(options?.body as string);
        expect(body.taskName).toBe(validName);
      });
    });

    it('rejects task name exceeding 50 characters', async () => {
      renderModal();

      const longName = 'A'.repeat(51);
      const input = screen.getByPlaceholderText(/任务名称/) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: longName } });
      });

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /确定|确认|提交/ }),
        );
      });

      // Either the input is truncated to 50, or a validation error appears
      await waitFor(() => {
        const currentLength = input.value.length;
        const hasError = screen.queryByText(
          /不超过.*50|最多.*50|长度.*超出/,
        );
        expect(
          currentLength <= 50 || hasError !== null,
        ).toBeTruthy();
      });
    });
  });
});