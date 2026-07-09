import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemFormConfigWorkbenchPage from '../SystemFormConfigWorkbenchPage';
import { formDefinitionsApi } from '../../../api/formDefinitions';

vi.mock('../../../api/formDefinitions', () => ({
  formDefinitionsApi: {
    listDefinitions: vi.fn(),
    getDefinition: vi.fn(),
    saveDraft: vi.fn(),
    validateSchema: vi.fn(),
    publish: vi.fn(),
    disable: vi.fn(),
    listVersions: vi.fn(),
    getVersion: vi.fn(),
    rollback: vi.fn(),
    preview: vi.fn(),
    references: vi.fn(),
  },
}));

const mockedApi = vi.mocked(formDefinitionsApi);

const schema = {
  sections: [
    {
      sectionKey: 'basic',
      label: '基础信息',
      fields: [
        { fieldKey: 'assetNo', label: '资产编号', type: 'text' },
        { fieldKey: 'ownerPhone', label: '联系方式', type: 'text', sensitive: true, defaultValue: '******' },
      ],
    },
  ],
};

const definition = {
  formKey: 'ASSET_FORM',
  name: '资产表单',
  description: '资产流程表单',
  schema,
  status: 'DRAFT',
  version: 0,
};

describe('SystemFormConfigWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listDefinitions.mockResolvedValue([definition]);
    mockedApi.getDefinition.mockResolvedValue(definition);
    mockedApi.listVersions.mockResolvedValue([{ id: 1, formKey: 'ASSET_FORM', version: 1, actionType: 'PUBLISH', status: 'PUBLISHED', name: '资产表单', auditReason: '发布稳定版本' }]);
    mockedApi.preview.mockResolvedValue({ formKey: 'ASSET_FORM', name: '资产表单', fieldCount: 2, sensitiveFieldCount: 1, schema, warnings: ['已剥离危险字段'] });
    mockedApi.references.mockResolvedValue({ formKey: 'ASSET_FORM', referenceCount: 0, references: [], note: '当前最小闭环未发现流程节点引用' });
    mockedApi.validateSchema.mockResolvedValue({ valid: true, errors: [], warnings: ['已剥离危险字段'], fieldCount: 2, sensitiveFieldCount: 1, sanitizedSchema: schema });
    mockedApi.saveDraft.mockResolvedValue(definition);
    mockedApi.publish.mockResolvedValue({ ...definition, status: 'PUBLISHED', version: 1 });
    mockedApi.disable.mockResolvedValue({ ...definition, status: 'DISABLED', version: 2 });
    mockedApi.rollback.mockResolvedValue({ ...definition, status: 'PUBLISHED', version: 3 });
  });

  it('加载并展示列表、详情、版本、预览与引用分析', async () => {
    render(<SystemFormConfigWorkbenchPage embeddedInWorkbench />);

    expect(screen.getByText('表单配置加载中...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '表单配置' })).toBeInTheDocument();
    expect(screen.getByText('资产表单 · ASSET_FORM')).toBeInTheDocument();
    expect(screen.getByText('DRAFT / v0')).toBeInTheDocument();
    expect(screen.getByText(/预览字段 2 个，敏感字段 1 个/)).toBeInTheDocument();
    expect(screen.getByText('引用数量：0')).toBeInTheDocument();
    expect(screen.queryByText(/13800138000|raw-secret|token=/)).not.toBeInTheDocument();
  });

  it('支持空态、错误脱敏态与无权限态', async () => {
    mockedApi.listDefinitions.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('token=raw-secret'));

    render(<SystemFormConfigWorkbenchPage />);

    expect(await screen.findByText('暂无表单定义，可保存草稿创建 system-form-config 最小闭环。')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
    expect(screen.queryByText(/raw-secret/)).not.toBeInTheDocument();

    const { container } = render(<SystemFormConfigWorkbenchPage canView={false} />);
    expect(within(container).getByText(/无权限访问表单配置/)).toBeInTheDocument();
  });

  it('调用 wrapper 完成 schema 校验、保存草稿、发布、停用与恢复版本', async () => {
    render(<SystemFormConfigWorkbenchPage />);
    await screen.findByText('资产表单 · ASSET_FORM');

    await userEvent.click(screen.getByRole('button', { name: 'schema 校验' }));
    await waitFor(() => expect(mockedApi.validateSchema).toHaveBeenCalledWith('ASSET_FORM', expect.objectContaining({ name: '资产表单' })));
    expect(await screen.findByText('校验通过')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(mockedApi.saveDraft).toHaveBeenCalledWith('ASSET_FORM', expect.objectContaining({ name: '资产表单' })));

    await userEvent.click(screen.getByRole('button', { name: '发布表单' }));
    await waitFor(() => expect(mockedApi.publish).toHaveBeenCalledWith('ASSET_FORM', expect.objectContaining({ confirmed: true, reason: '表单配置发布复核通过', impactScope: '仅影响后续流程节点表单绑定', rollbackPlan: '通过版本历史恢复上一稳定版本' })));

    await userEvent.click(screen.getByRole('button', { name: '停用表单' }));
    await waitFor(() => expect(mockedApi.disable).toHaveBeenCalledWith('ASSET_FORM', expect.objectContaining({ confirmed: true, reason: '停用存在风险的表单版本' })));

    await userEvent.click(screen.getByRole('button', { name: '恢复最近版本' }));
    await waitFor(() => expect(mockedApi.rollback).toHaveBeenCalledWith('ASSET_FORM', 1, expect.objectContaining({ confirmed: true, reason: '恢复到 v1 稳定表单' })));
  });
});
