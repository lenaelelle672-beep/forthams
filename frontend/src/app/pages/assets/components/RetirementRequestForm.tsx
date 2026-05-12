/**
 * RetirementRequestForm — Data collection form for submitting a new
 * asset retirement application.
 *
 * SWARM-053: Handles form validation, submission via the retirement service,
 * and cross-tenant error interception. When the associated asset status is
 * SCRAPPED (terminal), the form blocks new request creation.
 *
 * This component ONLY handles data collection and submission — it does NOT
 * render any list views.
 *
 * @module pages/assets/components/RetirementRequestForm
 * @since SWARM-053
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import {
  useSubmitRetirement,
  isTerminalAssetStatus,
} from '../../../hooks/useRetirement';
import {
  RETIREMENT_REASON_OPTIONS,
  type RetirementReason,
} from '../../../types/retirement.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the RetirementRequestForm component.
 */
export interface RetirementRequestFormProps {
  /** Asset ID to create the retirement application for */
  assetId: string;
  /** Current asset status string, used to block terminal assets */
  assetStatus?: string;
  /** Callback invoked after successful submission */
  onSuccess?: (applicationId: string) => void;
  /** Callback invoked when the user cancels the form */
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if an error message represents a cross-tenant rejection.
 *
 * @param msg - Error message string
 * @returns true when the error indicates tenant mismatch or insufficient permissions
 */
function isCrossTenantMessage(msg: string): boolean {
  return (
    msg.includes('无权操作该资产') ||
    msg.includes('跨租户') ||
    msg.includes('403') ||
    msg.includes('权限不足')
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RetirementRequestForm component
 *
 * Collects retirement reason, description, and expected date from the user,
 * validates inputs, and submits the retirement application via the API.
 * Blocks submission when the asset is in a terminal state (SCRAPPED, etc.).
 *
 * @param props - Form props including assetId and callbacks
 * @returns The retirement request form JSX
 */
export const RetirementRequestForm: React.FC<RetirementRequestFormProps> = ({
  assetId,
  assetStatus,
  onSuccess,
  onCancel,
}) => {
  // -- Form state ------------------------------------------------------------
  const [reason, setReason] = useState<RetirementReason | ''>('');
  const [description, setDescription] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // -- Submission hook -------------------------------------------------------
  const { submitting, error: submitError, submitRetirement } = useSubmitRetirement();

  // -- Terminal state check --------------------------------------------------
  const isAssetTerminal = isTerminalAssetStatus(assetStatus);

  /**
   * Handle form submission.
   *
   * Validates required fields (reason is mandatory), then delegates to the
   * useSubmitRetirement hook. On success, calls the onSuccess callback.
   *
   * @param e - Form submit event
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError(null);

      // Validate required fields
      if (!reason) {
        setValidationError('请选择退役原因');
        return;
      }

      if (!reason.trim()) {
        setValidationError('退役原因不能为空');
        return;
      }

      if (description && description.length > 1000) {
        setValidationError('详细描述不能超过1000字符');
        return;
      }

      const result = await submitRetirement({
        assetId,
        reason: reason as string,
        expectedDate: expectedDate || undefined,
      });

      if (result && onSuccess) {
        onSuccess(result.id);
      }
    },
    [assetId, reason, description, expectedDate, submitRetirement, onSuccess]
  );

  // ---- Terminal state block ------------------------------------------------
  if (isAssetTerminal) {
    return (
      <Card data-testid="retirement-request-form-blocked">
        <CardContent className="flex flex-col items-center py-8">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mb-3" />
          <p className="text-sm text-gray-600 font-medium">
            该资产已处于终结状态（已报废），无法发起新的退役申请
          </p>
          {onCancel && (
            <Button variant="outline" className="mt-4" onClick={onCancel}>
              返回
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ---- Main form render ----------------------------------------------------
  const displayError = validationError || submitError;

  return (
    <Card data-testid="retirement-request-form">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">退役申请表</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Reason field (required) */}
          <div className="space-y-2">
            <label
              htmlFor="retirement-reason"
              className="block text-sm font-medium text-gray-700"
            >
              退役原因 <span className="text-red-500">*</span>
            </label>
            <Select
              value={reason}
              onValueChange={(val) => setReason(val as RetirementReason)}
            >
              <SelectTrigger data-testid="retirement-reason-select">
                <SelectValue placeholder="请选择退役原因" />
              </SelectTrigger>
              <SelectContent>
                {RETIREMENT_REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description field (optional) */}
          <div className="space-y-2">
            <label
              htmlFor="retirement-description"
              className="block text-sm font-medium text-gray-700"
            >
              详细描述
            </label>
            <Textarea
              id="retirement-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="请输入详细描述信息（选填，最多1000字）"
              data-testid="retirement-description"
            />
          </div>

          {/* Expected date field (optional) */}
          <div className="space-y-2">
            <label
              htmlFor="retirement-expected-date"
              className="block text-sm font-medium text-gray-700"
            >
              预期退役日期
            </label>
            <Input
              id="retirement-expected-date"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              data-testid="retirement-expected-date"
            />
          </div>

          {/* Cross-tenant error banner */}
          {submitError && isCrossTenantMessage(submitError) && (
            <div
              className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm flex items-center gap-2"
              data-testid="retirement-form-cross-tenant-error"
              role="alert"
            >
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              权限不足，无法操作此资产
            </div>
          )}

          {/* Error display */}
          {displayError && !(submitError && isCrossTenantMessage(submitError)) && (
            <div
              className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm"
              data-testid="retirement-form-error"
              role="alert"
            >
              {displayError}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                data-testid="retirement-form-cancel"
              >
                取消
              </Button>
            )}
            <Button
              type="submit"
              disabled={submitting || !reason}
              data-testid="retirement-form-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                '提交退役申请'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RetirementRequestForm;
