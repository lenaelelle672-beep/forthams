import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemAssetCategoryWorkbenchPage from '../SystemAssetCategoryWorkbenchPage';
import { getAssetCategoryTree, listAssetCategories } from '../../../api/assetCategories';

vi.mock('../../../api/assetCategories', () => ({
  getAssetCategoryTree: vi.fn(),
  listAssetCategories: vi.fn(),
}));

const mockedList = vi.mocked(listAssetCategories);
const mockedTree = vi.mocked(getAssetCategoryTree);

const emptyPage = { records: [], total: 0, size: 50, current: 1, pages: 0 };

describe('SystemAssetCategoryWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('加载并展示分类列表与分类树', async () => {
    mockedList.mockResolvedValueOnce({
      records: [
        { id: 1, categoryName: '办公设备', categoryCode: 'OFFICE', parentId: 0, sortOrder: 1 },
        { id: 2, categoryName: '笔记本电脑', categoryCode: 'LAPTOP', parentId: 1, sortOrder: 2 },
      ],
      total: 2,
      size: 50,
      current: 1,
      pages: 1,
    });
    mockedTree.mockResolvedValueOnce([
      {
        id: 1,
        categoryName: '办公设备',
        categoryCode: 'OFFICE',
        parentId: 0,
        children: [{ id: 2, categoryName: '笔记本电脑', categoryCode: 'LAPTOP', parentId: 1 }],
      },
    ]);

    render(<SystemAssetCategoryWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('资产分类加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '分类列表' })).toBeInTheDocument();
    expect(screen.getAllByText('办公设备').length).toBeGreaterThan(0);
    expect(screen.getAllByText('笔记本电脑').length).toBeGreaterThan(0);
    expect(screen.getByText('共 2 条')).toBeInTheDocument();
  });

  it('关键词搜索只触发 list 查询参数并保持树查询', async () => {
    mockedList
      .mockResolvedValueOnce(emptyPage)
      .mockResolvedValueOnce({
        records: [{ id: 3, categoryName: '车辆', categoryCode: 'VEHICLE', parentId: 0 }],
        total: 1,
        size: 50,
        current: 1,
        pages: 1,
      });
    mockedTree.mockResolvedValue([]);

    render(<SystemAssetCategoryWorkbenchPage />);
    await screen.findByText('暂无资产分类数据。');

    await userEvent.type(screen.getByPlaceholderText('按名称或编码搜索'), '  车辆  ');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));

    await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith({ page: 1, pageSize: 50, keyword: '车辆' }));
    expect(mockedTree).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('VEHICLE')).toBeInTheDocument();
  });

  it('重新加载沿用当前关键词并更新列表', async () => {
    mockedList
      .mockResolvedValueOnce(emptyPage)
      .mockResolvedValueOnce({ records: [{ id: 4, categoryName: '仪器', categoryCode: 'METER' }], total: 1, size: 50, current: 1, pages: 1 })
      .mockResolvedValueOnce({ records: [{ id: 5, categoryName: '精密仪器', categoryCode: 'METER-2' }], total: 1, size: 50, current: 1, pages: 1 });
    mockedTree.mockResolvedValue([]);

    render(<SystemAssetCategoryWorkbenchPage />);
    await screen.findByText('暂无资产分类数据。');

    await userEvent.type(screen.getByPlaceholderText('按名称或编码搜索'), '仪器');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(await screen.findByText('仪器')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));

    await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith({ page: 1, pageSize: 50, keyword: '仪器' }));
    expect(await screen.findByText('精密仪器')).toBeInTheDocument();
  });

  it('空态、错误脱敏态与无权限态可见且无写操作按钮', async () => {
    mockedList.mockResolvedValueOnce(emptyPage).mockRejectedValueOnce(new Error('token=raw-secret'));
    mockedTree.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    render(<SystemAssetCategoryWorkbenchPage />);

    expect(await screen.findByText('暂无资产分类数据。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新增|编辑|删除/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemAssetCategoryWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问资产分类/)).toBeInTheDocument();
  });
});
