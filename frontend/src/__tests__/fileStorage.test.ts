import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../app/utils/api';
import { getFileStorageAttachmentCatalog } from '../api/fileStorage';

vi.mock('../app/utils/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('fileStorage API wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只访问附件元数据只读目录 GET 契约', async () => {
    mockedApi.get.mockResolvedValueOnce({ attachments: [], summary: {}, page: {}, businessTypes: [], fileTypes: [], riskTips: [] });

    await getFileStorageAttachmentCatalog({ keyword: '  合同  ', businessType: ' asset ', fileType: ' pdf ', page: 2, pageSize: 10 });

    expect(mockedApi.get).toHaveBeenCalledWith('/system/file-storage/attachments/catalog', {
      params: {
        keyword: '合同',
        businessType: 'asset',
        fileType: 'pdf',
        page: 2,
        pageSize: 10,
      },
    });
  });

  it('wrapper 不包含写入方法、文件流对象或访问链接字段', () => {
    expect(getFileStorageAttachmentCatalog.toString()).not.toMatch(/api\.(post|put|delete|patch)/);
    expect(getFileStorageAttachmentCatalog.toString()).not.toMatch(/FormData|Blob|createObjectURL/);
    expect(getFileStorageAttachmentCatalog.toString()).not.toMatch(/downloadUrl|previewUrl|storagePath/);
  });
});
