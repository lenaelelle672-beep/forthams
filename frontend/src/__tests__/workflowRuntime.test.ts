import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import { getWorkflowRuntimePendingCount, listWorkflowRuntime } from '../api/workflowRuntime';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('workflowRuntime API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('使用 /approvals/list 查询运行态审批流程并传递筛选条件', async () => {
    mockedApi.get.mockResolvedValueOnce({ records: [], total: 0, size: 20, current: 2, pages: 0 });

    await listWorkflowRuntime({ page: 2, pageSize: 20, status: '  PENDING  ', processType: '  RETIREMENT  ' });

    expect(mockedApi.get).toHaveBeenCalledWith('/approvals/list', {
      params: { page: 2, pageSize: 20, status: 'PENDING', keyword: 'RETIREMENT' },
    });
  });

  it('空筛选不传给后端，保持只读默认分页', async () => {
    mockedApi.get.mockResolvedValueOnce({ records: [], total: 0, size: 50, current: 1, pages: 0 });

    await listWorkflowRuntime({ status: '   ', processType: '   ' });

    expect(mockedApi.get).toHaveBeenCalledWith('/approvals/list', {
      params: { page: 1, pageSize: 50 },
    });
  });

  it('使用 /approvals/pending/count 读取待处理数量', async () => {
    mockedApi.get.mockResolvedValueOnce(3);

    const result = await getWorkflowRuntimePendingCount();

    expect(mockedApi.get).toHaveBeenCalledWith('/approvals/pending/count');
    expect(result).toBe(3);
  });
});
