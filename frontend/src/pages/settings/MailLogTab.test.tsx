import { describe, expect, it } from 'vitest';
import { canRetryMailLog, getMailLogEmptyState, getMailLogStats } from './MailLogTab';
import type { MailLog } from '@/types/mailTemplate';

function mailLog(overrides: Partial<MailLog>): MailLog {
  return {
    id: 1,
    mailTo: 'ops@example.com',
    sendStatus: 'SUCCESS',
    ...overrides,
  };
}

describe('MailLogTab helpers', () => {
  it('allows retry only for failed logs under the retry limit', () => {
    expect(canRetryMailLog(mailLog({ sendStatus: 'FAILED', retryCount: 1, maxRetry: 3 }))).toBe(true);
    expect(canRetryMailLog(mailLog({ sendStatus: 'FAILED', retryCount: 3, maxRetry: 3 }))).toBe(false);
    expect(canRetryMailLog(mailLog({ sendStatus: 'FAILED', retryCount: 2 }))).toBe(true);
    expect(canRetryMailLog(mailLog({ sendStatus: 'SUCCESS', retryCount: 0, maxRetry: 3 }))).toBe(false);
    expect(canRetryMailLog(mailLog({ sendStatus: 'FAILED', retryCount: 0, maxRetry: 0 }))).toBe(false);
  });

  it('counts current page delivery and retry health', () => {
    const stats = getMailLogStats([
      mailLog({ sendStatus: 'SUCCESS' }),
      mailLog({ sendStatus: 'PENDING' }),
      mailLog({ sendStatus: 'FAILED', retryCount: 1, maxRetry: 3 }),
      mailLog({ sendStatus: 'FAILED', retryCount: 3, maxRetry: 3 }),
      mailLog({ sendStatus: 'FAILED', retryCount: 0, maxRetry: 0 }),
    ]);

    expect(stats).toEqual({
      total: 5,
      failed: 3,
      pending: 1,
      success: 1,
      retryable: 1,
      exhausted: 2,
    });
  });

  it('returns different empty states for no data and filtered misses', () => {
    expect(getMailLogEmptyState(false)).toEqual({
      title: '还没有邮件发送日志',
      description: '系统发送邮件后会在这里留下状态、错误和重试记录。',
    });

    expect(getMailLogEmptyState({ hasActiveFilters: true })).toEqual({
      title: '没有匹配的邮件日志',
      description: '调整模板编码、状态或业务类型后再试。',
    });
  });
});
