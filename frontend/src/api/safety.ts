import http from '@/utils/http';
import type {
  SafetyChecklistTemplate,
  SafetyChecklistItem,
  SafetyChecklistExecution,
  SafetyChecklistResult
} from '@/types/safety';

export const safetyApi = {
  // 模板
  listTemplates: (params?: { keyword?: string; pageNum?: number; pageSize?: number }) =>
    http.get<any>('/safety-checklists/templates', { params }),

  getTemplate: (id: number) =>
    http.get<SafetyChecklistTemplate>(`/safety-checklists/templates/${id}`),

  createTemplate: (data: SafetyChecklistTemplate) =>
    http.post<SafetyChecklistTemplate>('/safety-checklists/templates', data),

  updateTemplate: (id: number, data: SafetyChecklistTemplate) =>
    http.put<SafetyChecklistTemplate>(`/safety-checklists/templates/${id}`, data),

  deleteTemplate: (id: number) =>
    http.delete<void>(`/safety-checklists/templates/${id}`),

  // 检查项
  getItems: (templateId: number) =>
    http.get<SafetyChecklistItem[]>(`/safety-checklists/templates/${templateId}/items`),

  batchSaveItems: (templateId: number, items: SafetyChecklistItem[]) =>
    http.post<void>(`/safety-checklists/templates/${templateId}/items/batch`, items),

  deleteItem: (id: number) =>
    http.delete<void>(`/safety-checklists/items/${id}`),

  // 执行
  startExecution: (data: { templateId: number; assetId: number; executorId: number }) =>
    http.post<SafetyChecklistExecution>('/safety-checklists/executions/start', data),

  batchStartExecutions: (data: { templateId: number; assetIds: number[]; executorId: number }) =>
    http.post<SafetyChecklistExecution[]>('/safety-checklists/executions/batch-start', data),

  getExecution: (id: number) =>
    http.get<SafetyChecklistExecution>(`/safety-checklists/executions/${id}`),

  listExecutions: (params?: { templateId?: number; assetId?: number; status?: string; pageNum?: number; pageSize?: number }) =>
    http.get<any>('/safety-checklists/executions', { params }),

  submitResults: (executionId: number, results: SafetyChecklistResult[]) =>
    http.post<void>(`/safety-checklists/executions/${executionId}/submit`, results),

  completeExecution: (executionId: number) =>
    http.post<SafetyChecklistExecution>(`/safety-checklists/executions/${executionId}/complete`),

  getResults: (executionId: number) =>
    http.get<SafetyChecklistResult[]>(`/safety-checklists/executions/${executionId}/results`),

  // 照片上传
  uploadPhoto: (executionId: number, resultId: number, file: File, uploadBy: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadBy', uploadBy.toString());
    return http.post<SysAttachment>(`/safety-checklists/executions/${executionId}/results/${resultId}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  getPhotos: (executionId: number) =>
    http.get<SysAttachment[]>(`/safety-checklists/executions/${executionId}/photos`),

  deletePhoto: (photoId: number) =>
    http.delete<void>(`/safety-checklists/photos/${photoId}`),

  // PDF 报告生成
  generateReport: (executionId: number) =>
    http.get<Blob>(`/safety-checklists/executions/${executionId}/report`, {
      responseType: 'blob'
    }),

  // 批量执行（返回 BatchResult）
  batchExecute: (data: { templateId: number; assetIds: number[]; executorId: number }) =>
    http.post<SafetyChecklistBatchResult>('/safety-checklists/executions/batch-start', data),
}
