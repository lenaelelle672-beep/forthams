import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const httpMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/utils/http', () => ({
  default: {
    get: httpMocks.get,
    post: httpMocks.post,
  },
}));

import { AuthProvider, CURRENT_USER_PATH, toAuthUser, useAuth } from './AuthContext';
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '@/utils/auth';
import { canAccessRoute } from '@/utils/routePermissions';

function Probe() {
  const { user, loading, login, logout, token } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="token">{token ?? ''}</span>
      <span data-testid="permissions">{(user?.permissions ?? []).join(',')}</span>
      <span data-testid="platform-admin">{String(Boolean(user?.platformAdmin))}</span>
      <button type="button" onClick={() => login({ username: 'admin', password: 'secret' })}>
        登录
      </button>
      <button type="button" onClick={() => void logout()}>
        退出
      </button>
    </div>
  );
}

describe('AuthContext authority hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('normalizes platformAdmin and platform_admin from mixed backend fields', () => {
    expect(toAuthUser({
      userId: 1,
      username: 'op',
      realName: '运营',
      roles: ['PLATFORM_OPERATOR'],
      permissions: ['system:flow:query', 'workflow:designer:edit'],
      platform_admin: true,
    })).toMatchObject({
      permissions: ['system:flow:query', 'workflow:designer:edit'],
      platformAdmin: true,
      platform_admin: true,
    });
  });

  it('refreshes stored sessions from /user-management/current before exposing empty permissions', async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'token-1');
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
      userId: 1,
      username: 'admin',
      realName: '管理员',
      roles: [],
      permissions: [],
    }));
    httpMocks.get.mockResolvedValueOnce({
      userId: 1,
      username: 'admin',
      realName: '管理员',
      roles: ['PLATFORM_OPERATOR'],
      permissions: ['system:flow:query', 'workflow:designer:edit'],
      platformAdmin: true,
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(httpMocks.get).toHaveBeenCalledWith(CURRENT_USER_PATH);
    expect(screen.getByTestId('permissions').textContent).toBe('system:flow:query,workflow:designer:edit');
    expect(screen.getByTestId('platform-admin').textContent).toBe('true');

    const stored = JSON.parse(sessionStorage.getItem(USER_STORAGE_KEY) ?? '{}');
    expect(canAccessRoute('/workflows', stored)).toBe(true);
    expect(canAccessRoute('/workflow-designer', stored)).toBe(true);
  });

  it('hydrates missing login authority from current user when backend later provides it', async () => {
    httpMocks.post.mockResolvedValueOnce({
      token: 'token-2',
      userId: 8,
      username: 'admin',
      realName: '管理员',
    });
    httpMocks.get.mockResolvedValueOnce({
      userId: 8,
      username: 'admin',
      realName: '管理员',
      roles: ['PLATFORM_OPERATOR'],
      permissions: ['system:flow:query', 'workflow:designer:publish'],
      platform_admin: true,
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await userEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByTestId('permissions').textContent).toBe('system:flow:query,workflow:designer:publish');
    });
    expect(httpMocks.get).toHaveBeenCalledWith(CURRENT_USER_PATH);
    expect(screen.getByTestId('platform-admin').textContent).toBe('true');
  });

  it('revokes the server session before clearing local auth state', async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'token-3');
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
      userId: 1,
      username: 'admin',
      realName: '管理员',
      roles: ['TENANT_ADMIN'],
      permissions: ['asset:query'],
    }));
    httpMocks.get.mockResolvedValueOnce({
      userId: 1,
      username: 'admin',
      realName: '管理员',
      roles: ['TENANT_ADMIN'],
      permissions: ['asset:query'],
    });
    httpMocks.post.mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await userEvent.click(screen.getByRole('button', { name: '退出' }));

    await waitFor(() => {
      expect(httpMocks.post).toHaveBeenCalledWith('/auth/logout');
      expect(screen.getByTestId('token').textContent).toBe('');
      expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });
  });
});
