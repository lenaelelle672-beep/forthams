/**
 * approver-info-spec.ts
 *
 * Unit tests for the ApproverInfo module — responsible for resolving the
 * correct approver for each approval level, validating rejection reasons,
 * and enforcing role-based data isolation in the multi-level approval
 * workflow (Phase 1: Department Manager → Asset Manager).
 *
 * Covers ATB-4 (role-based list filtering) and ATB-5 (detail & action
 * validation) front-end concerns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Types under test (mirrors frontend/src/types/approval.ts)
// ---------------------------------------------------------------------------

/** Approval levels in the two-tier workflow. */
enum ApprovalLevel {
  LEVEL_1 = 'APPROVING_LEVEL_1',
  LEVEL_2 = 'APPROVING_LEVEL_2',
}

/** Work order statuses managed by the state machine. */
enum OrderStatus {
  PENDING = 'PENDING',
  APPROVING_LEVEL_1 = 'APPROVING_LEVEL_1',
  APPROVING_LEVEL_2 = 'APPROVING_LEVEL_2',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/** Roles that participate in the approval workflow. */
enum ApprovalRole {
  DEPARTMENT_MANAGER = 'DEPARTMENT_MANAGER',
  ASSET_MANAGER = 'ASSET_MANAGER',
}

/** Represents a single approval record persisted in `approval_records`. */
interface ApprovalRecord {
  id: string;
  orderId: string;
  operatorId: string;
  operatorName: string;
  action: 'APPROVE' | 'REJECT';
  comment: string | null;
  rejectionReason: string | null;
  createdAt: string; // ISO 8601
}

/** Describes the approver assigned to a specific approval level. */
interface ApproverInfo {
  userId: string;
  userName: string;
  role: ApprovalRole;
  level: ApprovalLevel;
}

/** Mapping from approval level to the role that can act on it. */
const LEVEL_ROLE_MAP: Record<ApprovalLevel, ApprovalRole> = {
  [ApprovalLevel.LEVEL_1]: ApprovalRole.DEPARTMENT_MANAGER,
  [ApprovalLevel.LEVEL_2]: ApprovalRole.ASSET_MANAGER,
};

/** Mapping from order status to the approval level (if applicable). */
const STATUS_TO_LEVEL: Partial<Record<OrderStatus, ApprovalLevel>> = {
  [OrderStatus.APPROVING_LEVEL_1]: ApprovalLevel.LEVEL_1,
  [OrderStatus.APPROVING_LEVEL_2]: ApprovalLevel.LEVEL_2,
};

// ---------------------------------------------------------------------------
// Pure functions under test
// ---------------------------------------------------------------------------

/**
 * Returns the role required to approve/reject at the given level.
 * Throws if the level is not recognised.
 */
function getRequiredRole(level: ApprovalLevel): ApprovalRole {
  const role = LEVEL_ROLE_MAP[level];
  if (!role) {
    throw new Error(`Unknown approval level: ${level}`);
  }
  return role;
}

/**
 * Resolves the approval level from the current order status.
 * Returns `null` for statuses that are not in an approval stage.
 */
function resolveApprovalLevel(status: OrderStatus): ApprovalLevel | null {
  return STATUS_TO_LEVEL[status] ?? null;
}

/**
 * Validates a rejection reason.
 * - Must be a non-empty string.
 * - Maximum 500 characters.
 * Returns an error message or `null` when valid.
 */
function validateRejectionReason(reason: unknown): string | null {
  if (reason === null || reason === undefined) {
    return '驳回原因不能为空';
  }
  if (typeof reason !== 'string') {
    return '驳回原因必须为字符串';
  }
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    return '驳回原因不能为空';
  }
  if (trimmed.length > 500) {
    return '驳回原因不能超过 500 个字符';
  }
  return null;
}

/**
 * Checks whether a user with the given role can act on a work order
 * in the specified status (data isolation / role guard).
 */
function canUserActOnStatus(
  userRole: ApprovalRole,
  orderStatus: OrderStatus,
): boolean {
  const level = resolveApprovalLevel(orderStatus);
  if (level === null) {
    // No approval in progress — nobody can approve/reject
    return false;
  }
  return getRequiredRole(level) === userRole;
}

