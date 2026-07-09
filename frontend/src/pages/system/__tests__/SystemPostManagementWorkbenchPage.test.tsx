import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemPostManagementWorkbenchPage from '../SystemPostManagementWorkbenchPage';
import { systemPostApi } from '../../../api/systemPosts';

vi.mock('../../../api/systemPosts', () => ({
  systemPostApi: {
    list: vi.fn(),
    all: vi.fn(),
    getById: vi.fn(),
    meta: vi.fn(),
    preview: vi.fn(),
  },
}));

const mockedApi = vi.mocked(systemPostApi);
const pageSource = readFileSync('src/pages/system/SystemPostManagementWorkbenchPage.tsx', 'utf8');

describe('SystemPostManagementWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.list.mockResolvedValue(pageRecord());
    mockedApi.all.mockResolvedValue([postRecord()]);
    mockedApi.getById.mockResolvedValue(postRecord());
    mockedApi.meta.mockResolvedValue(metaRecord());
    mockedApi.preview.mockResolvedValue(previewRecord());
  });

  it('真实调用 list、all、getById、meta 与 preview，并展示只读 no-assignment 边界', async () => {
    const { container } = render(<SystemPostManagementWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('岗位 metadata-only catalog 加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '岗位 catalog' })).toBeInTheDocument();
    expect(container.querySelector('[data-system-post-management="workbench-v3"]')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByText(/真实调用 \/system\/posts/)).toBeInTheDocument();
    expect(screen.getByText(/noPersistence=true、noAssignment=true、noPermissionEffect=true/)).toBeInTheDocument();
    expect(screen.getByText(/system-post-management 已接入真组件/)).toBeInTheDocument();
    expect(screen.getByText(/不代表组织权限组、岗位权限 runtime、用户岗位分配或 Workbench V3 全量完成/)).toBeInTheDocument();
    expect(mockedApi.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(mockedApi.all).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(mockedApi.meta).toHaveBeenCalled();
    await waitFor(() => expect(mockedApi.getById).toHaveBeenCalledWith(8));

    await userEvent.click(screen.getByRole('button', { name: '运行 dry-run preview' }));
    await waitFor(() => expect(mockedApi.preview).toHaveBeenCalledWith(expect.objectContaining({
      postCode: 'POST-ENGINEER',
      postName: '工程师',
      sortOrder: 10,
      status: 'ENABLED',
      remark: 'metadata-only',
    })));
    expect(await screen.findByLabelText('岗位预览结果')).toHaveTextContent('previewAccepted=true · duplicateRisk=false');
    expect(screen.getByLabelText('岗位预览结果')).toHaveTextContent('noPersistence=true · noAssignment=true · noPermissionEffect=true · runtimeEffect=false · cacheRefreshed=false');
  });

  it('支持只读刷新、详情读取和无权限 fail-closed', async () => {
    render(<SystemPostManagementWorkbenchPage />);
    expect((await screen.findAllByText(/工程师/)).length).toBeGreaterThan(0);

    await userEvent.clear(screen.getByLabelText('岗位关键词'));
    await userEvent.type(screen.getByLabelText('岗位关键词'), 'engineer');
    await userEvent.click(screen.getByRole('button', { name: '只读刷新' }));
    await waitFor(() => expect(mockedApi.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, keyword: 'engineer' }));

    await userEvent.click(screen.getByRole('button', { name: /工程师/ }));
    await waitFor(() => expect(mockedApi.getById).toHaveBeenLastCalledWith(8));

    vi.clearAllMocks();
    render(<SystemPostManagementWorkbenchPage canView={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('无权限访问岗位 metadata-only catalog');
    expect(mockedApi.list).not.toHaveBeenCalled();
    expect(mockedApi.preview).not.toHaveBeenCalled();
  });

  it('静态证明页面未调用 CRUD、assignment、routePermissions、workflow 或旧 post 模块', () => {
    for (const allowed of [
      'systemPostApi.list',
      'systemPostApi.all',
      'systemPostApi.getById',
      'systemPostApi.meta',
      'systemPostApi.preview',
    ]) {
      expect(pageSource).toContain(allowed);
    }
    expect(pageSource).not.toMatch(/postApi|@\/api\/post|\.\.\/api\/post|assignUserPosts|getUserPostIds|routePermissions|workflowApi|@\/api\/workflow|auth\/login\/mobile|保存修改|删除|用户分配|权限授予/);
  });

  function postRecord() {
    return {
      id: 8,
      postCode: 'POST-ENGINEER',
      postName: '工程师',
      sortOrder: 10,
      status: 'ENABLED',
      remark: 'metadata-only',
      tenantScoped: true,
      readOnly: true,
      readonlyBoundary: '只读岗位目录',
    };
  }

  function pageRecord() {
    return {
      records: [postRecord()],
      total: 1,
      page: 1,
      pageSize: 20,
      pages: 1,
      tenantScoped: true,
      readOnly: true,
      readonlyBoundary: '只读岗位目录',
    };
  }

  function metaRecord() {
    return {
      statuses: [{ value: 'ENABLED', label: '启用' }],
      allowedPreviewFields: ['postCode', 'postName', 'sortOrder', 'status', 'remark'],
      previewPolicy: {
        tenantScoped: true,
        noPersistence: true,
        noAssignment: true,
        noPermissionEffect: true,
        runtimeEffect: false,
        cacheRefreshed: false,
        readonlyBoundary: '只读岗位目录',
        rejectedInputFields: ['userIds'],
      },
      tenantScoped: true,
      readOnly: true,
      noPersistencePreview: true,
      noAssignment: true,
      noPermissionEffect: true,
      runtimeEffect: false,
      cacheRefreshed: false,
      readonlyBoundary: '只读岗位目录',
      nonGoals: ['不代表组织权限组完成'],
    };
  }

  function previewRecord() {
    return {
      previewAccepted: true,
      duplicateRisk: false,
      referenceImpact: 'masked-reference-risk:none',
      acceptedFields: ['postCode', 'postName', 'sortOrder', 'status', 'remark'],
      rejectedInputs: [],
      warnings: [],
      tenantScoped: true,
      readOnly: true,
      noPersistence: true,
      noAssignment: true,
      noPermissionEffect: true,
      runtimeEffect: false,
      cacheRefreshed: false,
      readonlyBoundary: '只读岗位目录',
    };
  }
});
