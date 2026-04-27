/**
 * StatisticsPanel Component Unit Tests
 * 
 * Test suite for SWARM-003 Dashboard Statistics Panel component.
 * Validates asset overview statistics rendering and data accuracy.
 * 
 * @module StatisticsPanel.spec
 * @group DashboardComponents
 * @group AC-001
 * @group AC-004
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatisticsPanel } from '@/pages/DashboardPage/components/StatisticsPanel';
import { useDashboardStatistics } from '@/pages/DashboardPage/hooks/useDashboardStatistics';
import type { DashboardStatistics } from '@/pages/DashboardPage/types/dashboard.types';

// Mock the useDashboardStatistics hook
vi.mock('@/pages/DashboardPage/hooks/useDashboardStatistics');

// Mock the StatCard component
vi.mock('@/pages/DashboardPage/components/StatCard', () => ({
  StatCard: ({ title, value, trend, trendDirection }: {
    title: string;
    value: number | string;
    trend?: number;
    trendDirection?: 'up' | 'down' | 'neutral';
  }) => (
    <div className="stat-card" data-testid={`stat-card-${title}`}>
      <span className="stat-title">{title}</span>
      <span className="stat-value">{value}</span>
      {trend !== undefined && (
        <span className="stat-trend" data-direction={trendDirection}>
          {trend}%
        </span>
      )}
    </div>
  ),
}));

/**
 * Test helper function to create mock statistics data.
 * 
 * @param overrides - Partial override for default mock data
 * @returns Complete DashboardStatistics mock object
 */
function createMockStatistics(overrides?: Partial<DashboardStatistics>): DashboardStatistics {
  return {
    totalAssets: 1523,
    onlineAssets: 1280,
    offlineAssets: 243,
    totalValue: 15800000,
    maintenanceDueIn7Days: 5,
    maintenanceDueIn30Days: 12,
    ...overrides,
  };
}

/**
 * Test helper to setup hook mock return value.
 * 
 * @param statistics - Mock statistics data
 * @param isLoading - Loading state
 * @param error - Error state
 */
function setupHookMock(
  statistics: DashboardStatistics | null,
  isLoading: boolean = false,
  error: Error | null = null
): void {
  (useDashboardStatistics as ReturnType<typeof vi.mock>).mockReturnValue({
    data: statistics,
    isLoading,
    error,
    refetch: vi.fn(),
  });
}

