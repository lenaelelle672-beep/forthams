import http from '@/utils/http';
import type {
  Inspection,
  InspectionQueryParams,
  InspectionTemplate,
  InspectionRecord,
  InspectionRecordQueryParams,
  InspectionStatisticsDTO,
  SysAttachment
} from '@/types/inspection';

export const inspectionApi = {
  list: (params: InspectionQueryParams) =>
    http.get<any>('/inspections/list', { params }),

  getById: (id: number) =>
    http.get<Inspection>(`/inspections/${id}`),

  create: (data: Inspection) =>
    http.post<Inspection>('/inspections', data),

  update: (id: number, data: Inspection) =>
    http.put<Inspection>(`/inspections/${id}`, data),

  delete: (id: number) =>
    http.delete<void>(`/inspections/${id}`),

  getExpiring: (days: number = 30) =>
    http.get<Inspection[]>('/inspections/expiring', { params: { days } }),

  getHistoryByAsset: (assetId: number, pageNum: number = 1, pageSize: number = 10) =>
    http.get<any>(`/inspections/history/${assetId}`, { params: { pageNum, pageSize } }),

  batchGenerate: (assetIds: number[], templateId: number) =>
    http.post<any>('/inspections/batch/generate', { assetIds, templateId }),

  batchGenerateByCategory: (assetCategoryId: number, templateId: number) =>
    http.post<any>('/inspections/batch/generate-by-category', { assetCategoryId, templateId }),

  // ==================== 检验照片管理 ====================

  uploadPhoto: (inspectionId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return http.post<SysAttachment>(`/inspections/${inspectionId}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  uploadPhotos: (inspectionId: number, photoUrls: string[]) =>
    http.post<void>(`/inspections/${inspectionId}/photos/batch`, { photoUrls }),

  getPhotos: (inspectionId: number) =>
    http.get<SysAttachment[]>(`/inspections/${inspectionId}/photos`),

  deletePhoto: (attachmentId: number) =>
    http.delete<void>(`/inspections/photos/${attachmentId}`),

  // ==================== 检验报告管理 ====================

  getReport: (inspectionId: number) =>
    http.get<string>(`/inspections/${inspectionId}/report`),

  generateReport: (inspectionId: number, format: string = 'pdf') => {
    return http.get(`/inspections/${inspectionId}/report`, {
      params: { format },
      responseType: 'blob'
    });
  }
};

export const inspectionTemplateApi = {
  list: (params: any) =>
    http.get<any>('/inspection-templates/list', { params }),

  getById: (id: number) =>
    http.get<InspectionTemplate>(`/inspection-templates/${id}`),

  create: (data: InspectionTemplate) =>
    http.post<InspectionTemplate>('/inspection-templates', data),

  update: (id: number, data: InspectionTemplate) =>
    http.put<InspectionTemplate>(`/inspection-templates/${id}`, data),

  delete: (id: number) =>
    http.delete<void>(`/inspection-templates/${id}`),

  toggleStatus: (id: number, status: string) =>
    http.put<void>(`/inspection-templates/${id}/status`, null, { params: { status } }),

  getByCategory: (categoryId: number) =>
    http.get<InspectionTemplate[]>(`/inspection-templates/by-category/${categoryId}`),

  copy: (id: number) =>
    http.post<InspectionTemplate>(`/inspection-templates/${id}/copy`)
};

export const inspectionRecordApi = {
  list: (params: InspectionRecordQueryParams) =>
    http.get<any>('/inspection-records/list', { params }),

  getById: (id: number) =>
    http.get<InspectionRecord>(`/inspection-records/${id}`),

  create: (data: InspectionRecord) =>
    http.post<InspectionRecord>('/inspection-records', data),

  update: (id: number, data: InspectionRecord) =>
    http.put<InspectionRecord>(`/inspection-records/${id}`, data),

  delete: (id: number) =>
    http.delete<void>(`/inspection-records/${id}`),

  getByAssetId: (assetId: number) =>
    http.get<InspectionRecord[]>(`/inspection-records/asset/${assetId}`),

  createFromTemplate: (assetId: number, templateId: number) =>
    http.post<InspectionRecord>('/inspection-records/from-template', null, { params: { assetId, templateId } }),

  getStatistics: (params: { startDate?: string; endDate?: string }) =>
    http.get<InspectionStatisticsDTO>('/inspection-records/statistics', { params }),

  getChartsByType: () =>
    http.get<any[]>('/inspection-records/charts/by-type'),

  getChartsByCategory: () =>
    http.get<any[]>('/inspection-records/charts/by-category')
};
