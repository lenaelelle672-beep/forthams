import http from '@/utils/http';
import type { InspectionTask, InspectionTaskQueryParams } from '@/types/inspectionTask';

export const inspectionTaskApi = {
  /**
   * 分页查询任务列表
   */
  list: (params: InspectionTaskQueryParams) =>
    http.get<any>('/inspections/tasks/list', { params }),

  /**
   * 根据ID查询任务详情
   */
  getById: (id: number) =>
    http.get<InspectionTask>(`/inspections/tasks/${id}`),

  /**
   * 创建任务
   */
  create: (data: InspectionTask) =>
    http.post<InspectionTask>('/inspections/tasks', data),

  /**
   * 更新任务
   */
  update: (id: number, data: InspectionTask) =>
    http.put<InspectionTask>(`/inspections/tasks/${id}`, data),

  /**
   * 删除任务（软删除）
   */
  delete: (id: number) =>
    http.delete<void>(`/inspections/tasks/${id}`),

  /**
   * 批量创建任务
   */
  batchCreate: (tasks: InspectionTask[]) =>
    http.post<InspectionTask[]>('/inspections/tasks/batch', tasks),

  /**
   * 更新任务状态
   */
  updateStatus: (id: number, status: string) =>
    http.put<void>(`/inspections/tasks/${id}/status`, null, { params: { status } }),

  /**
   * 查询即将到期任务（提前 days 天提醒）
   */
  getExpiring: (days: number = 30) =>
    http.get<InspectionTask[]>('/inspections/tasks/expiring', { params: { days } }),

  /**
   * 查询逾期任务
   */
  getOverdue: () =>
    http.get<InspectionTask[]>('/inspections/tasks/overdue'),

  /**
   * 根据状态查询任务
   */
  getByStatus: (status: string) =>
    http.get<InspectionTask[]>('/inspections/tasks/list', { params: { status } })
};