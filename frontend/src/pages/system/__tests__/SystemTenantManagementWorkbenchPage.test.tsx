import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemTenantManagementWorkbenchPage from '../SystemTenantManagementWorkbenchPage';
import { listTenants, getTenantMeta } from '../../../api/tenant';

vi.mock('../../../api/tenant', () => ({
  listTenants: vi.fn(),
  getTenantMeta: vi.fn(),
}));

const mockedList = vi.mocked(listTenants);
const mockedMeta = vi.mocked(getTenantMeta);

const tenants = [
  { id: 'T001', name: '默认租户', plan: 'STANDARD', maxUsers: 100, maxAssets: 10000, status: 'ACTIVE', contactName: '管理员' },
  { id: 'T002', name: '子公司', plan: 'ENTERPRISE', maxUsers: 500, maxAssets: 50000, status: 'SUSPENDED', contactName: '张三' },
];

describe('SystemTenantManagementWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedList.mockResolvedValue({ records: tenants, total: tenants.length });
    mockedMeta.mockResolvedValue({ plans: ['STANDARD'], statuses: ['ACTIVE'], readOnlyNotice: '只读 catalog' });
  });

  it('加载并展示租户列表', async () => {
    render(<SystemTenantManagementWorkbenchPage canView />);
    expect(await screen.findByText('默认租户')).toBeInTheDocument();
    expect(screen.getByText('子公司')).toBeInTheDocument();
    expect(screen.getByText('T001')).toBeInTheDocument();
  });

  it('状态筛选：选已停用只显示停用租户', async () => {
    render(<SystemTenantManagementWorkbenchPage canView />);
    await screen.findByText('默认租户');

    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'SUSPENDED');

    expect(screen.queryByText('默认租户')).not.toBeInTheDocument();
    expect(screen.getByText('子公司')).toBeInTheDocument();
  });

  it('展示只读边界提示且无写操作按钮', async () => {
    render(<SystemTenantManagementWorkbenchPage canView />);
    await screen.findByText('默认租户');

    expect(screen.getByText(/只读边界/)).toBeInTheDocument();
    // 确认无新建/编辑/停用/启用等写操作按钮
    expect(screen.queryByRole('button', { name: /新建|新增/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /停用|启用|编辑|删除/ })).not.toBeInTheDocument();
  });

  it('加载失败展示脱敏错误提示', async () => {
    mockedList.mockRejectedValueOnce(new Error('token=raw-secret'));
    render(<SystemTenantManagementWorkbenchPage canView />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();
  });

  it('无权限态展示只读拦截', () => {
    render(<SystemTenantManagementWorkbenchPage canView={false} />);
    expect(screen.getByText(/无权限访问租户管理/)).toBeInTheDocument();
  });

  it('空态展示暂无提示', async () => {
    mockedList.mockResolvedValueOnce({ records: [], total: 0 });
    render(<SystemTenantManagementWorkbenchPage canView />);
    await waitFor(() => expect(screen.getByText('暂无租户数据。')).toBeInTheDocument());
  });
});
