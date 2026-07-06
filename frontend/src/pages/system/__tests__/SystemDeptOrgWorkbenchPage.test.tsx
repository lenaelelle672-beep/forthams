import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemDeptOrgWorkbenchPage from '../SystemDeptOrgWorkbenchPage';
import { getDeptTree, listDepts } from '../../../api/depts';

vi.mock('../../../api/depts', () => ({
  getDeptTree: vi.fn(),
  listDepts: vi.fn(),
}));

const mockedList = vi.mocked(listDepts);
const mockedTree = vi.mocked(getDeptTree);

describe('SystemDeptOrgWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('加载并展示部门列表与根部门摘要', async () => {
    mockedList.mockResolvedValueOnce([
      {
        id: 1,
        dept_name: '总公司',
        dept_code: 'ROOT',
        parent_id: 0,
        sort_order: 1,
        leader: '张三',
        status: 0,
        children: [{ id: 2, dept_name: '研发部', dept_code: 'RD', parent_id: 1, sort_order: 2, status: 0 }],
      },
    ]);
    mockedTree.mockResolvedValueOnce([{ id: 1, name: '总公司', parentId: 0, status: '0' }]);

    render(<SystemDeptOrgWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('部门组织加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '部门列表' })).toBeInTheDocument();
    expect(screen.getAllByText('总公司').length).toBeGreaterThan(0);
    expect(screen.getByText('研发部')).toBeInTheDocument();
    expect(screen.getByText('显示 2 / 2 条')).toBeInTheDocument();
  });

  it('支持关键词搜索与状态筛选', async () => {
    mockedList
      .mockResolvedValueOnce([
        { id: 1, dept_name: '研发部', dept_code: 'RD', status: 0 },
        { id: 2, dept_name: '停用部门', dept_code: 'STOP', status: 2 },
      ])
      .mockResolvedValueOnce([{ id: 2, dept_name: '停用部门', dept_code: 'STOP', status: 2 }]);
    mockedTree.mockResolvedValue([]);

    render(<SystemDeptOrgWorkbenchPage />);
    expect(await screen.findByText('研发部')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('按名称或编码搜索'), '  停用  ');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));

    await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith({ keyword: '停用' }));
    expect(await screen.findByText('停用部门')).toBeInTheDocument();
    expect(screen.queryByText('研发部')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'enabled');
    expect(screen.getByText('没有符合条件的部门。')).toBeInTheDocument();
  });

  it('重新加载沿用当前关键词并刷新列表与根摘要', async () => {
    mockedList
      .mockResolvedValueOnce([{ id: 1, dept_name: '旧部门', dept_code: 'OLD', parent_id: 0, status: 0 }])
      .mockResolvedValueOnce([{ id: 2, dept_name: '新部门', dept_code: 'NEW', parent_id: 0, status: 0 }]);
    mockedTree
      .mockResolvedValueOnce([{ id: 1, name: '旧部门', parentId: 0 }])
      .mockResolvedValueOnce([{ id: 2, name: '新部门', parentId: 0 }]);

    render(<SystemDeptOrgWorkbenchPage />);
    expect(await screen.findAllByText('旧部门')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));

    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockedTree).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('新部门')).toHaveLength(2);
  });

  it('空态、错误脱敏态与无权限态可见且无写操作按钮', async () => {
    mockedList.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('token=raw-secret'));
    mockedTree.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    render(<SystemDeptOrgWorkbenchPage />);

    expect(await screen.findByText('暂无部门组织数据。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新增|编辑|删除|保存/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemDeptOrgWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问部门组织/)).toBeInTheDocument();
  });
});
