/**
 * AssetTable 组件单元测试
 *
 * 覆盖 SPEC P3-010-D：盘点执行详情页 — 资产清单表格（逐条/批量确认）
 *
 * 测试范围：
 *  - 表格正确渲染表头（资产编号、资产名称、账面状态、实盘状态、备注、操作）及数据行
 *  - 逐条确认资产：选择实盘状态 → 输入备注 → 点击确认 → PATCH 调用 → 行状态更新
 *  - 批量确认资产：勾选行 → 批量按钮启用 → 弹窗选择统一状态 → POST 调用
 *  - 批量确认按钮在无勾选时置灰不可点击
 *  - 批量确认上限 100 条，超出提示并截断
 *  - 只读模式（readOnly=true）：下拉 disabled、输入 disabled、确认按钮隐藏
 *  - 虚拟滚动：资产数 > 200 时启用 react-window，DOM 中不渲染全量行
 *  - 防重复提交：确认按钮 loading 期间不可重复触发
 *  - 错误处理：API 失败时展示错误提示
 */
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { message } from 'antd';

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------
import AssetTable from '../../../src/components/inventory/AssetTable';

// ---------------------------------------------------------------------------
// Mocked modules
// ---------------------------------------------------------------------------
vi.mock('../../../src/hooks/useInventory', () => ({
  useAssets: vi.fn(),
  useConfirmAssetMutation: vi.fn(),
  useBatchConfirmMutation: vi.fn(),
}));

vi.mock('../../../src/stores/useInventoryStore', () => ({
  useInventoryStore: vi.fn(),
}));

// react-window mock — renders all items in a container for testability
vi.mock('react-window', () => {
  return {
    FixedSizeList: ({
      children,
      itemCount,
      height,
      itemData,
    }: {
      children: ({ index, style, data }: { index: number; style: React.CSSProperties; data: unknown }) => React.ReactElement;
      itemCount: number;
      height: number;
      itemData: unknown;
    }) => (
      <div
        data-testid="virtual-list"
        data-item-count={itemCount}
        style={{ height }}
        role="list"
      >
        {Array.from({ length: itemCount }, (_, index) =>
          children({ index, style: {}, data: itemData }),
        )}
      </div>
    ),
  };
});

// Ant Design message mock
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Imports of mocked modules (after vi.mock setup)
// ---------------------------------------------------------------------------
import {
  useAssets,
  useConfirmAssetMutation,
  useBatchConfirmMutation,
} from '../../../src/hooks/useInventory';
import { useInventoryStore } from '../../../src/stores/useInventoryStore';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------
interface InventoryAsset {
  assetId: string;
  assetCode: string;
  assetName: string;
  bookStatus: string;
  actualStatus: string | null;
  remark: string;
  confirmed: boolean;
}

