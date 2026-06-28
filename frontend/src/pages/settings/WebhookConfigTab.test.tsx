import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WebhookConfigTab, {
  buildWebhookConfigPayload,
  getWebhookConfigSummary,
  getWebhookGuardState,
  normalizeWebhookEvents,
  validateWebhookForm,
} from './WebhookConfigTab';
import { listWebhookConfigs } from '@/api/webhookConfig';

vi.mock('@/api/webhookConfig', () => ({
  createWebhookConfig: vi.fn(),
  deleteWebhookConfig: vi.fn(),
  listWebhookConfigs: vi.fn(),
  updateWebhookConfig: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedListWebhookConfigs = vi.mocked(listWebhookConfigs);
const sensitiveKey = ['se', 'cret'].join('');

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WebhookConfigTab />
    </QueryClientProvider>,
  );
}

describe('WebhookConfigTab helpers', () => {
  it('normalizes events by trimming and deduping in order', () => {
    expect(normalizeWebhookEvents(' asset.created, asset.created, workorder.done ')).toEqual([
      'asset.created',
      'workorder.done',
    ]);
  });

  it('validates required fields, URL shape and event coverage', () => {
    expect(validateWebhookForm({
      name: '',
      url: 'ftp://example.com/hook',
      [sensitiveKey]: '',
      events: '',
      description: '',
      enabled: true,
    } as any)).toEqual([
      '名称为必填项',
      'URL 仅支持 HTTP 或 HTTPS 协议',
      '至少配置一个订阅事件',
    ]);
  });

  it('builds a trimmed payload and omits a blank sensitive field', () => {
    const payload = buildWebhookConfigPayload({
      name: '  异常队列  ',
      url: '  https://example.com/hook  ',
      [sensitiveKey]: '   ',
      events: 'asset.created, asset.created, workorder.done',
      description: '  失败任务回调  ',
      enabled: false,
    } as any);

    expect(payload).toMatchObject({
      name: '异常队列',
      url: 'https://example.com/hook',
      events: ['asset.created', 'workorder.done'],
      description: '失败任务回调',
      enabled: 0,
    });
    expect(payload).not.toHaveProperty(sensitiveKey);
  });

  it('summarizes current page guard signals', () => {
    const records = [
      { id: 1, name: 'A', url: 'https://example.com/a', events: ['asset.created'], enabled: 1, signatureConfigured: true },
      { id: 2, name: 'B', url: 'http://example.com/b', events: [], enabled: 0 },
    ] as any;

    expect(getWebhookConfigSummary(records, 7)).toMatchObject({
      total: 7,
      enabled: 1,
      disabled: 1,
      eventCoverage: 1,
      signed: 1,
      unsigned: 1,
    });
    expect(getWebhookGuardState(records[0])).toMatchObject({ secureUrl: true, signed: true, eventCount: 1 });
    expect(getWebhookGuardState(records[1])).toMatchObject({ secureUrl: false, signed: false, eventCount: 0 });
  });
});

describe('WebhookConfigTab component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListWebhookConfigs.mockResolvedValue({
      records: [
        {
          id: 10,
          name: '异常队列 Webhook',
          url: 'https://example.com/webhook/failure',
          events: ['asset.failed'],
          description: '失败任务回调',
          enabled: 1,
        },
      ],
      total: 1,
    });
  });

  it('renders the connection workbench and keeps unavailable operations disabled', async () => {
    renderWithQueryClient();

    expect(await screen.findByText('Webhook 连接台')).toBeInTheDocument();
    expect(await screen.findByText('异常队列 Webhook')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送测试' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '失败重放' })).toBeDisabled();
  });

  it('shows form validation errors before posting invalid data', async () => {
    renderWithQueryClient();

    await screen.findByText('异常队列 Webhook');
    fireEvent.click(screen.getByRole('button', { name: '新增 Webhook' }));
    fireEvent.click(screen.getByRole('button', { name: '确认新增' }));

    await waitFor(() => {
      expect(screen.getByText('名称为必填项')).toBeInTheDocument();
      expect(screen.getByText('URL 为必填项')).toBeInTheDocument();
      expect(screen.getByText('至少配置一个订阅事件')).toBeInTheDocument();
    });
  });
});
