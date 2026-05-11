/**
 * locationService — 位置管理 API 服务层
 *
 * 封装与后端 `/locations` REST API 交互的所有方法，支持树形层级结构的
 * CRUD 操作：浏览位置树、获取子节点、新增/编辑/删除位置。
 *
 * @module services/locationService
 * @since SWARM-035
 */

import { api } from "../utils/api";

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/**
 * 位置实体接口 — 严格对齐后端 Location.java (L10-36) 的 6 个持久化字段
 *
 * @description 仅包含后端 Location 实体中定义的持久化字段，
 * 不包含 children、isSelected 等非持久化扩展属性。
 */
export interface ILocation {
  /** 位置 ID */
  id: number;
  /** 位置名称（后端字段 location_name，通过 SQL 别名映射为 name） */
  name?: string;
  /** 位置编码 */
  locationCode?: string;
  /** 父级位置 ID，null 或 undefined 表示顶级位置 */
  parentId?: number | null;
  /** 排序号（同级节点按此字段升序排列） */
  sortOrder?: number;
  /** 描述 */
  description?: string;
}

/**
 * 位置树节点类型 — 用于前端树形结构渲染
 *
 * @description 扩展 ILocation，增加 children 字段以支持嵌套树形结构。
 * children 仅在前端通过 buildLocationTree 组装，后端不直接返回。
 */
export interface ILocationTreeNode extends ILocation {
  /** 子节点列表（前端通过 parentId 组装） */
  children: ILocationTreeNode[];
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
   * 获取全部位置列表（扁平平铺）
   *
   * @description 调用 GET /locations/list 获取包含根节点及其所有子节点的平铺列表，
   * 前端需要根据 parentId 组装成树形结构。
   * 后端 findRootLocations 使用递归 CTE 返回整棵树的扁平数据。
   * @returns Promise<ILocation[]>
   */
  fetchLocations(): Promise<ILocation[]> {
    return api.get<ILocation[]>("/locations/list");
  },

  /**
   * 获取根位置列表
   *
   * @description 调用 GET /locations/root 获取所有根位置（parentId 为 null），
   * 后端通过递归 CTE 返回包含子节点的平铺列表。
   * @returns Promise<ILocation[]>
   */
  getRoots(): Promise<ILocation[]> {
    return api.get<ILocation[]>("/locations/root");
  },

  /**
   * 获取指定位置详情
   *
   * @param id - 位置 ID
   * @returns Promise<ILocation>
   */
  getById(id: number | string): Promise<ILocation> {
    return api.get<ILocation>(`/locations/${id}`);
  },

  /**
   * 新增位置
   *
   * @param data - 位置表单数据
   * @returns Promise<ILocation>
   */
  create(data: Partial<LocationFormData>): Promise<ILocation> {
    return api.post<ILocation>("/locations", data);
  },

  /**
   * 更新位置
   *
   * @param id - 位置 ID
   * @param data - 位置表单数据
   * @returns Promise<ILocation>
   */
  update(
    id: number | string,
    data: Partial<LocationFormData>,
  ): Promise<ILocation> {
    return api.put<ILocation>(`/locations/${id}`, data);
  },

  /**
   * 删除位置
   *
   * @param id - 位置 ID
   * @returns Promise<void>
   */
  deleteLocation(id: number | string): Promise<void> {
    return api.delete<void>(`/locations/${id}`);
  },
};

/* ------------------------------------------------------------------ */
/*  树形结构工具函数                                                   */
/* ------------------------------------------------------------------ */

/**
 * 将平铺的位置列表组装成树形结构
 *
 * @description 接收后端返回的平铺位置数组，根据 parentId 字段
 * 组装成嵌套的树形结构。同级节点严格按 sortOrder 升序排列，
 * sortOrder 相同时按 id 升序排列。
 *
 * @param flatList - 后端返回的平铺位置列表
 * @returns 组装后的树形结构（仅包含根节点的数组，子节点挂载在 children 属性下）
 *
 * @example
 * ```ts
 * const flat = [
 *   { id: 1, name: "总部", parentId: null, sortOrder: 0 },
 *   { id: 2, name: "A栋", parentId: 1, sortOrder: 1 },
 *   { id: 3, name: "B栋", parentId: 1, sortOrder: 0 },
 * ];
 * const tree = buildLocationTree(flat);
 * // tree = [{ id: 1, name: "总部", children: [{ id: 3, sortOrder: 0 }, { id: 2, sortOrder: 1 }] }]
 * ```
 */
export function buildLocationTree(
  flatList: ILocation[],
): ILocationTreeNode[] {
  const map = new Map<number, ILocationTreeNode>();
  const roots: ILocationTreeNode[] = [];

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
      parent.children.push(node);
    }
  }

  /** 按 sortOrder 升序排列，sortOrder 相同时按 id 升序 */
  const sortNodes = (nodes: ILocationTreeNode[]) => {
    nodes.sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id,
    );
    for (const node of nodes) {
      if (node.children.length > 0) {
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
  nodes: ILocationTreeNode[],
  id: number,
): ILocationTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findNodeInTree(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * 向后兼容别名 — 旧代码仍可使用 LocationRecord
 *
 * @deprecated 请使用 ILocation 代替
 */
export type LocationRecord = ILocation;

/**
 * 统计树中所有节点总数
 *
 * @param nodes - 树形节点数组
 * @returns 节点总数
 */
export function countTreeNodes(nodes: ILocationTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    count += countTreeNodes(node.children);
  }
  return count;
}
