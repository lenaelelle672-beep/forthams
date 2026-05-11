/**
 * LocationTree — 位置树形结构视图组件
 *
 * 接收扁平化的 Location[] 数组，在组件内部通过 buildTree 纯函数
 * 将扁平列表转化为树形结构，并递归渲染树节点。
 * 支持 hover 显示操作按钮（新增子节点、编辑、删除）。
 *
 * @module components/location/LocationTree
 * @since SWARM-048
 */

import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  MapPin,
  FolderPlus,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import type { Location } from "../../services/api";

/* ------------------------------------------------------------------ */
/*  树节点视图类型                                                     */
/* ------------------------------------------------------------------ */

/**
 * TreeNode — 树形结构中的节点视图类型
 *
 * @description 扩展 Location，增加 children 作为视图层计算属性。
 * children 仅在 buildTree 中组装，禁止作为 API payload 提交。
 */
interface TreeNode extends Location {
  /** 子节点列表（视图层计算属性，非持久化字段） */
  children: TreeNode[];
}

/* ------------------------------------------------------------------ */
/*  buildTree 纯函数                                                   */
/* ------------------------------------------------------------------ */

/**
 * 将扁平 Location 数组组装为树形结构
 *
 * @description 依据 parentId 将扁平列表转化为嵌套树形结构。
 * 同级节点按 sortOrder 升序排列，sortOrder 相同时按 id 升序。
 * children 仅作为视图层计算属性，不作为 payload 提交。
 *
 * @param flatList - 后端返回的扁平 Location 数组
 * @returns 嵌套树形结构（仅含根节点，子节点挂载在 children 下）
 */
