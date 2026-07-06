/**
 * LocationPage — 位置管理页面（状态编排层）
 *
 * 作为唯一的状态宿主，编排 LocationTree 和 LocationFormDialog 组件。
 * 初始化时调用 fetchLocationTree 加载全量数据至 useState<Location[]>。
 * 管理 LocationFormDialog 的开闭状态及当前操作的 targetNode。
 * 将 LocationTree 的操作回调接入 LocationFormDialog 的弹窗控制逻辑，
 * 实现"点击树节点按钮 -> 打开弹窗并注入数据 -> 弹窗提交成功 -> 刷新树数据"的完整闭环。
 *
 * 删除操作使用二次确认弹窗（非浏览器原生 alert），符合 ATB-04 约束。
 *
 * @module pages/LocationPage
 * @since SWARM-048
 */

import React, { useState, useCallback, useEffect } from "react";
import { Plus, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import LocationTree from "../components/location/LocationTree";
import LocationFormDialog from "../components/location/LocationFormDialog";
import {
  fetchLocationTree,
  deleteLocation,
  type Location,
} from "../services/api";

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * LocationPage — 位置管理页面
 *
 * @description 提供位置的树形层级 CRUD 功能：浏览树形结构、展开收起节点、
 * 新增顶级/子级位置、编辑位置信息、删除位置（含二次确认）。
 * 数据通过后端 `/api/locations` REST API 持久化。
 *
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <Route path="/locations" element={<LocationPage />} />
 * ```
 */
export default function LocationPage() {
  /* ------------------------------------------------------------------ */
  /*  状态管理                                                           */
  /* ------------------------------------------------------------------ */

  /** 扁平化的位置数据数组（后端返回的原始数据） */
  const [locations, setLocations] = useState<Location[]>([]);

  /** 列表加载状态 */
  const [loading, setLoading] = useState(true);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /** LocationFormDialog 是否可见 */
  const [dialogOpen, setDialogOpen] = useState(false);

  /** 弹窗模式：'create' | 'edit' */
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");

  /** 当前操作的目标节点 */
  const [targetNode, setTargetNode] = useState<Location | null>(null);

  /** 创建子节点时隐式绑定的父节点 ID */
  const [defaultParentId, setDefaultParentId] = useState<number | null>(null);

  /** 父节点名称（弹窗展示用） */
  const [parentName, setParentName] = useState<string>("");

  /** 当前正在删除的节点 ID */
  const [deletingId, setDeletingId] = useState<number | null>(null);

  /** 删除确认弹窗状态 */
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    node: Location | null;
  }>({ open: false, node: null });

  /* ------------------------------------------------------------------ */
  /*  数据获取                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 从后端获取位置列表
   *
   * @description 调用 fetchLocationTree() 获取所有位置的平铺列表，
   * 存储在 locations state 中，由 LocationTree 组件内部进行树形组装。
   */
  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLocationTree();
      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "获取位置列表失败";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 初始加载数据
   */
  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  /* ------------------------------------------------------------------ */
  /*  查找父节点名称的辅助函数                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 根据 parentId 在扁平列表中查找父节点名称
   *
   * @param parentId - 父节点 ID
   * @returns 父节点名称字符串
   */
  const getParentNameById = useCallback(
    (parentId: number | null): string => {
      if (parentId == null) return "（顶级）";
      const parent = locations.find((loc) => loc.id === parentId);
      return parent?.name ?? `ID: ${parentId}`;
    },
    [locations],
  );

  /* ------------------------------------------------------------------ */
  /*  树操作回调 -> 弹窗控制逻辑                                        */
  /* ------------------------------------------------------------------ */

  /**
   * 打开新增顶级位置弹窗
   */
  const handleOpenCreate = useCallback(() => {
    setDialogMode("create");
    setTargetNode(null);
    setDefaultParentId(null);
    setParentName("（顶级）");
    setDialogOpen(true);
  }, []);

  /**
   * 新增子节点回调 — 由 LocationTree 触发
   *
   * @param parent - 父节点
   */
  const handleAddChild = useCallback((parent: Location) => {
    setDialogMode("create");
    setTargetNode(null);
    setDefaultParentId(parent.id);
    setParentName(parent.name);
    setDialogOpen(true);
  }, []);

  /**
   * 编辑节点回调 — 由 LocationTree 触发
   *
   * @param node - 待编辑的节点
   */
  const handleEdit = useCallback((node: Location) => {
    setDialogMode("edit");
    setTargetNode(node);
    setDefaultParentId(node.parentId);
    setParentName("");
    setDialogOpen(true);
  }, []);

  /**
   * 删除节点回调 — 由 LocationTree 触发
   * 显示二次确认弹窗（ATB-04: 非浏览器原生 alert）
   *
   * @param node - 待删除的节点
   */
  const handleDeleteRequest = useCallback((node: Location) => {
    setDeleteConfirm({ open: true, node });
  }, []);

  /**
   * 确认删除 — 二次确认弹窗的确认按钮
   */
  const handleConfirmDelete = useCallback(async () => {
    const node = deleteConfirm.node;
    if (!node) return;

    setDeleteConfirm({ open: false, node: null });
    setDeletingId(node.id);

    try {
      await deleteLocation(node.id);
      toast.success("位置删除成功");
      await loadLocations();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "删除失败，请稍后重试";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }, [deleteConfirm.node, loadLocations]);

  /**
   * 取消删除 — 二次确认弹窗的取消按钮
   */
  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm({ open: false, node: null });
  }, []);

  /**
   * 弹窗操作成功回调 — 关闭弹窗并刷新数据
   */
  const handleDialogSuccess = useCallback(() => {
    setDialogOpen(false);
    setTargetNode(null);
    loadLocations();
  }, [loadLocations]);

  /**
   * 关闭弹窗回调
   */
  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setTargetNode(null);
  }, []);

  /* ------------------------------------------------------------------ */
  /*  JSX 渲染                                                           */
  /* ------------------------------------------------------------------ */

  /** 获取编辑弹窗中显示的父节点名称 */
  const dialogParentName =
    dialogMode === "edit" && targetNode
      ? getParentNameById(targetNode.parentId)
      : parentName;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 + 操作按钮 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">位置管理</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg bg-blue-600 text-white hover:bg-blue-700
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4" />
            新增位置
          </button>
          <button
            type="button"
            onClick={loadLocations}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm
              rounded-lg border border-gray-200 bg-white text-gray-700
              hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm error-message">
          {error}
        </div>
      )}

      {/* 位置树形组件 — Level 2 */}
      <LocationTree
        locations={locations}
        loading={loading}
        onAddChild={handleAddChild}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
        deletingId={deletingId}
      />

      {/* 创建/编辑弹窗 — Level 3 */}
      <LocationFormDialog
        open={dialogOpen}
        mode={dialogMode}
        targetNode={targetNode}
        defaultParentId={defaultParentId}
        parentName={dialogParentName}
        onSuccess={handleDialogSuccess}
        onClose={handleDialogClose}
      />

      {/* 删除二次确认弹窗 — ATB-04 约束 */}
      {deleteConfirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩层 */}
          <div className="absolute inset-0 bg-black/50" />

          {/* 确认弹窗内容 */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                确认删除
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              确定要删除位置「{deleteConfirm.node?.name}」吗？此操作不可撤销。
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200
                  bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white
                  hover:bg-red-700 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
