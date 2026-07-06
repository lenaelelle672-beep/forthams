import { describe, expect, it } from 'vitest';
import { businessFlowOptions, isCustomBusinessType } from './workflowBusiness';

describe('workflowBusiness constants', () => {
  it('points predefined workflow form paths to registered desktop routes', () => {
    expect(
      businessFlowOptions.map((flow) => [flow.businessType, flow.formPath]),
    ).toEqual([
      ['ASSET_TRANSFER', '/disposals/transfer/new'],
      ['ASSET_CLEARANCE', '/disposals/clearance/new'],
      ['ASSET_SCRAP', '/disposals/scrap/new'],
      ['ASSET_COMPENSATION', '/compensation/new'],
      ['RETIREMENT', '/retirement/new'],
    ]);
  });

  it('recognizes custom workflow business types by prefix', () => {
    expect(isCustomBusinessType('CUSTOM_PURCHASE')).toBe(true);
    expect(isCustomBusinessType('CUSTOM_PURCHASE_APPROVAL_2026')).toBe(true);
    expect(isCustomBusinessType('ASSET_TRANSFER')).toBe(false);
    expect(isCustomBusinessType('CUSTOM_')).toBe(false);
    expect(isCustomBusinessType('CUSTOM_1PURCHASE')).toBe(false);
    expect(isCustomBusinessType('CUSTOM_采购')).toBe(false);
    expect(isCustomBusinessType('CUSTOM_PURCHASE-APPROVAL')).toBe(false);
    expect(isCustomBusinessType(null)).toBe(false);
  });
});
