import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import http from '@/utils/http';
import { systemPostApi } from '@/api/systemPosts';

const mockedHttp = vi.mocked(http);
const wrapperSource = readFileSync('src/api/systemPosts.ts', 'utf8');

describe('api/systemPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('只调用 /system/posts list/all/getById/meta/preview 合同', async () => {
    const post = {
      id: 8,
      postCode: 'POST-ENGINEER',
      postName: '工程师',
      sortOrder: 10,
      status: 'ENABLED',
      remark: 'metadata-only',
      tenantScoped: true,
      readOnly: true,
    };
    const page = {
      records: [post],
      total: 1,
      page: 1,
      pageSize: 20,
      pages: 1,
      tenantScoped: true,
      readOnly: true,
      readonlyBoundary: '只读岗位目录',
    };
    const meta = {
      statuses: [{ value: 'ENABLED', label: '启用' }],
      allowedPreviewFields: ['postCode', 'postName', 'sortOrder', 'status', 'remark'],
      previewPolicy: {
        tenantScoped: true,
        noPersistence: true,
        noAssignment: true,
        noPermissionEffect: true,
        runtimeEffect: false,
        cacheRefreshed: false,
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
    const preview = {
      previewAccepted: true,
      duplicateRisk: false,
      referenceImpact: 'masked-reference-risk:none',
      acceptedFields: ['postCode'],
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

    mockedHttp.get
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([post])
      .mockResolvedValueOnce(post)
      .mockResolvedValueOnce(meta);
    mockedHttp.post.mockResolvedValueOnce(preview);

    await expect(systemPostApi.list({ page: 1, pageSize: 20 })).resolves.toBe(page);
    await expect(systemPostApi.all()).resolves.toEqual([post]);
    await expect(systemPostApi.getById(8)).resolves.toBe(post);
    await expect(systemPostApi.meta()).resolves.toBe(meta);
    await expect(systemPostApi.preview({ postCode: 'POST-ENGINEER', postName: '工程师', status: 'ENABLED', sortOrder: 10 })).resolves.toBe(preview);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/system/posts', { params: { page: 1, pageSize: 20 } });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/system/posts/all', { params: undefined });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/system/posts/8');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/system/posts/meta');
    expect(mockedHttp.post).toHaveBeenCalledWith('/system/posts/preview', {
      postCode: 'POST-ENGINEER',
      postName: '工程师',
      status: 'ENABLED',
      sortOrder: 10,
    });
  });

  it('静态保持专属 wrapper，不暴露 CRUD、assignment 或 workflow helper', () => {
    expect(wrapperSource).toContain("'/system/posts'");
    expect(wrapperSource).toContain("'/system/posts/all'");
    expect(wrapperSource).toContain("'/system/posts/meta'");
    expect(wrapperSource).toContain("'/system/posts/preview'");
    expect(wrapperSource).not.toMatch(/create\(|update\(|delete\(|save\(|assignUserPosts|getUserPostIds|\/posts\/users|workflowApi|@\/api\/workflow|routePermissions|auth\/login\/mobile|from ['\"]@\/api\/post['\"]|from ['\"].*\/post['\"]/);
  });
});
