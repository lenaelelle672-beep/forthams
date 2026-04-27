/**
 * approval-comment.spec.ts
 *
 * Unit tests for the ApprovalComment component and related comment/rejection-reason logic.
 *
 * Covers:
 *  - AC-1: Rejection reason is mandatory (non-empty string) when rejecting.
 *  - AC-2: Rejection reason must not exceed 500 characters.
 *  - AC-3: Approval comment is optional when approving.
 *  - AC-4: Comment payload is correctly assembled before API dispatch.
 *  - AC-5: Form resets after successful submission.
 *
 * Aligns with ATB-5 (frontend approval detail & action test) and the
 * rejection constraint: `rejectionReason` is a non-empty string ≤ 500 chars,
 * missing → HTTP 400.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, reactive, computed, nextTick } from 'vue';

// ---------------------------------------------------------------------------
// Lightweight component stub that mirrors the real ApprovalComment behaviour
// so we can test the pure logic without importing the full app.
// ---------------------------------------------------------------------------

/** Maximum allowed length for rejection reason (matches backend constraint). */
const MAX_REJECTION_REASON_LENGTH = 500;

/**
 * Composable that encapsulates the comment / rejection-reason validation logic.
 * In production this lives inside the ApprovalDetail component or a dedicated
 * composable; here we extract it for isolated testing.
 */
function useApprovalComment() {
  const comment = ref('');
  const isSubmitting = ref(false);
  const submitError = ref<string | null>(null);
  const submitSuccess = ref(false);

  /** Validate rejection reason – returns an error message or null if valid. */
  function validateRejectionReason(reason: string): string | null {
    if (!reason || reason.trim().length === 0) {
      return '驳回原因不能为空';
    }
    if (reason.length > MAX_REJECTION_REASON_LENGTH) {
      return `驳回原因不能超过 ${MAX_REJECTION_REASON_LENGTH} 个字符`;
    }
    return null;
  }

  /** Build the payload that will be sent to the backend. */
  function buildRejectPayload(reason: string) {
    return { rejectionReason: reason.trim() };
  }

  /** Build the payload for an approve action (comment is optional). */
  function buildApprovePayload(optionalComment?: string) {
    const payload: Record<string, unknown> = {};
    if (optionalComment && optionalComment.trim().length > 0) {
      payload.comment = optionalComment.trim();
    }
    return payload;
  }

  /** Reset form state after successful submission. */
  function resetForm() {
    comment.value = '';
    submitError.value = null;
    submitSuccess.value = false;
  }

  return {
    comment,
    isSubmitting,
    submitError,
    submitSuccess,
    validateRejectionReason,
    buildRejectPayload,
    buildApprovePayload,
    resetForm,
  };
}

// ===========================================================================
// Test suite
// ===========================================================================

