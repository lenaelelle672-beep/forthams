/**
 * DepreciationRunTrigger — Button to trigger a depreciation calculation run.
 *
 * Features:
 * - Calls POST /api/depreciation/runs via the service layer
 * - Disables itself while the request is in-flight (debounce / prevent double-click)
 * - Shows success toast on 202 Accepted; error toast on failure
 * - No native alert/prompt/confirm used
 *
 * @module components/depreciation/DepreciationRunTrigger
 * @since SWARM-042
 */

import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Loader2, Play } from 'lucide-react';
import { triggerRun } from '../../services/depreciationService';
import type { DepreciationRunPayload } from '../../services/depreciationService';

/**
 * Props for the DepreciationRunTrigger component.
 */
export interface DepreciationRunTriggerProps {
  /** Asset IDs to include in the run */
  assetIds?: string[];
  /** Target period, e.g. "2025-06" */
  targetPeriod?: string;
  /** Optional callback on successful run */
  onSuccess?: () => void;
  /** Optional callback on failure */
  onError?: (error: Error) => void;
  /** Optional additional CSS class */
  className?: string;
}

/**
 * DepreciationRunTrigger component
 *
 * Renders a button that triggers a depreciation calculation run.
 * The button is disabled while the API request is in-flight to prevent
 * duplicate submissions.
 *
 * @param props - Component props
 * @returns The trigger button JSX
 */
export const DepreciationRunTrigger: React.FC<DepreciationRunTriggerProps> = ({
  assetIds,
  targetPeriod,
  onSuccess,
  onError,
  className,
}) => {
  const [loading, setLoading] = useState(false);

  /**
   * Handle the run trigger click.
   *
   * Constructs the payload, calls the service, and shows appropriate
   * toast feedback.
   */
  const handleClick = useCallback(async () => {
    if (loading) return;

    setLoading(true);

    const payload: DepreciationRunPayload = {};
    if (assetIds && assetIds.length > 0) {
      payload.assetIds = assetIds;
    }
    if (targetPeriod) {
      payload.targetPeriod = targetPeriod;
    }

    try {
      await triggerRun(payload);
      toast.success('计算任务已提交');
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : '触发折旧计算失败';
      toast.error(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setLoading(false);
    }
  }, [loading, assetIds, targetPeriod, onSuccess, onError]);

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      disabled={loading}
      onClick={handleClick}
      className={className}
      data-testid="depreciation-run-trigger"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Play className="w-4 h-4 mr-2" />
      )}
      {loading ? '提交中...' : '触发折旧计算'}
    </Button>
  );
};

export default DepreciationRunTrigger;
