import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import {
  dryRunSystemSyncRule,
  getSystemSyncQueueSummary,
  listSystemSyncRules,
  retrySystemSyncLog,
} from '../api/systemSyncRules';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('systemSyncRules API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只访问同步规则专属列表', async () => {
    mockedApi.get.mockResolvedValueOnce([]);

    await listSystemSyncRules();

    expect(mockedApi.get).toHaveBeenCalledWith('/system/sync-rules');
  });

  it('dry-run 默认强制 dryRun=true', async () => {
    mockedApi.post.mockResolvedValueOnce({ dryRun: true });

    await dryRunSystemSyncRule(9, { triggerSource: 'manual' });

    expect(mockedApi.post).toHaveBeenCalledWith('/system/sync-rules/9/dry-run', { triggerSource: 'manual', dryRun: true });
  });

  it('只开放单条日志重试', async () => {
    mockedApi.post.mockResolvedValueOnce({ id: 11 });

    await retrySystemSyncLog(11);

    expect(mockedApi.post).toHaveBeenCalledWith('/system/sync-rules/logs/11/retry');
  });

  it('队列仅开放只读摘要', async () => {
    mockedApi.get.mockResolvedValueOnce({ queueConsumptionEnabled: false });

    await getSystemSyncQueueSummary();

    expect(mockedApi.get).toHaveBeenCalledWith('/system/sync-rules/queue/summary');
  });
});
