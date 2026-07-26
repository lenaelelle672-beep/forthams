import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemSettingsCommandCenterWorkbenchPage from '../SystemSettingsCommandCenterWorkbenchPage';
import { listWorkflowDefinitions } from '../../../api/workflowDefinitions';
import { getWorkflowRuntimePendingCount, getWorkflowRuntimeSlaSummary, listWorkflowRuntime, listWorkflowRuntimeSlaTimeoutRecords } from '../../../api/workflowRuntime';

vi.mock('../../../api/workflowDefinitions', () => ({
  listWorkflowDefinitions: vi.fn(),
}));

vi.mock('../../../api/workflowRuntime', () => ({
  getWorkflowRuntimePendingCount: vi.fn(),
  getWorkflowRuntimeSlaSummary: vi.fn(),
  listWorkflowRuntime: vi.fn(),
  listWorkflowRuntimeSlaTimeoutRecords: vi.fn(),
}));

const mockedDefinitions = vi.mocked(listWorkflowDefinitions);
const mockedRuntime = vi.mocked(listWorkflowRuntime);
const mockedPendingCount = vi.mocked(getWorkflowRuntimePendingCount);
const mockedSlaSummary = vi.mocked(getWorkflowRuntimeSlaSummary);
const mockedSlaTimeoutRecords = vi.mocked(listWorkflowRuntimeSlaTimeoutRecords);
const configuredState = 'PUBLISHED';
const pendingState = 'PENDING';
const completedState = 'APPROVED';

describe('SystemSettingsCommandCenterWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSlaSummary.mockResolvedValue({
      totalConfigs: 1,
      activeConfigs: 1,
      overdueCount: 2,
      warningCount: 3,
      criticalCount: 1,
      timeoutRecordCount: 1,
      riskCounts: { HIGH: 1 },
      nodeDurationSummary: ['MANAGER_REVIEW 超时 120 分钟'],
      abnormalTraceSummary: ['实例 PR***01 存在SLA异常轨迹'],
      recentTimeoutRecords: [],
      exportMaskingNotice: '导出仅返回 masked/summary 字段，不包含 storage key。',
      readOnly: true,
      tenantScoped: true,
    });
    mockedSlaTimeoutRecords.mockResolvedValue([{ id: 10, processKey: 'ASSET_TRANSFER', nodeKey: 'MANAGER_REVIEW', maskedBusinessSummary: '业务摘要已脱敏', riskLevel: 'HIGH', timeoutMinutes: 120, masked: true }]);
  });

  it('只读聚合流程模板、运行实例、待处理数量与健康摘要', async () => {
    mockedDefinitions.mockResolvedValueOnce([
      { businessType: 'ASSET_TRANSFER', name: '资产转移流程', status: configuredState, version: 2, definition: { nodes: [{ id: 'n1' }, { id: 'n2' }] } },
      { businessType: 'ASSET_CLEARANCE', name: '资产清退流程', status: 'UNCONFIGURED', version: 0, definition: { nodes: [] } },
    ]);
    mockedRuntime.mockResolvedValueOnce({
      records: [
        { id: 1, processNo: 'APR-001', processType: 'ASSET_TRANSFER', businessId: 10, currentStep: 2, status: pendingState, updateTime: '2026-07-06T10:00:00' },
      ],
      total: 1,
      size: 50,
      current: 1,
      pages: 1,
    });
    mockedPendingCount.mockResolvedValueOnce(4);

    render(<SystemSettingsCommandCenterWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('流程控制台只读聚合加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '流程模板' })).toBeInTheDocument();
    expect(screen.getAllByText('ASSET_TRANSFER').length).toBeGreaterThan(0);
    expect(screen.getByText('APR-001')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/只读聚合 \/workflows、\/approvals\/list、\/approvals\/pending\/count、\/sla-config\/runtime-summary/)).toBeInTheDocument();
    expect(screen.getByText(/不支持发起\/审批\/重试\/终止\/发布\/编辑，不代表流程控制闭环/)).toBeInTheDocument();
    expect(screen.getByText(/SLA 只读联动已纳入流程平台 9\/9/)).toBeInTheDocument();
    expect(screen.getByText(/仍非 44 项全量覆盖，不代表 Workbench V3 全量完成/)).toBeInTheDocument();
    expect(screen.getByText('SLA 超时记录')).toBeInTheDocument();
    expect(screen.getByText(/业务摘要已脱敏/)).toBeInTheDocument();
    expect(screen.getByText(/MANAGER_REVIEW 超时 120 分钟/)).toBeInTheDocument();
    expect(mockedRuntime).toHaveBeenCalledWith({ page: 1, pageSize: 50, status: undefined, processType: '' });
    expect(mockedSlaTimeoutRecords).toHaveBeenCalledWith({ status: 'OPEN' });
  });

  it('支持搜索、模板状态筛选、实例状态筛选与重新加载', async () => {
    mockedDefinitions.mockResolvedValue([
      { businessType: 'ASSET_TRANSFER', name: '资产转移流程', status: configuredState, version: 1, definition: { nodes: [] } },
      { businessType: 'WORK_ORDER', name: '工单流程', status: 'UNCONFIGURED', version: 0, definition: { nodes: [] } },
    ]);
    mockedRuntime
      .mockResolvedValueOnce({ records: [{ id: 1, processNo: 'APR-001', processType: 'ASSET_TRANSFER', status: pendingState }], total: 1, size: 50, current: 1, pages: 1 })
      .mockResolvedValueOnce({ records: [{ id: 2, processNo: 'APR-002', processType: 'WORK_ORDER', status: completedState }], total: 1, size: 50, current: 1, pages: 1 })
      .mockResolvedValueOnce({ records: [{ id: 3, processNo: 'APR-003', processType: 'WORK_ORDER', status: completedState }], total: 1, size: 50, current: 1, pages: 1 })
      .mockResolvedValueOnce({ records: [{ id: 4, processNo: 'APR-004', processType: 'WORK_ORDER', status: completedState }], total: 1, size: 50, current: 1, pages: 1 });
    mockedPendingCount.mockResolvedValue(2);

    render(<SystemSettingsCommandCenterWorkbenchPage />);
    expect(await screen.findByText('APR-001')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('模板状态筛选'), 'unconfigured');
    expect(screen.queryByText('资产转移流程')).not.toBeInTheDocument();
    expect(screen.getByText('工单流程')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('实例状态筛选'), 'completed');
    await waitFor(() => expect(mockedRuntime).toHaveBeenLastCalledWith({ page: 1, pageSize: 50, status: completedState, processType: '' }));

    await userEvent.type(screen.getByPlaceholderText('按模板、流程类型或实例编号搜索'), '  WORK_ORDER  ');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    await waitFor(() => expect(mockedRuntime).toHaveBeenLastCalledWith({ page: 1, pageSize: 50, status: completedState, processType: 'WORK_ORDER' }));
    expect(await screen.findByText('APR-003')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(mockedRuntime).toHaveBeenCalledTimes(4));
  });

  it('空态、错误脱敏态与无权限态可见且没有写操作按钮', async () => {
    mockedDefinitions.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('token=raw-secret'));
    mockedRuntime.mockResolvedValue({ records: [], total: 0, size: 50, current: 1, pages: 0 });
    mockedPendingCount.mockResolvedValue(0);

    render(<SystemSettingsCommandCenterWorkbenchPage />);

    expect(await screen.findByText('暂无符合条件的流程模板。')).toBeInTheDocument();
    expect(screen.getByText('暂无符合条件的运行实例。')).toBeInTheDocument();
    const forbiddenButtons = ['发起' + '流程', '审批' + '通过', '驳' + '回', '重试', '终止', '发布', '编辑'];
    for (const label of forbiddenButtons) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemSettingsCommandCenterWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问流程控制台/)).toBeInTheDocument();
  });
});
