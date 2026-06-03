/**
 * @file api/maintenanceExecution.ts
 * @description 维保执行跟踪 API 服务 — 封装所有后端端点调用
 *
 * 统一使用 http 实例（from @/utils/http），响应已解包一层 Result<T>.data。
 */

import http from '@/utils/http';
import type {
  MaintenanceExecution,
  MaintenanceExecutionStep,
  MaintenanceExecutionMaterial,
  ExecutionStartPayload,
  StepCreatePayload,
  StepUpdatePayload,
  MaterialCreatePayload,
} from '@/types/maintenanceExecution';

/** 执行记录相关 API */
export const executionApi = {
  /** 开始施工 */
  start(data: ExecutionStartPayload) {
    return http.post<MaintenanceExecution>('/maintenance/execution', data);
  },

  /** 暂停施工 */
  pause(id: number) {
    return http.post<MaintenanceExecution>(`/maintenance/execution/${id}/pause`);
  },

  /** 恢复施工 */
  resume(id: number) {
    return http.post<MaintenanceExecution>(`/maintenance/execution/${id}/resume`);
  },

  /** 完成施工 */
  complete(id: number) {
    return http.post<MaintenanceExecution>(`/maintenance/execution/${id}/complete`);
  },

  /** 查询执行详情 */
  getById(id: number) {
    return http.get<MaintenanceExecution>(`/maintenance/execution/${id}`);
  },

  /** 按维保记录查询 */
  getByRecordId(recordId: number) {
    return http.get<MaintenanceExecution[]>(`/maintenance/execution/by-record/${recordId}`);
  },

  /** 按工单查询 */
  getByWorkOrderId(workOrderId: number) {
    return http.get<MaintenanceExecution[]>(`/maintenance/execution/by-work-order/${workOrderId}`);
  },

  /** 获取步骤列表 */
  getSteps(executionId: number) {
    return http.get<MaintenanceExecutionStep[]>(`/maintenance/execution/${executionId}/steps`);
  },

  /** 创建步骤 */
  createStep(executionId: number, data: StepCreatePayload) {
    return http.post<MaintenanceExecutionStep>(`/maintenance/execution/${executionId}/steps`, data);
  },

  /** 更新步骤 */
  updateStep(executionId: number, stepId: number, data: StepUpdatePayload) {
    return http.put<MaintenanceExecutionStep>(`/maintenance/execution/${executionId}/steps/${stepId}`, data);
  },

  /** 删除步骤 */
  deleteStep(executionId: number, stepId: number) {
    return http.delete<void>(`/maintenance/execution/${executionId}/steps/${stepId}`);
  },

  /** 获取物料列表 */
  getMaterials(executionId: number) {
    return http.get<MaintenanceExecutionMaterial[]>(`/maintenance/execution/${executionId}/materials`);
  },

  /** 添加物料 */
  addMaterial(executionId: number, data: MaterialCreatePayload) {
    return http.post<MaintenanceExecutionMaterial>(`/maintenance/execution/${executionId}/materials`, data);
  },

  /** 删除物料 */
  deleteMaterial(executionId: number, materialId: number) {
    return http.delete<void>(`/maintenance/execution/${executionId}/materials/${materialId}`);
  },

  /** 上传现场照片 */
  uploadPhoto(executionId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return http.post<string>(`/maintenance/execution/${executionId}/upload-photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
