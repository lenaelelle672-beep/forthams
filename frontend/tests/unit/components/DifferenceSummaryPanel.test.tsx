/**
 * @file DifferenceSummaryPanel 单元测试
 * @description 盘盈盘亏汇总面板 (P3-010-E) 的单元测试
 * 覆盖验收测试基准: ATB-006, ATB-007 (只读), ATB-008 (防重复提交)
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import DifferenceSummaryPanel from '../../../src/components/inventory/DifferenceSummaryPanel';

/* ------------------------------------------------------------------ */
/*  Mock hooks — Layer 2 per spec                                      */
/* ------------------------------------------------------------------ */
vi.mock('../../../src/hooks/useInventory', () => ({
  useSummary: vi.fn(),
  useSubmitMutation: vi.fn(),
}));

import { useSummary, useSubmitMutation } from '../../../src/hooks/useInventory';

/* ------------------------------------------------------------------ */
/*  Test data (aligned with spec data constraints)                     */
/* ------------------------------------------------------------------ */
const mockSurplusItems = [
  {
    assetId: 'asset-1',
    assetCode: 'AST-001',
    assetName: '笔记本电脑A',
    reason: '账外发现新设备',
  },
  {
    assetId: 'asset-2',
    assetCode: 'AST-002',
    assetName: '投影仪B',
    reason: '未登记资产',
  },
];

const mockDeficitItems = [
  {
    assetId: 'asset-3',
    assetCode: 'AST-003',
    assetName: '打印机C',
    reason: '实物未找到',
  },
  {
    assetId: 'asset-4',
    assetCode: 'AST-004',
    assetName: '显示器D',
    reason: '已报废未更新台账',
  },
  {
    assetId: 'asset-5',
    assetCode: 'AST-005',
    assetName: '路由器E',
    reason: '位置变更未记录',
  },
];

