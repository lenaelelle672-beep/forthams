/**
 * RetirementRequestForm — Reusable form component for submitting asset retirement requests.
 *
 * SWARM-062: Extracted from AssetRetirementPage as a standalone, reusable form component.
 * Handles reason selection, description, expected date, and form validation.
 * Cross-tenant and submission errors are surfaced via the error display.
 *
 * @module components/retirement/RetirementRequestForm
 * @since SWARM-062
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Loader2 } from 'lucide-react';
import { RETIREMENT_REASON_OPTIONS } from '../../types/retirement.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Parameters for the retirement form submission.
 */
export interface RetirementFormValues {
  /** Retirement reason code */
  reason: string;
  /** Detailed description */
  description: string;
  /** Expected retirement date (ISO 8601) */
  expectedDate: string;
}

/**
 * Props for the RetirementRequestForm component.
 */
export interface RetirementRequestFormProps {
  /** Whether the form is currently submitting */
  submitting?: boolean;
  /** Submission error message */
  submitError?: string | null;
  /** Whether the asset is in a terminal state (disables submit) */
  assetError?: string | null;
  /** Callback when the form is submitted */
  onSubmit: (values: RetirementFormValues) => void;
  /** Callback when the form is cancelled */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RetirementRequestForm component
 *
 * Renders a form for submitting asset retirement applications with
 * reason selection, description textarea, and expected date input.
 * Validates required fields before calling onSubmit.
 *
 * @param props - Component props including submit handler and state flags
 * @returns The retirement request form JSX
 */
export const RetirementRequestForm: React.FC<RetirementRequestFormProps> = ({
  submitting = false,
  submitError = null,
  assetError = null,
  onSubmit,
  onCancel,
}) => {
  // -- Form state ---------------------------------------------------------------
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [expectedDate, setExpectedDate] = useState('');

  /**
   * Handle form submission.
   *
   * Validates required fields and delegates to the parent onSubmit callback.
   */
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!reason.trim()) {
        return;
      }

      onSubmit({
        reason: reason.trim(),
        description: description.trim(),
        expectedDate,
      });
    },
    [reason, description, expectedDate, onSubmit]
  );

  return (
    <>
      {/* Error toast for submission errors */}
      {submitError && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm mb-4"
          data-testid="form-error-toast"
          role="alert"
        >
          {submitError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">退役申请表</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Reason field */}
            <div className="space-y-2">
              <label
                htmlFor="retire-reason"
                className="block text-sm font-medium text-gray-700"
              >
                退役原因 <span className="text-red-500">*</span>
              </label>
              <select
                id="retire-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
                data-testid="retire-reason"
              >
                <option value="">请选择退役原因</option>
                {RETIREMENT_REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description field */}
            <div className="space-y-2">
              <label
                htmlFor="retire-description"
                className="block text-sm font-medium text-gray-700"
              >
                详细描述
              </label>
              <textarea
                id="retire-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="请输入详细描述信息（选填，最多1000字）"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="retire-description"
              />
            </div>

            {/* Expected date field */}
            <div className="space-y-2">
              <label
                htmlFor="retire-date"
                className="block text-sm font-medium text-gray-700"
              >
                预期退役日期
              </label>
              <Input
                id="retire-date"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                data-testid="retire-date"
              />
            </div>

            {/* Submit button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={submitting || !reason.trim() || !!assetError}
                data-testid="submit-btn"
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
    </>
  );
};

export default RetirementRequestForm;
