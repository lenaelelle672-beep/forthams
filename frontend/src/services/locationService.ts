/**
 * @file services/locationService.ts
 * @description 位置树 / 级联选择器 API 收敛层
 *
 * 后端：LocationController（/locations/list/tree/cascade/{id} + POST/PUT/DELETE/reorder）
 */
import http from '@/utils/http';

export interface LocationNode {
  id: number;
  name: string;
  locationCode: string;
  parentId?: number | null;
  sortOrder?: number;
  description?: string;
  status?: number;
  children?: LocationNode[];
}

export interface CascadeNode {
  code: string;
  name: string;
  children?: CascadeNode[];
}

/** 根节点列表 */
export function getList(): Promise<LocationNode[]> {
  return http.get<LocationNode[]>('/locations/list');
}

/** 完整树（带 children 嵌套） */
export function getTree(): Promise<LocationNode[]> {
  return http.get<LocationNode[]>('/locations/tree');
}

/** 联级选择器友好结构（code/name/children） */
export function getCascade(): Promise<CascadeNode[]> {
  return http.get<CascadeNode[]>('/locations/cascade');
}

/** 位置详情 */
export function getById(id: number): Promise<LocationNode> {
  return http.get<LocationNode>(`/locations/${id}`);
}

/** 直接子节点，可按 locationType 过滤（W7 + W14 — /locations/{id}/children?type=BUILDING|FLOOR|ROOM） */
export function getChildren(
  id: number,
  type?: 'PROVINCE' | 'CITY' | 'DISTRICT' | 'BUILDING' | 'FLOOR' | 'ROOM',
): Promise<LocationNode[]> {
  return http.get<LocationNode[]>(`/locations/${id}/children`, { params: type ? { type } : {} });
}

/** 创建位置 */
export function create(data: Partial<LocationNode>): Promise<LocationNode> {
  return http.post<LocationNode>('/locations', data);
}

/** 更新位置 */
export function update(id: number, data: Partial<LocationNode>): Promise<LocationNode> {
  return http.put<LocationNode>(`/locations/${id}`, data);
}

/** 删除位置 */
export function remove(id: number): Promise<void> {
  return http.delete<void>(`/locations/${id}`);
}

const locationService = {
  getList,
  getTree,
  getCascade,
  getById,
  getChildren,
  create,
  update,
  remove,
};

export default locationService;
