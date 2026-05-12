/**
 * LocationPage — 位置层级管理页面
 *
 * 提供位置的树形层级管理功能，与后端真实 API 交互：
 * - 以树形结构展示所有位置（真实数据加载）
 * - 展开/折叠树形节点（状态在刷新后保持）
 * - 新增顶级位置和子位置
 * - 编辑位置名称、编码、描述、排序等信息
 * - 删除位置（含子位置校验）
 * - 异常状态与空数据兜底
 *
 * 数据通过后端 `/locations` REST API 持久化，
 * 前端通过 buildLocationTree 将扁平数据转换为树形结构。
 *
 * 组件拆分（SWARM-059）：
 * - LocationTree — 递归树形展示组件
 * - LocationFormModal — 新增/编辑弹窗组件
 *
 * @module pages/location/LocationPage
 * @since SWARM-035
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  Plus,
  Loader2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  locationService,
  buildLocationTree,
  countTreeNodes,
} from "../../services/locationService";
import {
  EMPTY_LOCATION_FORM,
  type ILocationTreeNode,
  type LocationFormData,
} from "../../types/location";
import { LocationTree } from "./LocationTree";
import { LocationFormModal } from "./LocationFormModal";

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * LocationPage — 位置层级管理页面
 *
 * @description 提供位置的树形层级 CRUD 功能，数据通过后端真实 API 获取。
 * 关键设计：
 * - 展开状态 (expandedIds) 作为组件本地状态，管理操作刷新后不重置
 * - 扁平数据通过 buildLocationTree 转换为树形结构
 * - 同级节点严格按 sortOrder 升序排列
 * - 异常和空数据有明确 UI 兜底
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

  /** 树形结构的位置数据 */
  const [treeData, setTreeData] = useState<ILocationTreeNode[]>([]);

  /** 列表加载状态 */
  const [loading, setLoading] = useState(true);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /** 展开的节点 ID 集合（组件本地状态，刷新后保持） */
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  /** 新增/编辑弹窗是否可见 */
  const [modalOpen, setModalOpen] = useState(false);

  /** 当前编辑的位置 ID，null 表示新增模式 */
  const [editingId, setEditingId] = useState<number | null>(null);

  /** 表单数据 */
  const [formData, setFormData] = useState<LocationFormData>(EMPTY_LOCATION_FORM);

  /** 表单提交中 */
  const [submitting, setSubmitting] = useState(false);

  /** 删除确认中 */
  const [deletingId, setDeletingId] = useState<number | null>(null);

  /* ------------------------------------------------------------------ */
  /*  数据获取                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 从后端获取位置列表并组装为树形结构
   *
   * @description 调用 locationService.fetchLocations() 获取所有位置的平铺列表，
   * 然后通过 buildLocationTree 组装成嵌套的树形结构。
   * 注意：不重置 expandedIds，保持用户当前的展开视图。
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

  /**
   * 初始加载数据
   */
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  /* ------------------------------------------------------------------ */
  /*  展开/收起                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * 切换节点展开/收起状态
   *
   * @param id - 节点 ID
   */
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

  /**
   * 展开所有节点
   */
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

  /**
   * 收起所有节点
   */
  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  /* ------------------------------------------------------------------ */
  /*  新增/编辑弹窗                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * 打开新增顶级位置弹窗
   */
  const handleOpenCreate = useCallback(() => {
    setEditingId(null);
    setFormData({ ...EMPTY_LOCATION_FORM, parentId: null });
    setModalOpen(true);
  }, []);

  /**
   * 打开新增子位置弹窗
   *
   * @param parent - 父节点
   */
  const handleOpenAddChild = useCallback((parent: ILocationTreeNode) => {
    setEditingId(null);
    setFormData({ ...EMPTY_LOCATION_FORM, parentId: parent.id });
    setModalOpen(true);
  }, []);

  /**
   * 打开编辑位置弹窗
   *
   * @param node - 待编辑的位置节点
   */
  const handleOpenEdit = useCallback((node: ILocationTreeNode) => {
    setEditingId(node.id);
    setFormData({
      name: node.name ?? "",
      locationCode: node.locationCode ?? "",
      parentId: node.parentId ?? null,
      sortOrder: node.sortOrder ?? 0,
      description: node.description ?? "",
    });
    setModalOpen(true);
  }, []);

  /**
   * 关闭弹窗
   */
  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setFormData(EMPTY_LOCATION_FORM);
  }, []);

  /**
   * 处理表单字段变化
   *
   * @param field - 字段名
   * @param value - 字段值
   */
  const handleFieldChange = useCallback(
    (field: keyof LocationFormData, value: string | number | null) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  /**
   * 提交表单（新增或编辑）
   *
   * @description 根据是否有 editingId 判断是新增还是编辑，
   * 调用对应的 locationService API。操作成功后重新获取数据，
   * 但不重置 expandedIds，保持当前展开视图。
   */
  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) {
      toast.error("位置名称不能为空");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        locationCode: formData.locationCode.trim() || undefined,
        parentId: formData.parentId,
        sortOrder: formData.sortOrder,
        description: formData.description.trim() || undefined,
      };

      if (editingId !== null) {
        await locationService.update(editingId, payload);
        toast.success("位置更新成功");
      } else {
        await locationService.create(payload);
        toast.success("位置创建成功");
      }

      handleCloseModal();
      // 重新获取数据，但不重置 expandedIds（保持展开状态）
      await fetchLocations();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "操作失败，请稍后重试";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingId, handleCloseModal, fetchLocations]);

  /* ------------------------------------------------------------------ */
  /*  删除操作                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 确认删除位置
   *
   * @description 校验是否有子节点，如果有则提示用户先删除子节点。
   * 删除成功后重新获取数据，但保持 expandedIds 不变。
   *
   * @param node - 待删除的位置节点
   */
  const handleDelete = useCallback(
    async (node: ILocationTreeNode) => {
      // 校验是否有子节点
      if (node.children.length > 0) {
        toast.error("该位置下存在子位置，请先删除子位置");
        return;
      }

      setDeletingId(node.id);
      try {
        await locationService.deleteLocation(node.id);
        toast.success("位置删除成功");
        // 重新获取数据，但不重置 expandedIds
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
  /*  JSX 渲染                                                           */
  /* ------------------------------------------------------------------ */

  /** 树中节点总数 */
  const totalCount = countTreeNodes(treeData);

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
        </div>
      </div>

      {/* 工具栏：展开/收起 + 刷新 */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleExpandAll}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm
            rounded-lg border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
          全部展开
        </button>
        <button
          type="button"
          onClick={handleCollapseAll}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm
            rounded-lg border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
          全部收起
        </button>
        <button
          type="button"
          onClick={fetchLocations}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm
            rounded-lg border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm error-container">
          {error}
        </div>
      )}

      {/* 位置树形表格 */}
      {loading ? (
        <div className="rounded-lg border border-gray-200 shadow-sm">
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
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  加载中...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-gray-200 shadow-sm">
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
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-red-500">
                  <div className="error-container">
                    加载失败：{error}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : treeData.length === 0 ? (
        <div className="rounded-lg border border-gray-200 shadow-sm">
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
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                  暂无位置数据，点击&quot;新增位置&quot;添加顶级位置
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <LocationTree
          treeData={treeData}
          expandedIds={expandedIds}
          onToggle={handleToggle}
          onEdit={handleOpenEdit}
          onAddChild={handleOpenAddChild}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      )}

      {/* 统计信息 */}
      {!loading && totalCount > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            共 {totalCount} 个位置节点
          </p>
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      <LocationFormModal
        open={modalOpen}
        editingId={editingId}
        formData={formData}
        submitting={submitting}
        treeData={treeData}
        onFieldChange={handleFieldChange}
        onSubmit={handleSubmit}
        onClose={handleCloseModal}
      />
    </div>
  );
}
