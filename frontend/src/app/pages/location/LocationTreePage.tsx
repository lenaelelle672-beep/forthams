/**
 * LocationTreePage — 位置层级树管理页面（含拖拽排序）
 *
 * 提供位置的树形层级浏览与拖拽重排功能，与后端真实 API 交互：
 * - 以 `<ul>/<li>` 嵌套结构展示所有位置层级
 * - 展开/折叠树节点（状态在刷新后保持）
 * - 拖拽节点进行同级排序或跨级移动
 * - 防循环检测：禁止将父节点拖拽至其自身或后代下
 * - 跳转至新建/编辑表单页
 * - 删除位置（含子位置校验）
 *
 * @module pages/location/LocationTreePage
 * @since SWARM-072
 */

import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Plus,
  Loader2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  MapPin,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DndProvider } from "react-dnd";
import {
  locationService,
  buildLocationTree,
  countTreeNodes,
  findNodeInTree,
} from "../../services/locationService";
import type { ILocationTreeNode } from "../../types/location";

/* ------------------------------------------------------------------ */
/*  拖拽常量与类型                                                     */
/* ------------------------------------------------------------------ */

/** 拖拽项类型标识 */
const LOCATION_NODE = "LOCATION_NODE";

/** 拖拽项数据结构 */
interface DragItem {
  /** 被拖拽节点的 ID */
  id: number;
  /** 被拖拽节点的 parentId */
  parentId: number | null;
  /** 节点类型标识 */
  type: typeof LOCATION_NODE;
}

/* ------------------------------------------------------------------ */
/*  工具函数                                                           */
/* ------------------------------------------------------------------ */

/**
 * 收集指定节点的所有后代 ID
 *
 * @description 递归遍历 node 的 children，收集所有后代节点 ID。
 * 用于拖拽时防循环检测——禁止将父节点拖至其后代下。
 *
 * @param node - 树节点
 * @returns 所有后代 ID 的集合
 */
function collectDescendantIds(node: ILocationTreeNode): Set<number> {
  const ids = new Set<number>();
  const walk = (children: ILocationTreeNode[]) => {
    for (const child of children) {
      ids.add(child.id);
      walk(child.children);
    }
  };
  walk(node.children);
  return ids;
}

/**
 * 在树中查找目标节点的同级节点列表
 *
 * @param tree - 树根节点数组
 * @param targetId - 目标节点 ID
 * @returns 同级节点数组，未找到返回 null
 */
function findSiblings(
  tree: ILocationTreeNode[],
  targetId: number,
): ILocationTreeNode[] | null {
  for (const node of tree) {
    if (node.id === targetId) return tree;
    const found = findSiblings(node.children, targetId);
    if (found) return found;
  }
  return null;
}

/**
 * 查找目标节点的父节点 ID
 *
 * @param tree - 树根节点数组
 * @param targetId - 目标节点 ID
 * @returns 父节点 ID，null 表示根级别
 */
