/**
 * Memory Index for Unit Tests
 * 
 * This module re-exports all unit test modules for方便批量导入
 * and provides test utilities for the asset management system.
 * 
 * @module tests/unit/memory
 * @version 1.0.0
 */

// Re-export all unit test modules
export * from './auditService.test';
export * from './auditableBinding.test';
export * from './auditLog.test';

/**
 * Test utilities for mocking backend API responses
 */
export const mockApiResponses = {
  asset: {
    id: 'AST-2024-001',
    name: '测试资产',
    originalValue: 120000,
    salvageValue: 0,
    usefulLifeYears: 10,
    acquisitionDate: '2024-01-15',
    depreciationMethod: 'straight_line' as const,
  },
  depreciation: {
    assetId: 'AST-2024-001',
    periodYear: 2024,
    periodMonth: 1,
    depreciationAmount: 1000,
    accumulatedDepreciation: 1000,
    bookValue: 119000,
    calculationMethod: 'straight_line',
  },
};

/**
 * Helper function to create mock depreciation data
 * 
 * @param overrides - Partial override values for mock data
 * @returns Mocked depreciation record
 * 
 * @example
 * ```typescript
 * const mock = createMockDepreciationRecord({
 *   depreciationAmount: 2000,
 * });
 * ```
 */
export function createMockDepreciationRecord(
  overrides: Partial<typeof mockApiResponses.depreciation> = {}
) {
  return {
    ...mockApiResponses.depreciation,
    ...overrides,
  };
}

/**
 * Helper function to create mock asset data with depreciation info
 * 
 * @param overrides - Partial override values for mock data
 * @returns Mocked asset with depreciation info
 * 
 * @example
 * ```typescript
 * const asset = createMockAssetWithDepreciation({
 *   originalValue: 50000,
 *   salvageValue: 5000,
 * });
 * ```
 */
export function createMockAssetWithDepreciation(
  overrides: Partial<typeof mockApiResponses.asset> = {}
) {
  return {
    ...mockApiResponses.asset,
    ...overrides,
  };
}

/**
 * Straight-line depreciation calculator utility for tests
 * 
 * @param originalValue - Original asset value
 * @param salvageValue - Salvage value at end of useful life
 * @param usefulLifeYears - Expected useful life in years
 * @param currentMonth - Current month number (1-12)
 * @returns Monthly depreciation amount
 * 
 * @example
 * ```typescript
 * const monthlyDep = calculateStraightLineMonthly(120000, 0, 10, 1);
 * // Returns: 1000
 * ```
 */
export function calculateStraightLineMonthly(
  originalValue: number,
  salvageValue: number,
  usefulLifeYears: number,
  currentMonth: number
): number {
  const depreciableAmount = originalValue - salvageValue;
  const totalMonths = usefulLifeYears * 12;
  
  if (currentMonth > totalMonths) {
    return 0;
  }
  
  return Math.round((depreciableAmount / totalMonths) * 100) / 100;
}

/**
 * Double declining balance depreciation calculator utility for tests
 * 
 * @param bookValue - Current book value of the asset
 * @param usefulLifeYears - Expected useful life in years
 * @param currentYear - Current year of calculation (1-indexed)
 * @returns Yearly depreciation amount
 * 
 * @example
 * ```typescript
 * const yearlyDep = calculateDoubleDecliningYearly(120000, 10, 1);
 * // Returns: 24000
 * ```
 */
export function calculateDoubleDecliningYearly(
  bookValue: number,
  usefulLifeYears: number,
  currentYear: number
): number {
  const rate = 2 / usefulLifeYears;
  return Math.round(bookValue * rate * 100) / 100;
}

/**
 * Test suite configuration for depreciation tests
 */
export const depreciationTestConfig = {
  precision: 2,
  roundingMode: 'HALF_UP' as const,
  maxIterations: 120, // 10 years * 12 months
  allowedMethods: ['straight_line', 'double_declining'] as const,
};