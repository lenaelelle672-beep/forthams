import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemCacheManagementWorkbenchPage from '../SystemCacheManagementWorkbenchPage';
import { listCacheNamespaces, refreshAllCacheNamespaces, refreshCacheNamespace } from '../../../api/cacheManagement';

vi.mock('../../../api/cacheManagement', () => ({
  listCacheNamespaces: vi.fn(),
  refreshAllCacheNamespaces: vi.fn(),
  refreshCacheNamespace: vi.fn(),
}));

const mockedList = vi.mocked(listCacheNamespaces);
const mockedRefreshAll = vi.mocked(refreshAllCacheNamespaces);
const mockedRefresh = vi.mocked(refreshCacheNamespace);

describe('SystemCacheManagementWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('展示加载态与无命名空间空态', async () => {
    mockedList.mockResolvedValueOnce([]);

    render(<SystemCacheManagementWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('缓存命名空间加载中...')).toBeInTheDocument();
    expect(await screen.findByText('暂无可管理缓存命名空间。')).toBeInTheDocument();
  });

  it('展示可观测空缓存并把空刷新区分为刷新空缓存', async () => {
    mockedList
      .mockResolvedValueOnce([
        {
          namespace: 'system-runtime-diagnostics',
          displayName: '系统运行诊断',
          observable: true,
          reason: 'ConcurrentMapCache 可观测',
          entryCount: 0,
          empty: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          namespace: 'system-runtime-diagnostics',
          displayName: '系统运行诊断',
          observable: true,
          reason: 'ConcurrentMapCache 可观测',
          entryCount: 0,
          empty: true,
          lastRefreshTime: '2026-07-05T10:31:00',
        },
      ]);
    mockedRefresh.mockResolvedValueOnce({
      namespace: 'system-runtime-diagnostics',
      status: 'CLEARED_EMPTY',
      success: false,
      message: '系统运行诊断为空缓存，未报告普通成功',
      clearedEntries: 0,
    });

    render(<SystemCacheManagementWorkbenchPage />);

    const card = (await screen.findByText('系统运行诊断')).closest('article') as HTMLElement;
    expect(within(card).getByText('空缓存')).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: '刷新命名空间' }));

    expect(mockedRefresh).toHaveBeenCalledWith('system-runtime-diagnostics');
    expect((await screen.findAllByText(/刷新空缓存/)).length).toBeGreaterThan(0);
  });

  it('刷新成功后重新加载命名空间状态', async () => {
    mockedList
      .mockResolvedValueOnce([
        {
          namespace: 'workbench-v3-menu-metadata',
          displayName: 'Workbench V3 菜单元数据',
          observable: true,
          reason: 'ConcurrentMapCache 可观测',
          entryCount: 2,
          empty: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          namespace: 'workbench-v3-menu-metadata',
          displayName: 'Workbench V3 菜单元数据',
          observable: true,
          reason: 'ConcurrentMapCache 可观测',
          entryCount: 0,
          empty: true,
          lastRefreshTime: '2026-07-05T10:30:00',
        },
      ]);
    mockedRefresh.mockResolvedValueOnce({
      namespace: 'workbench-v3-menu-metadata',
      status: 'CLEARED',
      success: true,
      message: '已刷新 Workbench V3 菜单元数据',
      clearedEntries: 2,
      refreshedAt: '2026-07-05T10:30:00',
    });

    render(<SystemCacheManagementWorkbenchPage />);

    const card = (await screen.findByText('Workbench V3 菜单元数据')).closest('article') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: '刷新命名空间' }));

    expect((await screen.findAllByText(/刷新成功/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/2026-07-05T10:30:00/)).toBeInTheDocument();
  });

  it('refreshAll 展示逐项成功、空缓存与失败结果', async () => {
    mockedList.mockResolvedValueOnce([
      {
        namespace: 'workbench-v3-menu-metadata',
        displayName: 'Workbench V3 菜单元数据',
        observable: true,
        reason: 'ConcurrentMapCache 可观测',
        entryCount: 1,
        empty: false,
      },
    ]).mockResolvedValueOnce([]);
    mockedRefreshAll.mockResolvedValueOnce([
      { namespace: 'workbench-v3-menu-metadata', status: 'CLEARED', success: true, message: '已刷新', clearedEntries: 1 },
      { namespace: 'system-runtime-diagnostics', status: 'CLEARED_EMPTY', success: false, message: '空缓存', clearedEntries: 0 },
      { namespace: 'unknown', status: 'NOT_FOUND', success: false, message: '不在白名单', clearedEntries: 0 },
    ]);

    render(<SystemCacheManagementWorkbenchPage />);

    await userEvent.click(await screen.findByRole('button', { name: '刷新全部白名单命名空间' }));

    expect(mockedRefreshAll).toHaveBeenCalled();
    expect((await screen.findAllByText(/刷新成功：workbench-v3-menu-metadata/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/刷新空缓存：system-runtime-diagnostics/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/刷新失败：unknown/).length).toBeGreaterThan(0);
  });

  it('失败态与无权限态不泄露原始错误且不触发 mutation', async () => {
    mockedList.mockRejectedValueOnce(new Error('token=raw-secret'));

    render(<SystemCacheManagementWorkbenchPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    render(<SystemCacheManagementWorkbenchPage canView={false} canRefresh={false} />);

    expect(screen.getByText(/无权限访问缓存管理/)).toBeInTheDocument();
    expect(mockedRefresh).not.toHaveBeenCalled();
  });
});