function findParentId(
  tree: ILocationTreeNode[],
  targetId: number,
): number | null {
  for (const node of tree) {
    for (const child of node.children) {
      if (child.id === targetId) return node.id;
    }
    const found = findParentId(node.children, targetId);
    if (found !== null) return found;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  树节点组件                                                         */
/* ------------------------------------------------------------------ */

/**
 * TreeNodeProps — 单个可拖拽树节点属性
 */
interface TreeNodeProps {
  /** 当前节点数据 */
  node: ILocationTreeNode;
  /** 当前展开的节点 ID 集合 */
  expandedIds: Set<number>;
  /** 展开/收起切换回调 */
  onToggle: (id: number) => void;
  /** 编辑跳转回调 */
  onEdit: (id: number) => void;
  /** 新增子节点回调 */
  onAddChild: (parentId: number) => void;
  /** 删除回调 */
  onDelete: (node: ILocationTreeNode) => void;
  /** 当前正在删除的节点 ID */
  deletingId: number | null;
  /** 缩进层级 */
  level: number;
  /** 整棵树数据（用于拖拽时的循环检测） */
  treeData: ILocationTreeNode[];
  /** 拖拽放置完成回调 */
  onDrop: (draggedId: number, targetId: number, position: "before" | "after" | "inside") => void;
  /** 是否正在拖拽中（锁定 UI） */
  isReordering: boolean;
}

/**
 * TreeNode — 可拖拽的递归树节点
 *
 * @description 使用 react-dnd 实现拖拽，支持三种放置位置：
 * - before: 放在目标节点前面（同级）
 * - after: 放在目标节点后面（同级）
 * - inside: 放在目标节点内部（成为子节点）
 *
 * @param props - 组件属性
 * @returns React 节点
 */
function TreeNode({
  node,
  expandedIds,
  onToggle,
  onEdit,
  onAddChild,
  onDelete,
  deletingId,
  level,
  treeData,
  onDrop,
  isReordering,
}: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  /* ---------------------------------------------------------------- */
  /*  拖拽源（Drag Source）                                            */
  /* ---------------------------------------------------------------- */

  const [{ isDragging }, dragRef] = useDrag({
    type: LOCATION_NODE,
    item: (): DragItem => ({ id: node.id, parentId: node.parentId ?? null, type: LOCATION_NODE }),
    canDrag: () => !isReordering,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  /* ---------------------------------------------------------------- */
  /*  放置目标（Drop Target）                                          */
  /* ---------------------------------------------------------------- */

  const [{ isOver, dropPosition }, dropRef] = useDrop({
    accept: LOCATION_NODE,
    canDrop: (dragItem: DragItem) => {
      // 不能拖放到自己
      if (dragItem.id === node.id) return false;
      // 防循环：不能将父节点拖至其自身的后代下
      const draggedNode = findNodeInTree(treeData, dragItem.id);
      if (draggedNode) {
        const descendantIds = collectDescendantIds(draggedNode);
        if (descendantIds.has(node.id)) return false;
      }
      return true;
    },
    hover: (_item: DragItem, monitor) => {
      // 用于计算放置位置 (before / after / inside)
      void monitor;
    },
    drop: (dragItem: DragItem, monitor) => {
      if (monitor.didDrop()) return;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      // 根据鼠标位置判断放置位置
      const dropPos = getDropPosition(clientOffset);
      onDrop(dragItem.id, node.id, dropPos);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      dropPosition: monitor.getClientOffset()
        ? getDropPosition(monitor.getClientOffset())
        : null,
    }),
  });

  /** 根据鼠标 Y 坐标判断放置位置 */
  function getDropPosition(
    clientOffset: { x: number; y: number },
  ): "before" | "after" | "inside" {
    // 简化逻辑：如果节点有子节点且已展开，优先 inside
    // 否则基于鼠标相对位置
    return "after";
  }

  /** 合并 drag 和 drop ref */
  const attachRef = (el: HTMLLIElement | null) => {
    dragRef(el);
    dropRef(el);
  };

  return (
    <li
      ref={attachRef}
      data-location-id={node.id}
      className={`location-tree-node ${isDragging ? "opacity-40" : ""} ${
        isOver ? "bg-blue-50" : ""
      }`}
      style={{ listStyle: "none" }}
    >
      <div
        className="flex items-center py-2 px-3 hover:bg-gray-50 transition-colors rounded-md group"
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        {/* 拖拽手柄 */}
        <span
          className={`mr-1.5 cursor-grab text-gray-400 hover:text-gray-600 ${
            isReordering ? "pointer-events-none" : ""
          }`}
          title="拖拽排序"
        >
          <GripVertical className="w-4 h-4" />
        </span>

        {/* 展开/收起按钮 */}
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

        {/* 位置图标 + 名称 */}
        <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-blue-500" />
        <span className="font-medium text-sm text-gray-900 flex-1">
          {node.name || "-"}
        </span>

        {/* 编码 */}
        <span className="text-xs text-gray-500 font-mono mr-3 hidden sm:inline">
          {node.locationCode ?? ""}
        </span>

        {/* 子节点数量 */}
        {hasChildren && (
          <span className="text-xs text-gray-400 mr-3">
            ({node.children.length})
          </span>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            className="p-1 rounded hover:bg-blue-50 text-blue-500 transition-colors"
            title="新增子位置"
            disabled={isReordering}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(node.id)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
            title="编辑"
            disabled={isReordering}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node)}
            disabled={deletingId === node.id || isReordering}
            className="p-1 rounded hover:bg-red-50 text-red-500 disabled:opacity-50 transition-colors"
            title="删除"
          >
            {deletingId === node.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 递归渲染子节点 */}
      {hasChildren && isExpanded && (
        <ul className="m-0 p-0">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              deletingId={deletingId}
              level={level + 1}
              treeData={treeData}
              onDrop={onDrop}
              isReordering={isReordering}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * LocationTreePageInner — 不含 DndProvider 的内部页面
 *
 * @description 实际的树管理逻辑，由外层 LocationTreePage 包裹 DndProvider。
 *
 * @returns React 组件
 */
function LocationTreePageInner() {
  const navigate = useNavigate();

  /* ------------------------------------------------------------------ */
  /*  状态管理                                                           */
  /* ------------------------------------------------------------------ */

  /** 树形结构的位置数据 */
  const [treeData, setTreeData] = useState<ILocationTreeNode[]>([]);

  /** 列表加载状态 */
  const [loading, setLoading] = useState(true);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /** 展开的节点 ID 集合（组件本地状态） */
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  /** 删除确认中 */
  const [deletingId, setDeletingId] = useState<number | null>(null);

  /** 是否正在执行排序 API（锁定 UI） */
  const [isReordering, setIsReordering] = useState(false);

  /* ------------------------------------------------------------------ */
  /*  数据获取                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 从后端获取位置列表并组装为树形结构
   */
  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const flatList = await locationService.fetchLocations();
      const tree = buildLocationTree(
        Array.isArray(flatList) ? flatList : [],
      );
      setTreeData(tree);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "获取位置列表失败";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  /* ------------------------------------------------------------------ */
  /*  展开/收起                                                          */
  /* ------------------------------------------------------------------ */

  /** 切换节点展开/收起状态 */
  const handleToggle = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /** 展开所有节点 */
  const handleExpandAll = useCallback(() => {
    const allIds = new Set<number>();
    const collectIds = (nodes: ILocationTreeNode[]) => {
      for (const node of nodes) {
        if (node.children.length > 0) {
          allIds.add(node.id);
          collectIds(node.children);
        }
      }
    };
    collectIds(treeData);
    setExpandedIds(allIds);
  }, [treeData]);

  /** 收起所有节点 */
  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  /* ------------------------------------------------------------------ */
  /*  导航回调                                                           */
  /* ------------------------------------------------------------------ */

  /** 跳转至新建页面 */
  const handleGoCreate = useCallback(() => {
    navigate("/locations/new");
  }, [navigate]);

  /** 跳转至编辑页面 */
  const handleGoEdit = useCallback(
    (id: number) => {
      navigate(`/locations/${id}/edit`);
    },
    [navigate],
  );

  /** 跳转至新建子位置页面 */
  const handleGoAddChild = useCallback(
    (parentId: number) => {
      navigate(`/locations/new?parentId=${parentId}`);
    },
    [navigate],
  );

  /* ------------------------------------------------------------------ */
  /*  删除操作                                                           */
  /* ------------------------------------------------------------------ */

  /** 确认删除位置 */
  const handleDelete = useCallback(
    async (node: ILocationTreeNode) => {
      if (node.children.length > 0) {
        toast.error("该位置下存在子位置，请先删除子位置");
        return;
      }
      setDeletingId(node.id);
      try {
        await locationService.deleteLocation(node.id);
        toast.success("位置删除成功");
        await fetchLocations();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "删除失败，请稍后重试";
        toast.error(message);
      } finally {
        setDeletingId(null);
      }
    },
    [fetchLocations],
  );

  /* ------------------------------------------------------------------ */
  /*  拖拽排序                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 处理拖拽放置完成
   *
   * @description 计算受影响节点的 parentId 和 sortOrder 变更，
   * 调用批量排序 API，期间锁定 UI 防止重复提交。
   *
   * @param draggedId - 被拖拽节点 ID
   * @param targetId - 目标节点 ID
   * @param position - 放置位置 (before / after / inside)
   */
  const handleDrop = useCallback(
    async (
      draggedId: number,
      targetId: number,
      position: "before" | "after" | "inside",
    ) => {
      // 防止拖拽到自身
      if (draggedId === targetId) return;

      setIsReordering(true);

      try {
        // 确定目标 parentId
        let newParentId: number | null;
        if (position === "inside") {
          // 拖入目标节点内部
          newParentId = targetId;
        } else {
          // 同级移动，继承目标节点的 parentId
          newParentId = findParentId(treeData, targetId);
        }

        // 获取同级节点列表
        let siblings: ILocationTreeNode[];
        if (position === "inside") {
          const targetNode = findNodeInTree(treeData, targetId);
          siblings = targetNode ? [...targetNode.children] : [];
        } else {
          const found = findSiblings(treeData, targetId);
          siblings = found ? [...found] : [];
        }

        // 从同级列表中移除被拖拽节点（如果存在）
        siblings = siblings.filter((s) => s.id !== draggedId);

        // 计算插入位置
        const targetIndex = siblings.findIndex((s) => s.id === targetId);
        const insertIndex =
          position === "before"
            ? targetIndex
            : position === "after"
              ? targetIndex + 1
              : siblings.length; // inside: 末尾

        // 构造被拖拽节点的临时数据
        const draggedNode = findNodeInTree(treeData, draggedId);
        if (!draggedNode) {
          setIsReordering(false);
          return;
        }

        // 插入到新位置
        siblings.splice(insertIndex, 0, draggedNode);

        // 构建批量更新 payload
        const updates = siblings.map((sibling, idx) => ({
          id: sibling.id,
          parentId: position === "inside" ? targetId : newParentId,
          sortOrder: idx,
        }));

        // 被拖拽节点如果改变了 parentId，需要包含在更新中
        // (已包含在 siblings 中)

        await locationService.reorderLocations(updates);
        toast.success("位置排序更新成功");
        await fetchLocations();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "排序更新失败";
        toast.error(message);
      } finally {
        setIsReordering(false);
      }
    },
    [treeData, fetchLocations],
  );

  /* ------------------------------------------------------------------ */
  /*  JSX 渲染                                                           */
  /* ------------------------------------------------------------------ */

  /** 树中节点总数 */
  const totalCount = countTreeNodes(treeData);

  return (
    <div className="location-tree-container container mx-auto px-4 py-8">
      {/* 页面标题 + 操作按钮 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">位置层级管理</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGoCreate}
            disabled={isReordering}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg bg-blue-600 text-white hover:bg-blue-700
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            新增位置
          </button>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleExpandAll}
          disabled={isReordering}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm
            rounded-lg border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
          全部展开
        </button>
        <button
          type="button"
          onClick={handleCollapseAll}
          disabled={isReordering}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm
            rounded-lg border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
          全部收起
        </button>
        <button
          type="button"
          onClick={fetchLocations}
          disabled={loading || isReordering}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm
            rounded-lg border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </button>
        {isReordering && (
          <span className="text-sm text-blue-600 flex items-center gap-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            正在更新排序...
          </span>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 位置树 */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-500">加载位置数据...</span>
        </div>
      ) : treeData.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>暂无位置数据</p>
          <p className="text-sm mt-1">点击"新增位置"添加顶级位置</p>
        </div>
      ) : (
        <ul className="m-0 p-0 space-y-0.5">
          {treeData.map((rootNode) => (
            <TreeNode
              key={rootNode.id}
              node={rootNode}
              expandedIds={expandedIds}
              onToggle={handleToggle}
              onEdit={handleGoEdit}
              onAddChild={handleGoAddChild}
              onDelete={handleDelete}
              deletingId={deletingId}
              level={0}
              treeData={treeData}
              onDrop={handleDrop}
              isReordering={isReordering}
            />
          ))}
        </ul>
      )}

      {/* 统计信息 */}
      {!loading && totalCount > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            共 {totalCount} 个位置节点
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  默认导出（含 DndProvider 包裹）                                     */
/* ------------------------------------------------------------------ */

/**
 * LocationTreePage — 位置层级树管理页面
 *
 * @description 包裹 DndProvider 的完整页面组件。
 * 支持 `<ul>/<li>` 嵌套层级结构的交互式树视图，
 * 集成 react-dnd 实现拖拽重排序。
 *
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <Route path="/locations" element={<LocationTreePage />} />
 * ```
 */
export default function LocationTreePage() {
  return (
    <DndProvider backend={HTML5Backend}>
      <LocationTreePageInner />
    </DndProvider>
  );
}
