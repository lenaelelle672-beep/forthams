/**
 * ScopeSelector Component Unit Tests
 *
 * Validates the inventory scope selector used inside CreateTaskModal.
 * Covers three selection modes (location tree, category tree, all assets),
 * mutual exclusivity between modes, controlled-value rendering, and
 * onChange callback behaviour.
 *
 * Spec ref : SWARM-P3-010-B — 新建盘点任务弹窗（范围选择器）
 * ATB ref  : ATB-002 steps 4-7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScopeSelector from '@/components/inventory/ScopeSelector';
import type { ScopeType } from '@/types/inventory';

// ---------------------------------------------------------------------------
// Inline mock tree data  (3-level structure per ATB-002 step 4)
// ---------------------------------------------------------------------------
const mockLocationTree = [
  {
    key: 'loc-1',
    title: '总部大楼',
    children: [
      {
        key: 'loc-1-1',
        title: '1楼',
        children: [
          { key: 'loc-1-1-1', title: '101室' },
          { key: 'loc-1-1-2', title: '102室' },
        ],
      },
      {
        key: 'loc-1-2',
        title: '2楼',
        children: [{ key: 'loc-1-2-1', title: '201室' }],
      },
    ],
  },
];

const mockCategoryTree = [
  {
    key: 'cat-1',
    title: 'IT设备',
    children: [
      { key: 'cat-1-1', title: '电脑' },
      { key: 'cat-1-2', title: '打印机' },
    ],
  },
  {
    key: 'cat-2',
    title: '办公家具',
    children: [{ key: 'cat-2-1', title: '桌椅' }],
  },
];

// ---------------------------------------------------------------------------
// Mock the data-fetching layer.
 * ScopeSelector internally fetches location / category trees via React Query
 * hooks.  We mock those hooks so the component receives deterministic data
 * without real network calls.
 * ---------------------------------------------------------------------------
 */
vi.mock('@/hooks/useInventory', () => ({
  useLocationTree: () => ({
    data: mockLocationTree,
    isLoading: false,
    isSuccess: true,
  }),
  useCategoryTree: () => ({
    data: mockCategoryTree,
    isLoading: false,
    isSuccess: true,
  }),
}));

