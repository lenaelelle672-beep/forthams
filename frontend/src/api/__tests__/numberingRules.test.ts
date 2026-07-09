import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import http from '@/utils/http';
import { numberingRulesApi } from '@/api/numberingRules';

const mockedHttp = vi.mocked(http);
const wrapperSource = readFileSync('src/api/numberingRules.ts', 'utf8');

describe('api/numberingRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('只调用 /numbering-rules list/detail/meta/preview 合同', async () => {
    const rule = { ruleKey: 'numbering.rule.asset', name: '资产编号规则', template: 'AUTO-{YYYYMMDD}-{SEQ}' };
    const meta = {
      defaultRules: [rule],
      allowedVariables: [{ value: '{SEQ}', label: '样例序号' }],
      previewPolicy: { deterministic: true, noPersistence: true, noSequenceReserved: true, runtimeEffect: false, cacheRefreshed: false, sequenceAllocated: false, persistent: false },
      tenantScoped: true,
      readOnly: true,
      noPersistencePreview: true,
      noSequenceReserved: true,
      runtimeEffect: false,
      cacheRefreshed: false,
      sequenceAllocated: false,
      persistent: false,
      authority: 'system_config:numbering.rule.*',
      readonlyBoundary: '只读编号规则目录',
      nonGoals: ['不保证并发唯一'],
    };
    const preview = {
      ruleKey: 'numbering.rule.asset',
      template: 'AUTO-{YYYYMMDD}-{SEQ}',
      previewValue: 'AUTO-20260708-009',
      usedVariables: ['{YYYYMMDD}', '{SEQ}'],
      missingVariables: [],
      rejectedVariables: [],
      authority: 'system_config:numbering.rule.*',
      warnings: ['不预留序号'],
      tenantScoped: true,
      noPersistence: true,
      noSequenceReserved: true,
      runtimeEffect: false,
      cacheRefreshed: false,
      sequenceAllocated: false,
      persistent: false,
      readonlyBoundary: '只读编号规则目录',
    };

    mockedHttp.get
      .mockResolvedValueOnce([rule])
      .mockResolvedValueOnce(rule)
      .mockResolvedValueOnce(meta);
    mockedHttp.post.mockResolvedValueOnce(preview);

    await expect(numberingRulesApi.list()).resolves.toEqual([rule]);
    await expect(numberingRulesApi.detail('numbering.rule.asset')).resolves.toBe(rule);
    await expect(numberingRulesApi.meta()).resolves.toBe(meta);
    await expect(numberingRulesApi.preview({ ruleKey: 'numbering.rule.asset', sampleAt: '2026-07-08T09:10:11', sampleSequence: '009' })).resolves.toBe(preview);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/numbering-rules');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/numbering-rules/numbering.rule.asset');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/numbering-rules/meta');
    expect(mockedHttp.post).toHaveBeenCalledWith('/numbering-rules/preview', { ruleKey: 'numbering.rule.asset', sampleAt: '2026-07-08T09:10:11', sampleSequence: '009' });
  });

  it('静态保持专属 wrapper，不复用系统参数 CRUD、缓存刷新或流程 helper', () => {
    expect(wrapperSource).toContain("'/numbering-rules'");
    expect(wrapperSource).toContain("'/numbering-rules/meta'");
    expect(wrapperSource).toContain("'/numbering-rules/preview'");
    expect(wrapperSource).not.toMatch(/systemConfig|system\/configs|createSysConfig|updateSysConfig|deleteSysConfig|saveSystemConfig|refreshSysConfigCache|workflowApi|@\/api\/workflow|routePermissions|auth\/login\/mobile/);
  });
});