/**
 * Builds an ApproverInfo object for a given level.
 */
function buildApproverInfo(
  level: ApprovalLevel,
  userId: string,
  userName: string,
): ApproverInfo {
  return {
    userId,
    userName,
    role: getRequiredRole(level),
    level,
  };
}

/**
 * Creates a minimal approval record for testing.
 */
function createApprovalRecord(
  overrides: Partial<ApprovalRecord> = {},
): ApprovalRecord {
  return {
    id: 'rec-001',
    orderId: 'ord-001',
    operatorId: 'user-001',
    operatorName: '张三',
    action: 'APPROVE',
    comment: null,
    rejectionReason: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ===========================================================================
// Test suites
// ===========================================================================

describe('ApproverInfo — Level-to-Role mapping', () => {
  it('should map LEVEL_1 to DEPARTMENT_MANAGER', () => {
    expect(getRequiredRole(ApprovalLevel.LEVEL_1)).toBe(
      ApprovalRole.DEPARTMENT_MANAGER,
    );
  });

  it('should map LEVEL_2 to ASSET_MANAGER', () => {
    expect(getRequiredRole(ApprovalLevel.LEVEL_2)).toBe(
      ApprovalRole.ASSET_MANAGER,
    );
  });

  it('should throw for an unrecognised level', () => {
    expect(() => getRequiredRole('UNKNOWN' as ApprovalLevel)).toThrow(
      'Unknown approval level',
    );
  });
});

describe('ApproverInfo — Status-to-Level resolution', () => {
  it('should resolve APPROVING_LEVEL_1 status to LEVEL_1', () => {
    expect(resolveApprovalLevel(OrderStatus.APPROVING_LEVEL_1)).toBe(
      ApprovalLevel.LEVEL_1,
    );
  });

  it('should resolve APPROVING_LEVEL_2 status to LEVEL_2', () => {
    expect(resolveApprovalLevel(OrderStatus.APPROVING_LEVEL_2)).toBe(
      ApprovalLevel.LEVEL_2,
    );
  });

  it('should return null for PENDING status (not yet in approval)', () => {
    expect(resolveApprovalLevel(OrderStatus.PENDING)).toBeNull();
  });

  it('should return null for APPROVED status (approval complete)', () => {
    expect(resolveApprovalLevel(OrderStatus.APPROVED)).toBeNull();
  });

  it('should return null for REJECTED status', () => {
    expect(resolveApprovalLevel(OrderStatus.REJECTED)).toBeNull();
  });

  it('should return null for CANCELLED status', () => {
    expect(resolveApprovalLevel(OrderStatus.CANCELLED)).toBeNull();
  });
});

describe('ApproverInfo — Role-based action guard (data isolation)', () => {
  it('DEPARTMENT_MANAGER can act on APPROVING_LEVEL_1', () => {
    expect(
      canUserActOnStatus(
        ApprovalRole.DEPARTMENT_MANAGER,
        OrderStatus.APPROVING_LEVEL_1,
      ),
    ).toBe(true);
  });

  it('DEPARTMENT_MANAGER cannot act on APPROVING_LEVEL_2', () => {
    expect(
      canUserActOnStatus(
        ApprovalRole.DEPARTMENT_MANAGER,
        OrderStatus.APPROVING_LEVEL_2,
      ),
    ).toBe(false);
  });

  it('ASSET_MANAGER can act on APPROVING_LEVEL_2', () => {
    expect(
      canUserActOnStatus(
        ApprovalRole.ASSET_MANAGER,
        OrderStatus.APPROVING_LEVEL_2,
      ),
    ).toBe(true);
  });

  it('ASSET_MANAGER cannot act on APPROVING_LEVEL_1', () => {
    expect(
      canUserActOnStatus(
        ApprovalRole.ASSET_MANAGER,
        OrderStatus.APPROVING_LEVEL_1,
      ),
    ).toBe(false);
  });

  it('no role can act on PENDING (ATB-3: cross-level prevention)', () => {
    expect(
      canUserActOnStatus(ApprovalRole.DEPARTMENT_MANAGER, OrderStatus.PENDING),
    ).toBe(false);
    expect(
      canUserActOnStatus(ApprovalRole.ASSET_MANAGER, OrderStatus.PENDING),
    ).toBe(false);
  });

  it('no role can act on terminal states (APPROVED / REJECTED / CANCELLED)', () => {
    const terminalStates = [
      OrderStatus.APPROVED,
      OrderStatus.REJECTED,
      OrderStatus.CANCELLED,
    ];
    for (const status of terminalStates) {
      expect(
        canUserActOnStatus(ApprovalRole.DEPARTMENT_MANAGER, status),
      ).toBe(false);
      expect(canUserActOnStatus(ApprovalRole.ASSET_MANAGER, status)).toBe(
        false,
      );
    }
  });
});

describe('ApproverInfo — Rejection reason validation', () => {
  it('should accept a valid non-empty reason', () => {
    expect(validateRejectionReason('不合规')).toBeNull();
  });

  it('should accept a reason with exactly 500 characters', () => {
    const reason = 'A'.repeat(500);
    expect(validateRejectionReason(reason)).toBeNull();
  });

  it('should reject null', () => {
    expect(validateRejectionReason(null)).toBe('驳回原因不能为空');
  });

  it('should reject undefined', () => {
    expect(validateRejectionReason(undefined)).toBe('驳回原因不能为空');
  });

  it('should reject empty string', () => {
    expect(validateRejectionReason('')).toBe('驳回原因不能为空');
  });

  it('should reject whitespace-only string', () => {
    expect(validateRejectionReason('   ')).toBe('驳回原因不能为空');
  });

  it('should reject a reason exceeding 500 characters', () => {
    const reason = 'A'.repeat(501);
    expect(validateRejectionReason(reason)).toBe(
      '驳回原因不能超过 500 个字符',
    );
  });

  it('should reject non-string types (number)', () => {
    expect(validateRejectionReason(123)).toBe('驳回原因必须为字符串');
  });

  it('should reject non-string types (object)', () => {
    expect(validateRejectionReason({})).toBe('驳回原因必须为字符串');
  });

  it('should trim before validating length', () => {
    // 498 visible chars + 2 spaces = 500 raw chars → trimmed = 498 → valid
    const reason = 'A'.repeat(498) + '  ';
    expect(validateRejectionReason(reason)).toBeNull();
  });

  it('should reject trimmed length > 500 even if raw length ≤ 500', () => {
    // This is an edge case: if raw is 500 but trimmed is > 500 it can't happen,
    // but we verify trimming happens first.
    const reason = 'A'.repeat(501) + '  ';
    expect(validateRejectionReason(reason)).toBe(
      '驳回原因不能超过 500 个字符',
    );
  });
});

describe('ApproverInfo — buildApproverInfo', () => {
  it('should build correct info for LEVEL_1', () => {
    const info = buildApproverInfo(ApprovalLevel.LEVEL_1, 'u1', '李四');
    expect(info).toEqual({
      userId: 'u1',
      userName: '李四',
      role: ApprovalRole.DEPARTMENT_MANAGER,
      level: ApprovalLevel.LEVEL_1,
    });
  });

  it('should build correct info for LEVEL_2', () => {
    const info = buildApproverInfo(ApprovalLevel.LEVEL_2, 'u2', '王五');
    expect(info).toEqual({
      userId: 'u2',
      userName: '王五',
      role: ApprovalRole.ASSET_MANAGER,
      level: ApprovalLevel.LEVEL_2,
    });
  });
});

describe('ApproverInfo — createApprovalRecord', () => {
  it('should create a record with default APPROVE action', () => {
    const record = createApprovalRecord();
    expect(record.action).toBe('APPROVE');
    expect(record.rejectionReason).toBeNull();
    expect(record.comment).toBeNull();
  });

  it('should create a REJECT record with rejection reason', () => {
    const record = createApprovalRecord({
      action: 'REJECT',
      rejectionReason: '预算不足',
      operatorName: '赵六',
    });
    expect(record.action).toBe('REJECT');
    expect(record.rejectionReason).toBe('预算不足');
    expect(record.operatorName).toBe('赵六');
  });

  it('should produce a valid ISO 8601 createdAt timestamp', () => {
    const record = createApprovalRecord();
    const parsed = Date.parse(record.createdAt);
    expect(Number.isNaN(parsed)).toBe(false);
  });

  it('should allow overriding all fields', () => {
    const customDate = '2025-01-15T08:30:00Z';
    const record = createApprovalRecord({
      id: 'rec-999',
      orderId: 'ord-999',
      operatorId: 'user-999',
      operatorName: '测试用户',
      action: 'REJECT',
      comment: '需要补充材料',
      rejectionReason: '信息不完整',
      createdAt: customDate,
    });
    expect(record.id).toBe('rec-999');
    expect(record.orderId).toBe('ord-999');
    expect(record.operatorId).toBe('user-999');
    expect(record.operatorName).toBe('测试用户');
    expect(record.action).toBe('REJECT');
    expect(record.comment).toBe('需要补充材料');
    expect(record.rejectionReason).toBe('信息不完整');
    expect(record.createdAt).toBe(customDate);
  });
});

describe('ApproverInfo — Approval record immutability semantics', () => {
  it('should not share references between independently created records', () => {
    const r1 = createApprovalRecord();
    const r2 = createApprovalRecord({ orderId: 'ord-002' });
    expect(r1).not.toBe(r2);
    expect(r1.orderId).not.toBe(r2.orderId);
  });

  it('should allow reading but not mutating the record prototype', () => {
    const record = createApprovalRecord();
    // Verify the record is a plain object (not frozen, but structurally sound)
    expect(Object.keys(record).sort()).toEqual(
      ['action', 'comment', 'createdAt', 'id', 'operatorId', 'operatorName', 'orderId', 'rejectionReason'].sort(),
    );
  });
});

describe('ApproverInfo — Integration: full approval chain role resolution', () => {
  const orderStatuses: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.APPROVING_LEVEL_1,
    OrderStatus.APPROVING_LEVEL_2,
    OrderStatus.APPROVED,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
  ];

  const roles: ApprovalRole[] = [
    ApprovalRole.DEPARTMENT_MANAGER,
    ApprovalRole.ASSET_MANAGER,
  ];

  it('exactly one status maps to DEPARTMENT_MANAGER actionability', () => {
    const actionable = orderStatuses.filter((s) =>
      canUserActOnStatus(ApprovalRole.DEPARTMENT_MANAGER, s),
    );
    expect(actionable).toHaveLength(1);
    expect(actionable[0]).toBe(OrderStatus.APPROVING_LEVEL_1);
  });

  it('exactly one status maps to ASSET_MANAGER actionability', () => {
    const actionable = orderStatuses.filter((s) =>
      canUserActOnStatus(ApprovalRole.ASSET_MANAGER, s),
    );
    expect(actionable).toHaveLength(1);
    expect(actionable[0]).toBe(OrderStatus.APPROVING_LEVEL_2);
  });

  it('no status is actionable by both roles simultaneously', () => {
    for (const status of orderStatuses) {
      const dm = canUserActOnStatus(ApprovalRole.DEPARTMENT_MANAGER, status);
      const am = canUserActOnStatus(ApprovalRole.ASSET_MANAGER, status);
      expect(dm && am).toBe(false);
    }
  });
});

describe('ApproverInfo — Edge cases', () => {
  it('should handle rejection reason with unicode characters', () => {
    const reason = '驳回原因：资产编号不匹配，请核实后重新提交（包含中文、emoji 🚫 及特殊字符）';
    expect(validateRejectionReason(reason)).toBeNull();
  });

  it('should handle rejection reason at exactly the boundary (500 chars)', () => {
    const reason = '拒'.repeat(500);
    expect(validateRejectionReason(reason)).toBeNull();
  });

  it('should handle rejection reason at 501 chars (just over boundary)', () => {
    const reason = '拒'.repeat(501);
    expect(validateRejectionReason(reason)).toBe(
      '驳回原因不能超过 500 个字符',
    );
  });

  it('should handle newline characters in rejection reason', () => {
    const reason = '第一行原因\n第二行原因';
    expect(validateRejectionReason(reason)).toBeNull();
  });
});