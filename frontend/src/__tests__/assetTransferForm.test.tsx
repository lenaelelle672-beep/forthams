/**
 * assetTransferForm.test.tsx
 *
 * Tests for the AssetTransferFormPage covering:
 * - zod schema validation for transfer form fields
 * - @Valid rejection scenarios: invalid field handling
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { buildAssetTransferRuntimeBusinessData } from '@/pages/disposal/AssetTransferFormPage';

// Replicate the schema from AssetTransferFormPage.tsx
const transferSchema = z.object({
  transferType: z.string().min(1, '请选择调拨类型'),
  fromDept: z.string().min(1, '请选择调出部门'),
  toDept: z.string().min(1, '请选择调入部门'),
  fromLocation: z.string().optional(),
  toLocation: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']),
  notes: z.string().optional(),
});

describe('AssetTransferFormPage schema validation', () => {
  it('should reject empty form', () => {
    const result = transferSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject empty required fields', () => {
    const result = transferSchema.safeParse({
      transferType: '',
      fromDept: '',
      toDept: '',
      priority: '' as any,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path[0]);
      expect(paths).toContain('transferType');
      expect(paths).toContain('fromDept');
      expect(paths).toContain('toDept');
      expect(paths).toContain('priority');
    }
  });

  it('should reject invalid priority value', () => {
    const result = transferSchema.safeParse({
      transferType: '内部调拨',
      fromDept: '1',
      toDept: '2',
      priority: 'INVALID' as any,
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid LOW priority', () => {
    const result = transferSchema.safeParse({
      transferType: '内部调拨',
      fromDept: '1',
      toDept: '2',
      priority: 'LOW',
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid NORMAL priority', () => {
    const result = transferSchema.safeParse({
      transferType: '内部调拨',
      fromDept: '1',
      toDept: '2',
      priority: 'NORMAL',
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid HIGH priority', () => {
    const result = transferSchema.safeParse({
      transferType: '内部调拨',
      fromDept: '1',
      toDept: '2',
      priority: 'HIGH',
    });
    expect(result.success).toBe(true);
  });

  it('should accept form with all optional fields', () => {
    const result = transferSchema.safeParse({
      transferType: '内部调拨',
      fromDept: '1',
      toDept: '2',
      fromLocation: 'A栋3楼',
      toLocation: 'B栋5楼',
      priority: 'NORMAL',
      notes: '加急处理',
    });
    expect(result.success).toBe(true);
  });

  it('should accept form without optional fields', () => {
    const result = transferSchema.safeParse({
      transferType: '内部调拨',
      fromDept: '1',
      toDept: '2',
      priority: 'HIGH',
    });
    expect(result.success).toBe(true);
  });

  it('should require transferType field with specific error message', () => {
    const result = transferSchema.safeParse({
      transferType: '',
      fromDept: '1',
      toDept: '2',
      priority: 'NORMAL',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const typeErr = result.error.issues.find(i => i.path[0] === 'transferType');
      expect(typeErr).toBeDefined();
      expect(typeErr!.message).toBe('请选择调拨类型');
    }
  });

  it('should not require a user-selected workflow field', () => {
    const result = transferSchema.safeParse({
      transferType: '内部调拨',
      fromDept: '1',
      toDept: '2',
      priority: 'NORMAL',
    });
    expect(result.success).toBe(true);
  });

  it('should map runtime preview business data without faking amount', () => {
    const result = buildAssetTransferRuntimeBusinessData({
      transferType: 'INTERNAL',
      fromDept: '1',
      toDept: '2',
      fromLocation: '10',
      toLocation: '20',
      priority: 'HIGH',
      notes: '跨部门调拨',
    }, [{ id: 'A-1' }, { id: 2 }]);

    expect(result).toMatchObject({
      transferType: 'INTERNAL',
      fromDept: '1',
      toDept: '2',
      fromLocation: '10',
      toLocation: '20',
      priority: 'HIGH',
      notes: '跨部门调拨',
      assetIds: ['A-1', '2'],
      assetCount: 2,
      targetDeptId: '2',
      reason: '跨部门调拨',
      description: '跨部门调拨',
    });
    expect(result).not.toHaveProperty('amount');
  });
});
