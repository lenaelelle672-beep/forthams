import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemRolePermissionsWorkbenchPage from '../SystemRolePermissionsWorkbenchPage';
import { getRolePermissionCatalog } from '../../../api/rolePermissions';

vi.mock('../../../api/rolePermissions', () => ({
  getRolePermissionCatalog: vi.fn(),
}));

const mockedGetCatalog = vi.mocked(getRolePermissionCatalog);

const emptyCatalog = {
  roles: [],
  permissions: [],
  summary: {
    roleCount: 0,
    permissionInventoryCount: 0,
    rolePermissionBindingCount: 0,
    boundPermissionCount: 0,
    unboundPermissionCount: 0,
    rolesWithoutPermissionsCount: 0,
  },
  riskTips: ['本页不支持分配/编辑/删除，不代表菜单权限或数据权限闭环'],
  readonlyNotice: '本页不支持分配/编辑/删除，不代表菜单权限或数据权限闭环',
};

function sampleCatalog() {
  return {
    roles: [
      {
        roleId: 1,
        roleName: '超级管理员',
        roleCode: 'SUPER_ADMIN',
        status: 1,
        permissionCount: 2,
        permissions: [
          { permissionId: 10, permissionName: '接口查询', permissionCode: 'system:integration:query', status: 1 },
          { permissionId: 11, permissionName: '角色权限查询', permissionCode: 'system:role-permission:query', status: 1 },
        ],
      },
      {
        roleId: 2,
        roleName: '审计角色',
        roleCode: 'AUDITOR',
        status: 0,
        permissionCount: 1,
        permissions: [
          { permissionId: 11, permissionName: '角色权限查询', permissionCode: 'system:role-permission:query', status: 1 },
        ],
      },
    ],
    permissions: [
      { permissionId: 10, permissionName: '接口查询', permissionCode: 'system:integration:query', status: 1 },
      { permissionId: 11, permissionName: '角色权限查询', permissionCode: 'system:role-permission:query', status: 1 },
      { permissionId: 12, permissionName: '未绑定权限', permissionCode: 'system:unbound:query', status: 1 },
    ],
    summary: {
      roleCount: 2,
      permissionInventoryCount: 3,
      rolePermissionBindingCount: 3,
      boundPermissionCount: 2,
      unboundPermissionCount: 1,
      rolesWithoutPermissionsCount: 0,
    },
    riskTips: [
      '本页不支持分配/编辑/删除，不代表菜单权限或数据权限闭环',
      '仅基于现有 RBAC 表展示。',
    ],
    readonlyNotice: '本页不支持分配/编辑/删除，不代表菜单权限或数据权限闭环',
  };
}

describe('SystemRolePermissionsWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('加载并展示角色-权限绑定目录、权限库存与风险提示', async () => {
    mockedGetCatalog.mockResolvedValueOnce(sampleCatalog());

    render(<SystemRolePermissionsWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('角色权限目录加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '角色-权限绑定目录' })).toBeInTheDocument();
    expect(screen.getByText('SUPER_ADMIN')).toBeInTheDocument();
    expect(screen.getAllByText('system:role-permission:query').length).toBeGreaterThan(0);
    expect(screen.getByText('3 项')).toBeInTheDocument();
    expect(screen.getAllByText('本页不支持分配/编辑/删除，不代表菜单权限或数据权限闭环').length).toBeGreaterThan(0);
  });

  it('支持关键词搜索、状态筛选与重新加载', async () => {
    mockedGetCatalog
      .mockResolvedValueOnce(sampleCatalog())
      .mockResolvedValueOnce({
        ...sampleCatalog(),
        roles: [{ ...sampleCatalog().roles[0], roleName: '刷新后的管理员' }],
      });

    render(<SystemRolePermissionsWorkbenchPage />);
    expect(await screen.findByText('超级管理员')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('按角色名称、编码或权限编码搜索'), '  auditor  ');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(screen.queryByText('超级管理员')).not.toBeInTheDocument();
    expect(screen.getByText('审计角色')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'enabled');
    expect(screen.getByText('没有符合条件的角色权限。')).toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText('按角色名称、编码或权限编码搜索'));
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'all');

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(mockedGetCatalog).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('刷新后的管理员')).toBeInTheDocument();
  });

  it('空态、错误脱敏态与无权限态可见且无高风险操作按钮', async () => {
    mockedGetCatalog.mockResolvedValueOnce(emptyCatalog).mockRejectedValueOnce(new Error('token=raw-secret'));

    render(<SystemRolePermissionsWorkbenchPage />);

    expect(await screen.findByText('暂无角色权限绑定目录。')).toBeInTheDocument();
    const forbiddenButtons = [
      '新增' + '角色',
      '编辑' + '角色',
      '删除' + '角色',
      '分配' + '权限',
      '保存' + '权限',
      '菜单权限' + '配置',
      '数据权限' + '配置',
      '租户' + '授权',
      '导入' + '导出',
      '上传' + '下载',
      '外发' + '通知',
    ];
    for (const label of forbiddenButtons) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemRolePermissionsWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问角色权限/)).toBeInTheDocument();
  });
});
