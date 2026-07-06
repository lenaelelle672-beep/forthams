import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemLocationManagementWorkbenchPage from '../SystemLocationManagementWorkbenchPage';
import { listLocations, listRootLocations } from '../../../api/locations';

vi.mock('../../../api/locations', () => ({
  listLocations: vi.fn(),
  listRootLocations: vi.fn(),
}));

const mockedList = vi.mocked(listLocations);
const mockedRoots = vi.mocked(listRootLocations);

describe('SystemLocationManagementWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('加载并展示位置列表与根位置摘要', async () => {
    mockedList.mockResolvedValueOnce([
      { id: 1, name: '华东仓库', locationCode: 'LOC-001', parentId: null, sortOrder: 1, status: 1 },
      { id: 2, name: '二层库位', locationCode: 'LOC-002', parentId: 1, sortOrder: 2, status: 1 },
    ]);
    mockedRoots.mockResolvedValueOnce([{ id: 1, name: '华东仓库', locationCode: 'LOC-001', status: 1 }]);

    render(<SystemLocationManagementWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('位置加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '位置列表' })).toBeInTheDocument();
    expect(screen.getAllByText('华东仓库').length).toBeGreaterThan(0);
    expect(screen.getByText('二层库位')).toBeInTheDocument();
    expect(screen.getByText('显示 2 / 2 条')).toBeInTheDocument();
  });

  it('支持关键词搜索与状态筛选', async () => {
    mockedList.mockResolvedValueOnce([
      { id: 1, name: '华东仓库', locationCode: 'LOC-001', status: 1 },
      { id: 2, name: '停用库位', locationCode: 'LOC-002', status: 0 },
    ]);
    mockedRoots.mockResolvedValueOnce([]);

    render(<SystemLocationManagementWorkbenchPage />);
    expect(await screen.findByText('华东仓库')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('按名称、编码、描述或父级搜索'), '停用');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));

    expect(screen.getByText('停用库位')).toBeInTheDocument();
    expect(screen.queryByText('华东仓库')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'enabled');
    expect(screen.getByText('没有符合条件的位置。')).toBeInTheDocument();
  });

  it('重新加载后刷新列表与根位置', async () => {
    mockedList
      .mockResolvedValueOnce([{ id: 1, name: '旧位置', locationCode: 'OLD', status: 1 }])
      .mockResolvedValueOnce([{ id: 2, name: '新位置', locationCode: 'NEW', status: 1 }]);
    mockedRoots
      .mockResolvedValueOnce([{ id: 1, name: '旧位置', locationCode: 'OLD', status: 1 }])
      .mockResolvedValueOnce([{ id: 2, name: '新位置', locationCode: 'NEW', status: 1 }]);

    render(<SystemLocationManagementWorkbenchPage />);
    expect(await screen.findAllByText('旧位置')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));

    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockedRoots).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('新位置')).toHaveLength(2);
  });

  it('空态、错误脱敏态与无权限态可见且无写操作按钮', async () => {
    mockedList.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('token=raw-secret'));
    mockedRoots.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    render(<SystemLocationManagementWorkbenchPage />);

    expect(await screen.findByText('暂无位置数据。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新增|编辑|删除/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemLocationManagementWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问位置管理/)).toBeInTheDocument();
  });
});