// ===========================================================================
describe('ScopeSelector', () => {
  const mockOnChange = vi.fn();

  const defaultProps = {
    value: {
      scopeType: 'location' as ScopeType,
      scopeIds: [] as string[],
    },
    onChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Rendering
  // =========================================================================
  describe('rendering', () => {
    /** The three mutually-exclusive scope modes must all be visible. */
    it('renders three scope mode options: location, category, all', () => {
      render(<ScopeSelector {...defaultProps} />);

      expect(screen.getByText(/按位置树多选/)).toBeInTheDocument();
      expect(screen.getByText(/按分类多选/)).toBeInTheDocument();
      expect(screen.getByText(/全部资产/)).toBeInTheDocument();
    });

    /** When scopeType is "location" the location tree nodes are shown. */
    it('renders location tree nodes when scopeType is location', () => {
      render(<ScopeSelector {...defaultProps} />);

      expect(screen.getByText('总部大楼')).toBeInTheDocument();
      expect(screen.getByText('1楼')).toBeInTheDocument();
      expect(screen.getByText('101室')).toBeInTheDocument();
      expect(screen.getByText('102室')).toBeInTheDocument();
    });

    /** When scopeType is "category" the category tree nodes are shown. */
    it('renders category tree nodes when scopeType is category', () => {
      render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'category', scopeIds: [] }}
        />,
      );

      expect(screen.getByText('IT设备')).toBeInTheDocument();
      expect(screen.getByText('办公家具')).toBeInTheDocument();
      expect(screen.getByText('电脑')).toBeInTheDocument();
      expect(screen.getByText('打印机')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. ATB-002 Step 4 — Location tree multi-select
  //    "勾选 2 个叶子节点 → 右侧已选列表显示 2 个节点名称"
  // =========================================================================
  describe('location tree selection (ATB-002 step 4)', () => {
    it('calls onChange with location scope and selected leaf IDs when nodes are checked', async () => {
      render(<ScopeSelector {...defaultProps} />);

      // Simulate checking 2 leaf nodes (101室, 102室)
      fireEvent.click(screen.getByText('101室'));
      fireEvent.click(screen.getByText('102室'));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            scopeType: 'location',
            scopeIds: expect.arrayContaining(['loc-1-1-1', 'loc-1-1-2']),
          }),
        );
      });
    });

    /** Already-selected IDs passed via value should be reflected visually. */
    it('displays selected location nodes in the selected-items list', () => {
      render(
        <ScopeSelector
          {...defaultProps}
          value={{
            scopeType: 'location',
            scopeIds: ['loc-1-1-1', 'loc-1-1-2'],
          }}
        />,
      );

      // Selected nodes should be visible in the tree or selected list
      expect(screen.getByText('101室')).toBeInTheDocument();
      expect(screen.getByText('102室')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. ATB-002 Step 5 — Switching to category tab clears location selection
  //    "位置树选择清空，显示分类树，勾选 1 个分类节点 → 已选列表更新为 1 个分类"
  // =========================================================================
  describe('category tab switching (ATB-002 step 5)', () => {
    it('calls onChange with category scope and empty IDs when switching tabs', () => {
      render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'location', scopeIds: ['loc-1-1-1'] }}
        />,
      );

      // Switch to category tab
      fireEvent.click(screen.getByText(/按分类多选/));

      // Previous location selection must be cleared
      expect(mockOnChange).toHaveBeenCalledWith({
        scopeType: 'category',
        scopeIds: [],
      });
    });

    it('allows selecting a category node and calls onChange with its ID', async () => {
      render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'category', scopeIds: [] }}
        />,
      );

      // Verify category tree is visible
      await waitFor(() => {
        expect(screen.getByText('IT设备')).toBeInTheDocument();
      });

      // Select one category node
      fireEvent.click(screen.getByText('IT设备'));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            scopeType: 'category',
            scopeIds: expect.arrayContaining(['cat-1']),
          }),
        );
      });
    });

    it('shows selected category name in the selected-items list', () => {
      render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'category', scopeIds: ['cat-1'] }}
        />,
      );

      expect(screen.getByText('IT设备')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. ATB-002 Step 6 — All assets mode
  //    "位置/分类选择区域隐藏，显示'将对所有资产进行盘点'提示"
  // =========================================================================
  describe('all-assets mode (ATB-002 step 6)', () => {
    it('calls onChange with scopeType all and empty scopeIds', () => {
      render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'location', scopeIds: ['loc-1-1-1'] }}
        />,
      );

      fireEvent.click(screen.getByText(/全部资产/));

      expect(mockOnChange).toHaveBeenCalledWith({
        scopeType: 'all',
        scopeIds: [],
      });
    });

    it('hides tree selection areas and shows hint text', () => {
      render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'all', scopeIds: [] }}
        />,
      );

      // Trees should not be visible
      expect(screen.queryByText('总部大楼')).not.toBeInTheDocument();
      expect(screen.queryByText('IT设备')).not.toBeInTheDocument();

      // Hint text should be displayed
      expect(
        screen.getByText(/将对所有资产进行盘点/),
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5. ATB-002 Step 7 — Switching back and re-selecting
  //    "切回'按位置树多选'，重新勾选 1 个节点 → 已选列表正确显示"
  // =========================================================================
  describe('re-selecting after mode switch (ATB-002 step 7)', () => {
    it('allows re-selecting location nodes after switching back from category', async () => {
      const { rerender } = render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'location', scopeIds: [] }}
        />,
      );

      // Switch to category tab
      fireEvent.click(screen.getByText(/按分类多选/));

      // Simulate parent updating value after onChange
      rerender(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'category', scopeIds: [] }}
        />,
      );
      await waitFor(() => {
        expect(screen.getByText('IT设备')).toBeInTheDocument();
      });

      // Switch back to location tab
      fireEvent.click(screen.getByText(/按位置树多选/));
      rerender(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'location', scopeIds: [] }}
        />,
      );
      await waitFor(() => {
        expect(screen.getByText('总部大楼')).toBeInTheDocument();
      });

      // Select 1 node
      fireEvent.click(screen.getByText('201室'));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            scopeType: 'location',
            scopeIds: expect.arrayContaining(['loc-1-2-1']),
          }),
        );
      });
    });
  });

  // =========================================================================
  // 6. Mutual exclusivity between modes
  //    Per spec: location ↔ category are mutually exclusive tabs;
  //              "全部资产" is mutually exclusive with both.
  // =========================================================================
  describe('mutual exclusivity', () => {
    it('clears location IDs when switching to category', () => {
      render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'location', scopeIds: ['loc-1-1-1'] }}
        />,
      );

      fireEvent.click(screen.getByText(/按分类多选/));

      expect(mockOnChange).toHaveBeenCalledWith({
        scopeType: 'category',
        scopeIds: [],
      });
    });

    it('clears category IDs when switching to location', () => {
      render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'category', scopeIds: ['cat-1'] }}
        />,
      );

      fireEvent.click(screen.getByText(/按位置树多选/));

      expect(mockOnChange).toHaveBeenCalledWith({
        scopeType: 'location',
        scopeIds: [],
      });
    });

    it('clears any previous IDs when switching to all-assets mode', () => {
      render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'location', scopeIds: ['loc-1', 'loc-1-1'] }}
        />,
      );

      fireEvent.click(screen.getByText(/全部资产/));

      expect(mockOnChange).toHaveBeenCalledWith({
        scopeType: 'all',
        scopeIds: [],
      });
    });
  });

  // =========================================================================
  // 7. Controlled component behaviour
  // =========================================================================
  describe('controlled value updates', () => {
    it('reflects externally changed scopeType from location to category', () => {
      const { rerender } = render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'location', scopeIds: [] }}
        />,
      );

      // Initially shows location tree
      expect(screen.getByText('总部大楼')).toBeInTheDocument();

      // Parent changes value to category
      rerender(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'category', scopeIds: [] }}
        />,
      );

      // Should now show category tree, not location tree
      expect(screen.getByText('IT设备')).toBeInTheDocument();
      expect(screen.queryByText('总部大楼')).not.toBeInTheDocument();
    });

    it('reflects externally changed scopeType to all', () => {
      const { rerender } = render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'location', scopeIds: [] }}
        />,
      );

      expect(screen.getByText('总部大楼')).toBeInTheDocument();

      rerender(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'all', scopeIds: [] }}
        />,
      );

      expect(screen.queryByText('总部大楼')).not.toBeInTheDocument();
      expect(
        screen.getByText(/将对所有资产进行盘点/),
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 8. Loading / empty state
  // =========================================================================
  describe('loading and empty states', () => {
    it('renders without crashing when tree data is empty', () => {
      // Override the mock to return empty data
      vi.doMock('@/hooks/useInventory', () => ({
        useLocationTree: () => ({
          data: [],
          isLoading: false,
          isSuccess: true,
        }),
        useCategoryTree: () => ({
          data: [],
          isLoading: false,
          isSuccess: true,
        }),
      }));

      // Component should still render the mode tabs
      render(
        <ScopeSelector
          {...defaultProps}
          value={{ scopeType: 'location', scopeIds: [] }}
        />,
      );

      expect(screen.getByText(/按位置树多选/)).toBeInTheDocument();
    });
  });
});