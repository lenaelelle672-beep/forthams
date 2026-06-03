/**
 * 维保计划 API — 对应后端 MaintenancePlanController
 *
 * 路由前缀: /maintenance/plans
 */
import http from '@/utils/http';
import type { MaintenancePlan, CreateMaintenancePlanRequest, UpdateMaintenancePlanRequest, PageResponse } from '@/types/maintenancePlan';

export const maintenancePlanApi = {
  /** GET /maintenance/plans/list — 分页查询 */
  list(params?: Record<string, any>) {
    return http.get<PageResponse<MaintenancePlan>>('/maintenance/plans/list', { params });
  },

  /** GET /maintenance/plans/{id} — 详情 */
  getById(id: number) {
    return http.get<MaintenancePlan>(`/maintenance/plans/${id}`);
  },

  /** POST /maintenance/plans — 创建 */
  create(data: CreateMaintenancePlanRequest) {
    return http.post<MaintenancePlan>('/maintenance/plans', data);
  },

  /** PUT /maintenance/plans/{id} — 更新 */
  update(id: number, data: UpdateMaintenancePlanRequest) {
    return http.put<MaintenancePlan>(`/maintenance/plans/${id}`, data);
  },

  /** DELETE /maintenance/plans/{id} — 删除 */
  delete(id: number) {
    return http.delete<void>(`/maintenance/plans/${id}`);
  },

  /** POST /maintenance/plans/{id}/generate — 手动生成维保记录 */
  generate(id: number) {
    return http.post<void>(`/maintenance/plans/${id}/generate`);
  },
};
