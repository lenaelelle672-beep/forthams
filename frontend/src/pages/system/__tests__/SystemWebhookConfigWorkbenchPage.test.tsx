import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemWebhookConfigWorkbenchPage from '../SystemWebhookConfigWorkbenchPage';
import {
  createSystemWebhookConfig,
  deleteSystemWebhookConfig,
  listSystemWebhookConfigs,
  testSystemWebhookConfig,
  updateSystemWebhookConfig,
  updateSystemWebhookConfigStatus,
} from '../../../api/systemWebhookConfigs';

vi.mock('../../../api/systemWebhookConfigs', () => ({
  createSystemWebhookConfig: vi.fn(),
  deleteSystemWebhookConfig: vi.fn(),
  listSystemWebhookConfigs: vi.fn(),
  testSystemWebhookConfig: vi.fn(),
  updateSystemWebhookConfig: vi.fn(),
  updateSystemWebhookConfigStatus: vi.fn(),
}));

const mockedCreate = vi.mocked(createSystemWebhookConfig);
const mockedDelete = vi.mocked(deleteSystemWebhookConfig);
const mockedList = vi.mocked(listSystemWebhookConfigs);
const mockedTest = vi.mocked(testSystemWebhookConfig);
const mockedUpdate = vi.mocked(updateSystemWebhookConfig);
const mockedUpdateStatus = vi.mocked(updateSystemWebhookConfigStatus);

