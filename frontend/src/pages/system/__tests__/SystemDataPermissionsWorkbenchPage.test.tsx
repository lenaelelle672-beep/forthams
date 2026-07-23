import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemDataPermissionsWorkbenchPage from '../SystemDataPermissionsWorkbenchPage';
import { getDataPermissionCatalog } from '../../../api/dataPermissions';

vi.mock('../../../api/dataPermissions', () => ({
  getDataPermissionCatalog: vi.fn(),
}));

const mockedApi = vi.mocked(getDataPermissionCatalog);

const catalog = {
  roles: [
    { roleId: 1, roleName: '管理员', roleCode: 'ADMIN', dataScope: 'ALL', dataScopeLabel: '全部数据', customScope: false, riskNote: '管理员 可见全部数据' },
    { roleId: 2, roleName: '部门专员', roleCode: 'DEPT_USER', dataScope: 'DEPT', dataScopeLabel: '本部门', customScope: false, riskNote: '' },
    { roleId: 3, roleName: '自定义角色', roleCode: 'CUSTOM_ROLE', dataScope: 'CUSTOM', dataScopeLabel: '自定义', customScope: true, riskNote: '自定义范围' },
  ],
  summary: { roleCount: 3, allScopeCount: 1, restrictedScopeCount: 1, customScopeCount: 1 },
  riskTips: ['有 1 个角色持有 ALL 范围。'],
  readOnlyNotice: '只读 catalog',
};

describe('SystemDataPermissionsWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.mockResolvedValue(catalog);
  });

  it('加载并展示角色数据范围列表', async () => {
    render(<SystemDataPermissionsWorkbenchPage canView />);
    expect(await screen.findByText('管理员')).toBeInTheDocument();
    expect(screen.getByText('DEPT_USER')).toBeInTheDocument();
    // 全部数据同时出现在筛选下拉和徽章里，用 getAllByText
    expect(screen.getAllByText('全部数据').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('本部门').length).toBeGreaterThanOrEqual(1);
  });

  it('展示 ALL/CUSTOM/已收紧 统计与风险提示', async () => {
    render(<SystemDataPermissionsWorkbenchPage canView />);
    await screen.findByText('管理员');
    expect(screen.getByText('风险提示')).toBeInTheDocument();
    expect(screen.getByText(/有 1 个角色持有 ALL 范围/)).toBeInTheDocument();
  });

  it('范围筛选：选自定义只显示 CUSTOM 角色', async () => {
    render(<SystemDataPermissionsWorkbenchPage canView />);
    await screen.findByText('管理员');

    await userEvent.selectOptions(screen.getByDisplayValue('全部范围'), 'CUSTOM');

    expect(screen.queryByText('管理员')).not.toBeInTheDocument();
    expect(screen.getByText('自定义角色')).toBeInTheDocument();
  });

  it('加载失败展示脱敏错误提示', async () => {
    mockedApi.mockRejectedValueOnce(new Error('token=raw-secret'));
    render(<SystemDataPermissionsWorkbenchPage canView />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();
  });

  it('无权限态展示只读拦截', () => {
    render(<SystemDataPermissionsWorkbenchPage canView={false} />);
    expect(screen.getByText(/无权限访问数据权限/)).toBeInTheDocument();
  });

  it('空态展示暂无提示', async () => {
    mockedApi.mockResolvedValueOnce({
      roles: [],
      summary: { roleCount: 0, allScopeCount: 0, restrictedScopeCount: 0, customScopeCount: 0 },
      riskTips: [],
      readOnlyNotice: '只读',
    });
    render(<SystemDataPermissionsWorkbenchPage canView />);
    await waitFor(() => expect(screen.getByText('暂无符合条件的角色数据范围。')).toBeInTheDocument());
  });
});
