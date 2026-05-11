/**
 * locationService — 位置管理 API 服务层
 *
 * 封装与后端 `/locations` REST API 交互的所有方法，支持树形层级结构的
 * CRUD 操作：浏览位置树、获取子节点、新增/编辑/删除位置。
 *
 * @module services/locationService
 * @since SWARM-023
 */

import { api } from "../utils/api";

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/**
 * 位置记录接口
 *
 * @description 与后端 Location entity 对应的前端类型定义。
 * 后端使用 location_name 作为列名，通过 SQL 别名映射为 name。
 */
export interface LocationRecord {
  /** 位置 ID */
  id: number;
  /** 位置名称（后端字段 location_name） */
  name?: string;
  /** 位置编码 */
  locationCode?: string;
  /** 父级位置 ID，null 或 undefined 表示顶级位置 */
  parentId?: number | null;
  /** 排序号 */
  sortOrder?: number;
  /** 描述 */
  description?: string;
  /** 状态 (0=禁用, 1=启用) */
  status?: number;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
  /** 前端组装的子节点（后端不直接返回此字段） */
  children?: LocationRecord[];
  /** 允许扩展属性 */
  [key: string]: unknown;
}

/**
 * 创建/编辑位置的表单数据
 *
 * @description 用于新增和编辑位置的表单字段
 */
export interface LocationFormData {
  /** 位置名称 */
  name: string;
  /** 位置编码 */
  locationCode: string;
  /** 父级位置 ID */
  parentId: number | null;
  /** 排序号 */
  sortOrder: number;
  /** 描述 */
  description: string;
  /** 状态 */
  status: number;
}

/* ------------------------------------------------------------------ */
/*  空表单默认值                                                       */
/* ------------------------------------------------------------------ */

/** 空表单默认值 */
export const EMPTY_LOCATION_FORM: LocationFormData = {
  name: "",
  locationCode: "",
  parentId: null,
  sortOrder: 0,
  description: "",
  status: 1,
};

/* ------------------------------------------------------------------ */
/*  API 方法                                                           */
/* ------------------------------------------------------------------ */

/**
 * 位置管理 API 服务对象
 *
 * @description 提供位置的 CRUD 方法，所有请求经过统一的 api 工具函数处理，
 * 自动添加认证 token 和处理错误响应。
 */
export const locationService = {
  /**
   * 获取全部位置列表（含所有层级）
   *
   * @description 调用 GET /locations/list 获取包含根节点及其所有子节点的平铺列表，
   * 前端需要根据 parentId 组装成树形结构。
   * @returns Promise<LocationRecord[]>
   */
  list(): Promise<LocationRecord[]> {
    return api.get<LocationRecord[]>("/locations/list");
  },

  /**
   * 获取根位置列表
   *
   * @description 调用 GET /locations/root 获取所有根位置（parentId 为 null），
   * 后端通过递归 CTE 返回包含子节点的平铺列表。
   * @returns Promise<LocationRecord[]>
   */
  getRoots(): Promise<LocationRecord[]> {
    return api.get<LocationRecord[]>("/locations/root");
  },

  /**
   * 获取指定位置详情
   *
   * @param id - 位置 ID
   * @returns Promise<LocationRecord>
   */
  getById(id: number | string): Promise<LocationRecord> {
    return api.get<LocationRecord>(`/locations/${id}`);
  },

  /**
   * 获取指定位置的直接子节点
   *
   * @param parentId - 父位置 ID
   * @returns Promise<LocationRecord[]>
   */
  getChildren(parentId: number | string): Promise<LocationRecord[]> {
    return api.get<LocationRecord[]>(`/locations/${parentId}/children`);
  },

  /**
   * 新增位置
   *
   * @param data - 位置表单数据
   * @returns Promise<LocationRecord>
   */
  create(data: Partial<LocationFormData>): Promise<LocationRecord> {
    return api.post<LocationRecord>("/locations", data);
  },

  /**
   * 更新位置
   *
   * @param id - 位置 ID
   * @param data - 位置表单数据
   * @returns Promise<LocationRecord>
   */
  update(
    id: number | string,
    data: Partial<LocationFormData>,
  ): Promise<LocationRecord> {
    return api.put<LocationRecord>(`/locations/${id}`, data);
  },

  /**
   * 删除位置
   *
   * @param id - 位置 ID
   * @returns Promise<string>
   */
  delete(id: number | string): Promise<string> {
    return api.delete<string>(`/locations/${id}`);
  },
};

/* ------------------------------------------------------------------ */
/*  树形结构工具函数                                                   */
/* ------------------------------------------------------------------ */

/**
 * 将平铺的位置列表组装成树形结构
 *
 * @description 接收后端返回的平铺位置数组，根据 parentId 字段
 * 组装成嵌套的树形结构，便于前端递归渲染。
 *
 * @param flatList - 后端返回的平铺位置列表
 * @returns 组装后的树形结构（仅包含根节点的数组，子节点挂载在 children 属性下）
 *
 * @example
 * ```ts
 * const flat = [
 *   { id: 1, name: "总部", parentId: null },
 *   { id: 2, name: "A栋", parentId: 1 },
 *   { id: 3, name: "B栋", parentId: 1 },
 * ];
 * const tree = buildLocationTree(flat);
 * // tree = [{ id: 1, name: "总部", children: [{ id: 2, ... }, { id: 3, ... }] }]
 * ```
 */
export function buildLocationTree(
  flatList: LocationRecord[],
): LocationRecord[] {
  const map = new Map<number, LocationRecord>();
  const roots: LocationRecord[] = [];

  // 先给每个节点初始化 children 数组并放入 map
  for (const item of flatList) {
    map.set(item.id, { ...item, children: [] });
  }

  // 再遍历一次组装父子关系
  for (const item of flatList) {
    const node = map.get(item.id)!;
    if (item.parentId == null || !map.has(item.parentId)) {
      roots.push(node);
    } else {
      const parent = map.get(item.parentId)!;
      parent.children!.push(node);
    }
  }

  /** 按 sortOrder 升序排列 */
  const sortNodes = (nodes: LocationRecord[]) => {
    nodes.sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id,
    );
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        sortNodes(node.children);
      }
    }
  };

  sortNodes(roots);
  return roots;
}

/**
 * 在树中递归查找指定 ID 的节点
 *
 * @param nodes - 树形节点数组
 * @param id - 目标节点 ID
 * @returns 找到的节点，未找到返回 undefined
 */
export function findNodeInTree(
  nodes: LocationRecord[],
  id: number,
): LocationRecord | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeInTree(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * 统计树中所有节点总数
 *
 * @param nodes - 树形节点数组
 * @returns 节点总数
 */
export function countTreeNodes(nodes: LocationRecord[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children) {
      count += countTreeNodes(node.children);
    }
  }
  return count;
}
