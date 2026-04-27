/**
 * useDepreciation Hook
 * 
 * Provides depreciation calculation and asset value tracking functionality.
 * Used for depreciation reports and asset valuation in the work order context.
 * 
 * @module hooks/useDepreciation
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { depreciationService } from '../services/depreciationService';
import type { DepreciationRecord, DepreciationSummary } from '../types/depreciation.types';

/**
 * Asset depreciation state interface
 */
interface UseDepreciationState {
  records: DepreciationRecord[];
  summary: DepreciationSummary | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Configuration options for depreciation calculation
 */
interface UseDepreciationOptions {
  /** Asset ID to calculate depreciation for */
  assetId?: string;
  /** Start date for depreciation period */
  startDate?: string;
  /** End date for depreciation period */
  endDate?: string;
  /** Auto-fetch on mount */
  autoFetch?: boolean;
}

/**
 * Hook return type
 */
interface UseDepreciationReturn extends UseDepreciationState {
  /** Fetch depreciation records */
  fetchDepreciation: (assetId: string) => Promise<void>;
  /** Refresh current records */
  refresh: () => Promise<void>;
  /** Clear all records and reset state */
  clear: () => void;
  /** Calculate monthly depreciation */
  calculateMonthlyDepreciation: (assetId: string, months: number) => Promise<number>;
  /** Get accumulated depreciation value */
  getAccumulatedDepreciation: (assetId: string) => Promise<number>;
}

/**
 * useDepreciation Hook
 * 
 * Provides functionality for calculating and retrieving asset depreciation records.
 * Supports automatic fetching on mount and manual refresh capabilities.
 * 
 * @param options - Configuration options for the hook
 * @returns Object containing depreciation state and control functions
 * 
 * @example
 * ```typescript
 * const { records, summary, fetchDepreciation, refresh } = useDepreciation({
 *   assetId: 'asset-123',
 *   autoFetch: true
 * });
 * ```
 */
export function useDepreciation(options: UseDepreciationOptions = {}): UseDepreciationReturn {
  const { assetId, startDate, endDate, autoFetch = false } = options;

  const [records, setRecords] = useState<DepreciationRecord[]>([]);
  const [summary, setSummary] = useState<DepreciationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch depreciation records for a specific asset
   * 
   * @param id - Asset ID to fetch depreciation for
   */
  const fetchDepreciation = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await depreciationService.getDepreciationRecords(id, {
        startDate,
        endDate,
      });
      setRecords(response.records);
      setSummary(response.summary);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch depreciation');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  /**
   * Refresh the current depreciation records
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (assetId) {
      await fetchDepreciation(assetId);
    }
  }, [assetId, fetchDepreciation]);

  /**
   * Clear all records and reset state
   */
  const clear = useCallback((): void => {
    setRecords([]);
    setSummary(null);
    setError(null);
  }, []);

  /**
   * Calculate monthly depreciation for an asset
   * 
   * @param id - Asset ID
   * @param months - Number of months to calculate
   * @returns Monthly depreciation amount
   */
  const calculateMonthlyDepreciation = useCallback(
    async (id: string, months: number): Promise<number> => {
      try {
        return await depreciationService.calculateMonthlyDepreciation(id, months);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to calculate depreciation');
        setError(error);
        throw error;
      }
    },
    []
  );

  /**
   * Get accumulated depreciation value for an asset
   * 
   * @param id - Asset ID
   * @returns Accumulated depreciation amount
   */
  const getAccumulatedDepreciation = useCallback(async (id: string): Promise<number> => {
    try {
      return await depreciationService.getAccumulatedDepreciation(id);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get accumulated depreciation');
      setError(error);
      throw error;
    }
  }, []);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && assetId) {
      fetchDepreciation(assetId);
    }
  }, [autoFetch, assetId, fetchDepreciation]);

  // Memoized return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      records,
      summary,
      isLoading,
      error,
      fetchDepreciation,
      refresh,
      clear,
      calculateMonthlyDepreciation,
      getAccumulatedDepreciation,
    }),
    [
      records,
      summary,
      isLoading,
      error,
      fetchDepreciation,
      refresh,
      clear,
      calculateMonthlyDepreciation,
      getAccumulatedDepreciation,
    ]
  );
}

export type { UseDepreciationOptions, UseDepreciationReturn, UseDepreciationState };