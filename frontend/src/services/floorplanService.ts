/**
 * @file services/floorplanService.ts
 * @description 平面图 API 收敛层
 *
 * 后端：FloorPlanController（/floor-plans/*）
 */
import http from '@/utils/http';

export interface FloorPlan {
  id: number;
  name: string;
  building: string;
  floor: string;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  description?: string;
}

export interface PlanAsset {
  id: number;
  planId: number;
  assetId: number;
  posX: number;
  posY: number;
  label?: string;
  assetNo?: string;
  assetName?: string;
  assetStatus?: string;
}

export interface FloorPlanListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export interface FloorPlanListResponse {
  records: FloorPlan[];
  total: number;
}

/** 平面图分页列表 */
export function list(params: FloorPlanListParams = {}): Promise<FloorPlanListResponse> {
  const { page = 1, pageSize = 20, keyword } = params;
  return http.get<FloorPlanListResponse>('/floor-plans', {
    params: { page, pageSize, keyword },
  });
}

/** 平面图详情 */
export function getById(id: number): Promise<FloorPlan> {
  return http.get<FloorPlan>(`/floor-plans/${id}`);
}

/** 创建平面图 */
export function create(data: Partial<FloorPlan>): Promise<FloorPlan> {
  return http.post<FloorPlan>('/floor-plans', data);
}

/** 更新平面图 */
export function update(id: number, data: Partial<FloorPlan>): Promise<FloorPlan> {
  return http.put<FloorPlan>(`/floor-plans/${id}`, data);
}

/** 删除平面图 */
export function remove(id: number): Promise<void> {
  return http.delete<void>(`/floor-plans/${id}`);
}

/** 平面图下资产标记列表 */
export function getAssets(planId: number): Promise<PlanAsset[]> {
  return http.get<PlanAsset[]>(`/floor-plans/${planId}/assets`);
}

/** 标记资产到平面图 */
export function addAsset(
  planId: number,
  data: { assetId: number; posX: number; posY: number; label?: string },
): Promise<PlanAsset> {
  return http.post<PlanAsset>(`/floor-plans/${planId}/assets`, data);
}

/** 删除资产标记 */
export function removeAsset(planId: number, assetId: number): Promise<void> {
  return http.delete<void>(`/floor-plans/${planId}/assets/${assetId}`);
}

const floorplanService = {
  list,
  getById,
  create,
  update,
  remove,
  getAssets,
  addAsset,
  removeAsset,
};

export default floorplanService;
