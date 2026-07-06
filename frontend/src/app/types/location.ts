/**
 * @module types/location
 * @description Location module type definitions — 位置模块共享类型
 *
 * Defines all TypeScript interfaces and types used by the location hierarchy
 * management feature (SWARM-059). These types align with the backend
 * Location entity (backend/src/main/java/com/ams/entity/Location.java).
 *
 * @since SWARM-059
 */

/* ------------------------------------------------------------------ */
/*  位置实体接口                                                       */  
/* ------------------------------------------------------------------ */

/**
 * 位置实体接口 — 对齐后端 Location.java (L10-36)
 *
 * @description 对应后端 Location 实体的 6 个持久化字段。
 * 不包含 children、isSelected 等非持久化扩展属性。
 */
export interface ILocation {
  /** 位置 ID */
  id: number;
  /** 位置名称 */
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
  /** 子节点列表 */
  children: ILocationTreeNode[];
}

/**
 * 创建/编辑位置的表单数据
 *
 * @description 用于新增和编辑位置的表单字段。
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

/**
 * 空表单默认值
 */
export const EMPTY_LOCATION_FORM: LocationFormData = {
  name: "",
  locationCode: "",
  parentId: null,
  sortOrder: 0,
  description: "",
};

/**
 * 向后兼容别名
 *
 * @deprecated 请使用 ILocation 代替
 */
export type LocationRecord = ILocation;