export function buildTree(flatList: Location[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  /** 初始化所有节点，赋予空 children 数组 */
  for (const item of flatList) {
    map.set(item.id, { ...item, children: [] });
  }

  /** 组装父子关系 */
  for (const item of flatList) {
    const node = map.get(item.id)!;
    if (item.parentId == null || !map.has(item.parentId)) {
      roots.push(node);
    } else {
      const parent = map.get(item.parentId)!;
      parent.children.push(node);
    }
  }

  /** 按 sortOrder 升序，sortOrder 相同时按 id 升序 */
  const sortNodes = (nodes: TreeNode[]) => {
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

/* ------------------------------------------------------------------ */
/*  统计节点总数                                                       */
/* ------------------------------------------------------------------ */

/**
 * 统计树中所有节点总数
 *
 * @param nodes - 树形节点数组
 * @returns 节点总数
 */
export function countTreeNodes(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    count += countTreeNodes(node.children);
  }
  return count;
}

/* ------------------------------------------------------------------ */
/*  组件 Props                                                         */
/* ------------------------------------------------------------------ */

/**
 * LocationTree 组件的 Props 接口
 */
export interface LocationTreeProps {
  /** 扁平化的位置数据数组 */
  locations: Location[];
  /** 加载状态 */
  loading: boolean;
  /** 新增子节点回调 */
  onAddChild: (node: Location) => void;
  /** 编辑节点回调 */
  onEdit: (node: Location) => void;
  /** 删除节点回调 */
  onDelete: (node: Location) => void;
  /** 当前正在删除的节点 ID */
  deletingId: number | null;
}

/* ------------------------------------------------------------------ */
/*  树节点行组件                                                       */
/* ------------------------------------------------------------------ */

/**
 * TreeNodeRow 的 Props 接口
 */
interface TreeNodeRowProps {
  /** 当前节点 */
  node: TreeNode;
  /** 展开的节点 ID 集合 */
  expandedIds: Set<number>;
  /** 展开/收起切换回调 */
  onToggle: (id: number) => void;
  /** 新增子节点回调 */
  onAddChild: (node: Location) => void;
  /** 编辑回调 */
  onEdit: (node: Location) => void;
  /** 删除回调 */
  onDelete: (node: Location) => void;
  /** 当前正在删除的节点 ID */
  deletingId: number | null;
  /** 缩进层级 */
  level: number;
}

/**
 * TreeNodeRow — 单个树节点行
 *
 * @description 递归渲染单个树节点及其子节点，支持展开/收起、
 * hover 时显示操作按钮。
 *
 * @param props - 组件属性
 * @returns React 节点
 */
function TreeNodeRow({
  node,
  expandedIds,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
  deletingId,
  level,
}: TreeNodeRowProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  /** 控制 hover 操作按钮的显示 */
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-gray-50 transition-colors tree-node"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-node-id={node.id}
      >
        {/* 名称列（带缩进和展开图标） */}
        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
          <div
            className="flex items-center"
            style={{ paddingLeft: `${level * 24}px` }}
          >
            {/* 展开/收起图标 */}
            <button
              type="button"
              onClick={() => hasChildren && onToggle(node.id)}
              className={`mr-2 flex-shrink-0 p-0.5 rounded hover:bg-gray-200 transition-colors ${
                hasChildren ? "cursor-pointer" : "cursor-default opacity-30"
              }`}
              disabled={!hasChildren}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
            <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-blue-500" />
            <span className="font-medium tree-node-name">{node.name || "-"}</span>
            {hasChildren && (
              <span className="ml-2 text-xs text-gray-400">
                ({node.children.length})
              </span>
            )}
          </div>
        </td>
        {/* 编码列 */}
        <td className="px-4 py-3 text-sm text-gray-600 font-mono tree-node-code">
          {node.locationCode || "-"}
        </td>
        {/* 描述列 */}
        <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
          {node.description || "-"}
        </td>
        {/* 排序列 */}
        <td className="px-4 py-3 text-sm text-gray-600 text-center">
          {node.sortOrder ?? 0}
        </td>
        {/* 操作列 — hover 时显示 */}
        <td className="px-4 py-3 text-sm">
          <div
            className={`flex items-center gap-2 transition-opacity ${
              hovered ? "opacity-100" : "opacity-0"
            }`}
          >
            <button
              type="button"
              onClick={() => onAddChild(node)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs
                rounded border border-blue-300 bg-white text-blue-600
                hover:bg-blue-50 transition-colors"
              title="新增子节点"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              子位置
            </button>
            <button
              type="button"
              onClick={() => onEdit(node)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs
                rounded border border-gray-300 bg-white text-gray-700
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
          <TreeNodeRow
            key={child.id}
            node={child}
            expandedIds={expandedIds}
            onToggle={onToggle}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDelete={onDelete}
            deletingId={deletingId}
            level={level + 1}
          />
        ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  LocationTree 主组件                                                */
/* ------------------------------------------------------------------ */

/**
 * LocationTree — 位置树形结构视图组件
 *
 * @description 接收扁平 Location 数组，通过 buildTree 在组件内部
 * 转换为树形结构并递归渲染。支持展开/收起、hover 显示操作按钮。
 * 通过 onAddChild、onEdit、onDelete 回调将节点实例向上抛出。
 *
 * @param props - 组件属性
 * @returns React 节点
 */
export default function LocationTree({
  locations,
  loading,
  onAddChild,
  onEdit,
  onDelete,
  deletingId,
}: LocationTreeProps) {
  /** 展开的节点 ID 集合 */
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  /** 将扁平列表组装为树 */
  const treeData = buildTree(locations);

  /** 切换节点展开/收起 */
  const handleToggle = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /** 展开所有节点 */
  const handleExpandAll = () => {
    const allIds = new Set<number>();
    const collectIds = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.children.length > 0) {
          allIds.add(node.id);
          collectIds(node.children);
        }
      }
    };
    collectIds(treeData);
    setExpandedIds(allIds);
  };

  /** 收起所有节点 */
  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  return (
    <div>
      {/* 工具栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExpandAll}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs
            rounded border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          全部展开
        </button>
        <button
          type="button"
          onClick={handleCollapseAll}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs
            rounded border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          全部收起
        </button>
      </div>

      {/* 树形表格 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                位置名称
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                编码
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                描述
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                排序
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  加载中...
                </td>
              </tr>
            ) : treeData.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  暂无位置数据，点击"新增位置"添加顶级位置
                </td>
              </tr>
            ) : (
              treeData.map((rootNode) => (
                <TreeNodeRow
                  key={rootNode.id}
                  node={rootNode}
                  expandedIds={expandedIds}
                  onToggle={handleToggle}
                  onAddChild={onAddChild}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  deletingId={deletingId}
                  level={0}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 统计信息 */}
      {!loading && treeData.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            共 {countTreeNodes(treeData)} 个位置节点
          </p>
        </div>
      )}
    </div>
  );
}
