import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import {
  createSystemFieldMapping,
  listSystemFieldMappings,
  previewSystemFieldMapping,
  updateSystemFieldMappingStatus,
} from '../api/systemFieldMappings';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('systemFieldMappings API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只访问 /system/field-mappings 专属列表', async () => {
    mockedApi.get.mockResolvedValueOnce([]);

    await listSystemFieldMappings();

    expect(mockedApi.get).toHaveBeenCalledWith('/system/field-mappings');
  });

  it('创建字段映射使用白名单表达式载荷', async () => {
    mockedApi.post.mockResolvedValueOnce({ id: 1 });

    await createSystemFieldMapping({
      interfaceId: 1,
      mappingName: '资产名称',
      sourceField: 'name',
      targetField: 'assetName',
      transformExpression: 'trim(value)',
      enabled: true,
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/system/field-mappings', expect.objectContaining({ transformExpression: 'trim(value)' }));
  });

  it('预览仅调用字段映射 preview 端点', async () => {
    mockedApi.post.mockResolvedValueOnce({ transformedValue: 'Laptop' });

    await previewSystemFieldMapping({ sourceField: 'name', targetField: 'assetName', sampleValue: ' Laptop ', transformExpression: 'trim(value)' });

    expect(mockedApi.post).toHaveBeenCalledWith('/system/field-mappings/preview', expect.objectContaining({ sourceField: 'name' }));
  });

  it('状态切换不暴露运行、重试或队列能力', async () => {
    mockedApi.put.mockResolvedValueOnce({ id: 1 });

    await updateSystemFieldMappingStatus(1, false);

    expect(mockedApi.put).toHaveBeenCalledWith('/system/field-mappings/1/status', undefined, { params: { enabled: false } });
  });
});
