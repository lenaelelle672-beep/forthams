import { useMemo, useCallback, useState } from 'react';
import type { IAssetItem } from '@/types/inventory.types';
import { submitInventoryApproval } from '../services/inventoryDetailApi';

/**
 * Represents a single surplus (盘盈) or shortage (盘亏) diff record,
 * derived from comparing book records against actual inventory counts.
 */
export interface IDiffRecord {
  /** Unique asset identifier */
  assetId: string;
  /** Asset code for display in diff summary table */
  assetCode: string;
  /** Asset name for display */
  assetName: string;
  /** Asset category name */
  category?: string;
  /** Location name where the asset is stored */
  locationName?: string;
  /** Diff category: surplus (盘盈, actual > book) or shortage (盘亏, actual < book) */
  diffType: 'surplus' | 'shortage';
  /** Quantity recorded in the book (账面数量) */
  bookQuantity: number;
  /** Actual counted quantity (实盘数量) */
  actualQuantity: number;
  /** Absolute difference quantity (|actual - book|) */
  diffQuantity: number;
}

/**
 * Aggregated diff summary containing categorized record lists and statistics.
 * Used by the bottom panel in InventoryDetail to render the diff summary table.
 */
export interface IDiffSummaryResult {
  /** All diff records combined (surplus items first, then shortage items) */
  diffRecords: IDiffRecord[];
  /** Records where actual quantity exceeds book quantity (盘盈) */
  surplusItems: IDiffRecord[];
  /** Records where actual quantity is less than book quantity (盘亏) */
  shortageItems: IDiffRecord[];
  /** Count of surplus line items */
  surplusCount: number;
  /** Count of shortage line items */
  shortageCount: number;
  /** Sum of surplus quantities across all surplus items */
  surplusTotalQuantity: number;
  /** Sum of shortage quantities across all shortage items */
  shortageTotalQuantity: number;
  /** Whether any differences exist between book and actual records */
  hasDiff: boolean;
}

/**
 * Hook to compute inventory difference summary and manage approval submission.
 *
 * Filters assets into surplus (盘盈: actual > book) and shortage (盘亏: actual < book)
 * categories by comparing book quantities against actual counted quantities.
 * Implements ATB-05 requirement: bottom panel diff filtering, summary aggregation,
 * and one-click approval submission (POST /api/inventory/approve).
 *
 * Performance: Uses single-pass O(n) computation with useMemo to satisfy the
 * constraint of rendering >200 asset items without noticeable lag (FPS > 30).
 *
 * @param assets - List of asset items with bookQuantity and actualQuantity fields
 * @returns Diff summary result with categorized records, statistics, and submit callback
 */
export function useDiffSummary(assets: IAssetItem[]) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Compute diff records by comparing book vs actual quantities in a single pass.
   * Assets with diff === 0 (matched) are excluded from the result.
   */
  const diffSummary = useMemo<IDiffSummaryResult>(() => {
    if (!assets || assets.length === 0) {
      return {
        diffRecords: [],
        surplusItems: [],
        shortageItems: [],
        surplusCount: 0,
        shortageCount: 0,
        surplusTotalQuantity: 0,
        shortageTotalQuantity: 0,
        hasDiff: false,
      };
    }

    const surplusItems: IDiffRecord[] = [];
    const shortageItems: IDiffRecord[] = [];

    for (const asset of assets) {
      const bookQty = asset.bookQuantity ?? 0;
      const actualQty = asset.actualQuantity ?? 0;
      const diff = actualQty - bookQty;

      if (diff > 0) {
        // Surplus: actual > book (盘盈), includes "账面无，实盘有" case
        surplusItems.push({
          assetId: asset.id,
          assetCode: asset.assetCode,
          assetName: asset.name,
          category: asset.category,
          locationName: asset.locationName,
          diffType: 'surplus',
          bookQuantity: bookQty,
          actualQuantity: actualQty,
          diffQuantity: diff,
        });
      } else if (diff < 0) {
        // Shortage: actual < book (盘亏), includes "账面有，实盘无" case
        shortageItems.push({
          assetId: asset.id,
          assetCode: asset.assetCode,
          assetName: asset.name,
          category: asset.category,
          locationName: asset.locationName,
          diffType: 'shortage',
          bookQuantity: bookQty,
          actualQuantity: actualQty,
          diffQuantity: Math.abs(diff),
        });
      }
      // diff === 0 means book and actual match; not included in diff records
    }

    const surplusTotalQuantity = surplusItems.reduce(
      (sum, item) => sum + item.diffQuantity,
      0,
    );
    const shortageTotalQuantity = shortageItems.reduce(
      (sum, item) => sum + item.diffQuantity,
      0,
    );

    return {
      diffRecords: [...surplusItems, ...shortageItems],
      surplusItems,
      shortageItems,
      surplusCount: surplusItems.length,
      shortageCount: shortageItems.length,
      surplusTotalQuantity,
      shortageTotalQuantity,
      hasDiff: surplusItems.length > 0 || shortageItems.length > 0,
    };
  }, [assets]);

  /**
   * Submit diff records for supervisor approval.
   * Triggers POST /api/inventory/approve with taskId and diff payload.
   * Implements graceful degradation: catches network errors and exposes
   * submitError for the UI to display a user-facing fallback message.
   */
  const submitApproval = useCallback(
    async (taskId: string) => {
      if (!diffSummary.hasDiff) {
        return;
      }

      try {
        setSubmitting(true);
        setSubmitError(null);
        await submitInventoryApproval(taskId, diffSummary.diffRecords);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : '提交核准失败，请检查网络后重试';
        setSubmitError(message);
        throw error;
      } finally {
        setSubmitting(false);
      }
    },
    [diffSummary.diffRecords, diffSummary.hasDiff],
  );

  return {
    ...diffSummary,
    submitting,
    submitError,
    submitApproval,
  };
}

export default useDiffSummary;