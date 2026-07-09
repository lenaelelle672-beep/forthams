import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemExternalSystemsWorkbenchPage from '../SystemExternalSystemsWorkbenchPage';
import {
  createSystemExternalSystem,
  disableSystemExternalSystem,
  enableSystemExternalSystem,
  listSystemExternalSystems,
  updateSystemExternalSystem,
  validateSystemExternalSystemConfig,
  type SystemExternalSystemRecord,
} from '../../../api/systemExternalSystems';

vi.mock('../../../api/systemExternalSystems', () => ({
  createSystemExternalSystem: vi.fn(),
  disableSystemExternalSystem: vi.fn(),
  enableSystemExternalSystem: vi.fn(),
  listSystemExternalSystems: vi.fn(),
  updateSystemExternalSystem: vi.fn(),
  validateSystemExternalSystemConfig: vi.fn(),
}));

const mockedCreate = vi.mocked(createSystemExternalSystem);
const mockedDisable = vi.mocked(disableSystemExternalSystem);
const mockedEnable = vi.mocked(enableSystemExternalSystem);
const mockedList = vi.mocked(listSystemExternalSystems);
const mockedUpdate = vi.mocked(updateSystemExternalSystem);
const mockedValidate = vi.mocked(validateSystemExternalSystemConfig);

