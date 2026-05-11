/**
 * useRetirement — React hooks for asset retirement workflow.
 *
 * SWARM-038: Encapsulates state management, mutation calls, and cross-tenant
 * error interception for the retirement lifecycle:
 *   Pending → Approved / Cancelled → Scrapped / Completed
 *
 * @module hooks/useRetirement
 * @since SWARM-038
 */

import { useState, useCallback, useEffect } from 'react';
import { retirementService } from '../services/retirementService';
import { assetService, type AssetRecord } from '../services/assetService';
import type {
  RetirementApplication,
  RetirementStatus,
} from '../types/retirement.types';

// ---------------------------------------------------------------------------
// Status machine mapping
// ---------------------------------------------------------------------------

/**
 * Backend retirement status enum values mapped to frontend UI display labels.
 *
 * @description The lifecycle follows: PENDING → APPROVED → SCRAPPED/COMPLETED
 * with CANCELLED as a reversible branch from PENDING.
 */
export const RETIREMENT_STATUS_MAP: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已审批',
  CANCELLED: '已取消',
  SCRAPPED: '已报废',
  COMPLETED: '已完成',
};

/**
 * Terminal states — once entered, all retirement action UI controls must be
 * physically disabled (aria-disabled + disabled attributes).
 */
export const TERMINAL_STATES: string[] = ['SCRAPPED', 'COMPLETED', 'RETIRED'];

/**
 * States that allow cancellation.
 */
export const CANCELLABLE_STATES: string[] = ['PENDING'];

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Check if an error represents a cross-tenant rejection.
 *
 * @param err - The thrown error
 * @returns true when the backend rejected the request due to tenant mismatch
 */
function isCrossTenantError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message ?? '';
    return msg.includes('无权操作该资产') || msg.includes('跨租户') || msg.includes('403') || msg.includes('400');
  }
  return false;
}

// ---------------------------------------------------------------------------
// Hook: useRetirementDetail
// ---------------------------------------------------------------------------

/**
 * Return type for the useRetirementDetail hook.
 */
export interface UseRetirementDetailReturn {
  /** The retirement application record */
  application: RetirementApplication | null;
  /** The associated asset record */
  asset: AssetRecord | null;
  /** Loading state for the application data */
  loading: boolean;
  /** Error message, if any */
  error: string | null;
  /** Whether the application is in a terminal state */
  isTerminal: boolean;
  /** Whether the application can be cancelled */
  canCancel: boolean;
  /** Refresh the application and asset data */
  refresh: () => Promise<void>;
  /** Cancel the current retirement application */
  cancelRetirement: () => Promise<boolean>;
  /** Process number for display */
  processNo: string | null;
}

/**
 * Hook for fetching and managing a single retirement application detail.
 *
 * @param applicationId - The ID of the retirement application
 * @returns State and actions for the retirement detail view
 */
