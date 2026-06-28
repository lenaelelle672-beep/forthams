import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildChannelConfigPayload } from './NotificationChannelTab';

describe('buildChannelConfigPayload', () => {
  it('omits a blank sensitive field from the payload', () => {
    const payload = buildChannelConfigPayload({
      channelType: 'DINGTALK',
      configName: '运维群',
      webhookUrl: 'https://example.com/robot/send',
      secret: '   ',
      enabled: 1,
      description: '测试渠道',
    });

    expect(payload).not.toHaveProperty('secret');
  });

  it('trims and includes the sensitive field when provided', () => {
    const payload = buildChannelConfigPayload({
      channelType: 'DINGTALK',
      configName: '运维群',
      webhookUrl: 'https://example.com/robot/send',
      secret: '  rotated-signature-placeholder  ',
      enabled: 1,
    });

    expect(payload.secret).toBe('rotated-signature-placeholder');
  });

  it('trims configName and webhookUrl', () => {
    const payload = buildChannelConfigPayload({
      channelType: 'DINGTALK',
      configName: '  运维群  ',
      webhookUrl: '  https://example.com/robot/send  ',
      enabled: 1,
      description: '  用于告警通知  ',
    });

    expect(payload.configName).toBe('运维群');
    expect(payload.webhookUrl).toBe('https://example.com/robot/send');
    expect(payload.description).toBe('用于告警通知');
  });

  it('omits a blank webhook URL from update payloads', () => {
    const payload = buildChannelConfigPayload({
      configName: '运维群',
      webhookUrl: '   ',
      enabled: 1,
      description: '  仅更新名称  ',
    });

    expect(payload).not.toHaveProperty('webhookUrl');
    expect(payload.description).toBe('仅更新名称');
  });
});

describe('NotificationChannelTab copy', () => {
  it('states that channel testing is type-level instead of row-level', () => {
    const source = readFileSync(join(process.cwd(), 'src/pages/settings/NotificationChannelTab.tsx'), 'utf8');

    expect(source).toContain('按渠道类型测试');
    expect(source).toContain('测试全部已启用的');
    expect(source).toContain('测类型');
  });
});