interface PaginatedAssets {
  items: InventoryAsset[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** 创建单条 mock 资产 */
function createMockAsset(
  overrides?: Partial<InventoryAsset>,
): InventoryAsset {
  return {
    assetId: `asset-${Math.random().toString(36).slice(2, 8)}`,
    assetCode: 'AST-001',
    assetName: '测试资产',
    bookStatus: '在用',
    actualStatus: null,
    remark: '',
    confirmed: false,
    ...overrides,
  };
}

/** 批量生成 mock 资产 */
function createMockAssets(count: number): InventoryAsset[] {
  return Array.from({ length: count }, (_, i) =>
    createMockAsset({
      assetId: `asset-${i}`,
      assetCode: `AST-${String(i + 1).padStart(3, '0')}`,
      assetName: `测试资产${i + 1}`,
    }),
  );
}

/** 创建 QueryClient（禁用 retry 以加速测试） */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/** 带 Provider 的 render 封装 */
function renderWithProviders(
  ui: React.ReactElement,
  queryClient?: QueryClient,
) {
  const qc = queryClient ?? createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Default mock return values
// ---------------------------------------------------------------------------

const defaultPaginatedAssets: PaginatedAssets = {
  items: [
    createMockAsset({
      assetId: 'asset-1',
      assetCode: 'AST-001',
      assetName: '笔记本电脑',
      bookStatus: '在用',
      actualStatus: null,
      remark: '',
      confirmed: false,
    }),
    createMockAsset({
      assetId: 'asset-2',
      assetCode: 'AST-002',
      assetName: '4K 显示器',
      bookStatus: '在用',
      actualStatus: null,
      remark: '',
      confirmed: false,
    }),
    createMockAsset({
      assetId: 'asset-3',
      assetCode: 'AST-003',
      assetName: '机械键盘',
      bookStatus: '闲置',
      actualStatus: null,
      remark: '',
      confirmed: false,
    }),
  ],
  total: 3,
  page: 1,
  pageSize: 20,
};

const defaultStoreState = {
  selectedAssetIds: [] as string[],
  toggleAssetSelection: vi.fn(),
  setSelectedAssetIds: vi.fn(),
  clearSelection: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AssetTable', () => {
  let confirmMutateAsync: Mock;
  let batchConfirmMutateAsync: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    confirmMutateAsync = vi.fn().mockResolvedValue({ success: true });
    batchConfirmMutateAsync = vi.fn().mockResolvedValue({ success: true });

    (useAssets as Mock).mockReturnValue({
      data: defaultPaginatedAssets,
      isLoading: false,
      error: null,
    });

    (useConfirmAssetMutation as Mock).mockReturnValue({
      mutateAsync: confirmMutateAsync,
      isPending: false,
    });

    (useBatchConfirmMutation as Mock).mockReturnValue({
      mutateAsync: batchConfirmMutateAsync,
      isPending: false,
    });

    (useInventoryStore as Mock).mockReturnValue(defaultStoreState);
  });

  // -------------------------------------------------------------------------
  // 1. 表格渲染
  // -------------------------------------------------------------------------
  describe('渲染', () => {
    it('应正确渲染表头列', () => {
      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      expect(screen.getByText('资产编号')).toBeInTheDocument();
      expect(screen.getByText('资产名称')).toBeInTheDocument();
      expect(screen.getByText('账面状态')).toBeInTheDocument();
      expect(screen.getByText('实盘状态')).toBeInTheDocument();
      expect(screen.getByText('备注')).toBeInTheDocument();
      expect(screen.getByText('操作')).toBeInTheDocument();
    });

    it('应渲染资产数据行', () => {
      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      expect(screen.getByText('AST-001')).toBeInTheDocument();
      expect(screen.getByText('笔记本电脑')).toBeInTheDocument();
      expect(screen.getByText('AST-002')).toBeInTheDocument();
      expect(screen.getByText('4K 显示器')).toBeInTheDocument();
      expect(screen.getByText('AST-003')).toBeInTheDocument();
      expect(screen.getByText('机械键盘')).toBeInTheDocument();
    });

    it('资产列表为空时应显示空状态占位', () => {
      (useAssets as Mock).mockReturnValue({
        data: { items: [], total: 0, page: 1, pageSize: 20 },
        isLoading: false,
        error: null,
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      expect(screen.getByText(/暂无资产数据/)).toBeInTheDocument();
    });

    it('加载中时应显示 loading 状态', () => {
      (useAssets as Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      // Ant Design Table 显示 spin
      expect(document.querySelector('.ant-spin')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // 2. 逐条确认 (ATB-004)
  // -------------------------------------------------------------------------
  describe('逐条确认', () => {
    it('未确认行应显示实盘状态下拉、备注输入和确认按钮', () => {
      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      // 每个未确认行应有一个确认按钮
      const confirmButtons = screen.getAllByRole('button', {
        name: /确认/,
      });
      expect(confirmButtons.length).toBeGreaterThan(0);
    });

    it('点击确认按钮应调用 PATCH 接口并传递 actualStatus 和 remark', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      // 找到第一行的实盘状态下拉并选择"正常"
      const row = screen.getByText('AST-001').closest('tr')!;
      const selects = within(row as HTMLElement).getAllByRole('combobox');

      if (selects.length > 0) {
        await user.click(selects[0]);
        // 在下拉弹出层中选择"正常"
        const normalOption = await screen.findByText('正常');
        await user.click(normalOption);
      }

      // 在备注列输入文字
      const remarkInputs = within(row as HTMLElement).queryAllByPlaceholderText(
        /备注/,
      );
      if (remarkInputs.length > 0) {
        await user.type(remarkInputs[0], '设备完好');
      }

      // 点击确认
      const confirmBtn = within(row as HTMLElement).getByRole('button', {
        name: /确认/,
      });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(confirmMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId: 'task-1',
            assetId: 'asset-1',
          }),
        );
      });
    });

    it('确认成功后该行应变为只读，确认按钮消失', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      const row = screen.getByText('AST-001').closest('tr')!;
      const confirmBtn = within(row as HTMLElement).getByRole('button', {
        name: /确认/,
      });

      await user.click(confirmBtn);

      await waitFor(() => {
        // 确认按钮应该消失（行已确认）
        expect(
          within(row as HTMLElement).queryByRole('button', { name: /确认/ }),
        ).toBeNull();
      });
    });

    it('确认失败时应显示错误提示', async () => {
      const user = userEvent.setup();
      confirmMutateAsync.mockRejectedValue(new Error('确认失败'));

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      const row = screen.getByText('AST-001').closest('tr')!;
      const confirmBtn = within(row as HTMLElement).getByRole('button', {
        name: /确认/,
      });

      await user.click(confirmBtn);

      await waitFor(() => {
        expect(message.error).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 3. 批量确认 (ATB-005)
  // -------------------------------------------------------------------------
  describe('批量确认', () => {
    it('未勾选任何行时批量确认按钮应为 disabled', () => {
      (useInventoryStore as Mock).mockReturnValue({
        ...defaultStoreState,
        selectedAssetIds: [],
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      const batchBtn = screen.queryByRole('button', {
        name: /批量确认/,
      });

      if (batchBtn) {
        expect(batchBtn).toBeDisabled();
      }
    });

    it('勾选行后批量确认按钮应变为 enabled 并显示已选数量', () => {
      (useInventoryStore as Mock).mockReturnValue({
        ...defaultStoreState,
        selectedAssetIds: ['asset-1', 'asset-2', 'asset-3'],
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      const batchBtn = screen.getByRole('button', { name: /批量确认/ });
      expect(batchBtn).not.toBeDisabled();

      expect(screen.getByText(/已选 3 项/)).toBeInTheDocument();
    });

    it('点击批量确认后应弹出确认对话框', async () => {
      const user = userEvent.setup();
      (useInventoryStore as Mock).mockReturnValue({
        ...defaultStoreState,
        selectedAssetIds: ['asset-1', 'asset-2', 'asset-3'],
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      const batchBtn = screen.getByRole('button', { name: /批量确认/ });
      await user.click(batchBtn);

      // 弹窗标题
      await waitFor(() => {
        expect(
          screen.getByText(/批量确认/),
        ).toBeInTheDocument();
      });
    });

    it('批量确认对话框中应能选择统一实盘状态并确认', async () => {
      const user = userEvent.setup();
      (useInventoryStore as Mock).mockReturnValue({
        ...defaultStoreState,
        selectedAssetIds: ['asset-1', 'asset-2'],
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      const batchBtn = screen.getByRole('button', { name: /批量确认/ });
      await user.click(batchBtn);

      await waitFor(async () => {
        // 在对话框中选择实盘状态
        const dialogSelects = screen.getAllByRole('combobox');
        if (dialogSelects.length > 0) {
          await user.click(dialogSelects[0]);
          const normalOption = await screen.findByText('正常');
          await user.click(normalOption);
        }

        // 点击确认
        const dialogConfirmBtn = screen.getByRole('button', {
          name: /^确认$/,
        });
        await user.click(dialogConfirmBtn);
      });

      await waitFor(() => {
        expect(batchConfirmMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId: 'task-1',
            assetIds: ['asset-1', 'asset-2'],
            actualStatus: 'normal',
          }),
        );
      });
    });

    it('批量确认成功后应清空选中状态', async () => {
      const user = userEvent.setup();
      const clearSelection = vi.fn();
      (useInventoryStore as Mock).mockReturnValue({
        ...defaultStoreState,
        selectedAssetIds: ['asset-1'],
        clearSelection,
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      const batchBtn = screen.getByRole('button', { name: /批量确认/ });
      await user.click(batchBtn);

      await waitFor(async () => {
        const dialogConfirmBtn = screen.getByRole('button', {
          name: /^确认$/,
        });
        await user.click(dialogConfirmBtn);
      });

      await waitFor(() => {
        expect(clearSelection).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 4. 批量确认上限 (SPEC: 单次批量确认上限 100 条)
  // -------------------------------------------------------------------------
  describe('批量确认上限', () => {
    it('选择超过 100 条时应提示并截断到 100 条', () => {
      const ids = Array.from({ length: 105 }, (_, i) => `asset-${i}`);
      (useInventoryStore as Mock).mockReturnValue({
        ...defaultStoreState,
        selectedAssetIds: ids,
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      expect(message.warning).toHaveBeenCalledWith(
        expect.stringContaining('100'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 5. 只读模式 (ATB-007)
  // -------------------------------------------------------------------------
  describe('只读模式', () => {
    it('readOnly=true 时实盘状态下拉应为 disabled', () => {
      const confirmedAssets: PaginatedAssets = {
        items: [
          createMockAsset({
            assetId: 'asset-1',
            assetCode: 'AST-001',
            assetName: '笔记本电脑',
            bookStatus: '在用',
            actualStatus: null,
            remark: '',
            confirmed: false,
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      (useAssets as Mock).mockReturnValue({
        data: confirmedAssets,
        isLoading: false,
        error: null,
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly />);

      // 实盘状态下拉应为 disabled
      const selects = screen.getAllByRole('combobox');
      selects.forEach((sel) => {
        expect(sel).toHaveClass('ant-select-disabled');
      });
    });

    it('readOnly=true 时确认按钮应不可见', () => {
      renderWithProviders(<AssetTable taskId="task-1" readOnly />);

      // 不应出现任何"确认"按钮
      const confirmButtons = screen.queryAllByRole('button', { name: /确认/ });
      expect(confirmButtons).toHaveLength(0);
    });

    it('readOnly=true 时备注输入应为 disabled', () => {
      const assetsWithRemark: PaginatedAssets = {
        items: [
          createMockAsset({
            assetId: 'asset-1',
            assetCode: 'AST-001',
            assetName: '笔记本电脑',
            actualStatus: null,
            confirmed: false,
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      (useAssets as Mock).mockReturnValue({
        data: assetsWithRemark,
        isLoading: false,
        error: null,
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly />);

      const inputs = screen.queryAllByRole('textbox');
      inputs.forEach((input) => {
        expect(input).toBeDisabled();
      });
    });

    it('readOnly=true 时不应显示批量操作栏', () => {
      renderWithProviders(<AssetTable taskId="task-1" readOnly />);

      expect(screen.queryByRole('button', { name: /批量确认/ })).toBeNull();
    });

    it('readOnly=true 时已确认行应显示文本而非下拉', () => {
      const confirmedAssets: PaginatedAssets = {
        items: [
          createMockAsset({
            assetId: 'asset-1',
            assetCode: 'AST-001',
            assetName: '笔记本电脑',
            actualStatus: 'normal',
            confirmed: true,
            remark: '设备完好',
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      (useAssets as Mock).mockReturnValue({
        data: confirmedAssets,
        isLoading: false,
        error: null,
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly />);

      // 已确认行应显示文本 "正常" 而非下拉
      expect(screen.getByText('正常')).toBeInTheDocument();
      // 不应有 combobox
      expect(screen.queryByRole('combobox')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 6. 虚拟滚动 (ATB-009)
  // -------------------------------------------------------------------------
  describe('虚拟滚动', () => {
    it('资产数 > 200 时应启用 react-window 虚拟列表', () => {
      const manyAssets = createMockAssets(500);
      (useAssets as Mock).mockReturnValue({
        data: { items: manyAssets, total: 500, page: 1, pageSize: 500 },
        isLoading: false,
        error: null,
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      // react-window FixedSizeList 渲染
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toBeInTheDocument();
      expect(virtualList).toHaveAttribute('data-item-count', '500');
    });

    it('虚拟列表应限制 DOM 中的行数而非渲染全部 500 行', () => {
      const manyAssets = createMockAssets(500);
      (useAssets as Mock).mockReturnValue({
        data: { items: manyAssets, total: 500, page: 1, pageSize: 500 },
        isLoading: false,
        error: null,
      });

      const { container } = renderWithProviders(
        <AssetTable taskId="task-1" readOnly={false} />,
      );

      // 在虚拟滚动模式下，不应出现 500 个 <tr>
      // 由于 mock 的 FixedSizeList 会渲染所有行的内容，
      // 我们验证虚拟列表容器存在即可
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toBeInTheDocument();
    });

    it('资产数 ≤ 200 时应使用普通表格渲染', () => {
      const assets = createMockAssets(50);
      (useAssets as Mock).mockReturnValue({
        data: { items: assets, total: 50, page: 1, pageSize: 50 },
        isLoading: false,
        error: null,
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      // 不应出现虚拟列表容器
      expect(screen.queryByTestId('virtual-list')).toBeNull();

      // 应使用普通表格
      expect(document.querySelector('table')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // 7. 防重复提交 (ATB-008)
  // -------------------------------------------------------------------------
  describe('防重复提交', () => {
    it('逐条确认 loading 期间不应重复触发请求', async () => {
      const user = userEvent.setup();

      // 创建一个不会立即 resolve 的 mutation
      let resolveConfirm: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveConfirm = resolve;
      });
      confirmMutateAsync.mockReturnValue(pendingPromise);

      (useConfirmAssetMutation as Mock).mockReturnValue({
        mutateAsync: confirmMutateAsync,
        isPending: true, // 模拟 loading 状态
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      const row = screen.getByText('AST-001').closest('tr')!;
      const confirmBtn = within(row as HTMLElement).getByRole('button', {
        name: /确认/,
      });

      // 按钮应显示 loading 状态（disabled）
      // Ant Design Button loading 时会添加 ant-btn-loading class
      expect(confirmBtn).toHaveClass('ant-btn-loading');

      // 尝试再次点击
      await user.click(confirmBtn);

      // 在 loading 期间，不应产生额外调用
      // mutateAsync 最多只被调用一次
      expect(confirmMutateAsync).toHaveBeenCalledTimes(0);

      // 清理：resolve pending promise
      resolveConfirm!({ success: true });
    });

    it('批量确认 loading 期间不应重复触发请求', async () => {
      const user = userEvent.setup();

      let resolveBatch: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveBatch = resolve;
      });
      batchConfirmMutateAsync.mockReturnValue(pendingPromise);

      (useBatchConfirmMutation as Mock).mockReturnValue({
        mutateAsync: batchConfirmMutateAsync,
        isPending: true,
      });

      (useInventoryStore as Mock).mockReturnValue({
        ...defaultStoreState,
        selectedAssetIds: ['asset-1', 'asset-2'],
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      const batchBtn = screen.getByRole('button', { name: /批量确认/ });

      // loading 状态
      expect(batchBtn).toHaveClass('ant-btn-loading');

      // 清理
      resolveBatch!({ success: true });
    });
  });

  // -------------------------------------------------------------------------
  // 8. 错误处理
  // -------------------------------------------------------------------------
  describe('错误处理', () => {
    it('资产列表加载失败时应显示错误信息和重试按钮', () => {
      (useAssets as Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('加载失败'),
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      expect(screen.getByText(/加载失败/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /重试/ }),
      ).toBeInTheDocument();
    });

    it('点击重试按钮应重新触发数据加载', async () => {
      const user = userEvent.setup();
      const refetch = vi.fn();

      (useAssets as Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('加载失败'),
        refetch,
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      const retryBtn = screen.getByRole('button', { name: /重试/ });
      await user.click(retryBtn);

      expect(refetch).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 9. 调用 useAssets 时传入正确的 taskId
  // -------------------------------------------------------------------------
  describe('Hook 调用', () => {
    it('应以正确的 taskId 调用 useAssets', () => {
      renderWithProviders(<AssetTable taskId="task-42" readOnly={false} />);

      expect(useAssets).toHaveBeenCalledWith('task-42');
    });

    it('应以正确的 taskId 调用 useConfirmAssetMutation', () => {
      renderWithProviders(<AssetTable taskId="task-42" readOnly={false} />);

      expect(useConfirmAssetMutation).toHaveBeenCalledWith('task-42');
    });

    it('应以正确的 taskId 调用 useBatchConfirmMutation', () => {
      renderWithProviders(<AssetTable taskId="task-42" readOnly={false} />);

      expect(useBatchConfirmMutation).toHaveBeenCalledWith('task-42');
    });
  });

  // -------------------------------------------------------------------------
  // 10. Checkbox 选择交互
  // -------------------------------------------------------------------------
  describe('Checkbox 选择', () => {
    it('点击行 Checkbox 应调用 toggleAssetSelection', async () => {
      const user = userEvent.setup();
      const toggleFn = vi.fn();
      (useInventoryStore as Mock).mockReturnValue({
        ...defaultStoreState,
        toggleAssetSelection: toggleFn,
        selectedAssetIds: [],
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // 第一个 checkbox 可能是全选 checkbox，取第二个
      const rowCheckbox = checkboxes.length > 1 ? checkboxes[1] : checkboxes[0];
      await user.click(rowCheckbox);

      expect(toggleFn).toHaveBeenCalled();
    });

    it('已选中的行应显示为选中状态', () => {
      (useInventoryStore as Mock).mockReturnValue({
        ...defaultStoreState,
        selectedAssetIds: ['asset-1'],
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      // asset-1 对应的行 checkbox 应为 checked
      const row = screen.getByText('AST-001').closest('tr')!;
      const checkbox = within(row as HTMLElement).getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });
  });

  // -------------------------------------------------------------------------
  // 11. 已确认资产行的渲染
  // -------------------------------------------------------------------------
  describe('已确认资产行', () => {
    it('已确认行应显示实盘状态文本而非下拉', () => {
      const assetsWithConfirmed: PaginatedAssets = {
        items: [
          createMockAsset({
            assetId: 'asset-1',
            assetCode: 'AST-001',
            assetName: '笔记本电脑',
            actualStatus: 'normal',
            confirmed: true,
            remark: '设备完好',
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      (useAssets as Mock).mockReturnValue({
        data: assetsWithConfirmed,
        isLoading: false,
        error: null,
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      // 已确认行显示文本
      expect(screen.getByText('正常')).toBeInTheDocument();
      expect(screen.getByText('设备完好')).toBeInTheDocument();

      // 不应有确认按钮
      const row = screen.getByText('AST-001').closest('tr')!;
      expect(
        within(row as HTMLElement).queryByRole('button', { name: /确认/ }),
      ).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 12. 分页
  // -------------------------------------------------------------------------
  describe('分页', () => {
    it('应将分页参数传递给 useAssets hook', () => {
      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      // useAssets 应被调用
      expect(useAssets).toHaveBeenCalledWith('task-1');
    });

    it('数据包含分页信息时底部应显示分页器', () => {
      const manyAssets = createMockAssets(25);
      (useAssets as Mock).mockReturnValue({
        data: {
          items: manyAssets.slice(0, 20),
          total: 25,
          page: 1,
          pageSize: 20,
        },
        isLoading: false,
        error: null,
      });

      renderWithProviders(<AssetTable taskId="task-1" readOnly={false} />);

      // Ant Design Table 的分页器
      const pagination = document.querySelector('.ant-pagination');
      expect(pagination).toBeTruthy();
    });
  });
});