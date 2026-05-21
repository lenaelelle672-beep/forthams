import { describe, expect, it } from 'vitest';

import { formatStatusLabel } from '../../src/app/constants/assetStatus';

describe('formatStatusLabel', () => {
  it('formats workflow definition statuses used by workflow management', () => {
    expect(formatStatusLabel('UNCONFIGURED')).toBe('未配置');
    expect(formatStatusLabel('DRAFT')).toBe('草稿');
    expect(formatStatusLabel('PUBLISHED')).toBe('已发布');
    expect(formatStatusLabel('DISABLED')).toBe('已停用');
    expect(formatStatusLabel('ENABLED')).toBe('已启用');
  });
});
