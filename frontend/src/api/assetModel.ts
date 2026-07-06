import http from '@/utils/http';

export interface AssetModel {
  id?: number;
  name: string;
  modelNo?: string;
  categoryId?: number;
  manufacturerId?: number;
  fieldsetId?: number;
  specifications?: string;
  description?: string;
  status?: number;
  remark?: string;
}

export const getAssetModels = (params?: Record<string, any>) =>
  http.get<any>('/asset-models', { params });

export const getAssetModelOptions = () =>
  http.get<AssetModel[]>('/asset-models/options');

export const getAssetModelDetail = (id: number) =>
  http.get<AssetModel>(`/asset-models/${id}`);

export const createAssetModel = (data: AssetModel) =>
  http.post<AssetModel>('/asset-models', data);

export const updateAssetModel = (id: number, data: AssetModel) =>
  http.put<AssetModel>(`/asset-models/${id}`, data);

export const deleteAssetModel = (id: number) =>
  http.delete(`/asset-models/${id}`);