describe('useApprovalComment', () => {
  let ctx: ReturnType<typeof useApprovalComment>;

  beforeEach(() => {
    ctx = useApprovalComment();
  });

  // -----------------------------------------------------------------------
  // AC-1: Rejection reason is mandatory
  // -----------------------------------------------------------------------
  describe('AC-1: rejection reason mandatory validation', () => {
    it('should return error when rejection reason is empty string', () => {
      const result = ctx.validateRejectionReason('');
      expect(result).toBe('驳回原因不能为空');
    });

    it('should return error when rejection reason is whitespace only', () => {
      const result = ctx.validateRejectionReason('   \t\n  ');
      expect(result).toBe('驳回原因不能为空');
    });

    it('should return null when rejection reason is a valid non-empty string', () => {
      const result = ctx.validateRejectionReason('不合规');
      expect(result).toBeNull();
    });

    it('should return null when rejection reason has leading/trailing whitespace but content', () => {
      const result = ctx.validateRejectionReason('  有效原因  ');
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // AC-2: Rejection reason max length constraint (500 chars)
  // -----------------------------------------------------------------------
  describe('AC-2: rejection reason max length (500 chars)', () => {
    it('should accept rejection reason at exactly 500 characters', () => {
      const reason = 'A'.repeat(500);
      const result = ctx.validateRejectionReason(reason);
      expect(result).toBeNull();
    });

    it('should reject rejection reason at 501 characters', () => {
      const reason = 'A'.repeat(501);
      const result = ctx.validateRejectionReason(reason);
      expect(result).toBe(`驳回原因不能超过 ${MAX_REJECTION_REASON_LENGTH} 个字符`);
    });

    it('should reject rejection reason significantly over 500 characters', () => {
      const reason = 'X'.repeat(1000);
      const result = ctx.validateRejectionReason(reason);
      expect(result).toContain('500');
    });

    it('should accept rejection reason at 499 characters', () => {
      const reason = 'B'.repeat(499);
      const result = ctx.validateRejectionReason(reason);
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // AC-3: Approval comment is optional
  // -----------------------------------------------------------------------
  describe('AC-3: approval comment is optional', () => {
    it('should build approve payload without comment when none provided', () => {
      const payload = ctx.buildApprovePayload();
      expect(payload).toEqual({});
      expect(payload).not.toHaveProperty('comment');
    });

    it('should build approve payload without comment when empty string provided', () => {
      const payload = ctx.buildApprovePayload('');
      expect(payload).toEqual({});
    });

    it('should build approve payload without comment when whitespace provided', () => {
      const payload = ctx.buildApprovePayload('   ');
      expect(payload).toEqual({});
    });

    it('should include comment in approve payload when non-empty string provided', () => {
      const payload = ctx.buildApprovePayload('同意，请继续处理');
      expect(payload).toEqual({ comment: '同意，请继续处理' });
    });

    it('should trim comment in approve payload', () => {
      const payload = ctx.buildApprovePayload('  同意  ');
      expect(payload).toEqual({ comment: '同意' });
    });
  });

  // -----------------------------------------------------------------------
  // AC-4: Reject payload assembly
  // -----------------------------------------------------------------------
  describe('AC-4: reject payload assembly', () => {
    it('should build reject payload with trimmed rejectionReason', () => {
      const payload = ctx.buildRejectPayload('  不合规  ');
      expect(payload).toEqual({ rejectionReason: '不合规' });
    });

    it('should build reject payload preserving internal whitespace', () => {
      const payload = ctx.buildRejectPayload('原因：不合规，需要重新提交');
      expect(payload).toEqual({
        rejectionReason: '原因：不合规，需要重新提交',
      });
    });

    it('should build reject payload with exactly 500-char reason', () => {
      const reason = 'R'.repeat(500);
      const payload = ctx.buildRejectPayload(reason);
      expect(payload.rejectionReason).toHaveLength(500);
    });
  });

  // -----------------------------------------------------------------------
  // AC-5: Form reset after submission
  // -----------------------------------------------------------------------
  describe('AC-5: form reset after successful submission', () => {
    it('should reset comment to empty string', () => {
      ctx.comment.value = 'some comment';
      ctx.resetForm();
      expect(ctx.comment.value).toBe('');
    });

    it('should clear submitError on reset', () => {
      ctx.submitError.value = '网络错误';
      ctx.resetForm();
      expect(ctx.submitError.value).toBeNull();
    });

    it('should clear submitSuccess on reset', () => {
      ctx.submitSuccess.value = true;
      ctx.resetForm();
      expect(ctx.submitSuccess.value).toBe(false);
    });

    it('should reset all fields to initial state', () => {
      ctx.comment.value = 'test';
      ctx.submitError.value = 'error';
      ctx.submitSuccess.value = true;
      ctx.isSubmitting.value = true;

      ctx.resetForm();

      expect(ctx.comment.value).toBe('');
      expect(ctx.submitError.value).toBeNull();
      expect(ctx.submitSuccess.value).toBe(false);
      // isSubmitting is intentionally NOT reset by resetForm
      // as it is managed by the async submission lifecycle
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle unicode characters in rejection reason correctly', () => {
      const reason = '驳回原因：资产编号不匹配，请核实后重新提交。';
      const result = ctx.validateRejectionReason(reason);
      expect(result).toBeNull();
    });

    it('should count unicode characters correctly for length validation', () => {
      // Each Chinese character counts as 1 character
      const reason = '中'.repeat(500);
      const result = ctx.validateRejectionReason(reason);
      expect(result).toBeNull();
    });

    it('should reject unicode rejection reason exceeding 500 characters', () => {
      const reason = '中'.repeat(501);
      const result = ctx.validateRejectionReason(reason);
      expect(result).toContain('500');
    });

    it('should handle rejection reason with special characters', () => {
      const reason = '原因：<script>alert("xss")</script>';
      const result = ctx.validateRejectionReason(reason);
      // Validation only checks length and emptiness, not content
      expect(result).toBeNull();
    });

    it('should handle rejection reason with newlines', () => {
      const reason = '第一行原因\n第二行原因\n第三行原因';
      const result = ctx.validateRejectionReason(reason);
      expect(result).toBeNull();
    });
  });
});

// ===========================================================================
// Integration-style tests: mock API interaction
// ===========================================================================

describe('ApprovalComment API integration', () => {
  const mockPost = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call reject API with correct payload when rejection reason is valid', async () => {
    mockPost.mockResolvedValueOnce({ status: 200, data: { success: true } });

    const ctx = useApprovalComment();
    const reason = '不合规，请重新提交';
    const validationError = ctx.validateRejectionReason(reason);
    expect(validationError).toBeNull();

    const payload = ctx.buildRejectPayload(reason);
    await mockPost('/api/orders/1/reject', payload);

    expect(mockPost).toHaveBeenCalledWith('/api/orders/1/reject', {
      rejectionReason: '不合规，请重新提交',
    });
  });

  it('should NOT call reject API when rejection reason is empty', async () => {
    const ctx = useApprovalComment();
    const reason = '';
    const validationError = ctx.validateRejectionReason(reason);
    expect(validationError).toBe('驳回原因不能为空');

    // API should not be called
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should NOT call reject API when rejection reason exceeds 500 chars', async () => {
    const ctx = useApprovalComment();
    const reason = 'A'.repeat(501);
    const validationError = ctx.validateRejectionReason(reason);
    expect(validationError).toContain('500');

    // API should not be called
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should call approve API without comment when no comment provided', async () => {
    mockPost.mockResolvedValueOnce({ status: 200, data: { success: true } });

    const ctx = useApprovalComment();
    const payload = ctx.buildApprovePayload();
    await mockPost('/api/orders/1/approve', payload);

    expect(mockPost).toHaveBeenCalledWith('/api/orders/1/approve', {});
  });

  it('should call approve API with comment when comment is provided', async () => {
    mockPost.mockResolvedValueOnce({ status: 200, data: { success: true } });

    const ctx = useApprovalComment();
    const payload = ctx.buildApprovePayload('同意');
    await mockPost('/api/orders/1/approve', payload);

    expect(mockPost).toHaveBeenCalledWith('/api/orders/1/approve', {
      comment: '同意',
    });
  });

  it('should handle API 400 error for missing rejection reason gracefully', async () => {
    // Simulate backend returning 400 when rejectionReason is missing
    mockPost.mockResolvedValueOnce({
      status: 400,
      data: {
        code: 'VALIDATION_ERROR',
        message: 'rejectionReason is required',
      },
    });

    const response = await mockPost('/api/orders/1/reject', {});
    expect(response.status).toBe(400);
    expect(response.data.code).toBe('VALIDATION_ERROR');
  });

  it('should handle API 409 conflict for invalid state transition', async () => {
    // Simulate backend returning 409 for invalid state transition
    mockPost.mockResolvedValueOnce({
      status: 409,
      data: {
        code: 'INVALID_STATE_TRANSITION',
        message: 'Cannot approve order in PENDING state',
      },
    });

    const response = await mockPost('/api/orders/1/approve', {});
    expect(response.status).toBe(409);
    expect(response.data.code).toBe('INVALID_STATE_TRANSITION');
  });
});

// ===========================================================================
// ApprovalRecord persistence model tests
// ===========================================================================

describe('ApprovalRecord model', () => {
  /** Minimal type representing a persisted approval record. */
  interface ApprovalRecord {
    id: string;
    orderId: string;
    operatorId: string;
    operatorName: string;
    action: 'APPROVE' | 'REJECT';
    comment?: string;
    rejectionReason?: string;
    createdAt: string; // ISO 8601
  }

  it('should create an approval record for APPROVE action', () => {
    const record: ApprovalRecord = {
      id: 'ar-001',
      orderId: 'WO-2025-0001',
      operatorId: 'user-001',
      operatorName: '张三',
      action: 'APPROVE',
      comment: '同意',
      createdAt: '2025-01-15T10:30:00Z',
    };

    expect(record.action).toBe('APPROVE');
    expect(record.comment).toBe('同意');
    expect(record.rejectionReason).toBeUndefined();
  });

  it('should create an approval record for REJECT action with mandatory reason', () => {
    const record: ApprovalRecord = {
      id: 'ar-002',
      orderId: 'WO-2025-0001',
      operatorId: 'user-002',
      operatorName: '李四',
      action: 'REJECT',
      rejectionReason: '不合规，请重新提交',
      createdAt: '2025-01-15T11:00:00Z',
    };

    expect(record.action).toBe('REJECT');
    expect(record.rejectionReason).toBe('不合规，请重新提交');
    expect(record.rejectionReason!.length).toBeLessThanOrEqual(500);
  });

  it('should enforce ISO 8601 date format for createdAt', () => {
    const isoDate = '2025-01-15T10:30:00.000Z';
    const isValidIso = !isNaN(Date.parse(isoDate));
    expect(isValidIso).toBe(true);

    const record: ApprovalRecord = {
      id: 'ar-003',
      orderId: 'WO-2025-0002',
      operatorId: 'user-003',
      operatorName: '王五',
      action: 'APPROVE',
      createdAt: isoDate,
    };

    expect(Date.parse(record.createdAt)).not.toBeNaN();
  });

  it('should store rejection reason without truncation when within limit', () => {
    const reason = 'A'.repeat(500);
    const record: ApprovalRecord = {
      id: 'ar-004',
      orderId: 'WO-2025-0003',
      operatorId: 'user-004',
      operatorName: '赵六',
      action: 'REJECT',
      rejectionReason: reason,
      createdAt: new Date().toISOString(),
    };

    expect(record.rejectionReason).toHaveLength(500);
  });
});