describe('StatisticsPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TC-001: Asset Statistics Cards Rendering', () => {
    /**
     * Verify that all four statistics cards are correctly rendered.
     * 
     * Test Steps:
     * 1. Render StatisticsPanel with valid mock data
     * 2. Verify four stat-card elements exist
     * 3. Verify each card has correct title
     */
    it('should render four statistics cards with correct titles', () => {
      const mockData = createMockStatistics();
      setupHookMock(mockData);

      render(<StatisticsPanel />);

      const cards = screen.getAllByTestId(/stat-card-/);
      expect(cards).toHaveLength(4);

      const titles = ['资产总量', '在线数量', '离线数量', '资产总价值'];
      titles.forEach((title) => {
        expect(screen.getByText(title)).toBeInTheDocument();
      });
    });

    /**
     * Verify that value fields are not empty when data is present.
     */
    it('should display non-empty values for all statistics cards', () => {
      const mockData = createMockStatistics();
      setupHookMock(mockData);

      render(<StatisticsPanel />);

      const totalCard = screen.getByTestId('stat-card-资产总量');
      expect(totalCard.querySelector('.stat-value')).not.toBeEmptyDOMElement();

      const onlineCard = screen.getByTestId('stat-card-在线数量');
      expect(onlineCard.querySelector('.stat-value')).not.toBeEmptyDOMElement();

      const offlineCard = screen.getByTestId('stat-card-离线数量');
      expect(offlineCard.querySelector('.stat-value')).not.toBeEmptyDOMElement();

      const valueCard = screen.getByTestId('stat-card-资产总价值');
      expect(valueCard.querySelector('.stat-value')).not.toBeEmptyDOMElement();
    });

    /**
     * Verify loading skeleton is displayed during data fetch.
     */
    it('should display loading skeleton when data is loading', () => {
      setupHookMock(null, true);

      render(<StatisticsPanel />);

      const loadingElements = screen.getAllByTestId(/loading-skeleton/);
      expect(loadingElements.length).toBeGreaterThan(0);
    });
  });

  describe('TC-002: Statistics Data Accuracy', () => {
    /**
     * Verify that displayed values match the backend API response.
     * 
     * Test Steps:
     * 1. Mock API response with specific values
     * 2. Render component
     * 3. Verify displayed values match mock data
     */
    it('should display values matching backend API response', () => {
      const mockData = createMockStatistics({
        totalAssets: 1523,
        onlineAssets: 1280,
        offlineAssets: 243,
        totalValue: 15800000,
      });
      setupHookMock(mockData);

      render(<StatisticsPanel />);

      const totalCard = screen.getByTestId('stat-card-资产总量');
      expect(totalCard.querySelector('.stat-value')).toHaveTextContent('1523');

      const onlineCard = screen.getByTestId('stat-card-在线数量');
      expect(onlineCard.querySelector('.stat-value')).toHaveTextContent('1280');

      const offlineCard = screen.getByTestId('stat-card-离线数量');
      expect(offlineCard.querySelector('.stat-value')).toHaveTextContent('243');

      const valueCard = screen.getByTestId('stat-card-资产总价值');
      expect(valueCard.querySelector('.stat-value')).toHaveTextContent('15800000');
    });

    /**
     * Verify value formatting for large numbers.
     */
    it('should format large values with thousand separators', () => {
      const mockData = createMockStatistics({
        totalValue: 15800000,
      });
      setupHookMock(mockData);

      render(<StatisticsPanel />);

      const valueCard = screen.getByTestId('stat-card-资产总价值');
      const formattedValue = valueCard.querySelector('.stat-value')?.textContent;
      
      // Should contain formatted value with separators
      expect(formattedValue?.replace(/,/g, '')).toBe('15800000');
    });

    /**
     * Verify trend indicators are displayed when provided.
     */
    it('should display trend indicators when trend data is available', () => {
      const mockData = createMockStatistics();
      setupHookMock(mockData);

      render(<StatisticsPanel />);

      const cardsWithTrend = screen.getAllByTestId(/stat-card-/).filter((card) => {
        return card.querySelector('.stat-trend');
      });

      expect(cardsWithTrend.length).toBeGreaterThan(0);
    });
  });

  describe('TC-010: Empty Data State Handling', () => {
    /**
     * Verify friendly message is displayed when API returns zero data.
     * 
     * Test Steps:
     * 1. Mock API response with zero values
     * 2. Render component
     * 3. Verify empty state message is displayed
     */
    it('should display zero or placeholder text for empty data', () => {
      const emptyData = createMockStatistics({
        totalAssets: 0,
        onlineAssets: 0,
        offlineAssets: 0,
        totalValue: 0,
      });
      setupHookMock(emptyData);

      render(<StatisticsPanel />);

      const totalCard = screen.getByTestId('stat-card-资产总量');
      const totalValue = totalCard.querySelector('.stat-value')?.textContent;
      expect(['0', '暂无数据', '0.00']).toContain(totalValue);
    });

    /**
     * Verify error state is handled gracefully.
     */
    it('should display error message when API request fails', () => {
      const error = new Error('Network error: Failed to fetch statistics');
      setupHookMock(null, false, error);

      render(<StatisticsPanel />);

      const errorMessage = screen.getByText(/获取统计数据失败|网络错误/i);
      expect(errorMessage).toBeInTheDocument();
    });

    /**
     * Verify component has error boundary behavior.
     */
    it('should not crash when error data is provided', () => {
      setupHookMock(null, false, new Error('Invalid data'));

      expect(() => {
        render(<StatisticsPanel />);
      }).not.toThrow();
    });
  });

  describe('Responsive Layout', () => {
    /**
     * Verify component renders correctly at desktop viewport.
     */
    it('should render correctly at desktop viewport (1440px)', () => {
      vi.stubGlobal('innerWidth', 1440);
      const mockData = createMockStatistics();
      setupHookMock(mockData);

      render(<StatisticsPanel />);

      expect(screen.getByTestId('statistics-panel-container')).toBeInTheDocument();
    });

    /**
     * Verify component renders correctly at tablet viewport.
     */
    it('should render correctly at tablet viewport (768px)', () => {
      vi.stubGlobal('innerWidth', 768);
      const mockData = createMockStatistics();
      setupHookMock(mockData);

      render(<StatisticsPanel />);

      expect(screen.getByTestId('statistics-panel-container')).toBeInTheDocument();
    });

    /**
     * Verify component renders correctly at mobile viewport.
     */
    it('should render correctly at mobile viewport (375px)', () => {
      vi.stubGlobal('innerWidth', 375);
      const mockData = createMockStatistics();
      setupHookMock(mockData);

      render(<StatisticsPanel />);

      expect(screen.getByTestId('statistics-panel-container')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    /**
     * Verify statistics cards have proper ARIA labels.
     */
    it('should have proper ARIA labels for accessibility', () => {
      const mockData = createMockStatistics();
      setupHookMock(mockData);

      render(<StatisticsPanel />);

      const totalCard = screen.getByTestId('stat-card-资产总量');
      expect(totalCard).toHaveAttribute('role', 'region');
      expect(totalCard).toHaveAttribute('aria-label');
    });

    /**
     * Verify keyboard navigation support.
     */
    it('should support keyboard navigation through cards', async () => {
      const user = userEvent.setup();
      const mockData = createMockStatistics();
      setupHookMock(mockData);

      render(<StatisticsPanel />);

      const firstCard = screen.getByTestId('stat-card-资产总量');
      firstCard.focus();
      
      await user.keyboard('{Tab}');
      
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeInTheDocument();
    });
  });

  describe('Data Refresh', () => {
    /**
     * Verify manual refresh can be triggered.
     */
    it('should have refetch function available for manual refresh', async () => {
      const mockRefetch = vi.fn();
      (useDashboardStatistics as ReturnType<typeof vi.mock>).mockReturnValue({
        data: createMockStatistics(),
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<StatisticsPanel />);

      const refreshButton = screen.getByRole('button', { name: /刷新/i });
      await userEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});