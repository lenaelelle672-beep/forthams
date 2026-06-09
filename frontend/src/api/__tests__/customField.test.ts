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
import {
  assignFieldsToFieldset,
  assignFieldsetToCategory,
  createCustomField,
  createCustomFieldset,
  deleteCustomField,
  deleteCustomFieldset,
  getAssetCustomFields,
  getCustomFieldAll,
  getCustomFieldDetail,
  getCustomFieldList,
  getCustomFieldsetAll,
  getCustomFieldsetDetail,
  getCustomFieldsetList,
  getFieldsetByCategory,
  getFieldsetFields,
  saveAssetCustomFields,
  updateCustomField,
  updateCustomFieldset,
} from '@/api/customField';

const mockedHttp = vi.mocked(http);

describe('api/customField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls custom field CRUD endpoints with pagination and payloads', async () => {
    mockedHttp.get.mockResolvedValueOnce({ records: [], total: 0 });
    await getCustomFieldList(2, 20, '采购');
    expect(mockedHttp.get).toHaveBeenCalledWith('/system/custom-fields', {
      params: { page: 2, pageSize: 20, keyword: '采购' },
    });

    mockedHttp.get.mockResolvedValueOnce([]);
    await getCustomFieldAll();
    expect(mockedHttp.get).toHaveBeenCalledWith('/system/custom-fields/all');

    mockedHttp.get.mockResolvedValueOnce({ id: 7 });
    await getCustomFieldDetail(7);
    expect(mockedHttp.get).toHaveBeenCalledWith('/system/custom-fields/7');

    const payload = { fieldName: 'warranty_expiry', fieldLabel: '保修到期', fieldType: 'DATE' };
    mockedHttp.post.mockResolvedValueOnce({ id: 8, ...payload });
    await createCustomField(payload);
    expect(mockedHttp.post).toHaveBeenCalledWith('/system/custom-fields', payload);

    mockedHttp.put.mockResolvedValueOnce({ id: 8, ...payload, status: 0 });
    await updateCustomField(8, { ...payload, status: 0 });
    expect(mockedHttp.put).toHaveBeenCalledWith('/system/custom-fields/8', { ...payload, status: 0 });

    mockedHttp.delete.mockResolvedValueOnce(undefined);
    await deleteCustomField(8);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/system/custom-fields/8');
  });

  it('calls custom fieldset and assignment endpoints', async () => {
    mockedHttp.get.mockResolvedValueOnce({ records: [], total: 0 });
    await getCustomFieldsetList(1, 10, '资产');
    expect(mockedHttp.get).toHaveBeenCalledWith('/system/custom-fieldsets', {
      params: { page: 1, pageSize: 10, keyword: '资产' },
    });

    mockedHttp.get.mockResolvedValueOnce([]);
    await getCustomFieldsetAll();
    expect(mockedHttp.get).toHaveBeenCalledWith('/system/custom-fieldsets/all');

    mockedHttp.get.mockResolvedValueOnce({ id: 3 });
    await getCustomFieldsetDetail(3);
    expect(mockedHttp.get).toHaveBeenCalledWith('/system/custom-fieldsets/3');

    const fieldset = { name: 'IT 设备字段集', description: 'IT 设备扩展字段', status: 1 };
    mockedHttp.post.mockResolvedValueOnce({ id: 3, ...fieldset });
    await createCustomFieldset(fieldset);
    expect(mockedHttp.post).toHaveBeenCalledWith('/system/custom-fieldsets', fieldset);

    mockedHttp.put.mockResolvedValueOnce({ id: 3, ...fieldset, status: 0 });
    await updateCustomFieldset(3, { ...fieldset, status: 0 });
    expect(mockedHttp.put).toHaveBeenCalledWith('/system/custom-fieldsets/3', { ...fieldset, status: 0 });

    mockedHttp.delete.mockResolvedValueOnce(undefined);
    await deleteCustomFieldset(3);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/system/custom-fieldsets/3');

    mockedHttp.post.mockResolvedValueOnce(undefined);
    await assignFieldsToFieldset(3, [1, 2, 5]);
    expect(mockedHttp.post).toHaveBeenCalledWith('/system/custom-fieldsets/3/fields', { fieldIds: [1, 2, 5] });

    mockedHttp.get.mockResolvedValueOnce([]);
    await getFieldsetFields(3);
    expect(mockedHttp.get).toHaveBeenCalledWith('/system/custom-fieldsets/3/fields');

    mockedHttp.get.mockResolvedValueOnce(null);
    await getFieldsetByCategory(12);
    expect(mockedHttp.get).toHaveBeenCalledWith('/system/custom-fieldsets/by-category/12');

    mockedHttp.post.mockResolvedValueOnce(undefined);
    await assignFieldsetToCategory(12, 3);
    expect(mockedHttp.post).toHaveBeenCalledWith('/system/custom-fieldsets/assign-category', {
      categoryId: 12,
      fieldsetId: 3,
    });
  });

  it('calls asset custom field value endpoints', async () => {
    mockedHttp.get.mockResolvedValueOnce([]);
    await getAssetCustomFields(99);
    expect(mockedHttp.get).toHaveBeenCalledWith('/assets/99/custom-fields');

    const values = [{ fieldId: 1, fieldValue: '2026-12-31' }];
    mockedHttp.put.mockResolvedValueOnce(undefined);
    await saveAssetCustomFields(99, values);
    expect(mockedHttp.put).toHaveBeenCalledWith('/assets/99/custom-fields', { values });
  });
});
