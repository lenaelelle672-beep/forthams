/**
 * DepreciationCard Component Tests
 * 
 * @file DepreciationCard.test.tsx
 * @description 资产折旧信息卡片组件的单元测试
 * 
 * 测试覆盖范围:
 * - ATB-004-01: 直线法折旧展示
 * - ATB-004-02: 双倍余额递减法展示
 * - ATB-004-03: 账面净值展示
 * - ATB-004-04: 加载状态
 * - ATB-004-05: 错误状态
 * 
 * @module SWARM-002-Iteration1
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { DepreciationCard } from '@components/depreciation/DepreciationCard';
import { useDepreciation } from '@hooks/useDepreciation';

// Mock the useDepreciation hook
jest.mock('@hooks/useDepreciation');

// Type definitions for test data
interface DepreciationData {
  assetId: number;
  method: 'straight_line' | 'double_declining';
  currentDepreciation: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  annualDepreciation: number;
  monthlyDepreciation: number;
  depreciationRate?: number;
  referenceDate: string;
}

interface UseDepreciationMock {
  data: DepreciationData | null;
  loading: boolean;
  error: Error | null;
}

describe('DepreciationCard Component', () => {
  const mockAssetId = 1;
  const baseDepreciationData: DepreciationData = {
    assetId: 1,
    method: 'straight_line',
    currentDepreciation: 792.50,
    accumulatedDepreciation: 9500.00,
    netBookValue: 90500.00,
    annualDepreciation: 9510.00,
    monthlyDepreciation: 792.50,
    referenceDate: '2024-06-30',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * ATB-004-01: 直线法折旧展示
   * 验证直线法折旧方法的正确显示
   */
  describe('ATB-004-01: 直线法折旧展示', () => {
    test('应正确显示直线法标签、月折旧额、累计折旧', async () => {
      // Arrange
      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: baseDepreciationData,
        loading: false,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('直线法')).toBeInTheDocument();
        expect(screen.getByText(/月折旧额.*792\.50/)).toBeInTheDocument();
        expect(screen.getByText(/累计折旧.*9,500\.00/)).toBeInTheDocument();
      });
    });

    test('应正确显示账面净值', async () => {
      // Arrange
      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: baseDepreciationData,
        loading: false,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/账面净值.*90,500\.00/)).toBeInTheDocument();
      });
    });

    test('应正确显示年折旧额', async () => {
      // Arrange
      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: baseDepreciationData,
        loading: false,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/年折旧额.*9,510\.00/)).toBeInTheDocument();
      });
    });
  });

  /**
   * ATB-004-02: 双倍余额递减法展示
   * 验证DDB折旧方法的正确显示
   */
  describe('ATB-004-02: 双倍余额递减法展示', () => {
    test('应正确显示双倍余额递减法标签和当前折旧率', async () => {
      // Arrange
      const ddbData: DepreciationData = {
        assetId: 1,
        method: 'double_declining',
        currentDepreciation: 40000.00,
        accumulatedDepreciation: 40000.00,
        netBookValue: 60000.00,
        annualDepreciation: 40000.00,
        monthlyDepreciation: 3333.33,
        depreciationRate: 0.40,
        referenceDate: '2024-12-31',
      };

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: ddbData,
        loading: false,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('双倍余额递减法')).toBeInTheDocument();
        expect(screen.getByText(/折旧率.*40\.00%/)).toBeInTheDocument();
      });
    });

    test('应正确显示DDB法下的年折旧额', async () => {
      // Arrange
      const ddbData: DepreciationData = {
        assetId: 1,
        method: 'double_declining',
        currentDepreciation: 40000.00,
        accumulatedDepreciation: 40000.00,
        netBookValue: 60000.00,
        annualDepreciation: 40000.00,
        monthlyDepreciation: 3333.33,
        depreciationRate: 0.40,
        referenceDate: '2024-12-31',
      };

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: ddbData,
        loading: false,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/年折旧额.*40,000\.00/)).toBeInTheDocument();
      });
    });

    test('应正确显示DDB法下的账面净值', async () => {
      // Arrange
      const ddbData: DepreciationData = {
        assetId: 1,
        method: 'double_declining',
        currentDepreciation: 40000.00,
        accumulatedDepreciation: 40000.00,
        netBookValue: 60000.00,
        annualDepreciation: 40000.00,
        monthlyDepreciation: 3333.33,
        depreciationRate: 0.40,
        referenceDate: '2024-12-31',
      };

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: ddbData,
        loading: false,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/账面净值.*60,000\.00/)).toBeInTheDocument();
      });
    });
  });

  /**
   * ATB-004-03: 账面净值展示
   * 验证账面净值在任何折旧方法下都能正确展示
   */
  describe('ATB-004-03: 账面净值展示', () => {
    test('直线法下应显示账面净值', async () => {
      // Arrange
      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: baseDepreciationData,
        loading: false,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        const netBookValueElement = screen.getByTestId('net-book-value');
        expect(netBookValueElement).toHaveTextContent('90,500.00');
      });
    });

    test('DDB法下应显示账面净值', async () => {
      // Arrange
      const ddbData: DepreciationData = {
        assetId: 1,
        method: 'double_declining',
        currentDepreciation: 40000.00,
        accumulatedDepreciation: 40000.00,
        netBookValue: 60000.00,
        annualDepreciation: 40000.00,
        monthlyDepreciation: 3333.33,
        depreciationRate: 0.40,
        referenceDate: '2024-12-31',
      };

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: ddbData,
        loading: false,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        const netBookValueElement = screen.getByTestId('net-book-value');
        expect(netBookValueElement).toHaveTextContent('60,000.00');
      });
    });

    test('账面净值不应低于残值', async () => {
      // Arrange
      const assetAtEndOfLife: DepreciationData = {
        assetId: 1,
        method: 'straight_line',
        currentDepreciation: 0,
        accumulatedDepreciation: 95000.00,
        netBookValue: 5000.00, // 等于残值
        annualDepreciation: 0,
        monthlyDepreciation: 0,
        referenceDate: '2034-01-01', // 10年后
      };

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: assetAtEndOfLife,
        loading: false,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        const netBookValueElement = screen.getByTestId('net-book-value');
        expect(netBookValueElement).toHaveTextContent('5,000.00');
      });
    });
  });

  /**
   * ATB-004-04: 加载状态
   * 验证API请求过程中的加载指示器显示
   */
  describe('ATB-004-04: 加载状态', () => {
    test('应显示骨架屏或加载指示器', async () => {
      // Arrange
      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: null,
        loading: true,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      const loadingElement = screen.getByTestId('depreciation-loading');
      expect(loadingElement).toBeInTheDocument();
    });

    test('加载状态下不应显示数据', async () => {
      // Arrange
      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: null,
        loading: true,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      expect(screen.queryByTestId('depreciation-content')).not.toBeInTheDocument();
    });

    test('加载完成后应隐藏加载指示器', async () => {
      // Arrange
      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      
      // 初始加载状态
      mockUseDepreciation.mockReturnValue({
        data: null,
        loading: true,
        error: null,
      });

      const { rerender } = render(<DepreciationCard assetId={mockAssetId} />);

      // Act - 模拟数据加载完成
      mockUseDepreciation.mockReturnValue({
        data: baseDepreciationData,
        loading: false,
        error: null,
      });

      rerender(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        expect(screen.queryByTestId('depreciation-loading')).not.toBeInTheDocument();
        expect(screen.getByTestId('depreciation-content')).toBeInTheDocument();
      });
    });
  });

  /**
   * ATB-004-05: 错误状态
   * 验证API返回错误时的错误提示显示
   */
  describe('ATB-004-05: 错误状态', () => {
    test('API返回500时应显示错误提示', async () => {
      // Arrange
      const error = new Error('服务器内部错误');
      (error as any).status = 500;

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: null,
        loading: false,
        error: error,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        const errorElement = screen.getByTestId('depreciation-error');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement).toHaveTextContent(/服务器内部错误/i);
      });
    });

    test('错误状态下不应崩溃', async () => {
      // Arrange
      const error = new Error('Network error');

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: null,
        loading: false,
        error: error,
      });

      // Act & Assert - 不应抛出异常
      expect(() => {
        render(<DepreciationCard assetId={mockAssetId} />);
      }).not.toThrow();
    });

    test('资产不存在时应显示404错误', async () => {
      // Arrange
      const error = new Error('资产不存在');
      (error as any).status = 404;

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: null,
        loading: false,
        error: error,
      });

      // Act
      render(<DepreciationCard assetId={999} />);

      // Assert
      await waitFor(() => {
        const errorElement = screen.getByTestId('depreciation-error');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement).toHaveTextContent(/资产不存在/i);
      });
    });

    test('无效折旧方法时应显示验证错误', async () => {
      // Arrange
      const error = new Error('无效的折旧方法');
      (error as any).status = 422;

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: null,
        loading: false,
        error: error,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} method="invalid" />);

      // Assert
      await waitFor(() => {
        const errorElement = screen.getByTestId('depreciation-error');
        expect(errorElement).toBeInTheDocument();
      });
    });

    test('错误状态下不应显示数据内容', async () => {
      // Arrange
      const error = new Error('Some error');

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: null,
        loading: false,
        error: error,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      expect(screen.queryByTestId('depreciation-content')).not.toBeInTheDocument();
    });
  });

  /**
   * 数据一致性验证
   * 验证前端展示数据与API返回数据完全一致
   */
  describe('数据一致性验证', () => {
    test('前端显示值应与API返回值完全匹配', async () => {
      // Arrange
      const preciseData: DepreciationData = {
        assetId: 1,
        method: 'straight_line',
        currentDepreciation: 792.50,
        accumulatedDepreciation: 9500.00,
        netBookValue: 90500.00,
        annualDepreciation: 9510.00,
        monthlyDepreciation: 792.50,
        referenceDate: '2024-06-30',
      };

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: preciseData,
        loading: false,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert - 验证数值精度保留2位小数
      await waitFor(() => {
        expect(screen.getByText('792.50')).toBeInTheDocument(); // 月折旧额
        expect(screen.getByText('9,500.00')).toBeInTheDocument(); // 累计折旧
        expect(screen.getByText('90,500.00')).toBeInTheDocument(); // 账面净值
      });
    });

    test('刷新后数据应无变化', async () => {
      // Arrange
      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: baseDepreciationData,
        loading: false,
        error: null,
      });

      const { container } = render(<DepreciationCard assetId={mockAssetId} />);

      // Act - 获取初始渲染内容
      await waitFor(() => {
        expect(screen.getByTestId('depreciation-content')).toBeInTheDocument();
      });

      const initialContent = container.innerHTML;

      // Assert - 重新渲染后内容应一致
      const { container: reRenderedContainer } = render(<DepreciationCard assetId={mockAssetId} />);
      expect(reRenderedContainer.innerHTML).toBe(initialContent);
    });
  });

  /**
   * 边界条件测试
   */
  describe('边界条件测试', () => {
    test('资产购置当月累计折旧应为0', async () => {
      // Arrange
      const newAssetData: DepreciationData = {
        assetId: 1,
        method: 'straight_line',
        currentDepreciation: 0,
        accumulatedDepreciation: 0,
        netBookValue: 100000.00,
        annualDepreciation: 9510.00,
        monthlyDepreciation: 792.50,
        referenceDate: '2024-01-01', // 购置当月
      };

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: newAssetData,
        loading: false,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/累计折旧.*0\.00/)).toBeInTheDocument();
      });
    });

    test('资产寿命到期时净值应等于残值', async () => {
      // Arrange
      const endOfLifeData: DepreciationData = {
        assetId: 1,
        method: 'straight_line',
        currentDepreciation: 0,
        accumulatedDepreciation: 95000.00,
        netBookValue: 5000.00, // 残值
        annualDepreciation: 0,
        monthlyDepreciation: 0,
        referenceDate: '2034-01-01', // 10年后
      };

      const mockUseDepreciation = useDepreciation as jest.MockedFunction<typeof useDepreciation>;
      mockUseDepreciation.mockReturnValue({
        data: endOfLifeData,
        loading: false,
        error: null,
      });

      // Act
      render(<DepreciationCard assetId={mockAssetId} />);

      // Assert
      await waitFor(() => {
        const netBookValueElement = screen.getByTestId('net-book-value');
        expect(netBookValueElement).toHaveTextContent('5,000.00');
        expect(netBookValueElement).toHaveTextContent(/残值/i);
      });
    });
  });
});