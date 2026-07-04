import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemSyncRulesWorkbenchPage from '../SystemSyncRulesWorkbenchPage';
import { dryRunSystemSyncRule, getSystemSyncQueueSummary, listSystemSyncRules, retrySystemSyncLog } from '../../../api/systemSyncRules';

vi.mock('../../../api/systemSyncRules', () => ({
  dryRunSystemSyncRule: vi.fn(),
  getSystemSyncQueueSummary: vi.fn(),
  listSystemSyncRules: vi.fn(),
  retrySystemSyncLog: vi.fn(),
}));

const mockedList = vi.mocked(listSystemSyncRules);
const mockedQueue = vi.mocked(getSystemSyncQueueSummary);
const mockedDryRun = vi.mocked(dryRunSystemSyncRule);
const mockedRetry = vi.mocked(retrySystemSyncLog);

describe('SystemSyncRulesWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只展示 dry-run、单条日志重试与只读队列摘要', async () => {
    mockedList.mockResolvedValueOnce([{ id: 9, interfaceId: 1, ruleName: '资产同步规则', triggerType: 'MANUAL', enabled: true }]);
    mockedQueue.mockResolvedValueOnce({ pending: 0, running: 0, failed: 0, nextRetry: 0, queueConsumptionEnabled: false, mode: 'READ_ONLY_SUMMARY' });
    mockedDryRun.mockResolvedValueOnce({ id: 1, ruleId: 9, status: 'SUCCESS', executionMode: 'DRY_RUN', dryRun: true, message: 'dry-run 完成' });
    mockedRetry.mockResolvedValueOnce({ id: 1, ruleId: 9, status: 'FAILED', executionMode: 'DRY_RUN', dryRun: true });

    render(<SystemSyncRulesWorkbenchPage embeddedInWorkbench />);

    expect(await screen.findByText('资产同步规则')).toBeInTheDocument();
    expect(screen.getByText(/队列消费已禁用/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'dry-run' }));
    expect(await screen.findByText('dry-run 完成')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '单条日志重试' }));
    expect(mockedRetry).toHaveBeenCalledWith(1);
  });

  it('错误态展示脱敏文案', async () => {
    mockedList.mockRejectedValueOnce(new Error('sql detail'));
    mockedQueue.mockResolvedValueOnce({ pending: 0, running: 0, failed: 0, nextRetry: 0, queueConsumptionEnabled: false, mode: 'READ_ONLY_SUMMARY' });

    render(<SystemSyncRulesWorkbenchPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
  });
});
