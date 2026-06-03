import http from '@/utils/http';
import type { PageData } from '@/types/common';

export interface CustomFieldItem {
  id: number;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  fieldOptions?: string;
  validationPattern?: string;
  fieldOrder: number;
  required: number;
  encrypted: number;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldsetItem {
  id: number;
  name: string;
  description?: string;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export const FIELD_TYPES = [
  { value: 'TEXT', label: '文本' },
  { value: 'NUMBER', label: '数字' },
  { value: 'DATE', label: '日期' },
  { value: 'DROPDOWN', label: '下拉' },
  { value: 'BOOLEAN', label: '布尔' },
  { value: 'URL', label: '链接' },
  { value: 'EMAIL', label: '邮箱' },
  { value: 'REGEX', label: '正则' },
] as const;

export const getCustomFieldList = (page: number, pageSize: number, keyword?: string) =>
  http.get<PageData<CustomFieldItem>>('/system/custom-fields', { params: { page, pageSize, keyword } });

export const getCustomFieldAll = () =>
  http.get<CustomFieldItem[]>('/system/custom-fields/all');

export const getCustomFieldDetail = (id: number) =>
  http.get<CustomFieldItem>(`/system/custom-fields/${id}`);

export const createCustomField = (data: Partial<CustomFieldItem>) =>
  http.post<CustomFieldItem>('/system/custom-fields', data);

export const updateCustomField = (id: number, data: Partial<CustomFieldItem>) =>
  http.put<CustomFieldItem>(`/system/custom-fields/${id}`, data);

export const deleteCustomField = (id: number) =>
  http.delete<void>(`/system/custom-fields/${id}`);

export const getCustomFieldsetList = (page: number, pageSize: number, keyword?: string) =>
  http.get<PageData<CustomFieldsetItem>>('/system/custom-fieldsets', { params: { page, pageSize, keyword } });

export const getCustomFieldsetAll = () =>
  http.get<CustomFieldsetItem[]>('/system/custom-fieldsets/all');

export const getCustomFieldsetDetail = (id: number) =>
  http.get<CustomFieldsetItem>(`/system/custom-fieldsets/${id}`);

export const createCustomFieldset = (data: { name: string; description?: string; status?: number }) =>
  http.post<CustomFieldsetItem>('/system/custom-fieldsets', data);

export const updateCustomFieldset = (id: number, data: { name: string; description?: string; status?: number }) =>
  http.put<CustomFieldsetItem>(`/system/custom-fieldsets/${id}`, data);

export const deleteCustomFieldset = (id: number) =>
  http.delete<void>(`/system/custom-fieldsets/${id}`);

export const assignFieldsToFieldset = (fieldsetId: number, fieldIds: number[]) =>
  http.post<void>(`/system/custom-fieldsets/${fieldsetId}/fields`, { fieldIds });

export const getFieldsetFields = (fieldsetId: number) =>
  http.get<CustomFieldItem[]>(`/system/custom-fieldsets/${fieldsetId}/fields`);

export const getFieldsetByCategory = (categoryId: number) =>
  http.get<CustomFieldsetItem | null>(`/system/custom-fieldsets/by-category/${categoryId}`);

export const assignFieldsetToCategory = (categoryId: number, fieldsetId: number | null) =>
  http.post<void>('/system/custom-fieldsets/assign-category', { categoryId, fieldsetId });

export const getAssetCustomFields = (assetId: number) =>
  http.get<Array<{
    fieldId: number;
    fieldName: string;
    fieldLabel: string;
    fieldType: string;
    fieldOptions?: string;
    required: number;
    validationPattern?: string;
    fieldValue: string;
  }>>(`/assets/${assetId}/custom-fields`);

export const saveAssetCustomFields = (assetId: number, values: Array<{ fieldId: number; fieldValue: string }>) =>
  http.put<void>(`/assets/${assetId}/custom-fields`, { values });