const defaultSummaryData = {
  surplusItems: mockSurplusItems,
  deficitItems: mockDeficitItems,
  surplusCount: 2,
  deficitCount: 3,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * 创建包含 React Query Provider 的渲染包装器
 */
function renderPanel(overrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const props = { taskId: 'task-123', readOnly: false, ...overrides };

  return render(
    <QueryClientProvider client={queryClient}>
      <DifferenceSummaryPanel {...(props as any)} />
    </QueryClientProvider>,
  );
}

/* ------------------------------------------------------------------ */
/*  Test suites                                                        */
/* ------------------------------------------------------------------ */
describe('DifferenceSummaryPanel', () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useSummary as Mock).mockReturnValue({
      data: defaultSummaryData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    (useSubmitMutation as Mock).mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isLoading: false,
      isPending: false,
    });
  });

  /* ================================================================== */
  /*  ATB-006 Step 1: 基础渲染 — 两个 Tab + 提交按钮                    */
  /* ================================================================== */
  describe('基础渲染', () => {
    it('渲染「盘盈明细」和「盘亏明细」两个 Tab', () => {
      renderPanel();

      expect(screen.getByText('盘盈明细')).toBeInTheDocument();
      expect(screen.getByText('盘亏明细')).toBeInTheDocument();
    });

    it('渲染「提交核准」按钮', () => {
      renderPanel();

      expect(
        screen.getByRole('button', { name: /提交核准/ }),
      ).toBeInTheDocument();
    });

    it('以传入的 taskId 调用 useSummary hook', () => {
      renderPanel({ taskId: 'task-789' });

      expect(useSummary).toHaveBeenCalledWith('task-789');
    });
  });

  /* ================================================================== */
  /*  ATB-006 Step 2: 盘盈明细 Tab — 2 条记录                           */
  /* ================================================================== */
  describe('盘盈明细 Tab', () => {
    it('默认激活盘盈明细，显示资产编号 / 资产名称 / 盘盈原因列头', () => {
      renderPanel();

      expect(screen.getByText('资产编号')).toBeInTheDocument();
      expect(screen.getByText('资产名称')).toBeInTheDocument();
      expect(screen.getByText('盘盈原因')).toBeInTheDocument();
    });

    it('正确渲染 2 条盘盈明细数据', () => {
      renderPanel();

      expect(screen.getByText('AST-001')).toBeInTheDocument();
      expect(screen.getByText('笔记本电脑A')).toBeInTheDocument();
      expect(screen.getByText('账外发现新设备')).toBeInTheDocument();

      expect(screen.getByText('AST-002')).toBeInTheDocument();
      expect(screen.getByText('投影仪B')).toBeInTheDocument();
      expect(screen.getByText('未登记资产')).toBeInTheDocument();
    });
  });

  /* ================================================================== */
  /*  ATB-006 Step 2: 盘亏明细 Tab — 3 条记录                           */
  /* ================================================================== */
  describe('盘亏明细 Tab', () => {
    it('切换到盘亏明细后显示资产编号 / 资产名称 / 盘亏原因列头', () => {
      renderPanel();

      fireEvent.click(screen.getByText('盘亏明细'));

      expect(screen.getByText('资产编号')).toBeInTheDocument();
      expect(screen.getByText('资产名称')).toBeInTheDocument();
      expect(screen.getByText('盘亏原因')).toBeInTheDocument();
    });

    it('正确渲染 3 条盘亏明细数据', () => {
      renderPanel();

      fireEvent.click(screen.getByText('盘亏明细'));

      expect(screen.getByText('AST-003')).toBeInTheDocument();
      expect(screen.getByText('打印机C')).toBeInTheDocument();
      expect(screen.getByText('实物未找到')).toBeInTheDocument();

      expect(screen.getByText('AST-004')).toBeInTheDocument();
      expect(screen.getByText('显示器D')).toBeInTheDocument();

      expect(screen.getByText('AST-005')).toBeInTheDocument();
      expect(screen.getByText('路由器E')).toBeInTheDocument();
      expect(screen.getByText('位置变更未记录')).toBeInTheDocument();
    });
  });

  /* ================================================================== */
  /*  ATB-006 Step 3 & 4: 差异状态展示                                   */
  /* ================================================================== */
  describe('差异状态', () => {
    it('存在差异时「提交核准」按钮可见且 enabled', () => {
      renderPanel();

      const btn = screen.getByRole('button', { name: /提交核准/ });
      expect(btn).toBeInTheDocument();
      expect(btn).toBeEnabled();
    });

    it('surplus=0 deficit=0 时显示"无差异"文案', () => {
      (useSummary as Mock).mockReturnValue({
        data: {
          surplusItems: [],
          deficitItems: [],
          surplusCount: 0,
          deficitCount: 0,
        },
        isLoading: false,
        error: null,
      });

      renderPanel();

      expect(screen.getByText('无差异')).toBeInTheDocument();
    });

    it('无差异时「提交核准」按钮仍然可见 (spec: ATB-006 Step 4)', () => {
      (useSummary as Mock).mockReturnValue({
        data: {
          surplusItems: [],
          deficitItems: [],
          surplusCount: 0,
          deficitCount: 0,
        },
        isLoading: false,
        error: null,
      });

      renderPanel();

      expect(
        screen.getByRole('button', { name: /提交核准/ }),
      ).toBeInTheDocument();
    });
  });

  /* ================================================================== */
  /*  ATB-006 Step 5 & 6: 提交核准流程                                   */
  /* ================================================================== */
  describe('提交核准流程', () => {
    it('点击「提交核准」弹出二次确认弹窗，显示不可逆提示', async () => {
      renderPanel();

      fireEvent.click(screen.getByRole('button', { name: /提交核准/ }));

      await waitFor(() => {
        expect(screen.getByText(/确认提交核准/)).toBeInTheDocument();
        expect(screen.getByText(/提交后不可修改/)).toBeInTheDocument();
      });
    });

    it('在确认弹窗中点击「确定」触发 submit mutation', async () => {
      renderPanel();

      fireEvent.click(screen.getByRole('button', { name: /提交核准/ }));

      const dialog = await screen.findByRole('dialog');
      const okBtn = within(dialog).getByRole('button', { name: /确/ });
      fireEvent.click(okBtn);

      expect(mockMutate).toHaveBeenCalledWith('task-123');
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    it('在确认弹窗中点击「取消」不触发 submit mutation', async () => {
      renderPanel();

      fireEvent.click(screen.getByRole('button', { name: /提交核准/ }));

      const dialog = await screen.findByRole('dialog');
      const cancelBtn = within(dialog).getByRole('button', { name: /取消/ });
      fireEvent.click(cancelBtn);

      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  /* ================================================================== */
  /*  ATB-007: 只读模式                                                  */
  /* ================================================================== */
  describe('只读模式', () => {
    it('readOnly=true 时隐藏「提交核准」按钮', () => {
      renderPanel({ readOnly: true });

      expect(
        screen.queryByRole('button', { name: /提交核准/ }),
      ).not.toBeInTheDocument();
    });

    it('readOnly=true 时仍渲染 Tab 面板并展示数据', () => {
      renderPanel({ readOnly: true });

      expect(screen.getByText('盘盈明细')).toBeInTheDocument();
      expect(screen.getByText('盘亏明细')).toBeInTheDocument();
      // 盘盈数据仍可见
      expect(screen.getByText('AST-001')).toBeInTheDocument();
    });
  });

  /* ================================================================== */
  /*  加载与错误状态                                                      */
  /* ================================================================== */
  describe('加载与错误状态', () => {
    it('加载中显示 loading 指示器', () => {
      (useSummary as Mock).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderPanel();

      // Ant Design Spin 组件渲染 .ant-spin 容器
      const spinner = document.querySelector('.ant-spin');
      expect(spinner).toBeTruthy();
    });

    it('请求失败时显示错误提示信息', () => {
      (useSummary as Mock).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Network error'),
      });

      renderPanel();

      expect(screen.getByText(/加载失败/)).toBeInTheDocument();
    });

    it('请求失败时显示重试按钮', () => {
      const mockRefetch = vi.fn();
      (useSummary as Mock).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Network error'),
        refetch: mockRefetch,
      });

      renderPanel();

      const retryBtn = screen.getByRole('button', { name: /重试/ });
      expect(retryBtn).toBeInTheDocument();

      fireEvent.click(retryBtn);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  /* ================================================================== */
  /*  ATB-008: 防重复提交                                                */
  /* ================================================================== */
  describe('防重复提交 (ATB-008)', () => {
    it('mutation pending 时「提交核准」按钮为 disabled 状态', () => {
      (useSubmitMutation as Mock).mockReturnValue({
        mutate: mockMutate,
        mutateAsync: vi.fn(),
        isLoading: true,
        isPending: true,
      });

      renderPanel();

      const submitBtn = screen.getByRole('button', { name: /提交核准/ });
      expect(submitBtn).toBeDisabled();
    });

    it('disabled 状态下点击「提交核准」不触发任何操作', () => {
      (useSubmitMutation as Mock).mockReturnValue({
        mutate: mockMutate,
        mutateAsync: vi.fn(),
        isLoading: true,
        isPending: true,
      });

      renderPanel();

      const submitBtn = screen.getByRole('button', { name: /提交核准/ });
      fireEvent.click(submitBtn);
      // 不应弹出确认弹窗
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('确认弹窗中确认后仅触发一次 mutation（不会因快速连点重复提交）', async () => {
      renderPanel();

      // 打开确认弹窗
      fireEvent.click(screen.getByRole('button', { name: /提交核准/ }));

      const dialog = await screen.findByRole('dialog');
      const okBtn = within(dialog).getByRole('button', { name: /确/ });

      // 模拟快速连点确认按钮
      fireEvent.click(okBtn);
      fireEvent.click(okBtn);
      fireEvent.click(okBtn);

      // mutation 仅被调用一次
      expect(mockMutate).toHaveBeenCalledTimes(1);
      expect(mockMutate).toHaveBeenCalledWith('task-123');
    });
  });
});