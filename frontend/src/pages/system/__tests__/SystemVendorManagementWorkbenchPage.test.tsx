import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemVendorManagementWorkbenchPage from '../SystemVendorManagementWorkbenchPage';
import { listVendors } from '../../../api/vendors';

vi.mock('../../../api/vendors', () => ({
  listVendors: vi.fn(),
}));

const mockedList = vi.mocked(listVendors);

describe('SystemVendorManagementWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('加载并展示供应商列表', async () => {
    mockedList.mockResolvedValueOnce([
      { id: 1, name: '华北供应商', vendorCode: 'V-001', contactPerson: '张三', contactPhone: '13800000000', status: 1 },
      { id: 2, name: '停用供应商', vendorCode: 'V-002', contactPerson: '李四', status: 0 },
    ]);

    render(<SystemVendorManagementWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('供应商加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '供应商列表' })).toBeInTheDocument();
    expect(screen.getByText('华北供应商')).toBeInTheDocument();
    expect(screen.getByText('V-001')).toBeInTheDocument();
    expect(screen.getByText('显示 2 / 2 条')).toBeInTheDocument();
  });

  it('支持关键词搜索与状态筛选', async () => {
    mockedList.mockResolvedValueOnce([
      { id: 1, name: '华北供应商', vendorCode: 'V-001', contactPerson: '张三', status: 1 },
      { id: 2, name: '华南供应商', vendorCode: 'V-002', contactPerson: '李四', status: 0 },
    ]);

    render(<SystemVendorManagementWorkbenchPage />);
    expect(await screen.findByText('华北供应商')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('按名称、编码、联系人或地址搜索'), '华南');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));

    expect(screen.getByText('华南供应商')).toBeInTheDocument();
    expect(screen.queryByText('华北供应商')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'enabled');
    expect(screen.getByText('没有符合条件的供应商。')).toBeInTheDocument();
  });

  it('重新加载后刷新列表', async () => {
    mockedList
      .mockResolvedValueOnce([{ id: 1, name: '旧供应商', vendorCode: 'OLD', status: 1 }])
      .mockResolvedValueOnce([{ id: 2, name: '新供应商', vendorCode: 'NEW', status: 1 }]);

    render(<SystemVendorManagementWorkbenchPage />);
    expect(await screen.findByText('旧供应商')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));

    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('新供应商')).toBeInTheDocument();
  });

  it('空态、错误脱敏态与无权限态可见且无写操作按钮', async () => {
    mockedList.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('token=raw-secret'));

    render(<SystemVendorManagementWorkbenchPage />);

    expect(await screen.findByText('暂无供应商数据。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新增|编辑|删除/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemVendorManagementWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问供应商管理/)).toBeInTheDocument();
  });
});
