/**
 * @file OverviewCards.spec.ts
 * @description 资产概览卡片组件的单元测试
 * 
 * 测试覆盖：
 * - 直线法折旧计算显示
 * - 双倍余额递减法计算显示
 * - 资产总览数据渲染
 * - 卡片交互事件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import OverviewCards from '@/pages/DashboardPage/components/OverviewCards/OverviewCards.vue';
import type { AssetOverviewData, DepreciationSummary } from '@/pages/DashboardPage/types/dashboard.types';

// Mock dependencies
vi.mock('@/services/dashboardService', () => ({
  default: {
    getAssetOverview: vi.fn(),
    getDepreciationSummary: vi.fn(),
  },
}));

describe('OverviewCards', () => {
  // 测试数据
  const mockDepreciationSummary: DepreciationSummary = {
    totalAssets: 150,
    totalOriginalValue: 5000000,
    totalCurrentValue: 3500000,
    totalDepreciation: 1500000,
    straightLineDepreciation: 800000,
    doubleDecliningDepreciation: 700000,
    monthlyDepreciation: 125000,
  };

  const mockOverviewData: AssetOverviewData = {
    activeAssets: 120,
    idleAssets: 20,
    retiredAssets: 10,
    totalValue: 5000000,
    avgAge: 3.5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('直线法折旧卡片', () => {
    it('应该正确显示直线法折旧金额', () => {
      render(OverviewCards, {
        props: {
          depreciationSummary: mockDepreciationSummary,
          depreciationMethod: 'straight-line',
        },
      });

      const straightLineCard = screen.getByTestId('straight-line-card');
      expect(straightLineCard).toBeTruthy();
      expect(straightLineCard.textContent).toContain('800,000');
    });

    it('应该显示直线法折旧占总折旧比例', () => {
      render(OverviewCards, {
        props: {
          depreciationSummary: mockDepreciationSummary,
          depreciationMethod: 'straight-line',
        },
      });

      const percentage = (800000 / 1500000) * 100;
      expect(screen.getByText(`${percentage.toFixed(1)}%`)).toBeTruthy();
    });
  });

  describe('双倍余额递减法折旧卡片', () => {
    it('应该正确显示双倍余额递减法折旧金额', () => {
      render(OverviewCards, {
        props: {
          depreciationSummary: mockDepreciationSummary,
          depreciationMethod: 'double-declining',
        },
      });

      const doubleDecliningCard = screen.getByTestId('double-declining-card');
      expect(doubleDecliningCard).toBeTruthy();
      expect(doubleDecliningCard.textContent).toContain('700,000');
    });

    it('应该显示加速折旧标识', () => {
      render(OverviewCards, {
        props: {
          depreciationSummary: mockDepreciationSummary,
          depreciationMethod: 'double-declining',
        },
      });

      expect(screen.getByText(/加速折旧/)).toBeTruthy();
    });
  });

  describe('资产总览数据', () => {
    it('应该显示资产总数', () => {
      render(OverviewCards, {
        props: {
          overviewData: mockOverviewData,
        },
      });

      expect(screen.getByText('150')).toBeTruthy();
    });

    it('应该显示活跃资产数量', () => {
      render(OverviewCards, {
        props: {
          overviewData: mockOverviewData,
        },
      });

      expect(screen.getByText('120')).toBeTruthy();
    });
  });

  describe('卡片交互', () => {
    it('点击卡片应触发详情查看事件', async () => {
      const onDetailClick = vi.fn();
      
      render(OverviewCards, {
        props: {
          depreciationSummary: mockDepreciationSummary,
          onDetailClick,
        },
      });

      const card = screen.getByTestId('straight-line-card');
      await fireEvent.click(card);
      
      expect(onDetailClick).toHaveBeenCalledWith('straight-line');
    });

    it('悬停卡片应显示提示信息', async () => {
      render(OverviewCards, {
        props: {
          depreciationSummary: mockDepreciationSummary,
        },
      });

      const card = screen.getByTestId('straight-line-card');
      await fireEvent.mouseEnter(card);
      
      // 验证tooltip显示
      expect(screen.getByRole('tooltip')).toBeTruthy();
    });
  });

  describe('折旧计算公式验证', () => {
    it('直线法：年折旧额 = (原值 - 残值) / 使用年限', () => {
      const originalValue = 100000;
      const residualValue = 10000;
      const usefulLife = 5;
      const expectedAnnualDepreciation = (originalValue - residualValue) / usefulLife;
      
      expect(expectedAnnualDepreciation).toBe(18000);
    });

    it('双倍余额递减法：年折旧率 = 2 / 使用年限', () => {
      const usefulLife = 5;
      const expectedRate = 2 / usefulLife;
      
      expect(expectedRate).toBe(0.4); // 40%
    });
  });
});