import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemSlaConfigWorkbenchPage from '../SystemSlaConfigWorkbenchPage';
import { slaConfigApi } from '../../../api/slaConfig';

vi.mock('../../../api/slaConfig', () => ({
  slaConfigApi: {
    listSlaConfigs: vi.fn(),
    getSlaConfig: vi.fn(),
    updateSlaConfig: vi.fn(),
    enableSlaConfig: vi.fn(),
    disableSlaConfig: vi.fn(),
    simulateSlaConfig: vi.fn(),
    getSlaRuntimeSummary: vi.fn(),
    listSlaTimeoutRecords: vi.fn(),
    exportSlaTimeoutRecords: vi.fn(),
  },
}));

const mockedApi = vi.mocked(slaConfigApi);

const config = {
  id: 7,
  processKey: 'ASSET_APPROVAL',
  businessType: 'ASSET',
  nodeKey: 'MANAGER_REVIEW',
  priority: 'HIGH',
  responseHours: 2,
  resolveHours: 8,
  warningRatio: 0.75,
  escalationRatio: 0.9,
  status: 1,
  statusText: 'ACTIVE',
  enabled: true,
  notificationTargetSummary: '通知目标 1 个，联系方式已脱敏',
  applicableProcessSummary: 'ASSET_APPROVAL/ASSET/MANAGER_REVIEW/HIGH',
  auditSummary: '启用审计已登记',
};

const summary = {
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
};

const timeoutRecord = {
  id: 10,
  processKey: 'ASSET_APPROVAL',
  nodeKey: 'MANAGER_REVIEW',
  maskedBusinessSummary: '业务摘要已脱敏',
  riskLevel: 'HIGH',
  timeoutMinutes: 120,
  masked: true,
};

describe('SystemSlaConfigWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listSlaConfigs.mockResolvedValue([config]);
    mockedApi.getSlaConfig.mockResolvedValue(config);
    mockedApi.getSlaRuntimeSummary.mockResolvedValue(summary);
    mockedApi.listSlaTimeoutRecords.mockResolvedValue([timeoutRecord]);
    mockedApi.updateSlaConfig.mockResolvedValue({ ...config, responseHours: 2 });
    mockedApi.enableSlaConfig.mockResolvedValue({ ...config, enabled: true, status: 1, statusText: 'ACTIVE' });
    mockedApi.disableSlaConfig.mockResolvedValue({ ...config, enabled: false, status: 0, statusText: 'DISABLED', disabledReason: 'Day6 SLA策略停用复核' });
    mockedApi.simulateSlaConfig.mockResolvedValue({
      processKey: 'ASSET_APPROVAL',
      nodeKey: 'MANAGER_REVIEW',
      matchedConfigId: 7,
      policySummary: '命中策略：ASSET_APPROVAL/MANAGER_REVIEW/HIGH',
      variablePreviewMasked: '变量 2 项已脱敏：amount=***',
      safeExplanation: '只读模拟完成，未发送真实通知',
    });
    mockedApi.exportSlaTimeoutRecords.mockResolvedValue({
      processKey: 'ASSET_APPROVAL',
      confirmed: true,
      masked: true,
      recordCount: 1,
      contentSummary: '导出快照已脱敏，共 1 条超时记录',
      fieldMaskingPolicy: '联系方式、变量值、附件路径、storage key 均只保留 masked/summary。',
    });
  });

  it('加载并展示 SLA 策略、提醒阈值、运行摘要和超时记录', async () => {
    render(<SystemSlaConfigWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('SLA 配置加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'SLA 配置' })).toBeInTheDocument();
    expect(screen.getAllByText(/ASSET_APPROVAL/).length).toBeGreaterThan(0);
    expect(screen.getByText(/提醒\/升级阈值/)).toBeInTheDocument();
    expect(screen.getByText(/2 个超时、3 个预警、1 个高风险/)).toBeInTheDocument();
    expect(screen.getByText(/业务摘要已脱敏/)).toBeInTheDocument();
    expect(screen.getByText(/不发送真实通知/)).toBeInTheDocument();
    expect(screen.queryByText(/raw-secret|ops@example.com/)).not.toBeInTheDocument();
  });

  it('支持空态、错误脱敏态与无权限态', async () => {
    mockedApi.listSlaConfigs.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('token=raw-secret'));

    render(<SystemSlaConfigWorkbenchPage />);

    expect(await screen.findByText('暂无 SLA 策略，请先由后端种子或接口创建策略后再配置。')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('错误详情已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemSlaConfigWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问 SLA 配置/)).toBeInTheDocument();
  });

  it('调用 wrapper 完成保存、启停、模拟与脱敏导出', async () => {
    render(<SystemSlaConfigWorkbenchPage />);
    await screen.findAllByText('ASSET_APPROVAL / MANAGER_REVIEW');

    await userEvent.click(screen.getByRole('button', { name: '保存策略草稿' }));
    await waitFor(() => expect(mockedApi.updateSlaConfig).toHaveBeenCalledWith(7, expect.objectContaining({ responseHours: 2, reason: 'Day6 SLA策略保存复核' })));

    await userEvent.click(screen.getByRole('button', { name: '启用策略' }));
    await waitFor(() => expect(mockedApi.enableSlaConfig).toHaveBeenCalledWith(7, expect.objectContaining({ confirmed: true, auditEvidence: 'SLA_CONFIG_GATE' })));

    await userEvent.click(screen.getByRole('button', { name: '停用策略' }));
    await waitFor(() => expect(mockedApi.disableSlaConfig).toHaveBeenCalledWith(7, expect.objectContaining({ confirmed: true, reason: 'Day6 SLA策略停用复核' })));

    await userEvent.click(screen.getByRole('button', { name: '运行模拟' }));
    await waitFor(() => expect(mockedApi.simulateSlaConfig).toHaveBeenCalledWith(expect.objectContaining({ confirmed: true, variables: expect.objectContaining({ amount: 1200 }) })));
    expect(await screen.findByText('命中策略：7')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '导出脱敏快照' }));
    await waitFor(() => expect(mockedApi.exportSlaTimeoutRecords).toHaveBeenCalledWith(expect.objectContaining({ confirmed: true, auditEvidence: 'SLA_EXPORT_GATE' })));
    expect(await screen.findByText(/导出快照已脱敏/)).toBeInTheDocument();
  });
});
