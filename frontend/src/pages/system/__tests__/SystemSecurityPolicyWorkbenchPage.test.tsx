import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemSecurityPolicyWorkbenchPage from '../SystemSecurityPolicyWorkbenchPage';
import {
  getSecurityConfig,
  previewSecurityConfig,
  saveSecurityConfig,
} from '../../../api/systemConfig';

vi.mock('../../../api/systemConfig', () => ({
  getSecurityConfig: vi.fn(),
  saveSecurityConfig: vi.fn(),
  previewSecurityConfig: vi.fn(),
}));

const mockedGetSecurity = vi.mocked(getSecurityConfig);
const mockedSaveSecurity = vi.mocked(saveSecurityConfig);
const mockedPreviewSecurity = vi.mocked(previewSecurityConfig);

describe('SystemSecurityPolicyWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockedGetSecurity.mockResolvedValue({
      'credential.minLength': '12',
      'session.maxMinutes': '120',
      'signIn.maxAttempts': '5',
    });
  });

  it('真实加载 SECURITY 配置态并支持 embeddedInWorkbench', async () => {
    const { container } = render(<SystemSecurityPolicyWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('安全策略加载中...')).toBeInTheDocument();
    expect(await screen.findByText('口令长度下限')).toBeInTheDocument();
    expect(container.querySelector('[data-system-security-policy="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByText(/真实调用 \/system-config\/security 与 \/system-config\/security\/preview/)).toBeInTheDocument();
    expect(screen.getByText(/no-login-chain \/ no-direct-effect/)).toBeInTheDocument();
    expect(mockedGetSecurity).toHaveBeenCalledWith();
    expect(container.querySelector('iframe')).toBeNull();
    expect(document.body.textContent).not.toContain(rawMaterial());
  });

  it('保存安全策略配置时调用 SECURITY wrapper 并携带审计摘要', async () => {
    mockedSaveSecurity.mockResolvedValueOnce({ 'signIn.maxAttempts': '6' });

    render(<SystemSecurityPolicyWorkbenchPage />);

    await screen.findByText('登录失败限制');
    await userEvent.click(screen.getByRole('button', { name: /登录失败限制/ }));
    await userEvent.clear(screen.getByLabelText('配置值'));
    await userEvent.type(screen.getByLabelText('配置值'), '6');
    await userEvent.clear(screen.getByLabelText('操作人 ID'));
    await userEvent.type(screen.getByLabelText('操作人 ID'), '42');
    await userEvent.click(screen.getByRole('button', { name: '保存安全策略' }));

    await waitFor(() => expect(mockedSaveSecurity).toHaveBeenCalledWith(
      { 'signIn.maxAttempts': '6' },
      expect.objectContaining({
        operatorId: 42,
        reason: 'V3 安全策略配置态复核',
        auditEvidence: 'policy-preview-state',
      }),
    ));
    expect(await screen.findByText(/安全策略配置态已保存/)).toBeInTheDocument();
    expect(screen.getByText(/不声明运行时生效/)).toBeInTheDocument();
  });

  it('展示预览态 persistent=false cacheRefreshed=false runtimeEffect=false 且不写入', async () => {
    mockedPreviewSecurity.mockResolvedValueOnce({
      configGroup: 'SECURITY',
      changedKeys: ['signIn.maxAttempts'],
      beforeMasked: { 'signIn.maxAttempts': '5' },
      afterMasked: { 'signIn.maxAttempts': '6' },
      impactModules: ['Workbench V3 system-security-policy'],
      riskLevel: 'LOW',
      validationErrors: [],
      persistent: false,
      cacheRefreshed: false,
      runtimeEffect: false,
      summary: '安全策略配置态预览完成，未写库、未刷新缓存',
    });

    render(<SystemSecurityPolicyWorkbenchPage />);

    await screen.findByText('登录失败限制');
    await userEvent.click(screen.getByRole('button', { name: /登录失败限制/ }));
    await userEvent.clear(screen.getByLabelText('配置值'));
    await userEvent.type(screen.getByLabelText('配置值'), '6');
    await userEvent.clear(screen.getByLabelText('操作人 ID'));
    await userEvent.type(screen.getByLabelText('操作人 ID'), '42');
    await userEvent.click(screen.getByRole('button', { name: '影响预演' }));

    expect(mockedPreviewSecurity).toHaveBeenCalledWith(expect.objectContaining({
      configs: { 'signIn.maxAttempts': '6' },
      operatorId: 42,
    }));
    const preview = await screen.findByLabelText('安全策略预览态');
    expect(preview).toHaveTextContent('persistent=false');
    expect(preview).toHaveTextContent('cacheRefreshed=false');
    expect(preview).toHaveTextContent('runtimeEffect=false');
    expect(preview).toHaveTextContent('beforeMasked');
    expect(preview).toHaveTextContent('afterMasked');
    expect(mockedSaveSecurity).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(rawMaterial());
  });

  it('错误态脱敏且无权限时不加载', async () => {
    mockedGetSecurity.mockRejectedValueOnce(new Error('credential=' + rawMaterial()));

    const { unmount } = render(<SystemSecurityPolicyWorkbenchPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('错误详情已脱敏'));
    expect(screen.queryByText(rawMaterial())).not.toBeInTheDocument();

    unmount();
    vi.clearAllMocks();
    render(<SystemSecurityPolicyWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问安全策略');
    expect(mockedGetSecurity).not.toHaveBeenCalled();
  });

  function rawMaterial() {
    return 'raw-security-material';
  }
});
