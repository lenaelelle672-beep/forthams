import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemMenuPermissionsWorkbenchPage from '../SystemMenuPermissionsWorkbenchPage';
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
          { permissionId: 10, permissionName: '菜单查询', permissionCode: 'system:menu:query', status: 1, description: '菜单入口查看' },
          { permissionId: 11, permissionName: '资产分类查询', permissionCode: 'asset:category:query', status: 1, description: '资产分类查看' },
        ],
      },
      {
        roleId: 2,
        roleName: '审计角色',
        roleCode: 'AUDITOR',
        status: 1,
        permissionCount: 1,
        permissions: [
          { permissionId: 12, permissionName: '旧菜单权限', permissionCode: 'legacy:menu:query', status: 0, description: '停用权限' },
        ],
      },
    ],
    permissions: [
      { permissionId: 10, permissionName: '菜单查询', permissionCode: 'system:menu:query', status: 1, description: '菜单入口查看' },
      { permissionId: 11, permissionName: '资产分类查询', permissionCode: 'asset:category:query', status: 1, description: '资产分类查看' },
      { permissionId: 12, permissionName: '旧菜单权限', permissionCode: 'legacy:menu:query', status: 0, description: '停用权限' },
      { permissionId: 13, permissionName: '未绑定菜单权限', permissionCode: 'system:menu:export', status: 1, description: '未绑定' },
    ],
    summary: {
      roleCount: 2,
      permissionInventoryCount: 4,
      rolePermissionBindingCount: 3,
      boundPermissionCount: 3,
      unboundPermissionCount: 1,
      rolesWithoutPermissionsCount: 0,
    },
    riskTips: ['仅基于现有 RBAC 表展示。'],
    readonlyNotice: '本页不支持分配/编辑/删除，不代表菜单权限或数据权限闭环',
  };
}

describe('SystemMenuPermissionsWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('加载并展示菜单权限只读覆盖视图、权限域和后端边界提示', async () => {
    mockedGetCatalog.mockResolvedValueOnce(sampleCatalog());

    render(<SystemMenuPermissionsWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('菜单权限目录加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'system 权限域' })).toBeInTheDocument();
    expect(screen.getByText('asset 权限域')).toBeInTheDocument();
    expect(screen.getByText('legacy 权限域')).toBeInTheDocument();
    expect(screen.getByText('system:menu:query')).toBeInTheDocument();
    expect(screen.getAllByText('SUPER_ADMIN').length).toBeGreaterThan(0);
    expect(screen.getByText('当前后端未提供 sys_menu/菜单分配接口，本页仅展示现有权限编码库存与绑定覆盖。')).toBeInTheDocument();
    expect(screen.getByText('4 项')).toBeInTheDocument();
  });

  it('支持关键词搜索、状态筛选与重新加载', async () => {
    mockedGetCatalog
      .mockResolvedValueOnce(sampleCatalog())
      .mockResolvedValueOnce({
        ...sampleCatalog(),
        permissions: [{ ...sampleCatalog().permissions[0], permissionName: '刷新后的菜单查询' }],
      });

    render(<SystemMenuPermissionsWorkbenchPage />);
    expect(await screen.findByText('system:menu:query')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('按权限域、权限编码或角色编码搜索'), '  asset  ');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(screen.queryByText('system:menu:query')).not.toBeInTheDocument();
    expect(screen.getByText('asset:category:query')).toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText('按权限域、权限编码或角色编码搜索'));
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'disabled');
    expect(screen.queryByText('asset:category:query')).not.toBeInTheDocument();
    expect(screen.getByText('legacy:menu:query')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'all');
    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(mockedGetCatalog).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('刷新后的菜单查询')).toBeInTheDocument();
  });

  it('空态、错误脱敏态与无权限态可见且无高风险操作按钮', async () => {
    mockedGetCatalog.mockResolvedValueOnce(emptyCatalog).mockRejectedValueOnce(new Error('token=raw-secret'));

    render(<SystemMenuPermissionsWorkbenchPage />);

    expect(await screen.findByText('暂无菜单权限编码目录。')).toBeInTheDocument();
    const forbiddenButtons = [
      '新增' + '菜单',
      '编辑' + '菜单',
      '删除' + '菜单',
      '分配' + '菜单',
      '保存' + '菜单',
      '菜单权限' + '配置',
      '数据权限' + '配置',
      '导入' + '导出',
      '上传' + '下载',
    ];
    for (const label of forbiddenButtons) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemMenuPermissionsWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问菜单权限/)).toBeInTheDocument();
  });
});
