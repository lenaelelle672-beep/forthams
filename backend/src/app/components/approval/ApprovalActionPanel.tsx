/**
 * @module frontend/src/app/components/approval/ApprovalActionPanel
 * @description Reusable approval action panel component following [FLOW-STYLE-02].
 *
 * Provides a Card-wrapped form with a Textarea for comments and colour-coded
 * Approve (green) / Reject (red) buttons. Delegates all business logic to the
 * parent through `onApprove` / `onReject` callbacks.
 *
 * Acceptance: ATB-01 (no MUI), ATB-02 (empty-comment guard),
 * ATB-03 (green/red colour mapping), ATB-04 (disabled/loading),
 * ATB-05 (callback data integrity).
 */

import React, { useState, useCallback } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "../ui/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApprovalActionPanelProps {
  /** Unique identifier for the approval entity being reviewed. */
  id: string | number;
  /** Fired when the user submits an *approve* decision. */
  onApprove: (id: string | number, comment: string) => void;
  /** Fired when the user submits a *reject* decision. */
  onReject: (id: string | number, comment: string) => void;
  /** Disables all interactive controls. */
  disabled: boolean;
  /** Shows a loading spinner and disables controls while an action is in-flight. */
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ApprovalActionPanel renders a comment textarea plus Approve / Reject buttons.
 *
 * - Empty comments are blocked for **both** actions (ATB-02).
 * - Buttons use Tailwind green (`bg-green-600`) / red (`bg-red-600`) (ATB-03).
 * - `disabled` and `loading` are purely prop-driven, never mutated internally.
 * - No MUI / Emotion dependencies (ATB-01).
 */
export function ApprovalActionPanel({
  id,
  onApprove,
  onReject,
  disabled,
  loading,
}: ApprovalActionPanelProps) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** Reset validation error as soon as the user types. */
  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setComment(e.target.value);
      if (error) setError(null);
    },
    [error],
  );

  /**
   * Validate and dispatch an approval or rejection action.
   * Both paths require a non-empty comment (ATB-02).
   */
  const handleAction = useCallback(
    (type: "approve" | "reject") => {
      const trimmed = comment.trim();

      if (!trimmed) {
        setError("请输入审批意见后再进行操作");
        return;
      }

      setError(null);

      if (type === "approve") {
        onApprove(id, trimmed);
      } else {
        onReject(id, trimmed);
      }
    },
    [comment, id, onApprove, onReject],
  );

  const isDisabled = disabled || loading;

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">审批操作</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* ---- Comment input ---- */}
        <div>
          <label
            htmlFor="approval-comment"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            审批意见
          </label>
          <Textarea
            id="approval-comment"
            className={cn(
              "min-h-[80px]",
              error && "border-red-500 focus-visible:ring-red-500/40",
            )}
            placeholder="请输入审批意见..."
            value={comment}
            onChange={handleCommentChange}
            disabled={isDisabled}
            aria-invalid={!!error}
          />
        </div>

        {/* ---- Validation error (ATB-02) ---- */}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        {/* ---- Loading status indicator (ATB-04) ---- */}
        {loading && (
          <div
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>提交中...</span>
          </div>
        )}

        {/* ---- Action buttons ---- */}
        <div className="flex items-center gap-3">
          {/* Approve — green (ATB-03) */}
          <Button
            type="button"
            className={cn(
              "bg-green-600 text-white hover:bg-green-700",
              isDisabled && "cursor-not-allowed bg-green-300 hover:bg-green-300",
            )}
            onClick={() => handleAction("approve")}
            disabled={isDisabled}
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
            )}
            通过
          </Button>

          {/* Reject — red (ATB-03) */}
          <Button
            type="button"
            className={cn(
              "bg-red-600 text-white hover:bg-red-700",
              isDisabled && "cursor-not-allowed bg-red-300 hover:bg-red-300",
            )}
            onClick={() => handleAction("reject")}
            disabled={isDisabled}
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-1.5 h-4 w-4" />
            )}
            驳回
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ApprovalActionPanel;
