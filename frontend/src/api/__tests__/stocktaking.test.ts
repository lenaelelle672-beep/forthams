import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  adjustStocktakingTask,
  assignStocktakingTasks,
  completeStocktakingCycle,
  createStocktakingCycle,
  getStocktakingCycle,
  getStocktakingCycleStats,
  getStocktakingCycleTasks,
  getStocktakingTask,
  listStocktakingCycles,
  pauseStocktakingCycle,
  resumeStocktakingCycle,
  scanStocktakingTask,
} from '@/api/stocktaking';

const mockedHttp = vi.mocked(http);

describe('api/stocktaking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified baseURL cycle paths without duplicating /api', async () => {
    mockedHttp.get.mockResolvedValue([]);
    mockedHttp.post.mockResolvedValue(undefined);

    await listStocktakingCycles('IN_PROGRESS');
    await createStocktakingCycle({ cycleName: '六月循环盘点', cycleType: 'FULL' });
    await getStocktakingCycle(7);
    await getStocktakingCycleTasks(7);
    await getStocktakingCycleStats(7);
    await assignStocktakingTasks(7);
    await pauseStocktakingCycle(7);
    await resumeStocktakingCycle(7);
    await completeStocktakingCycle(7);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/stocktaking/cycles', {
      params: { status: 'IN_PROGRESS' },
    });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/stocktaking/cycles', {
      cycleName: '六月循环盘点',
      cycleType: 'FULL',
    });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/stocktaking/cycles/7');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/stocktaking/cycles/7/tasks');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/stocktaking/cycles/7/stats');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/stocktaking/cycles/7/assign');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/stocktaking/cycles/7/pause');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(4, '/stocktaking/cycles/7/resume');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(5, '/stocktaking/cycles/7/complete');
  });

  it('uses unified baseURL task paths without duplicating /api', async () => {
    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue(undefined);

    await getStocktakingTask(11);
    await scanStocktakingTask(11, { quantity: 3, photoUrl: 'data:image/jpeg;base64,abc' });
    await adjustStocktakingTask(11, { threshold: 1000, reason: '盘点差异调整' });

    expect(mockedHttp.get).toHaveBeenCalledWith('/stocktaking/tasks/11');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/stocktaking/tasks/11/scan', {
      quantity: 3,
      photoUrl: 'data:image/jpeg;base64,abc',
    });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/stocktaking/tasks/11/adjust', {
      threshold: 1000,
      reason: '盘点差异调整',
    });
  });
});
