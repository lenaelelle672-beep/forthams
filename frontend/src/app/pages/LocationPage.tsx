/**
 * LocationPage — 位置管理页面
 *
 * 提供位置的树形层级管理功能，支持：
 * - 以树形结构展示所有位置
 * - 新增顶级位置和子位置
 * - 编辑位置名称、编码、描述、排序等信息
 * - 删除位置（含子位置校验）
 * - 展开收起树形节点
 *
 * 数据通过后端 `/locations` REST API 持久化。
 *
 * @module pages/LocationPage
 * @since SWARM-023
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  X,
  ChevronRight,
  ChevronDown,
  MapPin,
  FolderPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  locationService,
  buildLocationTree,
  countTreeNodes,
  EMPTY_LOCATION_FORM,
  type LocationRecord,
  type LocationFormData,
} from "../services/locationService";

/* ------------------------------------------------------------------ */
/*  树节点组件                                                         */
/* ------------------------------------------------------------------ */

/**
 * LocationTreeNode 的 props 接口
 */
interface LocationTreeNodeProps {
  /** 当前节点数据 */
  node: LocationRecord;
  /** 当前展开的节点 ID 集合 */
  expandedIds: Set<number>;
  /** 展开/收起切换回调 */
  onToggle: (id: number) => void;
  /** 编辑回调 */
  onEdit: (node: LocationRecord) => void;
  /** 新增子节点回调 */
  onAddChild: (parent: LocationRecord) => void;
  /** 删除回调 */
  onDelete: (node: LocationRecord) => void;
  /** 当前正在删除的节点 ID */
  deletingId: number | null;
  /** 缩进层级 */
  level: number;
}

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
  const hasChildren = node.children && node.children.length > 0;
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
            <span className="font-medium">{node.name || "-"}</span>
            {hasChildren && (
              <span className="ml-2 text-xs text-gray-400">
                ({node.children!.length})
              </span>
            )}
          </div>
        </td>
        {/* 编码列 */}
        <td className="px-4 py-3 text-sm text-gray-600 font-mono">
          {node.locationCode ?? "-"}
        </td>
        {/* 描述列 */}
        <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
          {node.description ?? "-"}
        </td>
        {/* 排序列 */}
        <td className="px-4 py-3 text-sm text-gray-600 text-center">
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
        node.children!.map((child) => (
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
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * LocationPage — 位置管理页面
 *
 * 提供位置的树形层级 CRUD 功能：浏览树形结构、展开收起节点、
 * 新增顶级/子级位置、编辑位置信息、删除位置。
 * 数据通过后端 `/locations` REST API 持久化。
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
  const [treeData, setTreeData] = useState<LocationRecord[]>([]);

  /** 列表加载状态 */
  const [loading, setLoading] = useState(true);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /** 展开的节点 ID 集合 */
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
   * @description 调用 locationService.list() 获取所有位置的平铺列表，
   * 然后通过 buildLocationTree 组装成嵌套的树形结构。
   */
  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const flatList = await locationService.list();
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
    const collectIds = (nodes: LocationRecord[]) => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
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
  const handleOpenAddChild = useCallback((parent: LocationRecord) => {
    setEditingId(null);
    setFormData({ ...EMPTY_LOCATION_FORM, parentId: parent.id });
    setModalOpen(true);
  }, []);

  /**
   * 打开编辑位置弹窗
   *
   * @param node - 待编辑的位置节点
   */
  const handleOpenEdit = useCallback((node: LocationRecord) => {
    setEditingId(node.id);
    setFormData({
      name: node.name ?? "",
      locationCode: node.locationCode ?? "",
      parentId: node.parentId ?? null,
      sortOrder: node.sortOrder ?? 0,
      description: node.description ?? "",
      status: node.status ?? 1,
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
   * 调用对应的 locationService API
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
        status: formData.status,
      };

      if (editingId !== null) {
        await locationService.update(editingId, payload);
        toast.success("位置更新成功");
      } else {
        await locationService.create(payload);
        toast.success("位置创建成功");
      }

      handleCloseModal();
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
   * @param node - 待删除的位置节点
   */
  const handleDelete = useCallback(
    async (node: LocationRecord) => {
      // 校验是否有子节点
      if (node.children && node.children.length > 0) {
        toast.error("该位置下存在子位置，请先删除子位置");
        return;
      }

      setDeletingId(node.id);
      try {
        await locationService.delete(node.id);
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
  /*  JSX 渲染                                                           */
  /* ------------------------------------------------------------------ */

  /** 树中节点总数 */
  const totalCount = countTreeNodes(treeData);

  /** 查找父位置名称的辅助函数 */
  const getParentName = (parentId: number | null): string => {
    if (parentId == null) return "（顶级）";
    const findName = (nodes: LocationRecord[]): string => {
      for (const n of nodes) {
        if (n.id === parentId) return n.name ?? String(n.id);
        if (n.children) {
          const found = findName(n.children);
          if (found) return found;
        }
      }
      return "";
    };
    return findName(treeData) || `ID: ${parentId}`;
  };

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
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 位置树形表格 */}
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
                <LocationTreeNode
                  key={rootNode.id}
                  node={rootNode}
                  expandedIds={expandedIds}
                  onToggle={handleToggle}
                  onEdit={handleOpenEdit}
                  onAddChild={handleOpenAddChild}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                  level={0}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 统计信息 */}
      {!loading && totalCount > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            共 {totalCount} 个位置节点
          </p>
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩层 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCloseModal}
          />

          {/* 弹窗内容 */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            {/* 弹窗标题 */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId !== null ? "编辑位置" : "新增位置"}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 表单 */}
            <div className="space-y-4">
              {/* 上级位置（只读展示） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  上级位置
                </label>
                <div className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
                  {getParentName(formData.parentId)}
                </div>
              </div>

              {/* 位置名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  位置名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="请输入位置名称"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                    bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                    focus:border-blue-500 transition-colors"
                />
              </div>

              {/* 位置编码 + 排序 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    位置编码
                  </label>
                  <input
                    type="text"
                    value={formData.locationCode}
                    onChange={(e) =>
                      handleFieldChange("locationCode", e.target.value)
                    }
                    placeholder="请输入位置编码"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                      bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                      focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    排序号
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) =>
                      handleFieldChange("sortOrder", Number(e.target.value))
                    }
                    min={0}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                      bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                      focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                  placeholder="请输入位置描述"
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                    bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                    focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              {/* 状态 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  状态
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    handleFieldChange("status", Number(e.target.value))
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                    bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>启用</option>
                  <option value={0}>禁用</option>
                </select>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300
                  bg-white text-gray-700 hover:bg-gray-50
                  disabled:opacity-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white
                  hover:bg-blue-700 disabled:opacity-50
                  disabled:cursor-not-allowed transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    提交中...
                  </span>
                ) : editingId !== null ? (
                  "保存修改"
                ) : (
                  "创建位置"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
