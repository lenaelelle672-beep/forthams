import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemBaseParamsWorkbenchPage from '../SystemBaseParamsWorkbenchPage';
import {
  createSysConfig,
  getSystemBaseParamList,
  getSystemConfig,
  previewSystemConfig,
  refreshSysConfigCache,
  updateSysConfig,
  type SysConfigItem,
} from '../../../api/systemConfig';

vi.mock('../../../api/systemConfig', () => ({
  createSysConfig: vi.fn(),
  getSystemBaseParamList: vi.fn(),
  getSystemConfig: vi.fn(),
  previewSystemConfig: vi.fn(),
  refreshSysConfigCache: vi.fn(),
  updateSysConfig: vi.fn(),
  getSecurityConfig: vi.fn(),
  saveSecurityConfig: vi.fn(),
}));

const mockedCreate = vi.mocked(createSysConfig);
const mockedGetList = vi.mocked(getSystemBaseParamList);
const mockedGetMap = vi.mocked(getSystemConfig);
const mockedPreview = vi.mocked(previewSystemConfig);
const mockedRefresh = vi.mocked(refreshSysConfigCache);
const mockedUpdate = vi.mocked(updateSysConfig);

describe('SystemBaseParamsWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockedGetMap.mockResolvedValue({ systemName: 'AMS', timezone: 'Asia/Shanghai' });
    mockedGetList.mockResolvedValue({ records: [record()], total: 1, size: 50, current: 1 });
  });

  it('真实加载 SYSTEM 基础参数目录并支持 embeddedInWorkbench', async () => {
    const { container } = render(<SystemBaseParamsWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('基础参数加载中...')).toBeInTheDocument();
    expect(await screen.findByText('系统名称')).toBeInTheDocument();
    expect(screen.getByText('当前值：AMS')).toBeInTheDocument();
    expect(container.querySelector('[data-system-base-params="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(mockedGetMap).toHaveBeenCalledWith();
    expect(mockedGetList).toHaveBeenCalledWith({ page: 1, pageSize: 50 });
    expect(container.querySelector('iframe')).toBeNull();
    expect(document.body.textContent).not.toContain(rawCredential());
  });

  it('通过 SYSTEM typed wrapper 新增基础参数并携带审计字段', async () => {
    mockedCreate.mockResolvedValueOnce(record({ id: 8, configKey: 'companyName', configName: '公司名称', configValue: '蓝湖资产' }));

    render(<SystemBaseParamsWorkbenchPage />);

    await screen.findByText('系统名称');
    await userEvent.click(screen.getByRole('button', { name: /公司名称/ }));
    await userEvent.clear(screen.getByLabelText('参数值'));
    await userEvent.type(screen.getByLabelText('参数值'), '蓝湖资产');
    await userEvent.clear(screen.getByLabelText('操作人 ID'));
    await userEvent.type(screen.getByLabelText('操作人 ID'), '42');
    await userEvent.click(screen.getByRole('button', { name: '保存基础参数' }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({
      configGroup: 'SYSTEM',
      configKey: 'companyName',
      configValue: '蓝湖资产',
      operatorId: 42,
      reason: 'V3 基础参数保存复核',
    })));
    expect(await screen.findByText(/基础参数已保存/)).toBeInTheDocument();
    expect(screen.getAllByText('公司名称').length).toBeGreaterThan(0);
  });

  it('编辑已有参数时调用更新 wrapper，不触碰 SECURITY 兼容入口', async () => {
    mockedUpdate.mockResolvedValueOnce(record({ configValue: 'AMS Pro' }));

    render(<SystemBaseParamsWorkbenchPage />);

    await screen.findByText('系统名称');
    await userEvent.click(screen.getByRole('button', { name: '编辑基础参数' }));
    await userEvent.clear(screen.getByLabelText('参数值'));
    await userEvent.type(screen.getByLabelText('参数值'), 'AMS Pro');
    await userEvent.clear(screen.getByLabelText('操作人 ID'));
    await userEvent.type(screen.getByLabelText('操作人 ID'), '42');
    await userEvent.click(screen.getByRole('button', { name: '保存基础参数' }));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith(7, expect.objectContaining({
      configGroup: 'SYSTEM',
      configKey: 'systemName',
      configValue: 'AMS Pro',
      operatorId: 42,
    })));
    expect(document.body.textContent).not.toContain('system-security-policy');
  });

  it('展示影响预演结果且预演不持久化不刷新缓存', async () => {
    mockedPreview.mockResolvedValueOnce({
      configGroup: 'SYSTEM',
      changedKeys: ['systemName'],
      beforeMasked: { systemName: 'AMS' },
      afterMasked: { systemName: 'AMS Pro' },
      impactModules: ['Workbench V3 system-base-params'],
      riskLevel: 'LOW',
      validationErrors: [],
      persistent: false,
      cacheRefreshed: false,
      summary: '未写库',
    });

    render(<SystemBaseParamsWorkbenchPage />);

    await screen.findByText('系统名称');
    await userEvent.clear(screen.getByLabelText('参数值'));
    await userEvent.type(screen.getByLabelText('参数值'), 'AMS Pro');
    await userEvent.clear(screen.getByLabelText('操作人 ID'));
    await userEvent.type(screen.getByLabelText('操作人 ID'), '42');
    await userEvent.click(screen.getByRole('button', { name: '影响预演' }));

    expect(mockedPreview).toHaveBeenCalledWith(expect.objectContaining({
      configs: { systemName: 'AMS Pro' },
      operatorId: 42,
    }));
    expect(await screen.findByLabelText('基础参数影响预演结果')).toHaveTextContent('持久化：false');
    expect(screen.getByLabelText('基础参数影响预演结果')).toHaveTextContent('刷新缓存：false');
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('展示 refresh-cache 的 explicit DEGRADED 命名空间结果', async () => {
    mockedRefresh.mockResolvedValueOnce({
      overallStatus: 'DEGRADED',
      namespaceResults: [{
        namespace: 'system-config:SYSTEM',
        status: 'DEGRADED',
        itemCount: 3,
        message: '未接入真实缓存',
        remediation: '接入缓存后返回 REFRESHED',
      }],
      refreshedCount: 0,
      degradedCount: 1,
      message: '明确降级，未改变业务状态',
    });

    render(<SystemBaseParamsWorkbenchPage />);

    await screen.findByText('系统名称');
    await userEvent.clear(screen.getByLabelText('操作人 ID'));
    await userEvent.type(screen.getByLabelText('操作人 ID'), '42');
    await userEvent.click(screen.getByRole('button', { name: '刷新缓存' }));

    expect(mockedRefresh).toHaveBeenCalledWith(expect.objectContaining({
      confirmed: true,
      operatorId: 42,
      namespaces: ['system-config:SYSTEM'],
    }));
    expect(await screen.findByLabelText('基础参数缓存刷新结果')).toHaveTextContent('DEGRADED');
    expect(screen.getByText(/system-config:SYSTEM · DEGRADED/)).toBeInTheDocument();
  });

  it('错误态使用脱敏文案且无权限时不加载', async () => {
    mockedGetList.mockRejectedValueOnce(new Error('credential=' + rawCredential()));

    const { unmount } = render(<SystemBaseParamsWorkbenchPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('错误详情已脱敏'));
    expect(screen.queryByText(rawCredential())).not.toBeInTheDocument();

    unmount();
    vi.clearAllMocks();
    render(<SystemBaseParamsWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问基础参数');
    expect(mockedGetMap).not.toHaveBeenCalled();
  });

  function record(overrides: Partial<SysConfigItem> = {}): SysConfigItem {
    return {
      id: 7,
      tenantId: 'tenant-a',
      configGroup: 'SYSTEM',
      configKey: 'systemName',
      configName: '系统名称',
      configValue: 'AMS',
      displayValue: 'AMS',
      configType: 'STRING',
      status: 0,
      lastOperationReason: '初始化基础参数',
      ...overrides,
    };
  }

  function rawCredential() {
    return 'raw' + '-system-config-credential';
  }
});