describe('SystemWebhookConfigWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('展示加载态和空态', async () => {
    mockedList.mockResolvedValueOnce([]);

    render(<SystemWebhookConfigWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('Webhook 配置加载中...')).toBeInTheDocument();
    expect(await screen.findByText('暂无 Webhook 配置，请通过 V3 创建配置。')).toBeInTheDocument();
  });

  it('渲染脱敏配置并执行 config-only 校验', async () => {
    mockedList.mockResolvedValueOnce([
      {
        id: 1,
        configName: '资产 Webhook',
        eventType: 'ASSET_SYNC',
        maskedTargetUrl: 'https://hooks.example.com/asset/sync',
        enabled: true,
        status: 'ENABLED',
        signingStrategy: 'HMAC_SHA256',
        secretConfigured: true,
        signatureConfigured: true,
        maskedHeaders: { Authorization: '******' },
      },
    ]);
    mockedTest.mockResolvedValueOnce({
      configId: 1,
      valid: true,
      configOnly: true,
      target: 'https://hooks.example.com/asset/sync',
      message: 'Webhook 配置校验通过，未触发真实外部调用',
    });

    render(<SystemWebhookConfigWorkbenchPage embeddedInWorkbench />);

    expect(await screen.findByText('资产 Webhook')).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/hooks\.example\.com\/asset\/sync/)).toBeInTheDocument();
    expect(screen.getByText('敏感配置：已脱敏')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /发送/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '配置校验' }));

    expect(await screen.findByText(/Webhook 配置校验通过，未触发真实外部调用/)).toBeInTheDocument();
    expect(screen.getByText(/config-only=true/)).toBeInTheDocument();
  });

  it('错误态固定脱敏文案且不渲染原始错误', async () => {
    mockedList.mockRejectedValueOnce(new Error('token=raw-secret&signingSecret=raw'));

    render(<SystemWebhookConfigWorkbenchPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();
    expect(screen.queryByText(/signingSecret/)).not.toBeInTheDocument();
  });

  it('无权限态不加载配置且动作按钮不可用', () => {
    render(<SystemWebhookConfigWorkbenchPage canView={false} />);

    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问 Webhook 配置');
    expect(mockedList).not.toHaveBeenCalled();
  });

  it('校验失败也只展示脱敏错误态', async () => {
    mockedList.mockResolvedValueOnce([
      {
        id: 1,
        configName: '资产 Webhook',
        eventType: 'ASSET_SYNC',
        maskedTargetUrl: 'https://hooks.example.com/asset/sync',
        enabled: true,
        signingStrategy: 'NONE',
      },
    ]);
    mockedTest.mockRejectedValueOnce(new Error('password=raw'));

    render(<SystemWebhookConfigWorkbenchPage />);

    await userEvent.click(await screen.findByRole('button', { name: '配置校验' }));

    expect(await screen.findByText('配置校验失败，敏感细节已脱敏')).toBeInTheDocument();
    expect(screen.queryByText(/password=raw/)).not.toBeInTheDocument();
  });

  it('通过 V3 wrapper 新增配置且不回显密钥', async () => {
    mockedList.mockResolvedValueOnce([]);
    mockedCreate.mockResolvedValueOnce({
      id: 2,
      configName: '库存 Webhook',
      eventType: 'STOCK_SYNC',
      maskedTargetUrl: 'https://hooks.example.com/stock/sync',
      enabled: true,
      status: 'ENABLED',
      signingStrategy: 'HMAC_SHA256',
      signatureConfigured: true,
    });

    render(<SystemWebhookConfigWorkbenchPage />);

    await screen.findByText('暂无 Webhook 配置，请通过 V3 创建配置。');
    await userEvent.type(screen.getByLabelText('配置名称'), '库存 Webhook');
    await userEvent.type(screen.getByLabelText('事件类型'), 'STOCK_SYNC');
    await userEvent.type(screen.getByLabelText('目标 URL'), 'https://hooks.example.com/stock/sync');
    await userEvent.selectOptions(screen.getByLabelText('签名策略'), 'HMAC_SHA256');
    await userEvent.type(screen.getByLabelText('签名密钥'), 'raw-signing-secret');
    await userEvent.click(screen.getByRole('button', { name: '新增配置' }));

    expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({
      configName: '库存 Webhook',
      eventType: 'STOCK_SYNC',
      targetUrl: 'https://hooks.example.com/stock/sync',
      signingSecret: 'raw-signing-secret',
    }));
    expect(await screen.findByText('Webhook 配置已创建')).toBeInTheDocument();
    expect(screen.getByText('库存 Webhook')).toBeInTheDocument();
    expect(screen.queryByText('raw-signing-secret')).not.toBeInTheDocument();
  });

  it('支持编辑、启停和停用后删除安全操作', async () => {
    mockedList.mockResolvedValueOnce([
      {
        id: 1,
        configName: '停用 Webhook',
        eventType: 'ASSET_SYNC',
        maskedTargetUrl: 'https://hooks.example.com/asset/sync',
        enabled: false,
        status: 'DISABLED',
        signingStrategy: 'NONE',
      },
      {
        id: 2,
        configName: '启用 Webhook',
        eventType: 'WORK_ORDER_SYNC',
        maskedTargetUrl: 'https://webhooks.example.com/work-order/sync',
        enabled: true,
        status: 'ENABLED',
        signingStrategy: 'NONE',
      },
    ]);
    mockedUpdate.mockResolvedValueOnce({
      id: 1,
      configName: '停用 Webhook 已更新',
      eventType: 'ASSET_UPDATE',
      maskedTargetUrl: 'https://hooks.example.com/asset/update',
      enabled: false,
      status: 'DISABLED',
      signingStrategy: 'NONE',
    });
    mockedUpdateStatus.mockResolvedValueOnce({
      id: 2,
      configName: '启用 Webhook',
      eventType: 'WORK_ORDER_SYNC',
      maskedTargetUrl: 'https://webhooks.example.com/work-order/sync',
      enabled: false,
      status: 'DISABLED',
      signingStrategy: 'NONE',
    });
    mockedDelete.mockResolvedValueOnce(undefined);

    render(<SystemWebhookConfigWorkbenchPage />);

    const disabledCard = (await screen.findByText('停用 Webhook')).closest('article') as HTMLElement;
    await userEvent.click(within(disabledCard).getByRole('button', { name: '编辑' }));
    await userEvent.clear(screen.getByLabelText('配置名称'));
    await userEvent.type(screen.getByLabelText('配置名称'), '停用 Webhook 已更新');
    await userEvent.clear(screen.getByLabelText('事件类型'));
    await userEvent.type(screen.getByLabelText('事件类型'), 'ASSET_UPDATE');
    await userEvent.clear(screen.getByLabelText('目标 URL'));
    await userEvent.type(screen.getByLabelText('目标 URL'), 'https://hooks.example.com/asset/update');
    await userEvent.click(screen.getByRole('button', { name: '保存配置' }));

    expect(mockedUpdate).toHaveBeenCalledWith(1, expect.objectContaining({
      configName: '停用 Webhook 已更新',
      eventType: 'ASSET_UPDATE',
      targetUrl: 'https://hooks.example.com/asset/update',
    }));
    expect(await screen.findByText('Webhook 配置已更新')).toBeInTheDocument();

    const enabledCard = screen.getByText('启用 Webhook').closest('article') as HTMLElement;
    await userEvent.click(within(enabledCard).getByRole('button', { name: '停用' }));
    expect(mockedUpdateStatus).toHaveBeenCalledWith(2, false);
    expect(await screen.findByText('Webhook 配置已停用')).toBeInTheDocument();

    const updatedCard = screen.getByText('停用 Webhook 已更新').closest('article') as HTMLElement;
    await userEvent.click(within(updatedCard).getByRole('button', { name: '删除' }));
    expect(mockedDelete).toHaveBeenCalledWith(1);
    expect(await screen.findByText('Webhook 配置已删除')).toBeInTheDocument();
  });
});
