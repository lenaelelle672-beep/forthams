/**
 * LocationFormModal — 位置新增/编辑弹窗组件
 *
 * 提供新增和编辑位置的表单弹窗，包含名称、编码、排序号、描述等字段。
 * 上级位置以只读方式展示，通过 parentId 判断新增的父节点。
 *
 * @module pages/location/LocationFormModal
 * @since SWARM-059
 */

import React from "react";
import { X, Loader2 } from "lucide-react";
import type { LocationFormData, ILocationTreeNode } from "../../types/location";

/* ------------------------------------------------------------------ */
/*  Props 接口                                                         */
/* ------------------------------------------------------------------ */

/**
 * LocationFormModalProps — 弹窗组件属性
 */
export interface LocationFormModalProps {
  /** 弹窗是否可见 */
  open: boolean;
  /** 当前编辑的位置 ID，null 表示新增模式 */
  editingId: number | null;
  /** 表单数据 */
  formData: LocationFormData;
  /** 提交中状态 */
  submitting: boolean;
  /** 树形数据，用于查找父位置名称 */
  treeData: ILocationTreeNode[];
  /** 表单字段变化回调 */
  onFieldChange: (field: keyof LocationFormData, value: string | number | null) => void;
  /** 提交回调 */
  onSubmit: () => void;
  /** 关闭弹窗回调 */
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  辅助函数                                                           */
/* ------------------------------------------------------------------ */

/**
 * 在树中查找指定 ID 的节点名称
 *
 * @param nodes - 树形节点数组
 * @param id - 目标节点 ID
 * @returns 节点名称或空字符串
 */
function findNodeName(nodes: ILocationTreeNode[], id: number): string {
  for (const n of nodes) {
    if (n.id === id) return n.name ?? String(n.id);
    const found = findNodeName(n.children, id);
    if (found) return found;
  }
  return "";
}

/**
 * 获取父位置名称
 *
 * @param parentId - 父节点 ID，null 表示顶级
 * @param treeData - 树形数据
 * @returns 父位置名称字符串
 */
function getParentName(parentId: number | null, treeData: ILocationTreeNode[]): string {
  if (parentId == null) return "（顶级）";
  return findNodeName(treeData, parentId) || `ID: ${parentId}`;
}

/* ------------------------------------------------------------------ */
/*  弹窗组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * LocationFormModal — 位置新增/编辑弹窗
 *
 * @description 提供位置的新增和编辑表单弹窗。上级位置以只读方式展示，
 * 表单包含名称（必填）、编码、排序号、描述等字段。
 *
 * @param props - 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <LocationFormModal
 *   open={modalOpen}
 *   editingId={editingId}
 *   formData={formData}
 *   submitting={submitting}
 *   treeData={treeData}
 *   onFieldChange={handleFieldChange}
 *   onSubmit={handleSubmit}
 *   onClose={handleCloseModal}
 * />
 * ```
 */
export function LocationFormModal({
  open,
  editingId,
  formData,
  submitting,
  treeData,
  onFieldChange,
  onSubmit,
  onClose,
}: LocationFormModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
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
            onClick={onClose}
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
              {getParentName(formData.parentId, treeData)}
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
              onChange={(e) => onFieldChange("name", e.target.value)}
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
                  onFieldChange("locationCode", e.target.value)
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
                  onFieldChange("sortOrder", Number(e.target.value))
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
                onFieldChange("description", e.target.value)
              }
              placeholder="请输入位置描述"
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                focus:border-blue-500 transition-colors resize-none"
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300
              bg-white text-gray-700 hover:bg-gray-50
              disabled:opacity-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
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
  );
}

export default LocationFormModal;
