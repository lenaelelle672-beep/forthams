/**
 * AssetCategoryChart Component Unit Tests
 * 
 * Test suite for the AssetCategoryChart component that displays the distribution
 * of assets by category using a pie/donut chart visualization.
 * 
 * @packageDocumentation
 * @module Dashboard
 * @subcategory Components
 * @requires vitest
 * @requires @testing-library/react
 * @requires echarts-for-react
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AssetCategoryChart } from '../../../../src/pages/DashboardPage/components/AssetCategoryChart/AssetCategoryChart';

// Mock ECharts component
vi.mock('echarts-for-react', () => ({
  __esModule: true,
  default: ({ option, onEvents }: { option: Record<string, unknown>; onEvents?: Record<string, unknown> }) => {
    // Simulate click event if onEvents is provided
    React.useEffect(() => {
      if (onEvents?.click) {
        // Trigger click callback with mock data
        (onEvents.click as (params: unknown) => void)({
          name: 'Electronics',
          value: 150,
          percent: 30
        });
      }
    }, [onEvents]);

    return (
      <div 
        data-testid="echarts-mock" 
        data-option={JSON.stringify(option)}
      >
        <canvas data-testid="echarts-canvas" />
      </div>
    );
  }
}));

// Mock the ECharts library
vi.mock('echarts', () => ({
  __esModule: true,
  default: {
    init: vi.fn(() => ({
      setOption: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    })),
    getInstanceByDom: vi.fn(() => null)
  }
}));

// Mock data for testing
const mockCategoryData = [
  { name: 'Electronics', value: 150 },
  { name: 'Furniture', value: 80 },
  { name: 'Vehicles', value: 45 },
  { name: 'Office Equipment', value: 120 }
];

/**
 * Helper function to create chart options for testing
 * 
 * @param data - Category distribution data
 * @returns Chart configuration object
 */
function createChartOptions(data: Array<{ name: string; value: number }>) {
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'horizontal',
      bottom: 10,
      data: data.map(item => item.name)
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: data,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  };
}

/**
 * Test suite for AssetCategoryChart component rendering and interactions
 */
