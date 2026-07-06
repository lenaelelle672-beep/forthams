/**
 * LocationTree — 位置树形层级展示组件
 *
 * 递归渲染位置层级树，支持展开/收起、编辑、新增子节点、删除操作。
 * 同级节点按 sortOrder 升序排列。
 *
 * @module pages/location/LocationTree
 * @since SWARM-059
 */

import React from "react";
import {
  Pencil,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronDown,
  MapPin,
  FolderPlus,
} from "lucide-react";
import type { ILocationTreeNode } from "../../types/location";

/* ------------------------------------------------------------------ */
/*  Props 接口                                                         */
/* ------------------------------------------------------------------ */

/**
 * LocationTreeProps — LocationTree 组件属性
 */
export interface LocationTreeProps {
  /** 树形数据（根节点数组） */
  treeData: ILocationTreeNode[];
  /** 当前展开的节点 ID 集合 */
  expandedIds: Set<number>;
  /** 展开/收起切换回调 */
  onToggle: (id: number) => void;
  /** 编辑回调 */
  onEdit: (node: ILocationTreeNode) => void;
  /** 新增子节点回调 */
  onAddChild: (parent: ILocationTreeNode) => void;
  /** 删除回调 */
  onDelete: (node: ILocationTreeNode) => void;
  /** 当前正在删除的节点 ID */
  deletingId: number | null;
}

/**
 * LocationTreeNodeProps — 单个树节点属性
 */
interface LocationTreeNodeProps {
  /** 当前节点数据 */
  node: ILocationTreeNode;
  /** 当前展开的节点 ID 集合 */
  expandedIds: Set<number>;
  /** 展开/收起切换回调 */
  onToggle: (id: number) => void;
  /** 编辑回调 */
  onEdit: (node: ILocationTreeNode) => void;
  /** 新增子节点回调 */
  onAddChild: (parent: ILocationTreeNode) => void;
  /** 删除回调 */
  onDelete: (node: ILocationTreeNode) => void;
  /** 当前正在删除的节点 ID */
  deletingId: number | null;
  /** 缩进层级 */
  level: number;
}

/* ------------------------------------------------------------------ */
/*  树节点组件                                                         */
/* ------------------------------------------------------------------ */

/**
 * LocationTreeNode — 递归渲染位置树节点
 *
 * @description 单个树节点，支持展开/收起、编辑、新增子节点、删除操作。
 * 子节点通过递归调用自身来渲染。
 *
 * @param props - 组件属性
 * @returns React 节点
 */
function LocationTreeNode({
  node,
  expandedIds,
  onToggle,
  onEdit,
  onAddChild,
  onDelete,
  deletingId,
  level,
}: LocationTreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        {/* 名称列（带缩进和展开图标） */}
        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
          <div
            className="flex items-center"
            style={{ paddingLeft: `${level * 24}px` }}
          >
            <button
              type="button"
              onClick={() => hasChildren && onToggle(node.id)}
              className={`mr-2 flex-shrink-0 p-0.5 rounded hover:bg-blue-50 transition-colors ${
                hasChildren ? "cursor-pointer" : "cursor-default opacity-30"
              }`}
              disabled={!hasChildren}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-blue-500" />
            <span className="font-medium">{node.name || "-"}</span>
            {hasChildren && (
              <span className="ml-2 text-xs text-gray-400">
                ({node.children.length})
              </span>
            )}
          </div>
        </td>
        {/* 编码列 */}
        <td className="px-4 py-3 text-sm text-gray-500 font-mono">
          {node.locationCode ?? "-"}
        </td>
        {/* 描述列 */}
        <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
          {node.description ?? "-"}
        </td>
        {/* 排序列 */}
        <td className="px-4 py-3 text-sm text-gray-500 text-center">
          {node.sortOrder ?? 0}
        </td>
        {/* 操作列 */}
        <td className="px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAddChild(node)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs
                rounded border border-blue-300 bg-white text-blue-600
                hover:bg-blue-50 transition-colors"
              title="新增子位置"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              子位置
            </button>
            <button
              type="button"
              onClick={() => onEdit(node)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs
                rounded border border-gray-200 bg-white text-gray-700
                hover:bg-gray-50 transition-colors"
              title="编辑"
            >
              <Pencil className="w-3.5 h-3.5" />
              编辑
            </button>
            <button
              type="button"
              onClick={() => onDelete(node)}
              disabled={deletingId === node.id}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs
                rounded border border-red-300 bg-white text-red-600
                hover:bg-red-50 disabled:opacity-50
                disabled:cursor-not-allowed transition-colors"
              title="删除"
            >
              {deletingId === node.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              删除
            </button>
          </div>
        </td>
      </tr>
      {/* 递归渲染子节点 */}
      {hasChildren &&
        isExpanded &&
        node.children.map((child) => (
          <LocationTreeNode
            key={child.id}
            node={child}
            expandedIds={expandedIds}
            onToggle={onToggle}
            onEdit={onEdit}
            onAddChild={onAddChild}
            onDelete={onDelete}
            deletingId={deletingId}
            level={level + 1}
          />
        ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  LocationTree 组件                                                  */
/* ------------------------------------------------------------------ */

/**
 * LocationTree — 位置树形层级展示组件
 *
 * @description 渲染位置层级树的完整表格，包含表头和递归树节点。
 *
 * @param props - 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <LocationTree
 *   treeData={treeData}
 *   expandedIds={expandedIds}
 *   onToggle={handleToggle}
 *   onEdit={handleOpenEdit}
 *   onAddChild={handleOpenAddChild}
 *   onDelete={handleDelete}
 *   deletingId={deletingId}
 * />
 * ```
 */
export function LocationTree({
  treeData,
  expandedIds,
  onToggle,
  onEdit,
  onAddChild,
  onDelete,
  deletingId,
}: LocationTreeProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-[#1e3a5f]">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              位置名称
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              编码
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              描述
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
              排序
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-[#1e3a5f]">
          {treeData.map((rootNode) => (
            <LocationTreeNode
              key={rootNode.id}
              node={rootNode}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              deletingId={deletingId}
              level={0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LocationTree;