describe('SystemExternalSystemsWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('展示加载态和空态', async () => {
    mockedList.mockResolvedValueOnce([]);

    render(<SystemExternalSystemsWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('外部系统加载中...')).toBeInTheDocument();
    expect(await screen.findByText('暂无外部系统，请通过 V3 创建目录项。')).toBeInTheDocument();
  });

  it('渲染脱敏目录并执行 config-only 校验', async () => {
    mockedList.mockResolvedValueOnce([record({ enabled: true })]);
    mockedValidate.mockResolvedValueOnce({
      systemId: 7,
      systemCode: 'ERP_CORE',
      valid: true,
      configOnly: true,
      noRealExternalCall: true,
      targetSummary: 'https://erp.example.com/api',
      authSummary: '1 项认证材料已脱敏',
      message: '外部系统配置校验通过，未触发真实外部调用',
    });

    render(<SystemExternalSystemsWorkbenchPage embeddedInWorkbench />);

    expect(await screen.findByText('ERP Core')).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/erp\.example\.com\/api/)).toBeInTheDocument();
    expect(screen.getByText('认证摘要：1 项认证材料已脱敏')).toBeInTheDocument();
    expect(screen.queryByText(rawCredential())).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '配置校验' }));

    expect(await screen.findByText(/config-only=true/)).toBeInTheDocument();
    expect(screen.getByText(/no-real-external-call=true/)).toBeInTheDocument();
  });

  it('错误态固定脱敏文案且不渲染原始错误', async () => {
    mockedList.mockRejectedValueOnce(new Error('credential=' + rawCredential()));

    render(<SystemExternalSystemsWorkbenchPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(rawCredential())).not.toBeInTheDocument();
  });

  it('无权限态不加载配置', () => {
    render(<SystemExternalSystemsWorkbenchPage canView={false} />);

    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问外部系统');
    expect(mockedList).not.toHaveBeenCalled();
  });

  it('通过 V3 wrapper 新增配置且不回显认证材料', async () => {
    mockedList.mockResolvedValueOnce([]);
    mockedCreate.mockResolvedValueOnce(record({ systemName: '库存系统', systemCode: 'STOCK_CORE', enabled: true }));

    render(<SystemExternalSystemsWorkbenchPage />);

    await screen.findByText('暂无外部系统，请通过 V3 创建目录项。');
    await userEvent.type(screen.getByLabelText('系统编码'), 'STOCK_CORE');
    await userEvent.type(screen.getByLabelText('系统名称'), '库存系统');
    await userEvent.type(screen.getByLabelText('基础地址'), 'https://stock.example.com/api');
    await userEvent.clear(screen.getByLabelText('操作人 ID'));
    await userEvent.type(screen.getByLabelText('操作人 ID'), '42');
    await userEvent.type(screen.getByLabelText('一次性认证材料'), rawCredential());
    await userEvent.click(screen.getByRole('button', { name: '新增外部系统' }));

    expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({
      systemCode: 'STOCK_CORE',
      systemName: '库存系统',
      baseUrl: 'https://stock.example.com/api',
      operatorId: 42,
    }));
    expect(mockedCreate.mock.calls[0][0].authConfig).toEqual({ credential: expect.any(String) });
    expect(await screen.findByText(/外部系统已创建/)).toBeInTheDocument();
    expect(screen.getByText('库存系统')).toBeInTheDocument();
    expect(screen.queryByText(rawCredential())).not.toBeInTheDocument();
  });

  it('支持编辑、启用、停用并保留 confirmed 审计载荷', async () => {
    mockedList.mockResolvedValueOnce([
      record({ id: 7, enabled: false, systemName: '停用系统', systemCode: 'ERP_CORE' }),
      record({ id: 8, enabled: true, systemName: '启用系统', systemCode: 'MES_CORE' }),
    ]);
    mockedUpdate.mockResolvedValueOnce(record({ id: 7, enabled: false, systemName: '停用系统已更新', systemCode: 'ERP_CORE' }));
    mockedEnable.mockResolvedValueOnce(record({ id: 7, enabled: true, systemName: '停用系统已更新', systemCode: 'ERP_CORE' }));
    mockedDisable.mockResolvedValueOnce(record({ id: 8, enabled: false, systemName: '启用系统', systemCode: 'MES_CORE' }));

    render(<SystemExternalSystemsWorkbenchPage />);

    const disabledCard = (await screen.findByText('停用系统')).closest('article') as HTMLElement;
    await userEvent.click(within(disabledCard).getByRole('button', { name: '编辑' }));
    await userEvent.clear(screen.getByLabelText('系统名称'));
    await userEvent.type(screen.getByLabelText('系统名称'), '停用系统已更新');
    await userEvent.clear(screen.getByLabelText('操作人 ID'));
    await userEvent.type(screen.getByLabelText('操作人 ID'), '42');
    await userEvent.click(screen.getByRole('button', { name: '保存外部系统' }));

    expect(mockedUpdate).toHaveBeenCalledWith(7, expect.objectContaining({ systemName: '停用系统已更新', operatorId: 42 }));
    expect(await screen.findByText(/外部系统已更新/)).toBeInTheDocument();

    const updatedCard = screen.getByText('停用系统已更新').closest('article') as HTMLElement;
    await userEvent.click(within(updatedCard).getByRole('button', { name: '启用' }));
    expect(mockedEnable).toHaveBeenCalledWith(7, expect.objectContaining({ confirmed: true, operatorId: 42, auditEvidence: 'Workbench V3 外部系统启停复核' }));

    const enabledCard = screen.getByText('启用系统').closest('article') as HTMLElement;
    await userEvent.click(within(enabledCard).getByRole('button', { name: '停用' }));
    expect(mockedDisable).toHaveBeenCalledWith(8, expect.objectContaining({ confirmed: true, operatorId: 42, auditEvidence: 'Workbench V3 外部系统启停复核' }));
  });

  function record(overrides: Partial<SystemExternalSystemRecord> = {}): SystemExternalSystemRecord {
    return {
      id: 7,
      systemCode: 'ERP_CORE',
      systemName: 'ERP Core',
      systemType: 'ERP',
      maskedBaseUrl: 'https://erp.example.com/api',
      authType: 'API_KEY',
      authConfigured: true,
      configMasked: true,
      maskedSecretSummary: '1 项认证材料已脱敏',
      enabled: true,
      status: 'ENABLED',
      healthStatus: 'UNKNOWN',
      ...overrides,
    };
  }

  function rawCredential() {
    return 'raw' + '-external-credential';
  }
});