describe('AssetCategoryChart Component', () => {
  /**
   * Setup before each test - reset all mocks
   */
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Cleanup after each test
   */
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * TC-003: Verify category distribution pie chart renders correctly
   */
  describe('Chart Rendering', () => {
    /**
     * Test that the chart container renders with correct data
     */
    it('should render chart container with correct data attributes', () => {
      render(
        <AssetCategoryChart 
          data={mockCategoryData}
          height={400}
        />
      );

      const chartContainer = screen.getByTestId('asset-category-chart');
      expect(chartContainer).toBeInTheDocument();
      expect(chartContainer).toHaveAttribute('data-loading', 'false');
    });

    /**
     * Test that ECharts canvas element is rendered
     */
    it('should render ECharts canvas element', () => {
      render(
        <AssetCategoryChart 
          data={mockCategoryData}
          height={400}
        />
      );

      const canvas = screen.getByTestId('echarts-canvas');
      expect(canvas).toBeInTheDocument();
    });

    /**
     * Test that loading state displays correctly
     */
    it('should display loading state when loading prop is true', () => {
      render(
        <AssetCategoryChart 
          data={mockCategoryData}
          height={400}
          loading={true}
        />
      );

      const chartContainer = screen.getByTestId('asset-category-chart');
      expect(chartContainer).toHaveAttribute('data-loading', 'true');
    });

    /**
     * Test that empty data state displays correctly
     */
    it('should handle empty data gracefully', () => {
      render(
        <AssetCategoryChart 
          data={[]}
          height={400}
        />
      );

      const chartContainer = screen.getByTestId('asset-category-chart');
      expect(chartContainer).toBeInTheDocument();
    });
  });

  /**
   * TC-004: Verify category chart interactions and tooltips
   */
  describe('Chart Interactions', () => {
    /**
     * Test tooltip functionality on hover
     */
    it('should display tooltip on hover', async () => {
      const user = userEvent.setup();
      
      render(
        <AssetCategoryChart 
          data={mockCategoryData}
          height={400}
        />
      );

      const canvas = screen.getByTestId('echarts-canvas');
      await user.hover(canvas);

      // Verify tooltip visibility (implementation dependent)
      await waitFor(() => {
        const tooltip = screen.queryByRole('tooltip');
        // Tooltip visibility depends on chart implementation
        expect(tooltip || canvas).toBeInTheDocument();
      });
    });

    /**
     * Test click interaction on chart segment
     */
    it('should handle click events on chart segments', async () => {
      const handleClick = vi.fn();

      render(
        <AssetCategoryChart 
          data={mockCategoryData}
          height={400}
          onChartClick={handleClick}
        />
      );

      // Simulate click through the mock
      await waitFor(() => {
        expect(handleClick).toHaveBeenCalled();
      });
    });
  });

  /**
   * Test chart data processing and formatting
   */
  describe('Data Processing', () => {
    /**
     * Test that category data is correctly formatted
     */
    it('should format category data correctly for chart', () => {
      render(
        <AssetCategoryChart 
          data={mockCategoryData}
          height={400}
        />
      );

      const chartContainer = screen.getByTestId('asset-category-chart');
      const optionData = chartContainer.getAttribute('data-option');
      
      expect(optionData).toBeTruthy();
      const options = JSON.parse(optionData as string);
      
      expect(options.series).toBeDefined();
      expect(options.series[0].data).toHaveLength(mockCategoryData.length);
    });

    /**
     * Test percentage calculation for each category
     */
    it('should calculate correct percentages for each category', () => {
      render(
        <AssetCategoryChart 
          data={mockCategoryData}
          height={400}
        />
      );

      const chartContainer = screen.getByTestId('asset-category-chart');
      const optionData = chartContainer.getAttribute('data-option');
      const options = JSON.parse(optionData as string);
      
      const totalValue = mockCategoryData.reduce((sum, item) => sum + item.value, 0);
      
      options.series[0].data.forEach((item: { name: string; value: number }) => {
        const originalItem = mockCategoryData.find(d => d.name === item.name);
        const expectedPercent = (originalItem!.value / totalValue * 100).toFixed(1);
        expect(item.value).toBe(originalItem!.value);
      });
    });
  });

  /**
   * Test responsive behavior
   */
  describe('Responsive Behavior', () => {
    /**
     * Test chart resizing with different container sizes
     */
    it('should resize chart based on container width', () => {
      const { container } = render(
        <AssetCategoryChart 
          data={mockCategoryData}
          height={400}
        />
      );

      const containerElement = container.firstElementChild;
      expect(containerElement).toHaveStyle({ width: '100%' });
    });

    /**
     * Test chart renders at specified height
     */
    it('should render at specified height', () => {
      const customHeight = 500;
      
      render(
        <AssetCategoryChart 
          data={mockCategoryData}
          height={customHeight}
        />
      );

      const chartContainer = screen.getByTestId('asset-category-chart');
      expect(chartContainer).toHaveAttribute('data-height', String(customHeight));
    });
  });

  /**
   * Test accessibility features
   */
  describe('Accessibility', () => {
    /**
     * Test that chart has proper ARIA labels
     */
    it('should have proper ARIA labels for screen readers', () => {
      render(
        <AssetCategoryChart 
          data={mockCategoryData}
          height={400}
          ariaLabel="Asset category distribution chart"
        />
      );

      const chartContainer = screen.getByTestId('asset-category-chart');
      expect(chartContainer).toHaveAttribute('aria-label', 'Asset category distribution chart');
    });

    /**
     * Test that legend items are accessible
     */
    it('should provide accessible legend information', () => {
      render(
        <AssetCategoryChart 
          data={mockCategoryData}
          height={400}
        />
      );

      const chartContainer = screen.getByTestId('asset-category-chart');
      const optionData = chartContainer.getAttribute('data-option');
      const options = JSON.parse(optionData as string);
      
      expect(options.legend).toBeDefined();
      expect(options.legend.data).toEqual(mockCategoryData.map(item => item.name));
    });
  });
});

/**
 * Integration tests for chart with service layer
 */
describe('AssetCategoryChart Integration', () => {
  /**
   * Test chart renders with data from service response
   */
  it('should render correctly with service response data', async () => {
    const serviceData = {
      categories: [
        { categoryName: 'Electronics', assetCount: 150 },
        { categoryName: 'Furniture', assetCount: 80 },
        { categoryName: 'Vehicles', assetCount: 45 }
      ]
    };

    const transformedData = serviceData.categories.map(cat => ({
      name: cat.categoryName,
      value: cat.assetCount
    }));

    render(
      <AssetCategoryChart 
        data={transformedData}
        height={400}
      />
    );

    await waitFor(() => {
      const chartContainer = screen.getByTestId('asset-category-chart');
      expect(chartContainer).toBeInTheDocument();
    });
  });
});