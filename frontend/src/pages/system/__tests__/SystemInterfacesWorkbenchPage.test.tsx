import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemInterfacesWorkbenchPage from '../SystemInterfacesWorkbenchPage';
import { listSystemInterfaces, testSystemInterfaceConfig } from '../../../api/systemInterfaces';

vi.mock('../../../api/systemInterfaces', () => ({
  listSystemInterfaces: vi.fn(),
  testSystemInterfaceConfig: vi.fn(),
}));

const mockedList = vi.mocked(listSystemInterfaces);
const mockedTest = vi.mocked(testSystemInterfaceConfig);

describe('SystemInterfacesWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('渲染 V3 接口管理数据和配置校验', async () => {
    mockedList.mockResolvedValueOnce([{ id: 1, externalSystemId: 1, interfaceName: '资产接口', method: 'GET', path: '/asset', enabled: true, configMasked: true }]);
    mockedTest.mockResolvedValueOnce({ interfaceId: 1, valid: true, configOnly: true, target: 'GET /asset', message: '接口配置校验通过，未触发真实外部调用' });

    render(<SystemInterfacesWorkbenchPage embeddedInWorkbench />);

    expect(await screen.findByText('资产接口')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '配置校验' }));

    expect(await screen.findByText('接口配置校验通过，未触发真实外部调用')).toBeInTheDocument();
  });

  it('错误态展示脱敏文案', async () => {
    mockedList.mockRejectedValueOnce(new Error('secret raw detail'));

    render(<SystemInterfacesWorkbenchPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
  });
});