export function useRetirementDetail(
  applicationId: string | null
): UseRetirementDetailReturn {
  const [application, setApplication] = useState<RetirementApplication | null>(null);
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch both the application detail and the associated asset.
   */
  const refresh = useCallback(async () => {
    if (!applicationId) {
      setApplication(null);
      setAsset(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const app = await retirementService.getApplication(applicationId);
      setApplication(app);

      if (app.assetId) {
        try {
          const assetResp = await assetService.getById(app.assetId);
          setAsset(assetResp);
        } catch {
          // Asset fetch failure is non-critical for detail view
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取退役申请详情失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  /**
   * Cancel the current retirement application.
   *
   * @returns true if cancellation succeeded, false otherwise
   */
  const cancelRetirement = useCallback(async (): Promise<boolean> => {
    if (!applicationId) return false;

    try {
      await retirementService.cancelApplication(applicationId);
      await refresh();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '取消退役申请失败';
      if (isCrossTenantError(err)) {
        setError('无权操作该资产');
      } else {
        setError(message);
      }
      return false;
    }
  }, [applicationId, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Determine if the current status is terminal */
  const statusStr = application?.status ?? '';
  const isTerminal = TERMINAL_STATES.includes(statusStr);

  /** Determine if the application can be cancelled */
  const canCancel = CANCELLABLE_STATES.includes(statusStr);

  /** Extract process number from application */
  const processNo = application?.retirementNo ?? application?.id ?? null;

  return {
    application,
    asset,
    loading,
    error,
    isTerminal,
    canCancel,
    refresh,
    cancelRetirement,
    processNo,
  };
}

// ---------------------------------------------------------------------------
// Hook: useSubmitRetirement
// ---------------------------------------------------------------------------

/**
 * Parameters for submitting a retirement application.
 */
export interface SubmitRetirementParams {
  /** Asset ID to retire */
  assetId: string;
  /** Retirement reason */
  reason: string;
  /** Expected retirement date (ISO 8601) */
  expectedDate?: string;
}

/**
 * Return type for the useSubmitRetirement hook.
 */
export interface UseSubmitRetirementReturn {
  /** Whether a submission is in progress */
  submitting: boolean;
  /** The created application after successful submission */
  result: RetirementApplication | null;
  /** Error message from submission, if any */
  error: string | null;
  /** Submit a retirement application */
  submitRetirement: (params: SubmitRetirementParams) => Promise<RetirementApplication | null>;
  /** Reset the submission state */
  reset: () => void;
}

/**
 * Hook for submitting a new retirement application.
 *
 * @description Handles the full create-then-submit flow, including
 * cross-tenant error interception and processNo extraction.
 *
 * @returns State and actions for retirement submission
 */
export function useSubmitRetirement(): UseSubmitRetirementReturn {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RetirementApplication | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Submit a retirement application for an asset.
   *
   * @param params - Submission parameters (assetId, reason, expectedDate)
   * @returns The created application, or null on failure
   */
  const submitRetirement = useCallback(
    async (params: SubmitRetirementParams): Promise<RetirementApplication | null> => {
      setSubmitting(true);
      setError(null);

      try {
        // Step 1: Create the application
        const created = await retirementService.createApplication(
          params.assetId,
          params.reason,
          params.expectedDate
        );

        // Step 2: Submit the created application
        const submitted = await retirementService.submitApplication(created.id);
        setResult(submitted);
        return submitted;
      } catch (err) {
        if (isCrossTenantError(err)) {
          setError('无权操作该资产');
        } else {
          const message = err instanceof Error ? err.message : '提交退役申请失败';
          setError(message);
        }
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  /**
   * Reset submission state.
   */
  const reset = useCallback(() => {
    setSubmitting(false);
    setResult(null);
    setError(null);
  }, []);

  return {
    submitting,
    result,
    error,
    submitRetirement,
    reset,
  };
}

// ---------------------------------------------------------------------------
// Hook: useAssetRetirementStatus
// ---------------------------------------------------------------------------

/**
 * Return type for the useAssetRetirementStatus hook.
 */
export interface UseAssetRetirementStatusReturn {
  /** Current asset record */
  asset: AssetRecord | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Whether the asset is in a terminal (scrapped/disposed) state */
  isTerminal: boolean;
  /** Whether the "Apply for Retirement" button should be disabled */
  retirementDisabled: boolean;
  /** Refresh the asset data */
  refresh: () => Promise<void>;
}

/**
 * Determine whether an asset status represents a terminal state.
 *
 * @param status - Asset status string
 * @returns true if the asset cannot have further retirement actions
 */
export function isTerminalAssetStatus(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toUpperCase();
  return (
    TERMINAL_STATES.includes(s) ||
    s === 'DISPOSED' ||
    s === 'RETIRED'
  );
}

/**
 * Hook for checking an asset's retirement eligibility.
 *
 * @param assetId - The asset ID to check
 * @returns State including whether the asset can have retirement actions
 */
export function useAssetRetirementStatus(
  assetId: string | null
): UseAssetRetirementStatusReturn {
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch the asset record to determine current status.
   */
  const refresh = useCallback(async () => {
    if (!assetId) {
      setAsset(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const record = await assetService.getById(assetId);
      setAsset(record);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取资产信息失败';
      setError(message);
      setAsset(null);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Check if the asset is in a terminal state */
  const isTerminal = isTerminalAssetStatus(asset?.status);

  /** Disable retirement button for terminal states or when already retiring */
  const retirementDisabled = isTerminal || (asset?.status?.toUpperCase() === 'RETIRING');

  return {
    asset,
    loading,
    error,
    isTerminal,
    retirementDisabled,
    refresh,
  };
}

export default useRetirementDetail;
