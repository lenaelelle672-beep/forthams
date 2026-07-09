import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import http from '@/utils/http';
import { formDefinitionsApi, type FormDefinitionSchema } from '@/api/formDefinitions';

const mockedHttp = vi.mocked(http);

const schema: FormDefinitionSchema = {
  sections: [
    {
      sectionKey: 'basic',
      label: '基础信息',
      fields: [
        { fieldKey: 'assetNo', label: '资产编号', type: 'text', required: true },
      ],
    },
  ],
};

describe('api/formDefinitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('uses real /form-definitions list detail draft validate preview and references endpoints', async () => {
    sessionStorage.setItem('user_info', JSON.stringify({ userId: 88 }));
    mockedHttp.get.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});

    await formDefinitionsApi.listDefinitions();
    await formDefinitionsApi.getDefinition('ASSET/FORM');
    await formDefinitionsApi.saveDraft('ASSET/FORM', { name: '资产表单', schema });
    await formDefinitionsApi.validateSchema('ASSET/FORM', { name: '资产表单', schema });
    await formDefinitionsApi.preview('ASSET/FORM');
    await formDefinitionsApi.references('ASSET/FORM');

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/form-definitions');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/form-definitions/ASSET%2FFORM');
    expect(mockedHttp.put).toHaveBeenCalledWith('/form-definitions/ASSET%2FFORM/draft', {
      name: '资产表单',
      schema,
      operatorId: 88,
    });
    expect(mockedHttp.post).toHaveBeenCalledWith('/form-definitions/ASSET%2FFORM/schema/validate', { name: '资产表单', schema });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/form-definitions/ASSET%2FFORM/preview');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(4, '/form-definitions/ASSET%2FFORM/references');
  });

  it('uses confirmed publish disable and rollback endpoints with audit payload and operatorId', async () => {
    localStorage.setItem('user_info', JSON.stringify({ id: 7 }));
    mockedHttp.post.mockResolvedValue({});

    await formDefinitionsApi.publish('ASSET_FORM', {
      confirmed: true,
      reason: '发布稳定版本',
      publishNote: '发布稳定版本',
      impactScope: '仅影响后续实例',
      rollbackPlan: '恢复上一版本',
    });
    await formDefinitionsApi.disable('ASSET_FORM', {
      confirmed: true,
      reason: '临时停用',
      impactScope: '停止后续绑定',
      rollbackPlan: '恢复上一发布版本',
    });
    await formDefinitionsApi.rollback('ASSET_FORM', 2, {
      confirmed: true,
      reason: '恢复稳定版本',
      impactScope: '仅影响后续实例',
      rollbackPlan: '必要时恢复到 v3',
    });

    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/form-definitions/ASSET_FORM/publish', {
      confirmed: true,
      reason: '发布稳定版本',
      publishNote: '发布稳定版本',
      impactScope: '仅影响后续实例',
      rollbackPlan: '恢复上一版本',
      operatorId: 7,
    });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/form-definitions/ASSET_FORM/disable', {
      confirmed: true,
      reason: '临时停用',
      impactScope: '停止后续绑定',
      rollbackPlan: '恢复上一发布版本',
      operatorId: 7,
    });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/form-definitions/ASSET_FORM/versions/2/rollback', {
      confirmed: true,
      reason: '恢复稳定版本',
      impactScope: '仅影响后续实例',
      rollbackPlan: '必要时恢复到 v3',
      operatorId: 7,
    });
  });

  it('fetches immutable version history without workflow.ts or legacy V2 endpoints', async () => {
    mockedHttp.get.mockResolvedValue({});

    await formDefinitionsApi.listVersions('ASSET_FORM');
    await formDefinitionsApi.getVersion('ASSET_FORM', 3);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/form-definitions/ASSET_FORM/versions');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/form-definitions/ASSET_FORM/versions/3');
    expect(JSON.stringify(mockedHttp.get.mock.calls)).not.toContain('/workflows');
    expect(JSON.stringify(mockedHttp.get.mock.calls)).not.toContain('/fixed-assets/workbench');
  });
});
