/**
 * idleAssetsPublish.test.ts
 *
 * Tests for the IdleAssetsPage publish validation covering:
 * - zod schema validation for publish title and deadline
 * - @Valid rejection scenarios: empty/invalid input rejection
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Replicate the same publishSchema from IdleAssetsPage.tsx
const publishSchema = z.object({
  title: z.string().min(1, '公告标题不能为空'),
  deadline: z.string().min(1, '认领截止日期不能为空').refine(val => {
    if (!val) return false;
    const d = new Date(val);
    return !isNaN(d.getTime()) && d > new Date();
  }, '认领截止日期必须在今天之后'),
});

// Helper to get far-future date string (always valid)
function futureDateStr(daysFromNow = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

// Helper to find a field error by path
function findFieldError(result: z.SafeParseReturnType<any, any>, field: string) {
  if (result.success) return undefined;
  return result.error.issues.find(i => i.path[0] === field);
}

describe('IdleAssetsPage publish validation', () => {
  // ── Title validation ─────────────────────────────────────────────────────

  describe('publishTitle validation', () => {
    it('should reject empty title', () => {
      const result = publishSchema.safeParse({ title: '', deadline: futureDateStr() });
      expect(result.success).toBe(false);
      const titleErr = findFieldError(result, 'title');
      expect(titleErr).toBeDefined();
      expect(titleErr!.message).toBe('公告标题不能为空');
    });

    it('should accept non-empty title', () => {
      const result = publishSchema.safeParse({ title: '闲置资产公告', deadline: futureDateStr() });
      expect(result.success).toBe(true);
    });

    it('should accept title with single character', () => {
      const result = publishSchema.safeParse({ title: '公', deadline: futureDateStr() });
      expect(result.success).toBe(true);
    });
  });

  // ── Deadline validation ──────────────────────────────────────────────────

  describe('publishDeadline validation', () => {
    it('should reject empty deadline', () => {
      const result = publishSchema.safeParse({ title: '公告标题', deadline: '' });
      expect(result.success).toBe(false);
      const deadlineErr = findFieldError(result, 'deadline');
      expect(deadlineErr).toBeDefined();
    });

    it('should reject past date as deadline', () => {
      const result = publishSchema.safeParse({ title: '公告标题', deadline: '2020-01-01' });
      expect(result.success).toBe(false);
      const deadlineErr = findFieldError(result, 'deadline');
      expect(deadlineErr).toBeDefined();
      expect(deadlineErr!.message).toBe('认领截止日期必须在今天之后');
    });

    it('should accept future date as deadline', () => {
      const result = publishSchema.safeParse({ title: '公告标题', deadline: futureDateStr() });
      expect(result.success).toBe(true);
    });

    it('should reject invalid date string', () => {
      const result = publishSchema.safeParse({ title: '公告标题', deadline: 'not-a-date' });
      expect(result.success).toBe(false);
    });
  });

  // ── Combined validation ──────────────────────────────────────────────────

  describe('combined validation', () => {
    it('should reject when both title and deadline are empty', () => {
      const result = publishSchema.safeParse({ title: '', deadline: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map(i => i.path[0]);
        expect(paths).toContain('title');
        expect(paths).toContain('deadline');
      }
    });

    it('should accept valid full form', () => {
      const result = publishSchema.safeParse({ title: '办公设备闲置资产处置公告', deadline: futureDateStr() });
      expect(result.success).toBe(true);
    });
  });
});
