/**
 * Location API — 位置管理通信契约层
 *
 * 封装与后端 LocationController REST API 的交互方法。
 * 严格对齐后端 `/api/locations` 及 `/api/locations/{id}` 路径，
 * 请求体结构仅包含后端 Location 实体的 6 个标准持久化字段。
 *
 * @module services/api
 * @since SWARM-048
 */

import { api } from "../utils/api";

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/**
 * Location 实体接口 — 严格对齐后端 Location.java 的 6 个标准持久化字段
 *
 * @description 仅包含后端 Location 实体中定义的持久化字段：
 * id, name, locationCode, parentId, sortOrder, description
 * 禁止包含 children 等前端计算属性。
 */
export interface Location {
  /** 位置 ID */
  id: number;
  /** 位置名称（后端字段 location_name） */
  name: string;
  /** 位置编码 */
  locationCode: string;
  /** 父级位置 ID，null 表示顶级位置 */
  parentId: number | null;
  /** 排序号（同级节点按此字段升序排列） */
  sortOrder: number;
  /** 描述 */
  description: string;
}

/**
 * 创建位置时的请求数据类型
 *
 * @description Omit Location 的 id 字段，创建时由后端自动生成
 */
export type LocationCreateData = Omit<Location, "id">;

/**
 * 编辑位置时的请求数据类型
 *
 * @description 允许部分更新，所有字段均可选（id 除外）
 */
export type LocationUpdateData = Partial<Omit<Location, "id">>;

/* ------------------------------------------------------------------ */
/*  API 方法                                                           */
/* ------------------------------------------------------------------ */

/**
 * 获取全部位置列表（扁平平铺）
 *
 * @description 调用 GET /api/locations/list 获取所有位置的平铺列表，
 * 前端需根据 parentId 组装成树形结构。
 *
 * @returns Promise<Location[]>
 */
export function fetchLocationTree(): Promise<Location[]> {
  return api.get<Location[]>("/locations/list");
}

/**
 * 创建新位置
 *
 * @description 调用 POST /api/locations 创建新位置，
 * 请求体仅包含 Location 的非 id 字段。
 *
 * @param data - 创建数据（不含 id）
 * @returns Promise<Location>
 */
export function createLocation(data: LocationCreateData): Promise<Location> {
  return api.post<Location>("/locations", data);
}

/**
 * 更新位置
 *
 * @description 调用 PUT /api/locations/{id} 更新已有位置，
 * 请求体仅包含需要更新的字段。
 *
 * @param id - 位置 ID
 * @param data - 更新数据（部分字段）
 * @returns Promise<Location>
 */
export function updateLocation(
  id: number,
  data: LocationUpdateData,
): Promise<Location> {
  return api.put<Location>(`/locations/${id}`, data);
}

/**
 * 删除位置
 *
 * @description 调用 DELETE /api/locations/{id} 删除指定位置。
 *
 * @param id - 位置 ID
 * @returns Promise<void>
 */
export function deleteLocation(id: number): Promise<void> {
  return api.delete<void>(`/locations/${id}`);
}
