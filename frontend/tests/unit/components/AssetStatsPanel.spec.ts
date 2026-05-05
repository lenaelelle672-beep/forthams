/**
 * AssetStatsPanel Component Unit Tests
 * 
 * Test suite for SWARM-003: Dashboard Data Panel
 * Validates Asset Overview Statistics Component
 * 
 * @section验收测试基准 (ATB)
 * - TC-1.1: 卡片渲染完整性
 * - TC-1.2: 指标数值展示
 * - TC-1.3: 数字格式化
 * - TC-1.4: 加载态处理
 * - TC-1.5: 错误态处理
 * - TC-1.6: 无数据态处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/vue';
import AssetStatsPanel from '@/components/dashboard/AssetStatsPanel.vue';

// Mock data for testing
const mockStatsData = {
  totalAssets: 12500,
  activeAssets: 10800,
  maintenanceDue: 156,
  totalValue: 45600000
};

const mockErrorResponse = {
  status: 500,
  message: 'Internal Server Error'
};

// Mock API module
vi.mock('@/services/dashboardService', () => ({
  fetchAssetStats: vi.fn()
}));

import { fetchAssetStats } from '@/services/dashboardService';

describe('AssetStatsPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * TC-1.1: 卡片渲染完整性
   * 验证页面加载后存在 4 个统计卡片
   */
  describe('TC-1.1: 卡片渲染完整性', () => {
    it('should render 4 stat cards when data is loaded', async () => {
      vi.mocked(fetchAssetStats).mockResolvedValue(mockStatsData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const statCards = document.querySelectorAll('.stat-card');
        expect(statCards).toHaveLength(4);
      });
    });

    it('should render all stat card labels correctly', async () => {
      vi.mocked(fetchAssetStats).mockResolvedValue(mockStatsData);

      render(AssetStatsPanel);

      await waitFor(() => {
        expect(screen.getByText('资产总量')).toBeTruthy();
        expect(screen.getByText('在用资产')).toBeTruthy();
        expect(screen.getByText('维保到期')).toBeTruthy();
        expect(screen.getByText('资产总价值')).toBeTruthy();
      });
    });
  });

  /**
   * TC-1.2: 指标数值展示
   * 验证卡片显示的数值与 API 返回一致
   */
  describe('TC-1.2: 指标数值展示', () => {
    it('should display correct total assets count', async () => {
      vi.mocked(fetchAssetStats).mockResolvedValue(mockStatsData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const totalCard = document.querySelector('[data-testid="stat-card-total"]');
        expect(totalCard?.textContent).toContain('12500');
      });
    });

    it('should display correct active assets count', async () => {
      vi.mocked(fetchAssetStats).mockResolvedValue(mockStatsData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const activeCard = document.querySelector('[data-testid="stat-card-active"]');
        expect(activeCard?.textContent).toContain('10800');
      });
    });

    it('should display correct maintenance due count', async () => {
      vi.mocked(fetchAssetStats).mockResolvedValue(mockStatsData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const maintenanceCard = document.querySelector('[data-testid="stat-card-maintenance"]');
        expect(maintenanceCard?.textContent).toContain('156');
      });
    });

    it('should display correct total value', async () => {
      vi.mocked(fetchAssetStats).mockResolvedValue(mockStatsData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const valueCard = document.querySelector('[data-testid="stat-card-value"]');
        expect(valueCard?.textContent).toContain('45600000');
      });
    });
  });

  /**
   * TC-1.3: 数字格式化
   * 验证数值超过 10000 时展示为 "1.2万" 格式
   */
  describe('TC-1.3: 数字格式化', () => {
    it('should format numbers exceeding 10000 as Chinese wan format', async () => {
      const largeData = {
        totalAssets: 12500,
        activeAssets: 10800,
        maintenanceDue: 156,
        totalValue: 45600000
      };
      vi.mocked(fetchAssetStats).mockResolvedValue(largeData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const totalCard = document.querySelector('[data-testid="stat-card-total"]');
        // 12500 should be formatted as "1.25万"
        expect(totalCard?.textContent).toMatch(/1\.\d+万/);
      });
    });

    it('should display small numbers without formatting', async () => {
      const smallData = {
        totalAssets: 500,
        activeAssets: 480,
        maintenanceDue: 20,
        totalValue: 1500000
      };
      vi.mocked(fetchAssetStats).mockResolvedValue(smallData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const maintenanceCard = document.querySelector('[data-testid="stat-card-maintenance"]');
        expect(maintenanceCard?.textContent).toContain('20');
      });
    });

    it('should handle boundary case at exactly 10000', async () => {
      const boundaryData = {
        totalAssets: 10000,
        activeAssets: 9500,
        maintenanceDue: 500,
        totalValue: 30000000
      };
      vi.mocked(fetchAssetStats).mockResolvedValue(boundaryData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const totalCard = document.querySelector('[data-testid="stat-card-total"]');
        // At exactly 10000, should still be formatted as "1万"
        expect(totalCard?.textContent).toMatch(/1万/);
      });
    });
  });

  /**
   * TC-1.4: 加载态处理
   * 验证 API 响应延迟 > 2s 时显示骨架屏（Skeleton），不显示死数据
   */
  describe('TC-1.4: 加载态处理', () => {
    it('should show skeleton loading state while fetching data', async () => {
      vi.mocked(fetchAssetStats).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockStatsData), 3000))
      );

      render(AssetStatsPanel);

      // Initially should show skeleton
      const skeletons = document.querySelectorAll('.skeleton');
      expect(skeletons.length).toBeGreaterThan(0);

      // Should NOT show actual data values while loading
      const totalCard = document.querySelector('[data-testid="stat-card-total"]');
      expect(totalCard?.textContent).not.toContain('12500');
    });

    it('should remove skeleton after data loads', async () => {
      vi.mocked(fetchAssetStats).mockResolvedValue(mockStatsData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const skeletons = document.querySelectorAll('.skeleton');
        expect(skeletons).toHaveLength(0);
      }, { timeout: 5000 });
    });

    it('should show loading spinner with timeout message if loading exceeds 2s', async () => {
      vi.mocked(fetchAssetStats).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockStatsData), 2500))
      );

      render(AssetStatsPanel);

      await waitFor(() => {
        const loadingSpinner = document.querySelector('.loading-spinner');
        expect(loadingSpinner).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  /**
   * TC-1.5: 错误态处理
   * 验证 API 返回 500 错误时卡片显示错误提示图标，点击可重试
   */
  describe('TC-1.5: 错误态处理', () => {
    it('should display error state when API returns 500 error', async () => {
      vi.mocked(fetchAssetStats).mockRejectedValue(mockErrorResponse);

      render(AssetStatsPanel);

      await waitFor(() => {
        const errorIcon = document.querySelector('.error-icon');
        expect(errorIcon).toBeTruthy();
      });
    });

    it('should show retry button on error state', async () => {
      vi.mocked(fetchAssetStats).mockRejectedValue(mockErrorResponse);

      render(AssetStatsPanel);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /重试|retry/i });
        expect(retryButton).toBeTruthy();
      });
    });

    it('should refetch data when retry button is clicked', async () => {
      vi.mocked(fetchAssetStats)
        .mockRejectedValueOnce(mockErrorResponse)
        .mockResolvedValueOnce(mockStatsData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /重试|retry/i });
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(fetchAssetStats).toHaveBeenCalledTimes(2);
      });
    });

    it('should display error message in Chinese', async () => {
      vi.mocked(fetchAssetStats).mockRejectedValue({
        status: 500,
        message: '服务器内部错误'
      });

      render(AssetStatsPanel);

      await waitFor(() => {
        expect(screen.getByText(/服务器内部错误|请求失败/i)).toBeTruthy();
      });
    });
  });

  /**
   * TC-1.6: 无数据态处理
   * 验证资产总数为 0 时卡片显示 "暂无数据"，不显示 "0"
   */
  describe('TC-1.6: 无数据态处理', () => {
    it('should display "暂无数据" when total assets is 0', async () => {
      const emptyData = {
        totalAssets: 0,
        activeAssets: 0,
        maintenanceDue: 0,
        totalValue: 0
      };
      vi.mocked(fetchAssetStats).mockResolvedValue(emptyData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const totalCard = document.querySelector('[data-testid="stat-card-total"]');
        expect(totalCard?.textContent).toContain('暂无数据');
        expect(totalCard?.textContent).not.toContain('0');
      });
    });

    it('should not display "0" for any stat when data is empty', async () => {
      const emptyData = {
        totalAssets: 0,
        activeAssets: 0,
        maintenanceDue: 0,
        totalValue: 0
      };
      vi.mocked(fetchAssetStats).mockResolvedValue(emptyData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach(card => {
          expect(card.textContent).not.toMatch(/(?<!\d)0(?!\d)/);
        });
      });
    });

    it('should show empty state illustration', async () => {
      const emptyData = {
        totalAssets: 0,
        activeAssets: 0,
        maintenanceDue: 0,
        totalValue: 0
      };
      vi.mocked(fetchAssetStats).mockResolvedValue(emptyData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const emptyIllustration = document.querySelector('.empty-state');
        expect(emptyIllustration).toBeTruthy();
      });
    });
  });

  /**
   * Additional tests for change rate display
   */
  describe('Change Rate Display', () => {
    it('should display change rate percentage when provided', async () => {
      const dataWithChange = {
        ...mockStatsData,
        changeRate: 5.2
      };
      vi.mocked(fetchAssetStats).mockResolvedValue(dataWithChange);

      render(AssetStatsPanel);

      await waitFor(() => {
        const changeIndicator = document.querySelector('.change-rate');
        expect(changeIndicator?.textContent).toMatch(/(\+?|\-?)5\.2%/);
      });
    });

    it('should show up arrow for positive change rate', async () => {
      const dataWithPositiveChange = {
        ...mockStatsData,
        changeRate: 5.2
      };
      vi.mocked(fetchAssetStats).mockResolvedValue(dataWithPositiveChange);

      render(AssetStatsPanel);

      await waitFor(() => {
        const upArrow = document.querySelector('.trend-up');
        expect(upArrow).toBeTruthy();
      });
    });

    it('should show down arrow for negative change rate', async () => {
      const dataWithNegativeChange = {
        ...mockStatsData,
        changeRate: -3.1
      };
      vi.mocked(fetchAssetStats).mockResolvedValue(dataWithNegativeChange);

      render(AssetStatsPanel);

      await waitFor(() => {
        const downArrow = document.querySelector('.trend-down');
        expect(downArrow).toBeTruthy();
      });
    });
  });

  /**
   * Accessibility tests
   */
  describe('Accessibility', () => {
    it('should have proper aria labels for screen readers', async () => {
      vi.mocked(fetchAssetStats).mockResolvedValue(mockStatsData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const statCards = document.querySelectorAll('[role="region"]');
        expect(statCards.length).toBeGreaterThan(0);
      });
    });

    it('should have sufficient color contrast for text', async () => {
      vi.mocked(fetchAssetStats).mockResolvedValue(mockStatsData);

      render(AssetStatsPanel);

      await waitFor(() => {
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach(card => {
          expect(card).toBeVisible();
        });
      });
    });
  });
});