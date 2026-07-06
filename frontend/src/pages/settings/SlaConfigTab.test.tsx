import { describe, expect, it } from 'vitest';

import {
  buildSlaConfigPayload,
  getSlaConfigStats,
  hasSlaConfigChanges,
  validateSlaConfigDraft,
} from './SlaConfigTab';
import type { SlaConfigItem } from '@/api/slaConfig';

function slaConfig(overrides: Partial<SlaConfigItem> = {}): SlaConfigItem {
  return {
    id: 1,
    priority: 'HIGH',
    responseHours: 2,
    resolveHours: 8,
    warningRatio: 0.75,
    status: 1,
    ...overrides,
  };
}

describe('SlaConfigTab helpers', () => {
  it('detects changes and only emits changed payload fields', () => {
    const item = slaConfig();
    const draft = {
      responseHours: 2,
      resolveHours: 10,
      warningRatio: 0.75,
      status: 0,
    };

    expect(hasSlaConfigChanges(item, draft)).toBe(true);
    expect(buildSlaConfigPayload(item, draft)).toEqual({
      resolveHours: 10,
      status: 0,
    });
  });

  it('returns no changes when the draft matches the persisted item', () => {
    const item = slaConfig();

    expect(hasSlaConfigChanges(item, {
      responseHours: 2,
      resolveHours: 8,
      warningRatio: 0.75,
      status: 1,
    })).toBe(false);
    expect(buildSlaConfigPayload(item, { responseHours: 2 })).toEqual({});
  });

  it('flags response hours greater than resolve hours', () => {
    expect(validateSlaConfigDraft(slaConfig(), {
      responseHours: 12,
      resolveHours: 8,
    })).toContain('响应时限不能大于解决时限');
  });

  it('flags zero warning ratio', () => {
    expect(validateSlaConfigDraft(slaConfig(), {
      warningRatio: 0,
    })).toContain('预警阈值必须大于 0 且不超过 100%');
  });

  it('summarizes SLA matrix stats', () => {
    expect(getSlaConfigStats([
      slaConfig({ id: 1, priority: 'LOW', responseHours: 6, resolveHours: 48, status: 1 }),
      slaConfig({ id: 2, priority: 'MEDIUM', responseHours: 4, resolveHours: 24, status: 0 }),
      slaConfig({ id: 3, priority: 'CRITICAL', responseHours: 1, resolveHours: 4, status: 1 }),
    ])).toEqual({
      total: 3,
      enabled: 2,
      disabled: 1,
      criticalResolveHours: 4,
      minResponseHours: 1,
    });
  });
});
