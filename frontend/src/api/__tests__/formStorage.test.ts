import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import http from '@/utils/http';
import { formStorageApi } from '@/api/formStorage';

const mockedHttp = vi.mocked(http);

describe('api/formStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('uses real /form-storage list detail create update and attachment endpoints', async () => {
    sessionStorage.setItem('user_info', JSON.stringify({ userId: 88 }));
    mockedHttp.get.mockResolvedValue({});
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue({});

    await formStorageApi.listFormStorageRecords({ formKey: 'ASSET_FORM', includeArchived: true });
    await formStorageApi.getFormStorageRecord('10/20');
    await formStorageApi.createFormStorageRecord({ formKey: 'ASSET_FORM', definitionVersion: 1, fieldValues: [{ fieldKey: 'assetNo', rawValue: 'A-001' }] });
    await formStorageApi.updateFormStorageRecord(10, { formKey: 'ASSET_FORM', definitionVersion: 1, fieldValues: [{ fieldKey: 'assetNo', rawValue: 'A-002' }] });
    await formStorageApi.listFormStorageAttachments(10);
    await formStorageApi.registerFormStorageAttachment(10, { fileName: '审计附件.pdf', storageKey: 'secret-storage-key' });
    await formStorageApi.deleteFormStorageAttachment(10, 99, { confirmed: true, reason: '删除附件引用' });

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/form-storage', { params: { formKey: 'ASSET_FORM', includeArchived: true } });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/form-storage/10%2F20');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/form-storage', expect.objectContaining({ formKey: 'ASSET_FORM', operatorId: 88 }));
    expect(mockedHttp.put).toHaveBeenCalledWith('/form-storage/10', expect.objectContaining({ formKey: 'ASSET_FORM', operatorId: 88 }));
    expect(mockedHttp.get).toHaveBeenNthCalledWith(3, '/form-storage/10/attachments');
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/form-storage/10/attachments', expect.objectContaining({ fileName: '审计附件.pdf', operatorId: 88 }));
    expect(mockedHttp.delete).toHaveBeenCalledWith('/form-storage/10/attachments/99', { data: expect.objectContaining({ confirmed: true, reason: '删除附件引用', operatorId: 88 }) });
  });

  it('uses confirmed archive delete and masked export payload with operatorId', async () => {
    localStorage.setItem('user_info', JSON.stringify({ id: 7 }));
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue({});

    await formStorageApi.archiveFormStorageRecord(12, {
      confirmed: true,
      reason: '归档复核通过',
      auditEvidence: 'ARCHIVE-GATE',
    });
    await formStorageApi.deleteFormStorageRecord(12, {
      confirmed: true,
      reason: '删除留痕复核通过',
      auditEvidence: 'DELETE-GATE',
    });
    await formStorageApi.exportFormStorageRecords({
      confirmed: true,
      reason: '导出脱敏快照',
      auditEvidence: 'EXPORT-GATE',
      query: { formKey: 'ASSET_FORM' },
    });

    expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/form-storage/12/archive', {
      confirmed: true,
      reason: '归档复核通过',
      auditEvidence: 'ARCHIVE-GATE',
      operatorId: 7,
    });
    expect(mockedHttp.delete).toHaveBeenCalledWith('/form-storage/12', {
      data: {
        confirmed: true,
        reason: '删除留痕复核通过',
        auditEvidence: 'DELETE-GATE',
        operatorId: 7,
      },
    });
    expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/form-storage/export', {
      confirmed: true,
      reason: '导出脱敏快照',
      auditEvidence: 'EXPORT-GATE',
      query: { formKey: 'ASSET_FORM' },
      operatorId: 7,
    });
    expect(JSON.stringify(mockedHttp.post.mock.calls)).not.toMatch(/fixed-assets\/workbench\?menu=|iframe|public\/mock/);
  });
});
