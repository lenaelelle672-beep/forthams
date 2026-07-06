import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemUserManagementWorkbenchPage from '../SystemUserManagementWorkbenchPage';
import { listUserManagement } from '../../../api/userManagement';

vi.mock('../../../api/userManagement', () => ({
  listUserManagement: vi.fn(),
}));

const mockedList = vi.mocked(listUserManagement);

const emptyPage = { records: [], total: 0, size: 50, current: 1, pages: 0 };

describe('SystemUserManagementWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('加载并展示用户列表与记录摘要', async () => {
    mockedList.mockResolvedValueOnce({
      records: [
        { id: 1, username: 'admin', realName: '系统管理员', phone: '13800000000', email: 'admin@example.com', deptId: 1, status: 1 },
        { id: 2, username: 'auditor', realName: '审计员', deptId: 2, status: 0 },
      ],
      total: 2,
      size: 50,
      current: 1,
      pages: 1,
    });

    render(<SystemUserManagementWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('用户列表加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '用户列表' })).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('系统管理员')).toBeInTheDocument();
    expect(screen.getByText('显示 2 / 2 条，后端总数 2')).toBeInTheDocument();
  });

  it('支持关键词搜索与状态筛选', async () => {
    mockedList
      .mockResolvedValueOnce({
        records: [
          { id: 1, username: 'admin', realName: '系统管理员', status: 1 },
          { id: 2, username: 'ops', realName: '运维用户', status: 0 },
        ],
        total: 2,
        size: 50,
        current: 1,
        pages: 1,
      })
      .mockResolvedValueOnce({
        records: [{ id: 2, username: 'ops', realName: '运维用户', status: 0 }],
        total: 1,
        size: 50,
        current: 1,
        pages: 1,
      });

    render(<SystemUserManagementWorkbenchPage />);
    expect(await screen.findByText('系统管理员')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('按账号、姓名、电话搜索'), '  运维  ');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));

    await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith({ page: 1, pageSize: 50, keyword: '运维' }));
    expect(await screen.findByText('运维用户')).toBeInTheDocument();
    expect(screen.queryByText('系统管理员')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'enabled');
    expect(screen.getByText('没有符合条件的用户。')).toBeInTheDocument();
  });

  it('重新加载沿用当前关键词并刷新列表', async () => {
    mockedList
      .mockResolvedValueOnce({ ...emptyPage, records: [{ id: 1, username: 'old-user', realName: '旧用户', status: 1 }], total: 1, pages: 1 })
      .mockResolvedValueOnce({ ...emptyPage, records: [{ id: 2, username: 'new-user', realName: '新用户', status: 1 }], total: 1, pages: 1 });

    render(<SystemUserManagementWorkbenchPage />);
    expect(await screen.findByText('旧用户')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));

    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('新用户')).toBeInTheDocument();
  });

  it('空态、错误脱敏态与无权限态可见且无写操作按钮', async () => {
    mockedList.mockResolvedValueOnce(emptyPage).mockRejectedValueOnce(new Error('token=raw-secret'));

    render(<SystemUserManagementWorkbenchPage />);

    expect(await screen.findByText('暂无用户数据。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新增|编辑|删除|重置密码|启停|分配角色/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemUserManagementWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问用户管理/)).toBeInTheDocument();
  });
});
